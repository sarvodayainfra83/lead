import React from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, Building2, MapPin, Users, Briefcase, FileSpreadsheet, CheckCircle2, Clock } from 'lucide-react';
import { PURPOSE_STYLES } from './receptionConstants';

export default function ReceptionReportsModal({ isOpen, onClose, stats, visitors = [], onExportExcel }) {
  if (!isOpen) return null;

  const purposeList = Object.entries(stats?.purposeCounts || {});
  const totalPurposes = purposeList.reduce((acc, [, cnt]) => acc + cnt, 0) || 1;

  const employeeList = Object.entries(stats?.employeeVisits || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8); // Top 8 employees

  const totalEmployees = employeeList.reduce((acc, [, cnt]) => acc + cnt, 0) || 1;

  const officeCount = stats?.locationCounts?.Office || 0;
  const siteCount = stats?.locationCounts?.['Construction Site'] || 0;
  const totalLocations = officeCount + siteCount || 1;
  const officePercent = Math.round((officeCount / totalLocations) * 100);
  const sitePercent = Math.round((siteCount / totalLocations) * 100);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 ring-1 ring-black/5 w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <BarChart3 size={16} />
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Visitor Reports & Analytics</h3>
              <p className="text-[11px] text-gray-300">Breakdown by Purpose, Location & Host</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-indigo-700 block">Total Today</span>
              <span className="text-xl font-extrabold text-indigo-950 mt-0.5 block">{stats?.totalToday || 0}</span>
            </div>
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Material Enquiries Today</span>
              <span className="text-xl font-extrabold text-emerald-950 mt-0.5 block">{stats?.todayPurposeCounts?.['Material Enquiry'] || 0}</span>
            </div>
            <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-violet-700 block">Director Meetings Today</span>
              <span className="text-xl font-extrabold text-violet-950 mt-0.5 block">{stats?.meetingsToday || 0}</span>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Property Enquiries Today</span>
              <span className="text-xl font-extrabold text-amber-950 mt-0.5 block">{stats?.propertyEnquiriesToday || 0}</span>
            </div>
          </div>

          {/* Purpose-wise Breakdown */}
          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Briefcase size={13} className="text-indigo-600" />
              <span>Purpose-Wise Distribution</span>
            </h4>

            <div className="space-y-2">
              {purposeList.map(([purpose, count]) => {
                const percent = Math.round((count / totalPurposes) * 100);
                return (
                  <div key={purpose} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700">{purpose}</span>
                      <span className="text-gray-500 font-bold">{count} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Location Breakdown (Office vs Construction Site) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <MapPin size={13} className="text-slate-600" />
              <span>Location Breakdown</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-white border border-gray-200 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-500 block">Corporate Office</span>
                <span className="text-lg font-black text-gray-900 mt-0.5 block">{officeCount}</span>
                <span className="text-[10px] font-bold text-indigo-600">{officePercent}% of visits</span>
              </div>
              <div className="p-3 bg-white border border-gray-200 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-500 block">Construction Sites</span>
                <span className="text-lg font-black text-amber-900 mt-0.5 block">{siteCount}</span>
                <span className="text-[10px] font-bold text-amber-600">{sitePercent}% of visits</span>
              </div>
            </div>
          </div>

          {/* Employee-wise Visitor Count */}
          <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2.5">
            <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Users size={13} className="text-indigo-600" />
              <span>Host Employee Activity</span>
            </h4>

            {employeeList.length === 0 ? (
              <p className="text-gray-400 italic">No employee meeting logs recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {employeeList.map(([empName, count]) => (
                  <div key={empName} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                    <span className="font-semibold text-gray-800 truncate pr-2">{empName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      {count} {count === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition"
          >
            Close
          </button>

          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Export Visitors to Excel</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
