import React from 'react';
import { X, MapPin, Calendar, User, ExternalLink } from 'lucide-react';

export default function PhotoViewModal({ isOpen, onClose, log }) {
  const [activePhoto, setActivePhoto] = React.useState('in');

  React.useEffect(() => {
    setActivePhoto('in');
  }, [log]);

  if (!isOpen || !log) return null;

  const hasBothPhotos = Boolean(log.photoUrl && log.outPhotoUrl);
  const currentPhoto = (activePhoto === 'out' && log.outPhotoUrl) ? log.outPhotoUrl : (log.photoUrl || log.outPhotoUrl);

  const mapsUrl = log.latitude && log.longitude
    ? `https://maps.google.com/?q=${log.latitude},${log.longitude}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
              log.status?.toUpperCase() === 'IN'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : log.status?.toUpperCase() === 'HALF DAY'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {log.status}
            </span>
            <h3 className="text-sm font-bold text-gray-900 truncate">
              {log.userName || 'Attendance Photo'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {hasBothPhotos && (
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                <button
                  onClick={() => setActivePhoto('in')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    activePhoto === 'in' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  IN Photo
                </button>
                <button
                  onClick={() => setActivePhoto('out')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    activePhoto === 'out' ? 'bg-white text-rose-700 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  OUT Photo
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Photo Container */}
        <div className="p-3 bg-gray-950 flex items-center justify-center min-h-[260px] max-h-[55vh] overflow-hidden">
          {currentPhoto ? (
            <img
              src={currentPhoto}
              alt={`Attendance by ${log.userName}`}
              className="max-h-[52vh] w-auto max-w-full object-contain rounded-lg shadow"
            />
          ) : (
            <p className="text-gray-400 text-xs italic">No photo captured</p>
          )}
        </div>

        {/* Details Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-600">
            <div className="flex items-center gap-1.5 font-medium">
              <User size={13} className="text-indigo-500" />
              <span>{log.userName}</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-gray-500">
              <Calendar size={13} className="text-indigo-500" />
              <span>{log.date || log.timestamp?.split(' ')[0]}</span>
            </div>
          </div>

          {/* IN & OUT TIME Summary */}
          <div className="grid grid-cols-2 gap-2 py-1.5 px-2.5 bg-white rounded-lg border border-gray-200/80 text-[11px]">
            <div>
              <span className="text-gray-400 font-bold uppercase text-[9px] block">IN TIME</span>
              <span className="font-mono font-bold text-emerald-700">{log.inTime && log.inTime !== '-' ? log.inTime : '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 font-bold uppercase text-[9px] block">OUT TIME</span>
              <span className="font-mono font-bold text-rose-700">{log.outTime && log.outTime !== '-' ? log.outTime : '—'}</span>
            </div>
          </div>

          {(log.locationName || (log.latitude && log.longitude)) && (
            <div className="pt-2 border-t border-gray-200/60 flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 min-w-0 text-gray-700">
                <MapPin size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] leading-tight text-gray-800 break-words font-medium">
                    {log.locationName || `${log.latitude?.toFixed(6)}, ${log.longitude?.toFixed(6)}`}
                  </p>
                  {log.latitude && log.longitude && (
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {log.latitude?.toFixed(6)}, {log.longitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-white border border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-gray-700 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex-shrink-0 shadow-xs"
                >
                  <ExternalLink size={11} /> Maps
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
