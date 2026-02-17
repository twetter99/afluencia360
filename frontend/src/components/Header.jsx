import { useState } from 'react';

export default function Header({ onUploadClick, dateRange, onDateRangeChange, currentPage, onPageChange }) {
  const [showFilters, setShowFilters] = useState(false);

  const quickDateRanges = [
    {
      label: 'Hoy',
      getValue: () => {
        const today = new Date().toISOString().split('T')[0];
        return { startDate: today, endDate: today };
      }
    },
    {
      label: 'Esta Semana',
      getValue: () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay() + 1);
        return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      }
    },
    {
      label: 'Este Mes',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      }
    },
    {
      label: 'Último Mes',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
      }
    },
    {
      label: 'Este Año',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      }
    },
    {
      label: 'Todo',
      getValue: () => ({ startDate: '', endDate: '' })
    }
  ];

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Afluencia<span className="text-primary-500">360</span></h1>
              <p className="text-xs text-gray-400 -mt-0.5 hidden sm:block">Dashboard por Marquesina</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => onPageChange('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${currentPage === 'dashboard' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onPageChange('stops')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${currentPage === 'stops' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Marquesinas
              </button>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              disabled={currentPage !== 'dashboard'}
              className={`btn-secondary flex items-center gap-2 text-sm ${showFilters ? 'bg-primary-50 border-primary-200 text-primary-700' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="hidden sm:inline">Filtros</span>
            </button>

            <button
              onClick={onUploadClick}
              disabled={currentPage !== 'dashboard'}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="hidden sm:inline">Carga y validación</span>
            </button>
          </div>
        </div>

        {showFilters && currentPage === 'dashboard' && (
          <div className="pb-4 pt-2 border-t border-gray-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500 font-medium mr-2">Período:</span>
              {quickDateRanges.map((range) => (
                <button
                  key={range.label}
                  onClick={() => onDateRangeChange(range.getValue())}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    JSON.stringify(dateRange) === JSON.stringify(range.getValue())
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-4">
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => onDateRangeChange({ ...dateRange, endDate: e.target.value })}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
