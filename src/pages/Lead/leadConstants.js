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

export const INVESTMENT_BUDGET_OPTIONS = [
  { value: '10k - 20k', label: '10k - 20k' },
  { value: '20k - 50k', label: '20k - 50k' },
  { value: '50k - 70k', label: '50k - 70k' },
  { value: '70k - 1 Lakh', label: '70k - 1 Lakh' },
  { value: '1 Lakh - 1.5 Lakh', label: '1 Lakh - 1.5 Lakh' },
  { value: '1.5 Lakh - 2 Lakh', label: '1.5 Lakh - 2 Lakh' },
  { value: '2 Lakh - 3 Lakh', label: '2 Lakh - 3 Lakh' },
  { value: '3 Lakh - 5 Lakh', label: '3 Lakh - 5 Lakh' },
  { value: 'Above 5 Lakh', label: 'Above 5 Lakh' }
];

export const REQUIREMENT_OPTIONS = [
  { value: '1 BHK', label: '1 BHK' },
  { value: '2 BHK', label: '2 BHK' },
  { value: '3 BHK', label: '3 BHK' },
  { value: '4 BHK', label: '4 BHK' },
  { value: '5+ BHK', label: '5+ BHK' },
  { value: 'Flat', label: 'Flat' },
  { value: 'Bungalow', label: 'Bungalow' },
  { value: 'Villa', label: 'Villa' },
  { value: 'Penthouse', label: 'Penthouse' },
  { value: 'Row House', label: 'Row House' },
  { value: 'Commercial Shop', label: 'Commercial Shop' },
  { value: 'Commercial Office', label: 'Commercial Office' },
  { value: 'Plot / Land', label: 'Plot / Land' },
  { value: 'Farmhouse', label: 'Farmhouse' },
  { value: 'Industrial / Warehouse', label: 'Industrial / Warehouse' },
  { value: 'Other', label: 'Other' }
];


