import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { getAggregateDashboard, getCompareDashboard } from '../services/api';

const AGE_KEYS = ['0-9', '10-16', '17-30', '31-45', '46-60', '60+'];

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-ES').format(value || 0);
}

function formatPct(value) {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function buildDefaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    startDate: formatISODate(start),
    endDate: formatISODate(end),
  };
}

function getDaysInRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 1;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function getPreviousRange(startDate, endDate) {
  const days = getDaysInRange(startDate, endDate);
  const start = new Date(`${startDate}T00:00:00`);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));

  return {
    startDate: formatISODate(prevStart),
    endDate: formatISODate(prevEnd),
  };
}

function getDailyPeak(records = []) {
  return records.reduce((maxValue, row) => {
    const total = row?.totals?.totalNumber || 0;
    return Math.max(maxValue, total);
  }, 0);
}

function getVariationPct(currentValue, previousValue) {
  if (!previousValue) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}

function getAgeMainSegment(age = {}) {
  const sorted = AGE_KEYS
    .map((key) => ({ key, value: age[key] || 0 }))
    .sort((a, b) => b.value - a.value);

  return sorted[0]?.value ? sorted[0].key : '—';
}

function mapCompareByStop(data) {
  const map = new Map();
  for (const item of data?.comparisons || []) {
    map.set(item.stopCode, item);
  }
  return map;
}

function exportRowsToExcel(rows, filename) {
  if (!rows?.length) return;

  const headers = Object.keys(rows[0]);
  const separator = '\t';
  const content = [
    headers,
    ...rows.map((row) => headers.map((key) => row[key]))
  ]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(separator))
    .join('\n');

  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ComparisonTable({ rows }) {
  if (!rows.length) {
    return <div className="text-sm text-gray-500 py-6">No hay datos para mostrar.</div>;
  }

  return (
    <div className="overflow-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="text-left px-3 py-2">Marquesina</th>
            <th className="text-right px-3 py-2">Total</th>
            <th className="text-right px-3 py-2">Media diaria</th>
            <th className="text-right px-3 py-2">Máximo diario</th>
            <th className="text-right px-3 py-2">Variación %</th>
            <th className="text-right px-3 py-2">Hombre %</th>
            <th className="text-right px-3 py-2">Mujer %</th>
            <th className="text-left px-3 py-2">Edad dominante</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stopCode} className="border-t border-gray-100">
              <td className="px-3 py-2 font-medium text-gray-800">{row.stopCode}</td>
              <td className="px-3 py-2 text-right">{formatNumber(row.total)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(row.dailyAvg)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(row.dailyPeak)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${row.variationPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPct(row.variationPct)}
              </td>
              <td className="px-3 py-2 text-right">{row.manShare}%</td>
              <td className="px-3 py-2 text-right">{row.womanShare}%</td>
              <td className="px-3 py-2">{row.topAgeBand}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparativesDashboard({ stops = [] }) {
  const [activeTab, setActiveTab] = useState('stops');
  const [dateRange, setDateRange] = useState(buildDefaultRange);
  const [selectedStopCodes, setSelectedStopCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stopsResult, setStopsResult] = useState(null);
  const [periodResult, setPeriodResult] = useState(null);

  const selectedCount = selectedStopCodes.length;

  const barsData = useMemo(() => (
    (stopsResult?.rows || []).map((row) => ({
      stopCode: row.stopCode,
      total: row.total,
      dailyAvg: row.dailyAvg,
      dailyPeak: row.dailyPeak,
    }))
  ), [stopsResult]);

  const periodCards = periodResult?.cards || {
    currentTotal: 0,
    previousTotal: 0,
    variationAbs: 0,
    variationPct: null,
  };

  const handleStopSelection = (stopCode) => {
    setSelectedStopCodes((prev) => (
      prev.includes(stopCode)
        ? prev.filter((item) => item !== stopCode)
        : [...prev, stopCode]
    ));
  };

  const handleCompare = async () => {
    if (!dateRange.startDate || !dateRange.endDate || selectedStopCodes.length === 0) {
      setError('Selecciona rango de fechas y al menos una marquesina.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const prevRange = getPreviousRange(dateRange.startDate, dateRange.endDate);

      if (activeTab === 'stops') {
        const [currentResponse, previousResponse] = await Promise.all([
          getCompareDashboard(selectedStopCodes, dateRange.startDate, dateRange.endDate),
          getCompareDashboard(selectedStopCodes, prevRange.startDate, prevRange.endDate),
        ]);

        const currentMap = mapCompareByStop(currentResponse.data);
        const previousMap = mapCompareByStop(previousResponse.data);

        const rows = selectedStopCodes.map((stopCode) => {
          const current = currentMap.get(stopCode);
          const previous = previousMap.get(stopCode);

          const currentTotal = current?.summary?.totals?.totalNumber || 0;
          const previousTotal = previous?.summary?.totals?.totalNumber || 0;
          const records = current?.records || [];
          const gender = current?.summary?.gender || {};
          const genderTotal = (gender.man || 0) + (gender.woman || 0) + (gender.unknown || 0);

          const manShare = genderTotal > 0 ? Math.round(((gender.man || 0) * 100) / genderTotal) : 0;
          const womanShare = genderTotal > 0 ? Math.round(((gender.woman || 0) * 100) / genderTotal) : 0;

          return {
            stopCode,
            total: currentTotal,
            dailyAvg: records.length ? Math.round(currentTotal / records.length) : 0,
            dailyPeak: getDailyPeak(records),
            variationPct: getVariationPct(currentTotal, previousTotal),
            manShare,
            womanShare,
            topAgeBand: getAgeMainSegment(current?.summary?.age),
          };
        });

        setStopsResult({
          rows,
          previousRange: prevRange,
        });
        setPeriodResult(null);
      }

      if (activeTab === 'period') {
        const [currentResponse, previousResponse, currentAggregate, previousAggregate] = await Promise.all([
          getCompareDashboard(selectedStopCodes, dateRange.startDate, dateRange.endDate),
          getCompareDashboard(selectedStopCodes, prevRange.startDate, prevRange.endDate),
          getAggregateDashboard(selectedStopCodes, dateRange.startDate, dateRange.endDate),
          getAggregateDashboard(selectedStopCodes, prevRange.startDate, prevRange.endDate),
        ]);

        const currentMap = mapCompareByStop(currentResponse.data);
        const previousMap = mapCompareByStop(previousResponse.data);

        const rows = selectedStopCodes.map((stopCode) => {
          const current = currentMap.get(stopCode);
          const previous = previousMap.get(stopCode);
          const currentTotal = current?.summary?.totals?.totalNumber || 0;
          const previousTotal = previous?.summary?.totals?.totalNumber || 0;

          return {
            stopCode,
            currentTotal,
            previousTotal,
            variationAbs: currentTotal - previousTotal,
            variationPct: getVariationPct(currentTotal, previousTotal),
          };
        });

        const currentTotal = currentAggregate?.data?.summary?.totals?.totalNumber || 0;
        const previousTotal = previousAggregate?.data?.summary?.totals?.totalNumber || 0;

        setPeriodResult({
          cards: {
            currentTotal,
            previousTotal,
            variationAbs: currentTotal - previousTotal,
            variationPct: getVariationPct(currentTotal, previousTotal),
          },
          rows,
          previousRange: prevRange,
        });
        setStopsResult(null);
      }

      if (activeTab === 'zone') {
        setStopsResult(null);
        setPeriodResult(null);
      }
    } catch {
      setError('No se pudo calcular la comparativa. Revisa filtros y disponibilidad de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'stops' && stopsResult?.rows?.length) {
      exportRowsToExcel(
        stopsResult.rows.map((row) => ({
          Marquesina: row.stopCode,
          Total: row.total,
          Media_diaria: row.dailyAvg,
          Maximo_diario: row.dailyPeak,
          Variacion_pct: row.variationPct === null ? '—' : row.variationPct.toFixed(2),
          Hombre_pct: row.manShare,
          Mujer_pct: row.womanShare,
          Edad_dominante: row.topAgeBand,
        })),
        `comparativa_marquesinas_${new Date().toISOString().slice(0, 10)}.xls`
      );
    }

    if (activeTab === 'period' && periodResult?.rows?.length) {
      exportRowsToExcel(
        periodResult.rows.map((row) => ({
          Marquesina: row.stopCode,
          Total_periodo_actual: row.currentTotal,
          Total_periodo_anterior: row.previousTotal,
          Variacion_absoluta: row.variationAbs,
          Variacion_pct: row.variationPct === null ? '—' : row.variationPct.toFixed(2),
        })),
        `comparativa_periodos_${new Date().toISOString().slice(0, 10)}.xls`
      );
    }
  };

  return (
    <div className="px-6 py-6 space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`pc-action-btn h-8 px-3 ${activeTab === 'stops' ? 'bg-[#D10002] text-white border-[#D10002]' : ''}`}
            onClick={() => setActiveTab('stops')}
          >
            Por Marquesinas
          </button>
          <button
            className={`pc-action-btn h-8 px-3 ${activeTab === 'period' ? 'bg-[#D10002] text-white border-[#D10002]' : ''}`}
            onClick={() => setActiveTab('period')}
          >
            Por Periodo
          </button>
          <button
            className={`pc-action-btn h-8 px-3 ${activeTab === 'zone' ? 'bg-[#D10002] text-white border-[#D10002]' : ''}`}
            onClick={() => setActiveTab('zone')}
          >
            Por Zona / Operador
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[220px_220px_1fr_auto_auto] gap-2 items-end">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Inicio</label>
            <input
              className="w-full h-9 border border-gray-300 rounded px-2 text-sm"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Fin</label>
            <input
              className="w-full h-9 border border-gray-300 rounded px-2 text-sm"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Marquesinas ({selectedCount} seleccionadas)</label>
            <div className="max-h-24 overflow-auto border border-gray-300 rounded p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
              {stops.map((stop) => (
                <label key={stop.stopCode} className="text-xs text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedStopCodes.includes(stop.stopCode)}
                    onChange={() => handleStopSelection(stop.stopCode)}
                  />
                  <span className="truncate">{stop.stopCode}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="pc-action-btn h-9" onClick={handleCompare} disabled={loading}>
            {loading ? 'Comparando...' : 'Comparar'}
          </button>
          <button className="pc-action-btn h-9" onClick={handleExportExcel}>
            Exportar Excel
          </button>
        </div>

        {activeTab === 'zone' && (
          <div className="text-sm border border-amber-200 bg-amber-50 text-amber-800 rounded px-3 py-2">
            Comparativa por Zona / Operador preparada para fase 2 (pendiente de datos backend).
          </div>
        )}

        {error && <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded px-3 py-2">{error}</div>}
      </section>

      {activeTab === 'stops' && stopsResult && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="text-sm text-gray-600">
            Periodo actual: {dateRange.startDate} → {dateRange.endDate} · Periodo comparación: {stopsResult.previousRange.startDate} → {stopsResult.previousRange.endDate}
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barsData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stopCode" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total periodo" fill="#D10002" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dailyAvg" name="Media diaria" fill="#475569" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dailyPeak" name="Máximo diario" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ComparisonTable rows={stopsResult.rows} />
        </section>
      )}

      {activeTab === 'period' && periodResult && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="pc-kpi-card">
              <h3>PERIODO ACTUAL</h3>
              <div className="pc-big-number">{formatNumber(periodCards.currentTotal)}</div>
            </div>
            <div className="pc-kpi-card">
              <h3>PERIODO ANTERIOR</h3>
              <div className="pc-big-number">{formatNumber(periodCards.previousTotal)}</div>
            </div>
            <div className="pc-kpi-card">
              <h3>VARIACIÓN ABSOLUTA</h3>
              <div className={`text-[34px] leading-none ${periodCards.variationAbs >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {periodCards.variationAbs >= 0 ? '+' : ''}{formatNumber(periodCards.variationAbs)}
              </div>
            </div>
            <div className="pc-kpi-card">
              <h3>VARIACIÓN %</h3>
              <div className={`text-[34px] leading-none ${periodCards.variationPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPct(periodCards.variationPct)}
              </div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { label: 'Periodo actual', total: periodCards.currentTotal },
                  { label: 'Periodo anterior', total: periodCards.previousTotal },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#D10002" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">Marquesina</th>
                  <th className="text-right px-3 py-2">Actual</th>
                  <th className="text-right px-3 py-2">Anterior</th>
                  <th className="text-right px-3 py-2">Variación abs.</th>
                  <th className="text-right px-3 py-2">Variación %</th>
                </tr>
              </thead>
              <tbody>
                {periodResult.rows.map((row) => (
                  <tr key={row.stopCode} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-800">{row.stopCode}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.currentTotal)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.previousTotal)}</td>
                    <td className={`px-3 py-2 text-right ${row.variationAbs >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.variationAbs >= 0 ? '+' : ''}{formatNumber(row.variationAbs)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.variationPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPct(row.variationPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
