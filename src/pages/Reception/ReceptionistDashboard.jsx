import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  UserCheck, Users, Clock, Briefcase, MapPin, CheckCircle2,
  LogOut, UserPlus, RefreshCw, Eye, Phone, Building2,
  Calendar, ChevronRight, ChevronLeft, TrendingUp, RotateCcw,
  Pencil, Search, X, FileSpreadsheet, AlertCircle,
  LayoutGrid, Table, ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList
} from 'recharts';
import NewVisitorModal from './NewVisitorModal';
import VisitorDetailsModal from './VisitorDetailsModal';
import EditVisitorModal from './EditVisitorModal';
import { visitorApi } from '../../api/visitorApi';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, isUserAdmin } from '../../utils/authUtils';
import {
  VISITOR_STATUS_MAP,
  PURPOSE_STYLES,
  VISIT_PURPOSE_OPTIONS,
  formatVisitorDate,
  formatVisitorTime,
  getVisitDuration
} from './receptionConstants';

// Helper: Check if an ISO date string is today in local time
const isDateToday = (dateVal) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

// Helper: Check if a date falls on yesterday in local time
const isDateYesterday = (dateVal) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
};

// Helper: Format YYYY-MM-DD from Date in local time
const getLocalDateKey = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Helper: Check if a timestamp falls within the selected date range
const isTimestampInDateRange = (dateVal, filterType, customFrom, customTo, specificDate) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;

  if (filterType === 'all') return true;

  if (filterType === 'today') {
    return isDateToday(d);
  }

  if (filterType === 'yesterday') {
    return isDateYesterday(d);
  }

  if (filterType === 'single' || filterType === 'specific') {
    if (!specificDate) return true;
    return getLocalDateKey(d) === specificDate;
  }

  if (filterType === 'range' || filterType === 'custom') {
    if (!customFrom && !customTo) return true;
    const time = d.getTime();
    if (customFrom) {
      const fromMs = new Date(customFrom + 'T00:00:00').getTime();
      if (!isNaN(fromMs) && time < fromMs) return false;
    }
    if (customTo) {
      const toMs = new Date(customTo + 'T23:59:59.999').getTime();
      if (!isNaN(toMs) && time > toMs) return false;
    }
    return true;
  }

  return true;
};

// Clean phone digits for tel/whatsapp links
const cleanPhone = (num) => String(num || '').replace(/[^0-9]/g, '');

// Avatar initials helper
const getInitials = (name) => {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';
};

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-purple-100 text-purple-700 border-purple-200'
];

const getAvatarColor = (name) => {
  const str = String(name || '?');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export default function ReceptionistDashboard() {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);
  const canEdit = hasFullAccess(user, 'reception') || hasFullAccess(user, 'receptionDashboard') || isAdmin;

  // Raw data from API
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'yesterday' | 'specific' | 'range' | 'all'
  const [specificDate, setSpecificDate] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  // View Mode: 'columns' (Dashboard 4-column cards) vs 'table' (Full tabular register)
  const [viewMode, setViewMode] = useState('columns');

  // Pagination states for table view
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [detailsVisitor, setDetailsVisitor] = useState(null);
  const [editVisitor, setEditVisitor] = useState(null);

  // Daily Trends Graph Range
  const [trendRange, setTrendRange] = useState('7'); // '7', '14', '30', 'month'

  // Fetch all visitor records
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await visitorApi.getVisitorLogs();
      setVisitors(data || []);
    } catch (err) {
      console.error('Failed to load visitors:', err);
      setError('Could not load visitor logs. Please try again.');
      toast.error('Could not load visitor logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Formatted string for today's date in header
  const todayDateStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // 1. KPI Counts Calculation
  const kpiCounts = useMemo(() => {
    let totalVisitors = 0;
    let meetings = 0;
    let siteVisits = 0;
    let officeCount = 0;
    let siteCount = 0;

    (visitors || []).forEach((v) => {
      if (v.status === 'CANCELLED') return;

      const checkInMatches = isTimestampInDateRange(v.checkInAt, dateFilter, customFrom, customTo, specificDate);
      if (checkInMatches) {
        totalVisitors++;
        if (v.visitPurpose === 'Meeting') meetings++;
        if (v.visitPurpose === 'Site Visit') siteVisits++;
        if (v.visitLocation === 'Construction Site') siteCount++;
        else officeCount++;
      }
    });

    return {
      totalVisitors,
      meetings,
      siteVisits,
      officeCount,
      siteCount,
      allTimeTotal: (visitors || []).length
    };
  }, [visitors, dateFilter, customFrom, customTo, specificDate]);

  // 2. Numeric Breakdown by Purpose & Location for the Selected Date Filter
  const dateFilteredStats = useMemo(() => {
    const purposeCounts = {
      Meeting: 0,
      'Site Visit': 0,
      'Supply Item': 0,
      Broking: 0,
      Other: 0
    };

    const locationCounts = {
      Office: 0,
      'Construction Site': 0
    };

    let total = 0;

    (visitors || []).forEach((v) => {
      if (v.status === 'CANCELLED') return;
      if (!isTimestampInDateRange(v.checkInAt, dateFilter, customFrom, customTo, specificDate)) return;

      total++;
      const p = v.visitPurpose || 'Other';
      if (purposeCounts[p] !== undefined) {
        purposeCounts[p]++;
      } else {
        purposeCounts.Other++;
      }

      const loc = v.visitLocation === 'Construction Site' ? 'Construction Site' : 'Office';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    return { purposeCounts, locationCounts, total };
  }, [visitors, dateFilter, customFrom, customTo, specificDate]);

  // 3. Filtered Visitors List (Filtered by Date, Status, Purpose, Location, and Search)
  const filteredVisitors = useMemo(() => {
    let list = visitors || [];

    // Date Filter
    list = list.filter((v) => isTimestampInDateRange(v.checkInAt, dateFilter, customFrom, customTo, specificDate));

    // Status Filter
    if (statusFilter !== 'all') {
      list = list.filter((v) => v.status === statusFilter);
    }

    // Purpose Filter
    if (purposeFilter !== 'all') {
      list = list.filter((v) => v.visitPurpose === purposeFilter || v.visitPurpose?.startsWith(purposeFilter + ' ('));
    }

    // Location Filter
    if (locationFilter !== 'all') {
      list = list.filter((v) => v.visitLocation === locationFilter);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((v) => {
        const nameMatch = v.visitorName && v.visitorName.toLowerCase().includes(q);
        const phoneMatch = v.mobileNumber && v.mobileNumber.includes(q);
        const compMatch = v.companyName && v.companyName.toLowerCase().includes(q);
        const hostMatch = v.personToMeetName && v.personToMeetName.toLowerCase().includes(q);
        const actualHostMatch = v.personActuallyMetName && v.personActuallyMetName.toLowerCase().includes(q);
        const projectMatch = v.projectName && v.projectName.toLowerCase().includes(q);
        const remarksMatch = v.remarks && v.remarks.toLowerCase().includes(q);
        return nameMatch || phoneMatch || compMatch || hostMatch || actualHostMatch || projectMatch || remarksMatch;
      });
    }

    return list;
  }, [visitors, dateFilter, customFrom, customTo, specificDate, statusFilter, purposeFilter, locationFilter, searchQuery]);

  // 4. Grouped Visitors for the 4 Dashboard Columns
  const columnData = useMemo(() => {
    // Column 1: All Registered Visitors
    const allList = filteredVisitors;

    // Column 2: Meetings (from filteredVisitors)
    const meetingsList = filteredVisitors.filter((v) => v.visitPurpose === 'Meeting');

    // Column 3: Site Visits & Construction (from filteredVisitors)
    const siteVisitsList = filteredVisitors.filter(
      (v) => v.visitPurpose === 'Site Visit' || v.visitLocation === 'Construction Site'
    );

    // Column 4: Supply, Broking & Other
    const otherList = filteredVisitors.filter(
      (v) => v.visitPurpose !== 'Meeting' && v.visitPurpose !== 'Site Visit' && v.visitLocation !== 'Construction Site'
    );

    return {
      allList,
      meetingsList,
      siteVisitsList,
      otherList
    };
  }, [filteredVisitors]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, specificDate, customFrom, customTo, statusFilter, purposeFilter, locationFilter, searchQuery, pageSize]);

  // Table pagination
  const totalRecords = filteredVisitors.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedVisitors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVisitors.slice(start, start + pageSize);
  }, [filteredVisitors, currentPage, pageSize]);

  // Active filters count
  const activeFiltersCount =
    (dateFilter !== 'today' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (purposeFilter !== 'all' ? 1 : 0) +
    (locationFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  // Clear / Reset All Filters
  const handleResetFilters = () => {
    setDateFilter('today');
    setSpecificDate('');
    setCustomFrom('');
    setCustomTo('');
    setSearchQuery('');
    setStatusFilter('all');
    setPurposeFilter('all');
    setLocationFilter('all');
    setCurrentPage(1);
    toast.success('Filters reset to Today');
  };

  // Date Filter Change Handler: automatically resets other filters (Purpose, Location, Status, Search)
  const handleDateFilterSelect = (mode) => {
    setDateFilter(mode);
    setPurposeFilter('all');
    setLocationFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);

    if (mode === 'single') {
      if (!specificDate) {
        setSpecificDate(getLocalDateKey(new Date()));
      }
    }
  };

  const handleSpecificDateChange = (val) => {
    setSpecificDate(val);
    setPurposeFilter('all');
    setLocationFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleCustomRangeChange = (field, val) => {
    if (field === 'from') setCustomFrom(val);
    if (field === 'to') setCustomTo(val);
    setPurposeFilter('all');
    setLocationFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // KPI Card Click Handler
  const handleKpiCardClick = (cardType) => {
    setCurrentPage(1);
    switch (cardType) {
      case 'total':
        setPurposeFilter('all');
        setLocationFilter('all');
        setStatusFilter('all');
        break;
      case 'office':
        setLocationFilter('Office');
        setPurposeFilter('all');
        setStatusFilter('all');
        break;
      case 'constructionSites':
        setLocationFilter('Construction Site');
        setPurposeFilter('all');
        setStatusFilter('all');
        break;
      case 'meetings':
        setPurposeFilter('Meeting');
        setLocationFilter('all');
        setStatusFilter('all');
        break;
      case 'siteVisits':
        setPurposeFilter('Site Visit');
        setLocationFilter('all');
        setStatusFilter('all');
        break;
      case 'all':
        setDateFilter('all');
        setLocationFilter('all');
        setPurposeFilter('all');
        setStatusFilter('all');
        break;
      default:
        break;
    }
  };

  // Quick Action: WhatsApp
  const handleWhatsApp = (item, e) => {
    e?.stopPropagation?.();
    const phone = cleanPhone(item.mobileNumber);
    if (!phone) return;
    const phoneWithCountry = phone.startsWith('91') ? phone : `91${phone}`;
    const msg = encodeURIComponent(`Hello ${item.visitorName}, thank you for visiting Sarvodaya Infracon.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank');
  };

  // Quick Action: Call
  const handleCall = (item, e) => {
    e?.stopPropagation?.();
    const phone = cleanPhone(item.mobileNumber);
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  // New Visitor Registration Handler
  const handleCreateVisitor = async (payload) => {
    try {
      await visitorApi.registerVisitor(payload, user);
      toast.success('Visitor registered successfully');
      await loadData();
    } catch (err) {
      console.error('Failed to register visitor:', err);
      toast.error('Failed to register visitor');
      throw err;
    }
  };

  // Edit Visitor Handler
  const handleSaveEdit = async (visitorId, updates) => {
    try {
      await visitorApi.updateVisitor(visitorId, updates);
      await loadData();
    } catch (err) {
      console.error('Failed to update visitor:', err);
      throw err;
    }
  };

  // Export Filtered Table Data to Excel
  const handleExportExcel = () => {
    if (!filteredVisitors || filteredVisitors.length === 0) {
      toast.error('No visitor records to export');
      return;
    }

    const exportData = filteredVisitors.map((item, idx) => ({
      'SR No': idx + 1,
      'Visitor Name': item.visitorName || '—',
      'Contact Number': item.mobileNumber || '—',
      'Company / Org': item.companyName || '—',
      'Visitor Type': item.visitorType || '—',
      'Visit Purpose': item.visitPurpose || '—',
      'Office / Construction Site': item.visitLocation || 'Office',
      'Project Name': item.projectName || '—',
      'Person to Meet': item.personToMeetName || '—',
      'Department': item.department || '—',
      'Actual Person Met': item.personActuallyMetName || item.personToMeetName || '—',
      'Visit Date': formatVisitorDate(item.checkInAt),
      'Arrival Time': formatVisitorTime(item.checkInAt),
      'Status': item.status === 'CANCELLED' ? 'Cancelled' : 'Registered',
      'Registered By': item.checkedInBy || '—',
      'Remarks': item.remarks || '—'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitor Register');
    const filename = `Visitor_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success('Visitor register exported to Excel');
  };

  // Daily Visitor Trends Graph Data
  const { trendChartData, totalTrendVisits, avgTrendVisits, rangeLabelText } = useMemo(() => {
    const days = [];
    const countsByDate = {};
    const now = new Date();

    let dayCount = 7;
    let label = 'Last 7 Days';
    if (trendRange === '14') {
      dayCount = 14;
      label = 'Last 14 Days';
    } else if (trendRange === '30') {
      dayCount = 30;
      label = 'Last 30 Days';
    } else if (trendRange === 'month') {
      dayCount = Math.max(1, now.getDate());
      label = 'This Month';
    }

    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = getLocalDateKey(d);
      const isToday = i === 0;
      const shortLabel = `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
      const fullDate = d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      days.push({
        dateKey: key,
        shortLabel,
        displayLabel: isToday ? `Today (${shortLabel})` : shortLabel,
        fullDate,
        visitors: 0,
        isToday
      });
      if (key) countsByDate[key] = 0;
    }

    (visitors || []).forEach((v) => {
      if (v.status === 'CANCELLED') return;
      if (!v.checkInAt) return;
      const key = getLocalDateKey(v.checkInAt);
      if (key && countsByDate[key] !== undefined) {
        countsByDate[key]++;
      }
    });

    const data = days.map((d) => ({
      ...d,
      visitors: countsByDate[d.dateKey] || 0
    }));

    const total = data.reduce((acc, curr) => acc + curr.visitors, 0);
    const avg = days.length > 0 ? (total / days.length).toFixed(1) : '0';

    return {
      trendChartData: data,
      totalTrendVisits: total,
      avgTrendVisits: avg,
      rangeLabelText: label
    };
  }, [visitors, trendRange]);

  const CustomTrendTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-slate-700">
          <p className="font-semibold text-slate-200">
            {item.fullDate} {item.isToday ? '(Today)' : ''}
          </p>
          <p className="text-emerald-400 font-bold text-sm mt-0.5">
            {item.visitors} {item.visitors === 1 ? 'visitor' : 'visitors'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Reusable Column Visitor Card Item
  const renderVisitorCardItem = (item) => {
    return (
      <div
        key={item.id}
        onClick={() => setDetailsVisitor(item)}
        className="p-3 bg-white hover:bg-slate-50 transition border border-gray-100 rounded-xl flex flex-col gap-2 cursor-pointer shadow-2xs group"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(item.visitorName)}`}>
              {getInitials(item.visitorName)}
            </span>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-indigo-600 transition">
                {item.visitorName || 'Visitor'}
              </h4>
              <p className="text-[10px] text-gray-500 truncate">
                {item.companyName ? `${item.companyName} • ` : ''}{item.visitorType || 'Guest'}
              </p>
            </div>
          </div>

          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200 shrink-0">
            {formatVisitorDate(item.checkInAt)}
          </span>
        </div>

        {/* Details snippet */}
        <div className="text-[11px] text-gray-600 space-y-1 bg-gray-50/70 p-2 rounded-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px]">Host:</span>
            <span className="font-semibold text-gray-800 truncate max-w-[150px]">
              {item.personToMeetName || '—'}
            </span>
          </div>
          {item.projectName && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[10px]">Project:</span>
              <span className="font-semibold text-amber-800 truncate max-w-[150px]">
                {item.projectName}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px]">Location:</span>
            <span className="text-gray-700 flex items-center gap-1">
              <MapPin size={10} className={item.visitLocation === 'Construction Site' ? 'text-amber-500' : 'text-indigo-500'} />
              {item.visitLocation === 'Construction Site' ? 'Construction Site' : 'Office'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-0.5 border-t border-gray-200/50">
            <span className="text-gray-400 text-[10px]">Arrival:</span>
            <span className="text-indigo-700 font-bold text-[10px] flex items-center gap-0.5">
              <Clock size={10} />
              {formatVisitorTime(item.checkInAt)}
            </span>
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => handleCall(item, e)}
              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-600 flex items-center justify-center transition"
              title="Call"
            >
              <Phone size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => handleWhatsApp(item, e)}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition"
              title="WhatsApp"
            >
              WA
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDetailsVisitor(item)}
              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-slate-700 hover:text-white text-gray-600 flex items-center justify-center transition cursor-pointer"
              title="View Details"
            >
              <Eye size={11} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/70 p-2.5 sm:p-4 gap-3 sm:gap-4 overflow-y-auto">

      {/* 1. Header Banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Reception Dashboard
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Visitor Management
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500">
              Live visitor monitoring, quick check-in & check-out, and unified visitor register.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Today's Date Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700">
            <Calendar size={13} className="text-gray-500" />
            <span>{todayDateStr}</span>
          </div>

          {/* Export to Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            title="Export filtered records to Excel"
            className="inline-flex items-center gap-1.5 px-3 h-[36px] bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh records"
            aria-label="Refresh"
            className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[36px] w-[36px] transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* + New Visitor Primary Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 h-[36px] bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ New Visitor</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Global Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          
          {/* Date Range Mode Segmented Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">
              Period:
            </span>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => handleDateFilterSelect('today')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  dateFilter === 'today'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDateFilterSelect('yesterday')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  dateFilter === 'yesterday'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleDateFilterSelect('single')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  dateFilter === 'single' || dateFilter === 'specific'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                }`}
              >
                Single Date
              </button>
              <button
                type="button"
                onClick={() => handleDateFilterSelect('range')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  dateFilter === 'range' || dateFilter === 'custom'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                }`}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => handleDateFilterSelect('all')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                }`}
              >
                All Dates
              </button>
            </div>

            {/* Inline Single Date Picker */}
            {(dateFilter === 'single' || dateFilter === 'specific') && (
              <div className="flex items-center gap-1.5 bg-indigo-50/60 px-2.5 py-1 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-semibold text-indigo-900">Date:</span>
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => handleSpecificDateChange(e.target.value)}
                  className="text-xs h-[28px] px-2 bg-white border border-gray-200 rounded-md text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
                {specificDate && (
                  <button
                    type="button"
                    onClick={() => handleSpecificDateChange('')}
                    className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
                    title="Clear date"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Inline Date Range Inputs */}
            {(dateFilter === 'range' || dateFilter === 'custom') && (
              <div className="flex items-center gap-1.5 flex-wrap bg-indigo-50/60 px-2.5 py-1 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-semibold text-indigo-900">From:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => handleCustomRangeChange('from', e.target.value)}
                  className="text-xs h-[28px] px-2 bg-white border border-gray-200 rounded-md text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-indigo-900">To:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => handleCustomRangeChange('to', e.target.value)}
                  className="text-xs h-[28px] px-2 bg-white border border-gray-200 rounded-md text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
                {(customFrom || customTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFrom('');
                      setCustomTo('');
                      setPurposeFilter('all');
                      setLocationFilter('all');
                      setStatusFilter('all');
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
                    title="Clear date range"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Reset Filters Action */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset Filters ({activeFiltersCount})</span>
            </button>
          )}

        </div>

        {/* Filter Controls Row (Purpose, Location) */}
        <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100 flex-wrap">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">
            Filter:
          </span>

          {/* Purpose Filter */}
          <div className="w-48 sm:w-56">
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="w-full text-xs h-[32px] px-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer shadow-2xs"
            >
              <option value="all">All Purposes</option>
              {VISIT_PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="w-48 sm:w-56">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full text-xs h-[32px] px-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer shadow-2xs"
            >
              <option value="all">All Locations</option>
              <option value="Office">Corporate Office</option>
              <option value="Construction Site">Construction Site</option>
            </select>
          </div>

        </div>
      </div>

      {/* 3. Simple KPI Cards (Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">

        {/* 1. Total Visitors */}
        <div
          onClick={() => handleKpiCardClick('total')}
          className="p-3 bg-white hover:bg-indigo-50/50 border border-gray-200 hover:border-indigo-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group"
          title="Click to view all visitor records"
        >
          <div className="flex items-center justify-between text-gray-600 group-hover:text-indigo-600 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Total Visitors
            </span>
            <Users size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 group-hover:text-indigo-950 transition">
              {kpiCounts.totalVisitors}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-indigo-600 flex items-center gap-0.5">
              <span>View</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium truncate">
            {dateFilter === 'today'
              ? 'Today’s registrations'
              : dateFilter === 'yesterday'
              ? 'Yesterday’s registrations'
              : (dateFilter === 'single' || dateFilter === 'specific')
              ? (specificDate ? `Date: ${specificDate}` : 'Single date')
              : dateFilter === 'all'
              ? 'All dates'
              : 'Selected range'}
          </span>
        </div>

        {/* 2. Corporate Office Visits */}
        <div
          onClick={() => handleKpiCardClick('office')}
          className={`p-3 bg-white hover:bg-blue-50/50 border rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group ${
            locationFilter === 'Office' ? 'border-blue-500 ring-1 ring-blue-500/30 bg-blue-50/20' : 'border-gray-200 hover:border-blue-300'
          }`}
          title="Click to filter Corporate Office visitors"
        >
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} />
              Corporate Office
            </span>
            <Building2 size={14} className="group-hover:scale-110 transition text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-blue-950">
              {kpiCounts.officeCount}
            </span>
            <span className="text-[10px] font-bold text-blue-700 flex items-center gap-0.5">
              <span>Filter</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-blue-700/80 mt-1 font-medium truncate">
            HQ office visits
          </span>
        </div>

        {/* 3. Construction Site Visits */}
        <div
          onClick={() => handleKpiCardClick('constructionSites')}
          className={`p-3 bg-white hover:bg-amber-50/50 border rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group ${
            locationFilter === 'Construction Site' ? 'border-amber-500 ring-1 ring-amber-500/30 bg-amber-50/20' : 'border-gray-200 hover:border-amber-300'
          }`}
          title="Click to filter Construction Site visits"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={13} />
              Site Visits
            </span>
            <MapPin size={14} className="group-hover:scale-110 transition text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-amber-950">
              {kpiCounts.siteCount}
            </span>
            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
              <span>Filter</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-amber-700/80 mt-1 font-medium truncate">
            Projects & sites
          </span>
        </div>

        {/* 4. Meetings */}
        <div
          onClick={() => handleKpiCardClick('meetings')}
          className={`p-3 bg-white hover:bg-violet-50/50 border rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group ${
            purposeFilter === 'Meeting' ? 'border-violet-500 ring-1 ring-violet-500/30 bg-violet-50/20' : 'border-gray-200 hover:border-violet-300'
          }`}
          title="Click to filter meeting visits"
        >
          <div className="flex items-center justify-between text-gray-600 group-hover:text-violet-600 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Meetings
            </span>
            <Briefcase size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 group-hover:text-violet-950 transition">
              {kpiCounts.meetings}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-violet-600 flex items-center gap-0.5">
              <span>Filter</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium truncate">
            Host meetings
          </span>
        </div>

        {/* 5. Purpose: Site Visits */}
        <div
          onClick={() => handleKpiCardClick('siteVisits')}
          className={`p-3 bg-white hover:bg-emerald-50/50 border rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group ${
            purposeFilter === 'Site Visit' ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-50/20' : 'border-gray-200 hover:border-emerald-300'
          }`}
          title="Click to filter site visits purpose"
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              Site Walkthroughs
            </span>
            <CheckCircle2 size={14} className="group-hover:scale-110 transition text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-emerald-950">
              {kpiCounts.siteVisits}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
              <span>Filter</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-emerald-700/80 mt-1 font-medium truncate">
            Walkthroughs
          </span>
        </div>

        {/* 6. All Time Total */}
        <div
          onClick={() => handleKpiCardClick('all')}
          className="p-3 bg-white hover:bg-slate-100/60 border border-gray-200 hover:border-slate-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group"
          title="Click to show all registered visitors across all dates"
        >
          <div className="flex items-center justify-between text-gray-600 group-hover:text-slate-700 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
              All-Time Total
            </span>
            <UserCheck size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 group-hover:text-slate-950 transition">
              {kpiCounts.allTimeTotal}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-slate-600 flex items-center gap-0.5">
              <span>All Dates</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium truncate">
            Total entries recorded
          </span>
        </div>

      </div>

      {/* 4. Analytics Row: Trends Graph & Numeric Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Daily Visitor Trends Graph */}
        <div className="lg:col-span-2 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <TrendingUp size={14} />
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Daily Visitor Trends
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {rangeLabelText}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Visitor registration counts per calendar day.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/70 border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-600">Total Visits</span>
                <span className="font-extrabold text-indigo-950">{totalTrendVisits}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500">Daily Avg</span>
                <span className="font-extrabold text-gray-800">{avgTrendVisits}</span>
              </div>
            </div>
          </div>

          {/* Time Range Pills */}
          <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/80 text-xs self-start">
            {[
              { id: '7', label: 'Last 7 Days' },
              { id: '14', label: 'Last 14 Days' },
              { id: '30', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTrendRange(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  trendRange === tab.id
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Chart Area */}
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendChartData}
                margin={{ top: 16, right: 12, left: -22, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="shortLabel"
                  interval={trendChartData.length > 20 ? 3 : (trendChartData.length > 10 ? 1 : 0)}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTrendTooltip />}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                />
                <Bar
                  dataKey="visitors"
                  name="Visitors"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={trendChartData.length > 14 ? 26 : 40}
                >
                  {trendChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isToday ? '#4f46e5' : '#818cf8'}
                      className="transition-opacity hover:opacity-85"
                    />
                  ))}
                  <LabelList
                    dataKey="visitors"
                    position="top"
                    formatter={(val) => (val > 0 ? val : (trendChartData.length <= 7 ? 0 : ''))}
                    style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Small Numeric Summaries for Purpose & Location */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between gap-3">
          
          {/* Visits by Purpose */}
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <Briefcase size={14} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-gray-900">
                  Visits by Purpose
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {dateFilteredStats.total} total
              </span>
            </div>

            <div className="mt-2 space-y-1.5">
              {[
                { key: 'Meeting', label: 'Meeting', count: dateFilteredStats.purposeCounts?.Meeting || 0, color: 'bg-indigo-500' },
                { key: 'Site Visit', label: 'Site Visit', count: dateFilteredStats.purposeCounts?.['Site Visit'] || 0, color: 'bg-amber-500' },
                { key: 'Supply Item', label: 'Supply Item', count: dateFilteredStats.purposeCounts?.['Supply Item'] || 0, color: 'bg-cyan-500' },
                { key: 'Broking', label: 'Broking', count: dateFilteredStats.purposeCounts?.Broking || 0, color: 'bg-purple-500' },
                { key: 'Other', label: 'Other', count: dateFilteredStats.purposeCounts?.Other || 0, color: 'bg-gray-400' }
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={() => {
                    setPurposeFilter(item.key);
                    setStatusFilter('all');
                  }}
                  className={`flex items-center justify-between px-2.5 py-1 rounded-lg border transition cursor-pointer group ${
                    purposeFilter === item.key
                      ? 'bg-indigo-50 border-indigo-300 font-bold'
                      : 'bg-gray-50/70 hover:bg-gray-100 border-gray-100'
                  }`}
                  title={`Filter by ${item.label}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-xs font-medium text-gray-800 group-hover:text-indigo-600 transition">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-gray-900 group-hover:text-indigo-600 transition">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Visits by Location */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-gray-900">
                  Visits by Location
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => {
                  setLocationFilter('Office');
                  setStatusFilter('all');
                }}
                className={`p-2 rounded-lg border transition cursor-pointer flex flex-col justify-between ${
                  locationFilter === 'Office'
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-gray-50/80 hover:bg-gray-100 border-gray-100'
                }`}
                title="Filter Corporate Office"
              >
                <span className="text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                  <Building2 size={11} />
                  Office
                </span>
                <span className="text-lg font-black text-gray-900 mt-1">
                  {dateFilteredStats.locationCounts?.Office || 0}
                </span>
              </div>

              <div
                onClick={() => {
                  setLocationFilter('Construction Site');
                  setStatusFilter('all');
                }}
                className={`p-2 rounded-lg border transition cursor-pointer flex flex-col justify-between ${
                  locationFilter === 'Construction Site'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-gray-50/80 hover:bg-gray-100 border-gray-100'
                }`}
                title="Filter Construction Site"
              >
                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  <MapPin size={11} />
                  Sites
                </span>
                <span className="text-lg font-black text-gray-900 mt-1">
                  {dateFilteredStats.locationCounts?.['Construction Site'] || 0}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 5. Primary Visitor Data Section: Columns View (Normal Dashboard) OR Table View */}
      <div className="flex flex-col gap-3">
        
        {/* Section Header with Search Bar and View Mode Switcher */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Visitor Records</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {filteredVisitors.length} matches
              </span>
            </h2>
            <p className="text-[11px] text-gray-500">
              {viewMode === 'columns'
                ? 'Multi-column dashboard feeds organized by visitor category.'
                : 'Detailed tabular visitor register with full column details.'}
            </p>
          </div>

          {/* Search Bar shifted into Visitor Records panel bar */}
          <div className="relative flex-1 max-w-md min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor, phone, company, host, project..."
              className="w-full text-xs h-[34px] pl-8 pr-7 bg-white border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Toggle between Columns View and Table View */}
          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('columns')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'columns'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Columns View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
              }`}
            >
              <Table size={13} />
              <span>Table View</span>
            </button>
          </div>
        </div>

        {/* View Mode 1: Multi-Column Dashboard (Standard CRM Dashboard Design) */}
        {viewMode === 'columns' && (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3 items-start">
            
            {/* Column 1: Registered Visitor Entries */}
            <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100 bg-indigo-50/30">
                <div className="flex items-center gap-2">
                  <UserCheck size={15} className="text-indigo-600" />
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                    All Entries
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {columnData.allList.length}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">
                  Visitor Log
                </span>
              </div>

              <div className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                    <RefreshCw size={18} className="animate-spin text-indigo-600 mb-1.5" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : columnData.allList.length === 0 ? (
                  <div className="py-12 px-3 text-center text-gray-400">
                    <UserCheck size={24} className="mx-auto text-gray-300 mb-1" />
                    <p className="text-xs font-semibold text-gray-600">No visitors recorded</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Click + New Visitor to register entries</p>
                  </div>
                ) : (
                  columnData.allList.map((v) => renderVisitorCardItem(v))
                )}
              </div>
            </div>

            {/* Column 2: Meetings */}
            <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100 bg-violet-50/30">
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-violet-600" />
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                    Meetings
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-violet-100 text-violet-800 border border-violet-200">
                    {columnData.meetingsList.length}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider">
                  Host Visits
                </span>
              </div>

              <div className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                    <RefreshCw size={18} className="animate-spin text-indigo-600 mb-1.5" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : columnData.meetingsList.length === 0 ? (
                  <div className="py-12 px-3 text-center text-gray-400">
                    <Briefcase size={24} className="mx-auto text-gray-300 mb-1" />
                    <p className="text-xs font-semibold text-gray-600">No meeting records</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">No meetings for current filters</p>
                  </div>
                ) : (
                  columnData.meetingsList.map((v) => renderVisitorCardItem(v))
                )}
              </div>
            </div>

            {/* Column 3: Site Visits */}
            <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100 bg-amber-50/30">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-amber-600" />
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                    Site Visits
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                    {columnData.siteVisitsList.length}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
                  Construction Sites
                </span>
              </div>

              <div className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                    <RefreshCw size={18} className="animate-spin text-indigo-600 mb-1.5" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : columnData.siteVisitsList.length === 0 ? (
                  <div className="py-12 px-3 text-center text-gray-400">
                    <MapPin size={24} className="mx-auto text-gray-300 mb-1" />
                    <p className="text-xs font-semibold text-gray-600">No site visits</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">No site visits for current filters</p>
                  </div>
                ) : (
                  columnData.siteVisitsList.map((v) => renderVisitorCardItem(v))
                )}
              </div>
            </div>

            {/* Column 4: General & Supply */}
            <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100 bg-slate-100/60">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-600" />
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                    General & Supply
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 border border-slate-300">
                    {columnData.otherList.length}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Other Visits
                </span>
              </div>

              <div className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                    <RefreshCw size={18} className="animate-spin text-indigo-600 mb-1.5" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : columnData.otherList.length === 0 ? (
                  <div className="py-12 px-3 text-center text-gray-400">
                    <Users size={24} className="mx-auto text-gray-300 mb-1" />
                    <p className="text-xs font-semibold text-gray-600">No other inquiries</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Supply, broking, or general entries</p>
                  </div>
                ) : (
                  columnData.otherList.map((v) => renderVisitorCardItem(v))
                )}
              </div>
            </div>

          </div>
        )}

        {/* View Mode 2: Full Tabular Register */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs flex flex-col overflow-hidden">
            <div className="w-full overflow-x-auto min-h-[300px]">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400">
                  <RefreshCw size={24} className="animate-spin text-indigo-600 mb-2" />
                  <p className="text-xs">Loading visitor register...</p>
                </div>
              ) : error ? (
                <div className="py-16 px-4 flex flex-col items-center justify-center text-center text-rose-600">
                  <AlertCircle size={24} className="mb-2" />
                  <p className="text-xs font-semibold">{error}</p>
                  <button
                    type="button"
                    onClick={loadData}
                    className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : paginatedVisitors.length === 0 ? (
                <div className="py-16 px-4 flex flex-col items-center justify-center text-center text-gray-500">
                  <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mb-2 border border-gray-200">
                    <Users size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">No visitor records found</h4>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-sm">
                    No records match your selected filters. Try broadening your date range or clearing search criteria.
                  </p>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>Reset All Filters</span>
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      <th className="px-3 py-2.5 text-center whitespace-nowrap sticky left-0 bg-slate-50 z-10">Actions</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Visitor Name</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Contact Number</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Company</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">Visitor Type</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">Visit Purpose</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">Office / Site</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Project Name</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Person to Meet</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Actual Person Met</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">Visit Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedVisitors.map((item, idx) => {
                      return (
                        <tr
                          key={item.id || idx}
                          onClick={() => setDetailsVisitor(item)}
                          className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                        >
                          {/* Actions Column */}
                          <td
                            className="px-2 py-2 text-center whitespace-nowrap sticky left-0 bg-white group-hover:bg-indigo-50/40 z-10 shadow-2xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => setDetailsVisitor(item)}
                                title="View Full Details"
                                aria-label="View Details"
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-700 hover:text-white transition active:scale-95 cursor-pointer"
                              >
                                <Eye size={13} />
                              </button>
                            </div>
                          </td>

                          {/* 1. Visitor Name */}
                          <td className="px-3 py-2 text-left whitespace-nowrap max-w-[200px] truncate" title={item.visitorName}>
                            <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition truncate block">
                              {item.visitorName || '—'}
                            </span>
                          </td>

                          {/* 2. Contact Number */}
                          <td
                            className="px-3 py-2 text-left whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleCall(item, e)}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
                                title="Call visitor"
                              >
                                <Phone size={11} className="text-gray-400" />
                                <span>{item.mobileNumber || '—'}</span>
                              </button>
                              {item.mobileNumber && (
                                <button
                                  type="button"
                                  onClick={(e) => handleWhatsApp(item, e)}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                                  title="Send WhatsApp Message"
                                >
                                  WA
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 3. Company */}
                          <td className="px-3 py-2 text-left whitespace-nowrap max-w-[170px] truncate" title={item.companyName || '—'}>
                            <span className="text-gray-700 truncate block">
                              {item.companyName || '—'}
                            </span>
                          </td>

                          {/* 4. Visitor Type */}
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {item.visitorType ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {item.visitorType}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* 5. Visit Purpose */}
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PURPOSE_STYLES[item.visitPurpose] || PURPOSE_STYLES.Other}`}>
                              {item.visitPurpose || '—'}
                            </span>
                          </td>

                          {/* 6. Office / Construction Site */}
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-gray-800 font-medium">
                              <MapPin size={11} className={item.visitLocation === 'Construction Site' ? 'text-amber-500' : 'text-indigo-500'} />
                              {item.visitLocation === 'Construction Site' ? 'Construction Site' : 'Corporate Office'}
                            </span>
                          </td>

                          {/* 7. Project Name */}
                          <td className="px-3 py-2 text-left whitespace-nowrap max-w-[170px] truncate" title={item.projectName || '—'}>
                            {item.projectName ? (
                              <span className="font-semibold text-amber-800 truncate block">
                                {item.projectName}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* 8. Person to Meet */}
                          <td className="px-3 py-2 text-left whitespace-nowrap max-w-[170px] truncate" title={item.personToMeetName || '—'}>
                            <div className="flex flex-col items-start truncate">
                              <span className="font-semibold text-gray-900 truncate block">
                                {item.personToMeetName || '—'}
                              </span>
                              {item.department && (
                                <span className="text-[10px] text-gray-400 truncate block">
                                  {item.department}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 9. Actual Person Met */}
                          <td className="px-3 py-2 text-left whitespace-nowrap max-w-[170px] truncate" title={item.personActuallyMetName || item.personToMeetName || '—'}>
                            <span className="text-gray-700 truncate block">
                              {item.personActuallyMetName || (item.status === 'CHECKED_OUT' ? (item.personToMeetName || '—') : '—')}
                            </span>
                          </td>

                          {/* 10. Visit Date & Time */}
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-gray-800">
                                {formatVisitorDate(item.checkInAt)}
                              </span>
                              <span className="text-[10px] text-gray-500 font-medium">
                                {formatVisitorTime(item.checkInAt)}
                              </span>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Footer with Pagination Controls */}
            <div className="p-3 border-t border-gray-200 bg-gray-50/60 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-gray-600">
                  Showing <span className="font-bold text-gray-900">{totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
                  <span className="font-bold text-gray-900">{Math.min(currentPage * pageSize, totalRecords)}</span> of{' '}
                  <span className="font-bold text-gray-900">{totalRecords}</span> records
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 text-[11px]">Show:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-[28px] px-2 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-semibold"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <span className="px-2 py-1 text-gray-700 font-bold">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-semibold"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODALS */}
      {isNewModalOpen && (
        <NewVisitorModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSaved={handleCreateVisitor}
        />
      )}

      {detailsVisitor && (
        <VisitorDetailsModal
          isOpen={Boolean(detailsVisitor)}
          visitor={detailsVisitor}
          onClose={() => setDetailsVisitor(null)}
        />
      )}

      {editVisitor && (
        <EditVisitorModal
          isOpen={Boolean(editVisitor)}
          visitor={editVisitor}
          onClose={() => setEditVisitor(null)}
          onSave={handleSaveEdit}
        />
      )}

    </div>
  );
}
