const express = require('express');
const {
  recomputeOperationalAlerts,
  getAlerts,
  acknowledgeAlert,
  resolveAlert
} = require('../config/firebase');

const router = express.Router();

router.post('/recompute', async (req, res) => {
  try {
    const stopCodes = Array.isArray(req.body?.stopCodes)
      ? req.body.stopCodes.map((item) => String(item).trim()).filter(Boolean)
      : [];

    const alerts = await recomputeOperationalAlerts({ stopCodes });
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, severity, search, range } = req.query;
    const alerts = await getAlerts({ status, severity, search, range });
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/ack', async (req, res) => {
  try {
    const user = req.body?.user || 'admin';
    const updated = await acknowledgeAlert(req.params.id, user);
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.message === 'Alerta no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/resolve', async (req, res) => {
  try {
    const user = req.body?.user || 'admin';
    const updated = await resolveAlert(req.params.id, user);
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.message === 'Alerta no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
