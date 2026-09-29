import React from 'react';

/**
 * PageTabs — the one tab bar style used on every page (Dashboard, Lead, Call Followup,
 * Customer Master, MIS Report, Products, Assign Visitor, Visitor Follow Up, Attendance Report).
 *
 * Props:
 *   tabs      – [{ key, label, icon?, count? }]
 *   activeKey – key of the selected tab
 *   onChange  – fn(key)
 *   fill      – stretch tabs to share the row equally on mobile (for 2–3 short tabs)
 *   className – extra classes for the wrapper
 */
export const TAB_HEIGHT = 'h-[34px]';

export default function PageTabs({ tabs = [], activeKey, onChange, fill = false, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap pb-0.5 min-w-0 ${className}`}>
      {tabs.map(({ key, label, icon: Icon, count }) => {
        const isActive = activeKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange?.(key)}
            className={`${fill ? 'flex-1 sm:flex-none' : 'shrink-0'} flex items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border ${TAB_HEIGHT} whitespace-nowrap active:scale-95 ${
              isActive
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
            }`}
          >
            {Icon && <Icon size={14} className="shrink-0" />}
            <span>{label}</span>
            {count !== undefined && count !== null && (
              <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
