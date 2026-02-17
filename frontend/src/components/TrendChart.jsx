import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function TrendChart({ records }) {
  if (!records || records.length < 2) return null;

  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));

  const chartData = sortedRecords.map((record) => ({
    date: formatShortDate(record.date),
    fullDate: record.date,
    adultos: record.totals?.adults || 0,
    niños: record.totals?.children || 0,
    total: record.totals?.totalNumber || 0,
    deduplicados: record.totals?.afterDeduplication || 0
  }));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-primary-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">Tendencia Histórica</h3>
        <span className="text-xs text-gray-400 ml-auto tabular-nums">{records.length} registros</span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
              width={50}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
              formatter={(value, name) => [formatNumber(value), name]}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke="#334e68"
              strokeWidth={2}
              dot={{ fill: '#334e68', strokeWidth: 0, r: 2 }}
              activeDot={{ r: 4, fill: '#334e68' }}
            />
            <Line
              type="monotone"
              dataKey="adultos"
              name="Adultos"
              stroke="#627d98"
              strokeWidth={1.5}
              dot={{ fill: '#627d98', strokeWidth: 0, r: 1.5 }}
              activeDot={{ r: 3.5, fill: '#627d98' }}
            />
            <Line
              type="monotone"
              dataKey="niños"
              name="Niños"
              stroke="#9fb3c8"
              strokeWidth={1.5}
              dot={{ fill: '#9fb3c8', strokeWidth: 0, r: 1.5 }}
              activeDot={{ r: 3.5, fill: '#9fb3c8' }}
            />
            <Line
              type="monotone"
              dataKey="deduplicados"
              name="Deduplicados"
              stroke="#bcccdc"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-ES').format(num);
}
