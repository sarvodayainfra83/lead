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

/**
 * Formats a lead's timestamp into DD/MM/YYYY (date only, no time).
 * Correctly handles DB values like "2026-08-09 16:37:10+00" (where 08 = Day, 09 = Month) -> "08/09/2026"
 * As well as standard formats like "DD/MM/YYYY HH:MM:SS" -> "DD/MM/YYYY"
 */
export const formatLeadDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim();

  // If already in DD/MM/YYYY or DD/MM/YYYY HH:mm:ss format
  if (str.includes('/')) {
    const datePart = str.split(' ')[0];
    const parts = datePart.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${fullYear}`;
    }
  }

  // If in DB format e.g. "2026-09-14 16:37:10+00" or "2026-09-14T..."
  if (str.includes('-')) {
    const datePart = str.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const year = parts[0];
        const month = String(parts[1]).padStart(2, '0');
        const day = String(parts[2]).padStart(2, '0');
        return `${day}/${month}/${year}`;
      } else {
        const day = String(parts[0]).padStart(2, '0');
        const month = String(parts[1]).padStart(2, '0');
        const year = parts[2];
        return `${day}/${month}/${year}`;
      }
    }
  }

  return str.split(' ')[0] || '-';
};

/**
 * Returns a Date object set to midnight for the lead based on its DD/MM/YYYY date.
 */
export const parseLeadDate = (item) => {
  const val = item?.timestamp || item?.date || item?.created_at;
  if (!val) return null;
  const formatted = formatLeadDate(val);
  if (!formatted || formatted === '-') return null;
  const parts = formatted.split('/').map(Number);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y) return new Date(y, m - 1, d);
  }
  return null;
};

export const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: "Today's Lead" },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'custom', label: 'Custom Date' },
];

export const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Checks if a lead was assigned directly to a site visit upon creation
 * (e.g. Real Estate + Walk-in with Site Visit checked).
 */
export const isDirectSiteVisitLead = (lead) => {
  if (!lead) return false;
  if (lead.processType === 'Direct Site Visit' || lead.process_type === 'Direct Site Visit') return true;
  if (lead.directSiteVisit === true || lead.direct_site_visit === true) return true;
  if (lead.isSiteVisit === true || lead.is_site_visit === true) {
    if (lead.leadSource === 'Walk-in' || lead.lead_source === 'Walk-in' || lead.assignedVisitor || lead.assigned_visitor) {
      return true;
    }
  }
  return false;
};



