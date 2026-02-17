import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const GENDER_COLORS = {
  man: '#334e68',
  woman: '#829ab1',
  unknown: '#bcccdc'
};

const GENDER_LABELS = {
  man: 'Hombre',
  woman: 'Mujer',
  unknown: 'Desconocido'
};

export default function GenderChart({ data }) {
  const genderData = data.gender || data;

  const chartData = Object.entries(genderData)
    .filter(([key]) => ['man', 'woman', 'unknown'].includes(key))
    .map(([key, value]) => ({
      name: GENDER_LABELS[key] || key,
      value: Number(value) || 0,
      color: GENDER_COLORS[key]
    }))
    .filter(d => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-icon bg-primary-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Género</h3>
        </div>
        <p className="text-gray-400 text-center py-8 text-sm">Sin datos de género</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-primary-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">Distribución por Género</h3>
      </div>

      <div className="flex items-center gap-6">
        <div className="w-44 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
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
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2.5">
          {chartData.map((item) => {
            const percentage = ((item.value / total) * 100).toFixed(1);
            return (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium text-gray-600">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-800 tabular-nums">{formatNumber(item.value)}</span>
                  <span className="text-xs text-gray-400 ml-1.5 tabular-nums">{percentage}%</span>
                </div>
              </div>
            );
          })}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Total</span>
              <span className="text-sm font-semibold text-gray-800 tabular-nums">{formatNumber(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-ES').format(num);
}
