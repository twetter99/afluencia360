import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import afluenciaLogo from './assets/afluencia360-logo-transparent.png';
import crtmHeroImage from './assets/crtm-hero-photo.jpg';
import crtmLogoOficial from './assets/crtm-logo-oficial.png';
import {
  getStops,
  getDashboardCards,
  getAggregateDashboard,
  getDashboardData
} from './services/api';

const SCREEN_PAGE_SIZE = 12;
const preloadAnalyticsDashboard = () => import('./components/AnalyticsDashboard');
const UploadExcel = lazy(() => import('./components/UploadExcel'));
const ManualUpload = lazy(() => import('./components/ManualUpload'));
const StopsManager = lazy(() => import('./components/StopsManager'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const AnalyticsDashboard = lazy(preloadAnalyticsDashboard);
const ComparativesDashboard = lazy(() => import('./components/ComparativesDashboard'));
const AlertsDashboard = lazy(() => import('./components/AlertsDashboard'));
const ReportsDashboard = lazy(() => import('./components/ReportsDashboard'));
const IntegrationsDashboard = lazy(() => import('./components/IntegrationsDashboard'));

function App() {
  const [stops, setStops] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedStopCodes, setSelectedStopCodes] = useState([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [dateRange, setDateRange] = useState(() => getPresetRange('7d'));
  const [rangePreset, setRangePreset] = useState('7d');
  const [availableDateBounds, setAvailableDateBounds] = useState({ minDate: '', maxDate: '' });
  const [stopSearch, setStopSearch] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [screenSearch, setScreenSearch] = useState('');
  const [screenSort, setScreenSort] = useState('afluencia');
  const [screenPage, setScreenPage] = useState(1);
  const [trendByStop, setTrendByStop] = useState({});
  const [error, setError] = useState(null);

  const handlePrefetchAnalytics = useCallback(() => {
    preloadAnalyticsDashboard().catch(() => {});
  }, []);

  const filteredStops = useMemo(() => {
    const term = stopSearch.trim().toLowerCase();
    if (!term) return stops;
    return stops.filter((stop) => (
      stop.stopCode?.toLowerCase().includes(term)
      || stop.name?.toLowerCase().includes(term)
      || stop.location?.toLowerCase().includes(term)
    ));
  }, [stops, stopSearch]);

  const selectedCards = useMemo(() => (
    cards.filter((card) => selectedStopCodes.includes(card.stopCode))
  ), [cards, selectedStopCodes]);

  const screenCards = useMemo(() => {
    const term = screenSearch.trim().toLowerCase();
    const base = cards.filter((card) => (
      !term
      || card.stopCode?.toLowerCase().includes(term)
      || card.entity?.toLowerCase().includes(term)
    ));

    const now = new Date();
    const withMetrics = base.map((card) => {
      const totalAfluencia = card.totals?.totalNumber || 0;
      const isOffline = (card.totalRecords || 0) === 0;
      const latestDate = card.lastDate || card.latestDate;
      const latestTs = latestDate ? new Date(`${latestDate}T00:00:00`).getTime() : 0;
      const hoursSinceLatest = latestTs ? (now.getTime() - latestTs) / (1000 * 60 * 60) : Infinity;
      const inLast24h = hoursSinceLatest <= 24;
      const alertScore = (isOffline ? 1 : 0) + (!inLast24h ? 1 : 0) + (totalAfluencia === 0 ? 1 : 0);
      return {
        ...card,
        totalAfluencia,
        isOffline,
        inLast24h,
        alertScore,
        latestDate,
        latestTs,
      };
    });

    withMetrics.sort((a, b) => {
      if (screenSort === 'offline') {
        if (a.isOffline !== b.isOffline) return a.isOffline ? -1 : 1;
        return b.totalAfluencia - a.totalAfluencia;
      }
      if (screenSort === 'alertas') {
        if (b.alertScore !== a.alertScore) return b.alertScore - a.alertScore;
        return b.totalAfluencia - a.totalAfluencia;
      }
      if (screenSort === 'ultimas24h') {
        if (a.inLast24h !== b.inLast24h) return a.inLast24h ? -1 : 1;
        return (b.latestTs || 0) - (a.latestTs || 0);
      }
      return b.totalAfluencia - a.totalAfluencia;
    });

    return withMetrics;
  }, [cards, screenSearch, screenSort]);

  const totalScreenPages = useMemo(
    () => Math.max(1, Math.ceil(screenCards.length / SCREEN_PAGE_SIZE)),
    [screenCards.length]
  );

  const currentScreenPage = Math.min(screenPage, totalScreenPages);

  const pagedScreenCards = useMemo(() => {
    const start = (currentScreenPage - 1) * SCREEN_PAGE_SIZE;
    return screenCards.slice(start, start + SCREEN_PAGE_SIZE);
  }, [screenCards, currentScreenPage]);

  const appliedRangeLabel = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return 'Sin rango aplicado';
    return `${formatDateLabel(dateRange.startDate)} — ${formatDateLabel(dateRange.endDate)}`;
  }, [dateRange]);

  const hasNoDataForRange = useMemo(() => {
    return !loading && !error && cards.length === 0 && !!dateRange.startDate && !!dateRange.endDate;
  }, [loading, error, cards.length, dateRange]);

  const fetchStopsAndCards = useCallback(async () => {
    try {
      const [stopsResult, cardsResult, availabilityResult] = await Promise.all([
        getStops(),
        getDashboardCards(dateRange.startDate || undefined, dateRange.endDate || undefined),
        getDashboardCards('2000-01-01', formatISODate(new Date()))
      ]);

      if (stopsResult.success) {
        setStops(stopsResult.data);
        if (stopsResult.data.length > 0 && selectedStopCodes.length === 0) {
          setSelectedStopCodes(stopsResult.data.map((stop) => stop.stopCode));
        }
      }

      if (cardsResult.success) {
        setCards(cardsResult.data);
      }

      if (availabilityResult.success) {
        const bounds = getAvailableDateBounds(availabilityResult.data);
        if (bounds.minDate && bounds.maxDate) {
          setAvailableDateBounds((prev) => (
            prev.minDate === bounds.minDate && prev.maxDate === bounds.maxDate ? prev : bounds
          ));
        }
      }
    } catch {
      setError('Error al cargar marquesinas. Verifica que el servidor esté activo.');
    }
  }, [dateRange, selectedStopCodes.length]);

  const fetchDashboard = useCallback(async () => {
    if (selectedStopCodes.length === 0) {
      setDashboardData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getAggregateDashboard(
        selectedStopCodes,
        dateRange.startDate || undefined,
        dateRange.endDate || undefined
      );
      setDashboardData(result.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setDashboardData(null);
      } else {
        setError('Error al cargar datos. Verifica que el servidor esté activo.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedStopCodes, dateRange]);

  useEffect(() => {
    fetchStopsAndCards();
  }, [fetchStopsAndCards]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrendData() {
      if (cards.length === 0) {
        setTrendByStop({});
        return;
      }

      const entries = await Promise.all(cards.map(async (card) => {
        try {
          const result = await getDashboardData(
            card.stopCode,
            dateRange.startDate || undefined,
            dateRange.endDate || undefined
          );
          const records = Array.isArray(result?.data?.records) ? result.data.records : [];
          const byDate = new Map();
          for (const row of records) {
            if (!row?.date) continue;
            const current = byDate.get(row.date) || 0;
            byDate.set(row.date, current + (row?.totals?.totalNumber || 0));
          }
          const series = [...byDate.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12)
            .map(([, value]) => value);
          return [card.stopCode, series];
        } catch {
          return [card.stopCode, []];
        }
      }));

      if (!cancelled) {
        setTrendByStop(Object.fromEntries(entries));
      }
    }

    loadTrendData();
    return () => {
      cancelled = true;
    };
  }, [cards, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    setScreenPage(1);
  }, [screenSearch, screenSort]);

  useEffect(() => {
    if (screenPage > totalScreenPages) {
      setScreenPage(totalScreenPages);
    }
  }, [screenPage, totalScreenPages]);

  useEffect(() => {
    if (currentPage === 'dashboard') {
      fetchDashboard();
    }
  }, [fetchDashboard, currentPage]);

  const handleUploadSuccess = () => {
    setShowUpload(false);
    fetchStopsAndCards();
    setTimeout(fetchDashboard, 500);
  };

  const toggleStopSelection = (stopCode) => {
    setSelectedStopCodes((prev) => {
      if (prev.includes(stopCode)) {
        if (prev.length === 1) return prev;
        return prev.filter((code) => code !== stopCode);
      }
      return [...prev, stopCode];
    });
  };

  const applyRangePreset = (preset) => {
    setRangePreset(preset);
    if (preset === 'custom') return;
    setDateRange(getPresetRange(preset));
  };

  const handleCustomDateChange = (field, value) => {
    setRangePreset('custom');
    setDateRange((prev) => normalizeCustomRange({ ...prev, [field]: value }));
  };

  const handleGlobalStopChange = (value) => {
    if (value === 'all') {
      setSelectedStopCodes(stops.map((stop) => stop.stopCode));
      return;
    }
    if (!value) return;
    setSelectedStopCodes([value]);
  };

  const selectedStopControlValue = selectedStopCodes.length === stops.length
    ? 'all'
    : (selectedStopCodes.length === 1 ? selectedStopCodes[0] : '');

  const exportRows = selectedCards.map((card) => ({
    stopCode: card.stopCode || '',
    entity: card.entity || '',
    totalRecords: card.totalRecords || 0,
    totalPeople: card.totals?.totalNumber || 0,
    deduplication: card.totals?.afterDeduplication || 0,
    firstDate: card.firstDate || '',
    lastDate: card.lastDate || '',
    peakHour: typeof card.peakHour === 'string' ? card.peakHour : (card.peakHour?.hour || ''),
  }));

  const actionableKpis = useMemo(() => {
    const totalAfluencia = dashboardData?.summary?.totals?.totalNumber
      ?? selectedCards.reduce((acc, card) => acc + (card.totals?.totalNumber || 0), 0);

    const aggregateRecords = Array.isArray(dashboardData?.records) ? dashboardData.records : [];
    const daysWithData = aggregateRecords.length;
    const mediaDiaria = daysWithData > 0 ? Math.round(totalAfluencia / daysWithData) : 0;

    let peakDay = null;
    for (const dayRow of aggregateRecords) {
      const dayTotal = dayRow?.totals?.totalNumber || 0;
      if (!peakDay || dayTotal > peakDay.total) {
        peakDay = { date: dayRow.date, total: dayTotal, hour: dayRow?.peakHour?.hour || null };
      }
    }

    const rankedStops = [...selectedCards]
      .map((card) => ({
        stopCode: card.stopCode,
        name: card.entity || card.stopCode,
        total: card.totals?.totalNumber || 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalAfluencia,
      mediaDiaria,
      peakDay,
      top3: rankedStops.slice(0, 3),
      worst: rankedStops.length > 0 ? rankedStops[rankedStops.length - 1] : null,
    };
  }, [dashboardData, selectedCards]);

  const communicationStatus = useMemo(() => {
    const online = selectedCards.filter((card) => (card.totalRecords || 0) > 0).length;
    const offline = selectedCards.filter((card) => (card.totalRecords || 0) === 0).length;
    const apagado = 0;
    return {
      online,
      offline,
      apagado,
      screensInUse: online,
    };
  }, [selectedCards]);

  const alertMetrics = useMemo(() => {
    const now = new Date();
    const offline = selectedCards.filter((card) => (card.totalRecords || 0) === 0).length;
    const noData24h = selectedCards.filter((card) => {
      const latest = card.lastDate || card.latestDate;
      if (!latest) return true;
      const hoursDiff = (now.getTime() - new Date(`${latest}T00:00:00`).getTime()) / (1000 * 60 * 60);
      return hoursDiff > 24;
    }).length;
    const noPeakHour = selectedCards.filter((card) => !card.peakHour || !card.peakHour.hour).length;
    const noTraffic = selectedCards.filter((card) => !card.trafficTotals).length;
    const dedupZero = selectedCards.filter((card) => (card.totals?.afterDeduplication || 0) === 0).length;
    const totalAlerts = offline + noData24h + noPeakHour + noTraffic + dedupZero;

    return {
      offline,
      noData24h,
      noPeakHour,
      noTraffic,
      dedupZero,
      totalAlerts,
    };
  }, [selectedCards]);

  const handleExport = (format) => {
    if (exportRows.length === 0) return;
    const headers = ['Marquesina', 'Entidad', 'Registros', 'Personas', 'Deduplicado', 'Fecha inicio', 'Fecha fin', 'Hora pico'];
    const dataLines = exportRows.map((row) => [
      row.stopCode,
      row.entity,
      row.totalRecords,
      row.totalPeople,
      row.deduplication,
      row.firstDate,
      row.lastDate,
      row.peakHour,
    ]);

    const separator = format === 'excel' ? '\t' : ',';
    const content = [headers, ...dataLines]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(separator))
      .join('\n');

    const blob = new Blob([content], {
      type: format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8;' : 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const extension = format === 'excel' ? 'xls' : 'csv';
    link.href = url;
    link.download = `afluencia360_${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pc-shell">
      <aside className="pc-sidebar">
        <div className="pc-logo-wrap">
          <img src={afluenciaLogo} alt="Afluencia360" className="pc-logo-img" />
        </div>
        <nav className="pc-nav">
          <button className={`pc-nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            Inicio
          </button>
          <button className={`pc-nav-item ${currentPage === 'upload' ? 'active' : ''}`} onClick={() => { setCurrentPage('upload'); setShowUpload(false); }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Carga y validación
          </button>
          <button className={`pc-nav-item ${currentPage === 'stops' ? 'active' : ''}`} onClick={() => setCurrentPage('stops')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
            Marquesinas
          </button>
          <button
            className={`pc-nav-item ${currentPage === 'analytics' ? 'active' : ''}`}
            onMouseEnter={handlePrefetchAnalytics}
            onFocus={handlePrefetchAnalytics}
            onClick={() => { setCurrentPage('analytics'); setShowUpload(false); }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Dashboards
          </button>
          <button className={`pc-nav-item ${currentPage === 'comparatives' ? 'active' : ''}`} onClick={() => setCurrentPage('comparatives')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg>
            Comparativas
          </button>
          <button className={`pc-nav-item ${currentPage === 'alerts' ? 'active' : ''}`} onClick={() => setCurrentPage('alerts')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Alertas
          </button>
          <button className={`pc-nav-item ${currentPage === 'reports' ? 'active' : ''}`} onClick={() => setCurrentPage('reports')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Informes
          </button>

          <div className="pc-nav-divider" />

          <button className={`pc-nav-item ${currentPage === 'integrations' ? 'active' : ''}`} onClick={() => setCurrentPage('integrations')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Integraciones
          </button>
        </nav>

        <div className="pc-sidebar-footer">
          <div className="pc-user">Admin Admin</div>
          <div className="pc-clock">{new Date().toLocaleTimeString('es-ES', { hour12: false })}</div>
        </div>
      </aside>

      <main className="pc-main">
        <Suspense fallback={<div className="px-6 py-8 text-sm text-gray-500">Cargando vista...</div>}>
          {showUpload && (
            <UploadExcel
              onSuccess={handleUploadSuccess}
              onClose={() => setShowUpload(false)}
            />
          )}

          {currentPage === 'stops' ? (
            <div className="px-6 py-6">
              <StopsManager
                stops={stops}
                onUpdated={async () => {
                  await fetchStopsAndCards();
                }}
              />
            </div>
          ) : currentPage === 'upload' ? (
            <ManualUpload
              stops={stops}
              onSuccess={() => {
                setCurrentPage('dashboard');
                fetchStopsAndCards();
                setTimeout(fetchDashboard, 500);
              }}
              onCancel={() => setCurrentPage('dashboard')}
            />
          ) : currentPage === 'analytics' ? (
            <AnalyticsDashboard stops={stops} />
          ) : currentPage === 'comparatives' ? (
            <ComparativesDashboard stops={stops} />
          ) : currentPage === 'alerts' ? (
            <AlertsDashboard stops={stops} />
          ) : currentPage === 'reports' ? (
            <ReportsDashboard stops={stops} />
          ) : currentPage === 'integrations' ? (
            <IntegrationsDashboard stops={stops} />
          ) : (
            <>
              <section className="pc-hero">
                <img
                  className="pc-hero-image"
                  src={crtmHeroImage}
                  alt="Imagen corporativa CRTM"
                />
                <div className="pc-hero-overlay" />
                <img
                  className="absolute top-4 right-5 w-[220px] md:w-[300px] h-auto z-10"
                  src={crtmLogoOficial}
                  alt="Logo Consorcio Regional de Transportes de Madrid"
                />
                <div className="pc-hero-content">
                  <h1>Afluencia360</h1>
                  <p>Tablero de Afluencia</p>
                </div>
              </section>

              <div className="pc-global-filter-bar">
                <div className="pc-global-filter-grid">
                  <div className="pc-filter-group">
                    <label>Rango de fechas</label>
                    <div className="pc-preset-row">
                      <button className={`pc-preset-btn ${rangePreset === 'today' ? 'active' : ''}`} onClick={() => applyRangePreset('today')}>Hoy</button>
                      <button className={`pc-preset-btn ${rangePreset === '7d' ? 'active' : ''}`} onClick={() => applyRangePreset('7d')}>7 días</button>
                      <button className={`pc-preset-btn ${rangePreset === '30d' ? 'active' : ''}`} onClick={() => applyRangePreset('30d')}>30 días</button>
                      <button className={`pc-preset-btn ${rangePreset === 'custom' ? 'active' : ''}`} onClick={() => applyRangePreset('custom')}>Personalizado</button>
                    </div>
                    {rangePreset === 'custom' && (
                      <div className="pc-date-row">
                        <input
                          type="date"
                          value={dateRange.startDate}
                          max={formatISODate(new Date())}
                          onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                        />
                        <input
                          type="date"
                          value={dateRange.endDate}
                          max={formatISODate(new Date())}
                          onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                        />
                      </div>
                    )}
                    {availableDateBounds.minDate && (
                      <p className="text-[11px] text-gray-500">
                        Datos disponibles: {formatDateLabel(availableDateBounds.minDate)} — {formatDateLabel(availableDateBounds.maxDate)}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-600 font-medium">
                      Rango aplicado: {appliedRangeLabel}
                    </p>
                  </div>

                  <div className="pc-filter-group">
                    <label>Marquesina</label>
                    <input
                      type="text"
                      placeholder="Buscar por código o nombre"
                      value={stopSearch}
                      onChange={(e) => setStopSearch(e.target.value)}
                    />
                    <select value={selectedStopControlValue} onChange={(e) => handleGlobalStopChange(e.target.value)}>
                      <option value="all">Todas las marquesinas</option>
                      {selectedStopCodes.length > 1 && <option value="">Selección manual</option>}
                      {filteredStops.map((stop) => (
                        <option key={stop.stopCode} value={stop.stopCode}>
                          {stop.stopCode} — {stop.name || stop.location || 'Sin nombre'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pc-filter-group">
                    <label>Operador / Línea / Zona</label>
                    <div className="pc-three-row">
                      <select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)} disabled>
                        <option value="">Operador (pendiente backend)</option>
                      </select>
                      <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} disabled>
                        <option value="">Línea (pendiente backend)</option>
                      </select>
                      <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} disabled>
                        <option value="">Zona (pendiente backend)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pc-filter-actions">
                    <button className="pc-action-btn" onClick={() => handleExport('csv')} disabled={exportRows.length === 0}>Exportar CSV</button>
                    <button className="pc-action-btn" onClick={() => handleExport('excel')} disabled={exportRows.length === 0}>Exportar Excel</button>
                    <button className="pc-upload-btn" onClick={() => setShowUpload(true)}>Carga y validación</button>
                  </div>
                </div>
                {hasNoDataForRange && (
                  <div className="mt-2 px-3 py-2 rounded border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                    No hay datos para el rango seleccionado ({appliedRangeLabel}).
                  </div>
                )}
              </div>

              <section className="pc-section">
                <h2 className="pc-title">TABLERO</h2>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
                  <div className="pc-kpi-card">
                    <h3>AFLUENCIA TOTAL DEL RANGO</h3>
                    <div className="pc-big-number">{formatNumber(actionableKpis.totalAfluencia)}</div>
                    <p className="pc-sub">Personas detectadas en {appliedRangeLabel}</p>
                  </div>

                  <div className="pc-kpi-card">
                    <h3>MEDIA DIARIA Y PICO</h3>
                    <div className="text-[34px] leading-none text-gray-700">{formatNumber(actionableKpis.mediaDiaria)}</div>
                    <p className="pc-sub">Media diaria</p>
                    <div className="text-xs text-gray-600 mt-1">
                      <strong>Pico día:</strong> {actionableKpis.peakDay?.date ? formatDateLabel(actionableKpis.peakDay.date) : '—'}
                    </div>
                    <div className="text-xs text-gray-600">
                      <strong>Pico hora:</strong> {actionableKpis.peakDay?.hour || '—'}
                    </div>
                  </div>

                  <div className="pc-kpi-card">
                    <h3>INSIGHT INMEDIATO</h3>
                    <div className="text-xs text-gray-600 space-y-1 mt-1">
                      {actionableKpis.top3.length > 0 ? (
                        actionableKpis.top3.map((stop, index) => (
                          <div key={stop.stopCode} className="flex justify-between border-b border-gray-100 pb-1">
                            <span>Top {index + 1}: {stop.stopCode}</span>
                            <strong>{formatNumber(stop.total)}</strong>
                          </div>
                        ))
                      ) : (
                        <div>Sin datos para ranking.</div>
                      )}
                      <div className="flex justify-between pt-1 text-red-600">
                        <span>Peor: {actionableKpis.worst?.stopCode || '—'}</span>
                        <strong>{formatNumber(actionableKpis.worst?.total || 0)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {hasNoDataForRange && (
                  <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-sm">
                    No hay datos para el rango seleccionado ({appliedRangeLabel}).
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="py-14 text-center text-gray-500">Cargando datos...</div>
                ) : (
                  <div className="pc-kpi-grid">
                    <div className="pc-kpi-card">
                      <h3>ESTADO DE COMUNICACIÓN</h3>
                      <div className="pc-big-number">{communicationStatus.screensInUse}</div>
                      <p className="pc-sub">Pantallas en uso</p>
                      <div className="pc-bars">
                        <StatusBar
                          label="ONLINE"
                          value={communicationStatus.online}
                          tone="ok"
                        />
                        <StatusBar
                          label="OFFLINE"
                          value={communicationStatus.offline}
                          tone="error"
                        />
                        <StatusBar
                          label="APAGADO"
                          value={communicationStatus.apagado}
                          tone="neutral"
                        />
                      </div>
                    </div>

                    <div className="pc-kpi-card">
                      <h3>RENDIMIENTO</h3>
                      <div className="pc-performance">
                        <div className="pc-ring" style={{ ['--pct']: `${dashboardPercentage(cards, selectedStopCodes)}%` }}>
                          <span>{dashboardPercentage(cards, selectedStopCodes)}%</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <StatusChip status="Online" />
                            <strong className="text-xs text-gray-700">{communicationStatus.online}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <StatusChip status="Offline" />
                            <strong className="text-xs text-gray-700">{communicationStatus.offline}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <StatusChip status="Apagado" />
                            <strong className="text-xs text-gray-700">{communicationStatus.apagado}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pc-kpi-card">
                      <h3>ALERTAS</h3>
                      <div className="pc-alerts-grid">
                          <div><strong>{alertMetrics.noData24h}</strong><span>Sin dato 24h</span></div>
                          <div><strong>{alertMetrics.noPeakHour}</strong><span>Sin hora pico</span></div>
                          <div><strong>{alertMetrics.noTraffic}</strong><span>Sin tráfico</span></div>
                          <div><strong>{alertMetrics.dedupZero}</strong><span>Deduplicación 0</span></div>
                          <div><strong>{alertMetrics.totalAlerts}</strong><span>Total alertas</span></div>
                          <div className="critical"><strong>{alertMetrics.offline}</strong><span>Offline</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="pc-section pt-2">
                <h2 className="pc-title">VISTA DE PANTALLAS</h2>
                <div className="mb-3 grid grid-cols-1 md:grid-cols-[1fr_240px] gap-2">
                  <input
                    type="text"
                    value={screenSearch}
                    onChange={(e) => setScreenSearch(e.target.value)}
                    placeholder="Buscar marquesina por código o nombre"
                    className="h-9 bg-white border border-gray-300 rounded px-3 text-sm text-gray-700"
                  />
                  <select
                    value={screenSort}
                    onChange={(e) => setScreenSort(e.target.value)}
                    className="h-9 bg-white border border-gray-300 rounded px-3 text-sm text-gray-700"
                  >
                    <option value="afluencia">Ordenar por afluencia</option>
                    <option value="offline">Ordenar por offline</option>
                    <option value="alertas">Ordenar por alertas</option>
                    <option value="ultimas24h">Ordenar por últimas 24h</option>
                  </select>
                </div>

                <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Mostrando {screenCards.length === 0 ? 0 : ((currentScreenPage - 1) * SCREEN_PAGE_SIZE + 1)}-
                    {Math.min(currentScreenPage * SCREEN_PAGE_SIZE, screenCards.length)} de {screenCards.length} marquesinas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="pc-action-btn h-8 px-2"
                      onClick={() => setScreenPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentScreenPage === 1}
                    >
                      Anterior
                    </button>
                    <span>Página {currentScreenPage}/{totalScreenPages}</span>
                    <button
                      className="pc-action-btn h-8 px-2"
                      onClick={() => setScreenPage((prev) => Math.min(totalScreenPages, prev + 1))}
                      disabled={currentScreenPage === totalScreenPages}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {pagedScreenCards.map((card) => {
                    const selected = selectedStopCodes.includes(card.stopCode);
                    const trend = trendByStop[card.stopCode] || [];
                    const sparkline = buildSparklinePath(trend, 120, 28);
                    return (
                      <button
                        key={card.stopCode}
                        onClick={() => toggleStopSelection(card.stopCode)}
                        className={`pc-preview-card ${selected ? 'selected' : ''} ${card.isOffline ? 'error' : 'ok'}`}
                      >
                        <div className="pc-preview-header">{card.stopCode}</div>
                        <div className="pc-preview-body">
                          <p className="text-xs text-slate-400 truncate">{card.entity}</p>
                          <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
                            <span>Estado</span>
                            <StatusChip status={card.isOffline ? 'Offline' : 'Online'} />
                          </div>
                          <div className="text-[11px] text-slate-500 flex justify-between">
                            <span>Afluencia rango</span>
                            <strong className="text-slate-700">{formatNumber(card.totalAfluencia)}</strong>
                          </div>
                          <div className="text-[11px] text-slate-500 flex justify-between">
                            <span>Último dato</span>
                            <strong className="text-slate-700">{card.latestDate ? formatDateLabel(card.latestDate) : '—'}</strong>
                          </div>
                          <div className="text-[11px] text-slate-500 flex justify-between">
                            <span>Alertas</span>
                            <strong className="text-slate-700">{card.alertScore}</strong>
                          </div>

                          <div className="mt-2">
                            {sparkline ? (
                              <svg viewBox="0 0 120 28" className="w-full h-7">
                                <path d={sparkline} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500" />
                              </svg>
                            ) : (
                              <div className="text-[10px] text-slate-400">Tendencia no disponible</div>
                            )}
                          </div>
                        </div>
                        <div className="pc-preview-tabs">
                          <span>{card.firstDate || '—'}</span>
                          <span>→</span>
                          <span>{card.lastDate || '—'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {dashboardData && (
                <section className="pc-section pt-2">
                  <h2 className="pc-title">RESUMEN DE DATOS</h2>
                  <Dashboard mode="aggregate" data={dashboardData} />
                </section>
              )}
            </>
          )}
        </Suspense>
      </main>
    </div>
  );
}

function dashboardPercentage(cards, selectedStopCodes) {
  const selected = cards.filter(c => selectedStopCodes.includes(c.stopCode));
  if (selected.length === 0) return 0;
  const online = selected.filter(c => (c.totalRecords || 0) > 0).length;
  return Math.round((online * 100) / selected.length);
}

function statusSummary(cards, selectedStopCodes) {
  const selected = cards.filter(c => selectedStopCodes.includes(c.stopCode));
  const online = selected.filter(c => (c.totalRecords || 0) > 0).length;
  const offline = selected.filter(c => (c.totalRecords || 0) === 0).length;
  return { online, offline };
}

function StatusBar({ label, value, tone }) {
  return (
    <div className="pc-status-row">
      <StatusChip status={label} />
      <div className="pc-status-track">
        <div className={`pc-status-fill ${tone}`} style={{ width: `${Math.min(100, 20 + value * 18)}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function StatusChip({ status }) {
  const normalized = String(status || '').toLowerCase();
  const toneClass = normalized.includes('online')
    ? 'online'
    : (normalized.includes('offline') ? 'offline' : 'apagado');

  return <span className={`pc-chip ${toneClass}`}>{status}</span>;
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('es-ES').format(num);
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset) {
  const end = new Date();
  const start = new Date(end);
  if (preset === 'today') {
    return { startDate: formatISODate(end), endDate: formatISODate(end) };
  }
  if (preset === '30d') {
    start.setDate(end.getDate() - 29);
    return { startDate: formatISODate(start), endDate: formatISODate(end) };
  }
  start.setDate(end.getDate() - 6);
  return { startDate: formatISODate(start), endDate: formatISODate(end) };
}

function normalizeCustomRange(range) {
  let startDate = range.startDate || '';
  let endDate = range.endDate || '';

  const today = formatISODate(new Date());
  if (startDate && startDate > today) startDate = today;
  if (endDate && endDate > today) endDate = today;
  if (startDate && endDate && startDate > endDate) {
    endDate = startDate;
  }

  return { startDate, endDate };
}

function getAvailableDateBounds(cards = []) {
  const allDates = cards
    .flatMap((card) => [card.firstDate, card.lastDate])
    .filter((dateValue) => /^\d{4}-\d{2}-\d{2}$/.test(dateValue || ''));

  if (allDates.length === 0) {
    return { minDate: '', maxDate: '' };
  }

  allDates.sort();
  return { minDate: allDates[0], maxDate: allDates[allDates.length - 1] };
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '—';
  const dt = new Date(`${isoDate}T00:00:00`);
  return dt.toLocaleDateString('es-ES');
}

function buildSparklinePath(series = [], width = 120, height = 28) {
  if (!Array.isArray(series) || series.length < 2) return '';
  const minValue = Math.min(...series);
  const maxValue = Math.max(...series);
  const range = Math.max(1, maxValue - minValue);
  const stepX = width / (series.length - 1);

  return series
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - minValue) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export default App;
