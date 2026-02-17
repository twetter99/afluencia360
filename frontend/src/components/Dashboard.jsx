import KPICards from './KPICards';
import GenderChart from './GenderChart';
import AgeChart from './AgeChart';
import FlowKPI from './FlowKPI';
import TrendChart from './TrendChart';
import HourlyTrafficChart from './HourlyTrafficChart';
import MarquesinaReport from './MarquesinaReport';

export default function Dashboard({ mode, data }) {
  if (mode === 'compare') {
    const comparisons = data?.comparisons || [];

    if (comparisons.length === 0) {
      return <EmptyState text="Selecciona dos o más marquesinas para comparar" />;
    }

    return (
      <div className="space-y-4 pt-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Comparación de Marquesinas</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Total Personas</th>
                  <th className="py-2 pr-4">Adultos</th>
                  <th className="py-2 pr-4">Niños</th>
                  <th className="py-2 pr-4">Deduplicados</th>
                  <th className="py-2 pr-4">Última Fecha</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((item) => (
                  <tr key={item.stopCode} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-semibold text-gray-800">{item.stopCode}</td>
                    <td className="py-2 pr-4">{formatNumber(item.summary?.totals?.totalNumber || 0)}</td>
                    <td className="py-2 pr-4">{formatNumber(item.summary?.totals?.adults || 0)}</td>
                    <td className="py-2 pr-4">{formatNumber(item.summary?.totals?.children || 0)}</td>
                    <td className="py-2 pr-4">{formatNumber(item.summary?.totals?.afterDeduplication || 0)}</td>
                    <td className="py-2 pr-4">{item.latest?.date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {comparisons.map((item) => (
          <div key={`${item.stopCode}_panel`} className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-800">{item.stopCode}</h4>
              <span className="text-sm text-gray-500">{item.records?.length || 0} registros</span>
            </div>
            <KPICards data={item.summary || item.latest || {}} />
          </div>
        ))}
      </div>
    );
  }

  const current = mode === 'aggregate' ? data : data?.single;
  if (!current) {
    return <EmptyState text="No hay datos disponibles para la selección actual" />;
  }

  const { latest, summary, records } = current;
  const displayData = summary || latest;

  // Buscar el primer registro que tenga datos horarios IoT
  const latestWithHourly = records?.find(r => r.hourly && r.hourly.length > 0) || latest;

  if (!displayData) {
    return <EmptyState text="No hay datos disponibles para esta selección" />;
  }

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {mode === 'aggregate' ? `Vista Agregada — ${data.stopCodes?.join(', ') || ''}` : (current.stopCode || current.entity)}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {latest?.date ? `Último dato: ${formatDate(latest.date)}` : ''}
            {current.totalRecords ? ` · ${current.totalRecords} registros` : ''}
          </p>
        </div>
      </div>

      <KPICards data={displayData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GenderChart data={displayData.gender || displayData} />
        <AgeChart data={displayData.age || displayData} />
      </div>

      {/* Tráfico por Hora — datos IoT de marquesina */}
      <HourlyTrafficChart
        hourly={displayData.hourly || latestWithHourly?.hourly}
        peakHour={displayData.peakHour || latestWithHourly?.peakHour}
        trafficTotals={displayData.trafficTotals || latestWithHourly?.trafficTotals}
      />

      {/* Informe Completo IoT — 42 columnas */}
      <MarquesinaReport record={latestWithHourly} />

      {(latest?.passengerFlow || displayData?.passengerFlow) && (
        <FlowKPI data={latest?.passengerFlow || displayData.passengerFlow} />
      )}

      {records && records.length > 1 && (
        <TrendChart records={records} />
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-14 text-gray-400 text-sm">{text}</div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('es-ES').format(num);
}
