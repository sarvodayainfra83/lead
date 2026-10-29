import React from 'react';

/**
 * PageTabs — the one tab bar style used on every page (Dashboard, Lead, Call Followup,
 * Customer Master, MIS Report, Products, Assign Visitor, Visitor Follow Up, Attendance Report).
 *
 * Props:
 *   tabs      – [{ key, label, shortLabel?, icon?, count? }]
 *   activeKey – key of the selected tab
 *   onChange  – fn(key)
 *   fill      – stretch tabs to share the row equally on mobile (for 2–3 short tabs)
 *   wrap      – wrap tabs onto more lines instead of scrolling sideways
 *   grid      – display tabs as an equal-width grid on mobile (e.g. 2x2 for 4 tabs, 1x3 for 3 tabs)
 *   gridCols  – number of columns on mobile when grid=true (default: 3 if tabs.length===3, else 2)
 *   className – extra classes for the wrapper
 */
export const TAB_HEIGHT = 'h-[28px] sm:h-[32px]';

export default function PageTabs({
  tabs = [],
  activeKey,
  onChange,
  fill = false,
  wrap = false,
  grid = false,
  gridCols,
  tabHeight,
  className = ''
}) {
  const cols = gridCols || (tabs.length === 4 ? 2 : tabs.length === 3 ? 3 : 2);

  const containerClass = grid
    ? cols === 2
      ? `grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-1.5 w-full ${className}`
      : cols === 3
      ? `grid grid-cols-3 gap-1 sm:gap-1.5 w-full ${className}`
      : `grid grid-cols-4 gap-1 sm:gap-1.5 w-full ${className}`
    : `flex items-center gap-1.5 ${wrap ? 'flex-wrap' : 'overflow-x-auto scrollbar-hide flex-nowrap'} pb-0.5 min-w-0 ${className}`;

  const currentTabHeight = tabHeight || (grid ? 'h-[26px] sm:h-[28px]' : TAB_HEIGHT);

  return (
    <div className={containerClass}>
      {tabs.map(({ key, label, shortLabel, icon: Icon, count }) => {
        const isActive = activeKey === key;
        const displayLabel = shortLabel || label;
        const isTwoCol = grid && cols === 2;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange?.(key)}
            className={`${grid ? 'w-full min-w-0' : fill ? 'flex-1 sm:flex-none' : 'shrink-0'} flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 text-[10px] sm:text-xs md:text-sm tracking-tight sm:tracking-wide font-bold capitalize sm:uppercase rounded-lg transition-colors border ${currentTabHeight} whitespace-nowrap active:scale-95 cursor-pointer ${
              isActive
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
            }`}
          >
            {Icon && <Icon size={12} className="shrink-0" />}
            <span className="truncate">{displayLabel}</span>
            {count !== undefined && count !== null && (
              <span
                className={`shrink-0 text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-extrabold leading-tight ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
