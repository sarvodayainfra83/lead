import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, PieChart, Pie, Cell
} from 'recharts';
import {
  Users, UserPlus, PhoneCall, Clock, CheckCircle2, Handshake, XCircle, PhoneOff, Flame, Thermometer,
  Building2, ShieldCheck, TrendingUp, ArrowRight, UserCheck, CalendarClock,
  LayoutGrid, Layers, Phone, CalendarDays, ChevronDown, UserCircle2, Package, FileBarChart, Target, Sparkles
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import { useAuthStore } from '../../store/authStore';
import { getUserLeadTypeScope, isUserAdmin, canViewPage } from '../../utils/authUtils';
import { buildShareClient } from '../../utils/productShare';
import { getLeadTypeBadgeClass } from '../../utils/leadTypeColors';
import { CUSTOMER_STATUS_STYLES } from '../CallTracker/callTrackerConstants';
import LeadDetailsModal from '../Lead/LeadDetailsModal';
import SearchableDropdown from '../../components/SearchableDropdown';
import PageTabs from '../../components/PageTabs';
import { getPeriodRange, toInputDate, formatDate as formatFullDate, countWorkingDays, parseAttendanceDate } from '../MISReport/misUtils';

const ALL_TAB = { key: 'All', label: 'All Leads', icon: LayoutGrid };

const TABS = [
  { key: 'Real Estate', label: 'Real Estate', icon: Building2 },
  { key: 'Insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'Mutual Fund', label: 'Mutual Fund', icon: TrendingUp }
];

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' }
];

const STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Call Not Received': 'bg-orange-50 text-orange-700 border-orange-200',
  'No WhatsApp Reply': 'bg-slate-100 text-slate-700 border-slate-300',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Meeting: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  // Site Visit follow-up outcomes (a lead's current status can come from its latest visit follow-up)
  'Future Plan': 'bg-amber-50 text-amber-700 border-amber-200',
  'Revisit': 'bg-teal-50 text-teal-700 border-teal-200',
  'Under Negotiation': 'bg-orange-50 text-orange-700 border-orange-200',
  'Did Not Show': 'bg-slate-100 text-slate-700 border-slate-300',
  'Rejected (Lost)': 'bg-red-50 text-red-700 border-red-200',
  'Deal Lock': 'bg-violet-600 text-white border-violet-700'
};

// Dashboard wording for a status ('Deal Lock' is the Site Visit page's term for a closed deal)
const STATUS_LABELS = { 'Deal Lock': 'Deal Closed' };

const CHART_COLORS = { assigned: '#c7d2fe', calls: '#4f46e5', converted: '#10b981', newLeads: '#a5b4fc' };

const LEAD_TYPE_THEMES = {
  'Real Estate': {
    border: 'border-amber-200/90 hover:border-amber-300',
    bg: 'bg-amber-50/50 hover:bg-amber-100/50',
    text: 'text-amber-900',
    iconColor: 'text-amber-600',
    countColor: 'text-amber-800'
  },
  'Insurance': {
    border: 'border-sky-200/90 hover:border-sky-300',
    bg: 'bg-sky-50/50 hover:bg-sky-100/50',
    text: 'text-sky-900',
    iconColor: 'text-sky-600',
    countColor: 'text-sky-800'
  },
  'Mutual Fund': {
    border: 'border-emerald-200/90 hover:border-emerald-300',
    bg: 'bg-emerald-50/50 hover:bg-emerald-100/50',
    text: 'text-emerald-900',
    iconColor: 'text-emerald-600',
    countColor: 'text-emerald-800'
  }
};

const EMPTY_TOTALS = {
  assigned: 0, newLeads: 0, calls: 0, todayCalls: 0, interested: 0, futurePlan: 0,
  siteVisit: 0, notInterested: 0, notCalled: 0, hot: 0, warm: 0, cold: 0
};

const startOfToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const todayAttendanceStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};


const formatTime = (ms) => {
  if (!ms) return '-';
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const formatDay = (ms) => {
  if (!ms) return '-';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatAmount = (val) => {
  const n = Number(String(val ?? '').replace(/[^0-9.]/g, ''));
  return n > 0 ? `₹${n.toLocaleString('en-IN')}` : '';
};

const formatIsoDate = (val) => (val ? String(val).split('T')[0].split('-').reverse().join('/') : '');

const normName = (s) => String(s || '').trim().toLowerCase();
const isAdminRole = (e) => String(e.role || '').toUpperCase() === 'ADMIN';

const parseTrackerDateStr = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim().split('T')[0].split(' ')[0];
  if (str.includes('-')) {
    const parts = str.split('-').map(Number);
    if (parts.length === 3) {
      return parts[0] > 1000
        ? new Date(parts[0], parts[1] - 1, parts[2])
        : new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }
  if (str.includes('/')) {
    const parts = str.split('/').map(Number);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y < 100 ? 2000 + y : y;
      return new Date(fullYear, m - 1, d);
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

// ----------------------------------------------------------------------------
// Small presentational pieces
// ----------------------------------------------------------------------------

// Page access key for every page the Dashboard links to (matches the route guards in App.jsx)
const PATH_PAGE_KEYS = {
  '/lead': 'lead',
  '/call-tracker': 'callTracker',
  '/site-visit-meeting': 'siteVisitMeeting',
  '/customer-master': 'customerMaster',
  '/deal-closed': 'dealClosed',
  '/products': 'products',
  '/mis-report': 'misReport',
  '/attendance': 'attendance',
  '/attendance-report': 'attendanceReport'
};

// Lead data pages a KPI can drill into without page access (must match AccessGuard's DASHBOARD_DRILLDOWN_PAGES)
const DASHBOARD_DRILLDOWN_PATHS = ['/lead', '/call-tracker', '/site-visit-meeting', '/customer-master', '/non-interested'];

const ViewAll = ({ onClick, label = 'View all' }) => (
  <button onClick={onClick} className="text-[11px] sm:text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap">
    {label} <ArrowRight size={12} />
  </button>
);

const Empty = ({ text }) => (
  <p className="text-xs text-gray-400 italic py-8 text-center px-3">{text}</p>
);

const MEETING_ONLY_CATEGORIES = ['Insurance', 'Mutual Fund'];

const StatusPill = ({ status, meetingOnly = false }) => (
  status ? (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border whitespace-nowrap ${STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {meetingOnly && status === 'Site Visit/Meeting' ? 'Meeting' : (STATUS_LABELS[status] || status)}
    </span>
  ) : <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border border-gray-200 bg-gray-50 text-gray-500 whitespace-nowrap">Not Called</span>
);

const TempPill = ({ value }) => (
  value ? (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[value] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {value}
    </span>
  ) : null
);

const TypePill = ({ type }) => (
  type ? (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${getLeadTypeBadgeClass(type)}`}>
      {type}
    </span>
  ) : null
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-gray-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          {p.name}: <strong className="text-gray-900">{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Reusable UI Pieces for the Refactored Clean Dashboard
// ----------------------------------------------------------------------------

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ title, subtitle, action, icon: Icon }) => (
  <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-gray-100">
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 truncate">
        {Icon && <Icon size={16} className="text-indigo-600 flex-shrink-0" />}
        <span>{title}</span>
      </h3>
      {subtitle && <p className="text-[11px] text-gray-400 truncate mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const AVATAR_COLORS = [
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-teal-50 text-teal-700 border-teal-200'
];

const avatarClass = (name) => {
  const str = String(name || '?');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';

const Avatar = ({ name, size = 'w-9 h-9 text-xs' }) => (
  <span className={`${size} ${avatarClass(name)} rounded-full font-bold border flex items-center justify-center flex-shrink-0 select-none`}>
    {initials(name)}
  </span>
);

// Consistent Row 1 KPI Card
const KpiCard = ({ title, value, icon: Icon, iconBg, iconColor, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white rounded-xl border border-gray-200/80 p-3.5 sm:p-4 text-left hover:border-indigo-300 hover:shadow-sm transition-all group flex flex-col justify-between cursor-pointer"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-gray-500 truncate">{title}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg || 'bg-gray-50'} ${iconColor || 'text-gray-600'} group-hover:scale-105 transition-transform`}>
        <Icon size={16} />
      </div>
    </div>
    <div className="flex items-baseline justify-between mt-1">
      <span className="text-2xl font-bold text-gray-900 tracking-tight leading-none">{value}</span>
      <span className="text-[11px] text-gray-400 group-hover:text-indigo-600 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        View <ArrowRight size={10} />
      </span>
    </div>
  </button>
);

// Clean Person List Row
const PersonRow = ({ name, sub, right, onClick, highlight = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition border-b border-gray-100 last:border-b-0 cursor-pointer ${
      highlight ? 'bg-violet-50/50 hover:bg-violet-50' : 'hover:bg-gray-50/70'
    }`}
  >
    <Avatar name={name} />
    <div className="min-w-0 flex-1">
      <p className="text-xs sm:text-[13px] font-semibold text-gray-900 truncate">{name || 'Customer'}</p>
      <p className="text-[11px] text-gray-500 truncate mt-0.5">{sub}</p>
    </div>
    <div className="flex flex-col items-end gap-1 flex-shrink-0">{right}</div>
  </button>
);

const MoreButton = ({ remaining, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/60 transition border-t border-gray-100 text-center cursor-pointer"
  >
    Show more ({remaining} remaining)
  </button>
);

// ----------------------------------------------------------------------------
// Dashboard Main Component
// ----------------------------------------------------------------------------

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);

  const [data, setData] = useState({ leads: [], calls: [], employees: [], attendance: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const range = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Tab for Row 4 (Recent Activity): 'calling' | 'leads' | 'hotWarm' | 'deals'
  const [activityTab, setActivityTab] = useState('calling');

  // "Show more" paging for the long record lists
  const LIST_PAGE = 15;
  const [listLimit, setListLimit] = useState({ calls: LIST_PAGE, leads: LIST_PAGE, hot: LIST_PAGE, deals: LIST_PAGE });
  const showMore = (key) => setListLimit(prev => ({ ...prev, [key]: prev[key] + LIST_PAGE }));
  const [detailsLead, setDetailsLead] = useState(null);

  // Employee dropdown filter
  const [employeeKey, setEmployeeKey] = useState('');

  // Scoped tabs based on user's assigned lead type
  const scope = getUserLeadTypeScope(user);
  const scopedTabs = scope?.categories?.length > 0
    ? TABS.filter(t => scope.categories.includes(t.key))
    : (scope?.category ? TABS.filter(t => t.key === scope.category) : null);
  const userCategories = scopedTabs || TABS;
  const hasMultipleLeadTypes = userCategories.length > 1;
  const visibleTabs = !scopedTabs ? [ALL_TAB, ...TABS] : (scopedTabs.length > 1 ? [ALL_TAB, ...scopedTabs] : scopedTabs);
  const [activeTab, setActiveTab] = useState(scopedTabs?.length === 1 ? scopedTabs[0].key : 'All');
  const tab = visibleTabs.find(t => t.key === activeTab)?.key || visibleTabs[0].key;
  const isAll = tab === 'All';

  const isMeetingOnly = isAll
    ? visibleTabs.filter(t => t.key !== 'All').every(t => MEETING_ONLY_CATEGORIES.includes(t.key))
    : MEETING_ONLY_CATEGORIES.includes(tab);

  const inTab = useCallback((category) => isAll || category === tab, [isAll, tab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dashboardApi.getDashboardData(user);
      setData(result);
      setLoadedOnce(true);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lead counts per tab
  const tabCounts = useMemo(() => {
    const counts = { All: data.leads.length, 'Real Estate': 0, 'Insurance': 0, 'Mutual Fund': 0 };
    data.leads.forEach(l => { if (counts[l.category] !== undefined) counts[l.category] += 1; });
    return counts;
  }, [data.leads]);

  // Employee options for current tab
  const employeeOptions = useMemo(() => {
    const names = new Map();
    data.employees
      .filter(e => isAll || !e.category || e.category === tab)
      .filter(e => !isAdminRole(e))
      .forEach(e => names.set(normName(e.name), e.name));
    data.leads
      .filter(l => inTab(l.category) && l.callerAssigned)
      .forEach(l => { if (!names.has(normName(l.callerAssigned))) names.set(normName(l.callerAssigned), l.callerAssigned); });
    return Array.from(names.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, tab, isAll, inTab]);

  useEffect(() => {
    setListLimit({ calls: LIST_PAGE, leads: LIST_PAGE, hot: LIST_PAGE, deals: LIST_PAGE });
  }, [tab, employeeKey]);

  useEffect(() => {
    if (employeeKey && !employeeOptions.some(o => o.value === employeeKey)) setEmployeeKey('');
  }, [employeeOptions, employeeKey]);

  // ---------------- Processed View Data ----------------
  const view = useMemo(() => {
    const todayMs = startOfToday().getTime();
    const inRange = (ms) => ms >= range.fromMs && ms < range.toMs;
    const byEmployee = (name) => !employeeKey || normName(name) === employeeKey;
    const leads = data.leads.filter(l => inTab(l.category) && (byEmployee(l.callerAssigned) || byEmployee(l.assignedVisitor)));
    const calls = data.calls.filter(c => inTab(c.category) && byEmployee(c.callerAssigned));

    const isTodayFollowUpLead = (item) => {
      const timeOf = (val) => {
        const d = parseTrackerDateStr(val);
        return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : null;
      };
      const nextCallTime = timeOf(item.nextCallDate || item.latestTracker?.nextDate);
      const meetTime = timeOf(item.meetingDate || item.lastMeetingDate || item.siteVisitDate || item.visitDate || item.latestFollowUp?.visitDate || item.latestFollowUp?.visit_date);
      const nextMeetTime = timeOf(item.nextMeetingDate || item.nextVisitDate || item.latestFollowUp?.nextVisitDate || item.latestFollowUp?.next_visit_date);

      const lastCallObj = parseTrackerDateStr(item.dateOfCallRaw || item.latestTracker?.dateOfCall || item.latestTracker?.date_of_call || item.latestTracker?.timestamp || item.latestTracker?.created_at);
      const lastCallToday = Boolean(lastCallObj) && new Date(lastCallObj.getFullYear(), lastCallObj.getMonth(), lastCallObj.getDate()).getTime() === todayMs;
      const lastVisitObj = parseTrackerDateStr(item.siteVisitDate || item.visitDate || item.latestVisit?.visitDate);
      const lastVisitToday = Boolean(lastVisitObj) && new Date(lastVisitObj.getFullYear(), lastVisitObj.getMonth(), lastVisitObj.getDate()).getTime() === todayMs;
      const hasFollowupToday = (item.visitorFollowUps || item.followUps || []).some(v => {
        const d = parseTrackerDateStr(v.visit_date || v.visitDate || v.timestamp || v.created_at);
        return Boolean(d) && new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === todayMs;
      });

      return nextCallTime === todayMs || meetTime === todayMs || nextMeetTime === todayMs || lastCallToday || lastVisitToday || hasFollowupToday;
    };

    const summarize = (list, callList) => {
      const byStatus = (s) => list.filter(l => l.followUpListStatus === s).length;
      const converted = byStatus('Interested');
      const todayFollowUpsCount = list.filter(isTodayFollowUpLead).length;
      return {
        total: list.length,
        todayLeads: todayFollowUpsCount,
        todayCalls: callList.filter(c => c.timestampMs >= todayMs && c.timestampMs < todayMs + 86400000).length,
        futurePlan: byStatus('Future Plan Date'),
        converted,
        siteVisit: list.filter(l => l.inSiteVisitList).length,
        notInterested: byStatus('Not Interested'),
        notCalled: list.filter(l => l.followUpListStatus === 'Pending' || l.followUpListStatus === 'Unassigned').length,
        hot: list.filter(l => l.hotCustomerStatus === 'Hot').length,
        warm: list.filter(l => l.hotCustomerStatus === 'Warm').length,
        conversionRate: list.length ? Math.round((converted / list.length) * 100) : 0
      };
    };

    const kpis = summarize(leads, calls);

    const byType = TABS.map(t => ({
      ...t,
      ...summarize(
        data.leads.filter(l => l.category === t.key && (byEmployee(l.callerAssigned) || byEmployee(l.assignedVisitor))),
        data.calls.filter(c => c.category === t.key && byEmployee(c.callerAssigned))
      )
    }));

    const todayLeads = leads
      .filter(isTodayFollowUpLead)
      .sort((a, b) => (b.lastActivityMs || 0) - (a.lastActivityMs || 0));
    const todayCalls = calls
      .filter(c => c.timestampMs >= todayMs && c.timestampMs < todayMs + 86400000)
      .sort((a, b) => b.timestampMs - a.timestampMs);
    const hotWarm = leads
      .filter(l => l.hotCustomerStatus === 'Hot' || l.hotCustomerStatus === 'Warm')
      .sort((a, b) => b.lastActivityMs - a.lastActivityMs);
    const dealsClosed = leads
      .filter(l => l.isDealClosed)
      .sort((a, b) => b.dealClosedMs - a.dealClosedMs);

    // Per-employee MIS for selected period
    const tabEmployees = data.employees
      .filter(e => isAll || !e.category || e.category === tab)
      .filter(e => byEmployee(e.name));
    const rows = new Map();
    const ensureRow = (name) => {
      const key = normName(name);
      if (!key) return null;
      if (!rows.has(key)) rows.set(key, { name: String(name).trim(), ...EMPTY_TOTALS });
      return rows.get(key);
    };
    tabEmployees.filter(e => !isAdminRole(e)).forEach(e => ensureRow(e.name));

    leads.forEach(l => {
      const row = ensureRow(l.callerAssigned || l.assignedVisitor || 'Unassigned');
      if (!row) return;
      row.assigned += 1;
      if (l.createdDate && inRange(l.createdDate.getTime())) row.newLeads += 1;
      if (l.followUpListStatus === 'Pending' || l.followUpListStatus === 'Unassigned') row.notCalled += 1;
      if (inRange(l.lastActivityMs) && (l.trackers.length > 0 || l.followUps?.length > 0)) {
        if (l.status === 'Interested' || l.status === 'Deal Lock') row.interested += 1;
        if (l.status === 'Future Plan Date') row.futurePlan += 1;
        if (l.isSiteVisit || l.status === 'Site Visit/Meeting' || l.status === 'Meeting') row.siteVisit += 1;
        if (l.status === 'Not Interested') row.notInterested += 1;
        if (l.customerStatus === 'Hot' && !l.isDealClosed) row.hot += 1;
        if (l.customerStatus === 'Warm' && !l.isDealClosed) row.warm += 1;
        if (l.customerStatus === 'Cold') row.cold += 1;
      }
    });
    calls.forEach(c => {
      const row = ensureRow(c.callerAssigned || 'Unassigned');
      if (!row) return;
      if (inRange(c.timestampMs)) row.calls += 1;
      if (c.timestampMs >= todayMs) row.todayCalls += 1;
    });

    const mis = Array.from(rows.values())
      .map(r => ({ ...r, conversion: r.assigned ? Math.round((r.interested / r.assigned) * 100) : 0 }))
      .sort((a, b) => b.calls - a.calls || b.assigned - a.assigned || a.name.localeCompare(b.name));

    const totals = mis.reduce((acc, r) => {
      Object.keys(EMPTY_TOTALS).forEach(k => { acc[k] += r[k] || 0; });
      return acc;
    }, { ...EMPTY_TOTALS });
    totals.conversion = totals.assigned ? Math.round((totals.interested / totals.assigned) * 100) : 0;

    // Today present employees
    const todayStr = todayAttendanceStr();
    const tabEmployeeNames = new Set(tabEmployees.map(e => normName(e.name)));
    const knownNames = new Set(data.employees.map(e => normName(e.name)));
    const present = data.attendance
      .filter(a => a.date === todayStr)
      .filter(a => {
        const n = normName(a.userName);
        if (employeeKey) return n === employeeKey;
        return tabEmployeeNames.has(n) || !knownNames.has(n);
      })
      .sort((a, b) => String(a.inTime || '').localeCompare(String(a.inTime || '')));
    const teamSize = tabEmployees.filter(e => !isAdminRole(e)).length;

    // Personal user intraday / daily breakdown
    const DAY_MS = 24 * 60 * 60 * 1000;
    const endMs = Math.min(range.toMs, todayMs + DAY_MS);
    const daily = [];
    if (!isAdmin) {
      const isSingleDay = period === 'today' || (range.toMs - range.fromMs <= DAY_MS);
      if (isSingleDay) {
        const hourBuckets = [];
        let minH = 9;
        let maxH = 19;
        calls.forEach(c => {
          const cMs = Number(c.timestampMs) || 0;
          if (cMs >= range.fromMs && cMs < range.toMs) {
            const h = new Date(cMs).getHours();
            if (h < minH && h >= 6) minH = h;
            if (h > maxH && h <= 23) maxH = h;
          }
        });
        for (let h = minH; h <= maxH; h++) {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const displayH = h % 12 || 12;
          hourBuckets.push({
            hour: h,
            name: `${displayH} ${ampm}`,
            Calls: 0,
            Converted: 0,
            'New Leads': 0
          });
        }
        calls.forEach(c => {
          const cMs = Number(c.timestampMs) || 0;
          if (cMs >= range.fromMs && cMs < range.toMs) {
            const h = new Date(cMs).getHours();
            let b = hourBuckets.find(x => x.hour === h);
            if (!b) {
              const ampm = h >= 12 ? 'PM' : 'AM';
              const displayH = h % 12 || 12;
              b = { hour: h, name: `${displayH} ${ampm}`, Calls: 0, Converted: 0, 'New Leads': 0 };
              hourBuckets.push(b);
              hourBuckets.sort((x, y) => x.hour - y.hour);
            }
            b.Calls += 1;
            if (c.status === 'Interested') b.Converted += 1;
          }
        });
        leads.forEach(l => {
          const lDate = l.createdDate;
          const lMs = lDate ? lDate.getTime() : 0;
          if (lMs >= range.fromMs && lMs < range.toMs) {
            const rawTime = l.timestamp || l.created_at || l.createdAt;
            let h = 10;
            if (rawTime && String(rawTime).includes(':')) {
              const parsed = new Date(rawTime);
              if (!isNaN(parsed.getTime())) h = parsed.getHours();
            }
            let b = hourBuckets.find(x => x.hour === h);
            if (b) b['New Leads'] += 1;
            else if (hourBuckets.length > 0) hourBuckets[0]['New Leads'] += 1;
          }
        });
        daily.push(...hourBuckets);
      } else {
        const byDay = {};
        for (let t = range.fromMs; t < endMs; t += DAY_MS) {
          const d = new Date(t);
          const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          if (!byDay[key]) {
            const item = { dayMs: key, name: formatDay(key), Calls: 0, Converted: 0, 'New Leads': 0 };
            byDay[key] = item;
            daily.push(item);
          }
        }
        if (daily.length === 0) {
          const key = new Date(range.fromMs).getTime();
          const item = { dayMs: key, name: formatDay(key), Calls: 0, Converted: 0, 'New Leads': 0 };
          byDay[key] = item;
          daily.push(item);
        }
        const dayOf = (ms) => {
          const d = new Date(ms);
          return byDay[new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()];
        };
        calls.forEach(c => {
          const day = dayOf(c.timestampMs);
          if (!day) return;
          day.Calls += 1;
          if (c.status === 'Interested') day.Converted += 1;
        });
        leads.forEach(l => {
          const day = l.createdDate && byDay[l.createdDate.getTime()];
          if (day) day['New Leads'] += 1;
        });
      }
    }

    const myName = normName(user?.name);
    const myAttendance = isAdmin ? [] : data.attendance
      .filter(a => normName(a.userName) === myName)
      .map(a => ({ ...a, dayMs: parseAttendanceDate(a.date)?.getTime() || 0 }))
      .filter(a => a.dayMs >= range.fromMs && a.dayMs < range.toMs)
      .sort((a, b) => b.dayMs - a.dayMs);
    const myToday = isAdmin ? null : data.attendance.find(a => normName(a.userName) === myName && a.date === todayStr) || null;
    const myWorkingDays = isAdmin ? 0 : countWorkingDays(range.fromMs, range.toMs);

    return { kpis, byType, todayLeads, todayCalls, hotWarm, dealsClosed, mis, totals, present, teamSize, daily, myAttendance, myToday, myWorkingDays };
  }, [data, tab, isAll, inTab, range, employeeKey, isAdmin, user]);

  const { kpis, byType, todayLeads, todayCalls, hotWarm, dealsClosed, mis, present, teamSize, daily, myAttendance, myToday, myWorkingDays } = view;

  const leadById = useMemo(() => Object.fromEntries(data.leads.map(l => [String(l.id), l])), [data.leads]);

  const periodLabel = period === 'custom'
    ? `${formatFullDate(range.fromMs)} – ${formatFullDate(range.toMs - 1)}`
    : PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Period';

  const tabLabel = isAll ? 'All Leads' : tab;

  // Chart lists employees for team performance view
  const chartData = mis
    .filter(r => r.name && r.name !== 'Unassigned')
    .map(r => ({ name: r.name, Assigned: r.assigned, Calls: r.calls, Converted: r.interested }));

  // Permissions and navigation
  const canOpen = (path) => canViewPage(user, PATH_PAGE_KEYS[path]);

  const openPage = (path, options) => {
    if (!canOpen(path)) {
      toast.error("You don't have access to this page");
      return;
    }
    navigate(path, options);
  };

  const canDrillInto = (path) => canOpen(path) || DASHBOARD_DRILLDOWN_PATHS.includes(path);

  const go = (path, state = {}, tabKey = tab) => {
    let targetPath = path;
    let targetState = { ...state };
    if (isAdmin && (targetPath === '/site-visit-meeting' || targetPath === '/assign-visitor' || targetPath === '/visitor-follow-up')) {
      targetPath = '/call-tracker';
      targetState = {
        dateFilter: 'all',
        stageFilter: 'Site Visit',
        ...targetState
      };
    }
    if (!canDrillInto(targetPath)) {
      toast.error("You don't have access to this page");
      return;
    }
    const navState = { ...targetState, fromDashboard: true };
    navigate(targetPath, {
      state: tabKey && tabKey !== 'All' ? { tab: tabKey, ...navState } : navState
    });
  };

  const loadingOr = (text) => (loading ? 'Loading...' : text);

  // Status Breakdown segments for Row 2 summary
  const statusSegments = useMemo(() => {
    const total = Math.max(1, kpis.total);
    return [
      {
        label: 'Converted',
        value: kpis.converted,
        pct: Math.round((kpis.converted / total) * 100),
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        onClick: () => go('/call-tracker', { statusFilter: 'Interested', dateFilter: 'all' })
      },
      {
        label: 'Future Plan',
        value: kpis.futurePlan,
        pct: Math.round((kpis.futurePlan / total) * 100),
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        onClick: () => go('/call-tracker', { statusFilter: 'Future Plan Date', dateFilter: 'all' })
      },
      {
        label: isMeetingOnly ? 'Meeting' : 'Site Visit',
        value: kpis.siteVisit,
        pct: Math.round((kpis.siteVisit / total) * 100),
        dotClass: 'bg-cyan-500',
        badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        onClick: () => go('/site-visit-meeting', { dateFilter: 'all' })
      },
      {
        label: 'Not Interested',
        value: kpis.notInterested,
        pct: Math.round((kpis.notInterested / total) * 100),
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        onClick: () => go('/call-tracker', { statusFilter: 'Not Interested', dateFilter: 'all' })
      },
      {
        label: 'Not Called (Pending)',
        value: kpis.notCalled,
        pct: Math.round((kpis.notCalled / total) * 100),
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
        onClick: () => go('/call-tracker', { statusFilter: 'Pending', dateFilter: 'all' })
      }
    ];
  }, [kpis, isMeetingOnly]);

  // Dynamic View All destination for Row 4 Activity Tab
  const activityViewAll = useMemo(() => {
    switch (activityTab) {
      case 'calling':
        return { label: 'View all calls', onClick: () => go('/call-tracker', { dateFilter: 'today' }) };
      case 'leads':
        return { label: 'View all leads', onClick: () => go('/call-tracker', { dateFilter: 'today' }) };
      case 'hotWarm':
        return { label: 'View Hot & Warm', onClick: () => go('/customer-master', { customerStatus: 'all' }) };
      case 'deals':
        return { label: 'View all deals', onClick: () => go('/deal-closed') };
      default:
        return null;
    }
  }, [activityTab]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gray-50/50">
      <div className="p-3 sm:p-5 space-y-4 max-w-[1600px] mx-auto pb-8">

        {/* =========================================================================
            HEADER: Business Vertical Tabs (Left) · Filters (Right)
        ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <PageTabs
            tabs={visibleTabs.map(t => ({ ...t, count: tabCounts[t.key] ?? 0 }))}
            activeKey={tab}
            onChange={setActiveTab}
          />

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                <UserCircle2 size={14} /> My Dashboard · {user?.name || 'Me'}
              </span>
            )}
            {isAdmin && (
              <div className="flex-1 sm:flex-none min-w-[150px] sm:w-[180px]">
                <SearchableDropdown
                  options={[{ value: '', label: isAll ? 'All Employees' : `All ${tab} Employees` }, ...employeeOptions]}
                  value={employeeKey}
                  onChange={setEmployeeKey}
                  placeholder={isAll ? 'All Employees' : `All ${tab} Employees`}
                  height="h-[34px]"
                />
              </div>
            )}
          </div>
        </div>

        {loading && !loadedOnce ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading dashboard...</p>
          </Card>
        ) : (<>

          {/* =========================================================================
              ROW 1: Six Consistent KPI Cards
              Total Leads · Today's Leads · Today's Calls · Converted · Site Visits · Deal Closed
          ========================================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              title="Total Leads"
              value={kpis.total}
              icon={Users}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
              onClick={() => go('/lead', { dateFilter: 'all' })}
            />
            <KpiCard
              title="Today's Leads"
              value={kpis.todayLeads}
              icon={UserPlus}
              iconBg="bg-sky-50"
              iconColor="text-sky-600"
              onClick={() => go('/call-tracker', { dateFilter: 'today' })}
            />
            <KpiCard
              title="Today's Calls"
              value={kpis.todayCalls}
              icon={PhoneCall}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              onClick={() => go('/call-tracker', { dateFilter: 'today', calledOnly: true })}
            />
            <KpiCard
              title="Converted"
              value={kpis.converted}
              icon={TrendingUp}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              onClick={() => go('/call-tracker', { statusFilter: 'Interested', dateFilter: 'all' })}
            />
            <KpiCard
              title={isMeetingOnly ? 'Meetings' : 'Site Visits'}
              value={kpis.siteVisit}
              icon={Handshake}
              iconBg="bg-cyan-50"
              iconColor="text-cyan-600"
              onClick={() => go('/site-visit-meeting', { dateFilter: 'all' })}
            />
            <KpiCard
              title="Deal Closed"
              value={dealsClosed.length}
              icon={CheckCircle2}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              onClick={() => go('/deal-closed')}
            />
          </div>

          {/* =========================================================================
              ROW 2: Employee Performance Chart (Left) + Lead Status Summary (Right)
          ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Employee Performance Chart */}
            <Card className="lg:col-span-8 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 truncate">
                    <TrendingUp size={16} className="text-indigo-600 flex-shrink-0" />
                    <span>{isAdmin ? 'Employee Performance' : 'My Performance'}</span>
                    <span className="text-xs font-normal text-gray-400 truncate">· {tabLabel}</span>
                  </h3>
                </div>

                {/* Date Filter: Today | This Month | Custom */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-gray-100 border border-gray-200/80 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setPeriod('today')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                      period === 'today'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900 font-medium'
                    }`}
                  >
                    <Clock size={11} className={period === 'today' ? 'text-indigo-600' : 'text-gray-400'} />
                    <span>Today</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('month')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                      period === 'month'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900 font-medium'
                    }`}
                  >
                    <CalendarDays size={11} className={period === 'month' ? 'text-indigo-600' : 'text-gray-400'} />
                    <span>This Month</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('custom')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                      period === 'custom'
                        ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900 font-medium'
                    }`}
                  >
                    <CalendarClock size={11} className={period === 'custom' ? 'text-indigo-600' : 'text-gray-400'} />
                    <span>{period === 'custom' ? `${formatDay(range.fromMs)}–${formatDay(range.toMs - 1)}` : 'Custom'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Custom Date Range Inputs */}
              {period === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 bg-indigo-50/30">
                  <label className="inline-flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From</span>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-2 text-xs h-[30px] text-gray-700 focus:outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To</span>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-2 text-xs h-[30px] text-gray-700 focus:outline-none focus:border-indigo-500"
                    />
                  </label>
                </div>
              )}

              {/* Legend & Period indicator */}
              <div className="flex items-center justify-between px-4 pt-2.5 pb-1 text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  {(isAdmin
                    ? [['Assigned', CHART_COLORS.assigned], ['Calls', CHART_COLORS.calls], ['Converted', CHART_COLORS.converted]]
                    : [['Calls', CHART_COLORS.calls], ['Converted', CHART_COLORS.converted], ['New Leads', CHART_COLORS.newLeads]]
                  ).map(([lbl, clr]) => (
                    <span key={lbl} className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: clr }} />
                      <span>{lbl}</span>
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-gray-400 font-medium">{periodLabel}</span>
              </div>

              {/* Chart Render */}
              {(isAdmin ? chartData.length > 0 : daily.length > 0) ? (
                <div className="flex-1 px-3 pb-3 overflow-x-auto">
                  <div style={{ minWidth: `${Math.max((isAdmin ? chartData.length * 80 : daily.length * 40), 280)}px` }}>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={isAdmin ? chartData : daily.map(d => ({ ...d, name: d.name || formatDay(d.dayMs) }))}
                        margin={{ top: 16, right: 8, left: -20, bottom: 0 }}
                        barGap={3}
                        barCategoryGap="22%"
                      >
                        <CartesianGrid vertical={false} stroke="#f3f4f6" />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          height={isAdmin && chartData.length > 5 ? 44 : 26}
                          angle={isAdmin && chartData.length > 5 ? -25 : 0}
                          textAnchor={isAdmin && chartData.length > 5 ? 'end' : 'middle'}
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79,70,229,0.04)', radius: 6 }} />
                        {isAdmin ? (
                          <>
                            <Bar dataKey="Assigned" fill={CHART_COLORS.assigned} radius={[4, 4, 0, 0]} maxBarSize={18} />
                            <Bar dataKey="Calls" fill={CHART_COLORS.calls} radius={[4, 4, 0, 0]} maxBarSize={18}>
                              <LabelList dataKey="Calls" position="top" style={{ fontSize: 9, fill: '#4f46e5', fontWeight: 700 }} />
                            </Bar>
                            <Bar dataKey="Converted" fill={CHART_COLORS.converted} radius={[4, 4, 0, 0]} maxBarSize={18} />
                          </>
                        ) : (
                          <>
                            <Bar dataKey="Calls" fill={CHART_COLORS.calls} radius={[4, 4, 0, 0]} maxBarSize={16}>
                              <LabelList dataKey="Calls" position="top" style={{ fontSize: 9, fill: '#4f46e5', fontWeight: 700 }} />
                            </Bar>
                            <Bar dataKey="Converted" fill={CHART_COLORS.converted} radius={[4, 4, 0, 0]} maxBarSize={16} />
                            <Bar dataKey="New Leads" fill={CHART_COLORS.newLeads} radius={[4, 4, 0, 0]} maxBarSize={16} />
                          </>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center py-12">
                  <Empty text={loadingOr(`No activity recorded for ${tabLabel} in this period.`)} />
                </div>
              )}
            </Card>

            {/* Combined Lead Status & Conversion Summary */}
            <Card className="lg:col-span-4 flex flex-col justify-between">
              <div>
                <CardHeader
                  title="Lead Status Summary"
                  subtitle={`${tabLabel} pipeline breakdown`}
                  icon={Layers}
                />

                {/* Conversion Rate Highlight */}
                <div className="p-4 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block">
                      Conversion Rate
                    </span>
                    <span className="text-2xl font-bold text-gray-900 mt-0.5 block">
                      {kpis.conversionRate}%
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      {kpis.converted} of {kpis.total} leads converted
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
                    <Target size={22} />
                  </div>
                </div>

                {/* Pipeline Progress Strip */}
                <div className="px-4 pt-3 pb-1">
                  <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-gray-100">
                    {statusSegments.filter(s => s.value > 0).map(s => (
                      <div
                        key={s.label}
                        className={`${s.dotClass} h-full`}
                        style={{ width: `${s.pct}%` }}
                        title={`${s.label}: ${s.value} (${s.pct}%)`}
                      />
                    ))}
                  </div>
                </div>

                {/* Status Items List */}
                <div className="p-4 space-y-1">
                  {statusSegments.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={s.onClick}
                      className="w-full flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-gray-50 transition cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2 text-gray-700 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
                        <span className="truncate font-medium">{s.label}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-gray-900">{s.value}</span>
                        <span className="text-[11px] text-gray-400 w-8 text-right">{s.pct}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 py-2.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span>Click any status to filter Lead Tracker</span>
                <ArrowRight size={12} className="text-gray-400" />
              </div>
            </Card>
          </div>

          {/* =========================================================================
              ROW 3: Compact Business Overview
              Business Verticals · Customer Temperature (Hot / Warm) · Team Presence
          ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Lead Counts by Business Vertical */}
            <Card className="flex flex-col">
              <CardHeader
                title="Business Verticals"
                subtitle="Lead distribution by industry"
                icon={Building2}
              />
              <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-center">
                {byType.map(t => {
                  const Icon = t.icon;
                  const isCurrent = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => go('/lead', { dateFilter: 'all' }, t.key)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition text-left cursor-pointer ${
                        isCurrent
                          ? 'border-indigo-300 bg-indigo-50/40'
                          : 'border-gray-200/80 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{t.label}</p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {t.converted} converted · {t.siteVisit} {t.key === 'Real Estate' ? 'visits' : 'meetings'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-gray-900">{t.total}</span>
                        <span className="text-[10px] text-gray-400 block">leads</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* 2. Customer Temperature (Hot & Warm) */}
            <Card className="flex flex-col">
              <CardHeader
                title="Customer Temperature"
                subtitle="High-intent active leads"
                icon={Flame}
                action={canDrillInto('/customer-master') && (
                  <ViewAll onClick={() => go('/customer-master', { customerStatus: 'all' })} label="Open" />
                )}
              />
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => go('/customer-master', { customerStatus: 'Hot' })}
                    className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition text-left cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                        <Flame size={13} className="text-rose-500 fill-rose-500" /> Hot
                      </span>
                      <ArrowRight size={12} className="text-rose-400" />
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-rose-900">{kpis.hot}</span>
                      <span className="text-[10px] text-rose-600 block">clients ready to close</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => go('/customer-master', { customerStatus: 'Warm' })}
                    className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition text-left cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                        <Thermometer size={13} className="text-amber-500" /> Warm
                      </span>
                      <ArrowRight size={12} className="text-amber-400" />
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-amber-900">{kpis.warm}</span>
                      <span className="text-[10px] text-amber-600 block">interested followups</span>
                    </div>
                  </button>
                </div>

                {/* Vertical-wise Hot/Warm breakdown */}
                {hasMultipleLeadTypes && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Breakdown by Vertical
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {byType.map(t => (
                        <div key={t.key} className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-600 truncate">{t.label}</p>
                          <p className="text-xs font-bold text-gray-800 mt-0.5">
                            <span className="text-rose-600">{t.hot}H</span> · <span className="text-amber-600">{t.warm}W</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* 3. Team Attendance / Quick Summary */}
            <Card className="flex flex-col">
              <CardHeader
                title={isAdmin ? "Team Presence Today" : "My Attendance"}
                subtitle={isAdmin ? `${present.length} of ${teamSize || present.length} present` : periodLabel}
                icon={UserCheck}
                action={canOpen('/attendance-report') && (
                  <ViewAll onClick={() => openPage('/attendance-report')} label="Report" />
                )}
              />
              <div className="p-4 flex-1 flex flex-col justify-between">
                {isAdmin ? (
                  <>
                    {present.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span className="font-semibold text-gray-700">Currently Clocked In</span>
                          <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {present.filter(a => !a.outTime).length} Active
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {present.map((a, idx) => (
                            <div
                              key={a.id || idx}
                              className="flex items-center gap-2 p-1.5 rounded-lg border border-gray-100 bg-gray-50/70 text-left min-w-0"
                            >
                              <Avatar name={a.userName} size="w-7 h-7 text-[10px]" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-gray-800 truncate">{String(a.userName || '').split(' ')[0]}</p>
                                <p className="text-[9px] text-gray-400 truncate">
                                  {a.inTime ? `In: ${a.inTime}` : '-'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Empty text="No attendance marked yet today." />
                    )}

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 mt-2">
                      <span>Total Employees: <strong>{teamSize}</strong></span>
                      <button
                        type="button"
                        onClick={() => openPage('/attendance-report')}
                        className="text-indigo-600 font-semibold hover:underline"
                      >
                        View Full Log
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 flex flex-col justify-center h-full">
                    <div className={`p-3 rounded-xl border ${myToday ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${myToday ? 'text-emerald-700' : 'text-rose-600'}`}>
                        Today's Status
                      </span>
                      <p className={`text-base font-bold mt-1 ${myToday ? 'text-emerald-900' : 'text-rose-800'}`}>
                        {myToday ? `Clocked in at ${myToday.inTime || '-'}` : 'Not clocked in yet'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {myToday?.outTime ? `Clocked out at ${myToday.outTime}` : (myToday ? 'Active working shift' : 'Mark attendance now')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
                      <span>Present: <strong>{myAttendance.length}</strong> / {myWorkingDays} days</span>
                      <button
                        type="button"
                        onClick={() => openPage('/attendance')}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        Attendance Page →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* =========================================================================
              ROW 4: Single Tabbed Recent Activity Section
              Today's Calling · Today's Leads · Recent Hot & Warm · Deal Closed
          ========================================================================= */}
          <Card className="flex flex-col">
            {/* Tabbed Activity Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
                {[
                  { key: 'calling', label: "Today's Calling", count: todayCalls.length, icon: PhoneCall },
                  { key: 'leads', label: "Today's Leads", count: todayLeads.length, icon: UserPlus },
                  { key: 'hotWarm', label: "Recent Hot & Warm", count: hotWarm.length, icon: Flame },
                  { key: 'deals', label: "Deal Closed", count: dealsClosed.length, icon: CheckCircle2 }
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = activityTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActivityTab(item.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={13} className={isActive ? 'text-white' : 'text-gray-400'} />
                      <span>{item.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activityViewAll && (
                <div className="shrink-0 flex items-center justify-end">
                  <ViewAll onClick={activityViewAll.onClick} label={activityViewAll.label} />
                </div>
              )}
            </div>

            {/* Tabbed Activity Content: Single Readable List */}
            <div className="min-h-[260px] max-h-[460px] overflow-y-auto">
              {activityTab === 'calling' && (
                todayCalls.length > 0 ? (
                  <>
                    {todayCalls.slice(0, listLimit.calls).map((c, idx) => {
                      const lead = leadById[String(c.leadId)];
                      return (
                        <PersonRow
                          key={c.id || idx}
                          onClick={() => lead && setDetailsLead(lead)}
                          highlight={Boolean(lead?.isDealClosed)}
                          name={c.personName}
                          sub={`${formatTime(c.timestampMs)} · Caller: ${c.callerAssigned || 'Unassigned'}${c.number ? ` · ${c.number}` : ''}`}
                          right={<>
                            <StatusPill
                              status={lead?.isDealClosed ? 'Deal Lock' : (lead?.status || c.status)}
                              meetingOnly={MEETING_ONLY_CATEGORIES.includes(lead?.category || tab)}
                            />
                            <div className="flex items-center gap-1">
                              {isAll && <TypePill type={lead?.leadType} />}
                              <TempPill value={lead ? lead.customerStatus : c.customerStatus} />
                            </div>
                          </>}
                        />
                      );
                    })}
                    {todayCalls.length > listLimit.calls && (
                      <MoreButton remaining={todayCalls.length - listLimit.calls} onClick={() => showMore('calls')} />
                    )}
                  </>
                ) : (
                  <Empty text={loadingOr('No calls logged today yet.')} />
                )
              )}

              {activityTab === 'leads' && (
                todayLeads.length > 0 ? (
                  <>
                    {todayLeads.slice(0, listLimit.leads).map((l, idx) => (
                      <PersonRow
                        key={l.id || idx}
                        onClick={() => setDetailsLead(l)}
                        highlight={l.isDealClosed}
                        name={l.personName}
                        sub={`${l.leadNo || ''}${l.leadSource ? ` · Source: ${l.leadSource}` : ''} · Assigned: ${l.callerAssigned || l.assignedVisitor || 'Unassigned'}`}
                        right={<>
                          <StatusPill
                            status={l.isDealClosed ? 'Deal Lock' : l.status}
                            meetingOnly={MEETING_ONLY_CATEGORIES.includes(l.category || tab)}
                          />
                          {isAll && <TypePill type={l.leadType} />}
                        </>}
                      />
                    ))}
                    {todayLeads.length > listLimit.leads && (
                      <MoreButton remaining={todayLeads.length - listLimit.leads} onClick={() => showMore('leads')} />
                    )}
                  </>
                ) : (
                  <Empty text={loadingOr('No leads scheduled for follow-up today.')} />
                )
              )}

              {activityTab === 'hotWarm' && (
                hotWarm.length > 0 ? (
                  <>
                    {hotWarm.slice(0, listLimit.hot).map((l, idx) => (
                      <PersonRow
                        key={l.id || idx}
                        onClick={() => setDetailsLead(l)}
                        name={l.personName}
                        sub={`Last Call: ${formatDay(l.lastActivityMs)}${l.latestTracker?.nextDate ? ` · Next: ${formatIsoDate(l.latestTracker.nextDate)}` : ''} · ${l.callerAssigned || 'Unassigned'}`}
                        right={<>
                          <TempPill value={l.customerStatus} />
                          {isAll && <TypePill type={l.leadType} />}
                        </>}
                      />
                    ))}
                    {hotWarm.length > listLimit.hot && (
                      <MoreButton remaining={hotWarm.length - listLimit.hot} onClick={() => showMore('hot')} />
                    )}
                  </>
                ) : (
                  <Empty text={loadingOr('No Hot or Warm clients available.')} />
                )
              )}

              {activityTab === 'deals' && (
                dealsClosed.length > 0 ? (
                  <>
                    {dealsClosed.slice(0, listLimit.deals).map((l, idx) => {
                      const deal = l.dealFollowUp || {};
                      const closedBy = deal.salesExecutive || deal.visitorName || l.assignedVisitor || l.callerAssigned || 'Unassigned';
                      const amount = formatAmount(deal.closingAmount);
                      return (
                        <PersonRow
                          key={l.id || idx}
                          onClick={() => setDetailsLead(l)}
                          highlight
                          name={l.personName}
                          sub={`${l.dealClosedMs ? `Closed: ${formatDay(l.dealClosedMs)} · ` : ''}Executive: ${closedBy}${amount ? ` · Value: ${amount}` : ''}`}
                          right={<>
                            <StatusPill status="Deal Lock" />
                            {isAll && <TypePill type={l.leadType} />}
                          </>}
                        />
                      );
                    })}
                    {dealsClosed.length > listLimit.deals && (
                      <MoreButton remaining={dealsClosed.length - listLimit.deals} onClick={() => showMore('deals')} />
                    )}
                  </>
                ) : (
                  <Empty text={loadingOr('No deals closed yet in this category.')} />
                )
              )}
            </div>
          </Card>

        </>)}
      </div>

      {/* Full Lead Details Modal */}
      <LeadDetailsModal
        isOpen={Boolean(detailsLead)}
        onClose={() => setDetailsLead(null)}
        lead={detailsLead}
        onShareProducts={(lead) => {
          setDetailsLead(null);
          navigate('/products', { state: { shareClient: buildShareClient(lead) } });
        }}
      />
    </div>
  );
}
