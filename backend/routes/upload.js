const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseExcelBuffer } = require('../utils/excelParser');
const { processMarquesinaExcel, isMarquesinaExcel } = require('../utils/marquesinaProcessor');
const {
  saveRecord,
  createUpload,
  updateUpload,
  addValidationErrors,
  getUploadErrors,
  validateRecord,
  isStopRegistered,
  toStopCode,
  saveMarquesinaDay,
  getMarquesinaDay,
  createStop,
  getStopByCode,
  deleteRecord,
  getRecords
} = require('../config/firebase');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

async function makeValidationErrors(records) {
  const errors = [];

  for (const record of records) {
    const rowErrors = validateRecord(record);
    for (const message of rowErrors) {
      errors.push({
        row: record.rowIndex,
        column: message.includes('Fecha') ? 'Fecha' : message.includes('stop_code') ? 'Código Marquesina' : 'Métricas',
        value: null,
        message,
        severity: 'error'
      });
    }

    const normalizedStopCode = toStopCode(record.stopCode, record.entity);
    const exists = await isStopRegistered(normalizedStopCode);
    if (!exists) {
      errors.push({
        row: record.rowIndex,
        column: 'Código Marquesina',
        value: normalizedStopCode,
        message: `La marquesina ${normalizedStopCode} no está dada de alta en el catálogo`,
        severity: 'error'
      });
    }
  }

  return errors;
}

// POST /api/upload - Subir, validar y procesar en una operación
// Auto-detecta si es un Excel IoT de marquesina (pestaña "Schema Query")
// o el formato clásico de afluencia.
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha enviado ningún archivo'
      });
    }

    // ─── Auto-detección: ¿Excel IoT de marquesina? ───────────
    if (isMarquesinaExcel(req.file.buffer)) {
      try {
        const processed = processMarquesinaExcel(req.file.buffer, req.file.originalname);
        const saveResult = await saveMarquesinaDay(processed);

        // ─── Puente: crear stop + record en afluencia para el Dashboard ───
        const stopCode = toStopCode(processed.meta.location);
        const existingStop = await getStopByCode(stopCode);
        if (!existingStop) {
          try {
            await createStop({
              stopCode,
              name: processed.meta.location,
              location: processed.meta.location,
              zone: '',
              municipality: '',
              status: 'active',
              notes: 'Auto-creado desde Excel IoT de marquesina'
            });
          } catch (stopErr) {
            // Ya existe o error menor — no bloquear la subida
            console.warn(`⚠️  No se pudo crear stop ${stopCode}: ${stopErr.message}`);
          }
        }

        // Mapear datos de marquesina al formato de afluencia_records
        const g = processed.gender || {};
        const a = processed.age || {};
        const totalDetected = processed.summary.total_detected || 0;
        const identified = processed.summary.total_identified || 0;

        const afluenciaRecord = {
          date: processed.meta.date,
          stopCode,
          entity: processed.meta.location,
          totals: {
            adults: processed.summary.people?.adult || identified,
            children: processed.summary.people?.children || 0,
            afterDeduplication: processed.summary.deduplicated || 0,
            totalNumber: totalDetected,
            heavyEmployees: processed.summary.people?.employees_entering || 0
          },
          gender: {
            man: g.male?.count || 0,
            woman: g.female?.count || 0,
            unknown: (g.unknown?.count || 0) + (g.not_identified?.count || 0)
          },
          age: {
            '0-9':   a['<10']?.count   || 0,
            '10-16': a['10-16']?.count  || 0,
            '17-30': a['17-30']?.count  || 0,
            '31-45': a['31-45']?.count  || 0,
            '46-60': a['46-60']?.count  || 0,
            '60+':   a['>60']?.count    || 0,
            unknown: (a.unknown?.count || 0) + (a.not_identified?.count || 0)
          },
          ageHeavy: {
            '0-9': 0, '10-16': 0, '17-30': 0, '31-45': 0, '46-60': 0, '60+': 0, unknown: 0
          },
          residenceTime: `00:${String(processed.summary.avg_dwell_minutes || 0).padStart(2, '0')}:00`,
          passengerFlow: null,
          // ─── Datos IoT extendidos ───────────────────
          hourly: (processed.hourly || []).map(h => ({
            hour: h.hour,
            entryLot: h.entry_lot || 0,
            outgoingBatch: h.outgoing_batch || 0,
            totalPersons: h.detected || 0,
            peopleDet: h.people_detained || 0,
            peopleIn: h.people_in || 0,
            peopleOut: h.people_out || 0,
            passby: h.passby || 0,
            turnback: h.turnback || 0,
            adult: h.adult || 0,
            children: h.children || 0,
            residents: h.residents || 0,
            employeeEntry: h.employee_entry || 0,
            customersEnter: h.customers_enter || 0,
            vehicleEntry: h.vehicle_entry || 0,
            vehicleExit: h.vehicle_exit || 0,
            deduplicated: h.deduplicated || 0,
            totalVehicles: h.total_vehicles || 0,
            employeesEntering: h.employees_entering || 0,
            gender: h.gender || {},
            age: h.age || {},
            genderG2: h.gender_g2 || {},
            ageG2: h.age_g2 || {},
            avgDwellMinutes: h.avg_dwell_minutes || 0,
          })),
          peakHour: processed.summary.peak_hour || null,
          trafficTotals: {
            entryLot: processed.summary.traffic?.entry_lot || 0,
            outgoingBatch: processed.summary.traffic?.outgoing_batch || 0,
            peopleDet: processed.summary.traffic?.people_detained || 0,
            peopleIn: processed.summary.traffic?.people_in || 0,
            peopleOut: processed.summary.traffic?.people_out || 0,
            passby: processed.summary.traffic?.passby || 0,
            turnback: processed.summary.traffic?.turnback || 0,
          },
          // ─── Informe completo IoT (todas las 42 columnas) ───
          iotReport: {
            meta: processed.meta,
            summary: processed.summary,
            gender: processed.gender,
            age: processed.age,
            genderG2: processed.gender_g2 || null,
            ageG2: processed.age_g2 || null,
            officialTotals: processed.officialTotals || null,
            observations: processed.observations || [],
          }
        };

        await saveRecord(afluenciaRecord, {});

        return res.json({
          success: true,
          type: 'marquesina',
          message: `Datos IoT del ${processed.meta.date} (${processed.meta.location}) procesados correctamente`,
          data: {
            location: processed.meta.location,
            date: processed.meta.date,
            activeHours: processed.meta.active_hours,
            totalDetected: processed.summary.total_detected,
            identificationRate: processed.summary.identification_rate,
            peakHour: processed.summary.peak_hour,
            summary: processed.summary,
            gender: processed.gender,
            age: processed.age,
            action: saveResult.action
          }
        });
      } catch (marquesinaError) {
        return res.status(422).json({
          success: false,
          type: 'marquesina',
          error: marquesinaError.message
        });
      }
    }

    // ─── Flujo clásico de afluencia ──────────────────────────
    const uploadSession = await createUpload({
      filename: req.file.originalname,
      size: req.file.size,
      uploadedBy: req.headers['x-user-id'] || 'anonymous'
    });

    const parsed = parseExcelBuffer(req.file.buffer, req.file.originalname);

    if (parsed.records.length === 0) {
      await updateUpload(uploadSession.id, {
        status: 'rejected',
        stats: { totalRows: 0, inserted: 0, updated: 0, rejected: 0, warnings: 0 }
      });
      return res.status(400).json({
        success: false,
        error: 'El archivo no contiene datos válidos',
        uploadId: uploadSession.id
      });
    }

    const validationErrors = await makeValidationErrors(parsed.records);
    await addValidationErrors(uploadSession.id, validationErrors);

    const errorsByRow = new Set(validationErrors.map(err => err.row));
    const validRecords = parsed.records.filter(record => !errorsByRow.has(record.rowIndex));

    const savedIds = [];
    const processErrors = [];
    let inserted = 0;
    let updated = 0;

    for (const record of validRecords) {
      try {
        const result = await saveRecord(
          {
            ...record,
            stopCode: toStopCode(record.stopCode, record.entity)
          },
          { uploadId: uploadSession.id }
        );
        savedIds.push(result.id);
        if (result.action === 'updated') updated += 1;
        else inserted += 1;
      } catch (err) {
        processErrors.push({
          row: record.rowIndex,
          error: err.message
        });
      }
    }

    const totalRejected = validationErrors.length + processErrors.length;

    await addValidationErrors(
      uploadSession.id,
      processErrors.map(err => ({
        row: err.row,
        column: 'Procesamiento',
        message: err.error,
        severity: 'error'
      }))
    );

    await updateUpload(uploadSession.id, {
      status: totalRejected > 0 ? 'processed_with_errors' : 'processed',
      stats: {
        totalRows: parsed.totalRows,
        inserted,
        updated,
        rejected: totalRejected,
        warnings: parsed.unmappedHeaders.length
      },
      unmappedHeaders: parsed.unmappedHeaders
    });

    res.json({
      success: true,
      message: `Se procesaron ${parsed.totalRows} filas del archivo`,
      data: {
        uploadId: uploadSession.id,
        totalRows: parsed.totalRows,
        savedRecords: savedIds.length,
        inserted,
        updated,
        errors: totalRejected,
        unmappedHeaders: parsed.unmappedHeaders,
        savedIds
      }
    });
  } catch (error) {
    console.error('❌ Error al procesar archivo:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/upload/preview - Previsualizar archivo Excel sin guardar
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha enviado ningún archivo'
      });
    }

    const parsed = parseExcelBuffer(req.file.buffer, req.file.originalname);

    res.json({
      success: true,
      data: {
        totalRows: parsed.totalRows,
        records: parsed.records.slice(0, 5),
        unmappedHeaders: parsed.unmappedHeaders,
        allStops: [...new Set(parsed.records.map(r => toStopCode(r.stopCode, r.entity)))]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/upload/check-duplicate - Verifica si ya existe un registro para marquesina + fecha
router.get('/check-duplicate', async (req, res) => {
  try {
    const { stopCode, date } = req.query;
    if (!stopCode || !date) {
      return res.status(400).json({ success: false, error: 'stopCode y date son obligatorios' });
    }
    const code = toStopCode(stopCode);
    const existing = await getMarquesinaDay(date, code);
    res.json({ success: true, exists: !!existing, stopCode: code, date });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/upload/manual - Subida manual con marquesina + fecha seleccionados por el usuario
router.post('/manual', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se ha enviado ningún archivo' });
    }

    const stopCode = req.body.stopCode;
    const date = req.body.date;
    const force = req.body.force === 'true';

    if (!stopCode || !date) {
      return res.status(400).json({ success: false, error: 'Marquesina (stopCode) y fecha (date) son obligatorios' });
    }

    const code = toStopCode(stopCode);

    // Verificar que la marquesina existe en el catálogo
    const stop = await getStopByCode(code);
    if (!stop) {
      return res.status(404).json({ success: false, error: `La marquesina ${code} no está dada de alta en el catálogo` });
    }

    // Verificar duplicado
    if (!force) {
      const existing = await getMarquesinaDay(date, code);
      if (existing) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          error: `Ya existe un registro para ${code} en la fecha ${date}`,
          stopCode: code,
          date
        });
      }
    }

    // Procesar el Excel con el procesador de marquesinas
    const processed = processMarquesinaExcel(req.file.buffer, req.file.originalname);

    // Sobreescribir meta con los valores del usuario (NO autodetectar)
    processed.meta.location = code;
    processed.meta.date = date;

    // Guardar en marquesinas/{code}/days/{date}
    const saveResult = await saveMarquesinaDay(processed);

    // Si se está reemplazando, borrar el record anterior de afluencia_records
    if (force) {
      try {
        const existingRecords = await getRecords({ entity: code, startDate: date, endDate: date });
        if (existingRecords && existingRecords.length > 0) {
          for (const rec of existingRecords) {
            if (rec.id && rec.stopCode === code) {
              await deleteRecord(rec.id);
            }
          }
        }
      } catch (cleanErr) {
        console.warn(`⚠️  No se pudo limpiar records anteriores: ${cleanErr.message}`);
      }
    }

    // Puente: guardar en afluencia_records para el Dashboard
    const g = processed.gender || {};
    const a = processed.age || {};
    const totalDetected = processed.summary.total_detected || 0;
    const identified = processed.summary.total_identified || 0;

    const afluenciaRecord = {
      date,
      stopCode: code,
      entity: stop.name || code,
      totals: {
        adults: processed.summary.people?.adult || identified,
        children: processed.summary.people?.children || 0,
        afterDeduplication: processed.summary.deduplicated || 0,
        totalNumber: totalDetected,
        heavyEmployees: processed.summary.people?.employees_entering || 0
      },
      gender: {
        man: g.male?.count || 0,
        woman: g.female?.count || 0,
        unknown: (g.unknown?.count || 0) + (g.not_identified?.count || 0)
      },
      age: {
        '0-9':   a['<10']?.count   || 0,
        '10-16': a['10-16']?.count  || 0,
        '17-30': a['17-30']?.count  || 0,
        '31-45': a['31-45']?.count  || 0,
        '46-60': a['46-60']?.count  || 0,
        '60+':   a['>60']?.count    || 0,
        unknown: (a.unknown?.count || 0) + (a.not_identified?.count || 0)
      },
      ageHeavy: {
        '0-9': 0, '10-16': 0, '17-30': 0, '31-45': 0, '46-60': 0, '60+': 0, unknown: 0
      },
      residenceTime: `00:${String(processed.summary.avg_dwell_minutes || 0).padStart(2, '0')}:00`,
      passengerFlow: null,
      hourly: (processed.hourly || []).map(h => ({
        hour: h.hour,
        entryLot: h.entry_lot || 0,
        outgoingBatch: h.outgoing_batch || 0,
        totalPersons: h.detected || 0,
        peopleDet: h.people_detained || 0,
        peopleIn: h.people_in || 0,
        peopleOut: h.people_out || 0,
        passby: h.passby || 0,
        turnback: h.turnback || 0,
        adult: h.adult || 0,
        children: h.children || 0,
        residents: h.residents || 0,
        employeeEntry: h.employee_entry || 0,
        customersEnter: h.customers_enter || 0,
        vehicleEntry: h.vehicle_entry || 0,
        vehicleExit: h.vehicle_exit || 0,
        deduplicated: h.deduplicated || 0,
        totalVehicles: h.total_vehicles || 0,
        employeesEntering: h.employees_entering || 0,
        gender: h.gender || {},
        age: h.age || {},
        genderG2: h.gender_g2 || {},
        ageG2: h.age_g2 || {},
        avgDwellMinutes: h.avg_dwell_minutes || 0,
      })),
      peakHour: processed.summary.peak_hour || null,
      trafficTotals: {
        entryLot: processed.summary.traffic?.entry_lot || 0,
        outgoingBatch: processed.summary.traffic?.outgoing_batch || 0,
        peopleDet: processed.summary.traffic?.people_detained || 0,
        peopleIn: processed.summary.traffic?.people_in || 0,
        peopleOut: processed.summary.traffic?.people_out || 0,
        passby: processed.summary.traffic?.passby || 0,
        turnback: processed.summary.traffic?.turnback || 0,
      },
      iotReport: {
        meta: processed.meta,
        summary: processed.summary,
        gender: processed.gender,
        age: processed.age,
        genderG2: processed.gender_g2 || null,
        ageG2: processed.age_g2 || null,
        officialTotals: processed.officialTotals || null,
        observations: processed.observations || [],
      }
    };

    await saveRecord(afluenciaRecord, {});

    return res.json({
      success: true,
      type: 'marquesina',
      message: `Excel procesado para ${stop.name || code} — ${date}`,
      data: {
        location: code,
        stopName: stop.name,
        date,
        activeHours: processed.meta.active_hours,
        totalDetected,
        identificationRate: processed.summary.identification_rate,
        peakHour: processed.summary.peak_hour,
        action: force ? 'replaced' : saveResult.action
      }
    });
  } catch (error) {
    console.error('❌ Error en subida manual:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/upload/errors/:uploadId - Obtener errores de validación/procesamiento
router.get('/errors/:uploadId', async (req, res) => {
  try {
    const errors = await getUploadErrors(req.params.uploadId);
    res.json({ success: true, data: errors, count: errors.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
