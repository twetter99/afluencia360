import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = {
  entryLot: '#486581',
  outgoingBatch: '#829ab1',
  totalPersons: '#334e68',
  peopleDet: '#bcccdc',
};

export default function HourlyTrafficChart({ hourly, peakHour, trafficTotals }) {
  if (!hourly || hourly.length === 0) return null;

  const chartData = hourly.map((h) => ({
    hour: h.hour,
    'Lote Entrada': h.entryLot || 0,
    'Lote Salida': h.outgoingBatch || 0,
    'Total Personas': h.totalPersons || 0,
    'Personas Detenidas': h.peopleDet || 0,
  }));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-primary-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">Tráfico por Hora</h3>
        {peakHour && (
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 border border-primary-200">
            Hora Pico: {peakHour.hour} ({formatNumber(peakHour.detected)} — {peakHour.pct_of_total}%)
          </span>
        )}
      </div>

      {/* KPIs de tráfico */}
      {trafficTotals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          <MiniKPI label="Lote Entrada" value={trafficTotals.entryLot} />
          <MiniKPI label="Lote Salida" value={trafficTotals.outgoingBatch} />
          <MiniKPI label="Personas Detenidas" value={trafficTotals.peopleDet} />
        </div>
      )}

      {/* Gráfico de barras agrupadas */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            />
            <Tooltip
              formatter={(value, name) => [formatNumber(value), name]}
              contentStyle={{
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', fontFamily: 'Inter, system-ui, sans-serif' }} />
            <Bar dataKey="Lote Entrada" fill={COLORS.entryLot} radius={[2, 2, 0, 0]} maxBarSize={22} />
            <Bar dataKey="Lote Salida" fill={COLORS.outgoingBatch} radius={[2, 2, 0, 0]} maxBarSize={22} />
            <Bar dataKey="Total Personas" fill={COLORS.totalPersons} radius={[2, 2, 0, 0]} maxBarSize={22} />
            <Bar dataKey="Personas Detenidas" fill={COLORS.peopleDet} radius={[2, 2, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla resumen por hora */}
      <div className="mt-4 pt-3 border-t border-gray-100 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200">
              <th className="py-1.5 pr-3 font-medium">Hora</th>
              <th className="py-1.5 pr-3 font-medium">L. Entrada</th>
              <th className="py-1.5 pr-3 font-medium">L. Salida</th>
              <th className="py-1.5 pr-3 font-medium">Total</th>
              <th className="py-1.5 pr-3 font-medium">Detenidas</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => {
              const isPeak = peakHour && row.hour === peakHour.hour;
              return (
                <tr
                  key={row.hour}
                  className={`border-b border-gray-50 ${isPeak ? 'bg-primary-50 font-semibold' : ''}`}
                >
                  <td className="py-1 pr-3 tabular-nums">{row.hour}</td>
                  <td className="py-1 pr-3 tabular-nums">{formatNumber(row['Lote Entrada'])}</td>
                  <td className="py-1 pr-3 tabular-nums">{formatNumber(row['Lote Salida'])}</td>
                  <td className="py-1 pr-3 tabular-nums">{formatNumber(row['Total Personas'])}</td>
                  <td className="py-1 pr-3 tabular-nums">{formatNumber(row['Personas Detenidas'])}</td>
                </tr>
              );
            })}
          </tbody>
          {trafficTotals && (
            <tfoot>
              <tr className="border-t border-gray-300 font-semibold text-gray-800">
                <td className="py-1.5 pr-3">TOTAL</td>
                <td className="py-1.5 pr-3 tabular-nums">{formatNumber(trafficTotals.entryLot)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{formatNumber(trafficTotals.outgoingBatch)}</td>
                <td className="py-1.5 pr-3 tabular-nums">
                  {formatNumber(chartData.reduce((s, r) => s + r['Total Personas'], 0))}
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{formatNumber(trafficTotals.peopleDet)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function MiniKPI({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-md p-2.5 text-center border border-gray-100">
      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-lg font-semibold text-gray-800 tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('es-ES').format(num);
}
