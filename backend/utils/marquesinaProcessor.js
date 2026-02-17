/**
 * marquesinaProcessor.js
 * 
 * Módulo de procesamiento de Excel del IoT de Marquesinas CRTM.
 * Recibe el buffer del archivo .xlsx, depura los datos y devuelve
 * un objeto JSON estructurado listo para Firestore.
 * 
 * Dependencias: npm install xlsx
 * 
 * Uso:
 *   const { processMarquesinaExcel } = require('./marquesinaProcessor');
 *   const result = processMarquesinaExcel(fileBuffer);
 *   // result → objeto listo para Firestore
 */

const XLSX = require('xlsx');

// ─── Mapeo COMPLETO de las 42 columnas del Schema Query ──────────
const COL = {
  unit:               0,   // A – Unidad / hora
  people_in:          1,   // B – Personas que entran
  people_out:         2,   // C – Personas que salen
  passby:             3,   // D – Transeúntes
  turnback:           4,   // E – Retornos
  people_detained:    5,   // F – Personas detenidas
  entry_lot:          6,   // G – Lote de entrada
  outgoing_batch:     7,   // H – Lote de salida
  adult:              8,   // I – Adultos
  children:           9,   // J – Niños
  residents:         10,   // K – Residentes
  employee_entry:    11,   // L – Entrada de empleados
  customers_enter:   12,   // M – Entrada de clientes
  vehicle_entry:     13,   // N – Entrada de vehículos
  vehicle_exit:      14,   // O – Salida de vehículos
  deduplicated:      15,   // P – Contador deduplicado
  total_dwell_time:  16,   // Q – Tiempo total de permanencia
  avg_dwell_time:    17,   // R – Tiempo medio de permanencia
  total_people:      18,   // S – Total personas detectadas
  total_vehicles:    19,   // T – Total vehículos
  // Género — Grupo 1 (cols 20-22)
  gender_unknown:    20,   // U – Género desconocido G1
  male:              21,   // V – Masculino G1
  female:            22,   // W – Femenino G1
  // Edad — Grupo 1 (cols 23-29)
  age_unknown:       23,   // X – Edad desconocida G1
  age_lt10:          24,   // Y – <10 G1
  age_10_16:         25,   // Z – 10-16 G1
  age_17_30:         26,   // AA – 17-30 G1
  age_31_45:         27,   // AB – 31-45 G1
  age_46_60:         28,   // AC – 46-60 G1
  age_gt60:          29,   // AD – >60 G1
  // Género — Grupo 2 (cols 30-32)
  gender_unknown_g2: 30,   // AE – Género desconocido G2
  male_g2:           31,   // AF – Masculino G2
  female_g2:         32,   // AG – Femenino G2
  // Edad — Grupo 2 (cols 33-39)
  age_unknown_g2:    33,   // AH – Edad desconocida G2
  age_lt10_g2:       34,   // AI – <10 G2
  age_10_16_g2:      35,   // AJ – 10-16 G2
  age_17_30_g2:      36,   // AK – 17-30 G2
  age_31_45_g2:      37,   // AL – 31-45 G2
  age_46_60_g2:      38,   // AM – 46-60 G2
  age_gt60_g2:       39,   // AN – >60 G2
  // Empleados y timestamp
  employees_entering:40,   // AO – Empleados entrando
  time:              41,   // AP – Timestamp
};

// ─── Función principal ────────────────────────────────────────────
function processMarquesinaExcel(fileBuffer, filename) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  // Buscar la pestaña "Schema Query"
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase().includes('schema query')
  );
  if (!sheetName) {
    throw new Error('No se encontró la pestaña "Schema Query" en el Excel.');
  }

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: 0 });

  // Primera fila = encabezados, resto = datos
  const headers = raw[0];
  const dataRows = raw.slice(1);

  // ─── Filtrar filas válidas y capturar fila Total ───────────────
  let totalsRow = null;
  const validRows = dataRows.filter((row) => {
    const unit = String(row[COL.unit] || '').toLowerCase();
    if (unit === 'total') {
      totalsRow = row; // Guardar fila oficial de totales
      return false;
    }
    const totalPeople = num(row[COL.total_people]);
    return totalPeople > 0;
  });

  if (validRows.length === 0) {
    throw new Error('No se encontraron filas con actividad en el Excel.');
  }

  // ─── Extraer metadatos ────────────────────────────────────────
  const firstTimestamp = parseTimestamp(validRows[0][COL.time]);
  const lastTimestamp = parseTimestamp(validRows[validRows.length - 1][COL.time]);
  const unitName = String(validRows[0][COL.unit]);
  const date = firstTimestamp.toISOString().split('T')[0]; // YYYY-MM-DD

  // ─── Identificador de marquesina ──────────────────────────────
  // Prioridad:
  //   1. Código extraído del nombre del archivo (ej: "MARQ_001_2026-02-11.xlsx")
  //   2. Nombre de pestaña diferente a "Schema Query" que pueda ser un ID
  //   3. Valor de la columna unit si es único por marquesina
  const location = extractMarquesinaId(filename, workbook.SheetNames, unitName);

  // ─── Calcular totales ─────────────────────────────────────────
  const totals = {
    detected: 0,
    male: 0,
    female: 0,
    gender_unknown: 0,
    age_17_30: 0,
    age_31_45: 0,
    age_46_60: 0,
    age_gt60: 0,
    age_lt10: 0,
    age_10_16: 0,
    age_unknown: 0,
    total_dwell_time: 0,
    entry_lot: 0,
    outgoing_batch: 0,
    people_detained: 0,
    people_in: 0,
    people_out: 0,
    passby: 0,
    turnback: 0,
    adult: 0,
    children: 0,
    residents: 0,
    employee_entry: 0,
    customers_enter: 0,
    vehicle_entry: 0,
    vehicle_exit: 0,
    deduplicated: 0,
    total_vehicles: 0,
    employees_entering: 0,
    // Grupo 2
    male_g2: 0,
    female_g2: 0,
    gender_unknown_g2: 0,
    age_lt10_g2: 0,
    age_10_16_g2: 0,
    age_17_30_g2: 0,
    age_31_45_g2: 0,
    age_46_60_g2: 0,
    age_gt60_g2: 0,
    age_unknown_g2: 0,
  };

  // ─── Procesar hora a hora ─────────────────────────────────────
  const hourly = validRows.map((row) => {
    const timestamp = parseTimestamp(row[COL.time]);
    const hour = timestamp.toISOString().substring(11, 16); // "HH:MM"

    const detected      = num(row[COL.total_people]);
    const male          = num(row[COL.male]);
    const female        = num(row[COL.female]);
    const gender_unknown = num(row[COL.gender_unknown]);
    const age_unknown   = num(row[COL.age_unknown]);
    const age_lt10      = num(row[COL.age_lt10]);
    const age_10_16     = num(row[COL.age_10_16]);
    const age_17_30     = num(row[COL.age_17_30]);
    const age_31_45     = num(row[COL.age_31_45]);
    const age_46_60     = num(row[COL.age_46_60]);
    const age_gt60      = num(row[COL.age_gt60]);
    const avg_dwell     = num(row[COL.avg_dwell_time]);
    const entry_lot     = num(row[COL.entry_lot]);
    const outgoing_batch = num(row[COL.outgoing_batch]);
    const people_detained = num(row[COL.people_detained]);
    const people_in     = num(row[COL.people_in]);
    const people_out    = num(row[COL.people_out]);

    // Columnas nuevas
    const passby           = num(row[COL.passby]);
    const turnback         = num(row[COL.turnback]);
    const adult            = num(row[COL.adult]);
    const children         = num(row[COL.children]);
    const residents        = num(row[COL.residents]);
    const employee_entry   = num(row[COL.employee_entry]);
    const customers_enter  = num(row[COL.customers_enter]);
    const vehicle_entry    = num(row[COL.vehicle_entry]);
    const vehicle_exit     = num(row[COL.vehicle_exit]);
    const deduplicated     = num(row[COL.deduplicated]);
    const total_vehicles   = num(row[COL.total_vehicles]);
    const employees_entering = num(row[COL.employees_entering]);

    // Grupo 2: Género y Edad
    const male_g2          = num(row[COL.male_g2]);
    const female_g2        = num(row[COL.female_g2]);
    const gender_unknown_g2 = num(row[COL.gender_unknown_g2]);
    const age_unknown_g2   = num(row[COL.age_unknown_g2]);
    const age_lt10_g2      = num(row[COL.age_lt10_g2]);
    const age_10_16_g2     = num(row[COL.age_10_16_g2]);
    const age_17_30_g2     = num(row[COL.age_17_30_g2]);
    const age_31_45_g2     = num(row[COL.age_31_45_g2]);
    const age_46_60_g2     = num(row[COL.age_46_60_g2]);
    const age_gt60_g2      = num(row[COL.age_gt60_g2]);

    const identified = male + female + gender_unknown;
    const not_identified = detected - identified;

    // Acumular totales
    totals.detected += detected;
    totals.male += male;
    totals.female += female;
    totals.gender_unknown += gender_unknown;
    totals.age_17_30 += age_17_30;
    totals.age_31_45 += age_31_45;
    totals.age_46_60 += age_46_60;
    totals.age_gt60 += age_gt60;
    totals.age_lt10 += age_lt10;
    totals.age_10_16 += age_10_16;
    totals.age_unknown += age_unknown;
    totals.total_dwell_time += num(row[COL.total_dwell_time]);
    totals.entry_lot += entry_lot;
    totals.outgoing_batch += outgoing_batch;
    totals.people_detained += people_detained;
    totals.people_in += people_in;
    totals.people_out += people_out;
    totals.passby += passby;
    totals.turnback += turnback;
    totals.adult += adult;
    totals.children += children;
    totals.residents += residents;
    totals.employee_entry += employee_entry;
    totals.customers_enter += customers_enter;
    totals.vehicle_entry += vehicle_entry;
    totals.vehicle_exit += vehicle_exit;
    totals.deduplicated += deduplicated;
    totals.total_vehicles += total_vehicles;
    totals.employees_entering += employees_entering;
    // Grupo 2
    totals.male_g2 += male_g2;
    totals.female_g2 += female_g2;
    totals.gender_unknown_g2 += gender_unknown_g2;
    totals.age_lt10_g2 += age_lt10_g2;
    totals.age_10_16_g2 += age_10_16_g2;
    totals.age_17_30_g2 += age_17_30_g2;
    totals.age_31_45_g2 += age_31_45_g2;
    totals.age_46_60_g2 += age_46_60_g2;
    totals.age_gt60_g2 += age_gt60_g2;
    totals.age_unknown_g2 += age_unknown_g2;

    return {
      hour,
      detected,
      entry_lot,
      outgoing_batch,
      people_detained,
      people_in,
      people_out,
      passby,
      turnback,
      adult,
      children,
      residents,
      employee_entry,
      customers_enter,
      vehicle_entry,
      vehicle_exit,
      deduplicated,
      total_vehicles,
      employees_entering,
      gender: { male, female, unknown: gender_unknown },
      age: {
        '<10': age_lt10,
        '10-16': age_10_16,
        '17-30': age_17_30,
        '31-45': age_31_45,
        '46-60': age_46_60,
        '>60': age_gt60,
        unknown: age_unknown,
      },
      gender_g2: { male: male_g2, female: female_g2, unknown: gender_unknown_g2 },
      age_g2: {
        '<10': age_lt10_g2,
        '10-16': age_10_16_g2,
        '17-30': age_17_30_g2,
        '31-45': age_31_45_g2,
        '46-60': age_46_60_g2,
        '>60': age_gt60_g2,
        unknown: age_unknown_g2,
      },
      identified,
      not_identified,
      avg_dwell_minutes: avg_dwell,
    };
  });

  // ─── Hora pico ────────────────────────────────────────────────
  const peakHour = hourly.reduce((max, h) =>
    h.detected > max.detected ? h : max
  );

  // ─── Totales con porcentajes ──────────────────────────────────
  const base = totals.detected;
  const identified = totals.male + totals.female + totals.gender_unknown;
  const notIdentified = base - identified;

  const avgDwellMinutes = base > 0
    ? Math.round(totals.total_dwell_time / base)
    : 0;

  // ─── Fila oficial de totales (del Excel) ──────────────────────
  const officialTotals = totalsRow ? {
    people_in:          num(totalsRow[COL.people_in]),
    people_out:         num(totalsRow[COL.people_out]),
    passby:             num(totalsRow[COL.passby]),
    turnback:           num(totalsRow[COL.turnback]),
    people_detained:    num(totalsRow[COL.people_detained]),
    entry_lot:          num(totalsRow[COL.entry_lot]),
    outgoing_batch:     num(totalsRow[COL.outgoing_batch]),
    adult:              num(totalsRow[COL.adult]),
    children:           num(totalsRow[COL.children]),
    residents:          num(totalsRow[COL.residents]),
    employee_entry:     num(totalsRow[COL.employee_entry]),
    customers_enter:    num(totalsRow[COL.customers_enter]),
    vehicle_entry:      num(totalsRow[COL.vehicle_entry]),
    vehicle_exit:       num(totalsRow[COL.vehicle_exit]),
    deduplicated:       num(totalsRow[COL.deduplicated]),
    total_dwell_time:   num(totalsRow[COL.total_dwell_time]),
    avg_dwell_time:     num(totalsRow[COL.avg_dwell_time]),
    total_people:       num(totalsRow[COL.total_people]),
    total_vehicles:     num(totalsRow[COL.total_vehicles]),
    employees_entering: num(totalsRow[COL.employees_entering]),
    male:               num(totalsRow[COL.male]),
    female:             num(totalsRow[COL.female]),
    gender_unknown:     num(totalsRow[COL.gender_unknown]),
  } : null;

  // ─── Grupo 2 Género consolidado ──────────────────────────────
  const g2Total = totals.male_g2 + totals.female_g2 + totals.gender_unknown_g2;
  const g2AgeTotal = totals.age_lt10_g2 + totals.age_10_16_g2 + totals.age_17_30_g2 +
                     totals.age_31_45_g2 + totals.age_46_60_g2 + totals.age_gt60_g2 +
                     totals.age_unknown_g2;

  // ─── Auto-generar observaciones clave ─────────────────────────
  const observations = generateObservations(totals, hourly, peakHour, base, identified);

  // ─── Objeto final para Firestore ──────────────────────────────
  const result = {
    meta: {
      location,
      date,
      measurement_start: hourly[0].hour,
      measurement_end: hourly[hourly.length - 1].hour,
      active_hours: hourly.length,
      note: 'Sensor sin iluminación: solo mide con luz natural',
      processed_at: new Date().toISOString(),
    },

    summary: {
      total_detected: base,
      total_identified: identified,
      total_not_identified: notIdentified,
      identification_rate: pct(identified, base),
      avg_dwell_minutes: avgDwellMinutes,
      peak_hour: {
        hour: peakHour.hour,
        detected: peakHour.detected,
        pct_of_total: pct(peakHour.detected, base),
      },
      traffic: {
        entry_lot: totals.entry_lot,
        outgoing_batch: totals.outgoing_batch,
        people_detained: totals.people_detained,
        people_in: totals.people_in,
        people_out: totals.people_out,
        passby: totals.passby,
        turnback: totals.turnback,
      },
      people: {
        adult: totals.adult,
        children: totals.children,
        residents: totals.residents,
        employee_entry: totals.employee_entry,
        customers_enter: totals.customers_enter,
        employees_entering: totals.employees_entering,
      },
      vehicles: {
        vehicle_entry: totals.vehicle_entry,
        vehicle_exit: totals.vehicle_exit,
        total_vehicles: totals.total_vehicles,
      },
      deduplicated: totals.deduplicated,
    },

    gender: {
      male:    { count: totals.male,           pct: pct(totals.male, base) },
      female:  { count: totals.female,         pct: pct(totals.female, base) },
      unknown: { count: totals.gender_unknown, pct: pct(totals.gender_unknown, base) },
      not_identified: { count: notIdentified,  pct: pct(notIdentified, base) },
    },

    age: {
      '<10':   { count: totals.age_lt10,   pct: pct(totals.age_lt10, base) },
      '10-16': { count: totals.age_10_16,  pct: pct(totals.age_10_16, base) },
      '17-30': { count: totals.age_17_30,  pct: pct(totals.age_17_30, base) },
      '31-45': { count: totals.age_31_45,  pct: pct(totals.age_31_45, base) },
      '46-60': { count: totals.age_46_60,  pct: pct(totals.age_46_60, base) },
      '>60':   { count: totals.age_gt60,   pct: pct(totals.age_gt60, base) },
      unknown: { count: totals.age_unknown, pct: pct(totals.age_unknown, base) },
      not_identified: { count: notIdentified, pct: pct(notIdentified, base) },
    },

    // Grupo 2 de género y edad
    gender_g2: {
      male:    { count: totals.male_g2,           pct: pct(totals.male_g2, g2Total || base) },
      female:  { count: totals.female_g2,         pct: pct(totals.female_g2, g2Total || base) },
      unknown: { count: totals.gender_unknown_g2, pct: pct(totals.gender_unknown_g2, g2Total || base) },
    },

    age_g2: {
      '<10':   { count: totals.age_lt10_g2,   pct: pct(totals.age_lt10_g2, g2AgeTotal || base) },
      '10-16': { count: totals.age_10_16_g2,  pct: pct(totals.age_10_16_g2, g2AgeTotal || base) },
      '17-30': { count: totals.age_17_30_g2,  pct: pct(totals.age_17_30_g2, g2AgeTotal || base) },
      '31-45': { count: totals.age_31_45_g2,  pct: pct(totals.age_31_45_g2, g2AgeTotal || base) },
      '46-60': { count: totals.age_46_60_g2,  pct: pct(totals.age_46_60_g2, g2AgeTotal || base) },
      '>60':   { count: totals.age_gt60_g2,   pct: pct(totals.age_gt60_g2, g2AgeTotal || base) },
      unknown: { count: totals.age_unknown_g2, pct: pct(totals.age_unknown_g2, g2AgeTotal || base) },
    },

    officialTotals,

    observations,

    hourly,
  };

  return result;
}

// ─── Generación automática de observaciones ──────────────────────
function generateObservations(totals, hourly, peakHour, base, identified) {
  const obs = [];

  // 1. Hora pico
  obs.push(`La hora pico fue ${peakHour.hour} con ${peakHour.detected} personas detectadas (${pct(peakHour.detected, base)}% del total).`);

  // 2. Género dominante
  if (totals.male > totals.female) {
    obs.push(`Predominancia masculina: ${totals.male} hombres (${pct(totals.male, base)}%) frente a ${totals.female} mujeres (${pct(totals.female, base)}%).`);
  } else if (totals.female > totals.male) {
    obs.push(`Predominancia femenina: ${totals.female} mujeres (${pct(totals.female, base)}%) frente a ${totals.male} hombres (${pct(totals.male, base)}%).`);
  } else {
    obs.push(`Distribución equilibrada de género: ${totals.male} hombres y ${totals.female} mujeres.`);
  }

  // 3. Rango de edad dominante
  const ageRanges = [
    { label: '<10', value: totals.age_lt10 },
    { label: '10-16', value: totals.age_10_16 },
    { label: '17-30', value: totals.age_17_30 },
    { label: '31-45', value: totals.age_31_45 },
    { label: '46-60', value: totals.age_46_60 },
    { label: '>60', value: totals.age_gt60 },
  ];
  const dominant = ageRanges.reduce((max, r) => r.value > max.value ? r : max);
  obs.push(`Rango de edad dominante: ${dominant.label} años con ${dominant.value} personas (${pct(dominant.value, base)}%).`);

  // 4. Tasa de identificación
  const idRate = pct(identified, base);
  if (idRate < 50) {
    obs.push(`Tasa de identificación baja: ${idRate}%. Gran parte del tráfico no fue clasificado por el sensor.`);
  } else {
    obs.push(`Tasa de identificación: ${idRate}%. El sensor logró clasificar a la mayoría de los peatones.`);
  }

  // 5. Tráfico entrada vs salida
  const inOut = totals.people_in + totals.people_out;
  if (inOut > 0) {
    const ratioIn = pct(totals.people_in, inOut);
    obs.push(`Flujo: ${totals.people_in} personas entraron (${ratioIn}%) y ${totals.people_out} salieron (${pct(totals.people_out, inOut)}%).`);
  }

  // 6. Vehículos
  if (totals.total_vehicles > 0 || totals.vehicle_entry > 0) {
    obs.push(`Se registraron ${totals.total_vehicles} vehículos totales: ${totals.vehicle_entry} entradas y ${totals.vehicle_exit} salidas.`);
  } else {
    obs.push(`No se registró tráfico vehicular en este período de medición.`);
  }

  return obs;
}

// ─── Helpers ──────────────────────────────────────────────────────

function num(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function pct(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function parseTimestamp(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  return new Date(String(val));
}

/**
 * Extrae un identificador único de marquesina.
 *
 * Estrategia de prioridad:
 *   1. Del nombre del archivo: busca un patrón tipo código
 *      (ej: "MARQ_001", "CRTM-ARJ-001", "marquesina_hospital_2026-02-11.xlsx")
 *   2. De las pestañas del workbook: si hay alguna diferente a "Schema Query"
 *      que parezca un ID (sin espacios, alfanumérica)
 *   3. Fallback: usa el valor de la columna 'unit' del Excel
 */
function extractMarquesinaId(filename, sheetNames, unitName) {
  // Helper: quita fechas tipo YYYY-MM-DD o YYYY_MM_DD y separadores sobrantes
  function stripDate(str) {
    return str
      .replace(/[_\-\s]?\d{4}[-_]\d{2}[-_]\d{2}[_\-\s]?/g, '')
      .replace(/^[_\-\s]+|[_\-\s]+$/g, '');
  }

  // ─── 1. Intentar extraer del nombre del archivo ───────────────
  if (filename) {
    // Quitar extensión
    const baseName = filename.replace(/\.[^.]+$/, '');

    // Primero quitar la fecha del nombre para buscar el código limpio
    const cleaned = stripDate(baseName);

    if (cleaned.length > 0) {
      // Buscar patrón tipo código: MARQ_XXX, CRTM-XXX, etc.
      const codeMatch = cleaned.match(/([A-Za-z][A-Za-z0-9]*[-_][A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*)/i);
      if (codeMatch) {
        return codeMatch[1];
      }

      // Si no tiene patrón de código pero no es genérico, usar el nombre limpio
      const genericNames = ['data', 'export', 'schema', 'query', 'report', 'informe', 'datos'];
      const lowerCleaned = cleaned.toLowerCase();
      const isGeneric = genericNames.some(g => lowerCleaned === g || lowerCleaned.startsWith(g + '_') || lowerCleaned.startsWith(g + '-'));

      if (!isGeneric && cleaned.length > 2 && cleaned.length < 60) {
        return cleaned;
      }
    }
  }

  // ─── 2. Buscar en las pestañas del workbook ────────────────────
  if (sheetNames && sheetNames.length > 0) {
    const nonGeneric = sheetNames.filter(name => {
      const lower = name.toLowerCase();
      return !lower.includes('schema query') &&
             !lower.includes('sheet') &&
             !lower.includes('hoja') &&
             lower.length > 1 &&
             lower.length < 50;
    });
    if (nonGeneric.length === 1) {
      return nonGeneric[0];
    }
  }

  // ─── 3. Fallback: columna unit ─────────────────────────────────
  return unitName || 'MARQUESINA_SIN_ID';
}

/**
 * Detecta si un workbook Excel contiene la pestaña "Schema Query"
 * (indica que es un Excel IoT de marquesina).
 */
function isMarquesinaExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', bookSheets: true });
    return workbook.SheetNames.some(
      (name) => name.toLowerCase().includes('schema query')
    );
  } catch {
    return false;
  }
}

module.exports = { processMarquesinaExcel, isMarquesinaExcel };
