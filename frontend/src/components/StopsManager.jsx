import { useMemo, useState } from 'react';
import { createStop, updateStop, deleteStop, permanentDeleteStop } from '../services/api';

const initialForm = {
  stopCode: '',
  name: '',
  location: '',
  zone: '',
  municipality: '',
  photosText: '',
  notes: '',
  installedAt: '',
  latitude: '',
  longitude: '',
  status: 'active'
};

export default function StopsManager({ stops, onUpdated }) {
  const [form, setForm] = useState(initialForm);
  const [editingCode, setEditingCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.stopCode.localeCompare(b.stopCode)),
    [stops]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        stopCode: form.stopCode,
        name: form.name,
        location: form.location,
        zone: form.zone,
        municipality: form.municipality,
        photos: form.photosText
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean),
        notes: form.notes,
        installedAt: form.installedAt || null,
        latitude: form.latitude,
        longitude: form.longitude,
        status: form.status
      };

      if (editingCode) {
        await updateStop(editingCode, payload);
      } else {
        await createStop(payload);
      }

      setForm(initialForm);
      setEditingCode(null);
      await onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar la marquesina');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (stop) => {
    setEditingCode(stop.stopCode);
    setForm({
      stopCode: stop.stopCode,
      name: stop.name || '',
      location: stop.location || '',
      zone: stop.zone || '',
      municipality: stop.municipality || '',
      photosText: Array.isArray(stop.photos) ? stop.photos.join('\n') : '',
      notes: stop.notes || '',
      installedAt: stop.installedAt || '',
      latitude: stop.latitude ?? '',
      longitude: stop.longitude ?? '',
      status: stop.status || 'active'
    });
  };

  const handleDelete = async (stopCode) => {
    setError(null);
    try {
      await deleteStop(stopCode);
      if (editingCode === stopCode) {
        setEditingCode(null);
        setForm(initialForm);
      }
      await onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo desactivar la marquesina');
    }
  };

  const handlePermanentDelete = async (stopCode, stopName) => {
    const confirmed = window.confirm(
      `⚠️ ELIMINAR PERMANENTEMENTE\n\n` +
      `Marquesina: ${stopCode} – ${stopName || 'Sin nombre'}\n\n` +
      `Se borrarán:\n` +
      `• El registro del catálogo\n` +
      `• Todos los registros de afluencia asociados\n` +
      `• Todos los datos IoT de marquesina\n\n` +
      `Esta acción NO se puede deshacer. ¿Continuar?`
    );
    if (!confirmed) return;

    setError(null);
    try {
      const result = await permanentDeleteStop(stopCode);
      if (editingCode === stopCode) {
        setEditingCode(null);
        setForm(initialForm);
      }
      await onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la marquesina');
    }
  };

  return (
    <div className="space-y-6 pt-6">
      <div className="card">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          {editingCode ? `Editar Marquesina ${editingCode}` : 'Alta de Marquesina'}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Código *">
            <input
              value={form.stopCode}
              onChange={(e) => setForm({ ...form, stopCode: e.target.value.toUpperCase() })}
              disabled={Boolean(editingCode)}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-100"
            />
          </Field>

          <Field label="Nombre / Ubicación *">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>

          <Field label="Dirección">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>

          <Field label="Zona">
            <input
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>

          <Field label="Municipio">
            <input
              value={form.municipality}
              onChange={(e) => setForm({ ...form, municipality: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>

          <Field label="Fecha instalación">
            <input
              type="date"
              value={form.installedAt}
              onChange={(e) => setForm({ ...form, installedAt: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>

          <Field label="Latitud">
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>

          <Field label="Longitud">
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </Field>

          <Field label="Estado">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </select>
          </Field>

          <div className="md:col-span-2">
            <Field label="Fotos (URLs, una por línea)">
              <textarea
                rows={3}
                value={form.photosText}
                onChange={(e) => setForm({ ...form, photosText: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Notas">
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
              />
            </Field>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : editingCode ? 'Actualizar' : 'Crear Marquesina'}
            </button>
            {editingCode && (
              <button type="button" onClick={() => { setEditingCode(null); setForm(initialForm); }} className="btn-secondary">
                Cancelar edición
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Catálogo de Marquesinas</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Ubicación</th>
                <th className="py-2 pr-4">Fotos</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedStops.map((stop) => (
                <tr key={stop.stopCode} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-semibold text-gray-800">{stop.stopCode}</td>
                  <td className="py-2 pr-4">{stop.name || '-'}</td>
                  <td className="py-2 pr-4">{stop.location || '-'}</td>
                  <td className="py-2 pr-4">{Array.isArray(stop.photos) ? stop.photos.length : 0}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${stop.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {stop.status === 'inactive' ? 'Inactiva' : 'Activa'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 flex items-center gap-2">
                    <button className="btn-secondary !py-1 !px-3" onClick={() => handleEdit(stop)}>Editar</button>
                    <button className="btn-secondary !py-1 !px-3" onClick={() => handleDelete(stop.stopCode)}>Desactivar</button>
                    <button
                      className="!py-1 !px-3 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                      onClick={() => handlePermanentDelete(stop.stopCode, stop.name)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {sortedStops.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">No hay marquesinas dadas de alta</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
