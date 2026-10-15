// `dot` is the colour used in the purpose / category breakdowns
export const VISIT_PURPOSE_OPTIONS = [
  { value: 'Property Enquiry', label: 'Property Enquiry', dot: 'bg-amber-500' },
  { value: 'Material Enquiry', label: 'Material Enquiry', dot: 'bg-cyan-500' },
  { value: 'Broking / Brokerage', label: 'Broking / Brokerage', dot: 'bg-purple-500' },
  { value: 'Meeting to Director', label: 'Meeting to Director', dot: 'bg-indigo-500' },
  { value: 'Other', label: 'Other', dot: 'bg-gray-400' }
];

export const VISITOR_TYPE_OPTIONS = [
  { value: 'Client', label: 'Client / Buyer', dot: 'bg-emerald-500' },
  { value: 'Vendor', label: 'Vendor / Supplier', dot: 'bg-cyan-500' },
  { value: 'Job Applicant', label: 'Job Applicant', dot: 'bg-sky-500' },
  { value: 'Partner', label: 'Channel Partner / Agent', dot: 'bg-purple-500' },
  { value: 'Official', label: 'Official / Authority', dot: 'bg-rose-500' },
  { value: 'Guest', label: 'Personal Guest', dot: 'bg-amber-500' },
  { value: 'Other', label: 'Other', dot: 'bg-gray-400' }
];

// Purpose bucket of a visit: 'Material Enquiry (Cement)' -> 'Material Enquiry';
// custom "Other" text and unknown purposes -> 'Other'
export const getPurposeKey = (purpose) => {
  const base = String(purpose || '').replace(/\s*\(.*\)\s*$/, '').trim();
  return VISIT_PURPOSE_OPTIONS.some(o => o.value === base) ? base : 'Other';
};

// Visitor category bucket; unknown / empty -> 'Other'
export const getVisitorTypeKey = (type) =>
  VISITOR_TYPE_OPTIONS.some(o => o.value === type) ? type : 'Other';

// { [option.value]: 0 } for every option, e.g. emptyCounts(VISIT_PURPOSE_OPTIONS)
export const emptyCounts = (options) => Object.fromEntries(options.map(o => [o.value, 0]));

export const VISIT_LOCATION_OPTIONS = [
  { value: 'Office', label: 'Corporate Office' },
  { value: 'Construction Site', label: 'Construction Site' }
];

export const PURPOSE_STYLES = {
  'Property Enquiry': 'bg-amber-50 text-amber-700 border-amber-200',
  'Material Enquiry': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Broking / Brokerage': 'bg-purple-50 text-purple-700 border-purple-200',
  'Meeting to Director': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Other: 'bg-gray-50 text-gray-700 border-gray-200'
};

export const DATE_FILTER_OPTIONS = [
  { value: 'today', label: "Today's Visitors" },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Dates' },
  { value: 'custom', label: 'Custom Date Range' }
];

// Format date into DD/MM/YYYY
export const formatVisitorDate = (val) => {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(val) || '-';
  }
};

// Format time into 12-hour e.g. "10:30 AM"
export const formatVisitorTime = (val) => {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '-';
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  } catch {
    return '-';
  }
};

// Calculate duration string between two timestamps
