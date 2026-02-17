import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';

const PALETTE = {
  blue900: '#102a43',
  blue700: '#334e68',
  blue600: '#486581',
  blue500: '#627d98',
  blue400: '#829ab1',
  blue300: '#9fb3c8',
  blue200: '#bcccdc',
  blue100: '#d9e2ec',
  blue50:  '#f0f4f8',
  accent:  '#e12d39',
  green:   '#27ab83',
  amber:   '#f0b429',
};

const PIE_COLORS = [PALETTE.blue700, PALETTE.blue400, PALETTE.blue200, PALETTE.blue100];
const AGE_COLORS = [
  PALETTE.blue200, PALETTE.blue300, PALETTE.blue700,
  PALETTE.blue600, PALETTE.blue500, PALETTE.blue400, PALETTE.blue100
];

export default function MarquesinaReport({ record }) {
  if (!record?.iotReport) return null;

  const { meta, summary, gender, age, genderG2, ageG2, officialTotals, observations } = record.iotReport;
  const hourly = record.hourly || [];
  const peakHour = record.peakHour;

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="card-icon bg-primary-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Informe Completo IoT — Marquesina</h3>
            <p className="text-xs text-gray-400">Todas las métricas de las 42 columnas del sensor</p>
          </div>
        </div>
      </div>

      {/* ═══════════ SECCIÓN 1: Info General ═══════════ */}
      <SectionCard title="1. Información General" icon={infoIcon}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <InfoCell label="Ubicación" value={meta?.location || '-'} />
          <InfoCell label="Fecha" value={formatDate(meta?.date)} />
          <InfoCell label="Inicio Medición" value={meta?.measurement_start || '-'} />
          <InfoCell label="Fin Medición" value={meta?.measurement_end || '-'} />
          <InfoCell label="Horas Activas" value={meta?.active_hours || 0} />
        </div>
        {meta?.note && (
          <p className="text-[10px] text-gray-400 mt-2 italic">* {meta.note}</p>
        )}
      </SectionCard>

      {/* ═══════════ SECCIÓN 2: Métricas Clave ═══════════ */}
      <SectionCard title="2. Métricas Clave" icon={metricsIcon}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <MetricCell label="Total Detectado" value={summary?.total_detected} highlight />
          <MetricCell label="Total Identificado" value={summary?.total_identified} />
          <MetricCell label="No Identificado" value={summary?.total_not_identified} />
          <MetricCell label="Tasa Identificación" value={`${summary?.identification_rate || 0}%`} />
          <MetricCell label="T. Permanencia Medio" value={`${summary?.avg_dwell_minutes || 0} min`} />
          <MetricCell label="Personas Entrando" value={summary?.traffic?.people_in} />
          <MetricCell label="Personas Saliendo" value={summary?.traffic?.people_out} />
          <MetricCell label="Transeúntes" value={summary?.traffic?.passby} />
          <MetricCell label="Retornos" value={summary?.traffic?.turnback} />
          <MetricCell label="Personas Detenidas" value={summary?.traffic?.people_detained} />
          <MetricCell label="Lote Entrada" value={summary?.traffic?.entry_lot} />
          <MetricCell label="Lote Salida" value={summary?.traffic?.outgoing_batch} />
        </div>

        {/* Sub-grupo: Personas */}
        <h4 className="text-xs font-semibold text-gray-500 mt-4 mb-2">Clasificación de Personas</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCell label="Adultos" value={summary?.people?.adult} />
          <MetricCell label="Niños" value={summary?.people?.children} />
          <MetricCell label="Residentes" value={summary?.people?.residents} />
          <MetricCell label="Entrada Empleados" value={summary?.people?.employee_entry} />
          <MetricCell label="Entrada Clientes" value={summary?.people?.customers_enter} />
          <MetricCell label="Empleados Entrando" value={summary?.people?.employees_entering} />
        </div>

        {/* Sub-grupo: Vehículos */}
        <h4 className="text-xs font-semibold text-gray-500 mt-4 mb-2">Vehículos</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <MetricCell label="Entrada Vehículos" value={summary?.vehicles?.vehicle_entry} />
          <MetricCell label="Salida Vehículos" value={summary?.vehicles?.vehicle_exit} />
          <MetricCell label="Total Vehículos" value={summary?.vehicles?.total_vehicles} />
        </div>

        {/* Deduplicados */}
        <div className="mt-3">
          <MetricCell label="Contador Deduplicado" value={summary?.deduplicated} />
        </div>

        {/* Totales oficiales del Excel */}
        {officialTotals && (
          <>
            <h4 className="text-xs font-semibold text-gray-500 mt-4 mb-2">Totales Oficiales (fila Total del Excel)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <MetricCell label="Total Personas" value={officialTotals.total_people} highlight />
              <MetricCell label="Personas In" value={officialTotals.people_in} />
              <MetricCell label="Personas Out" value={officialTotals.people_out} />
              <MetricCell label="Adultos" value={officialTotals.adult} />
              <MetricCell label="Niños" value={officialTotals.children} />
              <MetricCell label="Residentes" value={officialTotals.residents} />
              <MetricCell label="Deduplicado" value={officialTotals.deduplicated} />
              <MetricCell label="T. Permanencia" value={`${officialTotals.avg_dwell_time} min`} />
              <MetricCell label="Total Vehículos" value={officialTotals.total_vehicles} />
              <MetricCell label="Empl. Entrando" value={officialTotals.employees_entering} />
            </div>
          </>
        )}
      </SectionCard>

      {/* ═══════════ SECCIÓN 3: Tráfico por Hora ═══════════ */}
      <SectionCard title="3. Tráfico por Hora" icon={clockIcon}>
        {peakHour && (
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-primary-100 text-primary-800 border border-primary-200">
              Hora Pico: {peakHour.hour} — {fmtNum(peakHour.detected)} personas ({peakHour.pct_of_total}%)
            </span>
          </div>
        )}

        {/* Gráfico de barras */}
        {hourly.length > 0 && (
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly.map(h => ({
                hour: h.hour,
                'Personas': h.totalPersons || 0,
                'Entrada': h.peopleIn || 0,
                'Salida': h.peopleOut || 0,
                'Detenidas': h.peopleDet || 0,
              }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                <Tooltip formatter={(v, name) => [fmtNum(v), name]}
                  contentStyle={{ borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Personas" fill={PALETTE.blue700} radius={[2,2,0,0]} maxBarSize={20} />
                <Bar dataKey="Entrada" fill={PALETTE.blue500} radius={[2,2,0,0]} maxBarSize={20} />
                <Bar dataKey="Salida" fill={PALETTE.blue300} radius={[2,2,0,0]} maxBarSize={20} />
                <Bar dataKey="Detenidas" fill={PALETTE.blue200} radius={[2,2,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabla completa por hora */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200">
                <th className="py-1.5 pr-2 font-medium">Hora</th>
                <th className="py-1.5 pr-2 font-medium text-right">Total</th>
                <th className="py-1.5 pr-2 font-medium text-right">In</th>
                <th className="py-1.5 pr-2 font-medium text-right">Out</th>
                <th className="py-1.5 pr-2 font-medium text-right">Passby</th>
                <th className="py-1.5 pr-2 font-medium text-right">L.Ent</th>
                <th className="py-1.5 pr-2 font-medium text-right">L.Sal</th>
                <th className="py-1.5 pr-2 font-medium text-right">Det.</th>
                <th className="py-1.5 pr-2 font-medium text-right">Adult</th>
                <th className="py-1.5 pr-2 font-medium text-right">Niños</th>
                <th className="py-1.5 pr-2 font-medium text-right">Resid.</th>
                <th className="py-1.5 pr-2 font-medium text-right">Veh.In</th>
                <th className="py-1.5 pr-2 font-medium text-right">Veh.Out</th>
                <th className="py-1.5 pr-2 font-medium text-right">Hombre</th>
                <th className="py-1.5 pr-2 font-medium text-right">Mujer</th>
                <th className="py-1.5 font-medium text-right">Perm.</th>
              </tr>
            </thead>
            <tbody>
              {hourly.map((h) => {
                const isPeak = peakHour && h.hour === peakHour.hour;
                return (
                  <tr key={h.hour} className={`border-b border-gray-50 ${isPeak ? 'bg-primary-50 font-semibold' : ''}`}>
                    <td className="py-1 pr-2 tabular-nums">{h.hour}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.totalPersons)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.peopleIn)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.peopleOut)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.passby)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.entryLot)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.outgoingBatch)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.peopleDet)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.adult)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.children)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.residents)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.vehicleEntry)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.vehicleExit)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.gender?.male)}</td>
                    <td className="py-1 pr-2 tabular-nums text-right">{fmtNum(h.gender?.female)}</td>
                    <td className="py-1 tabular-nums text-right">{fmtNum(h.avgDwellMinutes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ═══════════ SECCIÓN 4: Género ═══════════ */}
      <SectionCard title="4. Distribución por Género" icon={genderIcon}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Grupo 1 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">Grupo 1</h4>
            <GenderBlock data={gender} />
          </div>
          {/* Grupo 2 */}
          {genderG2 && hasData(genderG2) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">Grupo 2</h4>
              <GenderBlock data={genderG2} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ═══════════ SECCIÓN 5: Edad ═══════════ */}
      <SectionCard title="5. Distribución por Edad" icon={ageIcon}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Grupo 1 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-2">Grupo 1</h4>
            <AgeBlock data={age} />
          </div>
          {/* Grupo 2 */}
          {ageG2 && hasData(ageG2) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">Grupo 2</h4>
              <AgeBlock data={ageG2} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ═══════════ SECCIÓN 6: Observaciones Clave ═══════════ */}
      {observations && observations.length > 0 && (
        <SectionCard title="6. Observaciones Clave" icon={observIcon}>
          <ul className="space-y-2">
            {observations.map((obs, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-componentes
// ════════════════════════════════════════════════════════════════════

function SectionCard({ title, icon, children }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <div className="card-icon bg-primary-700">{icon}</div>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-md p-2.5 border border-gray-100">
      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function MetricCell({ label, value, highlight }) {
  const displayVal = typeof value === 'number' ? fmtNum(value) : (value ?? '0');
  return (
    <div className={`rounded-md p-2.5 border ${highlight ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-100'}`}>
      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${highlight ? 'text-primary-800' : 'text-gray-800'}`}>{displayVal}</p>
    </div>
  );
}

function GenderBlock({ data }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([k]) => k !== 'not_identified');
  const pieData = entries.map(([key, val]) => ({
    name: genderLabel(key),
    value: val?.count ?? val ?? 0,
    pct: val?.pct ?? 0,
  })).filter(d => d.value > 0);

  return (
    <div className="flex items-center gap-4">
      <div className="w-32 h-32 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={25} strokeWidth={1}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [fmtNum(v), name]}
              contentStyle={{ borderRadius: '4px', fontSize: '11px', border: '1px solid #d1d5db' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5">
        {entries.map(([key, val], i) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-gray-600">{genderLabel(key)}</span>
            </div>
            <span className="font-semibold text-gray-800 tabular-nums">
              {fmtNum(val?.count ?? val ?? 0)} <span className="text-gray-400 font-normal">({val?.pct ?? 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgeBlock({ data }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([k]) => k !== 'not_identified');

  // Find dominant
  let maxKey = null, maxVal = 0;
  entries.forEach(([k, v]) => {
    const c = v?.count ?? v ?? 0;
    if (c > maxVal) { maxVal = c; maxKey = k; }
  });

  const chartData = entries.map(([key, val]) => ({
    name: key === 'unknown' ? 'Desc.' : key,
    value: val?.count ?? val ?? 0,
    pct: val?.pct ?? 0,
  }));

  return (
    <div>
      <div className="h-44 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={35}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
            <Tooltip formatter={(v, name) => [fmtNum(v), name]}
              contentStyle={{ borderRadius: '4px', fontSize: '11px', border: '1px solid #d1d5db' }} />
            <Bar dataKey="value" name="Personas" radius={[2,2,0,0]} maxBarSize={30}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {entries.map(([key, val]) => {
          const isDominant = key === maxKey;
          return (
            <div key={key} className={`text-center p-2 rounded-md border ${isDominant ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-100'}`}>
              <p className="text-[10px] font-medium text-gray-400">{key === 'unknown' ? 'Desc.' : key}</p>
              <p className={`text-xs font-semibold tabular-nums ${isDominant ? 'text-primary-800' : 'text-gray-800'}`}>
                {fmtNum(val?.count ?? val ?? 0)}
              </p>
              <p className="text-[10px] text-gray-400 tabular-nums">{val?.pct ?? 0}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function fmtNum(n) {
  if (n === undefined || n === null) return '0';
  return new Intl.NumberFormat('es-ES').format(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function genderLabel(key) {
  const map = { male: 'Hombre', female: 'Mujer', unknown: 'Desconocido', not_identified: 'No Identificado' };
  return map[key] || key;
}

function hasData(obj) {
  if (!obj) return false;
  return Object.values(obj).some(v => (v?.count ?? v ?? 0) > 0);
}

// ═══ SVG Icons ═══
const infoIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const metricsIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const clockIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const genderIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const ageIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const observIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
