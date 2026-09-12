// Shared color scheme so "Lead Type" reads consistently everywhere it's shown across the app —
// Real Estate / Mutual Fund / Insurance each get their own accent color.

export const getLeadTypeTextClass = (leadType) => {
  switch (leadType) {
    case 'Real Estate': return 'text-amber-600';
    case 'Mutual Fund': return 'text-emerald-600';
    case 'Insurance': return 'text-sky-600';
    default: return 'text-gray-900';
  }
};

export const getLeadTypeBadgeClass = (leadType) => {
  switch (leadType) {
    case 'Real Estate': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Mutual Fund': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Insurance': return 'bg-sky-50 text-sky-700 border-sky-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

// Next / follow-up date — always shown bold and in an accent color so it stands out
// wherever a "Next Date" / "Follow Up Date" column appears.
export const NEXT_DATE_CLASS = 'font-bold text-rose-600';
