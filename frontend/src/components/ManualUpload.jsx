import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { checkDuplicate, uploadManualExcel } from '../services/api';

export default function ManualUpload({ stops, onSuccess, onCancel }) {
  const [file, setFile] = useState(null);
  const [selectedStop, setSelectedStop] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Modal de duplicado
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const activeStops = (stops || []).filter(s => s.status !== 'inactive');
  const canProcess = file && selectedStop && selectedDate && !uploading;

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024
  });

  const handleProcess = async (force = false) => {
    if (!canProcess && !force) return;

    setShowDuplicateModal(false);
    setUploading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      // Si no es force, verificar duplicado primero
      if (!force) {
        const dupCheck = await checkDuplicate(selectedStop, selectedDate);
        if (dupCheck.exists) {
          setUploading(false);
          setShowDuplicateModal(true);
          return;
        }
      }

      const response = await uploadManualExcel(file, selectedStop, selectedDate, force, setProgress);
      setResult(response);

      if (response.success) {
        setTimeout(() => {
          onSuccess();
        }, 2500);
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.duplicate) {
        setShowDuplicateModal(true);
      } else {
        setError(err.response?.data?.error || 'Error al procesar el archivo');
      }
    } finally {
      if (!showDuplicateModal) {
        setUploading(false);
      }
    }
  };

  const handleReplace = () => {
    setShowDuplicateModal(false);
    handleProcess(true);
  };

  const removeFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  // Nombre de la marquesina seleccionada
  const selectedStopName = activeStops.find(s => s.stopCode === selectedStop)?.name || '';

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <div className="card">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Subida Manual de Excel</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Selecciona marquesina, fecha y archivo para procesar
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
            title="Volver"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario: Marquesina + Fecha */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Dropdown Marquesina */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Marquesina <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedStop}
              onChange={(e) => { setSelectedStop(e.target.value); setResult(null); setError(null); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-300 text-sm"
              disabled={uploading}
            >
              <option value="">Seleccionar marquesina…</option>
              {activeStops.map(stop => (
                <option key={stop.stopCode} value={stop.stopCode}>
                  {stop.stopCode} — {stop.name || stop.location || 'Sin nombre'}
                </option>
              ))}
            </select>
            {activeStops.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No hay marquesinas activas en el catálogo</p>
            )}
          </div>

          {/* DatePicker */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Fecha del día <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setResult(null); setError(null); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-300 text-sm"
              disabled={uploading}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Drop Zone */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-1.5">
            Archivo Excel <span className="text-red-500">*</span>
          </label>
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                isDragActive ? 'bg-primary-100' : 'bg-gray-100'
              }`}>
                <svg className={`w-7 h-7 ${isDragActive ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              {isDragActive ? (
                <p className="text-primary-600 font-semibold text-sm">Suelta el archivo aquí…</p>
              ) : (
                <>
                  <p className="text-gray-700 font-medium text-sm mb-1">Arrastra y suelta tu archivo Excel</p>
                  <p className="text-xs text-gray-400">o haz clic para seleccionar (.xlsx, .xls)</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={removeFile}
                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                disabled={uploading}
                title="Quitar archivo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Resumen pre-proceso */}
        {canProcess && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs text-blue-700">
              <strong>Resumen:</strong> Se procesará <strong>{file.name}</strong> para la marquesina{' '}
              <strong>{selectedStop}</strong>{selectedStopName ? ` (${selectedStopName})` : ''} en la fecha{' '}
              <strong>{selectedDate}</strong>.
            </p>
          </div>
        )}

        {/* Progreso */}
        {uploading && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Procesando…</span>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Éxito */}
        {result?.success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-700">{result.message}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-emerald-700">
                  <div>Personas detectadas: <strong>{result.data?.totalDetected ?? '-'}</strong></div>
                  <div>Horas activas: <strong>{result.data?.activeHours ?? '-'}</strong></div>
                  <div>Identificación: <strong>{result.data?.identificationRate ?? '-'}%</strong></div>
                  <div>Hora pico: <strong>{result.data?.peakHour?.hour ?? '-'}</strong></div>
                </div>
                {result.data?.action === 'replaced' && (
                  <p className="text-xs text-amber-600 mt-2 font-medium">↻ Datos anteriores reemplazados</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={() => handleProcess(false)}
            disabled={!canProcess}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? 'Procesando…' : 'Procesar'}
          </button>
          <button
            onClick={onCancel}
            className="btn-secondary"
            disabled={uploading}
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* ─── Modal Duplicado ──────────────────────────────── */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Registro existente</h3>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                Ya existe un Excel cargado para:
              </p>
              <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
                <p><strong>Marquesina:</strong> {selectedStop}{selectedStopName ? ` — ${selectedStopName}` : ''}</p>
                <p><strong>Fecha:</strong> {selectedDate}</p>
              </div>
              <p className="text-sm text-gray-500">
                ¿Deseas reemplazar los datos existentes con el nuevo archivo?
              </p>
            </div>

            <div className="flex items-center gap-3 px-6 pb-6">
              <button
                onClick={handleReplace}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Reemplazar
              </button>
              <button
                onClick={() => { setShowDuplicateModal(false); setUploading(false); }}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
