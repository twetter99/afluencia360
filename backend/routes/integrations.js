const express = require('express');
const {
  getCrtmConfig,
  updateCrtmConfig,
  getCrtmDatasets,
  executeCrtmExport,
  listCrtmRuns,
  getCrtmRunById,
} = require('../config/firebase');

const router = express.Router();

router.get('/crtm/config', async (req, res) => {
  try {
    const config = await getCrtmConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/crtm/config', async (req, res) => {
  try {
    const updated = await updateCrtmConfig(req.body || {});
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/crtm/datasets', async (req, res) => {
  try {
    const datasets = getCrtmDatasets();
    res.json({ success: true, data: datasets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/crtm/execute', async (req, res) => {
  try {
    const run = await executeCrtmExport({
      datasetId: req.body?.datasetId,
      rangePreset: req.body?.rangePreset,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      retry: !!req.body?.retry,
      requestedBy: req.body?.requestedBy || 'admin',
    });
    res.json({ success: true, data: run });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/crtm/runs', async (req, res) => {
  try {
    const runs = await listCrtmRuns();
    res.json({ success: true, data: runs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/crtm/runs/:id', async (req, res) => {
  try {
    const run = await getCrtmRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, error: 'Ejecución no encontrada' });
    }
    res.json({ success: true, data: run });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/crtm/runs/:id/download', async (req, res) => {
  try {
    const run = await getCrtmRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, error: 'Ejecución no encontrada' });
    }

    const contentType = run.format === 'JSON'
      ? 'application/json; charset=utf-8'
      : 'text/csv; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${run.filename || `export_${run.id}.txt`}"`);
    res.send(run.payload || '');
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
