const express = require('express');
const {
  getStops,
  getStopByCode,
  createStop,
  updateStop,
  deleteStop,
  permanentDeleteStop,
  toStopCode
} = require('../config/firebase');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stops = await getStops();
    res.json({ success: true, data: stops });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:stopCode', async (req, res) => {
  try {
    const stop = await getStopByCode(req.params.stopCode);
    if (!stop) {
      return res.status(404).json({ success: false, error: 'Marquesina no encontrada' });
    }
    res.json({ success: true, data: stop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = {
      stopCode: toStopCode(req.body.stopCode || req.body.code, req.body.name),
      name: req.body.name,
      location: req.body.location,
      zone: req.body.zone,
      municipality: req.body.municipality,
      photos: Array.isArray(req.body.photos) ? req.body.photos : [],
      notes: req.body.notes,
      installedAt: req.body.installedAt,
      status: req.body.status,
      latitude: req.body.latitude,
      longitude: req.body.longitude
    };

    if (!payload.stopCode || payload.stopCode === 'SIN_ENTIDAD') {
      return res.status(400).json({ success: false, error: 'El código de marquesina es obligatorio' });
    }

    if (!payload.name || !String(payload.name).trim()) {
      return res.status(400).json({ success: false, error: 'El nombre/ubicación de la marquesina es obligatorio' });
    }

    const created = await createStop(payload);
    res.status(201).json({ success: true, data: created, message: 'Marquesina creada correctamente' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:stopCode', async (req, res) => {
  try {
    const updated = await updateStop(req.params.stopCode, {
      name: req.body.name,
      location: req.body.location,
      zone: req.body.zone,
      municipality: req.body.municipality,
      photos: Array.isArray(req.body.photos) ? req.body.photos : undefined,
      notes: req.body.notes,
      installedAt: req.body.installedAt,
      status: req.body.status,
      latitude: req.body.latitude,
      longitude: req.body.longitude
    });

    res.json({ success: true, data: updated, message: 'Marquesina actualizada correctamente' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:stopCode', async (req, res) => {
  try {
    await deleteStop(req.params.stopCode);
    res.json({ success: true, message: 'Marquesina desactivada correctamente' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:stopCode/permanent', async (req, res) => {
  try {
    const result = await permanentDeleteStop(req.params.stopCode);
    res.json({
      success: true,
      message: 'Marquesina y todos sus datos eliminados permanentemente',
      deleted: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
