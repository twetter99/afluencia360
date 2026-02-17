// ─── Vercel Serverless Function — envuelve el backend Express ───

// En Vercel, dotenv no es necesario (las env vars se configuran en el dashboard)
// En local, se carga desde backend/.env
try {
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
} catch (_) {
  // dotenv no disponible — OK en Vercel
}

const app = require('../backend/app');

module.exports = app;
