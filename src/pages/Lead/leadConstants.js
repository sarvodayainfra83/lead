// Shared constants for the Lead module

export const LEAD_TYPES = ['Real Estate', 'Mutual Fund', 'Life Insurance'];

export const LEAD_TYPE_PREFIX = {
  'Real Estate': 'LR',
  'Mutual Fund': 'LM',
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
