export const VISIT_PURPOSE_OPTIONS = [
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Site Visit', label: 'Site Visit' },
  { value: 'Supply Item', label: 'Supply Item' },
  { value: 'Broking', label: 'Broking' },
  { value: 'Other', label: 'Other' }
];

export const VISITOR_TYPE_OPTIONS = [
  { value: 'Client', label: 'Client / Buyer' },
  { value: 'Vendor', label: 'Vendor / Supplier' },
  { value: 'Job Applicant', label: 'Job Applicant' },
  { value: 'Partner', label: 'Channel Partner / Agent' },
  { value: 'Official', label: 'Official / Authority' },
  { value: 'Guest', label: 'Personal Guest' },
  { value: 'Other', label: 'Other' }
];

export const VISIT_LOCATION_OPTIONS = [
  { value: 'Office', label: 'Corporate Office' },
  { value: 'Construction Site', label: 'Construction Site' }
];

export const VISITOR_STATUS_MAP = {
  CHECKED_IN: {
    label: 'Checked In',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500'
  },
  CHECKED_OUT: {
    label: 'Checked Out',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-400'
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    dotColor: 'bg-rose-500'
  }
};

export const PURPOSE_STYLES = {
  Meeting: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Site Visit': 'bg-amber-50 text-amber-700 border-amber-200',
  'Supply Item': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Broking: 'bg-purple-50 text-purple-700 border-purple-200',
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
export const getVisitDuration = (checkInVal, checkOutVal) => {
  if (!checkInVal) return '-';
  try {
    const start = new Date(checkInVal).getTime();
    const end = checkOutVal ? new Date(checkOutVal).getTime() : Date.now();
    if (isNaN(start) || isNaN(end)) return '-';
    const diffMs = Math.max(0, end - start);
    const totalMinutes = Math.floor(diffMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours === 0 && mins === 0) return 'Just now';
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  } catch {
    return '-';
  }
};
