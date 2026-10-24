import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  UserCheck, Users, Clock, Briefcase, MapPin,
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
  PURPOSE_STYLES,
  getPurposeKey,
  getVisitorTypeKey,
  emptyCounts,
  VISIT_PURPOSE_OPTIONS,
  VISITOR_TYPE_OPTIONS,
  formatVisitorDate,
  formatVisitorTime
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
  const [dateFilter, setDateFilter] = useState('today'); // 'all' | 'today' | 'yesterday' | 'single' | 'range'
  const [specificDate, setSpecificDate] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // View Mode: 'columns' (Dashboard 4-column cards) vs 'table' (Full tabular register)
  const [viewMode, setViewMode] = useState('columns');

  // Pagination states for table view
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // "Show more" paging for the cards view
  const CARD_PAGE = 24;
  const [cardLimit, setCardLimit] = useState(CARD_PAGE);

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

    (visitors || []).forEach((v) => {

      const checkInMatches = isTimestampInDateRange(v.checkInAt, dateFilter, customFrom, customTo, specificDate);
      if (checkInMatches) {
        totalVisitors++;
      }
    });

    return {
      totalVisitors
    };
  }, [visitors, dateFilter, customFrom, customTo, specificDate]);

  // Selected period, shown on the Visitors KPI group
  const kpiPeriodLabel =
    dateFilter === 'today' ? 'Today'
      : dateFilter === 'yesterday' ? 'Yesterday'
      : (dateFilter === 'single' || dateFilter === 'specific') ? (specificDate || 'Single date')
      : (dateFilter === 'range' || dateFilter === 'custom') ? ([customFrom, customTo].filter(Boolean).join(' – ') || 'Date range')
      : 'All dates';

  // 2. Numeric Breakdown by Purpose & Location for the Selected Date Filter
  const dateFilteredStats = useMemo(() => {
    const purposeCounts = emptyCounts(VISIT_PURPOSE_OPTIONS);
    const typeCounts = emptyCounts(VISITOR_TYPE_OPTIONS);

    const locationCounts = {
      Office: 0,
      'Construction Site': 0
    };

    let total = 0;

    (visitors || []).forEach((v) => {
      if (!isTimestampInDateRange(v.checkInAt, dateFilter, customFrom, customTo, specificDate)) return;

      total++;
      purposeCounts[getPurposeKey(v.visitPurpose)]++;
      typeCounts[getVisitorTypeKey(v.visitorType)]++;

      const loc = v.visitLocation === 'Construction Site' ? 'Construction Site' : 'Office';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    return { purposeCounts, typeCounts, locationCounts, total };
  }, [visitors, dateFilter, customFrom, customTo, specificDate]);

  // 3. Visitors matching every filter except purpose (date, category, location, search)
  const baseVisitors = useMemo(() => {
    let list = visitors || [];

    // Date Filter
    list = list.filter((v) => isTimestampInDateRange(v.checkInAt, dateFilter, customFrom, customTo, specificDate));

    // Visitor Category Filter
    if (categoryFilter !== 'all') {
      list = list.filter((v) => getVisitorTypeKey(v.visitorType) === categoryFilter);
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
        const projectMatch = v.projectName && v.projectName.toLowerCase().includes(q);
        const remarksMatch = v.remarks && v.remarks.toLowerCase().includes(q);
        return nameMatch || phoneMatch || compMatch || hostMatch || projectMatch || remarksMatch;
      });
    }

    return list;
  }, [visitors, dateFilter, customFrom, customTo, specificDate, categoryFilter, locationFilter, searchQuery]);

  // Counts for the purpose tabs
  const purposeTabCounts = useMemo(() => {
    const counts = emptyCounts(VISIT_PURPOSE_OPTIONS);
    baseVisitors.forEach((v) => { counts[getPurposeKey(v.visitPurpose)]++; });
    return counts;
  }, [baseVisitors]);

  // Visitor list shown below: base list narrowed to the selected purpose
  const filteredVisitors = useMemo(
    () => (purposeFilter === 'all' ? baseVisitors : baseVisitors.filter((v) => getPurposeKey(v.visitPurpose) === purposeFilter)),
    [baseVisitors, purposeFilter]
  );

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
    setCardLimit(CARD_PAGE);
  }, [dateFilter, specificDate, customFrom, customTo, purposeFilter, categoryFilter, locationFilter, searchQuery, pageSize]);

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
    (purposeFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (locationFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  // Clear / Reset All Filters
  const handleResetFilters = () => {
    setDateFilter('today');
    setSpecificDate('');
    setCustomFrom('');
    setCustomTo('');
    setSearchQuery('');
    setPurposeFilter('all');
    setCategoryFilter('all');
    setLocationFilter('all');
    setCurrentPage(1);
    toast.success('Filters reset to Today');
  };

  // Date Filter Change Handler: automatically resets other filters (Purpose, Location, Status, Search)
  const handleDateFilterSelect = (mode) => {
    setDateFilter(mode);
    setPurposeFilter('all');
    setCategoryFilter('all');
    setLocationFilter('all');
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
    setCategoryFilter('all');
    setLocationFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleCustomRangeChange = (field, val) => {
    if (field === 'from') setCustomFrom(val);
    if (field === 'to') setCustomTo(val);
    setPurposeFilter('all');
    setCategoryFilter('all');
    setLocationFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
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
      'Visit Date': formatVisitorDate(item.checkInAt),
      'Arrival Time': formatVisitorTime(item.checkInAt),
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

        <span className={`self-start max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-bold border ${PURPOSE_STYLES[getPurposeKey(item.visitPurpose)] || PURPOSE_STYLES.Other}`}>
          {item.visitPurpose || 'Other'}
        </span>

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

      {/* 2. Filter Toolbar: Period + Purpose / Category / Location */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <span className="hidden lg:inline text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">
            Period:
          </span>

          {/* Date Range Mode Segmented Controls (short labels on phones so all 5 fit one row) */}
          <div className="grid grid-cols-5 lg:inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs w-full lg:w-auto">
            {[
              { id: 'today', label: 'Today', short: 'Today', match: ['today'] },
              { id: 'yesterday', label: 'Yesterday', short: 'Yest.', match: ['yesterday'] },
              { id: 'single', label: 'Single Date', short: 'Date', match: ['single', 'specific'] },
              { id: 'range', label: 'Date Range', short: 'Range', match: ['range', 'custom'] },
              { id: 'all', label: 'All Dates', short: 'All', match: ['all'] }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDateFilterSelect(p.id)}
                className={`px-2 lg:px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  p.match.includes(dateFilter)
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="sm:hidden">{p.short}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Inline Single Date Picker */}
          {(dateFilter === 'single' || dateFilter === 'specific') && (
            <div className="flex items-center gap-1.5 bg-indigo-50/60 px-2.5 py-1 rounded-lg border border-indigo-100">
              <span className="text-[11px] font-semibold text-indigo-900">Date:</span>
              <input
                type="date"
                value={specificDate}
                onChange={(e) => handleSpecificDateChange(e.target.value)}
                className="flex-1 lg:flex-none text-xs h-[28px] px-2 bg-white border border-gray-200 rounded-md text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
            <div className="grid grid-cols-[auto_1fr] lg:flex items-center gap-1.5 bg-indigo-50/60 px-2.5 py-1.5 lg:py-1 rounded-lg border border-indigo-100">
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
            </div>
          )}

          {/* Reset Filters Action */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="lg:ml-auto self-start lg:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset Filters ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        {/* Filter Controls Row (Purpose, Category, Location) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5 border-t border-gray-100">
          {[
            { value: purposeFilter, onChange: setPurposeFilter, allLabel: 'All Purposes', options: VISIT_PURPOSE_OPTIONS },
            { value: categoryFilter, onChange: setCategoryFilter, allLabel: 'All Categories', options: VISITOR_TYPE_OPTIONS },
            {
              value: locationFilter,
              onChange: setLocationFilter,
              allLabel: 'All Locations',
              options: [
                { value: 'Office', label: 'Corporate Office' },
                { value: 'Construction Site', label: 'Construction Site' }
              ]
            }
          ].map((f) => (
            <select
              key={f.allLabel}
              value={f.value}
              onChange={(e) => {
                f.onChange(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full text-xs h-[34px] px-2.5 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer shadow-2xs ${
                f.value !== 'all' ? 'border-indigo-300 text-indigo-800 bg-indigo-50/40' : 'bg-white border-gray-200 text-gray-700'
              }`}
            >
              <option value="all">{f.allLabel}</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      {/* Notice Banner when Today has 0 records but past records exist */}
      {dateFilter === 'today' && kpiCounts.totalVisitors === 0 && visitors.length > 0 && !loading && (
        <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-indigo-950">
                0 visitors recorded for Today ({todayDateStr})
              </p>
              <p className="text-[11px] sm:text-xs text-indigo-700 mt-0.5">
                You have <strong className="font-bold text-indigo-900">{visitors.length} total visitor record{visitors.length > 1 ? 's' : ''}</strong> logged on earlier dates.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDateFilterSelect('all')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Eye size={14} />
            <span>View All Dates ({visitors.length})</span>
          </button>
        </div>
      )}

      {/* 3. KPIs: total visitors + one tile per visit purpose, for the selected period. Every tile filters the records below */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={13} className="text-indigo-600" />
            Visitors by Purpose
          </h3>
          <span className="text-[10px] font-semibold text-gray-400 truncate">{kpiPeriodLabel} · Tap to filter</span>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { value: 'all', label: 'Total Visitors', count: kpiCounts.totalVisitors, dot: 'bg-indigo-500' },
            ...VISIT_PURPOSE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              count: dateFilteredStats.purposeCounts?.[opt.value] || 0,
              dot: opt.dot
            }))
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setCurrentPage(1);
                setPurposeFilter(t.value === 'all' || purposeFilter === t.value ? 'all' : t.value);
              }}
              className={`text-left p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between ${
                purposeFilter === t.value
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-gray-50/70 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 flex items-start gap-1.5 leading-tight">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[3px] ${t.dot}`} />
                {t.label}
              </span>
              <span className="mt-1.5 text-xl sm:text-2xl font-black text-gray-900">{t.count}</span>
            </button>
          ))}
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
          <div className="flex-1 min-h-[200px] w-full">
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

        {/* Visitor Category & Location Summaries */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-3">
          
          {/* Visits by Visitor Category */}
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-gray-900">
                  Visits by Category
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {dateFilteredStats.total} total
              </span>
            </div>

            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {VISITOR_TYPE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    setCategoryFilter(categoryFilter === opt.value ? 'all' : opt.value);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1 rounded-lg border transition cursor-pointer group ${
                    categoryFilter === opt.value
                      ? 'bg-indigo-50 border-indigo-300 font-bold'
                      : 'bg-gray-50/70 hover:bg-gray-100 border-gray-100'
                  }`}
                  title={`Filter by ${opt.label}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                    <span className="text-xs font-medium text-gray-800 group-hover:text-indigo-600 transition">
                      {opt.label}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-gray-900 group-hover:text-indigo-600 transition">
                    {dateFilteredStats.typeCounts?.[opt.value] || 0}
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
                ? 'Visitor cards grouped by visit purpose.'
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

          {/* Toggle between Cards View and Table View */}
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
              <span>Cards View</span>
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

        {/* View Mode 1: Cards grouped by visit purpose (tabs) in a responsive grid */}
        {viewMode === 'columns' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs flex flex-col overflow-hidden">
            {/* Purpose tabs: same state as the purpose KPI tiles and filter.
                Phones: 2-column grid (no sideways scrolling); wider screens: one wrapping row */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-1.5 px-3 py-2.5 border-b border-gray-100">
              {[
                { value: 'all', label: 'All Entries', dot: 'bg-indigo-500', count: baseVisitors.length },
                ...VISIT_PURPOSE_OPTIONS.map((opt) => ({ ...opt, count: purposeTabCounts[opt.value] || 0 }))
              ].map((tab) => {
                const isActive = purposeFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setPurposeFilter(tab.value)}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-left border transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white' : tab.dot}`} />
                    <span className="flex-1 sm:flex-none leading-tight">{tab.label}</span>
                    <span className={`shrink-0 px-1.5 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-gray-400">
                <RefreshCw size={18} className="animate-spin text-indigo-600 mb-1.5" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : filteredVisitors.length === 0 ? (
              <div className="py-14 px-4 text-center">
                {dateFilter === 'today' && visitors.length > 0 ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100">
                      <Calendar size={22} />
                    </div>
                    <p className="text-sm font-bold text-gray-800">
                      No visitors recorded today
                    </p>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      No check-ins were registered for today ({todayDateStr}), but you have <strong className="text-indigo-900 font-bold">{visitors.length} visitor record{visitors.length > 1 ? 's' : ''}</strong> on earlier dates.
                    </p>
                    <div className="mt-3.5 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDateFilterSelect('all')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>View All Dates ({visitors.length})</span>
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setIsNewModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
                        >
                          <UserPlus size={13} />
                          <span>+ New Visitor</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <UserCheck size={26} className="mx-auto text-gray-300 mb-1.5" />
                    <p className="text-xs font-semibold text-gray-600">
                      {purposeFilter === 'all' ? 'No visitors recorded' : `No ${purposeFilter} visits`}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {baseVisitors.length === 0 ? 'Click + New Visitor to register entries' : 'Try another purpose tab or change the filters'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {filteredVisitors.slice(0, cardLimit).map((v) => renderVisitorCardItem(v))}
                </div>
                {filteredVisitors.length > cardLimit && (
                  <button
                    type="button"
                    onClick={() => setCardLimit((n) => n + CARD_PAGE)}
                    className="w-full py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/60 transition border-t border-gray-100 cursor-pointer"
                  >
                    Show more ({filteredVisitors.length - cardLimit} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        )}

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
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 border border-indigo-100">
                    {dateFilter === 'today' && visitors.length > 0 ? <Calendar size={22} /> : <Users size={22} />}
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">
                    {dateFilter === 'today' && visitors.length > 0
                      ? 'No visitors recorded today'
                      : 'No visitor records found'}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-sm">
                    {dateFilter === 'today' && visitors.length > 0
                      ? `No check-ins have been logged for today (${todayDateStr}), but you have ${visitors.length} visitor record(s) on earlier dates.`
                      : 'No records match your selected filters. Try broadening your date range or clearing search criteria.'}
                  </p>
                  <div className="mt-3.5 flex items-center gap-2">
                    {dateFilter === 'today' && visitors.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDateFilterSelect('all')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>View All Dates ({visitors.length})</span>
                      </button>
                    )}
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Reset All Filters</span>
                      </button>
                    )}
                  </div>
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PURPOSE_STYLES[getPurposeKey(item.visitPurpose)] || PURPOSE_STYLES.Other}`}>
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
                          <td className="px-3 py-2 text-left whitespace-nowrap max-w-[170px] truncate" title={item.personToMeetName || '—'}>
                            <span className="text-gray-700 truncate block">
                              {item.personToMeetName || '—'}
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
