const express = require('express');
const {
  saveMarquesinaDay,
  getMarquesinaDay,
  getMarquesinaRange,
  getMarquesinaLatest
} = require('../config/firebase');

const router = express.Router();

// GET /api/marquesina/latest — Último día disponible
router.get('/latest', async (req, res) => {
  try {
    const { location } = req.query;
    const data = await getMarquesinaLatest(location);
    if (!data) {
      return res.status(404).json({ success: false, error: 'No hay datos de marquesina disponibles' });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/marquesina/analytics — Datos agregados para dashboard analítico
// Query: location (obligatorio), mode=day|range, date (si day), from/to (si range)
router.get('/analytics', async (req, res) => {
  try {
    const { location, mode, date, from, to } = req.query;
    if (!location) {
      return res.status(400).json({ success: false, error: 'El parámetro "location" es obligatorio' });
    }

    // ── Modo DÍA ──────────────────────────────────────────
    if (mode === 'day') {
      if (!date) {
        return res.status(400).json({ success: false, error: 'Se requiere "date" en modo día' });
      }
      const dayData = await getMarquesinaDay(date, location);
      if (!dayData) {
        return res.json({
          success: true,
          mode: 'day',
          kpis: { totalPeriod: 0, dailyAvg: 0, peakMax: 0, peakDate: date, peakHour: null, peakHourValue: 0, daysInRange: 1, daysWithData: 0, coveragePct: 0 },
          dailySummaries: [{ date, totalDetected: null, peakHour: null, peakValue: null, hasData: false }],
          hourlyAggregate: [],
          dayDetail: null
        });
      }

      const totalDetected = dayData.summary?.total_detected || 0;
      const hourly = dayData.hourly || [];
      let peakHour = null;
      let peakHourValue = 0;
      const hourlyAggregate = hourly.map(h => {
        const det = h.detected || 0;
        if (det > peakHourValue) { peakHourValue = det; peakHour = h.hour; }
        return {
          hour: h.hour,
          detected: det,
          peopleIn: h.people_in || 0,
          peopleOut: h.people_out || 0,
          passby: h.passby || 0,
          deduplicated: h.deduplicated || 0,
          entryLot: h.entry_lot || 0,
          outgoingBatch: h.outgoing_batch || 0,
        };
      });

      return res.json({
        success: true,
        mode: 'day',
        kpis: {
          totalPeriod: totalDetected,
          dailyAvg: totalDetected,
          peakMax: totalDetected,
          peakDate: date,
          peakHour,
          peakHourValue,
          daysInRange: 1,
          daysWithData: 1,
          coveragePct: 100
        },
        dailySummaries: [{
          date,
          totalDetected,
          peakHour,
          peakValue: peakHourValue,
          deduplicated: dayData.summary?.deduplicated || 0,
          avgDwell: dayData.summary?.avg_dwell_minutes || 0,
          hasData: true
        }],
        hourlyAggregate,
        dayDetail: dayData
      });
    }

    // ── Modo RANGO ────────────────────────────────────────
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Se requieren "from" y "to" en modo rango' });
    }

    const docs = await getMarquesinaRange(from, to, location);
    const docsByDate = {};
    for (const doc of docs) {
      if (doc.meta?.date) docsByDate[doc.meta.date] = doc;
    }

    // Generar todos los días del rango
    const dailySummaries = [];
    let totalPeriod = 0;
    let daysWithData = 0;
    let peakMax = 0;
    let peakDate = null;
    let globalPeakHour = null;
    let globalPeakHourValue = 0;

    const startDate = new Date(from + 'T00:00:00');
    const endDate = new Date(to + 'T00:00:00');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const doc = docsByDate[dateStr];

      if (doc) {
        const det = doc.summary?.total_detected || 0;
        daysWithData++;
        totalPeriod += det;

        // Calcular pico horario del día
        let dayPeakHour = null;
        let dayPeakValue = 0;
        if (doc.hourly) {
          for (const h of doc.hourly) {
            const hDet = h.detected || 0;
            if (hDet > dayPeakValue) { dayPeakValue = hDet; dayPeakHour = h.hour; }
          }
        }

        if (det > peakMax) {
          peakMax = det;
          peakDate = dateStr;
        }
        if (dayPeakValue > globalPeakHourValue) {
          globalPeakHourValue = dayPeakValue;
          globalPeakHour = dayPeakHour;
        }

        dailySummaries.push({
          date: dateStr,
          totalDetected: det,
          peakHour: dayPeakHour,
          peakValue: dayPeakValue,
          deduplicated: doc.summary?.deduplicated || 0,
          avgDwell: doc.summary?.avg_dwell_minutes || 0,
          hasData: true
        });
      } else {
        dailySummaries.push({
          date: dateStr,
          totalDetected: null,
          peakHour: null,
          peakValue: null,
          deduplicated: null,
          avgDwell: null,
          hasData: false
        });
      }
    }

    const daysInRange = dailySummaries.length;
    const coveragePct = daysInRange > 0 ? Math.round((daysWithData / daysInRange) * 100) : 0;
    const dailyAvg = daysWithData > 0 ? Math.round(totalPeriod / daysWithData) : 0;

    return res.json({
      success: true,
      mode: 'range',
      kpis: {
        totalPeriod,
        dailyAvg,
        peakMax,
        peakDate,
        peakHour: globalPeakHour,
        peakHourValue: globalPeakHourValue,
        daysInRange,
        daysWithData,
        coveragePct
      },
      dailySummaries,
      hourlyAggregate: null,
      dayDetail: null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/marquesina/range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/range', async (req, res) => {
  try {
    const { from, to, location } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'Se requieren parámetros "from" y "to" (YYYY-MM-DD)' });
    }
    const data = await getMarquesinaRange(from, to, location);
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/marquesina/:date — Datos de un día concreto
router.get('/:date', async (req, res) => {
  try {
    const { location } = req.query;
    const data = await getMarquesinaDay(req.params.date, location);
    if (!data) {
      return res.status(404).json({ success: false, error: `No hay datos para ${req.params.date}` });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
