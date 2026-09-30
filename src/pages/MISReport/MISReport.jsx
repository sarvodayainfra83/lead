import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  RefreshCw, FileSpreadsheet, Search, X, PhoneCall, Building2, ShieldCheck, TrendingUp, LayoutGrid,
  Phone, Mail, Briefcase, CalendarDays, Clock
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import { useAuthStore } from '../../store/authStore';
import { getUserLeadTypeScope } from '../../utils/authUtils';
import { CUSTOMER_STATUS_STYLES } from '../CallTracker/callTrackerConstants';
import SearchableDropdown from '../../components/SearchableDropdown';
import PageTabs from '../../components/PageTabs';
import {
  PERIOD_OPTIONS, getPeriodRange, buildEmployeeRows, buildDailyBreakdown,
  formatDate, formatTime, toInputDate, normName, callToExportRow, dailyToExportRows
} from './misUtils';

const ALL_TAB = { key: 'All', label: 'All Leads', icon: LayoutGrid };
const TABS = [
  { key: 'Real Estate', label: 'Real Estate', icon: Building2 },
  { key: 'Insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'Mutual Fund', label: 'Mutual Fund', icon: TrendingUp }
];

const RATING_STYLES = {
  Excellent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Good: 'bg-sky-50 text-sky-700 border-sky-200',
  Average: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-red-50 text-red-700 border-red-200'
};

const STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200'
};

const formatAmount = (n) => (n ? `₹ ${Number(n).toLocaleString('en-IN')}` : '-');

export default function MISReport() {
  const user = useAuthStore(state => state.user);

  const [data, setData] = useState({ leads: [], calls: [], employees: [], attendance: [], visits: [], visitFollowUps: [] });
  const [loading, setLoading] = useState(true);

  const scope = getUserLeadTypeScope(user);
  const visibleTabs = scope?.categories?.length > 0
    ? TABS.filter(t => scope.categories.includes(t.key))
    : (scope?.category ? TABS.filter(t => t.key === scope.category) : [ALL_TAB, ...TABS]);
  const [activeTab, setActiveTab] = useState(scope?.categories?.[0] || scope?.category || 'All');
  const tab = visibleTabs.find(t => t.key === activeTab)?.key || visibleTabs[0].key;
  const isAll = tab === 'All';

  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailRow, setDetailRow] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await dashboardApi.getDashboardData(user));
    } catch (err) {
      console.error('Failed to load MIS report:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const range = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const periodLabel = period === 'custom'
    ? `${formatDate(range.fromMs)} – ${formatDate(range.toMs - 1)}`
    : PERIOD_OPTIONS.find(p => p.value === period)?.label;

  // Data of the active lead type tab
  const scoped = useMemo(() => {
    const inTab = (cat) => isAll || cat === tab;
    return {
      employees: data.employees.filter(e => isAll || !e.category || e.category === tab),
      leads: data.leads.filter(l => inTab(l.category)),
      calls: data.calls.filter(c => inTab(c.category)),
      visits: data.visits.filter(v => inTab(v.category)),
      visitFollowUps: data.visitFollowUps.filter(f => inTab(f.category)),
      attendance: data.attendance
    };
  }, [data, tab, isAll]);

  const allRows = useMemo(() => buildEmployeeRows({ ...scoped, range }), [scoped, range]);

  // Employee dropdown follows the tab
  const employeeOptions = useMemo(() => (
    allRows.filter(r => r.name !== 'Unassigned').map(r => ({ value: r.key, label: r.name }))
  ), [allRows]);

  useEffect(() => {
    if (employeeFilter && !employeeOptions.some(o => o.value === employeeFilter)) setEmployeeFilter('');
  }, [employeeOptions, employeeFilter]);

  const rows = allRows.filter(r => {
    if (employeeFilter && r.key !== employeeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return [r.name, r.position, r.leadType, r.number, r.email].some(v => String(v || '').toLowerCase().includes(q));
    }
    return true;
  });

  const totals = useMemo(() => {
    const sum = (k) => rows.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
    const leadsCalled = sum('leadsCalledCount');
    const interested = sum('interested');
    return {
      employees: rows.filter(r => r.name !== 'Unassigned').length,
      presentToday: rows.filter(r => r.todayIn).length,
      assigned: sum('assigned'), newLeads: sum('newLeads'), enquiries: sum('enquiries'), notCalled: sum('notCalled'),
      calls: sum('calls'), todayCalls: sum('todayCalls'), leadsCalled,
      interested, futurePlan: sum('futurePlan'), siteVisit: sum('siteVisit'), notInterested: sum('notInterested'),
      hot: sum('hot'), warm: sum('warm'), cold: sum('cold'),
      visitsAssigned: sum('visitsAssigned'), visitsDone: sum('visitsDone'),
      dealsWon: sum('dealsWon'), closingAmount: sum('closingAmount'),
      presentDays: sum('presentDays'),
      conversion: leadsCalled ? Math.round((interested / leadsCalled) * 100) : 0
    };
  }, [rows]);

  const handleExport = () => {
    const out = rows.map(r => ({
      Employee: r.name,
      Position: r.position || '-',
      'Lead Type': r.leadType || '-',
      Phone: r.number || '-',
      'Today Attendance': r.todayIn ? `In ${r.todayIn}${r.todayOut ? ` / Out ${r.todayOut}` : ''}` : 'Absent',
      'Present Days': r.presentDays,
      'Working Days': r.workingDays,
      'Attendance %': r.attendancePct,
      'Assigned Leads': r.assigned,
      'New Leads': r.newLeads,
      Enquiries: r.enquiries,
      'Not Called': r.notCalled,
      'Total Calls': r.calls,
      "Today's Calls": r.todayCalls,
      'Leads Called': r.leadsCalledCount,
      'Avg Calls / Day': r.avgCallsPerDay,
      Interested: r.interested,
      'Future Plan': r.futurePlan,
      'Site Visit/Meeting': r.siteVisit,
      'Not Interested': r.notInterested,
      Hot: r.hot,
      Warm: r.warm,
      Cold: r.cold,
      'Visits Assigned': r.visitsAssigned,
      'Visits Completed': r.visitsDone,
      'Deals Won': r.dealsWon,
      'Closing Amount': r.closingAmount,
      'Conversion %': r.conversion,
      'Performance Score': r.score,
      Rating: r.rating
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), 'MIS Summary');

    // Every call in the period by the listed employees, with full customer / lead details
    const listed = new Set(rows.map(r => r.key));
    const leadById = Object.fromEntries(scoped.leads.map(l => [String(l.id), l]));
    const callRows = scoped.calls
      .filter(c => listed.has(normName(c.callerAssigned || 'Unassigned')) && c.timestampMs >= range.fromMs && c.timestampMs < range.toMs)
      .sort((a, b) => a.callerAssigned?.localeCompare(b.callerAssigned || '') || b.timestampMs - a.timestampMs)
      .map(c => callToExportRow(c, leadById[String(c.leadId)]));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(callRows.length ? callRows : [{ Info: 'No calls in this period' }]),
      'Call Report'
    );

    // Day-wise attendance & calls for every listed employee
    const dayRows = rows
      .filter(r => r.name !== 'Unassigned')
      .flatMap(r => dailyToExportRows(r.name, buildDailyBreakdown({
        employeeName: r.name, leads: scoped.leads, calls: scoped.calls, attendance: scoped.attendance, range
      })));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(dayRows.length ? dayRows : [{ Info: 'No data in this period' }]),
      'Day Wise'
    );
    const tabName = isAll ? 'All' : tab.replace(/\s+/g, '_');
    XLSX.writeFile(wb, `MIS_Report_${tabName}_${String(periodLabel).replace(/[\s/–]+/g, '_')}.xlsx`);
  };

  const hasFilters = Boolean(employeeFilter || searchQuery);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      {/* Row 1: lead type tabs + Export / Refresh */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap pb-0.5 min-w-0">
          <PageTabs
            tabs={visibleTabs.map(t => ({ ...t, count: t.key === 'All' ? data.leads.length : data.leads.filter(l => l.category === t.key).length }))}
            activeKey={tab}
            onChange={setActiveTab}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            title="Export to Excel"
            className="h-[34px] px-2.5 sm:px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
          >
            <FileSpreadsheet size={14} /> <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[34px] w-[34px] transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Row 2: period · employee · search */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-2 text-xs font-semibold text-gray-700 h-[34px] w-[calc(50%-3px)] sm:w-[150px] focus:outline-none focus:border-indigo-500"
          title="Report period"
        >
          {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <div className="w-[calc(50%-3px)] sm:w-[200px]">
          <SearchableDropdown
            options={[{ value: '', label: isAll ? 'All Employees' : `All ${tab} Employees` }, ...employeeOptions]}
            value={employeeFilter}
            onChange={setEmployeeFilter}
            placeholder={isAll ? 'All Employees' : `All ${tab} Employees`}
            height="h-[34px]"
          />
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-1 w-full sm:w-auto order-last sm:order-none">
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 sm:flex-none bg-white border border-gray-300 rounded-lg px-2 text-xs h-[34px] text-gray-700 focus:outline-none focus:border-indigo-500" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 sm:flex-none bg-white border border-gray-300 rounded-lg px-2 text-xs h-[34px] text-gray-700 focus:outline-none focus:border-indigo-500" />
          </div>
        )}
        <div className="relative flex-1 min-w-[160px] sm:max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee..."
            className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-7 text-xs h-[34px] focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        {hasFilters && (
          <button
            onClick={() => { setEmployeeFilter(''); setSearchQuery(''); }}
            className="h-[34px] px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {/* Employee MIS table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-gray-100">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2 min-w-0">
              <FileSpreadsheet size={15} className="text-indigo-600 flex-shrink-0" />
              <span className="truncate">Employee MIS · {isAll ? 'All Leads' : tab} · {periodLabel}</span>
            </h3>
            <span className="text-[11px] text-gray-500 hidden sm:inline">Click an employee for full details</span>
          </div>

          {loading && data.leads.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Loading MIS report...</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-10 text-center">No employees match the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1500px]">
                <thead>
                  <tr className="bg-slate-100 text-[10px] uppercase tracking-wide text-gray-600 border-b border-gray-200">
                    <th rowSpan={2} className="px-3 py-2 text-left sticky left-0 bg-slate-100 z-10 align-bottom">Employee</th>
                    <th colSpan={4} className="px-2 py-1 text-center border-l border-gray-200 text-emerald-800">Attendance</th>
                    <th colSpan={4} className="px-2 py-1 text-center border-l border-gray-200 text-violet-800">Leads & Enquiry</th>
                    <th colSpan={3} className="px-2 py-1 text-center border-l border-gray-200 text-sky-800">Calls</th>
                    <th colSpan={4} className="px-2 py-1 text-center border-l border-gray-200 text-gray-700">Outcome (leads)</th>
                    <th colSpan={3} className="px-2 py-1 text-center border-l border-gray-200 text-rose-800">Temperature</th>
                    <th colSpan={3} className="px-2 py-1 text-center border-l border-gray-200 text-cyan-800">Visits & Deals</th>
                    <th colSpan={2} className="px-2 py-1 text-center border-l border-gray-200 text-indigo-800">Performance</th>
                  </tr>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="px-2 py-1.5 text-center border-l border-gray-200">Today</th>
                    <th className="px-2 py-1.5 text-center">Present</th>
                    <th className="px-2 py-1.5 text-center">Work Days</th>
                    <th className="px-2 py-1.5 text-center">Att. %</th>
                    <th className="px-2 py-1.5 text-center border-l border-gray-200">Assigned</th>
                    <th className="px-2 py-1.5 text-center">New</th>
                    <th className="px-2 py-1.5 text-center">Enquiry</th>
                    <th className="px-2 py-1.5 text-center">Not Called</th>
                    <th className="px-2 py-1.5 text-center border-l border-gray-200">Total</th>
                    <th className="px-2 py-1.5 text-center">Today</th>
                    <th className="px-2 py-1.5 text-center">Avg/Day</th>
                    <th className="px-2 py-1.5 text-center border-l border-gray-200 text-emerald-700">Interested</th>
                    <th className="px-2 py-1.5 text-center text-amber-700">Future</th>
                    <th className="px-2 py-1.5 text-center text-cyan-700">Site Visit</th>
                    <th className="px-2 py-1.5 text-center text-red-700">Not Int.</th>
                    <th className="px-2 py-1.5 text-center border-l border-gray-200 text-red-600">Hot</th>
                    <th className="px-2 py-1.5 text-center text-amber-600">Warm</th>
                    <th className="px-2 py-1.5 text-center text-sky-600">Cold</th>
                    <th className="px-2 py-1.5 text-center border-l border-gray-200">Visits</th>
                    <th className="px-2 py-1.5 text-center">Won</th>
                    <th className="px-2 py-1.5 text-center">Amount</th>
                    <th className="px-2 py-1.5 text-center border-l border-gray-200">Conv. %</th>
                    <th className="px-2 py-1.5 text-center">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr
                      key={r.key}
                      onClick={() => setDetailRow(r)}
                      className={`cursor-pointer hover:bg-indigo-50/50 transition-colors ${i % 2 ? 'bg-slate-50/50' : 'bg-white'}`}
                    >
                      <td className="px-3 py-2 sticky left-0 bg-inherit z-10 min-w-[170px]">
                        <p className="font-semibold text-gray-900 text-[13px]">{r.name}</p>
                        <p className="text-[10px] text-gray-500">{[r.position, r.leadType].filter(Boolean).join(' · ') || '—'}</p>
                      </td>
                      <td className="px-2 py-2 text-center border-l border-gray-100 whitespace-nowrap">
                        {r.todayIn
                          ? <span className="text-emerald-700 font-semibold text-[11px]">In {r.todayIn}</span>
                          : <span className="text-red-500 font-semibold text-[11px]">Absent</span>}
                      </td>
                      <td className="px-2 py-2 text-center font-semibold text-gray-800">{r.presentDays}</td>
                      <td className="px-2 py-2 text-center text-gray-600">{r.workingDays}</td>
                      <td className={`px-2 py-2 text-center font-bold ${r.attendancePct >= 90 ? 'text-emerald-700' : r.attendancePct >= 70 ? 'text-amber-700' : 'text-red-600'}`}>{r.attendancePct}%</td>
                      <td className="px-2 py-2 text-center border-l border-gray-100 font-semibold text-gray-800">{r.assigned}</td>
                      <td className="px-2 py-2 text-center text-gray-700">{r.newLeads}</td>
                      <td className="px-2 py-2 text-center text-fuchsia-700 font-semibold">{r.enquiries}</td>
                      <td className="px-2 py-2 text-center text-gray-500">{r.notCalled}</td>
                      <td className="px-2 py-2 text-center border-l border-gray-100 font-bold text-indigo-700">{r.calls}</td>
                      <td className="px-2 py-2 text-center text-gray-700">{r.todayCalls}</td>
                      <td className="px-2 py-2 text-center text-gray-700">{r.avgCallsPerDay}</td>
                      <td className="px-2 py-2 text-center border-l border-gray-100 text-emerald-700 font-semibold">{r.interested}</td>
                      <td className="px-2 py-2 text-center text-amber-700">{r.futurePlan}</td>
                      <td className="px-2 py-2 text-center text-cyan-700">{r.siteVisit}</td>
                      <td className="px-2 py-2 text-center text-red-700">{r.notInterested}</td>
                      <td className="px-2 py-2 text-center border-l border-gray-100 text-red-600 font-semibold">{r.hot}</td>
                      <td className="px-2 py-2 text-center text-amber-600 font-semibold">{r.warm}</td>
                      <td className="px-2 py-2 text-center text-sky-600">{r.cold}</td>
                      <td className="px-2 py-2 text-center border-l border-gray-100 text-gray-700">{r.visitsAssigned}</td>
                      <td className="px-2 py-2 text-center text-teal-700 font-semibold">{r.dealsWon}</td>
                      <td className="px-2 py-2 text-center text-gray-700 whitespace-nowrap">{formatAmount(r.closingAmount)}</td>
                      <td className="px-2 py-2 text-center border-l border-gray-100">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(r.conversion, 100)}%` }} />
                          </div>
                          <span className="font-bold text-gray-900 w-8 text-right">{r.conversion}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {r.rating !== '-' ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${RATING_STYLES[r.rating]}`} title={`Score ${r.score}/100`}>
                            {r.rating}
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 border-t border-indigo-100 font-bold text-gray-900 text-xs">
                    <td className="px-3 py-2 sticky left-0 bg-indigo-50 z-10">Total ({totals.employees})</td>
                    <td className="px-2 py-2 text-center border-l border-indigo-100 text-emerald-700">{totals.presentToday}</td>
                    <td className="px-2 py-2 text-center">{totals.presentDays}</td>
                    <td className="px-2 py-2 text-center">-</td>
                    <td className="px-2 py-2 text-center">-</td>
                    <td className="px-2 py-2 text-center border-l border-indigo-100">{totals.assigned}</td>
                    <td className="px-2 py-2 text-center">{totals.newLeads}</td>
                    <td className="px-2 py-2 text-center text-fuchsia-700">{totals.enquiries}</td>
                    <td className="px-2 py-2 text-center">{totals.notCalled}</td>
                    <td className="px-2 py-2 text-center border-l border-indigo-100 text-indigo-700">{totals.calls}</td>
                    <td className="px-2 py-2 text-center">{totals.todayCalls}</td>
                    <td className="px-2 py-2 text-center">-</td>
                    <td className="px-2 py-2 text-center border-l border-indigo-100 text-emerald-700">{totals.interested}</td>
                    <td className="px-2 py-2 text-center text-amber-700">{totals.futurePlan}</td>
                    <td className="px-2 py-2 text-center text-cyan-700">{totals.siteVisit}</td>
                    <td className="px-2 py-2 text-center text-red-700">{totals.notInterested}</td>
                    <td className="px-2 py-2 text-center border-l border-indigo-100 text-red-600">{totals.hot}</td>
                    <td className="px-2 py-2 text-center text-amber-600">{totals.warm}</td>
                    <td className="px-2 py-2 text-center text-sky-600">{totals.cold}</td>
                    <td className="px-2 py-2 text-center border-l border-indigo-100">{totals.visitsAssigned}</td>
                    <td className="px-2 py-2 text-center text-teal-700">{totals.dealsWon}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">{formatAmount(totals.closingAmount)}</td>
                    <td className="px-2 py-2 text-center border-l border-indigo-100">{totals.conversion}%</td>
                    <td className="px-2 py-2 text-center">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>
      </div>

      {detailRow && (
        <EmployeeDetailModal
          row={detailRow}
          data={scoped}
          range={range}
          periodLabel={periodLabel}
          onClose={() => setDetailRow(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Employee detail popup: profile, period KPIs, day-wise breakdown, recent calls
// ----------------------------------------------------------------------------
function EmployeeDetailModal({ row, data, range, periodLabel, onClose }) {
  const key = normName(row.name);
  const daily = useMemo(() => buildDailyBreakdown({
    employeeName: row.name, leads: data.leads, calls: data.calls, attendance: data.attendance, range
  }), [row.name, data, range]);

  // All calls of this employee in the period (list shows them page by page)
  const periodCalls = useMemo(() => (
    data.calls
      .filter(c => normName(c.callerAssigned) === key && c.timestampMs >= range.fromMs && c.timestampMs < range.toMs)
      .sort((a, b) => b.timestampMs - a.timestampMs)
  ), [data.calls, key, range]);
  const CALLS_PAGE = 30;
  const [callsShown, setCallsShown] = useState(CALLS_PAGE);
  const recentCalls = periodCalls.slice(0, callsShown);
  const leadById = useMemo(() => Object.fromEntries(data.leads.map(l => [String(l.id), l])), [data.leads]);

  const exportEmployee = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      periodCalls.length ? periodCalls.map(c => callToExportRow(c, leadById[String(c.leadId)])) : [{ Info: 'No calls in this period' }]
    ), 'Call Report');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyToExportRows(row.name, daily)), 'Day Wise');
    XLSX.writeFile(wb, `MIS_${row.name.replace(/\s+/g, '_')}_${String(periodLabel).replace(/[\s/–]+/g, '_')}.xlsx`);
  };

  const stats = [
    { label: 'Present', value: `${row.presentDays}/${row.workingDays}`, sub: `${row.attendancePct}% attendance`, cls: 'text-emerald-700' },
    { label: 'Assigned Leads', value: row.assigned, sub: `${row.notCalled} not called`, cls: 'text-violet-700' },
    { label: 'Enquiry', value: row.enquiries, sub: `${row.newLeads} new leads`, cls: 'text-fuchsia-700' },
    { label: 'Total Calls', value: row.calls, sub: `${row.avgCallsPerDay}/day · ${row.todayCalls} today`, cls: 'text-sky-700' },
    { label: 'Interested', value: row.interested, sub: `${row.conversion}% conversion`, cls: 'text-emerald-700' },
    { label: 'Future / Site / Not', value: `${row.futurePlan} / ${row.siteVisit} / ${row.notInterested}`, cls: 'text-amber-700' },
    { label: 'Hot / Warm / Cold', value: `${row.hot} / ${row.warm} / ${row.cold}`, cls: 'text-rose-700' },
    { label: 'Visits · Won', value: `${row.visitsAssigned} · ${row.dealsWon}`, sub: formatAmount(row.closingAmount), cls: 'text-teal-700' }
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold truncate">{row.name}</h2>
              {row.rating !== '-' && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${RATING_STYLES[row.rating]}`}>{row.rating} · {row.score}</span>
              )}
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${row.todayIn ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                {row.todayIn ? `Today In ${row.todayIn}${row.todayOut ? ` · Out ${row.todayOut}` : ''}` : 'Absent today'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-gray-300 mt-1">
              {row.position && <span className="inline-flex items-center gap-1"><Briefcase size={11} /> {row.position}</span>}
              {row.leadType && <span>{row.leadType}</span>}
              {row.number && <span className="inline-flex items-center gap-1"><Phone size={11} /> {row.number}</span>}
              {row.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {row.email}</span>}
              <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {periodLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={exportEmployee} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold">
              <FileSpreadsheet size={13} /> <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-white/10"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats.map(s => (
              <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">{s.label}</p>
                <p className={`text-base sm:text-lg font-bold leading-tight ${s.cls}`}>{s.value}</p>
                {s.sub && <p className="text-[10px] text-gray-500 truncate">{s.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Day-wise attendance & calls */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <p className="px-3 py-2 text-xs font-bold text-gray-900 bg-slate-50 border-b border-gray-200 flex items-center gap-1.5">
                <CalendarDays size={13} className="text-indigo-600" /> Day-wise Attendance & Calls
              </p>
              <div className="overflow-auto max-h-[380px]">
                <table className="w-full text-xs min-w-[460px]">
                  <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e5e7eb]">
                    <tr className="text-[10px] uppercase text-gray-500">
                      <th className="px-2.5 py-1.5 text-left">Date</th>
                      <th className="px-2 py-1.5 text-center">Attendance</th>
                      <th className="px-2 py-1.5 text-center">Calls</th>
                      <th className="px-2 py-1.5 text-center text-emerald-700">Int.</th>
                      <th className="px-2 py-1.5 text-center text-amber-700">Future</th>
                      <th className="px-2 py-1.5 text-center text-cyan-700">Site</th>
                      <th className="px-2 py-1.5 text-center">New Leads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {daily.map(d => {
                      const isSunday = new Date(d.dayMs).getDay() === 0;
                      return (
                        <tr key={d.dayMs} className={isSunday && !d.present ? 'bg-gray-50/70' : ''}>
                          <td className="px-2.5 py-1.5 whitespace-nowrap font-medium text-gray-800">{formatDate(d.dayMs)}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">
                            {d.present ? (
                              <span className="text-emerald-700 font-semibold text-[11px]">{d.inTime || 'Present'}{d.outTime ? ` – ${d.outTime}` : ''}</span>
                            ) : (
                              <span className={`text-[11px] font-semibold ${isSunday ? 'text-gray-400' : 'text-red-500'}`}>{isSunday ? 'Sunday' : 'Absent'}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center font-bold text-indigo-700">{d.calls || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-emerald-700">{d.interested || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-amber-700">{d.futurePlan || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-cyan-700">{d.siteVisit || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-gray-700">{d.newLeads || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calls made in the period */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <p className="px-3 py-2 text-xs font-bold text-gray-900 bg-slate-50 border-b border-gray-200 flex items-center gap-1.5">
                <PhoneCall size={13} className="text-indigo-600" /> Calls in Period
                <span className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-indigo-200">{row.calls}</span>
                {periodCalls.length > recentCalls.length && <span className="text-[10px] text-gray-400 font-normal">(showing {recentCalls.length} of {periodCalls.length})</span>}
              </p>
              {recentCalls.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-10 text-center">No calls in this period.</p>
              ) : (
                <div className="divide-y divide-gray-100 overflow-y-auto max-h-[380px]">
                  {recentCalls.map((c, idx) => (
                    <div key={c.id || idx} className="px-3 py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">
                          {c.personName || 'Customer'} <span className="text-indigo-500 text-xs font-medium">· {c.leadNo}</span>
                        </p>
                        <p className="text-[11px] text-gray-500 flex flex-wrap gap-x-2">
                          <span className="inline-flex items-center gap-1"><Clock size={10} /> {formatDate(c.timestampMs)} {formatTime(c.timestampMs)}</span>
                          {c.number && <span className="inline-flex items-center gap-1"><Phone size={10} /> {c.number}</span>}
                        </p>
                        {c.customerSaid && <p className="text-[11px] text-gray-600 italic truncate">"{c.customerSaid}"</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border whitespace-nowrap ${STATUS_STYLES[c.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{c.status || '-'}</span>
                        {c.customerStatus && (
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[c.customerStatus] || ''}`}>{c.customerStatus}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {periodCalls.length > callsShown && (
                    <button
                      type="button"
                      onClick={() => setCallsShown(n => n + CALLS_PAGE)}
                      className="w-full py-2 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      Show more ({periodCalls.length - callsShown} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
