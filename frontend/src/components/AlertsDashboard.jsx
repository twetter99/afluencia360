import { useEffect, useMemo, useState } from 'react';
import {
  getAlerts,
  recomputeAlerts,
  acknowledgeAlert,
  resolveAlert,
} from '../services/api';

function formatDateTime(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('es-ES', { hour12: false });
}

function severityBadgeClass(severity) {
  if (severity === 'CRITICAL') return 'bg-red-100 text-red-700 border-red-200';
  if (severity === 'WARN') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function statusBadgeClass(status) {
  if (status === 'OPEN') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'ACK') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function statusLabel(status) {
  if (status === 'OPEN') return 'Abierta';
  if (status === 'ACK') return 'Reconocida';
  return 'Resuelta';
}

function typeLabel(type) {
  if (type === 'NO_DATA') return 'Sin datos';
  if (type === 'ANOMALY_DROP') return 'Caída brusca';
  if (type === 'ANOMALY_SPIKE') return 'Pico anómalo';
  return type;
}

function prettyMetricValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

export default function AlertsDashboard({ stops = [] }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [selectedAlertId, setSelectedAlertId] = useState(null);

  const [range, setRange] = useState('7d');
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('OPEN');
  const [search, setSearch] = useState('');

  const stopNameByCode = useMemo(() => {
    const map = new Map();
    for (const stop of stops) {
      map.set(stop.stopCode, stop.name || stop.location || stop.stopCode);
    }
    return map;
  }, [stops]);

  const selectedAlert = useMemo(
    () => alerts.find((item) => item.id === selectedAlertId) || null,
    [alerts, selectedAlertId]
  );

  const refreshAlerts = async ({ recompute = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      if (recompute) {
        await recomputeAlerts();
      }
      const response = await getAlerts({ status, severity, search, range });
      const list = Array.isArray(response?.data) ? response.data : [];
      setAlerts(list);
      if (!selectedAlertId && list.length > 0) {
        setSelectedAlertId(list[0].id);
      }
      if (selectedAlertId && !list.some((item) => item.id === selectedAlertId)) {
        setSelectedAlertId(list[0]?.id || null);
      }
    } catch {
      setError('No se pudieron cargar las alertas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAlerts({ recompute: true });
  }, []);

  useEffect(() => {
    refreshAlerts();
  }, [range, severity, status, search]);

  const handleAck = async (alertId) => {
    setBusyId(alertId);
    try {
      await acknowledgeAlert(alertId);
      await refreshAlerts();
    } catch {
      setError('No se pudo reconocer la alerta.');
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async (alertId) => {
    setBusyId(alertId);
    try {
      await resolveAlert(alertId);
      await refreshAlerts();
    } catch {
      setError('No se pudo resolver la alerta.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-6 py-6 space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[160px_180px_180px_1fr_auto] gap-2 items-end">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Rango</label>
            <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="all">Todo</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Severidad</label>
            <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="all">Todas</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARN">Warn</option>
              <option value="INFO">Info</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Estado</label>
            <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="OPEN">Abiertas</option>
              <option value="ACK">Reconocidas</option>
              <option value="RESOLVED">Resueltas</option>
              <option value="all">Todas</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Buscar marquesina</label>
            <input
              className="w-full h-9 border border-gray-300 rounded px-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código o nombre"
            />
          </div>
          <button className="pc-action-btn h-9" onClick={() => refreshAlerts({ recompute: true })} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar reglas'}
          </button>
        </div>

        {error && <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded px-3 py-2">{error}</div>}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
            {alerts.length} alertas
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">Severidad</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Marquesina</th>
                  <th className="text-left px-3 py-2">Desde</th>
                  <th className="text-left px-3 py-2">Última vez</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className={`border-t border-gray-100 cursor-pointer ${selectedAlertId === alert.id ? 'bg-slate-50' : ''}`}
                    onClick={() => setSelectedAlertId(alert.id)}
                  >
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${severityBadgeClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2">{typeLabel(alert.type)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{alert.stopCode}</div>
                      <div className="text-xs text-gray-500">{stopNameByCode.get(alert.stopCode) || 'Sin nombre'}</div>
                    </td>
                    <td className="px-3 py-2">{formatDateTime(alert.firstSeenAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(alert.lastSeenAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${statusBadgeClass(alert.status)}`}>
                        {statusLabel(alert.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="pc-action-btn h-7 px-2"
                          disabled={alert.status !== 'OPEN' || busyId === alert.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAck(alert.id);
                          }}
                        >
                          Reconocer
                        </button>
                        <button
                          className="pc-action-btn h-7 px-2"
                          disabled={alert.status === 'RESOLVED' || busyId === alert.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(alert.id);
                          }}
                        >
                          Resolver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && alerts.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-gray-500" colSpan={7}>No hay alertas para los filtros seleccionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="bg-white border border-gray-200 rounded-lg p-4">
          {!selectedAlert ? (
            <div className="text-sm text-gray-500">Selecciona una alerta para ver detalle.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{typeLabel(selectedAlert.type)}</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedAlert.message}</p>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <div><strong>Marquesina:</strong> {selectedAlert.stopCode}</div>
                <div><strong>Estado:</strong> {statusLabel(selectedAlert.status)}</div>
                <div><strong>Severidad:</strong> {selectedAlert.severity}</div>
                <div><strong>Desde:</strong> {formatDateTime(selectedAlert.firstSeenAt)}</div>
                <div><strong>Última vez:</strong> {formatDateTime(selectedAlert.lastSeenAt)}</div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Métricas disparadoras</h4>
                <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                  {Object.entries(selectedAlert.metricsSnapshot || {}).map(([key, value]) => (
                    <div key={key} className="px-3 py-2 flex items-center justify-between text-sm">
                      <span className="text-gray-600">{key}</span>
                      <strong className="text-gray-800">{prettyMetricValue(value)}</strong>
                    </div>
                  ))}
                  {Object.keys(selectedAlert.metricsSnapshot || {}).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Sin métricas disponibles.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
