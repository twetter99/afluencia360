const express = require('express');
const {
  getRecords,
  getEntities,
  getStops,
  getLatestRecord,
  deleteRecord,
  getSummary,
  getDashboardCards,
  getDashboardByStop,
  getAggregateDashboard,
  getCompareDashboard,
  toStopCode
} = require('../config/firebase');

const router = express.Router();

router.get('/entities', async (req, res) => {
  try {
    const entities = await getEntities();
    res.json({ success: true, data: entities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stops', async (req, res) => {
  try {
    const stops = await getStops();
    res.json({ success: true, data: stops });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records', async (req, res) => {
  try {
    const { entity, stopCode, stopCodes, startDate, endDate, limit } = req.query;
    const filters = {};

    if (entity) filters.entity = entity;
    if (stopCode) filters.stopCode = stopCode;
    if (stopCodes) filters.stopCodes = String(stopCodes).split(',').map(s => s.trim()).filter(Boolean);
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (limit) filters.limit = parseInt(limit, 10);

    const records = await getRecords(filters);
    res.json({
      success: true,
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/latest/:stopCode', async (req, res) => {
  try {
    const record = await getLatestRecord(decodeURIComponent(req.params.stopCode));
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron registros para esta marquesina'
      });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { stopCode, entity, startDate, endDate } = req.query;
    const resolvedStopCode = stopCode || entity;

    if (!resolvedStopCode) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el parámetro "stopCode"'
      });
    }

    const summary = await getSummary(toStopCode(resolvedStopCode), startDate, endDate);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'No hay datos para los filtros seleccionados'
      });
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/records/:id', async (req, res) => {
  try {
    await deleteRecord(req.params.id);
    res.json({ success: true, message: 'Registro eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard/cards', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const cards = await getDashboardCards(startDate, endDate);
    res.json({ success: true, data: cards });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard/aggregate', async (req, res) => {
  try {
    const { stopCodes, startDate, endDate, limit } = req.query;

    if (!stopCodes) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere stopCodes (CSV)'
      });
    }

    const codes = String(stopCodes).split(',').map(s => s.trim()).filter(Boolean);
    const aggregate = await getAggregateDashboard(codes, startDate, endDate, limit ? parseInt(limit, 10) : 90);
    res.json({ success: true, data: aggregate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard/compare', async (req, res) => {
  try {
    const { stopCodes, startDate, endDate, limit } = req.query;

    if (!stopCodes) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere stopCodes (CSV)'
      });
    }

    const codes = String(stopCodes).split(',').map(s => s.trim()).filter(Boolean);
    const compare = await getCompareDashboard(codes, startDate, endDate, limit ? parseInt(limit, 10) : 90);
    res.json({ success: true, data: compare });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard/:stopCode', async (req, res) => {
  try {
    const stopCode = decodeURIComponent(req.params.stopCode);
    const { startDate, endDate, limit } = req.query;

    const data = await getDashboardByStop(
      toStopCode(stopCode),
      startDate,
      endDate,
      limit ? parseInt(limit, 10) : 90
    );

    if (!data.summary && (!data.records || data.records.length === 0)) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron datos para esta marquesina'
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
