const express = require('express');
const {
  getReportTemplates,
  listReports,
  getReportById,
  generateReport,
} = require('../config/firebase');

const router = express.Router();

router.get('/templates', async (req, res) => {
  try {
    const templates = await getReportTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const reports = await listReports();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Informe no encontrado' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const report = await generateReport({
      type: req.body?.type,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      stopCode: req.body?.stopCode,
      stopCodes: Array.isArray(req.body?.stopCodes) ? req.body.stopCodes : [],
      comparePrevious: !!req.body?.comparePrevious,
      generatedBy: req.body?.generatedBy || 'admin',
      format: req.body?.format || 'pdf',
      templateId: req.body?.templateId || null,
      notes: req.body?.notes || '',
    });

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
