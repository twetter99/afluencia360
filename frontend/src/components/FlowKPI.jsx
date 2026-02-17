export default function FlowKPI({ data }) {
  if (!data) return null;

  const cards = [
    {
      label: 'Flujo Ayer',
      value: data.yesterday?.value || 0,
      chainIndex: data.yesterday?.chainIndex,
      yoy: data.yesterday?.yoy
    },
    {
      label: 'Flujo Semana',
      value: data.lastWeek?.value || 0,
      chainIndex: data.lastWeek?.chainIndex,
      yoy: data.lastWeek?.yoy
    },
    {
      label: 'Flujo Mes',
      value: data.lastMonth?.value || 0,
      chainIndex: data.lastMonth?.chainIndex,
      yoy: data.lastMonth?.yoy
    },
    {
      label: 'Flujo Año',
      value: data.thisYear?.value || 0,
      chainIndex: data.thisYear?.chainIndex,
      yoy: data.thisYear?.yoy
    }
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-primary-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">KPI Flujo de Pasajeros</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-gray-50 rounded-md p-4 text-center border border-gray-100">
            <p className="text-xs font-medium text-gray-400 mb-1.5">{card.label}</p>
            <p className="text-xl font-semibold text-gray-800 mb-2 tabular-nums">
              {formatNumber(card.value)}
            </p>
            <div className="flex items-center justify-center gap-2">
              {card.chainIndex !== undefined && card.chainIndex !== null && (
                <IndexBadge label="Cadena" value={card.chainIndex} />
              )}
              {card.yoy !== undefined && card.yoy !== null && (
                <IndexBadge label="YOY" value={card.yoy} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndexBadge({ label, value }) {
  const isPositive = value >= 0;
  const arrow = isPositive ? '▲' : '▼';

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
      isPositive
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      <span className="text-[9px]">{arrow}</span>
      <span>{label}</span>
      <span className="tabular-nums">{Math.abs(value).toFixed(1)}%</span>
    </div>
  );
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('es-ES').format(num);
}
