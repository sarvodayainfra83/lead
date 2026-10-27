import React from 'react';

// Clickable count chips for one breakdown (visit purpose / visitor category).
// Clicking a chip filters by it; clicking the active chip clears the filter.
export default function VisitBreakdownChips({ title, icon: Icon, options, counts = {}, active, onSelect }) {
  return (
    <div className="w-full">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
        {Icon && <Icon size={12} className="text-indigo-600" />}
        {title}
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-1.5">
        {options.map(opt => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(isActive ? 'all' : opt.value)}
              className={`flex lg:inline-flex items-center justify-between lg:justify-center gap-1.5 px-2.5 py-1 lg:py-0.5 rounded-full text-[11px] font-semibold border transition cursor-pointer min-w-0 ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
              }`}
              title={isActive ? 'Clear filter' : `Filter by ${opt.label}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white' : opt.dot}`} />
                <span className="truncate">{opt.label}</span>
              </span>
              <span className={`text-[10px] font-extrabold shrink-0 ${isActive ? 'text-white' : 'text-gray-900'}`}>
                {counts[opt.value] || 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
