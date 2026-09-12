// Shared constants for the Lead module

export const LEAD_TYPES = ['Real Estate', 'Mutual Fund', 'Insurance'];

export const LEAD_TYPE_PREFIX = {
  'Real Estate': 'LR',
  'Mutual Fund': 'LM',
  'Insurance': 'LI',
  'Life Insurance': 'LI'
};

export const LEAD_SOURCES = [
  'Website',
  'Reference',
  'Walk-in',
  'Cold Call',
  'Social Media',
  'Newspaper Ad',
  'Advertisement',
  'Other'
];

// Generates the next sequential Lead No for the given lead type, e.g. LR-001, LM-014, LI-002.
// Based on the highest existing sequence number, not the current count — a plain count would
// reissue an already-used Lead No (and therefore a duplicate id) once any lead is ever deleted.
export const generateLeadNo = (leadType, existingLeads) => {
  const prefix = LEAD_TYPE_PREFIX[leadType] || 'L';
  const maxSeq = existingLeads
    .filter(l => l.leadType === leadType)
    .reduce((max, l) => {
      const match = /-(\d+)$/.exec(l.leadNo || '');
      const seq = match ? parseInt(match[1], 10) : 0;
      return seq > max ? seq : max;
    }, 0);
  return `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
};

// Investment Budget options now live in the master_investment_budgets table (see
// masterApi.getInvestmentBudgets / the Investment Budget Master page) — editable at runtime
// instead of hardcoded here.

// Requirement options for Real Estate leads now live in the master_real_estate_requirements
// table (see masterApi.getRealEstateRequirements / the Real Estate Requirement Master page) —
// editable at runtime instead of hardcoded here.


