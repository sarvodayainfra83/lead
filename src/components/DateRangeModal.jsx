import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, X } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');
const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Quick ranges shown as chips above the date pickers
const buildPresets = () => {
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysAgo = (n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
  const daysAhead = (n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);
  const monday = daysAgo((t.getDay() + 6) % 7);
  return [
    { label: 'Today', from: t, to: t },
    { label: 'Yesterday', from: daysAgo(1), to: daysAgo(1) },
    { label: 'Last 7 Days', from: daysAgo(6), to: t },
    { label: 'This Week', from: monday, to: t },
    { label: 'This Month', from: new Date(t.getFullYear(), t.getMonth(), 1), to: t },
    { label: 'Last 30 Days', from: daysAgo(29), to: t },
    { label: 'Last Month', from: new Date(t.getFullYear(), t.getMonth() - 1, 1), to: new Date(t.getFullYear(), t.getMonth(), 0) },
    { label: 'Next 7 Days', from: t, to: daysAhead(7) },
    { label: 'This Year', from: new Date(t.getFullYear(), 0, 1), to: t }
  ].map(p => ({ ...p, from: toInput(p.from), to: toInput(p.to) }));
};

/**
 * DateRangeModal — small popup to pick a From / To date (with quick presets).
 *
 * Props: isOpen, onClose, from, to (YYYY-MM-DD), onApply(from, to), title
 */
export default function DateRangeModal({ isOpen, onClose, from, to, onApply, title = 'Select Date Range' }) {
  const todayStr = toInput(new Date());
  const monthStartStr = toInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [draftFrom, setDraftFrom] = useState(from || monthStartStr);
  const [draftTo, setDraftTo] = useState(to || todayStr);

  useEffect(() => {
    if (isOpen) {
      setDraftFrom(from || monthStartStr);
      setDraftTo(to || todayStr);
    }
  }, [isOpen, from, to, monthStartStr, todayStr]);

  if (!isOpen) return null;

  const presets = buildPresets();
  const invalid = !draftFrom || !draftTo || draftFrom > draftTo;

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-5 md:p-6 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100/80 ring-1 ring-black/5 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={15} className="text-indigo-600" /> {title}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => {
              const active = draftFrom === p.from && draftTo === p.to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setDraftFrom(p.from); setDraftTo(p.to); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                    active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From Date</span>
              <input
                type="date"
                value={draftFrom}
                max={draftTo || undefined}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-2 text-xs h-[34px] text-gray-700 focus:outline-none focus:border-indigo-500 [color-scheme:light]"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To Date</span>
              <input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-2 text-xs h-[34px] text-gray-700 focus:outline-none focus:border-indigo-500 [color-scheme:light]"
              />
            </label>
          </div>
          {draftFrom > draftTo && <p className="text-[11px] text-red-600">From date must be before To date.</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="h-[34px] px-3 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 text-xs font-semibold">
            Cancel
          </button>
          <button
            onClick={() => { onApply(draftFrom, draftTo); onClose(); }}
            disabled={invalid}
            className="h-[34px] px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
