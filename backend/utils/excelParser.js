const XLSX = require('xlsx');

/**
 * Parsea un archivo Excel de afluencia y devuelve los datos estructurados.
 * 
 * El Excel debe tener las siguientes columnas (fila 1 = cabeceras):
 * 
 * A: Fecha (YYYY-MM-DD)
 * B: Entidad
 * C: Adultos
 * D: Niños
 * E: Deduplicados
 * F: Número Total
 * G: Empleados Heavy
 * H: Tiempo Residencia (HH:MM:SS)
 * I: Género Hombre
 * J: Género Mujer
 * K: Género Desconocido
 * L: Edad 0-9
 * M: Edad 10-16
 * N: Edad 17-30
 * O: Edad 31-45
 * P: Edad 46-60
 * Q: Edad 60+
 * R: Edad Desconocido
 * S: Heavy Edad 0-9
 * T: Heavy Edad 10-16
 * U: Heavy Edad 17-30
 * V: Heavy Edad 31-45
 * W: Heavy Edad 46-60
 * X: Heavy Edad 60+
 * Y: Heavy Edad Desconocido
 * Z: Flujo Ayer
 * AA: Chain Index Ayer (%)
 * AB: YOY Ayer (%)
 * AC: Flujo Semana
 * AD: Chain Index Semana (%)
 * AE: YOY Semana (%)
 * AF: Flujo Mes
 * AG: Chain Index Mes (%)
 * AH: YOY Mes (%)
 * AI: Flujo Año
 * AJ: Chain Index Año (%)
 */

const COLUMN_MAP = {
  'codigo': 'stopCode',
  'código': 'stopCode',
  'codigo marquesina': 'stopCode',
  'código marquesina': 'stopCode',
  'stop_code': 'stopCode',
  'stop code': 'stopCode',
  'marquesina': 'stopCode',
  'fecha': 'date',
  'date': 'date',
  'entidad': 'entity',
  'entity': 'entity',
  'adultos': 'adults',
  'adult': 'adults',
  'adults': 'adults',
  'niños': 'children',
  'ninos': 'children',
  'children': 'children',
  'deduplicados': 'afterDeduplication',
  'after deduplication': 'afterDeduplication',
  'deduplication': 'afterDeduplication',
  'numero total': 'totalNumber',
  'número total': 'totalNumber',
  'total number': 'totalNumber',
  'total': 'totalNumber',
  'empleados heavy': 'heavyEmployees',
  'go heavy employees': 'heavyEmployees',
  'heavy employees': 'heavyEmployees',
  'tiempo residencia': 'residenceTime',
  'total residence time': 'residenceTime',
  'residence time': 'residenceTime',
  'genero hombre': 'genderMan',
  'género hombre': 'genderMan',
  'man': 'genderMan',
  'hombre': 'genderMan',
  'genero mujer': 'genderWoman',
  'género mujer': 'genderWoman',
  'woman': 'genderWoman',
  'mujer': 'genderWoman',
  'genero desconocido': 'genderUnknown',
  'género desconocido': 'genderUnknown',
  'gender unknown': 'genderUnknown',
  'desconocido genero': 'genderUnknown',
  'edad 0-9': 'age0_9',
  'age 0-9': 'age0_9',
  '0-9': 'age0_9',
  'edad 10-16': 'age10_16',
  'age 10-16': 'age10_16',
  '10-16': 'age10_16',
  'edad 17-30': 'age17_30',
  'age 17-30': 'age17_30',
  '17-30': 'age17_30',
  'edad 31-45': 'age31_45',
  'age 31-45': 'age31_45',
  '31-45': 'age31_45',
  'edad 46-60': 'age46_60',
  'age 46-60': 'age46_60',
  '46-60': 'age46_60',
  'edad 60+': 'age60plus',
  'age 60+': 'age60plus',
  'age 60-': 'age60plus',
  '60+': 'age60plus',
  '60-': 'age60plus',
  'edad desconocido': 'ageUnknown',
  'age unknown': 'ageUnknown',
  'heavy edad 0-9': 'heavyAge0_9',
  'heavy age 0-9': 'heavyAge0_9',
  'heavy 0-9': 'heavyAge0_9',
  'heavy edad 10-16': 'heavyAge10_16',
  'heavy age 10-16': 'heavyAge10_16',
  'heavy 10-16': 'heavyAge10_16',
  'heavy edad 17-30': 'heavyAge17_30',
  'heavy age 17-30': 'heavyAge17_30',
  'heavy 17-30': 'heavyAge17_30',
  'heavy edad 31-45': 'heavyAge31_45',
  'heavy age 31-45': 'heavyAge31_45',
  'heavy 31-45': 'heavyAge31_45',
  'heavy edad 46-60': 'heavyAge46_60',
  'heavy age 46-60': 'heavyAge46_60',
  'heavy 46-60': 'heavyAge46_60',
  'heavy edad 60+': 'heavyAge60plus',
  'heavy age 60+': 'heavyAge60plus',
  'heavy 60+': 'heavyAge60plus',
  'heavy edad desconocido': 'heavyAgeUnknown',
  'heavy age unknown': 'heavyAgeUnknown',
  'flujo ayer': 'flowYesterday',
  'yesterday flow': 'flowYesterday',
  'chain index ayer': 'chainIndexYesterday',
  'yoy ayer': 'yoyYesterday',
  'flujo semana': 'flowWeek',
  'week flow': 'flowWeek',
  'chain index semana': 'chainIndexWeek',
  'yoy semana': 'yoyWeek',
  'flujo mes': 'flowMonth',
  'month flow': 'flowMonth',
  'chain index mes': 'chainIndexMonth',
  'yoy mes': 'yoyMonth',
  'flujo año': 'flowYear',
  'flujo ano': 'flowYear',
  'year flow': 'flowYear',
  'chain index año': 'chainIndexYear',
  'chain index ano': 'chainIndexYear'
};

function normalizeHeader(header) {
  return String(header).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

  if (rawData.length === 0) {
    throw new Error('El archivo Excel está vacío');
  }

  // Map headers
  const originalHeaders = Object.keys(rawData[0]);
  const headerMapping = {};

  for (const header of originalHeaders) {
    const normalized = normalizeHeader(header);
    for (const [key, value] of Object.entries(COLUMN_MAP)) {
      const normalizedKey = normalizeHeader(key);
      if (normalized === normalizedKey || normalized.includes(normalizedKey)) {
        headerMapping[header] = value;
        break;
      }
    }
  }

  // Parse each row to structured record
  const records = rawData.map((row, index) => {
    const mapped = {};
    for (const [originalHeader, value] of Object.entries(row)) {
      const mappedKey = headerMapping[originalHeader];
      if (mappedKey) {
        mapped[mappedKey] = value;
      }
    }

    // Format date
    let date = mapped.date;
    if (date instanceof Date) {
      date = date.toISOString().split('T')[0];
    } else if (typeof date === 'number') {
      // Excel serial date
      const excelDate = XLSX.SSF.parse_date_code(date);
      date = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    } else {
      date = String(date || new Date().toISOString().split('T')[0]);
    }

    // Build structured record
    return {
      date,
      stopCode: mapped.stopCode ? String(mapped.stopCode).trim() : null,
      entity: String(mapped.entity || 'Sin entidad'),
      totals: {
        adults: Number(mapped.adults) || 0,
        children: Number(mapped.children) || 0,
        afterDeduplication: Number(mapped.afterDeduplication) || 0,
        totalNumber: Number(mapped.totalNumber) || 0,
        heavyEmployees: Number(mapped.heavyEmployees) || 0
      },
      residenceTime: String(mapped.residenceTime || '00:00:00'),
      gender: {
        man: Number(mapped.genderMan) || 0,
        woman: Number(mapped.genderWoman) || 0,
        unknown: Number(mapped.genderUnknown) || 0
      },
      age: {
        '0-9': Number(mapped.age0_9) || 0,
        '10-16': Number(mapped.age10_16) || 0,
        '17-30': Number(mapped.age17_30) || 0,
        '31-45': Number(mapped.age31_45) || 0,
        '46-60': Number(mapped.age46_60) || 0,
        '60+': Number(mapped.age60plus) || 0,
        'unknown': Number(mapped.ageUnknown) || 0
      },
      ageHeavy: {
        '0-9': Number(mapped.heavyAge0_9) || 0,
        '10-16': Number(mapped.heavyAge10_16) || 0,
        '17-30': Number(mapped.heavyAge17_30) || 0,
        '31-45': Number(mapped.heavyAge31_45) || 0,
        '46-60': Number(mapped.heavyAge46_60) || 0,
        '60+': Number(mapped.heavyAge60plus) || 0,
        'unknown': Number(mapped.heavyAgeUnknown) || 0
      },
      passengerFlow: {
        yesterday: {
          value: Number(mapped.flowYesterday) || 0,
          chainIndex: Number(mapped.chainIndexYesterday) || 0,
          yoy: Number(mapped.yoyYesterday) || 0
        },
        lastWeek: {
          value: Number(mapped.flowWeek) || 0,
          chainIndex: Number(mapped.chainIndexWeek) || 0,
          yoy: Number(mapped.yoyWeek) || 0
        },
        lastMonth: {
          value: Number(mapped.flowMonth) || 0,
          chainIndex: Number(mapped.chainIndexMonth) || 0,
          yoy: Number(mapped.yoyMonth) || 0
        },
        thisYear: {
          value: Number(mapped.flowYear) || 0,
          chainIndex: Number(mapped.chainIndexYear) || 0
        }
      },
      rowIndex: index + 2 // +2 because row 1 is header, and 0-indexed
    };
  });

  return {
    totalRows: records.length,
    records,
    unmappedHeaders: originalHeaders.filter(h => !headerMapping[h])
  };
}

function parseExcelBuffer(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

  if (rawData.length === 0) {
    throw new Error('El archivo Excel está vacío');
  }

  const originalHeaders = Object.keys(rawData[0]);
  const headerMapping = {};

  for (const header of originalHeaders) {
    const normalized = normalizeHeader(header);
    for (const [key, value] of Object.entries(COLUMN_MAP)) {
      const normalizedKey = normalizeHeader(key);
      if (normalized === normalizedKey || normalized.includes(normalizedKey)) {
        headerMapping[header] = value;
        break;
      }
    }
  }

  const records = rawData.map((row, index) => {
    const mapped = {};
    for (const [originalHeader, value] of Object.entries(row)) {
      const mappedKey = headerMapping[originalHeader];
      if (mappedKey) {
        mapped[mappedKey] = value;
      }
    }

    let date = mapped.date;
    if (date instanceof Date) {
      date = date.toISOString().split('T')[0];
    } else if (typeof date === 'number') {
      const excelDate = XLSX.SSF.parse_date_code(date);
      date = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
    } else {
      date = String(date || new Date().toISOString().split('T')[0]);
    }

    return {
      date,
      stopCode: mapped.stopCode ? String(mapped.stopCode).trim() : null,
      entity: String(mapped.entity || 'Sin entidad'),
      totals: {
        adults: Number(mapped.adults) || 0,
        children: Number(mapped.children) || 0,
        afterDeduplication: Number(mapped.afterDeduplication) || 0,
        totalNumber: Number(mapped.totalNumber) || 0,
        heavyEmployees: Number(mapped.heavyEmployees) || 0
      },
      residenceTime: String(mapped.residenceTime || '00:00:00'),
      gender: {
        man: Number(mapped.genderMan) || 0,
        woman: Number(mapped.genderWoman) || 0,
        unknown: Number(mapped.genderUnknown) || 0
      },
      age: {
        '0-9': Number(mapped.age0_9) || 0,
        '10-16': Number(mapped.age10_16) || 0,
        '17-30': Number(mapped.age17_30) || 0,
        '31-45': Number(mapped.age31_45) || 0,
        '46-60': Number(mapped.age46_60) || 0,
        '60+': Number(mapped.age60plus) || 0,
        'unknown': Number(mapped.ageUnknown) || 0
      },
      ageHeavy: {
        '0-9': Number(mapped.heavyAge0_9) || 0,
        '10-16': Number(mapped.heavyAge10_16) || 0,
        '17-30': Number(mapped.heavyAge17_30) || 0,
        '31-45': Number(mapped.heavyAge31_45) || 0,
        '46-60': Number(mapped.heavyAge46_60) || 0,
        '60+': Number(mapped.heavyAge60plus) || 0,
        'unknown': Number(mapped.heavyAgeUnknown) || 0
      },
      passengerFlow: {
        yesterday: {
          value: Number(mapped.flowYesterday) || 0,
          chainIndex: Number(mapped.chainIndexYesterday) || 0,
          yoy: Number(mapped.yoyYesterday) || 0
        },
        lastWeek: {
          value: Number(mapped.flowWeek) || 0,
          chainIndex: Number(mapped.chainIndexWeek) || 0,
          yoy: Number(mapped.yoyWeek) || 0
        },
        lastMonth: {
          value: Number(mapped.flowMonth) || 0,
          chainIndex: Number(mapped.chainIndexMonth) || 0,
          yoy: Number(mapped.yoyMonth) || 0
        },
        thisYear: {
          value: Number(mapped.flowYear) || 0,
          chainIndex: Number(mapped.chainIndexYear) || 0
        }
      },
      uploadedFile: filename,
      rowIndex: index + 2
    };
  });

  return {
    totalRows: records.length,
    records,
    unmappedHeaders: originalHeaders.filter(h => !headerMapping[h])
  };
}

module.exports = { parseExcelFile, parseExcelBuffer };
