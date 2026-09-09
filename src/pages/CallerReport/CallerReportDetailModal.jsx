import React from 'react';
import { X } from 'lucide-react';

const STATUS_STYLES = {
  Received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Expected: 'bg-amber-50 text-amber-700 border-amber-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Need Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Call Not Received': 'bg-orange-50 text-orange-700 border-orange-200'
};

const formatDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim().split('T')[0].split(' ')[0];
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}`;
      } else {
        return `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
      }
    }
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${fullYear}`;
    }
  }
  return str || '-';
};

const leadFields = [
  { label: 'Person Name', key: 'personName' },
  { label: 'Number', key: 'number' },
  { label: 'Lead Type', key: 'leadType' },
  { label: 'Caller Assigned', key: 'callerAssigned' },
  { label: 'Requirement', key: 'requirement' },
  { label: 'Investment Range', key: 'investmentBudget' },
  { label: 'Address', key: 'location' },
  { label: 'Latest Status', key: 'latestStatus' }
];

export default function CallerReportDetailModal({ isOpen, onClose, lead }) {
  if (!isOpen || !lead) return null;

  const trackers = lead.trackers || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-[100] p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl lg:max-w-3xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <h2 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-widest truncate">
            Tracking Status — {lead.leadNo}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Pre-filled Lead Reference Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-gray-200 rounded-lg p-2.5">
            {leadFields.map(({ label, key }) => (
              <div key={key} className="min-w-0">
                <p className="text-[8px] text-gray-400 uppercase tracking-tighter truncate">{label}</p>
                {key === 'number' ? (
                  <p className="text-[11px] md:text-[12px] text-gray-800 font-medium truncate">
                    {lead.number ? (
                      <a href={`tel:${lead.number}`} className="text-indigo-600 hover:underline">
                        {lead.number}
                      </a>
                    ) : '-'}
                  </p>
                ) : key === 'latestStatus' ? (
                  <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border truncate ${STATUS_STYLES[lead.latestStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {lead.latestStatus || '-'}
                  </span>
                ) : (
                  <p className="text-[11px] md:text-[12px] text-gray-800 font-medium truncate" title={lead[key]}>
                    {lead[key] || '-'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Tracking History Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-widest">
                Call History ({trackers.length})
              </h3>
            </div>

            {trackers.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="text-xs text-gray-500 font-medium">No tracking calls recorded yet.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="px-3 py-2 text-center w-20">Follow Up</th>
                      <th className="px-3 py-2 text-center w-24">Call Date</th>
                      <th className="px-3 py-2 text-center w-28">Status</th>
                      <th className="px-3 py-2">What Customer Said</th>
                      <th className="px-3 py-2 text-center w-24">Next Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {trackers.map((t, idx) => (
                      <tr key={t.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-2 text-center font-bold text-indigo-600 whitespace-nowrap text-[11px]">
                          #{t.followUpNo || idx + 1}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap text-[11px]">
                          {t.timestamp ? t.timestamp.split(' ')[0] : '-'}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_STYLES[t.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {t.status || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-800 text-[11px] leading-relaxed break-words">
                          {t.customerSaid || '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap text-[11px] font-medium">
                          {formatDate(t.nextDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-t border-gray-100 bg-white flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition font-bold uppercase tracking-wider active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
