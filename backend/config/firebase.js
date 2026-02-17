const admin = require('firebase-admin');
const path = require('path');
const crypto = require('crypto');

let db;
let firestoreReady = false;

async function initializeFirebase() {
  try {
    // Soportar credenciales por variable de entorno (Vercel/producción)
    // o por archivo local (desarrollo)
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/serviceAccountKey.json';
      serviceAccount = require(path.resolve(serviceAccountPath));
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
    });

    const _db = admin.firestore();
    _db.settings({ databaseId: 'default' });

    // Verificar que Firestore responde de verdad
    await _db.collection('_health').doc('ping').set({ ts: new Date().toISOString() });
    db = _db;
    firestoreReady = true;
    console.log('✅ Firebase Firestore conectado y verificado correctamente');
  } catch (error) {
    console.warn('⚠️  Firebase no disponible. Usando modo local con almacenamiento en memoria.');
    console.warn(`   Razón: ${error.message || error}`);
    console.warn('   La app funciona en modo local. Los datos se perderán al reiniciar.');
    db = null;
    firestoreReady = false;
  }
}

// Inicialización asíncrona — las primeras peticiones esperarán
const initPromise = initializeFirebase();

// Helper: asegura que la init terminó antes de usar db
async function ensureInit() {
  await initPromise;
}

const localStore = {
  stops: [],
  records: [],
  uploads: [],
  validationErrors: [],
  marquesinas: [],
  alerts: [],
  reportTemplates: [],
  reports: [],
  integrations: {
    crtmConfig: null,
    crtmRuns: []
  }
};

const ALERT_RULES = {
  NO_DATA_WARN_HOURS: 6,
  NO_DATA_CRITICAL_HOURS: 24,
  DROP_WARN_FACTOR: 0.5,
  DROP_CRITICAL_FACTOR: 0.2,
  SPIKE_WARN_FACTOR: 2.5,
  SPIKE_CRITICAL_FACTOR: 4,
};

const DEFAULT_REPORT_TEMPLATES = [
  {
    id: 'tpl-stop-standard',
    name: 'Informe por Marquesina - Estándar',
    reportType: 'stop',
    sections: ['kpis', 'dailyTrend', 'gender', 'age', 'alerts', 'notes'],
    branding: { logo: 'CRTM', client: 'Afluencia360' },
    formats: ['pdf', 'excel']
  },
  {
    id: 'tpl-multi-standard',
    name: 'Informe Multi-Marquesina - Estándar',
    reportType: 'multi',
    sections: ['kpis', 'ranking', 'comparison', 'gender', 'age', 'alertsByType'],
    branding: { logo: 'CRTM', client: 'Afluencia360' },
    formats: ['pdf', 'excel']
  },
  {
    id: 'tpl-exec-standard',
    name: 'Resumen Ejecutivo - Estándar',
    reportType: 'executive',
    sections: ['insights', 'growthDrop', 'criticalAlerts', 'recommendations'],
    branding: { logo: 'CRTM', client: 'Afluencia360' },
    formats: ['pdf', 'excel']
  }
];

const DEFAULT_CRTM_CONFIG = {
  deliveryMode: 'SFTP',
  credentialsRef: 'secret://crtm/sftp',
  whitelist: '',
  format: 'CSV',
  frequency: 'Manual',
  datasets: ['afluencia_daily'],
  stopCodes: [],
  enabled: true,
};

const CRTM_DATASETS = [
  {
    id: 'afluencia_daily',
    description: 'Afluencia diaria por marquesina y fecha',
    version: 'v1',
    fields: ['stopCode', 'date', 'totalNumber', 'afterDeduplication', 'man', 'woman', 'unknown'],
    roadmap: false,
  },
  {
    id: 'afluencia_hourly',
    description: 'Afluencia por hora y marquesina',
    version: 'v1',
    fields: ['stopCode', 'date', 'hour', 'value'],
    roadmap: true,
  },
  {
    id: 'alerts',
    description: 'Alertas agregadas por día y tipo',
    version: 'v1',
    fields: ['date', 'type', 'severity', 'count'],
    roadmap: false,
  },
  {
    id: 'devices_status',
    description: 'Estado de comunicación por marquesina',
    version: 'v1',
    fields: ['stopCode', 'status', 'lastSeenAt'],
    roadmap: true,
  }
];

function toStopCode(rawStopCode, entity) {
  if (rawStopCode && String(rawStopCode).trim()) {
    return String(rawStopCode).trim().toUpperCase();
  }
  const fallback = String(entity || 'SIN_ENTIDAD')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return fallback || 'SIN_ENTIDAD';
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRecord(record, meta = {}) {
  const stopCode = toStopCode(record.stopCode, record.entity);
  return {
    ...record,
    stopCode,
    entity: String(record.entity || stopCode),
    uploadedAt: new Date().toISOString(),
    uploadId: meta.uploadId || record.uploadId || null
  };
}

function normalizeStop(stop = {}) {
  const stopCode = toStopCode(stop.stopCode || stop.code, stop.name || stop.entity);
  return {
    stopCode,
    name: String(stop.name || stop.entity || stopCode),
    location: String(stop.location || stop.address || ''),
    zone: String(stop.zone || ''),
    municipality: String(stop.municipality || ''),
    status: stop.status === 'inactive' ? 'inactive' : 'active',
    photos: Array.isArray(stop.photos)
      ? stop.photos.filter(Boolean).map(p => String(p).trim()).filter(Boolean)
      : [],
    notes: String(stop.notes || ''),
    installedAt: stop.installedAt || null,
    latitude: stop.latitude !== undefined && stop.latitude !== null && stop.latitude !== '' ? Number(stop.latitude) : null,
    longitude: stop.longitude !== undefined && stop.longitude !== null && stop.longitude !== '' ? Number(stop.longitude) : null
  };
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

function secondsToTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function emptySummary(scopeLabel, startDate, endDate) {
  return {
    scope: scopeLabel,
    period: { startDate: startDate || null, endDate: endDate || null },
    totalRecords: 0,
    totals: {
      adults: 0,
      children: 0,
      afterDeduplication: 0,
      totalNumber: 0,
      heavyEmployees: 0
    },
    gender: { man: 0, woman: 0, unknown: 0 },
    age: { '0-9': 0, '10-16': 0, '17-30': 0, '31-45': 0, '46-60': 0, '60+': 0, unknown: 0 },
    ageHeavy: { '0-9': 0, '10-16': 0, '17-30': 0, '31-45': 0, '46-60': 0, '60+': 0, unknown: 0 },
    avgResidenceTime: '00:00:00',
    passengerFlow: null
  };
}

function summarizeRecords(records, scopeLabel, startDate, endDate) {
  if (!records || records.length === 0) return null;

  const summary = emptySummary(scopeLabel, startDate, endDate);
  summary.totalRecords = records.length;

  let totalSeconds = 0;

  for (const record of records) {
    summary.totals.adults += record.totals?.adults || 0;
    summary.totals.children += record.totals?.children || 0;
    summary.totals.afterDeduplication += record.totals?.afterDeduplication || 0;
    summary.totals.totalNumber += record.totals?.totalNumber || 0;
    summary.totals.heavyEmployees += record.totals?.heavyEmployees || 0;

    summary.gender.man += record.gender?.man || 0;
    summary.gender.woman += record.gender?.woman || 0;
    summary.gender.unknown += record.gender?.unknown || 0;

    for (const key of Object.keys(summary.age)) {
      summary.age[key] += record.age?.[key] || 0;
    }

    for (const key of Object.keys(summary.ageHeavy)) {
      summary.ageHeavy[key] += record.ageHeavy?.[key] || 0;
    }

    totalSeconds += parseTimeToSeconds(record.residenceTime);
  }

  summary.avgResidenceTime = secondsToTime(totalSeconds / records.length);

  // Agregar passengerFlow de todos los registros que lo tengan
  const flowRecords = records.filter(r => r.passengerFlow);
  if (flowRecords.length === 1) {
    summary.passengerFlow = flowRecords[0].passengerFlow;
  } else if (flowRecords.length > 1) {
    summary.passengerFlow = {};
    for (const r of flowRecords) {
      for (const [key, val] of Object.entries(r.passengerFlow)) {
        summary.passengerFlow[key] = (summary.passengerFlow[key] || 0) + (typeof val === 'number' ? val : 0);
      }
    }
  } else {
    summary.passengerFlow = null;
  }

  // ─── Datos IoT extendidos: agregar de TODOS los registros ───

  // 1) Sumar trafficTotals de todos los registros
  const trafficKeys = ['entryLot', 'outgoingBatch', 'peopleDet', 'peopleIn', 'peopleOut', 'passby', 'turnback'];
  const recordsWithTraffic = records.filter(r => r.trafficTotals);
  if (recordsWithTraffic.length > 0) {
    const aggTraffic = {};
    for (const k of trafficKeys) aggTraffic[k] = 0;
    for (const r of recordsWithTraffic) {
      for (const k of trafficKeys) {
        aggTraffic[k] += r.trafficTotals[k] || 0;
      }
    }
    summary.trafficTotals = aggTraffic;
  } else {
    summary.trafficTotals = null;
  }

  // 2) Agregar hourly sumando por hora entre todos los días
  const hourlyNumericKeys = [
    'entryLot', 'outgoingBatch', 'totalPersons', 'peopleDet',
    'peopleIn', 'peopleOut', 'passby', 'turnback',
    'adult', 'children', 'residents', 'employeeEntry',
    'customersEnter', 'vehicleEntry', 'vehicleExit',
    'deduplicated', 'totalVehicles', 'employeesEntering'
  ];
  const recordsWithHourly = records.filter(r => r.hourly && r.hourly.length > 0);
  if (recordsWithHourly.length > 0) {
    const hourBucket = new Map();
    let dwellCount = 0;

    for (const r of recordsWithHourly) {
      for (const h of r.hourly) {
        if (!hourBucket.has(h.hour)) {
          const entry = { hour: h.hour };
          for (const k of hourlyNumericKeys) entry[k] = 0;
          entry.avgDwellMinutes = 0;
          entry._dwellSum = 0;
          entry._dwellCount = 0;
          hourBucket.set(h.hour, entry);
        }
        const bucket = hourBucket.get(h.hour);
        for (const k of hourlyNumericKeys) {
          bucket[k] += h[k] || 0;
        }
        if (h.avgDwellMinutes) {
          bucket._dwellSum += h.avgDwellMinutes;
          bucket._dwellCount += 1;
        }
      }
    }

    const aggHourly = [...hourBucket.values()]
      .map(b => {
        b.avgDwellMinutes = b._dwellCount > 0 ? Math.round(b._dwellSum / b._dwellCount) : 0;
        delete b._dwellSum;
        delete b._dwellCount;
        return b;
      })
      .sort((a, b) => {
        const ha = parseInt(a.hour) || 0;
        const hb = parseInt(b.hour) || 0;
        return ha - hb;
      });

    summary.hourly = aggHourly;

    // 3) Recalcular peakHour a partir de los datos agregados
    let peak = null;
    let peakVal = -1;
    const totalDetectedAll = aggHourly.reduce((s, h) => s + (h.totalPersons || 0), 0);
    for (const h of aggHourly) {
      const detected = h.totalPersons || 0;
      if (detected > peakVal) {
        peakVal = detected;
        peak = h;
      }
    }
    if (peak && peakVal > 0) {
      summary.peakHour = {
        hour: peak.hour,
        detected: peakVal,
        pct_of_total: totalDetectedAll > 0 ? parseFloat(((peakVal / totalDetectedAll) * 100).toFixed(1)) : 0
      };
    } else {
      // Fallback: usar peakHour del registro más reciente si existe
      const latestWithPeak = records.find(r => r.peakHour);
      summary.peakHour = latestWithPeak?.peakHour || null;
    }
  } else {
    // Sin datos hourly: usar el último registro que tenga algo
    const fallbackRecord = records.find(r => r.hourly && r.hourly.length > 0) || records[0];
    summary.hourly = fallbackRecord?.hourly || null;
    summary.peakHour = fallbackRecord?.peakHour || null;
    if (!summary.trafficTotals) {
      summary.trafficTotals = fallbackRecord?.trafficTotals || null;
    }
  }

  return summary;
}

function aggregateRecordsByDate(records) {
  const bucket = new Map();

  for (const record of records) {
    const date = record.date;
    if (!bucket.has(date)) {
      bucket.set(date, {
        date,
        totals: {
          adults: 0,
          children: 0,
          afterDeduplication: 0,
          totalNumber: 0,
          heavyEmployees: 0
        },
        gender: { man: 0, woman: 0, unknown: 0 },
        age: { '0-9': 0, '10-16': 0, '17-30': 0, '31-45': 0, '46-60': 0, '60+': 0, unknown: 0 },
        ageHeavy: { '0-9': 0, '10-16': 0, '17-30': 0, '31-45': 0, '46-60': 0, '60+': 0, unknown: 0 },
        residenceTime: '00:00:00',
        _secondsTotal: 0,
        _count: 0
      });
    }

    const row = bucket.get(date);
    row.totals.adults += record.totals?.adults || 0;
    row.totals.children += record.totals?.children || 0;
    row.totals.afterDeduplication += record.totals?.afterDeduplication || 0;
    row.totals.totalNumber += record.totals?.totalNumber || 0;
    row.totals.heavyEmployees += record.totals?.heavyEmployees || 0;

    row.gender.man += record.gender?.man || 0;
    row.gender.woman += record.gender?.woman || 0;
    row.gender.unknown += record.gender?.unknown || 0;

    for (const key of Object.keys(row.age)) {
      row.age[key] += record.age?.[key] || 0;
    }

    for (const key of Object.keys(row.ageHeavy)) {
      row.ageHeavy[key] += record.ageHeavy?.[key] || 0;
    }

    row._secondsTotal += parseTimeToSeconds(record.residenceTime);
    row._count += 1;

    // Preservar datos IoT extendidos (del último registro del día)
    if (record.hourly) row._hourly = record.hourly;
    if (record.peakHour) row._peakHour = record.peakHour;
    if (record.trafficTotals) row._trafficTotals = record.trafficTotals;
  }

  return [...bucket.values()]
    .map(item => ({
      date: item.date,
      totals: item.totals,
      gender: item.gender,
      age: item.age,
      ageHeavy: item.ageHeavy,
      residenceTime: secondsToTime(item._secondsTotal / Math.max(1, item._count)),
      hourly: item._hourly || null,
      peakHour: item._peakHour || null,
      trafficTotals: item._trafficTotals || null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function validateRecord(record) {
  const errors = [];
  const stopCode = toStopCode(record.stopCode, record.entity);

  if (!record.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(record.date))) {
    errors.push('Fecha inválida (esperado YYYY-MM-DD)');
  }

  if (!stopCode || stopCode === 'SIN_ENTIDAD') {
    errors.push('Código de marquesina (stop_code) requerido');
  }

  const numericFields = [
    record.totals?.adults,
    record.totals?.children,
    record.totals?.afterDeduplication,
    record.totals?.totalNumber,
    record.totals?.heavyEmployees
  ];

  if (numericFields.some(v => Number(v) < 0 || Number.isNaN(Number(v)))) {
    errors.push('Las métricas numéricas no pueden ser negativas ni no numéricas');
  }

  return errors;
}

async function saveRecord(record, meta = {}) {
  await ensureInit();
  const normalized = normalizeRecord(record, meta);

  if (db) {
    const existing = await db.collection('afluencia_records')
      .where('stopCode', '==', normalized.stopCode)
      .where('date', '==', normalized.date)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      await db.collection('afluencia_records').doc(doc.id).set({
        ...normalized,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { id: doc.id, action: 'updated' };
    }

    const docRef = await db.collection('afluencia_records').add({
      ...normalized,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, action: 'inserted' };
  }

  const existingIndex = localStore.records.findIndex(r => r.stopCode === normalized.stopCode && r.date === normalized.date);

  if (existingIndex !== -1) {
    localStore.records[existingIndex] = {
      ...localStore.records[existingIndex],
      ...normalized,
      updatedAt: new Date().toISOString()
    };
    return { id: localStore.records[existingIndex].id, action: 'updated' };
  }

  const id = createId('local');
  localStore.records.push({ id, ...normalized, createdAt: new Date().toISOString() });
  return { id, action: 'inserted' };
}

async function getRecords(filters = {}) {
  await ensureInit();
  if (db) {
    let query = db.collection('afluencia_records');

    if (filters.stopCode) {
      query = query.where('stopCode', '==', filters.stopCode);
    } else if (filters.entity) {
      query = query.where('entity', '==', filters.entity);
    }

    if (filters.startDate) {
      query = query.where('date', '>=', filters.startDate);
    }
    if (filters.endDate) {
      query = query.where('date', '<=', filters.endDate);
    }

    query = query.orderBy('date', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    let result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (filters.stopCodes && filters.stopCodes.length > 0) {
      const set = new Set(filters.stopCodes.map(s => toStopCode(s)));
      result = result.filter(r => set.has(toStopCode(r.stopCode, r.entity)));
    }

    return result;
  }

  let results = [...localStore.records];

  if (filters.stopCode) {
    const stopCode = toStopCode(filters.stopCode);
    results = results.filter(r => toStopCode(r.stopCode, r.entity) === stopCode);
  } else if (filters.entity) {
    results = results.filter(r => r.entity === filters.entity);
  }

  if (filters.stopCodes && filters.stopCodes.length > 0) {
    const set = new Set(filters.stopCodes.map(s => toStopCode(s)));
    results = results.filter(r => set.has(toStopCode(r.stopCode, r.entity)));
  }

  if (filters.startDate) {
    results = results.filter(r => r.date >= filters.startDate);
  }
  if (filters.endDate) {
    results = results.filter(r => r.date <= filters.endDate);
  }

  results.sort((a, b) => b.date.localeCompare(a.date));

  if (filters.limit) {
    results = results.slice(0, filters.limit);
  }

  return results;
}

async function getStops() {
  await ensureInit();
  const records = await getRecords();
  let masterStops = [];

  if (db) {
    const snapshot = await db.collection('afluencia_stops').get();
    masterStops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    masterStops = [...localStore.stops];
  }

  const map = new Map();

  for (const stop of masterStops) {
    const normalized = normalizeStop(stop);
    map.set(normalized.stopCode, {
      ...normalized,
      totalRecords: 0,
      latestDate: null
    });
  }

  for (const record of records) {
    const stopCode = toStopCode(record.stopCode, record.entity);
    if (!map.has(stopCode)) {
      map.set(stopCode, {
        stopCode,
        name: record.entity || stopCode,
        location: '',
        zone: '',
        municipality: '',
        status: 'active',
        photos: [],
        notes: '',
        installedAt: null,
        latitude: null,
        longitude: null,
        totalRecords: 0,
        latestDate: null
      });
    }

    const item = map.get(stopCode);
    item.totalRecords += 1;
    if (!item.latestDate || record.date > item.latestDate) {
      item.latestDate = record.date;
    }
  }

  return [...map.values()].sort((a, b) => a.stopCode.localeCompare(b.stopCode));
}

async function getEntities() {
  const stops = await getStops();
  return stops.filter(s => s.status !== 'inactive').map(s => s.stopCode);
}

async function getStopByCode(stopCode) {
  const code = toStopCode(stopCode);
  const stops = await getStops();
  return stops.find(stop => stop.stopCode === code) || null;
}

async function isStopRegistered(stopCode) {
  const stop = await getStopByCode(stopCode);
  return Boolean(stop && stop.status !== 'inactive');
}

async function createStop(payload) {
  await ensureInit();
  const normalized = normalizeStop(payload);

  if (await getStopByCode(normalized.stopCode)) {
    throw new Error(`La marquesina ${normalized.stopCode} ya existe`);
  }

  const stop = {
    ...normalized,
    createdAt: new Date().toISOString()
  };

  if (db) {
    await db.collection('afluencia_stops').doc(stop.stopCode).set(stop);
  } else {
    localStore.stops.push(stop);
  }

  return stop;
}

async function updateStop(stopCode, payload = {}) {
  await ensureInit();
  const code = toStopCode(stopCode);
  const current = await getStopByCode(code);

  if (!current) {
    throw new Error('Marquesina no encontrada');
  }

  const merged = normalizeStop({ ...current, ...payload, stopCode: code });
  const updated = {
    ...current,
    ...merged,
    updatedAt: new Date().toISOString()
  };

  if (db) {
    await db.collection('afluencia_stops').doc(code).set(updated, { merge: true });
  } else {
    const index = localStore.stops.findIndex(s => s.stopCode === code);
    if (index !== -1) localStore.stops[index] = updated;
  }

  return updated;
}

async function deleteStop(stopCode) {
  await ensureInit();
  const code = toStopCode(stopCode);

  if (db) {
    await db.collection('afluencia_stops').doc(code).set({
      status: 'inactive',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }

  const index = localStore.stops.findIndex(s => s.stopCode === code);
  if (index !== -1) {
    localStore.stops[index] = {
      ...localStore.stops[index],
      status: 'inactive',
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * Permanently delete a marquesina and ALL associated data:
 *  - afluencia_stops/{stopCode}
 *  - afluencia_records where stopCode matches
 *  - marquesinas/{stopCode}/days/* subcollection
 */
async function permanentDeleteStop(stopCode) {
  await ensureInit();
  const code = toStopCode(stopCode);
  const deleted = { stops: 0, records: 0, marquesinas: 0 };

  if (db) {
    // 1. Delete from afluencia_stops
    const stopRef = db.collection('afluencia_stops').doc(code);
    const stopDoc = await stopRef.get();
    if (stopDoc.exists) {
      await stopRef.delete();
      deleted.stops = 1;
    }

    // 2. Delete all afluencia_records for this stopCode
    const recordsSnap = await db.collection('afluencia_records')
      .where('stopCode', '==', code)
      .get();
    const recordBatch = db.batch();
    recordsSnap.docs.forEach(doc => recordBatch.delete(doc.ref));
    if (!recordsSnap.empty) {
      await recordBatch.commit();
      deleted.records = recordsSnap.size;
    }

    // 3. Delete marquesinas/{code}/days/* subcollection
    const daysSnap = await db.collection('marquesinas').doc(code)
      .collection('days').get();
    if (!daysSnap.empty) {
      const dayBatch = db.batch();
      daysSnap.docs.forEach(doc => dayBatch.delete(doc.ref));
      await dayBatch.commit();
      deleted.marquesinas = daysSnap.size;
      // Delete the parent document too (if it exists)
      await db.collection('marquesinas').doc(code).delete();
    }

    return deleted;
  }

  // Local store fallback
  const idx = localStore.stops.findIndex(s => s.stopCode === code);
  if (idx !== -1) {
    localStore.stops.splice(idx, 1);
    deleted.stops = 1;
  }
  const before = localStore.records.length;
  localStore.records = localStore.records.filter(r => r.stopCode !== code);
  deleted.records = before - localStore.records.length;
  const mBefore = localStore.marquesinas.length;
  localStore.marquesinas = localStore.marquesinas.filter(m => m.meta?.location !== code);
  deleted.marquesinas = mBefore - localStore.marquesinas.length;

  return deleted;
}

async function getLatestRecord(stopCode) {
  await ensureInit();
  const targetCode = toStopCode(stopCode);

  if (db) {
    const snapshot = await db.collection('afluencia_records')
      .where('stopCode', '==', targetCode)
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  const filtered = localStore.records
    .filter(r => toStopCode(r.stopCode, r.entity) === targetCode)
    .sort((a, b) => b.date.localeCompare(a.date));

  return filtered[0] || null;
}

async function deleteRecord(id) {
  await ensureInit();
  if (db) {
    await db.collection('afluencia_records').doc(id).delete();
    return;
  }

  const index = localStore.records.findIndex(r => r.id === id);
  if (index !== -1) localStore.records.splice(index, 1);
}

async function getSummary(stopCode, startDate, endDate) {
  const records = await getRecords({ stopCode, startDate, endDate });
  return summarizeRecords(records, toStopCode(stopCode), startDate, endDate);
}

async function getDashboardCards(startDate, endDate) {
  const stops = (await getStops()).filter(stop => stop.status !== 'inactive');
  const cards = [];

  for (const stop of stops) {
    const [summary, latest, records] = await Promise.all([
      getSummary(stop.stopCode, startDate, endDate),
      getLatestRecord(stop.stopCode),
      getRecords({ stopCode: stop.stopCode, startDate, endDate })
    ]);

    // Contar días únicos subidos
    const uniqueDates = new Set(records.map(r => r.date));
    const dates = [...uniqueDates].sort();

    cards.push({
      stopCode: stop.stopCode,
      entity: stop.name || stop.stopCode,
      latestDate: latest?.date || null,
      totalRecords: summary?.totalRecords || 0,
      daysCount: uniqueDates.size,
      firstDate: dates[0] || null,
      lastDate: dates[dates.length - 1] || null,
      totals: summary?.totals || emptySummary(stop.stopCode).totals,
      gender: summary?.gender || { man: 0, woman: 0, unknown: 0 },
      age: summary?.age || emptySummary(stop.stopCode).age,
      avgResidenceTime: summary?.avgResidenceTime || '00:00:00',
      peakHour: summary?.peakHour || null,
      trafficTotals: summary?.trafficTotals || null
    });
  }

  return cards;
}

async function getDashboardByStop(stopCode, startDate, endDate, limit = 90) {
  const code = toStopCode(stopCode);
  const [records, summary, latest] = await Promise.all([
    getRecords({ stopCode: code, startDate, endDate, limit }),
    getSummary(code, startDate, endDate),
    getLatestRecord(code)
  ]);

  return {
    stopCode: code,
    entity: summary?.scope || code,
    latest,
    summary,
    records,
    totalRecords: records.length
  };
}

async function getAggregateDashboard(stopCodes = [], startDate, endDate, limit = 90) {
  const normalizedCodes = stopCodes.map(code => toStopCode(code));
  const records = await getRecords({ stopCodes: normalizedCodes, startDate, endDate, limit: limit * Math.max(1, normalizedCodes.length) });

  const summary = summarizeRecords(records, normalizedCodes.join(', '), startDate, endDate);
  const aggregatedByDate = aggregateRecordsByDate(records).slice(0, limit);

  return {
    stopCodes: normalizedCodes,
    summary,
    records: aggregatedByDate,
    totalRecords: records.length
  };
}

async function getCompareDashboard(stopCodes = [], startDate, endDate, limit = 90) {
  const normalizedCodes = stopCodes.map(code => toStopCode(code));
  const comparisons = [];

  for (const stopCode of normalizedCodes) {
    const [summary, latest, records] = await Promise.all([
      getSummary(stopCode, startDate, endDate),
      getLatestRecord(stopCode),
      getRecords({ stopCode, startDate, endDate, limit })
    ]);

    comparisons.push({
      stopCode,
      latest,
      summary,
      records
    });
  }

  return {
    stopCodes: normalizedCodes,
    comparisons
  };
}

async function createUpload(meta = {}) {
  await ensureInit();
  const upload = {
    id: createId('upload'),
    filename: meta.filename || 'sin_nombre',
    size: meta.size || 0,
    uploadedBy: meta.uploadedBy || 'anonymous',
    uploadedAt: new Date().toISOString(),
    status: 'uploaded',
    stats: {
      totalRows: 0,
      inserted: 0,
      updated: 0,
      rejected: 0,
      warnings: 0
    }
  };

  if (db) {
    await db.collection('afluencia_uploads').doc(upload.id).set(upload);
  } else {
    localStore.uploads.push(upload);
  }

  return upload;
}

async function updateUpload(uploadId, patch = {}) {
  await ensureInit();
  if (db) {
    await db.collection('afluencia_uploads').doc(uploadId).set({
      ...patch,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }

  const index = localStore.uploads.findIndex(u => u.id === uploadId);
  if (index !== -1) {
    localStore.uploads[index] = {
      ...localStore.uploads[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };
  }
}

async function addValidationErrors(uploadId, errors = []) {
  await ensureInit();
  const rows = errors.map(err => ({
    id: createId('err'),
    uploadId,
    row: err.row || null,
    column: err.column || null,
    value: err.value || null,
    message: err.message || 'Error de validación',
    severity: err.severity || 'error'
  }));

  if (rows.length === 0) return;

  if (db) {
    const batch = db.batch();
    for (const row of rows) {
      const ref = db.collection('afluencia_validation_errors').doc(row.id);
      batch.set(ref, row);
    }
    await batch.commit();
    return;
  }

  localStore.validationErrors.push(...rows);
}

async function getUploadErrors(uploadId) {
  await ensureInit();
  if (db) {
    const snapshot = await db.collection('afluencia_validation_errors')
      .where('uploadId', '==', uploadId)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  return localStore.validationErrors.filter(err => err.uploadId === uploadId);
}

// ─── Marquesina IoT CRUD ──────────────────────────────────────────

async function saveMarquesinaDay(processedData) {
  await ensureInit();
  const location = processedData.meta.location;
  const date = processedData.meta.date;

  if (db) {
    const docRef = db
      .collection('marquesinas')
      .doc(location)
      .collection('days')
      .doc(date);
    await docRef.set(processedData, { merge: true });
    return { location, date, action: 'saved' };
  }

  // Modo local
  const existingIndex = localStore.marquesinas.findIndex(
    (m) => m.meta.location === location && m.meta.date === date
  );
  if (existingIndex !== -1) {
    localStore.marquesinas[existingIndex] = processedData;
  } else {
    localStore.marquesinas.push(processedData);
  }
  return { location, date, action: existingIndex !== -1 ? 'updated' : 'inserted' };
}

async function getMarquesinaDay(date, location) {
  await ensureInit();
  if (db) {
    let query;
    if (location) {
      const docRef = db.collection('marquesinas').doc(location).collection('days').doc(date);
      const doc = await docRef.get();
      return doc.exists ? doc.data() : null;
    }
    // Sin location: buscar en todas las ubicaciones (toma la primera)
    const locationsSnapshot = await db.collection('marquesinas').get();
    for (const locDoc of locationsSnapshot.docs) {
      const dayDoc = await db.collection('marquesinas').doc(locDoc.id).collection('days').doc(date).get();
      if (dayDoc.exists) return dayDoc.data();
    }
    return null;
  }

  const match = localStore.marquesinas.find(
    (m) => m.meta.date === date && (!location || m.meta.location === location)
  );
  return match || null;
}

async function getMarquesinaRange(from, to, location) {
  await ensureInit();
  if (db) {
    const results = [];
    const locationsSnapshot = location
      ? [{ id: location }]
      : (await db.collection('marquesinas').get()).docs;

    for (const locDoc of locationsSnapshot) {
      const loc = locDoc.id;
      const snapshot = await db
        .collection('marquesinas')
        .doc(loc)
        .collection('days')
        .where(admin.firestore.FieldPath.documentId(), '>=', from)
        .where(admin.firestore.FieldPath.documentId(), '<=', to)
        .orderBy(admin.firestore.FieldPath.documentId(), 'desc')
        .get();
      snapshot.docs.forEach((doc) => results.push(doc.data()));
    }
    return results;
  }

  return localStore.marquesinas
    .filter((m) => m.meta.date >= from && m.meta.date <= to && (!location || m.meta.location === location))
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}

async function getMarquesinaLatest(location) {
  await ensureInit();
  if (db) {
    const locationsSnapshot = location
      ? [{ id: location }]
      : (await db.collection('marquesinas').get()).docs;

    let latest = null;
    for (const locDoc of locationsSnapshot) {
      const loc = locDoc.id;
      const snapshot = await db
        .collection('marquesinas')
        .doc(loc)
        .collection('days')
        .orderBy(admin.firestore.FieldPath.documentId(), 'desc')
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (!latest || data.meta.date > latest.meta.date) {
          latest = data;
        }
      }
    }
    return latest;
  }

  const filtered = location
    ? localStore.marquesinas.filter((m) => m.meta.location === location)
    : localStore.marquesinas;

  if (filtered.length === 0) return null;
  return filtered.sort((a, b) => b.meta.date.localeCompare(a.meta.date))[0];
}

function getDateOnly(isoDateTime) {
  return String(isoDateTime || '').slice(0, 10);
}

function shiftDate(isoDate, deltaDays) {
  const dt = new Date(`${isoDate}T00:00:00`);
  dt.setDate(dt.getDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function computeHoursSince(lastAt) {
  if (!lastAt) return Infinity;
  const lastDate = new Date(lastAt);
  if (Number.isNaN(lastDate.getTime())) return Infinity;
  return (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
}

function getSeverityRank(severity) {
  if (severity === 'CRITICAL') return 3;
  if (severity === 'WARN') return 2;
  return 1;
}

async function getStoredAlerts() {
  await ensureInit();
  if (db) {
    const snapshot = await db.collection('alerts').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  return [...localStore.alerts];
}

async function saveStoredAlert(alert) {
  await ensureInit();
  if (db) {
    await db.collection('alerts').doc(alert.id).set(alert, { merge: true });
    return;
  }

  const idx = localStore.alerts.findIndex(item => item.id === alert.id);
  if (idx === -1) {
    localStore.alerts.push(alert);
  } else {
    localStore.alerts[idx] = alert;
  }
}

function buildAlertMessage(type, stopCode, metricsSnapshot = {}) {
  if (type === 'NO_DATA') {
    const hours = Number(metricsSnapshot.hoursSinceLastData || 0).toFixed(1);
    return `Sin datos recientes en ${stopCode} (${hours}h desde último dato).`;
  }
  if (type === 'ANOMALY_DROP') {
    return `Caída brusca en ${stopCode}: hoy ${metricsSnapshot.todayTotal || 0} vs media 7d ${metricsSnapshot.avg7d || 0}.`;
  }
  if (type === 'ANOMALY_SPIKE') {
    return `Pico anómalo en ${stopCode}: hoy ${metricsSnapshot.todayTotal || 0} vs media 7d ${metricsSnapshot.avg7d || 0}.`;
  }
  return `Alerta detectada en ${stopCode}.`;
}

function makeAlertCandidate({ stopCode, type, severity, metricsSnapshot, nowIso }) {
  return {
    key: `${stopCode}::${type}`,
    stopCode,
    type,
    severity,
    status: 'OPEN',
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    message: buildAlertMessage(type, stopCode, metricsSnapshot),
    metricsSnapshot,
    assignedTo: null,
    ackBy: null,
    ackAt: null,
    resolvedBy: null,
    resolvedAt: null,
  };
}

function buildStopDailyTotals(records = []) {
  const byDate = new Map();
  for (const record of records) {
    if (!record?.date) continue;
    const current = byDate.get(record.date) || 0;
    byDate.set(record.date, current + (record?.totals?.totalNumber || 0));
  }
  return byDate;
}

async function recomputeOperationalAlerts({ stopCodes = [] } = {}) {
  await ensureInit();

  const nowIso = new Date().toISOString();
  const today = getDateOnly(nowIso);
  const startDate = shiftDate(today, -7);

  const candidateStops = stopCodes.length > 0
    ? stopCodes.map(code => toStopCode(code))
    : (await getStops()).map(stop => stop.stopCode);

  const activeCandidates = [];

  for (const stopCode of candidateStops) {
    const [latestRecord, records] = await Promise.all([
      getLatestRecord(stopCode),
      getRecords({ stopCode, startDate, endDate: today, limit: 800 })
    ]);

    const lastAt = latestRecord?.uploadedAt
      || (latestRecord?.date ? `${latestRecord.date}T23:59:59.000Z` : null);
    const hoursSinceLastData = computeHoursSince(lastAt);

    if (hoursSinceLastData > ALERT_RULES.NO_DATA_WARN_HOURS) {
      const severity = hoursSinceLastData > ALERT_RULES.NO_DATA_CRITICAL_HOURS ? 'CRITICAL' : 'WARN';
      activeCandidates.push(makeAlertCandidate({
        stopCode,
        type: 'NO_DATA',
        severity,
        metricsSnapshot: {
          hoursSinceLastData: Number(hoursSinceLastData.toFixed(2)),
          lastDataAt: lastAt,
        },
        nowIso,
      }));
    }

    const totalsByDate = buildStopDailyTotals(records);
    const todayTotal = totalsByDate.get(today) || 0;
    const previousTotals = [];
    for (let i = 1; i <= 7; i += 1) {
      const day = shiftDate(today, -i);
      previousTotals.push(totalsByDate.get(day) || 0);
    }

    const avg7d = previousTotals.length > 0
      ? previousTotals.reduce((acc, value) => acc + value, 0) / previousTotals.length
      : 0;

    if (avg7d > 0) {
      if (todayTotal < avg7d * ALERT_RULES.DROP_WARN_FACTOR) {
        const severity = todayTotal < avg7d * ALERT_RULES.DROP_CRITICAL_FACTOR ? 'CRITICAL' : 'WARN';
        activeCandidates.push(makeAlertCandidate({
          stopCode,
          type: 'ANOMALY_DROP',
          severity,
          metricsSnapshot: {
            today,
            todayTotal,
            avg7d: Number(avg7d.toFixed(2)),
            factor: avg7d > 0 ? Number((todayTotal / avg7d).toFixed(4)) : null,
          },
          nowIso,
        }));
      }

      if (todayTotal > avg7d * ALERT_RULES.SPIKE_WARN_FACTOR) {
        const severity = todayTotal > avg7d * ALERT_RULES.SPIKE_CRITICAL_FACTOR ? 'CRITICAL' : 'WARN';
        activeCandidates.push(makeAlertCandidate({
          stopCode,
          type: 'ANOMALY_SPIKE',
          severity,
          metricsSnapshot: {
            today,
            todayTotal,
            avg7d: Number(avg7d.toFixed(2)),
            factor: avg7d > 0 ? Number((todayTotal / avg7d).toFixed(4)) : null,
          },
          nowIso,
        }));
      }
    }
  }

  const storedAlerts = await getStoredAlerts();
  const alertByKey = new Map(storedAlerts.map(item => [item.key, item]));
  const activeKeys = new Set();

  for (const candidate of activeCandidates) {
    activeKeys.add(candidate.key);
    const existing = alertByKey.get(candidate.key);

    if (!existing) {
      const newAlert = {
        id: createId('alert'),
        ...candidate,
      };
      await saveStoredAlert(newAlert);
      continue;
    }

    const keepAck = existing.status === 'ACK';
    const isResolved = existing.status === 'RESOLVED';
    const merged = {
      ...existing,
      severity: getSeverityRank(candidate.severity) > getSeverityRank(existing.severity)
        ? candidate.severity
        : existing.severity,
      message: candidate.message,
      metricsSnapshot: candidate.metricsSnapshot,
      lastSeenAt: candidate.lastSeenAt,
      status: isResolved ? 'OPEN' : (keepAck ? 'ACK' : 'OPEN'),
      firstSeenAt: isResolved ? candidate.firstSeenAt : existing.firstSeenAt,
      ackBy: isResolved ? null : existing.ackBy,
      ackAt: isResolved ? null : existing.ackAt,
      resolvedBy: null,
      resolvedAt: null,
    };
    await saveStoredAlert(merged);
  }

  for (const existing of storedAlerts) {
    if (!activeKeys.has(existing.key) && (existing.status === 'OPEN' || existing.status === 'ACK')) {
      await saveStoredAlert({
        ...existing,
        status: 'RESOLVED',
        lastSeenAt: nowIso,
        resolvedBy: 'system',
        resolvedAt: nowIso,
      });
    }
  }

  return getAlerts({});
}

function alertMatchesQuery(alert, query = {}) {
  const { status, severity, search, range } = query;
  if (status && status !== 'all' && alert.status !== status) return false;
  if (severity && severity !== 'all' && alert.severity !== severity) return false;

  if (search) {
    const term = String(search).trim().toLowerCase();
    const haystack = `${alert.stopCode || ''} ${alert.message || ''} ${alert.type || ''}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  if (range && range !== 'all') {
    const days = Number(String(range).replace(/[^0-9]/g, ''));
    if (days > 0) {
      const minTs = Date.now() - (days * 24 * 60 * 60 * 1000);
      const refTs = new Date(alert.lastSeenAt || alert.firstSeenAt || 0).getTime();
      if (Number.isNaN(refTs) || refTs < minTs) return false;
    }
  }

  return true;
}

function sortAlerts(alerts = []) {
  return [...alerts].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'OPEN') return -1;
      if (b.status === 'OPEN') return 1;
      if (a.status === 'ACK') return -1;
      if (b.status === 'ACK') return 1;
    }

    const severityDiff = getSeverityRank(b.severity) - getSeverityRank(a.severity);
    if (severityDiff !== 0) return severityDiff;

    return (new Date(b.lastSeenAt || 0).getTime()) - (new Date(a.lastSeenAt || 0).getTime());
  });
}

async function getAlerts(query = {}) {
  const stored = await getStoredAlerts();
  const filtered = stored.filter(item => alertMatchesQuery(item, query));
  return sortAlerts(filtered);
}

async function acknowledgeAlert(alertId, user = 'admin') {
  const stored = await getStoredAlerts();
  const alert = stored.find(item => item.id === alertId);
  if (!alert) {
    throw new Error('Alerta no encontrada');
  }

  const nowIso = new Date().toISOString();
  const updated = {
    ...alert,
    status: 'ACK',
    ackBy: user,
    ackAt: nowIso,
    lastSeenAt: alert.lastSeenAt || nowIso,
  };
  await saveStoredAlert(updated);
  return updated;
}

async function resolveAlert(alertId, user = 'admin') {
  const stored = await getStoredAlerts();
  const alert = stored.find(item => item.id === alertId);
  if (!alert) {
    throw new Error('Alerta no encontrada');
  }

  const nowIso = new Date().toISOString();
  const updated = {
    ...alert,
    status: 'RESOLVED',
    resolvedBy: user,
    resolvedAt: nowIso,
    lastSeenAt: alert.lastSeenAt || nowIso,
  };
  await saveStoredAlert(updated);
  return updated;
}

async function getCrtmConfig() {
  await ensureInit();
  if (db) {
    const doc = await db.collection('integrations').doc('crtm_config').get();
    if (!doc.exists) {
      await db.collection('integrations').doc('crtm_config').set(DEFAULT_CRTM_CONFIG, { merge: true });
      return { ...DEFAULT_CRTM_CONFIG };
    }
    return { ...DEFAULT_CRTM_CONFIG, ...doc.data() };
  }

  if (!localStore.integrations.crtmConfig) {
    localStore.integrations.crtmConfig = { ...DEFAULT_CRTM_CONFIG };
  }
  return { ...localStore.integrations.crtmConfig };
}

async function updateCrtmConfig(patch = {}) {
  const current = await getCrtmConfig();
  const next = {
    ...current,
    ...patch,
    datasets: Array.isArray(patch.datasets) ? patch.datasets : current.datasets,
    stopCodes: Array.isArray(patch.stopCodes) ? patch.stopCodes.map(code => toStopCode(code)) : current.stopCodes,
    updatedAt: new Date().toISOString(),
  };

  await ensureInit();
  if (db) {
    await db.collection('integrations').doc('crtm_config').set(next, { merge: true });
    return next;
  }

  localStore.integrations.crtmConfig = next;
  return next;
}

function getCrtmDatasets() {
  return CRTM_DATASETS.map(item => ({ ...item }));
}

function resolveExportRange({ preset = 'yesterday', startDate, endDate }) {
  const today = new Date().toISOString().slice(0, 10);
  if (preset === 'last7d') {
    return { startDate: shiftDate(today, -6), endDate: today };
  }
  if (preset === 'custom' && startDate && endDate) {
    return { startDate, endDate };
  }
  const yesterday = shiftDate(today, -1);
  return { startDate: yesterday, endDate: yesterday };
}

function buildDailyRows(records = [], allowedStopCodes = []) {
  const map = new Map();
  for (const row of records) {
    const stopCode = toStopCode(row?.stopCode || row?.entity);
    if (allowedStopCodes.length > 0 && !allowedStopCodes.includes(stopCode)) continue;
    const date = row?.date;
    if (!date) continue;
    const key = `${stopCode}::${date}`;
    if (!map.has(key)) {
      map.set(key, {
        stopCode,
        date,
        totalNumber: 0,
        afterDeduplication: 0,
        man: 0,
        woman: 0,
        unknown: 0,
      });
    }
    const target = map.get(key);
    target.totalNumber += row?.totals?.totalNumber || 0;
    target.afterDeduplication += row?.totals?.afterDeduplication || 0;
    target.man += row?.gender?.man || 0;
    target.woman += row?.gender?.woman || 0;
    target.unknown += row?.gender?.unknown || 0;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.stopCode.localeCompare(b.stopCode));
}

function rowsToCsv(rows = []) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers, ...rows.map(row => headers.map(key => row[key]))]
    .map(line => line.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
  return lines.join('\n');
}

function rowsToJson(rows = []) {
  return JSON.stringify(rows, null, 2);
}

async function saveCrtmRun(run) {
  await ensureInit();
  if (db) {
    await db.collection('integrations').doc('crtm_runs').collection('items').doc(run.id).set(run, { merge: true });
    return;
  }

  const idx = localStore.integrations.crtmRuns.findIndex(item => item.id === run.id);
  if (idx === -1) {
    localStore.integrations.crtmRuns.push(run);
  } else {
    localStore.integrations.crtmRuns[idx] = run;
  }
}

async function listCrtmRuns() {
  await ensureInit();
  if (db) {
    const snapshot = await db.collection('integrations').doc('crtm_runs').collection('items').get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  return [...localStore.integrations.crtmRuns]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function getCrtmRunById(runId) {
  await ensureInit();
  if (db) {
    const doc = await db.collection('integrations').doc('crtm_runs').collection('items').doc(runId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }
  return localStore.integrations.crtmRuns.find(item => item.id === runId) || null;
}

async function executeCrtmExport(params = {}) {
  const {
    datasetId = 'afluencia_daily',
    rangePreset = 'yesterday',
    startDate,
    endDate,
    retry = false,
    requestedBy = 'admin',
  } = params;

  const config = await getCrtmConfig();
  const dataset = CRTM_DATASETS.find(item => item.id === datasetId);
  if (!dataset) {
    throw new Error('Dataset no soportado');
  }

  const resolvedRange = resolveExportRange({ preset: rangePreset, startDate, endDate });
  const runId = createId('crtm_run');
  const format = String(config.format || 'CSV').toUpperCase();

  let rows = [];
  let status = 'OK';
  let detailMessage = 'Exportación completada';
  try {
    if (datasetId === 'afluencia_daily') {
      const records = await getRecords({
        startDate: resolvedRange.startDate,
        endDate: resolvedRange.endDate,
        limit: 200000,
      });
      rows = buildDailyRows(records, Array.isArray(config.stopCodes) ? config.stopCodes : []);
    } else if (datasetId === 'alerts') {
      const alerts = await getAlerts({ status: 'all', severity: 'all', range: 'all' });
      const filtered = alerts.filter(item => isAlertInPeriod(item, resolvedRange.startDate, resolvedRange.endDate));
      const grouped = new Map();
      for (const item of filtered) {
        const date = String(item.lastSeenAt || item.firstSeenAt || '').slice(0, 10);
        const key = `${date}::${item.type}::${item.severity}`;
        if (!grouped.has(key)) {
          grouped.set(key, { date, type: item.type, severity: item.severity, count: 0 });
        }
        grouped.get(key).count += 1;
      }
      rows = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
    } else {
      status = 'ERROR';
      detailMessage = 'Dataset en roadmap, aún no disponible en este entorno';
    }
  } catch (error) {
    status = 'ERROR';
    detailMessage = error.message || 'Error en ejecución';
  }

  const payload = format === 'JSON' ? rowsToJson(rows) : rowsToCsv(rows);
  const checksum = crypto.createHash('sha256').update(payload || '').digest('hex');
  const extension = format === 'JSON' ? 'json' : 'csv';
  const filename = `${datasetId}_${resolvedRange.startDate}_${resolvedRange.endDate}.${extension}`;

  const run = {
    id: runId,
    connector: 'CRTM',
    datasetId,
    period: resolvedRange,
    format,
    mode: config.deliveryMode,
    status,
    retry: !!retry,
    detailMessage,
    recordsCount: rows.length,
    checksum,
    filename,
    payload,
    requestedBy,
    destination: config.deliveryMode,
    createdAt: new Date().toISOString(),
    configSnapshot: {
      deliveryMode: config.deliveryMode,
      frequency: config.frequency,
      datasets: config.datasets,
      stopCodes: config.stopCodes,
    },
  };

  await saveCrtmRun(run);
  return run;
}

async function getReportTemplates() {
  await ensureInit();
  if (db) {
    const snapshot = await db.collection('report_templates').get();
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (templates.length > 0) return templates;

    for (const item of DEFAULT_REPORT_TEMPLATES) {
      await db.collection('report_templates').doc(item.id).set(item, { merge: true });
    }
    return DEFAULT_REPORT_TEMPLATES;
  }

  if (localStore.reportTemplates.length === 0) {
    localStore.reportTemplates = DEFAULT_REPORT_TEMPLATES.map(item => ({ ...item }));
  }

  return [...localStore.reportTemplates];
}

function listBetweenDates(records = [], startDate, endDate) {
  return records.filter(item => {
    const date = item?.date;
    if (!date) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

function pickPeakDay(records = []) {
  let best = null;
  for (const row of records) {
    const total = row?.totals?.totalNumber || 0;
    if (!best || total > best.total) {
      best = {
        date: row?.date || null,
        total,
        hour: row?.peakHour?.hour || null,
      };
    }
  }
  return best;
}

function aggregateAgeDominant(age = {}) {
  const keys = ['0-9', '10-16', '17-30', '31-45', '46-60', '60+'];
  let bestKey = null;
  let bestValue = -1;
  for (const key of keys) {
    const value = age?.[key] || 0;
    if (value > bestValue) {
      bestValue = value;
      bestKey = key;
    }
  }
  return bestValue > 0 ? bestKey : null;
}

function isAlertInPeriod(alert, startDate, endDate) {
  const first = String(alert.firstSeenAt || '').slice(0, 10);
  const last = String(alert.lastSeenAt || '').slice(0, 10);
  if (!first && !last) return false;
  if (endDate && first && first > endDate && last && last > endDate) return false;
  if (startDate && first && first < startDate && last && last < startDate) return false;
  return true;
}

function buildPreviousPeriod(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const previousEnd = shiftDate(startDate, -1);
  const previousStart = shiftDate(previousEnd, -(days - 1));
  return { startDate: previousStart, endDate: previousEnd };
}

function buildExecutiveInsights({ currentTotal, previousTotal, topGrowth = [], topDrop = [], criticalAlerts = 0 }) {
  const variation = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null;
  return [
    `Afluencia total del periodo: ${currentTotal}.`,
    variation === null
      ? 'No hay base suficiente para comparar con el periodo anterior.'
      : `Variación vs periodo anterior: ${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%.`,
    topGrowth.length > 0
      ? `Mayor crecimiento: ${topGrowth[0].stopCode} (${topGrowth[0].variationAbs >= 0 ? '+' : ''}${topGrowth[0].variationAbs}).`
      : 'No se detectan crecimientos destacados.',
    topDrop.length > 0
      ? `Mayor caída: ${topDrop[0].stopCode} (${topDrop[0].variationAbs}).`
      : 'No se detectan caídas destacadas.',
    `Alertas críticas en periodo: ${criticalAlerts}.`
  ];
}

async function buildStopReportPayload({ stopCode, startDate, endDate, notes = '' }) {
  const stopData = await getDashboardByStop(stopCode, startDate, endDate, 400);
  const summary = stopData?.summary || null;
  const records = Array.isArray(stopData?.records) ? stopData.records : [];

  const total = summary?.totals?.totalNumber || 0;
  const dailyAvg = records.length > 0 ? Math.round(total / records.length) : 0;
  const peakDay = pickPeakDay(records);

  const allAlerts = await getAlerts({ status: 'all', severity: 'all', range: 'all', search: stopCode });
  const periodAlerts = allAlerts.filter(item => isAlertInPeriod(item, startDate, endDate));

  return {
    type: 'stop',
    stopCode,
    scope: stopData?.entity || stopCode,
    period: { startDate, endDate },
    kpis: {
      total,
      dailyAvg,
      peakDay,
    },
    dailyTrend: records
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => ({ date: row.date, total: row?.totals?.totalNumber || 0 })),
    gender: summary?.gender || { man: 0, woman: 0, unknown: 0 },
    age: summary?.age || {},
    topAgeBand: aggregateAgeDominant(summary?.age || {}),
    alerts: periodAlerts,
    notes: String(notes || ''),
  };
}

async function buildMultiReportPayload({ stopCodes, startDate, endDate, comparePrevious = false }) {
  const compare = await getCompareDashboard(stopCodes, startDate, endDate, 400);
  const aggregate = await getAggregateDashboard(stopCodes, startDate, endDate, 400);

  const rows = (compare?.comparisons || []).map(item => {
    const total = item?.summary?.totals?.totalNumber || 0;
    const records = Array.isArray(item?.records) ? item.records : [];
    const dailyAvg = records.length ? Math.round(total / records.length) : 0;
    return {
      stopCode: item.stopCode,
      total,
      dailyAvg,
      peak: pickPeakDay(records),
    };
  }).sort((a, b) => b.total - a.total);

  const top = rows.slice(0, 10);
  const bottom = [...rows].slice(-10).reverse();

  const allAlerts = await getAlerts({ status: 'all', severity: 'all', range: 'all' });
  const periodAlerts = allAlerts.filter(item => stopCodes.includes(item.stopCode) && isAlertInPeriod(item, startDate, endDate));
  const alertsByType = periodAlerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {});

  let previousComparison = null;
  if (comparePrevious) {
    const previousPeriod = buildPreviousPeriod(startDate, endDate);
    const prevCompare = await getCompareDashboard(stopCodes, previousPeriod.startDate, previousPeriod.endDate, 400);
    const prevByStop = new Map((prevCompare?.comparisons || []).map(item => [item.stopCode, item]));
    previousComparison = rows.map(row => {
      const previousTotal = prevByStop.get(row.stopCode)?.summary?.totals?.totalNumber || 0;
      const variationAbs = row.total - previousTotal;
      const variationPct = previousTotal > 0 ? (variationAbs / previousTotal) * 100 : null;
      return {
        stopCode: row.stopCode,
        currentTotal: row.total,
        previousTotal,
        variationAbs,
        variationPct,
      };
    }).sort((a, b) => (b.variationAbs - a.variationAbs));
  }

  return {
    type: 'multi',
    period: { startDate, endDate },
    stopCodes,
    kpis: {
      total: aggregate?.summary?.totals?.totalNumber || 0,
      dailyAvg: (aggregate?.records || []).length > 0
        ? Math.round((aggregate?.summary?.totals?.totalNumber || 0) / aggregate.records.length)
        : 0,
      peakDay: pickPeakDay(aggregate?.records || []),
    },
    ranking: { top, bottom },
    comparisons: rows,
    gender: aggregate?.summary?.gender || { man: 0, woman: 0, unknown: 0 },
    age: aggregate?.summary?.age || {},
    alertsByType,
    previousComparison,
  };
}

async function buildExecutiveReportPayload({ stopCodes, startDate, endDate }) {
  const multi = await buildMultiReportPayload({ stopCodes, startDate, endDate, comparePrevious: true });
  const previousPeriod = buildPreviousPeriod(startDate, endDate);
  const previousAggregate = await getAggregateDashboard(stopCodes, previousPeriod.startDate, previousPeriod.endDate, 400);

  const currentTotal = multi?.kpis?.total || 0;
  const previousTotal = previousAggregate?.summary?.totals?.totalNumber || 0;
  const comparisons = Array.isArray(multi?.previousComparison) ? multi.previousComparison : [];
  const topGrowth = comparisons.filter(item => item.variationAbs > 0).slice(0, 5);
  const topDrop = comparisons.filter(item => item.variationAbs < 0).slice(-5).reverse();

  const allAlerts = await getAlerts({ status: 'all', severity: 'all', range: 'all' });
  const criticalAlerts = allAlerts.filter(item => stopCodes.includes(item.stopCode) && item.severity === 'CRITICAL' && isAlertInPeriod(item, startDate, endDate));

  const insights = buildExecutiveInsights({
    currentTotal,
    previousTotal,
    topGrowth,
    topDrop,
    criticalAlerts: criticalAlerts.length,
  });

  return {
    type: 'executive',
    period: { startDate, endDate },
    previousPeriod,
    kpis: {
      currentTotal,
      previousTotal,
      variationAbs: currentTotal - previousTotal,
      variationPct: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null,
    },
    topGrowth,
    topDrop,
    criticalAlerts: criticalAlerts.slice(0, 20),
    insights,
    recommendations: [
      'Reforzar frecuencia en marquesinas con crecimiento sostenido.',
      'Auditar sensores en puntos con caída brusca recurrente.',
      'Priorizar revisión operativa de alertas críticas abiertas.'
    ]
  };
}

async function saveReportItem(report) {
  await ensureInit();
  if (db) {
    await db.collection('reports').doc(report.id).set(report, { merge: true });
    return;
  }

  const idx = localStore.reports.findIndex(item => item.id === report.id);
  if (idx === -1) {
    localStore.reports.push(report);
  } else {
    localStore.reports[idx] = report;
  }
}

async function listReports() {
  await ensureInit();
  if (db) {
    const snapshot = await db.collection('reports').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));
  }

  return [...localStore.reports]
    .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));
}

async function getReportById(reportId) {
  await ensureInit();
  if (db) {
    const doc = await db.collection('reports').doc(reportId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  return localStore.reports.find(item => item.id === reportId) || null;
}

async function generateReport(params = {}) {
  const {
    type,
    startDate,
    endDate,
    stopCodes = [],
    stopCode,
    comparePrevious = false,
    generatedBy = 'admin',
    format = 'pdf',
    templateId = null,
    notes = '',
  } = params;

  if (!type || !startDate || !endDate) {
    throw new Error('type, startDate y endDate son obligatorios');
  }

  let payload;
  if (type === 'stop') {
    const resolvedStopCode = toStopCode(stopCode || stopCodes[0]);
    if (!resolvedStopCode) {
      throw new Error('Se requiere una marquesina para informe por marquesina');
    }
    payload = await buildStopReportPayload({ stopCode: resolvedStopCode, startDate, endDate, notes });
  } else if (type === 'multi') {
    const normalizedCodes = stopCodes.map(code => toStopCode(code));
    if (normalizedCodes.length === 0) {
      throw new Error('Se requieren marquesinas para informe multi-marquesina');
    }
    payload = await buildMultiReportPayload({ stopCodes: normalizedCodes, startDate, endDate, comparePrevious });
  } else if (type === 'executive') {
    const normalizedCodes = stopCodes.map(code => toStopCode(code));
    if (normalizedCodes.length === 0) {
      throw new Error('Se requieren marquesinas para resumen ejecutivo');
    }
    payload = await buildExecutiveReportPayload({ stopCodes: normalizedCodes, startDate, endDate });
  } else {
    throw new Error('Tipo de informe no soportado');
  }

  const report = {
    id: createId('report'),
    name: `Informe ${type} ${startDate} a ${endDate}`,
    type,
    status: 'ready',
    generatedBy,
    generatedAt: new Date().toISOString(),
    format,
    templateId,
    filters: {
      startDate,
      endDate,
      stopCode: stopCode || null,
      stopCodes: Array.isArray(stopCodes) ? stopCodes : [],
      comparePrevious: !!comparePrevious,
    },
    dataSnapshot: payload,
  };

  await saveReportItem(report);
  return report;
}

module.exports = {
  saveRecord,
  getRecords,
  getEntities,
  getStops,
  getStopByCode,
  isStopRegistered,
  createStop,
  updateStop,
  deleteStop,
  permanentDeleteStop,
  getLatestRecord,
  deleteRecord,
  getSummary,
  getDashboardCards,
  getDashboardByStop,
  getAggregateDashboard,
  getCompareDashboard,
  createUpload,
  updateUpload,
  addValidationErrors,
  getUploadErrors,
  validateRecord,
  toStopCode,
  saveMarquesinaDay,
  getMarquesinaDay,
  getMarquesinaRange,
  getMarquesinaLatest,
  recomputeOperationalAlerts,
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  getReportTemplates,
  listReports,
  getReportById,
  generateReport,
  getCrtmConfig,
  updateCrtmConfig,
  getCrtmDatasets,
  executeCrtmExport,
  listCrtmRuns,
  getCrtmRunById
};