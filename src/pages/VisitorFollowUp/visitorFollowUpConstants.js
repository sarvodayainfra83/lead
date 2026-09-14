// Shared constants and utilities for Visitor Follow Up module

export const VISITOR_STATUS_OPTIONS = [
  'Interested',
  'Not Interested',
  'Future Plan',
  'Did Not Show'
];

export const INTEREST_LEVEL_OPTIONS = [
  'High',
  'Medium',
  'Low'
];

export const REJECTED_REASONS = [
  'Not Interested',
  'Price / Budget Too High',
  'Competitor Chosen',
  'Postponed',
  'Documentation / Legal Issue',
  'Other'
];

export const STATUS_STYLES = {
  'Interested': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Future Plan': 'bg-amber-50 text-amber-700 border-amber-200',
  'Did Not Show': 'bg-gray-100 text-gray-700 border-gray-300'
};

export const INTEREST_STYLES = {
  'High': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Medium': 'bg-amber-50 text-amber-700 border-amber-200',
  'Low': 'bg-blue-50 text-blue-700 border-blue-200'
};

export const DEAL_OUTCOME_STYLES = {
  'Closed (Won)': 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold',
  'Rejected (Lost)': 'bg-red-50 text-red-700 border-red-300 font-bold'
};

export const PENDING_TABLE_HEADERS = [
  "ACTION", "LEAD NO", "LEAD DATE", "LEAD TYPE", "LEAD SOURCE", "REFERENCE NAME",
  "PRODUCT TYPE", "REQUIREMENT", "SUB PRODUCT TYPE", "CUSTOMER NAME", "CUSTOMER NUMBER",
  "CUSTOMER EMAIL", "CUSTOMER DOB", "CUSTOMER OCCUPATION", "INVESTMENT BUDGET",
  "CUSTOMER ADDRESS", "WHEN TO BUY PLAN", "MEDICAL CONDITION", "REMARKS",
  "VISIT DATE", "RELATIONSHIP MANAGER", "VISIT REMARKS", "ASSIGNED VISITOR",
  "VISITOR REMARKS", "FOLLOW UP NO", "STATUS", "INTEREST LEVEL", "WHAT HAPPENED",
  "NEXT VISIT DATE"
];

export const HISTORY_TABLE_HEADERS = [
  "LEAD NO", "LEAD DATE", "ASSIGNED VISITOR", "VISIT DATE", "FOLLOW UP NO",
  "STATUS", "INTEREST LEVEL", "DEAL OUTCOME", "REASON / REMARKS", "WHAT HAPPENED", "NEXT VISIT DATE", "LOCATION",
  "RELATIONSHIP MANAGER", "LEAD TYPE", "LEAD SOURCE", "REFERENCE NAME",
  "PRODUCT TYPE", "REQUIREMENT", "SUB PRODUCT TYPE", "CUSTOMER NAME",
  "CUSTOMER NUMBER", "CUSTOMER EMAIL", "CUSTOMER DOB", "CUSTOMER OCCUPATION",
  "INVESTMENT BUDGET", "CUSTOMER ADDRESS", "WHEN TO BUY PLAN", "MEDICAL CONDITION",
  "LEAD REMARKS", "VISIT REMARKS", "VISITOR REMARKS", "FOLLOW UP LOGGED AT"
];

export const formatDisplayDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim();

  // If already DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${fullYear}`;
    }
  }

  // If ISO YYYY-MM-DD
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
