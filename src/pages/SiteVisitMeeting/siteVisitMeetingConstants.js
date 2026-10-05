import { CUSTOMER_STATUSES, CUSTOMER_STATUS_STYLES, normalizeCustomerStatus } from '../CallTracker/callTrackerConstants';

export { CUSTOMER_STATUSES, CUSTOMER_STATUS_STYLES, normalizeCustomerStatus };

export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'Hot', label: 'HOT' },
  { value: 'Warm', label: 'Warm' },
  { value: 'Cold', label: 'Cold' }
];

export const DEAL_OUTCOME_OPTIONS = [
  { value: 'Closed (Won)', label: 'Closed (Won)' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Under Negotiation', label: 'Under Negotiation' },
  { value: 'Token Received', label: 'Token Received' }
];

export const DEFAULT_BUDGET_RANGES = [
  '10k - 20k',
  '20k - 50k',
  '50k - 70k',
  '70k - 1 Lakh',
  '1 Lakh - 1.5 Lakh',
  '1.5 Lakh - 2 Lakh',
  '2 Lakh - 3 Lakh',
  '3 Lakh - 5 Lakh',
  '5 Lakh - 10 Lakh',
  '10 Lakh - 25 Lakh',
  '25 Lakh - 50 Lakh',
  '50 Lakh - 1 Cr',
  'Above 1 Cr'
];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Pending Assignment', label: 'Pending Assignment' },
  { value: 'Assigned', label: 'Visitor Assigned' },
  { value: 'Future Plan', label: 'Future Plan' },
  { value: 'Interested', label: 'Interested' },
  { value: 'Not Interested', label: 'Not Interested' },
  { value: 'Did Not Show', label: 'Did Not Show' },
];

export const DATE_FILTER_OPTIONS = [
  { value: 'today', label: "Today's Date" },
  { value: 'all', label: 'All Dates' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'custom', label: 'Custom Date' },
];

export const STATUS_STYLES = {
  'Pending Assignment': {
    badge: 'bg-amber-50 text-amber-700 border-amber-300',
    dot: 'bg-amber-500',
    label: 'Pending Assignment'
  },
  'Assigned': {
    badge: 'bg-sky-50 text-sky-700 border-sky-300',
    dot: 'bg-sky-500',
    label: 'Visitor Assigned'
  },
  'Future Plan': {
    badge: 'bg-purple-50 text-purple-700 border-purple-300',
    dot: 'bg-purple-500',
    label: 'Future Plan'
  },
  'Interested': {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Interested'
  },
  'Not Interested': {
    badge: 'bg-rose-50 text-rose-700 border-rose-300',
    dot: 'bg-rose-500',
    label: 'Not Interested'
  },
  'Did Not Show': {
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-500',
    label: 'Did Not Show'
  }
};

export const TABLE_HEADERS = [
  "ACTION", "MEETING DATE", "NEXT MEETING DATE", "STATUS", "CUSTOMER NAME", "CONTACT", "ASSIGNED VISITOR",
  "LOCATION", "LATEST FEEDBACK / REMARKS",
  "FOLLOW UP #", "LEAD SOURCE", "PRODUCT TYPE", "REQUIREMENT",
  "BUDGET", "WHEN TO BUY", "LEAD REMARKS"
];

export const formatDisplayDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim();

  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${fullYear}`;
    }
  }

  if (str.includes('-')) {
    const datePart = str.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}`;
      } else {
        return `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
      }
    }
  }

  return str.split(' ')[0] || '-';
};

export const formatInputDate = (val) => {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
};

export const parseDateObj = (val) => {
  if (!val) return null;
  const str = String(val).trim().split('T')[0].split(' ')[0];
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? Number(`20${y}`) : Number(y);
      return new Date(fullYear, Number(m) - 1, Number(d));
    }
  }
  return null;
};
