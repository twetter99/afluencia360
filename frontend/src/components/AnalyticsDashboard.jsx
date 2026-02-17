import { useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend
} from 'recharts';
import { getMarquesinaAnalytics } from '../services/api';
import HourlyTrafficChart from './HourlyTrafficChart';
import MarquesinaReport from './MarquesinaReport';

// ─── KPI Card ─────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, accent = 'primary' }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="card flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Formatters ───────────────────────────────────────────
const fmt = (n) => n == null ? '—' : new Intl.NumberFormat('es-ES').format(n);
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};
const fmtDateLong = (d) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ─── Custom Tooltip ───────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{fmtDateLong(label)}</p>
      {d?.hasData ? (
        <>
          <p>Total detectado: <strong>{fmt(d.totalDetected)}</strong></p>
          <p>Deduplicado: <strong>{fmt(d.deduplicated)}</strong></p>
          <p>Hora pico: <strong>{d.peakHour || '—'}</strong> ({fmt(d.peakValue)})</p>
          <p>Perm. media: <strong>{d.avgDwell ?? '—'} min</strong></p>
        </>
      ) : (
        <p className="text-gray-400 italic">Sin datos</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AnalyticsDashboard — pantalla principal
// ═══════════════════════════════════════════════════════════
export default function AnalyticsDashboard({ stops }) {
  // Filtros
  const [selectedStop, setSelectedStop] = useState('');
  const [mode, setMode] = useState('day');        // 'day' | 'range'
  const [singleDate, setSingleDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Estado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const activeStops = (stops || []).filter(s => s.status !== 'inactive');

  const canApply =
    selectedStop &&
    (mode === 'day' ? !!singleDate : (!!dateFrom && !!dateTo));

  const handleApply = useCallback(async () => {
    if (!canApply) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = {
        location: selectedStop,
        mode,
        ...(mode === 'day'
          ? { date: singleDate }
          : { from: dateFrom, to: dateTo })
      };
      const res = await getMarquesinaAnalytics(params);
      if (res.success) {
        setResult(res);
      } else {
        setError(res.error || 'Error desconocido');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [canApply, selectedStop, mode, singleDate, dateFrom, dateTo]);

  const kpis = result?.kpis;
  const dailySummaries = result?.dailySummaries || [];
  const hourlyAggregate = result?.hourlyAggregate || [];
  const dayDetail = result?.dayDetail;

  // Datos para chart — solo días con datos para las barras
  const chartData = dailySummaries.map(d => ({
    ...d,
    value: d.hasData ? d.totalDetected : 0,
  }));

  // Nombre de la marquesina seleccionada
  const stopName = activeStops.find(s => s.stopCode === selectedStop)?.name || selectedStop;

  return (
    <div className="px-6 py-6 space-y-6">
      {/* ── Filtro Bar ──────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <h2 className="text-lg font-bold text-gray-800">Dashboard Analítico</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Marquesina */}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Marquesina *</label>
            <select
              value={selectedStop}
              onChange={(e) => { setSelectedStop(e.target.value); setResult(null); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">Seleccionar…</option>
              {activeStops.map(s => (
                <option key={s.stopCode} value={s.stopCode}>
                  {s.stopCode} — {s.name || s.location || 'Sin nombre'}
                </option>
              ))}
            </select>
          </div>

          {/* Modo */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Modo</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => { setMode('day'); setResult(null); }}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${mode === 'day' ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                Día
              </button>
              <button
                onClick={() => { setMode('range'); setResult(null); }}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${mode === 'range' ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                Rango
              </button>
            </div>
          </div>

          {/* Fechas */}
          {mode === 'day' ? (
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => { setSingleDate(e.target.value); setResult(null); }}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          ) : (
            <>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setResult(null); }}
                  max={dateTo || new Date().toISOString().slice(0, 10)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setResult(null); }}
                  min={dateFrom}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </>
          )}

          {/* Botón */}
          <div className={mode === 'day' ? 'md:col-span-4' : 'md:col-span-3'}>
            <button
              onClick={handleApply}
              disabled={!canApply || loading}
              className="w-full btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Consultando…' : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────── */}
      {loading && (
        <div className="py-14 text-center text-gray-400">Consultando datos…</div>
      )}

      {/* ── Resultados ──────────────────────────────────── */}
      {result && !loading && (
        <>
          {/* KPIs del periodo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Periodo"
              value={fmt(kpis.totalPeriod)}
              sub={`${kpis.daysWithData} día${kpis.daysWithData !== 1 ? 's' : ''} con datos`}
              accent="primary"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <KpiCard
              label="Promedio Diario"
              value={fmt(kpis.dailyAvg)}
              sub="Sobre días con datos"
              accent="emerald"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
            <KpiCard
              label="Pico Máximo"
              value={fmt(kpis.peakMax)}
              sub={kpis.peakDate ? `${fmtDateLong(kpis.peakDate)}${kpis.peakHour ? ` · ${kpis.peakHour}` : ''}` : '—'}
              accent="amber"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            />
            <KpiCard
              label="Cobertura"
              value={`${kpis.coveragePct}%`}
              sub={`${kpis.daysWithData} de ${kpis.daysInRange} días`}
              accent={kpis.coveragePct >= 80 ? 'emerald' : kpis.coveragePct >= 50 ? 'amber' : 'rose'}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
          </div>

          {/* ── Gráfico serie diaria (solo rango) ─────── */}
          {result.mode === 'range' && dailySummaries.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Personas detectadas por día — {stopName}
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={fmtDate}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.hasData ? '#334e68' : '#e2e8f0'}
                          opacity={entry.hasData ? 1 : 0.4}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Hourly chart (solo modo día con datos) ── */}
          {result.mode === 'day' && hourlyAggregate.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Distribución horaria — {fmtDateLong(singleDate)}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyAggregate} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v, name) => [fmt(v), name === 'detected' ? 'Detectados' : name === 'peopleIn' ? 'Entran' : name === 'peopleOut' ? 'Salen' : name]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(v) => v === 'detected' ? 'Detectados' : v === 'peopleIn' ? 'Entran' : v === 'peopleOut' ? 'Salen' : v}
                    />
                    <Bar dataKey="detected" fill="#334e68" radius={[3, 3, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="peopleIn" fill="#27ab83" radius={[3, 3, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="peopleOut" fill="#e12d39" radius={[3, 3, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Tabla resumen por día ──────────────────── */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {result.mode === 'range' ? 'Resumen por día' : 'Detalle del día'}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b text-xs uppercase tracking-wide">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4 text-right">Total detectado</th>
                    <th className="py-2 pr-4 text-right">Deduplicado</th>
                    <th className="py-2 pr-4 text-right">Perm. media</th>
                    <th className="py-2 pr-4">Hora pico</th>
                    <th className="py-2 pr-4 text-right">Pico valor</th>
                    <th className="py-2 pr-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummaries.map((row) => (
                    <tr key={row.date} className={`border-b border-gray-50 ${!row.hasData ? 'opacity-50' : ''}`}>
                      <td className="py-2 pr-4 font-medium text-gray-700">{fmtDateLong(row.date)}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{row.hasData ? fmt(row.totalDetected) : '—'}</td>
                      <td className="py-2 pr-4 text-right">{row.hasData ? fmt(row.deduplicated) : '—'}</td>
                      <td className="py-2 pr-4 text-right">{row.hasData ? `${row.avgDwell} min` : '—'}</td>
                      <td className="py-2 pr-4">{row.peakHour || '—'}</td>
                      <td className="py-2 pr-4 text-right">{row.hasData ? fmt(row.peakValue) : '—'}</td>
                      <td className="py-2 pr-4">
                        {row.hasData ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700">Datos</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-500">Sin datos</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {dailySummaries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-400">No hay datos para mostrar</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Informe IoT completo (modo día) ───────── */}
          {result.mode === 'day' && dayDetail && (
            <MarquesinaReport record={{
              iotReport: {
                meta: dayDetail.meta,
                summary: dayDetail.summary,
                gender: dayDetail.gender,
                age: dayDetail.age,
                genderG2: dayDetail.gender_g2 || null,
                ageG2: dayDetail.age_g2 || null,
                officialTotals: dayDetail.officialTotals || null,
                observations: dayDetail.observations || [],
              },
              hourly: dayDetail.hourly?.map(h => ({
                hour: h.hour,
                entryLot: h.entry_lot || 0,
                outgoingBatch: h.outgoing_batch || 0,
                totalPersons: h.detected || 0,
                peopleDet: h.people_detained || 0,
              })) || []
            }} />
          )}
        </>
      )}

      {/* ── Empty state ─────────────────────────────────── */}
      {!result && !loading && !error && (
        <div className="card text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <p className="text-gray-500 text-sm">Selecciona una marquesina, modo y fecha para consultar</p>
          <p className="text-gray-400 text-xs mt-1">Los datos se muestran agregados por el servidor</p>
        </div>
      )}
    </div>
  );
}
