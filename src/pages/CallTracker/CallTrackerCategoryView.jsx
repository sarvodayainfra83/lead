import React, { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Search, X, RotateCcw, Phone, Eye, ChevronDown, ChevronUp,
  Calendar, FileSpreadsheet, Plus, UserCheck,
  Mail, Briefcase, FileText, MapPin, Clock, IndianRupee, MessageSquare, Bell, Pencil, Reply,
  CalendarDays, Upload
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import PageTabs from '../../components/PageTabs';
import SearchableDropdown from '../../components/SearchableDropdown';
import FormTracker from './FormTracker';
import CallTrackerViewModal from './CallTrackerViewModal';
import RemarkThreadModal from './RemarkThreadModal';
import { formatIST, leadApi } from '../../api/leadApi';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, matchesUserConnection } from '../../utils/authUtils';
import { TERMINAL_STATUSES, getTrackersForLead, CUSTOMER_STATUS_STYLES, formatDateTime } from './callTrackerConstants';
import { NEXT_DATE_CLASS } from '../../utils/leadTypeColors';
import { getVisitMeetCounts } from '../SiteVisitMeeting/SiteVisitCategoryView';

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Call Not Received': 'bg-orange-50 text-orange-700 border-orange-200',
  'No WhatsApp Reply': 'bg-slate-100 text-slate-700 border-slate-300',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Meeting: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Pending: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Unassigned: 'bg-gray-50 text-gray-500 border-gray-200'
};

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: "Today's Followup" },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'custom', label: 'Custom Date' }
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Pending', label: 'Pending (Not Called)' },
  { value: 'Interested', label: 'Interested' },
  { value: 'Future Plan Date', label: 'Future Plan Date' },
  { value: 'Site Visit/Meeting', label: 'Site Visit/Meeting' },
  { value: 'Not Interested', label: 'Not Interested' },
  { value: 'Call Not Received', label: 'Call Not Received' },
  { value: 'No WhatsApp Reply', label: 'No WhatsApp Reply' }
];

// Which stage a lead is at — shown in the Stage column beside Customer Name
const STAGE_STYLES = {
  'Site Visit': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Leads / Calling': 'bg-blue-50 text-blue-700 border-blue-200'
};

const matchesStatusFilter = (item, statusFilter) => {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'Pending') return item.status === 'Pending' || item.status === 'Unassigned';
  if (statusFilter === 'Site Visit/Meeting' || statusFilter === 'Meeting') {
    return item.status === 'Site Visit/Meeting' || item.status === 'Meeting';
  }
  return item.status === statusFilter;
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

// Returns midnight date object from date string
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

export default function CallTrackerCategoryView({
  category, // 'Real Estate' | 'Insurance' | 'Mutual Fund'
  tabs = [],
  activeTab,
  onTabChange,
  categoryCounts = {},
  leads = [],
  trackers = [],
  visitorFollowUps = [],
  assignedVisitors = [],
  loading = false,
  callersMaster = [],
  canEdit = false,
  onRefresh,
  onOpenDirect,
  onBulkUpload,
  initialStatusFilter, // e.g. 'Interested' when opened from a Dashboard card
  initialDateFilter, // e.g. 'all' or 'today'
  openRemarkLeadId, // open this lead's remark conversation (from a navbar notification)
  openRemarkNonce // changes on every notification click, so the same lead can be reopened
}) {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);
  // Insurance / Mutual Fund have meetings only — 'Site Visit/Meeting' reads 'Meeting' and the 'Site Visit' stage reads 'Meeting'
  const isMeetingOnly = category === 'Insurance' || category === 'Mutual Fund';
  const statusText = (status) => (isMeetingOnly && status === 'Site Visit/Meeting' ? 'Meeting' : status);
  const stageText = (stage) => (isMeetingOnly && stage === 'Site Visit' ? 'Meeting' : stage);
  // Who takes the site visit (Real Estate) / meeting (Insurance, Mutual Fund)
  const assignedToLabel = isMeetingOnly ? 'Meeting Assigned To' : 'Site Visit Assigned To';

  const [searchQuery, setSearchQuery] = useState('');
  const [openedFromNotification, setOpenedFromNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'all');
  const [dateFilter, setDateFilter] = useState(initialDateFilter || (initialStatusFilter ? 'all' : 'today'));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [callerFilter, setCallerFilter] = useState('all');
  // Stage buttons (All Dates only): 'all' | 'Leads / Calling' | 'Site Visit'
  const [stageFilter, setStageFilter] = useState('all');

  // Helper to format short date DD/MM
  const formatShortDate = (str) => {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return str;
  };

  // React to prop updates from Dashboard navigation
  useEffect(() => {
    if (initialStatusFilter !== undefined) {
      setStatusFilter(initialStatusFilter || 'all');
      if (initialDateFilter === undefined && initialStatusFilter) {
        setDateFilter('all');
      }
    }
    if (initialDateFilter !== undefined) {
      setDateFilter(initialDateFilter);
    }
  }, [initialStatusFilter, initialDateFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Modals state
  const [callingLead, setCallingLead] = useState(null);
  const [viewingLead, setViewingLead] = useState(null);

  // Lead-level remark thread (leads.admin_remark / leads.user_remark)
  const [remarkLead, setRemarkLead] = useState(null);
  // Remarks saved in this session, applied on top of the loaded leads until the next refresh
  const [remarkOverrides, setRemarkOverrides] = useState({});
  const [newRemarksOnly, setNewRemarksOnly] = useState(false);

  // Open the remark conversation; opening it counts as "seen" so the blink stops right away
  const openRemark = (item) => {
    setRemarkLead(item);
    const unread = isAdmin ? item.hasNewUserReply : item.hasNewAdminRemark;
    if (!unread || !item.id) return;
    const field = isAdmin ? 'userRemarkSeenAt' : 'adminRemarkSeenAt';
    const seenAt = new Date().toISOString();
    setRemarkOverrides(prev => ({ ...prev, [String(item.id)]: { ...(prev[String(item.id)] || {}), [field]: seenAt } }));
    leadApi.markRemarksSeen(item.id, isAdmin).catch(err => console.warn('Could not mark remark seen:', err));
  };

  // Mobile card view: expanded accordion card IDs (hide and drop details)
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());
  const toggleCardExpand = useCallback((leadKey) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(leadKey)) next.delete(leadKey);
      else next.add(leadKey);
      return next;
    });
  }, []);

  // Count active dropdown filters
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'today' ? 1 : 0) +
    (callerFilter !== 'all' ? 1 : 0) +
    (dateFilter === 'all' && stageFilter !== 'all' ? 1 : 0);

  // Reset all filters & search
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setStageFilter('all');
    setDateFilter('today');
    setCustomFrom('');
    setCustomTo('');
    setCallerFilter('all');
    setCurrentPage(1);
    toast.success('Filters reset to Today');
  }, []);

  // Listen for sidebar click to reset filters
  useEffect(() => {
    const handleClear = (e) => {
      if (!e?.detail?.path || e.detail.path === '/call-tracker') {
        handleClearFilters();
      }
    };
    window.addEventListener('app:clear-filters', handleClear);
    return () => window.removeEventListener('app:clear-filters', handleClear);
  }, [handleClearFilters]);

  // Prepare full caller report & tracker connected records for each lead
  const enrichedLeads = useMemo(() => {
    // Map visitor follow-ups by lead_id (UUID) and lead_no
    const followUpsByLead = {};
    (visitorFollowUps || []).forEach(f => {
      const keyId = String(f.leadId || f.lead_id || '').trim();
      const keyNo = String(f.leadNo || f.lead_no || '').trim().toLowerCase();
      if (keyId) {
        if (!followUpsByLead[keyId]) followUpsByLead[keyId] = [];
        followUpsByLead[keyId].push(f);
      }
      if (keyNo) {
        if (!followUpsByLead[keyNo]) followUpsByLead[keyNo] = [];
        followUpsByLead[keyNo].push(f);
      }
    });

    // Map assigned visitors by lead_id (UUID) and lead_no
    const assignmentsByLead = {};
    (assignedVisitors || []).forEach(a => {
      if (a.status === 'Cancelled') return;
      const keyId = String(a.leadId || a.lead_id || '').trim();
      const keyNo = String(a.leadNo || a.lead_no || '').trim().toLowerCase();
      if (keyId) {
        if (!assignmentsByLead[keyId]) assignmentsByLead[keyId] = [];
        assignmentsByLead[keyId].push(a);
      }
      if (keyNo) {
        if (!assignmentsByLead[keyNo]) assignmentsByLead[keyNo] = [];
        assignmentsByLead[keyNo].push(a);
      }
    });

    return leads.map((lead) => {
      // Find all tracker entries for this lead (sorted chronologically)
      const leadTrackers = getTrackersForLead(trackers, lead.id, lead.leadNo, lead.number || lead.customerNumber)
        .sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0))
        .map((t, idx) => ({ ...t, followUpNo: idx + 1 }));

      const latestTracker = leadTrackers[leadTrackers.length - 1] || null;
      // Latest call that recorded a Hot/Warm/Cold, and latest call carrying an admin remark
      const customerStatus = [...leadTrackers].reverse().find(t => t.customerStatus)?.customerStatus || '';
      const remarkTracker = [...leadTrackers].reverse().find(t => t.adminRemark) || null;

      // Visitor Follow-ups for this lead from visitor_follow_ups table
      const lKeyId = String(lead.id || '').trim();
      const lKeyNo = String(lead.leadNo || '').trim().toLowerCase();
      const rawFollowUps = [
        ...(lKeyId && followUpsByLead[lKeyId] ? followUpsByLead[lKeyId] : []),
        ...(lKeyNo && followUpsByLead[lKeyNo] ? followUpsByLead[lKeyNo] : [])
      ];
      const leadFollowUps = rawFollowUps
        .filter((v, idx, arr) => arr.findIndex(x => x.id === v.id) === idx)
        .sort((a, b) => (Number(a.timestampMs || a.timestamp_ms || 0)) - (Number(b.timestampMs || b.timestamp_ms || 0)));
      const latestVisitorFollowUp = leadFollowUps.length > 0 ? leadFollowUps[leadFollowUps.length - 1] : null;
      // Lead & Followup keeps calling a locked deal "Interested" — 'Deal Lock' is the Site Visit page's term
      const siteVisitStatus = latestVisitorFollowUp?.status === 'Deal Lock' ? 'Interested' : (latestVisitorFollowUp?.status || '');

      // Assigned Visitor
      const leadAssignments = [
        ...(lKeyId && assignmentsByLead[lKeyId] ? assignmentsByLead[lKeyId] : []),
        ...(lKeyNo && assignmentsByLead[lKeyNo] ? assignmentsByLead[lKeyNo] : [])
      ].sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));
      const latestAssignment = leadAssignments[0] || null;
      const assignedVisitor = latestAssignment?.visitorName || latestVisitorFollowUp?.visitorName || lead.assignedVisitor || '';

      // Determine date of call (from latest call tracker if any)
      let dateOfCall = '';
      let dateOfCallRaw = '';
      if (latestTracker?.timestamp) {
        dateOfCall = formatDate(latestTracker.timestamp);
        dateOfCallRaw = latestTracker.timestamp;
      }

      // Status
      // (a Site Visit lead never called — e.g. a walk-in — shows as Site Visit/Meeting)
      const status = latestTracker?.status ||
        (!lead.inCallList && lead.inSiteVisitList ? 'Site Visit/Meeting' : (lead.callerAssigned ? 'Pending' : 'Unassigned'));

      // Sorting timestamp: latest tracker activity or lead creation/update time
      let trackerTime = latestTracker?.timestampMs || 0;
      if (!trackerTime && dateOfCallRaw) {
        const d = parseTrackerDateStr(dateOfCallRaw);
        if (d) trackerTime = d.getTime();
      }

      let leadTime = 0;
      const rawLeadDate = lead.updated_at || lead.updatedAt || lead.timestamp || lead.created_at || lead.date;
      if (rawLeadDate) {
        const d = parseTrackerDateStr(rawLeadDate);
        if (d) leadTime = d.getTime();
      }

      const latestActivityTime = Math.max(trackerTime, leadTime);

      return {
        ...lead,
        leadId: lead.id,
        leadNo: lead.leadNo || '',
        personName: lead.personName || lead.customerName || '',
        number: lead.number || lead.customerNumber || '',
        email: lead.email || lead.customerEmail || '',
        location: lead.location || lead.customerAddress || '',
        leadType: lead.leadType || category,
        status,
        latestStatus: status,
        // Site Visit once the lead is on the Site Visit / Meeting list, otherwise still being called
        stage: lead.inSiteVisitList ? 'Site Visit' : 'Leads / Calling',
        customerStatus,
        assignedVisitor,
        // Lead-level remark thread (falls back to the latest per-call admin remark for older data)
        ...(() => {
          const o = remarkOverrides[String(lead.id)] || {};
          const adminRemark = o.adminRemark ?? (lead.adminRemark || remarkTracker?.adminRemark || '');
          const adminRemarkDate = o.adminRemarkDate ?? (lead.adminRemarkDate || remarkTracker?.adminRemarkDate || remarkTracker?.updatedAt || null);
          const userRemark = o.userRemark ?? (lead.userRemark || '');
          const userRemarkDate = o.userRemarkDate ?? (lead.userRemarkDate || null);
          const adminSeenAt = o.adminRemarkSeenAt ?? (lead.adminRemarkSeenAt || null);
          const userSeenAt = o.userRemarkSeenAt ?? (lead.userRemarkSeenAt || null);
          const ms = (v) => (v ? new Date(v).getTime() || 0 : 0);
          const adminMs = ms(adminRemarkDate);
          const userMs = ms(userRemarkDate);
          return {
            adminRemark, adminRemarkDate, userRemark, userRemarkDate,
            // For the user: admin wrote after the user's last reply and the user hasn't opened it yet
            hasNewAdminRemark: Boolean(adminRemark) && adminMs > Math.max(userMs, ms(adminSeenAt)),
            // For the admin: user replied after the admin's last remark and the admin hasn't opened it yet
            hasNewUserReply: Boolean(userRemark) && userMs > Math.max(adminMs, ms(userSeenAt))
          };
        })(),
        dateOfCall,
        dateOfCallRaw,
        customerSaid: latestTracker?.customerSaid || '',
        latestCustomerSaid: latestTracker?.customerSaid || '',
        nextCallDate: latestTracker?.nextDate || '',
        latestNextDate: latestTracker?.nextDate || '',
        followUpCount: leadTrackers.length,
        followUpNo: leadTrackers.length,
        trackers: leadTrackers,
        visitorFollowUps: leadFollowUps,
        visitorFollowUpCount: leadFollowUps.length,
        // Site visits counted the same way as the Site Visit / Meeting page's Total Visits
        totalVisits: getVisitMeetCounts({ followUps: leadFollowUps }).visits,
        latestVisitorFollowUp,
        siteVisitStatus,
        siteVisitDate: latestVisitorFollowUp?.visitDate || latestVisitorFollowUp?.visit_date || latestAssignment?.visitDate || lead.visitDate || '',
        nextVisitDate: latestVisitorFollowUp?.nextVisitDate || latestVisitorFollowUp?.next_visit_date || lead.nextMeetingDate || '',
        meetingDate: latestVisitorFollowUp?.visitDate || latestVisitorFollowUp?.visit_date || latestAssignment?.visitDate || lead.meetingDate || lead.visitDate || '',
        lastMeetingDate: latestVisitorFollowUp?.visitDate || latestVisitorFollowUp?.visit_date || latestAssignment?.visitDate || lead.meetingDate || lead.visitDate || '',
        nextMeetingDate: latestVisitorFollowUp?.nextVisitDate || latestVisitorFollowUp?.next_visit_date || lead.nextMeetingDate || '',
        latestActivityTime,
        latestTracker
      };
    });
  }, [leads, trackers, visitorFollowUps, assignedVisitors, category, remarkOverrides]);

  // Arriving from a navbar notification: open that lead's conversation once its data is loaded
  useEffect(() => {
    const requestKey = `${openRemarkLeadId}:${openRemarkNonce || ''}`;
    if (!openRemarkLeadId || openedFromNotification === requestKey) return;
    const target = enrichedLeads.find(l => String(l.id) === String(openRemarkLeadId));
    if (target) {
      setOpenedFromNotification(requestKey);
      setRemarkLead(target);
    }
  }, [openRemarkLeadId, openRemarkNonce, enrichedLeads, openedFromNotification]);

  // Distinct callers for filtering (for regular USER, only show logged-in user's identity)
  const callerOptions = useMemo(() => {
    if (!isAdmin) {
      const userName = user?.name || user?.id || '';
      return [
        { value: 'all', label: 'All Callers' },
        ...(userName ? [{ value: userName, label: userName }] : [])
      ];
    }
    const names = new Set();
    enrichedLeads.forEach(l => {
      if (l.callerAssigned) names.add(l.callerAssigned);
    });
    callersMaster.forEach(c => {
      const name = typeof c === 'string' ? c : (c.personName || c.name);
      if (name) names.add(name);
    });
    return [
      { value: 'all', label: 'All Callers' },
      ...Array.from(names).sort().map(name => ({ value: name, label: name }))
    ];
  }, [enrichedLeads, callersMaster, isAdmin, user]);

  // Today and yesterday benchmarks for date filter
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const yesterday = useMemo(() => {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return y;
  }, [today]);

  // Check if a date string/timestamp corresponds to today's date
  const isToday = useCallback((dateVal) => {
    if (!dateVal) return false;
    const d = parseTrackerDateStr(dateVal);
    if (!d) return false;
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
  }, [today]);

  const isSameDayAsToday = useCallback((val) => {
    if (!val) return false;
    const d = new Date(val);
    return !isNaN(d.getTime()) && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  }, [today]);

  // Calls logged on this lead today (from its call records)
  const getTodayCallCount = useCallback((item) =>
    (item.trackers || []).filter(t => isSameDayAsToday(Number(t.timestampMs || t.timestamp_ms) || null)).length,
  [isSameDayAsToday]);

  // "Called" — any followup logged on this lead today (Call Not Received / No WhatsApp Reply too, and calls
  // logged from Site Visit / Pending). Only a submitted followup creates a call log; the badge isn't clickable.
  const isCalledToday = useCallback((item) => getTodayCallCount(item) > 0, [getTodayCallCount]);

  // The called mark is shown in Today's Followup and All Dates
  const showCallMark = dateFilter === 'today' || dateFilter === 'all';

  // Read-only badge (desktop icon / mobile pill): turns green once today's followup is submitted. In place of
  // a ✓ it shows a call count — today's calls in Today's Followup, all calls till date in All Dates
  const renderCallMarkButton = (item, compact) => {
    const done = isCalledToday(item);
    const todayCalls = getTodayCallCount(item);
    const isAllDates = dateFilter === 'all';
    const callCount = isAllDates ? (item.followUpCount || 0) : todayCalls;
    const countText = isAllDates
      ? `${callCount} call${callCount === 1 ? '' : 's'} till date`
      : `${todayCalls} call${todayCalls === 1 ? '' : 's'} today`;
    const title = done
      ? `Followup submitted today — ${countText}`
      : `Not called yet today — submit the followup to mark it${callCount > 0 ? ` (${countText})` : ''}`;
    return (
      <span
        title={title}
        aria-label={title}
        className={compact
          ? `w-7 h-7 inline-flex items-center justify-center rounded-md border cursor-default ${done
            ? 'bg-emerald-600 text-white border-emerald-600'
            : `bg-white border-gray-200 ${callCount > 0 ? 'text-gray-500' : 'text-gray-300'}`}`
          : `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-default shrink-0 ${done
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white text-gray-400 border-gray-200'}`}
      >
        {/* No calls yet → the badge stays empty (no ✓) */}
        {callCount > 0 && (
          <span className={`font-bold leading-none ${compact ? 'text-xs' : 'text-[11px]'}`}>{callCount}</span>
        )}
        {!compact && <span>{done ? 'Called' : 'Not called'}</span>}
      </span>
    );
  };

  // Base accessible leads for the current user in this category
  const accessibleEnrichedLeads = useMemo(() => {
    return enrichedLeads.filter(item => {
      if (!isAdmin && !matchesUserConnection(item, user)) return false;
      return true;
    });
  }, [enrichedLeads, isAdmin, user]);

  // The Lead & Followup (call) list — what every date filter except All Dates works on
  const callListLeads = useMemo(
    () => accessibleEnrichedLeads.filter(item => item.inCallList),
    [accessibleEnrichedLeads]
  );

  // Lead counts for the Leads / Calling and Site Visit stage buttons (all dates)
  const stageCounts = useMemo(() => {
    const counts = { 'Leads / Calling': 0, 'Site Visit': 0 };
    accessibleEnrichedLeads.forEach(item => { counts[item.stage] += 1; });
    return counts;
  }, [accessibleEnrichedLeads]);

  // Live counts for each date filter
  const dateCounts = useMemo(() => {
    const todayTime = today.getTime();
    const yesterdayTime = yesterday.getTime();

    // All Dates = every lead till date (calls + site visits), same total as the Dashboard
    let allCount = accessibleEnrichedLeads.length;
    let todayCount = 0;
    let todayCalledCount = 0;
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

    callListLeads.forEach(item => {
      const nextCallObj = parseTrackerDateStr(item.nextCallDate);
      const meetObj = parseTrackerDateStr(item.meetingDate || item.lastMeetingDate || item.siteVisitDate || item.visitDate);
      const nextMeetObj = parseTrackerDateStr(item.nextMeetingDate || item.nextVisitDate);

      const nextCallTime = nextCallObj ? nextCallObj.getTime() : null;
      const meetTime = meetObj ? meetObj.getTime() : null;
      const nextMeetTime = nextMeetObj ? nextMeetObj.getTime() : null;

      const targetTime = nextCallTime || nextMeetTime || meetTime;

      // USER roles: a lead called today also counts as today's follow-up
      const lastCallObj = !isAdmin ? parseTrackerDateStr(item.dateOfCallRaw) : null;
      const lastCallToday = Boolean(lastCallObj) && lastCallObj.getTime() === todayTime;
      const isTodayMatch = nextCallTime === todayTime || meetTime === todayTime || nextMeetTime === todayTime || lastCallToday;
      const isYesterdayMatch = nextCallTime === yesterdayTime || meetTime === yesterdayTime || nextMeetTime === yesterdayTime;

      if (isTodayMatch) {
        todayCount++;
        if (isCalledToday(item)) todayCalledCount++;
      } else if (isYesterdayMatch) {
        yesterdayCount++;
      }

      if (targetTime && targetTime < todayTime && !TERMINAL_STATUSES.includes(item.status)) {
        overdueCount++;
      } else if ((nextCallTime && nextCallTime > todayTime) || (nextMeetTime && nextMeetTime > todayTime) || (meetTime && meetTime > todayTime)) {
        upcomingCount++;
      }

      if (fromMs !== null && toMs !== null) {
        const isCustomMatch = (nextCallTime && nextCallTime >= fromMs && nextCallTime <= toMs) ||
                              (meetTime && meetTime >= fromMs && meetTime <= toMs) ||
                              (nextMeetTime && nextMeetTime >= fromMs && nextMeetTime <= toMs);
        if (isCustomMatch) customCount++;
      }
    });

    return {
      all: allCount,
      today: todayCount,
      todayCalled: todayCalledCount,
      yesterday: yesterdayCount,
      overdue: overdueCount,
      upcoming: upcomingCount,
      custom: customCount
    };
  }, [accessibleEnrichedLeads, callListLeads, today, yesterday, customFrom, customTo, isAdmin, isCalledToday]);

  const customDropdownLabel = useMemo(() => {
    if (customFrom && customTo) {
      return `Custom: ${formatShortDate(customFrom)} – ${formatShortDate(customTo)} (${dateCounts.custom})`;
    }
    return 'Custom Date Range';
  }, [customFrom, customTo, dateCounts.custom]);

  // Dynamic Date Filter Options with live counts for all dates
  const dateFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: `All Dates (${dateCounts.all})` },
      { value: 'today', label: `Today's Followup (${dateCounts.today})` },
      { value: 'yesterday', label: `Yesterday (${dateCounts.yesterday})` },
      { value: 'overdue', label: `Overdue (${dateCounts.overdue})` },
      { value: 'upcoming', label: `Upcoming (${dateCounts.upcoming})` },
      { value: 'custom', label: customDropdownLabel }
    ];
  }, [dateCounts, customDropdownLabel]);

  // Dropdown options for All Dates and other timeframes (excluding separate Today's Followup tab)
  const allDatesFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: `All Dates (${dateCounts.all})` },
      { value: 'yesterday', label: `Yesterday (${dateCounts.yesterday})` },
      { value: 'overdue', label: `Overdue (${dateCounts.overdue})` },
      { value: 'upcoming', label: `Upcoming (${dateCounts.upcoming})` },
      { value: 'custom', label: customDropdownLabel }
    ];
  }, [dateCounts, customDropdownLabel]);

  // Filter leads by everything except status (the status dropdown counts come from this list)
  const leadsBeforeStatus = useMemo(() => {
    // All Dates → every lead (calling + site visit stage, or one stage via its button); other dates → the call list
    const baseLeads = dateFilter === 'all'
      ? accessibleEnrichedLeads.filter(item => stageFilter === 'all' || category !== 'Real Estate' || item.stage === stageFilter)
      : callListLeads;
    return baseLeads.filter(item => {

      // "New remarks" chip: unread admin remarks for users, new user replies for admins
      if (newRemarksOnly && !(isAdmin ? item.hasNewUserReply : item.hasNewAdminRemark)) return false;

      // Caller filter
      if (callerFilter !== 'all' && item.callerAssigned !== callerFilter) {
        return false;
      }

      // Date filter (evaluates Next Call Date, Last Meeting Date, and Next Meeting Date)
      if (dateFilter !== 'all') {
        const nextCallObj = parseTrackerDateStr(item.nextCallDate);
        const meetObj = parseTrackerDateStr(item.meetingDate || item.lastMeetingDate || item.siteVisitDate || item.visitDate);
        const nextMeetObj = parseTrackerDateStr(item.nextMeetingDate || item.nextVisitDate);

        const nextCallTime = nextCallObj ? nextCallObj.getTime() : null;
        const meetTime = meetObj ? meetObj.getTime() : null;
        const nextMeetTime = nextMeetObj ? nextMeetObj.getTime() : null;

        const targetTime = nextCallTime || nextMeetTime || meetTime;
        const todayTime = today.getTime();
        const yesterdayTime = yesterday.getTime();

        if (dateFilter === 'today') {
          // USER roles: a lead called today also counts as today's follow-up
          const lastCallObj = !isAdmin ? parseTrackerDateStr(item.dateOfCallRaw) : null;
          const lastCallToday = Boolean(lastCallObj) && lastCallObj.getTime() === todayTime;
          if (!(nextCallTime === todayTime || meetTime === todayTime || nextMeetTime === todayTime || lastCallToday)) return false;
        } else if (dateFilter === 'yesterday') {
          if (!(nextCallTime === yesterdayTime || meetTime === yesterdayTime || nextMeetTime === yesterdayTime)) return false;
        } else if (dateFilter === 'overdue') {
          if (!targetTime || targetTime >= todayTime || TERMINAL_STATUSES.includes(item.status)) return false;
        } else if (dateFilter === 'upcoming') {
          if (!((nextCallTime && nextCallTime > todayTime) || (nextMeetTime && nextMeetTime > todayTime) || (meetTime && meetTime > todayTime))) return false;
        } else if (dateFilter === 'custom') {
          let fromMs = null;
          let toMs = null;
          if (customFrom) {
            const fParts = customFrom.split('-').map(Number);
            if (fParts.length === 3) fromMs = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0, 0).getTime();
          }
          if (customTo) {
            const tParts = customTo.split('-').map(Number);
            if (tParts.length === 3) toMs = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999).getTime();
          }
          const inRange = (t) => {
            if (!t) return false;
            if (fromMs !== null && t < fromMs) return false;
            if (toMs !== null && t > toMs) return false;
            return true;
          };
          if (!(inRange(nextCallTime) || inRange(meetTime) || inRange(nextMeetTime))) return false;
        }
      }

      // Individual page search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          (item.personName || '').toLowerCase().includes(q) ||
          (item.number || '').toLowerCase().includes(q) ||
          (item.email || '').toLowerCase().includes(q) ||
          (item.location || '').toLowerCase().includes(q) ||
          (item.requirement || '').toLowerCase().includes(q) ||
          (item.callerAssigned || '').toLowerCase().includes(q) ||
          (item.status || '').toLowerCase().includes(q) ||
          (item.stage || '').toLowerCase().includes(q) ||
          (item.customerStatus || '').toLowerCase().includes(q) ||
          (item.adminRemark || '').toLowerCase().includes(q) ||
          (item.userRemark || '').toLowerCase().includes(q) ||
          (item.customerSaid || '').toLowerCase().includes(q) ||
          (item.remarks || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [accessibleEnrichedLeads, callListLeads, stageFilter, category, callerFilter, dateFilter, customFrom, customTo, searchQuery, today, yesterday, newRemarksOnly, isAdmin]);

  const filteredLeads = useMemo(
    () => leadsBeforeStatus.filter(item => matchesStatusFilter(item, statusFilter)),
    [leadsBeforeStatus, statusFilter]
  );

  // Status dropdown with live counts for the leads the other filters leave in view
  const statusFilterOptions = useMemo(() => STATUS_FILTER_OPTIONS.map(opt => ({
    ...opt,
    label: `${statusText(opt.label)} (${leadsBeforeStatus.filter(item => matchesStatusFilter(item, opt.value)).length})`
  })), [leadsBeforeStatus, isMeetingOnly]);

  // Guaranteed newest / latest updated or added record at top (from top to bottom showing latest call dates first)
  const sortedLeads = useMemo(() => {
    const getLeadCallMs = (item) => {
      if (item.latestTracker?.timestampMs) return Number(item.latestTracker.timestampMs);
      if (item.dateOfCallRaw) {
        const d = parseTrackerDateStr(item.dateOfCallRaw);
        if (d) return d.getTime();
      }
      if (item.latestTracker?.timestamp) {
        const d = new Date(item.latestTracker.timestamp);
        if (!isNaN(d.getTime())) return d.getTime();
      }
      if (item.nextCallDate) {
        const d = parseTrackerDateStr(item.nextCallDate);
        if (d) return d.getTime();
      }
      if (item.latestActivityTime) return item.latestActivityTime;
      const rawDate = item.timestamp || item.created_at || item.date;
      if (rawDate) {
        const d = parseTrackerDateStr(rawDate);
        if (d) return d.getTime();
      }
      return 0;
    };

    const remarkMs = (l) => Math.max(
      l.adminRemarkDate ? new Date(l.adminRemarkDate).getTime() || 0 : 0,
      l.userRemarkDate ? new Date(l.userRemarkDate).getTime() || 0 : 0
    );

    return [...filteredLeads].sort((a, b) => {
      if (!isAdmin && a.hasNewAdminRemark !== b.hasNewAdminRemark) return a.hasNewAdminRemark ? -1 : 1;
      if (isAdmin && a.hasNewUserReply !== b.hasNewUserReply) return a.hasNewUserReply ? -1 : 1;

      // Latest call or remark activity first (newest at top)
      const timeB = Math.max(getLeadCallMs(b), remarkMs(b));
      const timeA = Math.max(getLeadCallMs(a), remarkMs(a));
      if (timeB !== timeA) return timeB - timeA;

      return (b.id || 0) - (a.id || 0);
    });
  }, [filteredLeads, isAdmin]);

  const newRemarkCount = enrichedLeads.filter(l => l.inCallList && (isAdmin ? l.hasNewUserReply : l.hasNewAdminRemark)).length;

  // Pagination
  const totalPages = Math.ceil(sortedLeads.length / itemsPerPage) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedLeads.slice(start, start + itemsPerPage);
  }, [sortedLeads, currentPage, itemsPerPage]);

  // Handle call saved callback
  const handleCallSaved = () => {
    setCallingLead(null);
    if (onRefresh) onRefresh();
  };

  // Export to Excel
  const isRealEstate = category === 'Real Estate';
  const handleExportExcel = () => {
    const exportData = sortedLeads.map((item, idx) => ({
      'SR No': idx + 1,
      'Last Date of Call': item.dateOfCall || '-',
      'Next Date of Call': formatDate(item.nextCallDate),
      'Customer Name': item.personName || '-',
      'Stage': stageText(item.stage),
      'Status': statusText(item.status) || '-',
      'Customer Status': item.customerStatus || '-',
      'Site Visit Status': item.siteVisitStatus || '-',
      'Site Visit Follow-ups': item.visitorFollowUpCount || 0,
      'What did Customer Said': item.customerSaid || '-',
      'Admin Remark': item.adminRemark || '-',
      'Admin Remark Date (IST)': item.adminRemarkDate ? formatIST(item.adminRemarkDate) : '-',
      'User Remark': item.userRemark || '-',
      'User Remark Date (IST)': item.userRemarkDate ? formatIST(item.userRemarkDate) : '-',
      'Phone Number': item.number || '-',
      'Total Calls': item.followUpCount || 0,
      ...(isRealEstate ? { 'Total Visits': item.totalVisits || 0 } : {}),
      'Email': item.email || '-',
      'DOB': formatDate(item.dob),
      'Occupation': item.occupation || '-',
      'Requirement': item.requirement || '-',
      'Investment Budget': item.investmentBudget || '-',
      'Customer Address': item.location || '-',
      'When to Buy Plan': item.whenToBuyPlan || '-',
      [assignedToLabel]: item.assignedVisitor || '-',
      ...(isAdmin ? { 'Caller Assigned': item.callerAssigned || '-' } : {}),
      'Remarks': item.remarks || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${category} Calls`);
    XLSX.writeFile(workbook, `CallTracker_${category.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Table Headers: hide lead no and lead type; show Last Date of Call, Next Date of Call, Customer Name, Status first
  const tableHeaders = [
    "Action",
    "Last Date of Call",
    "Next Date of Call",
    "Customer Name",
    "Stage",
    "Status",
    "Customer Status",
    "What did Customer Said",
    "Admin Remark",
    "User Remark",
    "Phone Number",
    "Total Calls",
    ...(isRealEstate ? ["Total Visits"] : []),
    "Email",
    "DOB",
    "Occupation",
    "Requirement",
    "Investment Budget",
    "Customer Address",
    "When to Buy Plan",
    assignedToLabel,
    ...(isAdmin ? ["Caller Assigned"] : []),
    "Remarks"
  ];

  // Render Table Row with standard text sizes and popup View modal
  const renderRow = (item, idx) => {
    const leadKey = item.id || item.leadNo || idx;
    // Called-today mark in Today's Followup and All Dates views
    const calledToday = showCallMark && isCalledToday(item);

    return (
      <tr
        key={leadKey}
        onClick={(e) => {
          if (!e.currentTarget.contains(e.target)) return;
          if (e.target.closest('button, a, input, select, label, [role="combobox"], [role="listbox"]')) return;
          setViewingLead(item);
        }}
        className={`group cursor-pointer transition-colors border-b border-gray-100 ${calledToday ? 'bg-emerald-50/70 hover:bg-emerald-100/60' : 'hover:bg-indigo-50/40'}`}
      >
        {/* Action column: compact icon buttons (tooltips carry the labels) */}
        <td className="px-2 py-1.5 text-center whitespace-nowrap">
          <div className="flex items-center justify-center gap-1">
            {canEdit && (
              <button
                onClick={() => setCallingLead(item)}
                title={`Followup — log a call for ${item.personName || 'Customer'}`}
                aria-label="Followup"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition active:scale-95"
              >
                <Phone size={13} />
              </button>
            )}

            {/* Today's Followup & All Dates: tick the lead once you've called it today */}
            {canEdit && showCallMark && renderCallMarkButton(item, true)}

            {/* View all records (call count badge) */}
            <button
              onClick={() => setViewingLead(item)}
              title={`View ${item.followUpCount} call record${item.followUpCount === 1 ? '' : 's'} & details`}
              aria-label="View"
              className="relative w-7 h-7 inline-flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition active:scale-95"
            >
              <Eye size={13} />
              {/* Total-calls count is hidden where the called badge shows today's count instead */}
              {item.followUpCount > 0 && !showCallMark && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold leading-4 border border-white">
                  {item.followUpCount}
                </span>
              )}
            </button>

            {/* Remark — admin: always; user: only when the admin has written a remark (blinks on a new one) */}
            {(isAdmin || item.adminRemark) && (
              <button
                onClick={() => openRemark(item)}
                title={isAdmin
                  ? (item.hasNewUserReply ? 'New reply from user' : (item.adminRemark ? 'Remark conversation' : 'Add admin remark'))
                  : (item.hasNewAdminRemark ? 'New remark from admin — reply' : 'Read admin remark & reply')}
                aria-label="Remark"
                className={`relative w-7 h-7 inline-flex items-center justify-center rounded-md border transition active:scale-95 ${!isAdmin && item.hasNewAdminRemark
                  ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                  : isAdmin && item.hasNewUserReply
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white'
                  }`}
              >
                <MessageSquare size={13} />
                {((!isAdmin && item.hasNewAdminRemark) || (isAdmin && item.hasNewUserReply)) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            )}
          </div>
        </td>

        {/* 1. Last Date of Call */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          {item.dateOfCall ? (
            isToday(item.dateOfCallRaw || item.dateOfCall) ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-600 text-white shadow-2xs">
                <Calendar size={11} className="text-white" />
                <span>{item.dateOfCall}</span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white/20 text-white font-extrabold">Today</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                <Calendar size={12} className="text-gray-400" />
                {item.dateOfCall}
              </span>
            )
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </td>

        {/* 2. Next Date of Call */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          {item.nextCallDate ? (
            isToday(item.nextCallDate) ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-600 text-white shadow-2xs">
                <Clock size={11} className="text-white" />
                <span>{formatDate(item.nextCallDate)}</span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white/20 text-white font-extrabold">Today</span>
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 font-semibold ${NEXT_DATE_CLASS}`}>
                <Calendar size={12} />
                {formatDate(item.nextCallDate)}
              </span>
            )
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </td>

        {/* 3. Customer Name */}
        <td className="px-3 py-2 text-left text-xs font-bold whitespace-nowrap max-w-[190px] truncate" title={item.personName}>
          <div className="flex flex-col items-start gap-0.5">
            <span className="flex items-center gap-1 min-w-0">
              <span
                onClick={() => setViewingLead(item)}
                className="text-gray-900 truncate hover:text-indigo-600 cursor-pointer"
              >
                {item.personName || '-'}
              </span>
              {!isAdmin && item.hasNewAdminRemark && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openRemark(item); }}
                  title="New remark from admin"
                  className="relative flex-shrink-0 text-amber-600"
                >
                  <Bell size={13} className="animate-bounce" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                </button>
              )}
            </span>
            {item.visitorFollowUpCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingLead(item);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                title={`Site Visit: ${item.siteVisitStatus || 'Recorded'} (${item.visitorFollowUpCount} visit follow-up${item.visitorFollowUpCount > 1 ? 's' : ''}) - Click to view`}
              >
                <MapPin size={9} className="text-emerald-600 shrink-0" />
                <span className="truncate max-w-[120px]">Visit: {item.siteVisitStatus || `${item.visitorFollowUpCount}`}</span>
              </button>
            )}
          </div>
        </td>

        {/* Stage: Leads / Calling or Site Visit */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STAGE_STYLES[item.stage]}`}>
            {stageText(item.stage)}
          </span>
        </td>

        {/* 4. Status */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          {item.status ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase border tracking-wide ${STATUS_STYLES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {statusText(item.status)}
            </span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>

        {/* Customer Status (Hot / Warm / Cold) */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          {item.customerStatus ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase border tracking-wide ${CUSTOMER_STATUS_STYLES[item.customerStatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {item.customerStatus}
            </span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>

        {/* 5. What did Customer Said */}
        <td className="px-3 py-2 text-left text-xs text-gray-700 max-w-[220px] truncate" title={item.customerSaid || ''}>
          {item.customerSaid || <span className="text-gray-300">-</span>}
        </td>

        {/* Admin Remark (lead-level, IST date) — blinks for the user until they reply */}
        <td className="px-3 py-2 text-left text-xs max-w-[240px]">
          <button
            type="button"
            disabled={!isAdmin && !item.adminRemark}
            onClick={() => openRemark(item)}
            title={isAdmin ? 'Open remark conversation' : 'Read admin remark & reply'}
            className={`w-full text-left rounded-lg px-2 py-1 transition border ${!isAdmin && item.hasNewAdminRemark
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200 animate-pulse'
              : 'border-transparent hover:bg-indigo-50 hover:border-indigo-100'
              }`}
          >
            {item.adminRemark ? (
              <span className="block min-w-0">
                <span className="flex items-center gap-1">
                  {!isAdmin && item.hasNewAdminRemark && (
                    <span className="flex-shrink-0 px-1 rounded bg-red-500 text-white text-[9px] font-bold uppercase">New</span>
                  )}
                  <span className="text-gray-800 truncate">{item.adminRemark}</span>
                </span>
                {item.adminRemarkDate && (
                  <span className="block text-[10px] text-gray-400 whitespace-nowrap">{formatIST(item.adminRemarkDate)} IST</span>
                )}
              </span>
            ) : isAdmin ? (
              <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold"><Pencil size={11} /> Add remark</span>
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </button>
        </td>

        {/* User Remark (reply to admin, IST date) */}
        <td className="px-3 py-2 text-left text-xs max-w-[240px]">
          <button
            type="button"
            disabled={!isAdmin && !item.adminRemark}
            onClick={() => openRemark(item)}
            title={isAdmin ? 'View conversation' : 'Reply to admin'}
            className="w-full text-left rounded-lg px-2 py-1 transition border border-transparent hover:bg-emerald-50 hover:border-emerald-100"
          >
            {item.userRemark ? (
              <span className="block min-w-0">
                <span className="flex items-center gap-1">
                  {isAdmin && item.hasNewUserReply && (
                    <span className="relative flex-shrink-0 px-1 rounded bg-emerald-600 text-white text-[9px] font-bold uppercase">Reply</span>
                  )}
                  <span className="text-gray-800 truncate">{item.userRemark}</span>
                </span>
                {item.userRemarkDate && (
                  <span className="block text-[10px] text-gray-400 whitespace-nowrap">{formatIST(item.userRemarkDate)} IST</span>
                )}
              </span>
            ) : !isAdmin && item.adminRemark ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><Reply size={11} /> Reply</span>
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </button>
        </td>

        {/* 6. Phone Number */}
        <td className="px-3 py-2 text-center text-xs text-gray-700 whitespace-nowrap">
          {item.number ? (
            <a href={`tel:${item.number}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium">
              <Phone size={11} className="text-gray-400" />
              {item.number}
            </a>
          ) : '-'}
        </td>

        {/* 7. Total Calls */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {item.followUpCount} {item.followUpCount === 1 ? 'Call' : 'Calls'}
          </span>
        </td>

        {/* 7b. Total Visits (Real Estate only) */}
        {isRealEstate && (
          <td className="px-3 py-2 text-center whitespace-nowrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${item.totalVisits > 0 ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {item.totalVisits} {item.totalVisits === 1 ? 'Visit' : 'Visits'}
            </span>
          </td>
        )}

        {/* 8. Email */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap">{item.email || '-'}</td>

        {/* 9. DOB */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap">{formatDate(item.dob)}</td>

        {/* 10. Occupation */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap">{item.occupation || '-'}</td>

        {/* 11. Requirement */}
        <td className="px-3 py-2 text-center text-xs text-gray-700 whitespace-nowrap max-w-[160px] truncate" title={item.requirement}>
          {item.requirement || '-'}
        </td>

        {/* 12. Investment Budget */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap">{item.investmentBudget || '-'}</td>

        {/* 13. Customer Address */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={item.location}>
          {item.location || '-'}
        </td>

        {/* 14. When to Buy Plan */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>

        {/* 15. Site Visit / Meeting Assigned To */}
        <td className="px-3 py-2 text-center text-xs text-gray-800 font-medium whitespace-nowrap">
          {item.assignedVisitor ? (
            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded text-xs font-semibold">
              <UserCheck size={11} className="text-indigo-600" />
              {item.assignedVisitor}
            </span>
          ) : (
            <span className="text-gray-400 italic">-</span>
          )}
        </td>

        {/* 16. Caller Assigned (ADMIN / Tester only) */}
        {isAdmin && (
          <td className="px-3 py-2 text-center text-xs text-gray-800 font-medium whitespace-nowrap">
            {item.callerAssigned ? (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-xs font-semibold">
                <UserCheck size={11} className="text-amber-600" />
                {item.callerAssigned}
              </span>
            ) : (
              <span className="text-gray-400 italic">Unassigned</span>
            )}
          </td>
        )}

        {/* Remarks */}
        <td className="px-3 py-2 text-center text-xs text-gray-500 whitespace-nowrap max-w-[160px] truncate" title={item.remarks}>
          {item.remarks || '-'}
        </td>
      </tr>
    );
  };

  // Render Mobile Card View with hide-and-drop accordion details
  const renderCard = (item, idx) => {
    const leadKey = item.id || item.leadNo || idx;
    const isExpanded = expandedCardIds.has(leadKey);
    // Called-today mark in Today's Followup and All Dates views
    const calledToday = showCallMark && isCalledToday(item);

    // Filter populated fields (skip empty/null/'-')
    const isValid = (val) => {
      if (val === null || val === undefined) return false;
      const s = String(val).trim();
      return s !== '' && s !== '-' && s !== 'null' && s !== 'undefined';
    };

    const details = [];
    if (isValid(item.email)) details.push({ label: 'Email', value: item.email, icon: Mail, isEmail: true });
    if (isValid(item.dob) && formatDate(item.dob) !== '-') details.push({ label: 'DOB', value: formatDate(item.dob), icon: Calendar });
    if (isValid(item.occupation)) details.push({ label: 'Occupation', value: item.occupation, icon: Briefcase });
    if (isValid(item.requirement)) details.push({ label: 'Requirement', value: item.requirement, icon: FileText });
    if (isValid(item.investmentBudget)) details.push({ label: 'Budget', value: item.investmentBudget, icon: IndianRupee });
    if (isValid(item.location)) details.push({ label: 'Address', value: item.location, icon: MapPin, isLong: true });
    if (isValid(item.whenToBuyPlan)) details.push({ label: 'When to Buy', value: item.whenToBuyPlan, icon: Clock });
    if (isValid(item.assignedVisitor)) details.push({ label: assignedToLabel, value: item.assignedVisitor, icon: UserCheck });
    if (isAdmin && isValid(item.callerAssigned)) details.push({ label: 'Caller Assigned', value: item.callerAssigned, icon: UserCheck });
    if (isValid(item.remarks)) details.push({ label: 'Remarks', value: item.remarks, icon: MessageSquare, isLong: true });

    return (
      <div
        key={leadKey}
        className={`rounded-xl border transition shadow-2xs p-3 space-y-2.5 ${calledToday ? 'bg-emerald-50/70' : 'bg-white'} ${isExpanded ? 'border-indigo-300 ring-1 ring-indigo-200' : (calledToday ? 'border-emerald-300' : 'border-gray-200')}`}
      >
        {/* Card Header: Name, Lead # on left; Details dropdown on top right */}
        <div className="flex items-center justify-between gap-1.5 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h4
              onClick={() => setViewingLead(item)}
              className="font-bold text-sm text-gray-900 truncate cursor-pointer hover:text-indigo-600"
            >
              {item.personName || 'Unnamed Customer'}
            </h4>
            {item.leadNo && (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                #{item.leadNo}
              </span>
            )}
            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border shrink-0 ${STAGE_STYLES[item.stage]}`}>
              {stageText(item.stage)}
            </span>
            {calledToday && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white shrink-0">Called today</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleCardExpand(leadKey)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${isExpanded
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

        {/* Primary Row: Phone, Total Calls, Last Call, Next Call */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Phone</span>
            {item.number ? (
              <a href={`tel:${item.number}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold mt-0.5">
                <Phone size={11} className="text-emerald-500" />
                <span>{item.number}</span>
              </a>
            ) : (
              <span className="text-gray-400 mt-0.5">-</span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Total Calls</span>
            <span className="font-bold text-gray-700 mt-0.5 inline-block">
              {item.followUpCount} {item.followUpCount === 1 ? 'Call' : 'Calls'}
            </span>
          </div>

          {isRealEstate && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Total Visits</span>
              <span className="font-bold text-cyan-700 mt-0.5 inline-block">
                {item.totalVisits} {item.totalVisits === 1 ? 'Visit' : 'Visits'}
              </span>
            </div>
          )}

          {item.dateOfCall && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} className="text-gray-400" />
                Last Call
              </span>
              {isToday(item.dateOfCallRaw || item.dateOfCall) ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-indigo-600 text-white mt-0.5">
                  {item.dateOfCall}
                  <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-white/20 font-extrabold">Today</span>
                </span>
              ) : (
                <span className="font-medium text-gray-700 text-xs mt-0.5 inline-block">{item.dateOfCall}</span>
              )}
            </div>
          )}

          {item.nextCallDate && (
            <div>
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <Clock size={10} className="text-amber-600" />
                Next Call
              </span>
              {isToday(item.nextCallDate) ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white mt-0.5">
                  {formatDate(item.nextCallDate)}
                  <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-white/20 font-extrabold">Today</span>
                </span>
              ) : (
                <span className={`font-bold text-xs mt-0.5 inline-block ${NEXT_DATE_CLASS}`}>
                  {formatDate(item.nextCallDate)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Customer Status + latest Admin Remark (if any) */}
        {item.customerStatus && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Customer Status</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${CUSTOMER_STATUS_STYLES[item.customerStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {item.customerStatus}
            </span>
          </div>
        )}
        {(isAdmin || item.adminRemark) && (
          <button
            type="button"
            onClick={() => openRemark(item)}
            className={`w-full text-left rounded-lg border p-2 text-xs space-y-1.5 transition ${!isAdmin && item.hasNewAdminRemark
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200 animate-pulse'
              : 'bg-indigo-50/40 border-indigo-100'
              }`}
          >
            <span className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                {!isAdmin && item.hasNewAdminRemark && <Bell size={11} className="text-amber-600 animate-bounce" />}
                Admin Remark
                {!isAdmin && item.hasNewAdminRemark && <span className="px-1 rounded bg-red-500 text-white text-[9px]">NEW</span>}
              </span>
              {item.adminRemarkDate && <span className="text-[10px] text-gray-400">{formatIST(item.adminRemarkDate)}</span>}
            </span>
            <span className="block text-gray-800 leading-tight whitespace-pre-wrap">
              {item.adminRemark || (isAdmin ? 'Tap to add a remark for the caller' : '-')}
            </span>
            {(item.userRemark || (!isAdmin && item.adminRemark)) && (
              <span className="block border-t border-indigo-100 pt-1.5">
                <span className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    User Remark
                    {isAdmin && item.hasNewUserReply && <span className="px-1 rounded bg-emerald-600 text-white text-[9px]">REPLY</span>}
                  </span>
                  {item.userRemarkDate && <span className="text-[10px] text-gray-400">{formatIST(item.userRemarkDate)}</span>}
                </span>
                <span className="block text-gray-800 leading-tight whitespace-pre-wrap">
                  {item.userRemark || 'Tap to reply to admin'}
                </span>
              </span>
            )}
          </button>
        )}

        {/* Customer Said snippet (if any) */}
        {item.customerSaid && (
          <div className="bg-slate-50 border border-slate-100 rounded p-2 text-xs text-gray-700">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Customer Said</span>
            <p className="leading-tight">{item.customerSaid}</p>
          </div>
        )}

        {/* Action & Status Row: Status/badges on bottom-left, Followup & Remark on bottom-right */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {item.status && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${STATUS_STYLES[item.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {statusText(item.status)}
              </span>
            )}
            {item.visitorFollowUpCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingLead(item);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition shrink-0"
                title={`Site Visit: ${item.siteVisitStatus || 'Recorded'} (${item.visitorFollowUpCount} visit follow-up${item.visitorFollowUpCount > 1 ? 's' : ''}) - Click to view`}
              >
                <MapPin size={9} className="text-emerald-600" />
                <span>Visit: {item.siteVisitStatus || `${item.visitorFollowUpCount}`}</span>
              </button>
            )}
          </div>

          <div className="flex items-center ml-auto gap-1.5 shrink-0">
            {canEdit && showCallMark && renderCallMarkButton(item, false)}
            {canEdit && (
              <button
                type="button"
                onClick={() => setCallingLead(item)}
                className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs active:scale-95 transition cursor-pointer shrink-0"
              >
                <Phone size={12} />
                <span>Followup</span>
              </button>
            )}
            {(isAdmin || item.adminRemark) && (
              <button
                type="button"
                onClick={() => openRemark(item)}
                title={isAdmin ? (item.adminRemark ? 'Update admin remark' : 'Add admin remark') : (item.adminRemark ? 'Read admin remark & reply' : 'No remark from admin yet')}
                className={`relative inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider transition shadow-xs active:scale-95 whitespace-nowrap border cursor-pointer ${!isAdmin && item.hasNewAdminRemark
                  ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                  : isAdmin && item.hasNewUserReply
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-500 hover:text-white'
                  }`}
              >
                <MessageSquare size={11} />
                <span>{isAdmin ? (item.hasNewUserReply ? 'Reply' : 'Remark') : (item.hasNewAdminRemark ? 'New' : 'Reply')}</span>
                {((!isAdmin && item.hasNewAdminRemark) || (isAdmin && item.hasNewUserReply)) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Dropped-down / Accordion Section */}
        {isExpanded && (
          <div className="pt-2 border-t border-gray-200/80 space-y-2.5 animate-in fade-in duration-150">
            {/* Additional Customer Details (only non-empty fields) */}
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

            {/* Call History / Records List */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                <span>Call Records ({item.trackers.length})</span>
                {item.nextCallDate && (
                  <span className={`text-[10px] font-semibold ${NEXT_DATE_CLASS}`}>
                    Next: {formatDate(item.nextCallDate)}
                  </span>
                )}
              </span>

              {item.trackers.length === 0 ? (
                <div className="text-center py-2 text-xs text-gray-400 italic bg-slate-50 rounded border border-dashed border-gray-200">
                  No call records logged yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {item.trackers.map((t, tIdx) => (
                    <div
                      key={t.id || tIdx}
                      className="bg-slate-50 border border-slate-200 rounded p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1 flex-wrap text-[11px]">
                        <span className="font-bold text-indigo-600">#{t.followUpNo || tIdx + 1}</span>
                        <span className="text-gray-500 font-medium">{formatDate(t.timestamp)}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border ${STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {t.status || '-'}
                        </span>
                        {t.callerAssigned && (
                          <span className="text-[10px] text-gray-500 font-medium">By: {t.callerAssigned}</span>
                        )}
                      </div>
                      {t.customerSaid && (
                        <p className="text-gray-700 bg-white p-1.5 rounded border border-gray-100 leading-tight">
                          {t.customerSaid}
                        </p>
                      )}
                      {t.nextDate && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <Clock size={11} />
                          <span>Next: {formatDate(t.nextDate)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Site Visit Follow-Ups Summary */}
            {item.visitorFollowUpCount > 0 && (
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <MapPin size={11} className="text-emerald-600" />
                    Site Visit Follow-ups ({item.visitorFollowUpCount})
                  </span>
                  <button
                    onClick={() => setViewingLead(item)}
                    className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-0.5"
                  >
                    <Eye size={10} /> Full Report
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-700">
                  <span>Status: <strong className="text-emerald-700">{item.siteVisitStatus || '-'}</strong></span>
                  {item.siteVisitDate && <span>Date: {formatDate(item.siteVisitDate)}</span>}
                </div>
                {item.latestVisitorFollowUp?.visitorName && (
                  <p className="text-[11px] text-gray-600">
                    Visitor: <strong className="text-gray-800">{item.latestVisitorFollowUp.visitorName}</strong>
                  </p>
                )}
                {item.latestVisitorFollowUp?.whatHappened && (
                  <p className="text-[11px] text-gray-600 italic bg-white/70 p-1 rounded border border-emerald-100">
                    "{item.latestVisitorFollowUp.whatHappened}"
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-1">
      {/* Header Bar: Row 1 = Lead Category Tabs (Top); Row 2 = Dates & Add Lead; Row 3 = Search & Actions on Mobile / Unified on Desktop */}
      <div className="flex flex-col gap-1.5 w-full flex-shrink-0">
        {/* Row 1: Lead Category Button Tabs (Always Top Row) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap w-full pb-0.5">
          <PageTabs
            tabs={tabs.map(t => ({ ...t, count: categoryCounts[t.key] ?? 0 }))}
            activeKey={activeTab}
            onChange={(key) => { onTabChange(key); setCurrentPage(1); }}
          />
        </div>

        {/* Row 2 on Mobile / Main Controls Bar: Dates & Actions on Left, Search & Filters on Right */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-1.5 w-full">
          {/* Dates & Add Lead Controls */}
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 shrink-0 w-full xl:w-auto pb-0.5">
            {/* Dedicated Tab / Button for Today's Followup */}
            <button
              type="button"
              onClick={() => {
                setDateFilter('today');
                setStageFilter('all');
                setCurrentPage(1);
              }}
              title={`Show Today's Followups — ${dateCounts.todayCalled} of ${dateCounts.today} called today`}
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
                {dateCounts.todayCalled}/{dateCounts.today}
              </span>
            </button>

            {/* Dropdown for All Dates & other date options */}
            <div className="flex-1 min-w-[140px] sm:flex-none sm:w-[170px] shrink-0">
              <SearchableDropdown
                options={allDatesFilterOptions}
                value={dateFilter === 'today' ? 'all' : dateFilter}
                onMainClick={() => {
                  setDateFilter('all');
                  setStageFilter('all');
                  setCustomFrom('');
                  setCustomTo('');
                  setCurrentPage(1);
                }}
                onChange={(val) => {
                  setDateFilter(val);
                  setStageFilter('all');
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
                  dateFilter !== 'today' && !(dateFilter === 'all' && stageFilter !== 'all')
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

            {canEdit && onOpenDirect && (
              <button
                onClick={() => onOpenDirect(activeTab || category)}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 h-[34px] shrink-0 whitespace-nowrap active:scale-95"
              >
                <Plus size={14} className="shrink-0" />
                <span>Add Lead</span>
              </button>
            )}

            {canEdit && onBulkUpload && (
              <button
                onClick={() => onBulkUpload(activeTab || category)}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 h-[34px] shrink-0 whitespace-nowrap active:scale-95"
              >
                <Upload size={14} className="shrink-0" />
                <span>Bulk Upload</span>
              </button>
            )}
          </div>

          {/* Search + Status Dropdown (USER) / Filter Button (ADMIN) + Export + Refresh + Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto scrollbar-hide w-full xl:w-auto xl:flex-1 justify-between sm:justify-end pb-0.5">
          {/* Individual Page Search Input */}
          <div className="relative min-w-[120px] max-w-full sm:max-w-[200px] flex-1 shrink">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder={`Search ${category}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-7 text-xs focus:outline-none focus:border-indigo-500 h-[34px] shadow-xs transition"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Stage buttons (All Dates only): one stage at a time — All Dates shows both stages again */}
          {/* Hidden for admin and for Insurance / Mutual Fund */}
          {dateFilter === 'all' && !isAdmin && category === 'Real Estate' && [
            { key: 'Leads / Calling', icon: Phone },
            { key: 'Site Visit', icon: MapPin }
          ].map(({ key, icon: Icon }) => {
            const active = stageFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStageFilter(key);
                  setCurrentPage(1);
                }}
                title={`All ${key} stage leads till date`}
                className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold h-[34px] transition-all border shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                  active
                    ? (key === 'Site Visit'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300/60 font-bold'
                      : 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300/60 font-bold')
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900 shadow-xs'
                }`}
              >
                <Icon size={13} className={active ? 'text-white' : 'text-gray-400'} />
                <span>{key}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {stageCounts[key]}
                </span>
              </button>
            );
          })}

          {/* New remarks chip: unread admin remarks (users) / new user replies (admin) */}
          {(newRemarkCount > 0 || newRemarksOnly) && (
            <button
              onClick={() => { setNewRemarksOnly(v => !v); setCurrentPage(1); }}
              title={isAdmin ? 'Leads where the user replied to your remark' : 'Leads with a new remark from admin'}
              className={`relative flex items-center justify-center gap-1 px-2.5 rounded-lg text-xs font-semibold h-[34px] transition border shrink-0 whitespace-nowrap active:scale-95 ${newRemarksOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                }`}
            >
              <Bell size={13} className={newRemarksOnly ? '' : 'animate-bounce'} />
              <span className="hidden sm:inline">{isAdmin ? 'New Replies' : 'New Remarks'}</span>
              <span className={`text-[10px] font-bold px-1.5 rounded-full ${newRemarksOnly ? 'bg-white/25' : 'bg-amber-500 text-white'}`}>{newRemarkCount}</span>
            </button>
          )}

          {/* FOR USER ROLE: All Status Dropdown */}
          {!isAdmin && (
            <div className="w-[125px] sm:w-[145px] shrink-0">
              <SearchableDropdown
                options={statusFilterOptions}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                placeholder="All Status"
                height="h-[34px]"
              />
            </div>
          )}

          {/* Export to Excel (ADMIN / Tester only) */}
          {isAdmin && (
            <button
              onClick={handleExportExcel}
              title="Export to Excel"
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold h-[34px] transition shrink-0 whitespace-nowrap active:scale-95"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Clear Filters (visible when any filter or search query is active) */}
          {(activeFilterCount > 0 || searchQuery) && (
            <button
              onClick={handleClearFilters}
              title="Clear all filters & search"
              className="flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg h-[34px] px-2.5 sm:px-3 text-xs font-semibold transition gap-1 shrink-0 whitespace-nowrap active:scale-95"
            >
              <RotateCcw size={13} />
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>

      {/* Filter Bar (always visible for ADMIN) */}
      {isAdmin && (
        <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0 mr-1">
            Filter Options:
          </span>

          {/* Status Dropdown */}
          <div className="w-[130px] lg:w-[150px]">
            <SearchableDropdown
              options={statusFilterOptions}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              placeholder="All Status"
              height="h-[30px]"
            />
          </div>

          {/* Date Filter Dropdown */}
          <div className="w-[130px] lg:w-[150px]">
            <SearchableDropdown
              options={dateFilterOptions}
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val);
                setStageFilter('all');
                if (val === 'custom' && !customFrom && !customTo) {
                  const t = getTodayStr();
                  setCustomFrom(t);
                  setCustomTo(t);
                }
                setCurrentPage(1);
              }}
              placeholder="All Dates"
              height="h-[30px]"
            />
          </div>

          {/* Custom Date Range Inline Inputs */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-1 bg-white border border-gray-300 focus-within:border-indigo-500 rounded px-2 h-[30px] shadow-2xs">
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
              <div className="flex items-center gap-1 bg-white border border-gray-300 focus-within:border-indigo-500 rounded px-2 h-[30px] shadow-2xs">
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

          {/* Caller Dropdown (if admin or multiple callers) */}
          {callerOptions.length > 2 && (
            <div className="w-[130px] lg:w-[150px]">
              <SearchableDropdown
                options={callerOptions}
                value={callerFilter}
                onChange={(val) => {
                  setCallerFilter(val);
                  setCurrentPage(1);
                }}
                placeholder="All Callers"
                height="h-[30px]"
              />
            </div>
          )}

          {/* Quick Clear Filters Link */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline ml-auto cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Main Full-Height Compact Table View */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-semibold tracking-wide uppercase">Loading {category} Calls...</p>
          </div>
        ) : sortedLeads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-4 space-y-3">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-200">
              <Phone size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">No {category} Calls Found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                No follow-up calls match your current filter criteria or are assigned for this category.
              </p>
            </div>
            {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || callerFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-100 transition"
              >
                Clear All Filters
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
              totalItems={sortedLeads.length}
              totalResults={sortedLeads.length}
              minWidth="1100px"
              viewMode="auto"
              cardsGridClassName="grid grid-cols-1 gap-2.5 p-2 sm:p-3"
            />
          </div>
        )}
      </div>

      {/* Pop-up "Followup" Modal */}
      <FormTracker
        isOpen={!!callingLead}
        onClose={() => setCallingLead(null)}
        lead={callingLead}
        onSaved={handleCallSaved}
      />

      {/* Lead remark thread: admin remark ↔ user reply */}
      <RemarkThreadModal
        isOpen={!!remarkLead}
        onClose={() => setRemarkLead(null)}
        lead={remarkLead}
        isAdmin={isAdmin}
        onSaved={(leadId, updated) => {
          setRemarkOverrides(prev => ({ ...prev, [String(leadId)]: { ...(prev[String(leadId)] || {}), ...updated } }));
          onRefresh?.();
        }}
      />

      {/* Pop-up "View" Modal */}
      <CallTrackerViewModal
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        lead={viewingLead}
        onRemarkSaved={onRefresh}
        onFollowup={(lead) => {
          setViewingLead(null);
          setCallingLead(lead);
        }}
      />
    </div>
  );
}
