import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadExcelFile } from '../services/api';

export default function UploadExcel({ onSuccess, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const response = await uploadExcelFile(file, setProgress);
      setResult(response);
      if (response.success) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir el archivo. Verifica que el servidor esté activo.');
    } finally {
      setUploading(false);
    }
  }, [onSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Subir Datos</h2>
            <p className="text-sm text-gray-500 mt-0.5">Arrastra tu archivo Excel o haz clic para seleccionarlo</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drop Zone */}
        <div className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300 hover:bg-orange-50/50'
            }`}
          >
            <input {...getInputProps()} />
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
              isDragActive ? 'bg-primary-100' : 'bg-gray-100'
            }`}>
              <svg className={`w-8 h-8 ${isDragActive ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-primary-600 font-semibold">Suelta el archivo aquí...</p>
            ) : (
              <>
                <p className="text-gray-700 font-medium mb-1">Arrastra y suelta tu archivo Excel aquí</p>
                <p className="text-sm text-gray-400">o haz clic para seleccionar (.xlsx, .xls, .csv)</p>
              </>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Subiendo...</span>
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
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Success — Marquesina IoT */}
          {result?.success && result?.type === 'marquesina' && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-700">Excel IoT de marquesina procesado</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {result.data.location} — {result.data.date}
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-emerald-700">
                    <div>Personas detectadas: <strong>{result.data.totalDetected}</strong></div>
                    <div>Horas activas: <strong>{result.data.activeHours}</strong></div>
                    <div>Tasa identificación: <strong>{result.data.identificationRate}%</strong></div>
                    <div>Hora pico: <strong>{result.data.peakHour?.hour} ({result.data.peakHour?.detected})</strong></div>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-emerald-600">
                    <span>♂ {result.data.gender?.male?.pct}%</span>
                    <span>♀ {result.data.gender?.female?.pct}%</span>
                    <span>? {result.data.gender?.unknown?.pct}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success — Afluencia clásica */}
          {result?.success && result?.type !== 'marquesina' && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-emerald-700">¡Datos subidos correctamente!</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {result.data.savedRecords} registros guardados de {result.data.totalRows} filas procesadas
                  </p>
                  {result.data.uploadId && (
                    <p className="text-xs text-emerald-700 mt-1">
                      ID de carga: {result.data.uploadId}
                    </p>
                  )}
                  {result.data.errors > 0 && (
                    <a
                      href={`/api/upload/errors/${result.data.uploadId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-700 underline mt-1 inline-block"
                    >
                      {result.data.errors} filas con errores (ver detalle)
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700">
              <strong>Formato requerido:</strong> El Excel debe tener las columnas: Fecha, Código Marquesina (stop_code), Entidad, Adultos, Niños, 
              Deduplicados, Total, Tiempo Residencia, Género (Hombre/Mujer/Desconocido), Edad por rangos, 
              y Flujo de pasajeros.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
