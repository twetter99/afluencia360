/**
 * Genera un archivo Excel de plantilla para Afluencia360.
 * Ejecutar: node utils/generateTemplate.js
 */
const XLSX = require('xlsx');
const path = require('path');

const headers = [
  'Fecha',
  'Código Marquesina',
  'Entidad',
  'Adultos',
  'Niños',
  'Deduplicados',
  'Número Total',
  'Empleados Heavy',
  'Tiempo Residencia',
  'Género Hombre',
  'Género Mujer',
  'Género Desconocido',
  'Edad 0-9',
  'Edad 10-16',
  'Edad 17-30',
  'Edad 31-45',
  'Edad 46-60',
  'Edad 60+',
  'Edad Desconocido',
  'Heavy Edad 0-9',
  'Heavy Edad 10-16',
  'Heavy Edad 17-30',
  'Heavy Edad 31-45',
  'Heavy Edad 46-60',
  'Heavy Edad 60+',
  'Heavy Edad Desconocido',
  'Flujo Ayer',
  'Chain Index Ayer',
  'YOY Ayer',
  'Flujo Semana',
  'Chain Index Semana',
  'YOY Semana',
  'Flujo Mes',
  'Chain Index Mes',
  'YOY Mes',
  'Flujo Año',
  'Chain Index Año'
];

// Datos de ejemplo basados en las capturas del sistema real
const sampleData = [
  {
    'Fecha': '2026-02-11',
    'Código Marquesina': 'MARQ_ARANJUEZ_001',
    'Entidad': 'Marquesinas Aranjuez',
    'Adultos': 6409,
    'Niños': 1616,
    'Deduplicados': 1050,
    'Número Total': 9811,
    'Empleados Heavy': 0,
    'Tiempo Residencia': '02:13:31',
    'Género Hombre': 3670,
    'Género Mujer': 2753,
    'Género Desconocido': 2372,
    'Edad 0-9': 0,
    'Edad 10-16': 1,
    'Edad 17-30': 2909,
    'Edad 31-45': 2039,
    'Edad 46-60': 1339,
    'Edad 60+': 135,
    'Edad Desconocido': 2372,
    'Heavy Edad 0-9': 0,
    'Heavy Edad 10-16': 0,
    'Heavy Edad 17-30': 481,
    'Heavy Edad 31-45': 318,
    'Heavy Edad 46-60': 236,
    'Heavy Edad 60+': 15,
    'Heavy Edad Desconocido': 0,
    'Flujo Ayer': 625,
    'Chain Index Ayer': -46.90,
    'YOY Ayer': -60.91,
    'Flujo Semana': 5016,
    'Chain Index Semana': 100.00,
    'YOY Semana': 213.70,
    'Flujo Mes': 2,
    'Chain Index Mes': -98.43,
    'YOY Mes': 100.00,
    'Flujo Año': 8043,
    'Chain Index Año': 403.00
  },
  {
    'Fecha': '2026-02-12',
    'Código Marquesina': 'MARQ_ARANJUEZ_001',
    'Entidad': 'Marquesinas Aranjuez',
    'Adultos': 0,
    'Niños': 0,
    'Deduplicados': 0,
    'Número Total': 0,
    'Empleados Heavy': 0,
    'Tiempo Residencia': '00:00:00',
    'Género Hombre': 0,
    'Género Mujer': 0,
    'Género Desconocido': 0,
    'Edad 0-9': 0,
    'Edad 10-16': 0,
    'Edad 17-30': 0,
    'Edad 31-45': 0,
    'Edad 46-60': 0,
    'Edad 60+': 0,
    'Edad Desconocido': 0,
    'Heavy Edad 0-9': 0,
    'Heavy Edad 10-16': 0,
    'Heavy Edad 17-30': 0,
    'Heavy Edad 31-45': 0,
    'Heavy Edad 46-60': 0,
    'Heavy Edad 60+': 0,
    'Heavy Edad Desconocido': 0,
    'Flujo Ayer': 0,
    'Chain Index Ayer': 0,
    'YOY Ayer': 0,
    'Flujo Semana': 0,
    'Chain Index Semana': 0,
    'YOY Semana': 0,
    'Flujo Mes': 0,
    'Chain Index Mes': 0,
    'YOY Mes': 0,
    'Flujo Año': 0,
    'Chain Index Año': 0
  }
];

// Crear workbook
const wb = XLSX.utils.book_new();

// Hoja de datos
const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });

// Ajustar ancho de columnas
const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));
ws['!cols'] = colWidths;

XLSX.utils.book_append_sheet(wb, ws, 'Datos Afluencia');

// Hoja de instrucciones
const instructions = [
  ['PLANTILLA AFLUENCIA360 - INSTRUCCIONES'],
  [''],
  ['Esta plantilla se usa para cargar datos de afluencia al dashboard.'],
  [''],
  ['FORMATO DE COLUMNAS:'],
  ['Fecha', 'Formato YYYY-MM-DD (ej: 2026-02-11)'],
  ['Código Marquesina', 'Código único de la marquesina (ej: MARQ_ARANJUEZ_001)'],
  ['Entidad', 'Nombre de la ubicación (ej: Marquesinas Aranjuez)'],
  ['Adultos', 'Número de adultos detectados'],
  ['Niños', 'Número de niños detectados'],
  ['Deduplicados', 'Número después de deduplicación'],
  ['Número Total', 'Total de personas'],
  ['Empleados Heavy', 'Visitantes frecuentes (empleados)'],
  ['Tiempo Residencia', 'Formato HH:MM:SS'],
  ['Género *', 'Hombre, Mujer, Desconocido'],
  ['Edad *', 'Rangos: 0-9, 10-16, 17-30, 31-45, 46-60, 60+, Desconocido'],
  ['Heavy Edad *', 'Visitantes frecuentes por rango de edad'],
  ['Flujo *', 'KPI de flujo de pasajeros'],
  ['Chain Index / YOY', 'Porcentaje (ej: -46.90 para -46.90%)'],
  [''],
  ['NOTAS:'],
  ['- Puedes agregar una fila por día y por entidad'],
  ['- Los datos se acumularán en el dashboard'],
  ['- Las columnas de Chain Index y YOY son porcentajes (sin símbolo %)'],
  ['- Puedes tener varias entidades en el mismo archivo']
];

const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
wsInstr['!cols'] = [{ wch: 25 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

// Guardar
const outputPath = path.join(__dirname, '..', 'plantilla_afluencia360.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`✅ Plantilla generada: ${outputPath}`);
