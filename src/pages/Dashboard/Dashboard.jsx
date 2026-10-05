import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, PieChart, Pie, Cell
} from 'recharts';
import {
  Users, UserPlus, PhoneCall, Clock, CheckCircle2, Handshake, XCircle, PhoneOff, Flame, Thermometer,
  Building2, ShieldCheck, TrendingUp, RefreshCw, ArrowRight, UserCheck, CalendarClock,
  LayoutGrid, Layers, Phone, CalendarDays, ChevronDown, UserCircle2, Package, FileBarChart, Target, Sparkles
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import { useAuthStore } from '../../store/authStore';
import { getUserLeadTypeScope, isUserAdmin } from '../../utils/authUtils';
import { buildShareClient } from '../../utils/productShare';
import { getLeadTypeBadgeClass } from '../../utils/leadTypeColors';
import { CUSTOMER_STATUS_STYLES } from '../CallTracker/callTrackerConstants';
import LeadDetailsModal from '../Lead/LeadDetailsModal';
import SearchableDropdown from '../../components/SearchableDropdown';
import PageTabs from '../../components/PageTabs';
import DateRangeModal from '../../components/DateRangeModal';
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
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Meeting: 'bg-cyan-50 text-cyan-700 border-cyan-200'
};

const CHART_COLORS = { assigned: '#c7d2fe', calls: '#4f46e5', converted: '#10b981', newLeads: '#a5b4fc' };

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

const formatIsoDate = (val) => (val ? String(val).split('T')[0].split('-').reverse().join('/') : '');

const normName = (s) => String(s || '').trim().toLowerCase();
const isAdminRole = (e) => String(e.role || '').toUpperCase() === 'ADMIN';

// ----------------------------------------------------------------------------
// Small presentational pieces
// ----------------------------------------------------------------------------

const ViewAll = ({ onClick, label = 'View all' }) => (
  <button onClick={onClick} className="text-[11px] sm:text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap">
    {label} <ArrowRight size={12} />
  </button>
);

const Empty = ({ text }) => (
  <p className="text-xs text-gray-400 italic py-8 text-center px-3">{text}</p>
);

const StatusPill = ({ status }) => (
  status ? (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border whitespace-nowrap ${STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
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
// Card-style pieces for the redesigned dashboard
// ----------------------------------------------------------------------------

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.05)] ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ title, subtitle, action, icon: Icon }) => (
  <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2">
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 truncate">
        {Icon && <Icon size={15} className="text-indigo-600 flex-shrink-0" />}
        {title}
      </h3>
      {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700'
];
const avatarClass = (name) => {
  const str = String(name || '?');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';

const Avatar = ({ name, size = 'w-9 h-9 text-xs' }) => (
  <span className={`${size} ${avatarClass(name)} rounded-full font-bold flex items-center justify-center flex-shrink-0`}>
    {initials(name)}
  </span>
);

// Metric block: 2-per-row grid on phones/tablets, stacked list on large screens (like "Total income")
const MetricBlock = ({ label, value, note, noteClass = 'text-gray-400', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full min-w-0 text-left bg-white px-2.5 sm:px-4 py-2 sm:py-3 hover:bg-gray-50 transition group flex flex-col justify-center"
  >
    <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium flex items-center justify-between gap-1">
      <span className="truncate">{label}</span>
      <ArrowRight size={12} className="text-gray-300 group-hover:text-indigo-500 transition flex-shrink-0 hidden sm:block" />
    </p>
    <p className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{value}</p>
    {note && <p className={`text-[9px] sm:text-[11px] font-medium truncate ${noteClass}`}>{note}</p>}
  </button>
);

// Clean list row with an avatar (Today's calling / leads / Hot & Warm)
const PersonRow = ({ name, sub, right, onClick }) => (
  <button type="button" onClick={onClick} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-gray-50/80 transition">
    <Avatar name={name} />
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-gray-900 truncate">{name || 'Customer'}</p>
      <p className="text-[11px] text-gray-400 truncate">{sub}</p>
    </div>
    <div className="flex flex-col items-end gap-1 flex-shrink-0">{right}</div>
  </button>
);

const MoreButton = ({ remaining, onClick }) => (
  <button type="button" onClick={onClick} className="w-full py-2 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50/60 transition rounded-b-2xl">
    Show more ({remaining} remaining)
  </button>
);

// Half-donut gauge for the conversion rate
const Gauge = ({ value }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-[130px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ v: pct }, { v: 100 - pct }]}
            dataKey="v"
            startAngle={180}
            endAngle={0}
            cx="50%"
            cy="100%"
            innerRadius="130%"
            outerRadius="175%"
            paddingAngle={pct > 0 && pct < 100 ? 2 : 0}
            cornerRadius={6}
            stroke="none"
            isAnimationActive
          >
            <Cell fill="#10b981" />
            <Cell fill="#eef2f6" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-3xl font-bold text-gray-900 leading-none">{pct}%</p>
        <p className="text-[11px] text-gray-400 mt-1">conversion rate</p>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------------------

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  // Role USER gets a personal dashboard: only their own leads, calls and attendance
  const isAdmin = isUserAdmin(user);

  const [data, setData] = useState({ leads: [], calls: [], employees: [], attendance: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const range = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const [showRangeModal, setShowRangeModal] = useState(false);

  const periodOptions = useMemo(() => [
    { value: 'today', label: 'Today' },
    { value: 'month', label: 'This Month' },
    {
      value: 'custom',
      label: period === 'custom'
        ? `Custom: ${formatFullDate(range.fromMs).slice(0, 5)} – ${formatFullDate(range.toMs - 1).slice(0, 5)}`
        : 'Custom'
    }
  ], [period, range]);

  const handlePeriodChange = (val) => {
    if (val === 'custom') {
      setShowRangeModal(true);
    } else {
      setPeriod(val);
    }
  };
  const [loadedOnce, setLoadedOnce] = useState(false);
  // "Show more" paging for the long record lists
  const LIST_PAGE = 15;
  const [listLimit, setListLimit] = useState({ calls: LIST_PAGE, leads: LIST_PAGE, hot: LIST_PAGE });
  const showMore = (key) => setListLimit(prev => ({ ...prev, [key]: prev[key] + LIST_PAGE }));
  const [detailsLead, setDetailsLead] = useState(null);
  // Employee dropdown (normalized name) — options follow the active tab
  const [employeeKey, setEmployeeKey] = useState('');

  // Role USER gets tabs of all their assigned lead types; everyone else also gets "All Leads"
  const scope = getUserLeadTypeScope(user);
  const visibleTabs = scope?.categories?.length > 0
    ? TABS.filter(t => scope.categories.includes(t.key))
    : (scope?.category ? TABS.filter(t => t.key === scope.category) : [ALL_TAB, ...TABS]);
  const [activeTab, setActiveTab] = useState(scope?.categories?.[0] || scope?.category || 'All');
  const tab = visibleTabs.find(t => t.key === activeTab)?.key || visibleTabs[0].key;
  const isAll = tab === 'All';
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

  // Lead counts per tab (for the tab badges)
  const tabCounts = useMemo(() => {
    const counts = { All: data.leads.length, 'Real Estate': 0, 'Insurance': 0, 'Mutual Fund': 0 };
    data.leads.forEach(l => { if (counts[l.category] !== undefined) counts[l.category] += 1; });
    return counts;
  }, [data.leads]);

  // Employees of the active tab (All tab → every employee), plus anyone holding its leads
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

  // Start the record lists from the top again when the tab or employee changes
  useEffect(() => {
    setListLimit({ calls: LIST_PAGE, leads: LIST_PAGE, hot: LIST_PAGE });
  }, [tab, employeeKey]);

  // Drop the employee filter when they aren't part of the newly selected tab
  useEffect(() => {
    if (employeeKey && !employeeOptions.some(o => o.value === employeeKey)) setEmployeeKey('');
  }, [employeeOptions, employeeKey]);

  // ---------------- Everything below is scoped to the active tab ----------------
  const view = useMemo(() => {
    const todayMs = startOfToday().getTime();
    const inRange = (ms) => ms >= range.fromMs && ms < range.toMs;
    const byEmployee = (name) => !employeeKey || normName(name) === employeeKey;
    const leads = data.leads.filter(l => inTab(l.category) && byEmployee(l.callerAssigned));
    const calls = data.calls.filter(c => inTab(c.category) && byEmployee(c.callerAssigned));

    const summarize = (list, callList) => {
      const byStatus = (s) => list.filter(l => l.status === s).length;
      const converted = byStatus('Interested');
      return {
        total: list.length,
        todayLeads: list.filter(l => l.createdDate && l.createdDate.getTime() === todayMs).length,
        todayCalls: callList.filter(c => c.timestampMs >= todayMs).length,
        futurePlan: byStatus('Future Plan Date'),
        converted,
        siteVisit: byStatus('Site Visit/Meeting') + byStatus('Meeting'),
        notInterested: byStatus('Not Interested'),
        notCalled: list.filter(l => l.trackers.length === 0).length,
        hot: list.filter(l => l.customerStatus === 'Hot').length,
        warm: list.filter(l => l.customerStatus === 'Warm').length,
        conversionRate: list.length ? Math.round((converted / list.length) * 100) : 0
      };
    };

    const kpis = summarize(leads, calls);

    // Per lead type breakdown (shown on the All Leads tab)
    const byType = TABS.map(t => ({
      ...t,
      ...summarize(
        data.leads.filter(l => l.category === t.key && byEmployee(l.callerAssigned)),
        data.calls.filter(c => c.category === t.key && byEmployee(c.callerAssigned))
      )
    }));

    const todayLeads = leads
      .filter(l => l.createdDate && l.createdDate.getTime() === todayMs)
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    const todayCalls = calls
      .filter(c => c.timestampMs >= todayMs)
      .sort((a, b) => b.timestampMs - a.timestampMs);
    const hotWarm = leads
      .filter(l => l.customerStatus === 'Hot' || l.customerStatus === 'Warm')
      .sort((a, b) => b.lastActivityMs - a.lastActivityMs);

    // ---- Per-employee MIS for the selected period ----
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
      const row = ensureRow(l.callerAssigned || 'Unassigned');
      if (!row) return;
      row.assigned += 1;
      if (l.createdDate && inRange(l.createdDate.getTime())) row.newLeads += 1;
      if (l.trackers.length === 0) row.notCalled += 1;
      // Current outcome / temperature, counted when its latest call falls in the period
      if (inRange(l.lastActivityMs) && l.trackers.length > 0) {
        if (l.status === 'Interested') row.interested += 1;
        if (l.status === 'Future Plan Date') row.futurePlan += 1;
        if (l.status === 'Site Visit/Meeting' || l.status === 'Meeting') row.siteVisit += 1;
        if (l.status === 'Not Interested') row.notInterested += 1;
        if (l.customerStatus === 'Hot') row.hot += 1;
        if (l.customerStatus === 'Warm') row.warm += 1;
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

    // ---- Today present employees (attendance for today) ----
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
      .sort((a, b) => String(a.inTime || '').localeCompare(String(b.inTime || '')));
    const teamSize = tabEmployees.filter(e => !isAdminRole(e)).length;

    // ---- Personal view (role USER): day-wise performance & own attendance for the period ----
    const DAY_MS = 24 * 60 * 60 * 1000;
    const endMs = Math.min(range.toMs, todayMs + DAY_MS);
    const daily = [];
    if (!isAdmin) {
      const byDay = {};
      for (let t = range.fromMs; t < endMs; t += DAY_MS) {
        const d = new Date(t);
        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        if (!byDay[key]) {
          byDay[key] = { dayMs: key, Calls: 0, Converted: 0, 'New Leads': 0 };
          daily.push(byDay[key]);
        }
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
    const myName = normName(user?.name);
    const myAttendance = isAdmin ? [] : data.attendance
      .filter(a => normName(a.userName) === myName)
      .map(a => ({ ...a, dayMs: parseAttendanceDate(a.date)?.getTime() || 0 }))
      .filter(a => a.dayMs >= range.fromMs && a.dayMs < range.toMs)
      .sort((a, b) => b.dayMs - a.dayMs);
    const myToday = isAdmin ? null : data.attendance.find(a => normName(a.userName) === myName && a.date === todayStr) || null;
    const myWorkingDays = isAdmin ? 0 : countWorkingDays(range.fromMs, range.toMs);

    return { kpis, byType, todayLeads, todayCalls, hotWarm, mis, totals, present, teamSize, daily, myAttendance, myToday, myWorkingDays };
  }, [data, tab, isAll, inTab, range, employeeKey, isAdmin, user]);

  const { kpis, byType, todayLeads, todayCalls, hotWarm, mis, totals, present, teamSize, daily, myAttendance, myToday, myWorkingDays } = view;
  const leadById = useMemo(() => Object.fromEntries(data.leads.map(l => [String(l.id), l])), [data.leads]);
  const periodLabel = period === 'custom'
    ? `${formatFullDate(range.fromMs)} – ${formatFullDate(range.toMs - 1)}`
    : PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Period';
  const tabLabel = isAll ? 'All Leads' : tab;

  // Chart only lists employees with activity in this tab
  const chartData = mis
    .filter(r => r.assigned > 0 || r.calls > 0)
    .map(r => ({ name: r.name, Assigned: r.assigned, Calls: r.calls, Converted: r.interested }));

  // Open a page on the same lead type (the All tab lets the page pick its default tab)
  const go = (path, state = {}, tabKey = tab) => navigate(path, {
    state: tabKey && tabKey !== 'All' ? { tab: tabKey, ...state } : state
  });

  const loadingOr = (text) => (loading ? 'Loading...' : text);

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="space-y-3 pb-3">

        {/* Header: lead type tabs · period · employee · refresh */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
          <PageTabs
            tabs={visibleTabs.map(t => ({ ...t, count: tabCounts[t.key] ?? 0 }))}
            activeKey={tab}
            onChange={setActiveTab}
          />

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 xl:justify-end">
            <div className="flex-1 sm:flex-none min-w-[130px] sm:w-[165px]">
              <SearchableDropdown
                options={periodOptions}
                value={period}
                onChange={handlePeriodChange}
                placeholder="Select Period"
                height="h-[34px]"
                searchable={false}
                icon={CalendarDays}
              />
            </div>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                <UserCircle2 size={14} /> My Dashboard · {user?.name || 'Me'}
              </span>
            )}
            {isAdmin && <div className="flex-1 sm:flex-none min-w-[140px] sm:w-[180px]">
              <SearchableDropdown
                options={[{ value: '', label: isAll ? 'All Employees' : `All ${tab} Employees` }, ...employeeOptions]}
                value={employeeKey}
                onChange={setEmployeeKey}
                placeholder={isAll ? 'All Employees' : `All ${tab} Employees`}
                height="h-[34px]"
              />
            </div>}
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh"
              className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[34px] w-[34px] shrink-0 transition disabled:opacity-50 active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading && !loadedOnce ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="w-9 h-9 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Loading dashboard...</p>
          </Card>
        ) : (<>
        {/* ================= Row 1: hero chart · key metrics · clients ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Hero: total leads + performance chart */}
          <Card className="lg:col-span-8 xl:col-span-6 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
              <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-indigo-600" />
                {isAdmin ? 'Employee Performance' : 'My Performance'}
                <span className="text-[11px] font-medium text-gray-400">· {tabLabel} · {periodLabel}</span>
              </p>
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                {(isAdmin
                  ? [['Assigned', CHART_COLORS.assigned], ['Calls', CHART_COLORS.calls], ['Converted', CHART_COLORS.converted]]
                  : [['Calls', CHART_COLORS.calls], ['Converted', CHART_COLORS.converted], ['New Leads', CHART_COLORS.newLeads]]
                ).map(([label, color]) => (
                  <span key={label} className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} /> {label}
                  </span>
                ))}
              </div>
            </div>

            {(isAdmin ? chartData.length > 0 : daily.some(d => d.Calls || d['New Leads'])) ? (
              <div className="flex-1 px-2 pb-2 overflow-x-auto">
                <div style={{ minWidth: `${Math.max((isAdmin ? chartData.length * 84 : daily.length * 44), 300)}px` }}>
                  <ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 260}>
                    <BarChart
                      data={isAdmin ? chartData : daily.map(d => ({ ...d, name: formatDay(d.dayMs) }))}
                      margin={{ top: 18, right: 8, left: -18, bottom: 0 }}
                      barGap={3}
                      barCategoryGap="22%"
                    >
                      <CartesianGrid vertical={false} stroke="#f1f1ee" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        height={isAdmin && chartData.length > 5 ? 52 : 28}
                        angle={isAdmin && chartData.length > 5 ? -28 : 0}
                        textAnchor={isAdmin && chartData.length > 5 ? 'end' : 'middle'}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79,70,229,0.05)', radius: 8 }} />
                      {isAdmin ? (
                        <>
                          <Bar dataKey="Assigned" fill={CHART_COLORS.assigned} radius={[6, 6, 6, 6]} maxBarSize={20} />
                          <Bar dataKey="Calls" fill={CHART_COLORS.calls} radius={[6, 6, 6, 6]} maxBarSize={20}>
                            <LabelList dataKey="Calls" position="top" style={{ fontSize: 10, fill: '#4f46e5', fontWeight: 700 }} />
                          </Bar>
                          <Bar dataKey="Converted" fill={CHART_COLORS.converted} radius={[6, 6, 6, 6]} maxBarSize={20} />
                        </>
                      ) : (
                        <>
                          <Bar dataKey="Calls" fill={CHART_COLORS.calls} radius={[6, 6, 6, 6]} maxBarSize={16}>
                            <LabelList dataKey="Calls" position="top" style={{ fontSize: 10, fill: '#4f46e5', fontWeight: 700 }} />
                          </Bar>
                          <Bar dataKey="Converted" fill={CHART_COLORS.converted} radius={[6, 6, 6, 6]} maxBarSize={16} />
                          <Bar dataKey="New Leads" fill={CHART_COLORS.newLeads} radius={[6, 6, 6, 6]} maxBarSize={16} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center py-12">
                <Empty text={loadingOr(`No ${tabLabel} activity for this period.`)} />
              </div>
            )}
          </Card>

          {/* Key metrics, stacked */}
          <Card className="lg:col-span-4 xl:col-span-3 overflow-hidden grid grid-cols-3 lg:grid-cols-2 gap-px bg-gray-100">
            <MetricBlock
              label="Total Leads"
              value={kpis.total}
              note={`${kpis.notCalled} not called`}
              noteClass="text-indigo-500"
              onClick={() => go('/lead')}
            />
            <MetricBlock
              label="Today's Leads"
              value={kpis.todayLeads}
              note="added today"
              onClick={() => go('/lead', { dateFilter: 'today' })}
            />
            <MetricBlock
              label="Today's Calls"
              value={kpis.todayCalls}
              note="logged today"
              noteClass="text-sky-600"
              onClick={() => go('/call-tracker')}
            />
            <MetricBlock
              label="Future Plan"
              value={kpis.futurePlan}
              note="awaiting next call"
              noteClass="text-amber-600"
              onClick={() => go('/call-tracker', { statusFilter: 'Future Plan Date' })}
            />
            <MetricBlock
              label="Converted"
              value={kpis.converted}
              note={`▲ ${kpis.conversionRate}% of leads`}
              noteClass="text-emerald-600"
              onClick={() => go('/call-tracker', { statusFilter: 'Interested' })}
            />
            <MetricBlock
              label="Site Visits"
              value={kpis.siteVisit}
              note={`${kpis.notInterested} not interested`}
              noteClass="text-rose-500"
              onClick={() => go('/call-tracker', { statusFilter: 'Site Visit/Meeting' })}
            />
          </Card>

          {/* Clients + quick actions + team / attendance */}
          <Card className="lg:col-span-12 xl:col-span-3 flex flex-col">
            <CardHeader
              title="Hot Clients"
              subtitle="Customer temperature"
              action={<ViewAll onClick={() => go('/customer-master')} label="Open" />}
            />
            <div className="grid grid-cols-2 gap-2 px-4">
              <button
                type="button"
                onClick={() => go('/customer-master', { customerStatus: 'Hot' })}
                className="text-left rounded-xl p-3 bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-sm hover:shadow-md transition"
              >
                <p className="text-[10px] uppercase tracking-wide font-semibold opacity-90 flex items-center gap-1"><Flame size={11} /> Hot</p>
                <p className="text-2xl font-bold leading-tight mt-2">{kpis.hot}</p>
                <p className="text-[10px] opacity-80">clients</p>
              </button>
              <button
                type="button"
                onClick={() => go('/customer-master', { customerStatus: 'Warm' })}
                className="text-left rounded-xl p-3 bg-gradient-to-br from-amber-300 to-yellow-200 text-amber-900 shadow-sm hover:shadow-md transition"
              >
                <p className="text-[10px] uppercase tracking-wide font-semibold opacity-90 flex items-center gap-1"><Thermometer size={11} /> Warm</p>
                <p className="text-2xl font-bold leading-tight mt-2">{kpis.warm}</p>
                <p className="text-[10px] opacity-80">clients</p>
              </button>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-5 gap-1 px-3 pt-3">
              {[
                { label: 'Leads', icon: UserPlus, onClick: () => go('/lead') },
                { label: 'Calls', icon: PhoneCall, onClick: () => go('/call-tracker') },
                { label: 'Visits', icon: Handshake, onClick: () => navigate('/site-visit-meeting') },
                { label: 'Products', icon: Package, onClick: () => navigate('/products') },
                { label: 'MIS', icon: FileBarChart, onClick: () => navigate('/mis-report') }
              ].map(({ label, icon: Icon, onClick }) => (
                <button key={label} type="button" onClick={onClick} className="flex flex-col items-center gap-1 py-1.5 rounded-lg hover:bg-gray-50 transition">
                  <span className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-700">
                    <Icon size={15} />
                  </span>
                  <span className="text-[10px] text-gray-600 font-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* Team present today (admin) / my attendance (user) */}
            <div className="px-4 pt-3 pb-4 mt-auto">
              {isAdmin ? (
                <>
                  <p className="text-[11px] font-semibold text-gray-500 flex items-center justify-between mb-2">
                    <span>Present today · {present.length}{teamSize ? `/${teamSize}` : ''}</span>
                    <button type="button" onClick={() => navigate('/attendance-report')} className="text-indigo-600 hover:underline">View</button>
                  </p>
                  {present.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {present.map((a, idx) => (
                        <div key={a.id || idx} className="flex flex-col items-center gap-1 w-12 flex-shrink-0" title={`${a.userName} · In ${a.inTime || '-'}${a.outTime ? ` · Out ${a.outTime}` : ''}`}>
                          <span className="relative">
                            <Avatar name={a.userName} size="w-10 h-10 text-xs" />
                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${a.outTime ? 'bg-gray-300' : 'bg-emerald-500'}`} />
                          </span>
                          <span className="text-[10px] text-gray-600 truncate w-full text-center">{String(a.userName || '').split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">No attendance marked yet today.</p>
                  )}
                </>
              ) : (
                <button type="button" onClick={() => navigate('/attendance')} className={`w-full text-left rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${myToday ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${myToday ? 'text-emerald-700' : 'text-rose-600'}`}>My attendance today</p>
                  <p className={`text-sm font-bold ${myToday ? 'text-emerald-800' : 'text-rose-700'}`}>
                    {myToday ? `In ${myToday.inTime || '-'}${myToday.outTime ? ` · Out ${myToday.outTime}` : ' · Working'}` : 'Not marked yet'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Present {myAttendance.length} of {myWorkingDays} working days · {periodLabel}</p>
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* ================= Row 2: pipeline · conversion gauge · tracker ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {/* Lead pipeline (segmented bar + legend) */}
          <Card>
            <CardHeader title="Lead Pipeline" subtitle="Where every lead stands now" icon={Layers} />
            {(() => {
              const segments = [
                { label: 'Converted', value: kpis.converted, color: 'bg-emerald-500', status: 'Interested' },
                { label: 'Future Plan', value: kpis.futurePlan, color: 'bg-amber-400', status: 'Future Plan Date' },
                { label: 'Site Visit', value: kpis.siteVisit, color: 'bg-cyan-500', status: 'Site Visit/Meeting' },
                { label: 'Not Interested', value: kpis.notInterested, color: 'bg-rose-400', status: 'Not Interested' },
                { label: 'Not Called', value: kpis.notCalled, color: 'bg-gray-300', status: 'Pending' }
              ];
              const total = Math.max(1, segments.reduce((a, x) => a + x.value, 0));
              return (
                <div className="px-4 pb-4">
                  <p className="text-2xl font-bold text-gray-900">{kpis.total}<span className="text-xs font-medium text-gray-400 ml-1.5">leads</span></p>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mt-2 bg-gray-100">
                    {segments.filter(x => x.value > 0).map(x => (
                      <div key={x.label} className={`${x.color} h-full`} style={{ width: `${(x.value / total) * 100}%` }} title={`${x.label}: ${x.value}`} />
                    ))}
                  </div>
                  <div className="mt-3 space-y-1">
                    {segments.map(x => (
                      <button
                        key={x.label}
                        type="button"
                        onClick={() => go('/call-tracker', { statusFilter: x.status })}
                        className="w-full flex items-center justify-between text-xs py-1 px-1 -mx-1 rounded-md hover:bg-gray-50 transition"
                      >
                        <span className="flex items-center gap-2 text-gray-600">
                          <span className={`w-2.5 h-2.5 rounded-sm ${x.color}`} /> {x.label}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{x.value}</span>
                          <span className="text-gray-400 w-9 text-right">{Math.round((x.value / total) * 100)}%</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* Conversion health gauge */}
          <Card>
            <CardHeader title="Conversion Health" subtitle={`${tabLabel} · current status`} icon={Target} />
            <div className="px-4">
              <p className="text-2xl font-bold text-gray-900">{kpis.converted}<span className="text-xs font-medium text-gray-400 ml-1.5">of {kpis.total} converted</span></p>
              <div className="mt-2">
                <Gauge value={kpis.conversionRate} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-3">
              {[
                { label: 'Hot', value: kpis.hot, cls: 'text-rose-600' },
                { label: 'Warm', value: kpis.warm, cls: 'text-amber-600' },
                { label: 'Visits', value: kpis.siteVisit, cls: 'text-cyan-600' }
              ].map(x => (
                <div key={x.label} className="rounded-xl bg-gray-50 py-2 text-center">
                  <p className={`text-base font-bold ${x.cls}`}>{x.value}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">{x.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Lead type tracker (All tab) / follow-up tracker (single type) */}
          <Card className="md:col-span-2 xl:col-span-1">
            <CardHeader
              title={isAll ? 'Lead Type Tracker' : 'Follow-up Tracker'}
              subtitle={isAll ? 'Converted vs total per lead type' : 'Progress of open leads'}
              icon={Sparkles}
            />
            <div className="px-4 pb-4 space-y-3">
              {(isAll
                ? byType.map(t => ({
                  key: t.key, label: t.label, icon: t.icon, done: t.converted, total: t.total,
                  hint: `${t.todayCalls} calls today · ${t.hot} hot`, onClick: () => setActiveTab(t.key)
                }))
                : [
                  { key: 'fp', label: 'Future Plan', icon: Clock, done: kpis.futurePlan, total: kpis.total, hint: 'Awaiting next call', onClick: () => go('/call-tracker', { statusFilter: 'Future Plan Date' }) },
                  { key: 'sv', label: 'Site Visit / Meeting', icon: Handshake, done: kpis.siteVisit, total: kpis.total, hint: 'Visits scheduled', onClick: () => go('/call-tracker', { statusFilter: 'Site Visit/Meeting' }) },
                  { key: 'nc', label: 'Not Called', icon: PhoneOff, done: kpis.notCalled, total: kpis.total, hint: 'Still to be called', onClick: () => go('/call-tracker', { statusFilter: 'Pending' }) }
                ]
              ).map(item => {
                const Icon = item.icon;
                const pct = item.total ? Math.round((item.done / item.total) * 100) : 0;
                return (
                  <button key={item.key} type="button" onClick={item.onClick} className="w-full text-left flex items-center gap-3 group">
                    <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition">
                      <Icon size={17} className="text-indigo-600" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-900 truncate">{item.label}</span>
                        <span className="text-gray-500 flex-shrink-0">
                          <strong className="text-gray-900">{item.done}</strong>/{item.total}
                        </span>
                      </span>
                      <span className="block h-2 rounded-full bg-gray-100 overflow-hidden mt-1.5">
                        <span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                        <span className="truncate">{item.hint}</span>
                        <span>{pct}%</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ================= Row 3: today's calling · today's leads · hot & warm ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <Card className="flex flex-col">
            <CardHeader
              title="Today's Calling"
              subtitle={`${todayCalls.length} calls logged today`}
              icon={PhoneCall}
              action={<ViewAll onClick={() => go('/call-tracker')} />}
            />
            {todayCalls.length > 0 ? (
              <div className="max-h-[380px] overflow-y-auto pb-1">
                {todayCalls.slice(0, listLimit.calls).map((c, idx) => (
                  <PersonRow
                    key={c.id || idx}
                    onClick={() => leadById[String(c.leadId)] && setDetailsLead(leadById[String(c.leadId)])}
                    name={c.personName}
                    sub={`${formatTime(c.timestampMs)} · ${c.callerAssigned || 'Unassigned'}${c.number ? ` · ${c.number}` : ''}`}
                    right={<>
                      <StatusPill status={c.status} />
                      <span className="flex items-center gap-1">
                        {isAll && <TypePill type={leadById[String(c.leadId)]?.leadType} />}
                        <TempPill value={c.customerStatus} />
                      </span>
                    </>}
                  />
                ))}
                {todayCalls.length > listLimit.calls && <MoreButton remaining={todayCalls.length - listLimit.calls} onClick={() => showMore('calls')} />}
              </div>
            ) : (
              <Empty text={loadingOr('No calls logged today.')} />
            )}
          </Card>

          <Card className="flex flex-col">
            <CardHeader
              title="Today's Leads"
              subtitle={`${todayLeads.length} new leads today`}
              icon={UserPlus}
              action={<ViewAll onClick={() => go('/lead', { dateFilter: 'today' })} />}
            />
            {todayLeads.length > 0 ? (
              <div className="max-h-[380px] overflow-y-auto pb-1">
                {todayLeads.slice(0, listLimit.leads).map((l, idx) => (
                  <PersonRow
                    key={l.id || idx}
                    onClick={() => setDetailsLead(l)}
                    name={l.personName}
                    sub={`${l.leadNo || ''}${l.leadSource ? ` · ${l.leadSource}` : ''} · ${l.callerAssigned || 'Unassigned'}`}
                    right={<>
                      <StatusPill status={l.status} />
                      {isAll && <TypePill type={l.leadType} />}
                    </>}
                  />
                ))}
                {todayLeads.length > listLimit.leads && <MoreButton remaining={todayLeads.length - listLimit.leads} onClick={() => showMore('leads')} />}
              </div>
            ) : (
              <Empty text={loadingOr('No new leads today.')} />
            )}
          </Card>

          <Card className="flex flex-col md:col-span-2 xl:col-span-1">
            <CardHeader
              title="Recent Hot & Warm"
              subtitle="Latest interested clients"
              icon={Flame}
              action={<ViewAll onClick={() => go('/customer-master')} />}
            />
            {hotWarm.length > 0 ? (
              <div className="max-h-[380px] overflow-y-auto pb-1">
                {hotWarm.slice(0, listLimit.hot).map((l, idx) => (
                  <PersonRow
                    key={l.id || idx}
                    onClick={() => setDetailsLead(l)}
                    name={l.personName}
                    sub={`Last call ${formatDay(l.lastActivityMs)}${l.latestTracker?.nextDate ? ` · Next ${formatIsoDate(l.latestTracker.nextDate)}` : ''} · ${l.callerAssigned || 'Unassigned'}`}
                    right={<>
                      <TempPill value={l.customerStatus} />
                      {isAll && <TypePill type={l.leadType} />}
                    </>}
                  />
                ))}
                {hotWarm.length > listLimit.hot && <MoreButton remaining={hotWarm.length - listLimit.hot} onClick={() => showMore('hot')} />}
              </div>
            ) : (
              <Empty text={loadingOr('No Hot or Warm clients yet.')} />
            )}
          </Card>
        </div>
        </>)}
      </div>

      {/* Custom date range picker */}
      <DateRangeModal
        isOpen={showRangeModal}
        onClose={() => setShowRangeModal(false)}
        from={customFrom}
        to={customTo}
        onApply={(from, to) => { setCustomFrom(from); setCustomTo(to); setPeriod('custom'); }}
        title="Custom Date Range"
      />

      {/* Full lead record + call report */}
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
