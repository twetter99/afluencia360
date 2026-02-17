const express = require('express');
const cors = require('cors');
const uploadRoutes = require('./routes/upload');
const dataRoutes = require('./routes/data');
const stopsRoutes = require('./routes/stops');
const marquesinaRoutes = require('./routes/marquesina');
const alertsRoutes = require('./routes/alerts');
const reportsRoutes = require('./routes/reports');
const integrationsRoutes = require('./routes/integrations');

const app = express();

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://app.afluencia360.com',
  'https://afluencia360.vercel.app',
  /\.vercel\.app$/
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origin (curl, serverless, etc.)
    if (!origin) return callback(null, true);
    // Comprobar lista de orígenes permitidos
    const allowed = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    callback(null, allowed);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/stops', stopsRoutes);
app.use('/api/marquesina', marquesinaRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/integrations', integrationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
