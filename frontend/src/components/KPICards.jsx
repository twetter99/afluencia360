export default function KPICards({ data }) {
  const totals = data.totals || data;
  const traffic = data.trafficTotals || {};
  const iot = data.iotReport?.summary || {};

  // Detectar si hay datos IoT (marquesina) o es formato clásico
  const isIoT = !!(data.trafficTotals || data.iotReport);

  const cards = isIoT ? [
    {
      label: 'Total personas (lote salida)',
      value: traffic.outgoingBatch ?? iot.traffic?.outgoing_batch ?? 0,
      icon: iconPeople,
      color: 'bg-primary-800',
      accent: 'text-primary-900',
      highlight: true,
    },
    {
      label: 'Conteo deduplicado',
      value: totals.afterDeduplication ?? iot.deduplicated ?? 0,
      icon: iconDedup,
      color: 'bg-primary-700',
      accent: 'text-primary-800',
      highlight: true,
    },
    {
      label: 'Total personas detectadas',
      value: totals.totalNumber ?? iot.total_detected ?? 0,
      icon: iconDetected,
      color: 'bg-primary-700',
      accent: 'text-primary-800',
    },
    {
      label: 'Personas que entran',
      value: traffic.peopleIn ?? iot.traffic?.people_in ?? 0,
      icon: iconIn,
      color: 'bg-primary-600',
      accent: 'text-primary-700',
    },
    {
      label: 'Personas que salen',
      value: traffic.peopleOut ?? iot.traffic?.people_out ?? 0,
      icon: iconOut,
      color: 'bg-gray-600',
      accent: 'text-gray-700',
    },
    {
      label: 'Passby (pasan de largo)',
      value: traffic.passby ?? iot.traffic?.passby ?? 0,
      icon: iconPassby,
      color: 'bg-gray-500',
      accent: 'text-gray-700',
    },
    {
      label: 'Turnback (dan la vuelta)',
      value: traffic.turnback ?? iot.traffic?.turnback ?? 0,
      icon: iconTurnback,
      color: 'bg-gray-500',
      accent: 'text-gray-700',
    },
    {
      label: 'Tiempo promedio permanencia',
      value: `${iot.avg_dwell_minutes ?? extractMinutes(data.residenceTime) ?? 0} min`,
      isTime: true,
      icon: iconClock,
      color: 'bg-slate-600',
      accent: 'text-slate-700',
    },
  ] : [
    // — Formato clásico (sin IoT) —
    {
      label: 'Adultos',
      value: totals.adults || 0,
      icon: iconPeople,
      color: 'bg-primary-700',
      accent: 'text-primary-800'
    },
    {
      label: 'Niños',
      value: totals.children || 0,
      icon: iconChild,
      color: 'bg-primary-600',
      accent: 'text-primary-700'
    },
    {
      label: 'Deduplicados',
      value: totals.afterDeduplication || 0,
      icon: iconDedup,
      color: 'bg-gray-600',
      accent: 'text-gray-700'
    },
    {
      label: 'Tiempo Residencia',
      value: data.residenceTime || data.avgResidenceTime || '00:00:00',
      isTime: true,
      icon: iconClock,
      color: 'bg-slate-600',
      accent: 'text-slate-700'
    },
    {
      label: 'Empleados Heavy',
      value: totals.heavyEmployees || 0,
      icon: iconEmployee,
      color: 'bg-gray-500',
      accent: 'text-gray-700'
    },
    {
      label: 'Número Total',
      value: totals.totalNumber || 0,
      highlight: true,
      icon: iconDetected,
      color: 'bg-primary-800',
      accent: 'text-primary-900'
    }
  ];

  return (
    <div className={`grid gap-3 ${isIoT ? 'grid-cols-2 md:grid-cols-4 xl:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}>
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-white rounded-md border p-4 ${card.highlight ? 'border-primary-300 bg-primary-50/20' : 'border-gray-200'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`card-icon ${card.color}`}>
              {card.icon}
            </div>
            <span className="text-xs font-medium text-gray-500 leading-tight">{card.label}</span>
          </div>
          <p className={`text-xl font-semibold tabular-nums ${card.highlight ? 'text-primary-800' : 'text-gray-900'}`}>
            {card.isTime ? card.value : formatNumber(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function extractMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  if (parts.length === 3) return parseInt(parts[1]) || 0;
  return parseInt(timeStr) || 0;
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('es-ES').format(num);
}

// ═══ SVG Icons ═══
const iconPeople = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const iconDedup = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const iconDetected = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const iconIn = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
  </svg>
);
const iconOut = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
const iconPassby = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);
const iconTurnback = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);
const iconClock = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const iconChild = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const iconEmployee = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
