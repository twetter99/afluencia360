import { useEffect, useMemo, useState } from 'react';
import {
  getCrtmConnectorConfig,
  updateCrtmConnectorConfig,
  getCrtmConnectorDatasets,
  executeCrtmConnector,
  listCrtmConnectorRuns,
  getCrtmConnectorDownloadUrl,
} from '../services/api';

function formatDateTime(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('es-ES', { hour12: false });
}

function statusClass(status) {
  if (status === 'OK') return 'text-emerald-700 bg-emerald-100 border-emerald-200';
  if (status === 'ERROR') return 'text-red-700 bg-red-100 border-red-200';
  return 'text-slate-700 bg-slate-100 border-slate-200';
}

export default function IntegrationsDashboard({ stops = [] }) {
  const [activeTab, setActiveTab] = useState('config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState({
    deliveryMode: 'SFTP',
    credentialsRef: 'secret://crtm/sftp',
    whitelist: '',
    format: 'CSV',
    frequency: 'Manual',
    datasets: ['afluencia_daily'],
    stopCodes: [],
    enabled: true,
  });
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);

  const [executionDataset, setExecutionDataset] = useState('afluencia_daily');
  const [executionPreset, setExecutionPreset] = useState('yesterday');
  const [executionStartDate, setExecutionStartDate] = useState('');
  const [executionEndDate, setExecutionEndDate] = useState('');
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [configRes, datasetRes, runsRes] = await Promise.all([
          getCrtmConnectorConfig(),
          getCrtmConnectorDatasets(),
          listCrtmConnectorRuns(),
        ]);

        const nextConfig = configRes?.data || {};
        setConfig((prev) => ({ ...prev, ...nextConfig }));
        setExecutionDataset((nextConfig.datasets && nextConfig.datasets[0]) || 'afluencia_daily');
        setDatasets(Array.isArray(datasetRes?.data) ? datasetRes.data : []);
        setRuns(Array.isArray(runsRes?.data) ? runsRes.data : []);
      } catch {
        setError('No se pudo cargar CRTM Connector.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedStopsCount = (config.stopCodes || []).length;

  const availableDatasetIds = useMemo(() => datasets.map((item) => item.id), [datasets]);

  const handleConfigSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await updateCrtmConnectorConfig(config);
      setConfig(response?.data || config);
    } catch {
      setError('No se pudo guardar la configuración del conector.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDataset = (datasetId) => {
    setConfig((prev) => {
      const current = Array.isArray(prev.datasets) ? prev.datasets : [];
      const exists = current.includes(datasetId);
      const nextDatasets = exists
        ? current.filter((item) => item !== datasetId)
        : [...current, datasetId];
      return {
        ...prev,
        datasets: nextDatasets.length > 0 ? nextDatasets : ['afluencia_daily'],
      };
    });
  };

  const toggleStop = (stopCode) => {
    setConfig((prev) => {
      const current = Array.isArray(prev.stopCodes) ? prev.stopCodes : [];
      const exists = current.includes(stopCode);
      return {
        ...prev,
        stopCodes: exists ? current.filter((item) => item !== stopCode) : [...current, stopCode],
      };
    });
  };

  const runExecution = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        datasetId: executionDataset,
        rangePreset: executionPreset,
        retry,
      };
      if (executionPreset === 'custom') {
        payload.startDate = executionStartDate;
        payload.endDate = executionEndDate;
      }

      await executeCrtmConnector(payload);
      const runsRes = await listCrtmConnectorRuns();
      setRuns(Array.isArray(runsRes?.data) ? runsRes.data : []);
      setActiveTab('audit');
    } catch {
      setError('No se pudo ejecutar la exportación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-6 space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h1 className="text-lg font-semibold text-gray-800">Integraciones</h1>
        <p className="text-sm text-gray-600 mt-1">
          CRTM Data Export — Exportación segura y trazable de datos hacia infraestructura CRTM (SFTP/API/VPN), con control de versiones y auditoría.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`pc-action-btn h-8 px-3 ${activeTab === 'config' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setActiveTab('config')}>Configuración</button>
          <button className={`pc-action-btn h-8 px-3 ${activeTab === 'datasets' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setActiveTab('datasets')}>Datasets</button>
          <button className={`pc-action-btn h-8 px-3 ${activeTab === 'execution' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setActiveTab('execution')}>Ejecución</button>
          <button className={`pc-action-btn h-8 px-3 ${activeTab === 'audit' ? 'bg-slate-800 text-white border-slate-800' : ''}`} onClick={() => setActiveTab('audit')}>Histórico / Auditoría</button>
        </div>
      </section>

      {error && <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded px-3 py-2">{error}</div>}

      {activeTab === 'config' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Modo de entrega</label>
              <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={config.deliveryMode || 'SFTP'} onChange={(e) => setConfig((prev) => ({ ...prev, deliveryMode: e.target.value }))}>
                <option value="SFTP">SFTP</option>
                <option value="API_REST">API REST</option>
                <option value="VPN_DB">VPN-DB</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Formato</label>
              <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={config.format || 'CSV'} onChange={(e) => setConfig((prev) => ({ ...prev, format: e.target.value }))}>
                <option value="CSV">CSV</option>
                <option value="JSON">JSON</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Frecuencia</label>
              <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={config.frequency || 'Manual'} onChange={(e) => setConfig((prev) => ({ ...prev, frequency: e.target.value }))}>
                <option value="Manual">Manual</option>
                <option value="Diaria">Diaria</option>
                <option value="Horaria">Horaria</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Credenciales (referencia segura)</label>
              <input className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={config.credentialsRef || ''} onChange={(e) => setConfig((prev) => ({ ...prev, credentialsRef: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-600 block mb-1">Whitelist IP / Certificados (informativo)</label>
              <input className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={config.whitelist || ''} onChange={(e) => setConfig((prev) => ({ ...prev, whitelist: e.target.value }))} placeholder="Ej: 10.20.30.0/24 · cert-2026-crtm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">Ámbito de marquesinas ({selectedStopsCount})</label>
            <div className="border border-gray-300 rounded p-2 max-h-28 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
              {stops.map((stop) => (
                <label key={stop.stopCode} className="text-xs text-gray-700 flex items-center gap-2">
                  <input type="checkbox" checked={(config.stopCodes || []).includes(stop.stopCode)} onChange={() => toggleStop(stop.stopCode)} />
                  <span className="truncate">{stop.stopCode} — {stop.name || stop.location || 'Sin nombre'}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="pc-action-btn h-9" onClick={handleConfigSave} disabled={loading}>Guardar configuración</button>
        </section>
      )}

      {activeTab === 'datasets' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="text-sm text-gray-600">Contrato de datos versionado del conector CRTM.</div>
          <div className="space-y-3">
            {datasets.map((dataset) => (
              <div key={dataset.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{dataset.id}</div>
                    <div className="text-xs text-gray-500">{dataset.description}</div>
                    <div className="text-xs text-gray-500 mt-1">Versión: {dataset.version}{dataset.roadmap ? ' · Roadmap' : ''}</div>
                  </div>
                  <label className="text-xs text-gray-700 flex items-center gap-2">
                    <input type="checkbox" checked={(config.datasets || []).includes(dataset.id)} onChange={() => toggleDataset(dataset.id)} />
                    Exportar
                  </label>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Esquema: {dataset.fields.join(', ')}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Ejemplo: {dataset.fields.map((f) => `${f}=...`).join(' | ')}
                </div>
              </div>
            ))}
          </div>
          <button className="pc-action-btn h-9" onClick={handleConfigSave} disabled={loading}>Guardar datasets activos</button>
        </section>
      )}

      {activeTab === 'execution' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Dataset</label>
              <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={executionDataset} onChange={(e) => setExecutionDataset(e.target.value)}>
                {availableDatasetIds.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Rango</label>
              <select className="w-full h-9 border border-gray-300 rounded px-2 text-sm" value={executionPreset} onChange={(e) => setExecutionPreset(e.target.value)}>
                <option value="yesterday">Ayer</option>
                <option value="last7d">Últimos 7 días</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            {executionPreset === 'custom' && (
              <>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Inicio</label>
                  <input className="w-full h-9 border border-gray-300 rounded px-2 text-sm" type="date" value={executionStartDate} onChange={(e) => setExecutionStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Fin</label>
                  <input className="w-full h-9 border border-gray-300 rounded px-2 text-sm" type="date" value={executionEndDate} onChange={(e) => setExecutionEndDate(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <label className="text-sm text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={retry} onChange={(e) => setRetry(e.target.checked)} />
            Reenviar si hubo error
          </label>

          <button className="pc-action-btn h-9" onClick={runExecution} disabled={loading}>
            {loading ? 'Ejecutando...' : 'Ejecutar exportación ahora'}
          </button>
        </section>
      )}

      {activeTab === 'audit' && (
        <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">Histórico / Auditoría ({runs.length})</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">Fecha/hora</th>
                  <th className="text-left px-3 py-2">Dataset</th>
                  <th className="text-left px-3 py-2">Periodo</th>
                  <th className="text-right px-3 py-2">Registros</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Detalle</th>
                  <th className="text-right px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{formatDateTime(run.createdAt)}</td>
                    <td className="px-3 py-2">{run.datasetId}</td>
                    <td className="px-3 py-2">{run?.period?.startDate} — {run?.period?.endDate}</td>
                    <td className="px-3 py-2 text-right">{run.recordsCount || 0}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${statusClass(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{run.detailMessage || '—'} · checksum: {String(run.checksum || '').slice(0, 10)}…</td>
                    <td className="px-3 py-2 text-right">
                      <a className="pc-action-btn h-7 px-2 inline-flex items-center" href={getCrtmConnectorDownloadUrl(run.id)} target="_blank" rel="noreferrer">
                        Descargar fichero
                      </a>
                    </td>
                  </tr>
                ))}
                {!loading && runs.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-gray-500" colSpan={7}>No hay ejecuciones registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
