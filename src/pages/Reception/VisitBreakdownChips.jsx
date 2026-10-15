import React from 'react';

// Clickable count chips for one breakdown (visit purpose / visitor category).
// Clicking a chip filters by it; clicking the active chip clears the filter.
export default function VisitBreakdownChips({ title, icon: Icon, options, counts = {}, active, onSelect }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mr-0.5 shrink-0">
        {Icon && <Icon size={12} className="text-indigo-600" />}
        {title}
      </span>
      {options.map(opt => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(isActive ? 'all' : opt.value)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
              isActive
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
            }`}
            title={isActive ? 'Clear filter' : `Filter by ${opt.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : opt.dot}`} />
            {opt.label}
            <span className={`text-[10px] font-extrabold ${isActive ? 'text-white' : 'text-gray-900'}`}>
              {counts[opt.value] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
