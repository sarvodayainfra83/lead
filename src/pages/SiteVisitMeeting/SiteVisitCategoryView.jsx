import React, { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Search, RotateCcw, UserCheck, MessageSquare,
  Phone, MapPin, Calendar, Eye, X, ChevronDown, ChevronUp,
  FileSpreadsheet, Mail, Briefcase, FileText, Clock, IndianRupee, Check, CheckCircle2,
  CalendarDays
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import PageTabs from '../../components/PageTabs';
import SearchableDropdown from '../../components/SearchableDropdown';
import {
  DATE_FILTER_OPTIONS,
  parseDateObj
} from './siteVisitMeetingConstants';
import { CUSTOMER_STATUS_STYLES } from '../CallTracker/callTrackerConstants';
import { NEXT_DATE_CLASS } from '../../utils/leadTypeColors';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';

// Check if a lead has a locked (closed) deal: a visit follow-up with outcome 'Deal Lock' (or an explicit legacy
// "Closed Won" status). The closing amount / deal_outcome aren't used: older visits saved as plain "Interested"
// got deal_outcome 'Closed (Won)' and the pre-filled budget as closing amount without the deal being final.
const isLockedStatus = (status) => {
  const s = String(status || '').toLowerCase().trim();
  return s === 'deal lock' || s === 'closed won' || s === 'closed' || s === 'deal closed';
};
export const isDealClosed = (item) => {
  if (!item) return false;
  if (isLockedStatus(item.status)) return true;
  return Array.isArray(item.followUps) && item.followUps.some(f => isLockedStatus(f.status));
};

const hasSiteVisitFlag = (vm) => Boolean(vm?.['site-visit'] || vm?.siteVisit || vm?.site_visit);
const hasMeetingFlag = (vm) => Boolean(vm?.meeting);
const NO_VISIT_STATUSES = ['Call Not Received', 'No WhatsApp Reply', 'Not Interested'];
const VISIT_OUTCOME_STATUSES = ['Deal Lock', 'Interested', 'Future Plan', 'Revisit', 'Under Negotiation', 'Did Not Show'];

const hasCallFlag = (vm) => Boolean(vm?.call);

// Site visits, meetings and calls counted separately from the follow-up logs: a log ticked "Site Visit" counts as a
// visit, "Meeting" as a meeting, "Call" as a call (Site Visit Followup form only). Older logs with no tick but a visit
// outcome count as a visit.
export const getVisitMeetCounts = (item) => {
  if (!item) return { visits: 0, meetings: 0, calls: 0 };
  const hasLogs = Array.isArray(item.followUps) && item.followUps.length > 0;
  const logs = hasLogs ? item.followUps : [item];
  let visits = 0;
  let meetings = 0;
  let calls = 0;
  logs.forEach(f => {
    const status = String(f.status || '').trim();
    // A Revisit is always a site visit, whatever activity was ticked — except Insurance's 'Remeeting', saved as a meeting
    if (status === 'Revisit') {
      if (hasMeetingFlag(f.visitMeet) && !hasSiteVisitFlag(f.visitMeet)) meetings += 1;
      else visits += 1;
      return;
    }
    // Only calls logged from this page's Followup form carry the call flag; Lead & Followup calls never do
    if (hasLogs && hasCallFlag(f.visitMeet)) {
      calls += 1;
      return;
    }
    if (NO_VISIT_STATUSES.includes(status)) return;
    const visited = hasSiteVisitFlag(f.visitMeet);
    const met = hasMeetingFlag(f.visitMeet);
    if (visited) visits += 1;
    if (met) meetings += 1;
    if (hasLogs && !visited && !met && VISIT_OUTCOME_STATUSES.includes(status)) visits += 1;
  });
  return { visits, meetings, calls };
};

const STATUS_STYLES = {
  'Deal Lock': 'bg-violet-100 text-violet-800 border-violet-400',
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Future Plan': 'bg-amber-50 text-amber-700 border-amber-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Call Not Received': 'bg-orange-50 text-orange-700 border-orange-200',
  'No WhatsApp Reply': 'bg-slate-100 text-slate-700 border-slate-300',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Meeting: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Assigned: 'bg-sky-50 text-sky-700 border-sky-200',
  'Pending Assignment': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Did Not Show': 'bg-slate-100 text-slate-700 border-slate-300',
  'Under Negotiation': 'bg-orange-50 text-orange-700 border-orange-200',
  'Revisit': 'bg-teal-50 text-teal-700 border-teal-200',
  'Closed Won': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Closed Lost': 'bg-rose-50 text-rose-700 border-rose-200',
  Pending: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Unassigned: 'bg-gray-50 text-gray-500 border-gray-200'
};

// Strictly format YYYY-MM-DD or DD/MM/YYYY to DD/MM/YYYY (date only)
const formatDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim().split('T')[0].split(' ')[0];
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}`;
      } else {
        return `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
      }
    }
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${fullYear}`;
    }
  }
  return str || '-';
};

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function SiteVisitCategoryView({
  category, // 'Real Estate' | 'Insurance' | 'Mutual Fund'
  tabs = [],
  activeTab,
  onTabChange,
  initialDateFilter,
  initialClosedDealsOnly = false,
  leads = [],
  loading = false,
  visitorsMaster = [],
  onRefresh,
  onAssignVisitor,
  onLogFollowUp,
  onViewHistory
}) {
  const user = useAuthStore(state => state.user);
  const isAdmin = (user?.role || '').trim().toUpperCase() === 'ADMIN';
  // Call follow-ups (Total Calls) are logged for Real Estate and Insurance
  const showCalls = category === 'Real Estate' || category === 'Insurance';
  // Insurance meetings are Online / Offline — the latest meeting's type is shown in the list
  const showMeetingType = category === 'Insurance';
  // Insurance / Mutual Fund have meetings only: no Site Visited / Meeting / Total Visits columns, and the
  // assigned person is who takes the meeting
  const showVisitCols = category === 'Real Estate';
  const assignedLabel = showVisitCols ? 'Assigned Visitor' : 'Meeting Assigned To';
  const getMeetingType = (item) => {
    const logs = item.followUps || [];
    for (let i = logs.length - 1; i >= 0; i--) {
      const mode = logs[i].visitMeet?.meetingMode;
      if (mode) return `${mode} Meeting`;
    }
    return '';
  };
  // Insurance calls a Revisit 'Remeeting' (stored as 'Revisit')
  const statusText = (status) => (category === 'Insurance' && status === 'Revisit' ? 'Remeeting' : status);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(initialDateFilter || 'today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showClosedDealsOnly, setShowClosedDealsOnly] = useState(initialClosedDealsOnly);

  // React to prop updates from Dashboard navigation
  useEffect(() => {
    if (initialDateFilter !== undefined) {
      setDateFilter(initialDateFilter || 'today');
      setCurrentPage(1);
    }
  }, [initialDateFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Helper to format short date DD/MM
  const formatShortDate = (str) => {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return str;
  };

  // Today reference and helper to check if a date is today
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const isToday = useCallback((val) => {
    if (!val) return false;
    const d = parseDateObj(val);
    if (!d) return false;
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
  }, [today]);

  const isSameDay = (ms, day) => {
    if (!ms) return false;
    const d = new Date(Number(ms));
    return !isNaN(d.getTime()) && d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
  };

  // Follow-ups logged on this lead today
  const getTodayFollowUpCount = useCallback((item) =>
    (item.followUps || []).filter(f => isSameDay(f.timestampMs, today)).length,
  [today]);

  // "Site visit done today" — a follow-up was submitted today (sets leads.visit_marked_at) AND one is actually
  // logged today (ignores marks left over from the old clickable button). The badge itself isn't clickable.
  const isVisitMarkedToday = useCallback((item) => {
    const markedAt = item.visitMarkedAt;
    if (!markedAt) return false;
    const d = new Date(markedAt);
    const markedToday = !isNaN(d.getTime()) && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    return markedToday && getTodayFollowUpCount(item) > 0;
  }, [today, getTodayFollowUpCount]);

  // Green row highlight for visited-today leads in Today's Followup and All Dates
  const showVisitMark = dateFilter === 'today' || dateFilter === 'all';

  // Follow-ups counted in the badge for the active date filter: Today → today's, Yesterday → yesterday's,
  // Custom → within the range, All Dates / Overdue / Upcoming → total till date
  const getFilterFollowUpCount = (item) => {
    const logs = item.followUps || [];
    if (dateFilter === 'today') return getTodayFollowUpCount(item);
    if (dateFilter === 'yesterday') {
      const yesterday = new Date(today.getTime() - 86400000);
      return logs.filter(f => isSameDay(f.timestampMs, yesterday)).length;
    }
    if (dateFilter === 'custom' && (customFrom || customTo)) {
      const toDay = (str, endOfDay) => {
        const [y, m, d] = str.split('-').map(Number);
        return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
      };
      const fromMs = customFrom ? toDay(customFrom, false) : -Infinity;
      const toMs = customTo ? toDay(customTo, true) : Infinity;
      return logs.filter(f => {
        const ms = Number(f.timestampMs);
        return ms && ms >= fromMs && ms <= toMs;
      }).length;
    }
    return item.followUpCount || logs.length;
  };

  // Read-only badge (desktop icon / mobile pill): shows the follow-up count for the active filter (0 too),
  // turns green once today's follow-up is submitted
  const renderVisitMarkButton = (item, compact) => {
    const done = isVisitMarkedToday(item);
    const count = getFilterFollowUpCount(item);
    const countText = `${count} follow-up${count === 1 ? '' : 's'}`;
    const title = done ? `Site visit follow-up submitted today — ${countText}` : `Not visited yet today — ${countText}`;
    return (
      <span
        title={title}
        aria-label={title}
        className={compact
          ? `w-7 h-7 inline-flex items-center justify-center rounded-md border cursor-default ${done
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white text-gray-500 border-gray-200'}`
          : `inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-default shrink-0 ${done
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white text-gray-500 border-gray-200'}`}
      >
        <span className={`font-bold leading-none ${compact ? 'text-xs' : 'text-[11px]'}`}>{count}</span>
        {!compact && <span>{done ? 'Visited' : 'Not visited'}</span>}
      </span>
    );
  };

  // Mobile card view: expanded accordion card IDs (hide & drop details)
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());
  const toggleCardExpand = useCallback((leadKey) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(leadKey)) next.delete(leadKey);
      else next.add(leadKey);
      return next;
    });
  }, []);

  const getCleanPhone = (num) => String(num || '').replace(/[^0-9+]/g, '');

  const handleWhatsApp = (item, e) => {
    e?.stopPropagation?.();
    const cleanPhone = getCleanPhone(item.customerNumber || item.number);
    if (!cleanPhone) return;
    const phoneWithCountry = cleanPhone.startsWith('91') || cleanPhone.startsWith('+')
      ? cleanPhone.replace('+', '')
      : `91${cleanPhone}`;
    const message = encodeURIComponent(
      `Hello ${item.customerName || item.personName || 'Customer'}, regarding your site visit / meeting inquiry with Sarvodaya Infracon for ${category}.`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  // Live counts for each date filter
  const dateCounts = useMemo(() => {
    let list = leads || [];
    const todayTime = today.getTime();
    const yesterdayTime = new Date(today.getTime() - 86400000).getTime();

    let allCount = list.length;
    let todayCount = 0;
    let todayVisitedCount = 0;
    let yesterdayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let customCount = 0;

    let fromMs = null;
    let toMs = null;
    if (customFrom && customTo) {
      const fParts = customFrom.split('-').map(Number);
      const tParts = customTo.split('-').map(Number);
      if (fParts.length === 3 && tParts.length === 3) {
        fromMs = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0, 0).getTime();
        toMs = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999).getTime();
      }
    }

    list.forEach(item => {
      const mObj = parseDateObj(item.meetingDate || item.visitDate);
      const nextObj = parseDateObj(item.nextMeetingDate || item.nextVisitDate);
      const callObj = parseDateObj(item.nextCallDate || item.nextDate);

      const mTime = mObj ? new Date(mObj.getFullYear(), mObj.getMonth(), mObj.getDate()).getTime() : null;
      const nextTime = nextObj ? new Date(nextObj.getFullYear(), nextObj.getMonth(), nextObj.getDate()).getTime() : null;
      const callTime = callObj ? new Date(callObj.getFullYear(), callObj.getMonth(), callObj.getDate()).getTime() : null;

      const targetTime = nextTime || callTime || mTime;
      if (!targetTime) return;

      const isTodayMatch = mTime === todayTime || nextTime === todayTime || callTime === todayTime;
      const isYesterdayMatch = mTime === yesterdayTime || nextTime === yesterdayTime || callTime === yesterdayTime;

      if (isTodayMatch) {
        todayCount++;
        if (isVisitMarkedToday(item)) todayVisitedCount++;
      }
      if (isYesterdayMatch) yesterdayCount++;
      if (targetTime < todayTime && (item.status === 'Pending Assignment' || item.status === 'Assigned' || item.status === 'Future Plan' || item.status === 'Revisit' || item.status === 'Under Negotiation' || item.status === 'Call Not Received' || item.status === 'No WhatsApp Reply')) overdueCount++;
      if ((nextTime && nextTime > todayTime) || (callTime && callTime > todayTime) || (mTime && mTime > todayTime)) upcomingCount++;
      if (fromMs !== null && toMs !== null) {
        const isCustomMatch = (mTime && mTime >= fromMs && mTime <= toMs) ||
                              (nextTime && nextTime >= fromMs && nextTime <= toMs) ||
                              (callTime && callTime >= fromMs && callTime <= toMs);
        if (isCustomMatch) customCount++;
      }
    });

    return { all: allCount, today: todayCount, todayVisited: todayVisitedCount, yesterday: yesterdayCount, overdue: overdueCount, upcoming: upcomingCount, custom: customCount };
  }, [leads, today, customFrom, customTo, isVisitMarkedToday]);

  const customDropdownLabel = useMemo(() => {
    if (customFrom && customTo) {
      return `Custom: ${formatShortDate(customFrom)} – ${formatShortDate(customTo)} (${dateCounts.custom})`;
    }
    return 'Custom Date Range';
  }, [customFrom, customTo, dateCounts.custom]);

  const allDatesFilterOptions = useMemo(() => [
    { value: 'all', label: `All Dates (${dateCounts.all})` },
    { value: 'yesterday', label: `Yesterday (${dateCounts.yesterday})` },
    { value: 'upcoming', label: `Upcoming (${dateCounts.upcoming})` },
    { value: 'overdue', label: `Overdue (${dateCounts.overdue})` },
    { value: 'custom', label: customDropdownLabel }
  ], [dateCounts, customDropdownLabel]);

  // Count total closed deals in this category
  const closedDealsCount = useMemo(() => {
    let list = leads || [];
    return list.filter(isDealClosed).length;
  }, [leads]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let list = leads || [];

    // Filter for Closed Deals only if button is active (shows closed deals of any date)
    if (showClosedDealsOnly) {
      list = list.filter(isDealClosed);
    } else if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let fromMs = null;
      let toMs = null;
      if (dateFilter === 'custom') {
        if (customFrom) {
          const fParts = customFrom.split('-').map(Number);
          if (fParts.length === 3) {
            fromMs = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0, 0).getTime();
          }
        }
        if (customTo) {
          const tParts = customTo.split('-').map(Number);
          if (tParts.length === 3) {
            toMs = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999).getTime();
          }
        }
      }

      list = list.filter(item => {
        const mObj = parseDateObj(item.meetingDate || item.visitDate);
        const nextObj = parseDateObj(item.nextMeetingDate || item.nextVisitDate);
        const callObj = parseDateObj(item.nextCallDate || item.nextDate);

        const mTime = mObj ? new Date(mObj.getFullYear(), mObj.getMonth(), mObj.getDate()).getTime() : null;
        const nextTime = nextObj ? new Date(nextObj.getFullYear(), nextObj.getMonth(), nextObj.getDate()).getTime() : null;
        const callTime = callObj ? new Date(callObj.getFullYear(), callObj.getMonth(), callObj.getDate()).getTime() : null;

        const targetTime = nextTime || callTime || mTime;

        if (!targetTime) return false;

        if (dateFilter === 'today') {
          return mTime === today.getTime() || nextTime === today.getTime() || callTime === today.getTime();
        }
        if (dateFilter === 'yesterday') {
          return mTime === yesterday.getTime() || nextTime === yesterday.getTime() || callTime === yesterday.getTime();
        }
        if (dateFilter === 'overdue') {
          return targetTime < today.getTime() &&
            (item.status === 'Pending Assignment' || item.status === 'Assigned' || item.status === 'Future Plan' || item.status === 'Revisit' || item.status === 'Under Negotiation' || item.status === 'Call Not Received' || item.status === 'No WhatsApp Reply');
        }
        if (dateFilter === 'upcoming') {
          return (nextTime && nextTime > today.getTime()) || (callTime && callTime > today.getTime()) || (mTime && mTime > today.getTime());
        }
        if (dateFilter === 'custom') {
          const inRange = (t) => {
            if (!t) return false;
            if (fromMs !== null && t < fromMs) return false;
            if (toMs !== null && t > toMs) return false;
            return true;
          };
          return inRange(mTime) || inRange(nextTime) || inRange(callTime);
        }
        return true;
      });
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(l => (
        (l.leadNo && String(l.leadNo).toLowerCase().includes(q)) ||
        (l.customerName && String(l.customerName).toLowerCase().includes(q)) ||
        (l.personName && String(l.personName).toLowerCase().includes(q)) ||
        (l.customerNumber && String(l.customerNumber).includes(q)) ||
        (l.number && String(l.number).includes(q)) ||
        (l.assignedVisitor && String(l.assignedVisitor).toLowerCase().includes(q)) ||
        (l.relationshipManager && String(l.relationshipManager).toLowerCase().includes(q)) ||
        (l.location && String(l.location).toLowerCase().includes(q)) ||
        (l.whatHappened && String(l.whatHappened).toLowerCase().includes(q)) ||
        (l.visitorRemarks && String(l.visitorRemarks).toLowerCase().includes(q)) ||
        (l.leadRemarks && String(l.leadRemarks).toLowerCase().includes(q))
      ));
    }

    // Sorting: when All Dates (or general view), sort by Next Meeting Date in ascending order
    // (earliest next meeting date on the top, then as we go down the next meeting dates increase)
    const sorted = [...list].sort((a, b) => {
      const nextA = parseDateObj(a.nextMeetingDate || a.nextVisitDate || a.nextCallDate);
      const nextB = parseDateObj(b.nextMeetingDate || b.nextVisitDate || b.nextCallDate);
      const meetA = parseDateObj(a.meetingDate || a.visitDate);
      const meetB = parseDateObj(b.meetingDate || b.visitDate);

      const timeNextA = nextA && !isNaN(nextA.getTime()) ? nextA.getTime() : null;
      const timeNextB = nextB && !isNaN(nextB.getTime()) ? nextB.getTime() : null;

      // If both have next meeting date, sort in ascending order (earliest/nearest date on top, increasing downwards)
      if (timeNextA !== null && timeNextB !== null) {
        return timeNextA - timeNextB;
      }
      if (timeNextA !== null) return -1;
      if (timeNextB !== null) return 1;

      // Fallback: sort by meeting date ascending
      const timeMeetA = meetA && !isNaN(meetA.getTime()) ? meetA.getTime() : 0;
      const timeMeetB = meetB && !isNaN(meetB.getTime()) ? meetB.getTime() : 0;
      return timeMeetA - timeMeetB;
    });

    return sorted;
  }, [leads, searchQuery, dateFilter, customFrom, customTo, category, isAdmin, user, showClosedDealsOnly]);

  // Check if any non-default filter is active
  const isFilterActive = dateFilter !== 'today' || searchQuery || showClosedDealsOnly || (dateFilter === 'custom' && customFrom && customTo);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFilter('today');
    setCustomFrom('');
    setCustomTo('');
    setShowClosedDealsOnly(false);
    setCurrentPage(1);
    toast.success('Filters reset to Today');
  }, []);

  // Listen for sidebar click to reset filters
  useEffect(() => {
    const handleClear = (e) => {
      if (!e?.detail?.path || e.detail.path === '/site-visit-meeting') {
        handleClearFilters();
      }
    };
    window.addEventListener('app:clear-filters', handleClear);
    return () => window.removeEventListener('app:clear-filters', handleClear);
  }, [handleClearFilters]);

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.error('No visits data to export');
      return;
    }

    const exportData = filteredLeads.map((item, idx) => {
      const isNoContact = item.status === 'Call Not Received' || item.status === 'No WhatsApp Reply';
      const { visits: totalVisits, meetings: totalMeetings, calls: totalCalls } = getVisitMeetCounts(item);
      return {
        'SR No': idx + 1,
        'Meeting Date': formatDate(item.meetingDate || item.visitDate),
        'Next Meeting Date': formatDate(item.nextMeetingDate || item.nextVisitDate),
        'Customer Name': item.customerName || item.personName || '-',
        ...(isAdmin ? { 'Status': statusText(item.status) || '-' } : {}),
        ...(showVisitCols ? {
          'Site Visited': (!isNoContact && (item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit)) ? 'Yes' : 'No',
          'Meeting': (!isNoContact && item.visitMeet?.meeting) ? 'Yes' : 'No'
        } : {}),
        'Customer Status': item.customerStatus || '-',
        'Latest Feedback': item.whatHappened || item.visitorRemarks || '-',
        'Phone Number': item.customerNumber || item.number || '-',
        [assignedLabel]: item.assignedVisitor || '-',
        ...(showVisitCols ? { 'Total Visits': totalVisits } : {}),
        'Total Meetings': totalMeetings,
        ...(showMeetingType ? { 'Meeting Type': getMeetingType(item) || '-' } : {}),
        ...(showCalls ? { 'Total Calls': totalCalls } : {}),
        'Location': item.location || item.customerAddress || '-',
        'Remarks': item.leadRemarks || item.remarks || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${category} Visits`);
    XLSX.writeFile(workbook, `SiteVisit_${category.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Table Headers (Status column is only visible to ADMIN)
  const tableHeaders = [
    "Action",
    "Meeting Date",
    "Next Meeting Date",
    "Customer Name",
    ...(isAdmin ? ["Status"] : []),
    ...(showVisitCols ? ["Site Visited", "Meeting"] : []),
    "Customer Status",
    "Latest Feedback",
    "Phone Number",
    assignedLabel,
    ...(showVisitCols ? ["Total Visits"] : []),
    "Total Meetings",
    ...(showMeetingType ? ["Meeting Type"] : []),
    ...(showCalls ? ["Total Calls"] : []),
    "Location",
    "Remarks"
  ];

  // Pagination calculation
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  // Render Table Row (Desktop)
  const renderRow = (item, idx) => {
    const leadKey = item.id || item.leadNo || idx;
    const isNoContact = item.status === 'Call Not Received' || item.status === 'No WhatsApp Reply';
    const hasSiteVisited = !isNoContact && Boolean(item.visitMeet?.['site-visit'] ?? item.visitMeet?.siteVisit ?? item.visitMeet?.site_visit);
    const hasMeeting = !isNoContact && Boolean(item.visitMeet?.meeting);
    const { visits: totalVisits, meetings: totalMeetings, calls: totalCalls } = getVisitMeetCounts(item);
    // Site-visit-done mark in Today's Followup and All Dates views
    const visitedToday = showVisitMark && isVisitMarkedToday(item);
    const dealClosed = isDealClosed(item);

    return (
      <tr
        key={leadKey}
        onClick={(e) => {
          if (!e.currentTarget.contains(e.target)) return;
          if (e.target.closest('button, a, input, select, label, [role="combobox"], [role="listbox"]')) return;
          onViewHistory(item);
        }}
        className={`group cursor-pointer transition-colors border-b border-gray-100 ${dealClosed ? 'bg-violet-50 hover:bg-violet-100/70 border-l-4 border-l-violet-500' : visitedToday ? 'bg-emerald-50/70 hover:bg-emerald-100/60' : 'hover:bg-indigo-50/40'}`}
      >
        {/* Action column: compact icon buttons, same as Call Followup (tooltips carry the labels) */}
        <td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            {onLogFollowUp && (
              <button
                onClick={() => onLogFollowUp(item)}
                title={`Followup — log a visit follow-up for ${item.customerName || item.personName || 'Customer'}`}
                aria-label="Followup"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition active:scale-95"
              >
                <Phone size={13} />
              </button>
            )}

            {/* Visited badge: follow-up count for the active filter, green once visited today */}
            {onLogFollowUp && renderVisitMarkButton(item, true)}

            {/* View history timeline (follow-up count is shown in the visited badge instead) */}
            <button
              onClick={() => onViewHistory(item)}
              title={`View ${item.followUpCount || 0} visit record${item.followUpCount === 1 ? '' : 's'} & details`}
              aria-label="View"
              className="relative w-7 h-7 inline-flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition active:scale-95"
            >
              <Eye size={13} />
            </button>
          </div>
        </td>

        {/* 1. Meeting Date */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          {(item.meetingDate || item.visitDate) ? (
            isToday(item.meetingDate || item.visitDate) ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-600 text-white shadow-2xs">
                <Calendar size={11} className="text-white" />
                <span>{formatDate(item.meetingDate || item.visitDate)}</span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white/20 text-white font-extrabold">Today</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                <Calendar size={12} className="text-gray-400" />
                {formatDate(item.meetingDate || item.visitDate)}
              </span>
            )
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </td>

        {/* 2. Next Meeting Date */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          {(item.nextMeetingDate || item.nextVisitDate) ? (
            isToday(item.nextMeetingDate || item.nextVisitDate) ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-600 text-white shadow-2xs">
                <Clock size={11} className="text-white" />
                <span>{formatDate(item.nextMeetingDate || item.nextVisitDate)}</span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white/20 text-white font-extrabold">Today</span>
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 font-semibold ${NEXT_DATE_CLASS}`}>
                <Calendar size={12} />
                {formatDate(item.nextMeetingDate || item.nextVisitDate)}
              </span>
            )
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </td>

        {/* 3. Customer Name */}
        <td className="px-3 py-2 text-left text-xs font-bold whitespace-nowrap max-w-[190px] truncate" title={item.customerName || item.personName}>
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-gray-900 truncate hover:text-indigo-600 transition">
              {item.customerName || item.personName || '-'}
            </span>
            {dealClosed && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-violet-600 text-white border border-violet-700 shrink-0 shadow-2xs">
                <CheckCircle2 size={9} className="stroke-[2.5] text-white" />
                CLOSED
              </span>
            )}
          </div>
        </td>

        {/* 4. Status (Admin only) */}
        {isAdmin && (
          <td className="px-3 py-2 text-center whitespace-nowrap">
            {item.status ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase border tracking-wide ${STATUS_STYLES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {statusText(item.status)}
              </span>
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </td>
        )}

        {/* 5. Site Visited */}
        {showVisitCols && (
          <td className="px-3 py-2 text-center whitespace-nowrap">
            {hasSiteVisited ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <Check size={11} className="text-emerald-600 stroke-[2.5]" />
                Yes
              </span>
            ) : (
              <span className="text-gray-300 text-xs">-</span>
            )}
          </td>
        )}

        {/* 6. Meeting */}
        {showVisitCols && (
          <td className="px-3 py-2 text-center whitespace-nowrap">
            {hasMeeting ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 shadow-2xs">
                <Check size={11} className="text-violet-600 stroke-[2.5]" />
                Yes
              </span>
            ) : (
              <span className="text-gray-300 text-xs">-</span>
            )}
          </td>
        )}

        {/* 7. Customer Status (Hot / Warm / Cold) */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          {item.customerStatus ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase border tracking-wide ${CUSTOMER_STATUS_STYLES[item.customerStatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {item.customerStatus}
            </span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>

        {/* 8. Latest Feedback */}
        <td className="px-3 py-2 text-left text-xs text-gray-700 max-w-[220px] truncate" title={item.whatHappened || item.visitorRemarks || ''}>
          {item.whatHappened || item.visitorRemarks ? (
            <span>"{item.whatHappened || item.visitorRemarks}"</span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>

        {/* 9. Phone Number */}
        <td className="px-3 py-2 text-center text-xs text-gray-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {item.customerNumber || item.number ? (
            <div className="flex items-center justify-center gap-1.5">
              <a href={`tel:${getCleanPhone(item.customerNumber || item.number)}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium">
                <Phone size={11} className="text-gray-400" />
                {item.customerNumber || item.number}
              </a>
              <button
                onClick={(e) => handleWhatsApp(item, e)}
                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition"
                title="WhatsApp"
              >
                WA
              </button>
            </div>
          ) : '-'}
        </td>

        {/* 10. Assigned Visitor */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {item.assignedVisitor ? (
            <span
              onClick={() => onAssignVisitor?.(item)}
              className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition"
              title="Click to reassign visitor"
            >
              <UserCheck size={11} className="text-amber-600" />
              {item.assignedVisitor}
            </span>
          ) : onAssignVisitor ? (
            <button
              type="button"
              onClick={() => onAssignVisitor?.(item)}
              className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider transition shadow-xs active:scale-95 cursor-pointer"
              title="Assign visitor"
            >
              <UserCheck size={11} />
              <span>Assign</span>
            </button>
          ) : (
            <span className="text-[11px] text-gray-400 italic">Not assigned</span>
          )}
        </td>

        {/* 11. Total Visits */}
        {showVisitCols && (
          <td className="px-3 py-2 text-center whitespace-nowrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {totalVisits} {totalVisits === 1 ? 'Visit' : 'Visits'}
            </span>
          </td>
        )}

        {/* 11b. Total Meetings */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {totalMeetings} {totalMeetings === 1 ? 'Meeting' : 'Meetings'}
          </span>
        </td>

        {/* 11c. Meeting Type (Insurance: latest meeting Online / Offline) */}
        {showMeetingType && (
          <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
            {getMeetingType(item) ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                {getMeetingType(item)}
              </span>
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </td>
        )}

        {/* 11d. Total Calls (call follow-ups after the visit / meeting) */}
        {showCalls && (
          <td className="px-3 py-2 text-center whitespace-nowrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              <Phone size={10} className="text-sky-500" />
              {totalCalls} {totalCalls === 1 ? 'Call' : 'Calls'}
            </span>
          </td>
        )}

        {/* 12. Location */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={item.location || item.customerAddress}>
          {item.location || item.customerAddress || '-'}
        </td>

        {/* 13. Remarks */}
        <td className="px-3 py-2 text-center text-xs text-gray-500 whitespace-nowrap max-w-[160px] truncate" title={item.leadRemarks || item.remarks}>
          {item.leadRemarks || item.remarks || '-'}
        </td>
      </tr>
    );
  };

  // Render Mobile Card View with hide-and-drop accordion details
  const renderCard = (item, idx) => {
    const leadKey = item.id || item.leadNo || idx;
    const isExpanded = expandedCardIds.has(leadKey);
    const visitedToday = showVisitMark && isVisitMarkedToday(item);
    const dealClosed = isDealClosed(item);
    const isNoContact = item.status === 'Call Not Received' || item.status === 'No WhatsApp Reply';
    const { visits: totalVisits, meetings: totalMeetings, calls: totalCalls } = getVisitMeetCounts(item);

    // Filter populated fields (skip empty/null/'-')
    const isValid = (val) => {
      if (val === null || val === undefined) return false;
      const s = String(val).trim();
      return s !== '' && s !== '-' && s !== 'null' && s !== 'undefined';
    };

    const details = [];
    if (isValid(item.email || item.customerEmail)) details.push({ label: 'Email', value: item.email || item.customerEmail, icon: Mail, isEmail: true });
    if (isValid(item.location || item.customerAddress)) details.push({ label: 'Location', value: item.location || item.customerAddress, icon: MapPin, isLong: true });
    if (isValid(item.requirement)) details.push({ label: 'Requirement', value: item.requirement, icon: FileText });
    if (isValid(item.investmentBudget || item.budget)) details.push({ label: 'Budget', value: item.investmentBudget || item.budget, icon: IndianRupee });
    if (showVisitCols && !isNoContact && (item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit)) details.push({ label: 'Site Visited', value: 'Yes', icon: Check });
    if (showVisitCols && !isNoContact && item.visitMeet?.meeting) details.push({ label: 'Meeting', value: 'Yes', icon: Check });
    if (isValid(item.relationshipManager)) details.push({ label: 'Relationship Manager', value: item.relationshipManager, icon: UserCheck });
    if (isValid(item.whenToBuyPlan)) details.push({ label: 'When to Buy', value: item.whenToBuyPlan, icon: Clock });
    if (isValid(item.leadRemarks || item.remarks)) details.push({ label: 'Remarks', value: item.leadRemarks || item.remarks, icon: MessageSquare, isLong: true });

    return (
      <div
        key={leadKey}
        className={`rounded-xl border transition shadow-2xs p-3 space-y-2.5 ${dealClosed ? 'bg-violet-50 border-l-4 border-l-violet-500' : visitedToday ? 'bg-emerald-50/70' : 'bg-white'} ${isExpanded ? 'border-indigo-300 ring-1 ring-indigo-200' : (dealClosed ? 'border-violet-300' : visitedToday ? 'border-emerald-300' : 'border-gray-200')}`}
      >
        {/* Card Header: Name, Lead # on left; Details dropdown on top right */}
        <div className="flex items-center justify-between gap-1.5 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h4
              onClick={() => onViewHistory(item)}
              className="font-bold text-sm text-gray-900 truncate cursor-pointer hover:text-indigo-600"
            >
              {item.customerName || item.personName || 'Unnamed Customer'}
            </h4>
            {item.leadNo && (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                #{item.leadNo}
              </span>
            )}
            {dealClosed && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-violet-600 text-white border border-violet-700 shrink-0">
                <CheckCircle2 size={9} className="stroke-[2.5] text-white" /> Closed Deal
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleCardExpand(leadKey)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${
              isExpanded
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={13} />
                <span>Hide</span>
              </>
            ) : (
              <>
                <ChevronDown size={13} />
                <span>Details</span>
              </>
            )}
          </button>
        </div>

        {/* Primary Row: Phone, Total Visits, Total Meetings, Total Calls, Meeting Date, Next Meeting Date */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Phone</span>
            {item.customerNumber || item.number ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <a href={`tel:${getCleanPhone(item.customerNumber || item.number)}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold">
                  <Phone size={11} className="text-emerald-500" />
                  <span>{item.customerNumber || item.number}</span>
                </a>
                <button
                  onClick={(e) => handleWhatsApp(item, e)}
                  className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition"
                  title="WhatsApp"
                >
                  WA
                </button>
              </div>
            ) : (
              <span className="text-gray-400 mt-0.5">-</span>
            )}
          </div>

          {showVisitCols && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Total Visits</span>
              <span className="font-bold text-gray-700 mt-0.5 inline-block">
                {totalVisits} {totalVisits === 1 ? 'Visit' : 'Visits'}
              </span>
            </div>
          )}

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Total Meetings</span>
            <span className="font-bold text-gray-700 mt-0.5 inline-block">
              {totalMeetings} {totalMeetings === 1 ? 'Meeting' : 'Meetings'}
            </span>
          </div>

          {showMeetingType && getMeetingType(item) && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Meeting Type</span>
              <span className="font-bold text-gray-700 mt-0.5 inline-block">{getMeetingType(item)}</span>
            </div>
          )}

          {showCalls && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Total Calls</span>
              <span className="font-bold text-gray-700 mt-0.5 inline-block">
                {totalCalls} {totalCalls === 1 ? 'Call' : 'Calls'}
              </span>
            </div>
          )}

          {(item.meetingDate || item.visitDate) && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} className="text-gray-400" />
                Meeting Date
              </span>
              {isToday(item.meetingDate || item.visitDate) ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-indigo-600 text-white mt-0.5">
                  {formatDate(item.meetingDate || item.visitDate)}
                  <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-white/20 font-extrabold">Today</span>
                </span>
              ) : (
                <span className="font-medium text-gray-700 text-xs mt-0.5 inline-block">{formatDate(item.meetingDate || item.visitDate)}</span>
              )}
            </div>
          )}

          {(item.nextMeetingDate || item.nextVisitDate) && (
            <div>
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <Clock size={10} className="text-amber-600" />
                Next Meeting
              </span>
              {isToday(item.nextMeetingDate || item.nextVisitDate) ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white mt-0.5">
                  {formatDate(item.nextMeetingDate || item.nextVisitDate)}
                  <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-white/20 font-extrabold">Today</span>
                </span>
              ) : (
                <span className={`font-bold text-xs mt-0.5 inline-block ${NEXT_DATE_CLASS}`}>
                  {formatDate(item.nextMeetingDate || item.nextVisitDate)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Customer Status & Visitor */}
        <div className="flex items-center justify-between gap-1.5 text-xs flex-wrap">
          {item.customerStatus && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${CUSTOMER_STATUS_STYLES[item.customerStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {item.customerStatus}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{showVisitCols ? 'Visitor:' : 'Assigned To:'}</span>
            {item.assignedVisitor ? (
              <span
                onClick={(e) => { e.stopPropagation(); onAssignVisitor?.(item); }}
                className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-xs font-semibold cursor-pointer active:scale-95"
                title="Click to reassign visitor"
              >
                <UserCheck size={11} className="text-amber-600" />
                {item.assignedVisitor}
              </span>
            ) : onAssignVisitor ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAssignVisitor?.(item); }}
                className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-xs font-semibold active:scale-95 cursor-pointer"
                title="Assign visitor"
              >
                <UserCheck size={11} />
                <span>Assign</span>
              </button>
            ) : (
              <span className="text-[11px] text-gray-400 italic">Not assigned</span>
            )}
          </div>
        </div>

        {/* Latest Feedback snippet (if any) */}
        {(item.whatHappened || item.visitorRemarks) && (
          <div className="bg-slate-50 border border-slate-100 rounded p-2 text-xs text-gray-700">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Feedback</span>
            <p className="leading-tight italic">"{item.whatHappened || item.visitorRemarks}"</p>
          </div>
        )}

        {/* Action & Status Row: Site-visit / Meeting text on bottom-left, Followup on bottom-right */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {isAdmin && item.status && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${STATUS_STYLES[item.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {statusText(item.status)}
              </span>
            )}
            {showVisitCols && (item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit) && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check size={9} className="stroke-[2.5]" /> Site Visited
              </span>
            )}
            {showVisitCols && item.visitMeet?.meeting && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                <Check size={9} className="stroke-[2.5]" /> Meeting
              </span>
            )}
          </div>

          <div className="flex items-center ml-auto gap-1 shrink-0">
            {onLogFollowUp && renderVisitMarkButton(item, false)}
            {onLogFollowUp && (
              <button
                type="button"
                onClick={() => onLogFollowUp(item)}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs active:scale-95 transition cursor-pointer shrink-0"
              >
                <MessageSquare size={12} />
                <span>Followup</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropped-down / Accordion Section */}
        {isExpanded && (
          <div className="pt-2 border-t border-gray-200/80 space-y-2.5 animate-in fade-in duration-150">
            {details.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Additional Details
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {details.map((col, cIdx) => {
                    const Icon = col.icon;
                    return (
                      <div
                        key={cIdx}
                        className={`bg-slate-50 border border-slate-200/70 rounded p-1.5 text-xs ${col.isLong ? 'col-span-2' : ''}`}
                      >
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                          {Icon && <Icon size={10} className="text-gray-400 shrink-0" />}
                          <span className="truncate">{col.label}</span>
                        </span>
                        <div className="font-medium text-gray-800 break-words">
                          {col.isEmail ? (
                            <a href={`mailto:${col.value}`} className="text-indigo-600 hover:underline">
                              {col.value}
                            </a>
                          ) : (
                            col.value
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => onViewHistory(item)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg transition"
              >
                <Eye size={12} />
                <span>View Full Timeline & Records</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-1">
      {/* Header Bar: Row 1 = Lead Category Tabs (Top); Row 2 = Dates & Actions Controls Bar */}
      <div className="flex flex-col gap-1.5 w-full flex-shrink-0">
        {/* Row 1: Lead Category Button Tabs (Always Top Row) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap w-full pb-0.5">
          <PageTabs
            tabs={tabs}
            activeKey={activeTab}
            onChange={(key) => { onTabChange?.(key); setCurrentPage(1); }}
          />
        </div>

        {/* Row 2: Controls Bar (Dates & Closed Deal on Left, Search & Actions on Right) */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-1.5 w-full">
          {/* Left: Date Filters + Closed Deal Toggle */}
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0 w-full xl:w-auto pb-0.5">
            {/* Dedicated Tab / Button for Today's Followup */}
            <button
              type="button"
              onClick={() => {
                setDateFilter('today');
                setShowClosedDealsOnly(false);
                setCurrentPage(1);
              }}
              title={`Show Today's Followups — ${dateCounts.todayVisited} of ${dateCounts.today} site visits done today`}
              className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold h-[34px] transition-all border shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                dateFilter === 'today'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-300/60 font-bold'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900 font-semibold shadow-xs'
              }`}
            >
              <Calendar size={13} className={dateFilter === 'today' ? 'text-white' : 'text-gray-400'} />
              <span>Today's Followup</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                dateFilter === 'today' ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                {dateCounts.todayVisited}/{dateCounts.today}
              </span>
            </button>

            {/* Dropdown for All Dates & other date options */}
            <div className="flex-1 min-w-[140px] sm:flex-none sm:w-[170px] shrink-0">
              <SearchableDropdown
                options={allDatesFilterOptions}
                value={dateFilter === 'today' ? 'all' : dateFilter}
                onMainClick={() => {
                  setDateFilter('all');
                  setShowClosedDealsOnly(false);
                  setCustomFrom('');
                  setCustomTo('');
                  setCurrentPage(1);
                }}
                onChange={(val) => {
                  setDateFilter(val);
                  setShowClosedDealsOnly(false);
                  if (val === 'custom' && !customFrom && !customTo) {
                    const t = getTodayStr();
                    setCustomFrom(t);
                    setCustomTo(t);
                  }
                  setCurrentPage(1);
                }}
                placeholder="All Dates"
                height="h-[34px]"
                triggerClassName={
                  dateFilter !== 'today'
                    ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-sky-300/50"
                    : ""
                }
                icon={Clock}
              />
            </div>

            {/* Custom Date Range Inline Inputs */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in duration-150">
                <div className="flex items-center gap-1 bg-white border border-gray-300 focus-within:border-indigo-500 rounded-lg px-2 h-[34px] shadow-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0">From</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="text-xs text-gray-700 bg-transparent focus:outline-none font-medium cursor-pointer"
                    title="From Date"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white border border-gray-300 focus-within:border-indigo-500 rounded-lg px-2 h-[34px] shadow-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0">To</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="text-xs text-gray-700 bg-transparent focus:outline-none font-medium cursor-pointer"
                    title="To Date"
                  />
                </div>
              </div>
            )}

            {/* Closed Deal Toggle Button */}
            <button
              onClick={() => {
                setShowClosedDealsOnly(prev => !prev);
                setCurrentPage(1);
              }}
              title={showClosedDealsOnly ? `Show all ${category} visits/deals` : `Show only closed deals for ${category}`}
              className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold h-[34px] transition border shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                showClosedDealsOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold ring-2 ring-emerald-300'
                  : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 shadow-2xs'
              }`}
            >
              <CheckCircle2 size={14} className={showClosedDealsOnly ? 'text-white' : 'text-emerald-600'} />
              <span>Closed Deal</span>
              {closedDealsCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight ${
                  showClosedDealsOnly ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {closedDealsCount}
                </span>
              )}
            </button>
          </div>

          {/* Right: Search + Excel + Refresh + Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto scrollbar-hide w-full xl:w-auto justify-between sm:justify-end pb-0.5">
            {/* Search Input */}
            <div className="relative min-w-[140px] sm:min-w-[180px] max-w-full sm:max-w-[240px] flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={`Search ${category} visits...`}
                className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-7 text-xs focus:outline-none focus:border-indigo-500 h-[34px] shadow-xs transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Export to Excel (ADMIN / Tester only) */}
            {isAdmin && (
              <button
                onClick={exportToExcel}
                title={`Export ${category} visits to Excel`}
                className="flex items-center justify-center gap-1 px-2.5 sm:px-3 rounded-lg text-xs font-semibold h-[34px] transition border shrink-0 bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 shadow-xs active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            )}

            {/* Clear / Reset Filters */}
            {isFilterActive && (
              <button
                onClick={handleClearFilters}
                title="Reset all filters & search to default"
                className="flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg h-[34px] px-2.5 sm:px-3 text-xs font-semibold transition gap-1 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span className="hidden md:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Full-Height Compact Table View */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-semibold tracking-wide uppercase">Loading {category} Visits...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-4 space-y-3">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-200">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">
                {showClosedDealsOnly ? `No Closed Deals in ${category}` : `No ${category} Visits Found`}
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                {showClosedDealsOnly
                  ? `There are currently no closed won deals recorded for ${category}.`
                  : `No site visit or meeting records match your current filter criteria for this category.`}
              </p>
            </div>
            {showClosedDealsOnly ? (
              <button
                onClick={() => {
                  setShowClosedDealsOnly(false);
                  setDateFilter('today');
                }}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-100 transition cursor-pointer"
              >
                Show All Visits / Deals
              </button>
            ) : isFilterActive && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-100 transition cursor-pointer"
              >
                Reset to Today
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <DataTable
              headers={tableHeaders}
              data={paginatedLeads}
              renderRow={renderRow}
              renderCard={renderCard}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={filteredLeads.length}
              totalResults={filteredLeads.length}
              minWidth="1200px"
              viewMode="auto"
              cardsGridClassName="grid grid-cols-1 gap-2.5 p-2 sm:p-3"
            />
          </div>
        )}
      </div>
    </div>
  );
}
