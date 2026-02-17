import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  getReportTemplates,
  listReports,
  getReportById,
  generateReport,
} from '../services/api';

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function buildDefaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { startDate: formatISODate(start), endDate: formatISODate(end) };
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-ES').format(value || 0);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('es-ES');
}

function reportTypeLabel(type) {
  if (type === 'stop') return 'Por Marquesina';
  if (type === 'multi') return 'Multi-Marquesina';
  if (type === 'executive') return 'Resumen Ejecutivo';
  return type;
}

function downloadExcel(report) {
  const payload = report?.dataSnapshot || {};
  const rows = [];

  if (payload.type === 'stop') {
    rows.push(['Tipo', 'Informe por marquesina']);
    rows.push(['Marquesina', payload.stopCode || '']);
    rows.push(['Periodo', `${payload?.period?.startDate || ''} - ${payload?.period?.endDate || ''}`]);
    rows.push(['Total', payload?.kpis?.total || 0]);
    rows.push(['Media diaria', payload?.kpis?.dailyAvg || 0]);
    rows.push(['Pico diario', payload?.kpis?.peakDay?.total || 0]);
    rows.push(['Pico fecha', payload?.kpis?.peakDay?.date || '']);
    rows.push(['Pico hora', payload?.kpis?.peakDay?.hour || '']);
    rows.push([]);
    rows.push(['Fecha', 'Total']);
    for (const item of payload.dailyTrend || []) {
      rows.push([item.date, item.total || 0]);
    }
  }

  if (payload.type === 'multi') {
    rows.push(['Tipo', 'Informe multi-marquesina']);
    rows.push(['Periodo', `${payload?.period?.startDate || ''} - ${payload?.period?.endDate || ''}`]);
    rows.push(['Total global', payload?.kpis?.total || 0]);
    rows.push(['Media global', payload?.kpis?.dailyAvg || 0]);
    rows.push([]);
    rows.push(['Marquesina', 'Total', 'Media diaria']);
    for (const item of payload.comparisons || []) {
      rows.push([item.stopCode, item.total || 0, item.dailyAvg || 0]);
    }
  }

  if (payload.type === 'executive') {
    rows.push(['Tipo', 'Resumen ejecutivo']);
    rows.push(['Periodo', `${payload?.period?.startDate || ''} - ${payload?.period?.endDate || ''}`]);
    rows.push(['Total actual', payload?.kpis?.currentTotal || 0]);
    rows.push(['Total anterior', payload?.kpis?.previousTotal || 0]);
    rows.push(['Variación abs', payload?.kpis?.variationAbs || 0]);
    rows.push(['Variación %', payload?.kpis?.variationPct ?? '']);
    rows.push([]);
    rows.push(['Insights']);
    for (const insight of payload.insights || []) {
      rows.push([insight]);
    }
  }

  const content = rows
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join('\t'))
    .join('\n');

  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(report?.name || 'informe').replace(/\s+/g, '_').toLowerCase()}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function drawLine(doc, text, y, opts = {}) {
  doc.setFontSize(opts.size || 11);
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.text(String(text), 14, y);
  return y + (opts.spacing || 6);
}

function downloadPdf(report) {
  const payload = report?.dataSnapshot || {};
  const doc = new jsPDF();
  let y = 16;

  y = drawLine(doc, 'Afluencia360 - Informe', y, { size: 16, bold: true, spacing: 8 });
  y = drawLine(doc, reportTypeLabel(payload.type), y, { size: 12, bold: true, spacing: 7 });
  y = drawLine(doc, `Periodo: ${payload?.period?.startDate || ''} a ${payload?.period?.endDate || ''}`, y);
  y += 2;

  if (payload.type === 'stop') {
    y = drawLine(doc, `Marquesina: ${payload.stopCode || ''}`, y, { bold: true });
    y = drawLine(doc, `Total: ${formatNumber(payload?.kpis?.total || 0)}`, y);
    y = drawLine(doc, `Media diaria: ${formatNumber(payload?.kpis?.dailyAvg || 0)}`, y);
    y = drawLine(doc, `Pico: ${formatNumber(payload?.kpis?.peakDay?.total || 0)} (${payload?.kpis?.peakDay?.date || '—'})`, y);
    y = drawLine(doc, `Edad dominante: ${payload?.topAgeBand || '—'}`, y);
    y += 3;
    y = drawLine(doc, 'Alertas del periodo:', y, { bold: true });
    const alerts = payload.alerts || [];
    if (alerts.length === 0) {
      y = drawLine(doc, '- Sin alertas en el periodo.', y);
    } else {
      for (const alert of alerts.slice(0, 10)) {
        y = drawLine(doc, `- [${alert.severity}] ${alert.type} · ${alert.message}`, y);
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      }
    }
  }

  if (payload.type === 'multi') {
    y = drawLine(doc, `Total global: ${formatNumber(payload?.kpis?.total || 0)}`, y);
    y = drawLine(doc, `Media global: ${formatNumber(payload?.kpis?.dailyAvg || 0)}`, y);
    y += 3;
    y = drawLine(doc, 'Top marquesinas:', y, { bold: true });
    for (const item of (payload?.ranking?.top || []).slice(0, 10)) {
      y = drawLine(doc, `- ${item.stopCode}: ${formatNumber(item.total)} (media ${formatNumber(item.dailyAvg)})`, y);
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
  }

  if (payload.type === 'executive') {
    y = drawLine(doc, `Total actual: ${formatNumber(payload?.kpis?.currentTotal || 0)}`, y);
    y = drawLine(doc, `Total anterior: ${formatNumber(payload?.kpis?.previousTotal || 0)}`, y);
    y = drawLine(doc, `Variación: ${payload?.kpis?.variationPct === null || payload?.kpis?.variationPct === undefined ? '—' : `${payload.kpis.variationPct.toFixed(1)}%`}`, y);
    y += 3;
    y = drawLine(doc, 'Insights automáticos:', y, { bold: true });
    for (const insight of payload.insights || []) {
      y = drawLine(doc, `- ${insight}`, y);
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
  }

  doc.save(`${(report?.name || 'informe').replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

export default function ReportsDashboard({ stops = [] }) {
  const [activeTab, setActiveTab] = useState('create');
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [reportType, setReportType] = useState('stop');
  const [dateRange, setDateRange] = useState(buildDefaultRange);
  const [selectedStopCode, setSelectedStopCode] = useState('');
  const [selectedStopCodes, setSelectedStopCodes] = useState([]);
  const [comparePrevious, setComparePrevious] = useState(true);
  const [notes, setNotes] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const templateOptions = useMemo(
    () => templates.filter((item) => item.reportType === reportType),
    [templates, reportType]
  );

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const [templatesResponse, historyResponse] = await Promise.all([
          getReportTemplates(),
          listReports(),
        ]);
        setTemplates(Array.isArray(templatesResponse?.data) ? templatesResponse.data : []);
        setHistory(Array.isArray(historyResponse?.data) ? historyResponse.data : []);
      } catch {
        setError('No se pudieron cargar plantillas e historial de informes.');
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, []);

  useEffect(() => {
    if (templateOptions.length > 0) {
      setSelectedTemplateId(templateOptions[0].id);
    } else {
      setSelectedTemplateId('');
    }
  }, [templateOptions]);

  const refreshHistory = async () => {
    const response = await listReports();
    setHistory(Array.isArray(response?.data) ? response.data : []);
  };

  const toggleStopMulti = (stopCode) => {
    setSelectedStopCodes((prev) => (
      prev.includes(stopCode)
        ? prev.filter((item) => item !== stopCode)
        : [...prev, stopCode]
    ));
  };

  const handleGenerate = async (format) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: reportType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        comparePrevious,
        generatedBy: 'admin',
        format,
        templateId: selectedTemplateId || null,
        notes,
      };

      if (reportType === 'stop') {
        if (!selectedStopCode) throw new Error('Selecciona una marquesina');
        payload.stopCode = selectedStopCode;
      } else {
        if (selectedStopCodes.length === 0) throw new Error('Selecciona al menos una marquesina');
        payload.stopCodes = selectedStopCodes;
      }

      const response = await generateReport(payload);
      const report = response?.data;

      if (!report) throw new Error('No se pudo generar el informe');
      if (format === 'pdf') {
        downloadPdf(report);
      } else {
        downloadExcel(report);
      }

      await refreshHistory();
      setActiveTab('history');
    } catch (err) {
      setError(err?.message || 'No se pudo generar el informe.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadHistory = async (reportId, format) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getReportById(reportId);
      const report = response?.data;
      if (!report) throw new Error('Informe no encontrado');

      if (format === 'pdf') {
        downloadPdf(report);
      } else {
        downloadExcel(report);
      }
    } catch {
      setError('No se pudo descargar el informe del historial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-6 space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <button className={`pc-action-btn h-8 px-3 ${activeTab === 'create' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setActiveTab('create')}>
            Crear informe
          </button>
          <button className={`pc-action-btn h-8 px-3 ${activeTab === 'history' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setActiveTab('history')}>
            Historial
          </button>
        </div>
      </section>

      {error && (
        <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded px-3 py-2">
          {error}
        </div>
      )}

      {activeTab === 'create' ? (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button className={`pc-action-btn h-8 px-3 ${reportType === 'stop' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setReportType('stop')}>
              Por Marquesina
            </button>
            <button className={`pc-action-btn h-8 px-3 ${reportType === 'multi' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setReportType('multi')}>
              Multi-Marquesina
            </button>
            <button className={`pc-action-btn h-8 px-3 ${reportType === 'executive' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setReportType('executive')}>
              Resumen Ejecutivo
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Inicio</label>
              <input className="w-full h-9 border border-gray-300 rounded px-2 text-sm" type="date" value={dateRange.startDate} onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Fin</label>
              <input className="w-full h-9 border border-gray-300 rounded px-2 text-sm" type="date" value={dateRange.endDate} onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Plantilla</label>
              <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                {templateOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <label className="text-sm text-gray-700 flex items-center gap-2 mt-5">
              <input type="checkbox" checked={comparePrevious} onChange={(e) => setComparePrevious(e.target.checked)} />
              Comparar con periodo anterior
            </label>
          </div>

          {reportType === 'stop' ? (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Marquesina</label>
              <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={selectedStopCode} onChange={(e) => setSelectedStopCode(e.target.value)}>
                <option value="">Selecciona una marquesina</option>
                {stops.map((stop) => (
                  <option key={stop.stopCode} value={stop.stopCode}>{stop.stopCode} — {stop.name || stop.location || 'Sin nombre'}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Marquesinas ({selectedStopCodes.length})</label>
              <div className="border border-gray-300 rounded p-2 max-h-28 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
                {stops.map((stop) => (
                  <label key={stop.stopCode} className="text-xs text-gray-700 flex items-center gap-2">
                    <input type="checkbox" checked={selectedStopCodes.includes(stop.stopCode)} onChange={() => toggleStopMulti(stop.stopCode)} />
                    <span className="truncate">{stop.stopCode} — {stop.name || stop.location || 'Sin nombre'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {reportType === 'stop' && (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Notas / observaciones</label>
              <textarea className="w-full min-h-20 border border-gray-300 rounded px-2 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones para el informe" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button className="pc-action-btn h-9" disabled={loading} onClick={() => handleGenerate('pdf')}>
              {loading ? 'Generando...' : 'Generar PDF'}
            </button>
            <button className="pc-action-btn h-9" disabled={loading} onClick={() => handleGenerate('excel')}>
              {loading ? 'Generando...' : 'Generar Excel'}
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">{history.length} informes generados</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">Nombre</th>
                  <th className="text-left px-3 py-2">Periodo</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Usuario</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-right px-3 py-2">Descargas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-800">{item.name}</td>
                    <td className="px-3 py-2">{formatDate(item?.filters?.startDate)} — {formatDate(item?.filters?.endDate)}</td>
                    <td className="px-3 py-2">{reportTypeLabel(item.type)}</td>
                    <td className="px-3 py-2">{item.generatedBy || 'admin'}</td>
                    <td className="px-3 py-2">{new Date(item.generatedAt).toLocaleString('es-ES', { hour12: false })}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button className="pc-action-btn h-7 px-2" onClick={() => handleDownloadHistory(item.id, 'pdf')}>
                          PDF
                        </button>
                        <button className="pc-action-btn h-7 px-2" onClick={() => handleDownloadHistory(item.id, 'excel')}>
                          Excel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && history.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-gray-500" colSpan={6}>No hay informes generados todavía.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
