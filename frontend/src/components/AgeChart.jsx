import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AGE_COLORS = [
  '#d9e2ec', // 0-9
  '#bcccdc', // 10-16
  '#829ab1', // 17-30
  '#627d98', // 31-45
  '#486581', // 46-60
  '#334e68', // 60+
  '#9fb3c8', // unknown
];

const AGE_LABELS = {
  '0-9': '0–9',
  '10-16': '10–16',
  '17-30': '17–30',
  '31-45': '31–45',
  '46-60': '46–60',
  '60+': '60+',
  'unknown': 'Desc.'
};

export default function AgeChart({ data }) {
  const ageData = data.age || data;

  const chartData = Object.entries(ageData)
    .filter(([key]) => Object.keys(AGE_LABELS).includes(key))
    .map(([key, value], index) => ({
      name: AGE_LABELS[key] || key,
      value: Number(value) || 0,
      color: AGE_COLORS[index % AGE_COLORS.length]
    }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-icon bg-primary-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Distribución por Edad</h3>
        </div>
        <p className="text-gray-400 text-center py-8 text-sm">Sin datos de edad</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-primary-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">Distribución por Edad</h3>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
            />
            <Tooltip
              formatter={(value) => [formatNumber(value), 'Personas']}
              contentStyle={{
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                fontSize: '12px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-3 pt-3 border-t border-gray-100">
        {chartData.map((item) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
          return (
            <div key={item.name} className="text-center">
              <p className="text-[10px] text-gray-400">{item.name}</p>
              <p className="text-xs font-semibold text-gray-700 tabular-nums">{formatNumber(item.value)}</p>
              <p className="text-[10px] text-gray-400 tabular-nums">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-ES').format(num);
}
