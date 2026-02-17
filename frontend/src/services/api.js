import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// ==================== UPLOAD ====================

export async function uploadExcelFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    }
  });

  return response.data;
}

export async function previewExcelFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return response.data;
}

// ==================== DATA ====================

export async function getEntities() {
  const response = await api.get('/data/entities');
  return response.data;
}

export async function getStops() {
  const response = await api.get('/stops');
  return response.data;
}

export async function createStop(payload) {
  const response = await api.post('/stops', payload);
  return response.data;
}

export async function updateStop(stopCode, payload) {
  const response = await api.put(`/stops/${encodeURIComponent(stopCode)}`, payload);
  return response.data;
}

export async function deleteStop(stopCode) {
  const response = await api.delete(`/stops/${encodeURIComponent(stopCode)}`);
  return response.data;
}

export async function permanentDeleteStop(stopCode) {
  const response = await api.delete(`/stops/${encodeURIComponent(stopCode)}/permanent`);
  return response.data;
}

// ==================== MANUAL UPLOAD ====================

export async function checkDuplicate(stopCode, date) {
  const params = new URLSearchParams({ stopCode, date });
  const response = await api.get(`/upload/check-duplicate?${params}`);
  return response.data;
}

export async function uploadManualExcel(file, stopCode, date, force = false, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('stopCode', stopCode);
  formData.append('date', date);
  if (force) formData.append('force', 'true');

  const response = await api.post('/upload/manual', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    }
  });

  return response.data;
}

export async function getRecords(filters = {}) {
  const params = new URLSearchParams();
  if (filters.entity) params.append('entity', filters.entity);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.limit) params.append('limit', filters.limit);

  const response = await api.get(`/data/records?${params}`);
  return response.data;
}

export async function getLatestRecord(stopCode) {
  const response = await api.get(`/data/latest/${encodeURIComponent(stopCode)}`);
  return response.data;
}

export async function getDashboardData(stopCode, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await api.get(`/data/dashboard/${encodeURIComponent(stopCode)}?${params}`);
  return response.data;
}

export async function getDashboardCards(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await api.get(`/data/dashboard/cards?${params}`);
  return response.data;
}

export async function getAggregateDashboard(stopCodes, startDate, endDate) {
  const params = new URLSearchParams();
  params.append('stopCodes', stopCodes.join(','));
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await api.get(`/data/dashboard/aggregate?${params}`);
  return response.data;
}

export async function getCompareDashboard(stopCodes, startDate, endDate) {
  const params = new URLSearchParams();
  params.append('stopCodes', stopCodes.join(','));
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await api.get(`/data/dashboard/compare?${params}`);
  return response.data;
}

export async function getSummary(entity, startDate, endDate) {
  const params = new URLSearchParams();
  params.append('entity', entity);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await api.get(`/data/summary?${params}`);
  return response.data;
}

export async function deleteRecord(id) {
  const response = await api.delete(`/data/records/${id}`);
  return response.data;
}

// ==================== MARQUESINA IoT ====================

export async function getMarquesinaAnalytics({ location, mode, date, from, to }) {
  const params = new URLSearchParams();
  params.append('location', location);
  params.append('mode', mode);
  if (date) params.append('date', date);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const response = await api.get(`/marquesina/analytics?${params}`);
  return response.data;
}

export async function getMarquesinaDay(date, location) {
  const params = new URLSearchParams();
  if (location) params.append('location', location);
  const response = await api.get(`/marquesina/${date}?${params}`);
  return response.data;
}

export async function getMarquesinaRange(from, to, location) {
  const params = new URLSearchParams();
  params.append('from', from);
  params.append('to', to);
  if (location) params.append('location', location);
  const response = await api.get(`/marquesina/range?${params}`);
  return response.data;
}

export async function getMarquesinaLatest(location) {
  const params = new URLSearchParams();
  if (location) params.append('location', location);
  const response = await api.get(`/marquesina/latest?${params}`);
  return response.data;
}

// ==================== ALERTS ====================

export async function recomputeAlerts(stopCodes = []) {
  const response = await api.post('/alerts/recompute', { stopCodes });
  return response.data;
}

export async function getAlerts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.search) params.append('search', filters.search);
  if (filters.range) params.append('range', filters.range);
  const query = params.toString();
  const response = await api.get(`/alerts${query ? `?${query}` : ''}`);
  return response.data;
}

export async function acknowledgeAlert(alertId, user = 'admin') {
  const response = await api.patch(`/alerts/${encodeURIComponent(alertId)}/ack`, { user });
  return response.data;
}

export async function resolveAlert(alertId, user = 'admin') {
  const response = await api.patch(`/alerts/${encodeURIComponent(alertId)}/resolve`, { user });
  return response.data;
}

// ==================== REPORTS ====================

export async function getReportTemplates() {
  const response = await api.get('/reports/templates');
  return response.data;
}

export async function listReports() {
  const response = await api.get('/reports');
  return response.data;
}

export async function getReportById(reportId) {
  const response = await api.get(`/reports/${encodeURIComponent(reportId)}`);
  return response.data;
}

export async function generateReport(payload) {
  const response = await api.post('/reports/generate', payload);
  return response.data;
}

// ==================== INTEGRATIONS / CRTM CONNECTOR ====================

export async function getCrtmConnectorConfig() {
  const response = await api.get('/integrations/crtm/config');
  return response.data;
}

export async function updateCrtmConnectorConfig(payload) {
  const response = await api.put('/integrations/crtm/config', payload);
  return response.data;
}

export async function getCrtmConnectorDatasets() {
  const response = await api.get('/integrations/crtm/datasets');
  return response.data;
}

export async function executeCrtmConnector(payload) {
  const response = await api.post('/integrations/crtm/execute', payload);
  return response.data;
}

export async function listCrtmConnectorRuns() {
  const response = await api.get('/integrations/crtm/runs');
  return response.data;
}

export function getCrtmConnectorDownloadUrl(runId) {
  return `/api/integrations/crtm/runs/${encodeURIComponent(runId)}/download`;
}

export default api;
