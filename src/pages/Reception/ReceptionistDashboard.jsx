import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  UserCheck, Users, Clock, Briefcase, MapPin,
  LogOut, UserPlus, RefreshCw, Eye, Phone, Building2,
  Calendar, ChevronRight, ChevronLeft, TrendingUp, RotateCcw,
  Pencil, Search, X, FileSpreadsheet, AlertCircle,
  LayoutGrid, Table, ArrowRight, ChevronDown
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
import DateInput from '../../components/DateInput';
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

  const recordsSectionRef = useRef(null);
  const scrollToRecords = () => {
    recordsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  const handleVisitorUpdated = useCallback((updated) => {
    if (!updated?.id) return;
    setVisitors((prev) => prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
    setDetailsVisitor((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

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
      <div className="flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap bg-white p-2.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <UserCheck size={18} className="sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-black text-gray-900 tracking-tight truncate">
                Reception Dashboard
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                Visitor Management
              </span>
            </div>
            <p className="hidden sm:block text-[11px] sm:text-xs text-gray-500 truncate">
              Live visitor monitoring, quick check-in & check-out, and unified visitor register.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Today's Date Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800">
            <Calendar size={13} className="text-gray-600" />
            <span className="font-bold">{todayDateStr}</span>
          </div>

          {/* Export to Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            title="Export filtered records to Excel"
            className="inline-flex items-center justify-center gap-1 px-2 sm:px-3 h-[32px] sm:h-[36px] bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span className="hidden sm:inline font-semibold">Export</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh records"
            aria-label="Refresh"
            className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[32px] w-[32px] sm:h-[36px] sm:w-[36px] transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* + New Visitor Primary Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 h-[32px] sm:h-[36px] bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              <UserPlus size={14} />
              <span className="font-bold">+ New Visitor</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Compact Filter Toolbar: Period + Purpose / Category / Location */}
      <div className="bg-white p-2 sm:p-3 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-2">
        {/* Row 1: Date Segmented Controls + Inline Reset Button */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <div className="grid grid-cols-5 items-center gap-0.5 sm:gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200 text-xs flex-1">
            {[
              { id: 'today', label: 'Today', short: 'Today', match: ['today'] },
              { id: 'yesterday', label: 'Yesterday', short: 'Yest.', match: ['yesterday'] },
              { id: 'single', label: 'Single Date', short: 'Date', match: ['single', 'specific'] },
              { id: 'range', label: 'Date Range', short: 'Range', match: ['range', 'custom'] },
              { id: 'all', label: 'All Dates', short: 'All', match: ['all'] }
            ].map((p) => {
              const isSelected = p.match.includes(dateFilter);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDateFilterSelect(p.id)}
                  className={`px-1 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-bold whitespace-nowrap text-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-white text-indigo-700 shadow-xs font-black ring-1 ring-black/5'
                      : 'text-gray-700 hover:text-gray-950 hover:bg-slate-200/70 font-bold'
                  }`}
                >
                  <span className="sm:hidden font-bold">{p.short}</span>
                  <span className="hidden sm:inline font-bold">{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Reset Filters Chip Button */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center justify-center gap-1 px-2.5 h-[28px] sm:h-[32px] text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition shrink-0 cursor-pointer shadow-2xs active:scale-95"
              title="Reset all filters"
            >
              <RotateCcw size={11} />
              <span className="hidden sm:inline font-bold">Reset</span>
              <span className="w-4 h-4 rounded-full bg-rose-200/90 text-rose-800 text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            </button>
          )}
        </div>

        {/* Inline Date Pickers (Single or Range) */}
        {(dateFilter === 'single' || dateFilter === 'specific') && (
          <div className="flex items-center gap-1.5 bg-indigo-50/70 px-2.5 py-1.5 rounded-lg border border-indigo-200 text-xs font-bold">
            <span className="text-[11px] font-black text-indigo-950 shrink-0">Select Date:</span>
            <DateInput
              value={specificDate}
              onChange={(e) => handleSpecificDateChange(e.target.value)}
              className="flex-1 sm:flex-none text-xs h-[28px] px-2 bg-white border border-gray-300 rounded-md text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            />
            {specificDate && (
              <button
                type="button"
                onClick={() => handleSpecificDateChange('')}
                className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer ml-auto"
                title="Clear date"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {(dateFilter === 'range' || dateFilter === 'custom') && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-indigo-50/70 px-2.5 py-1.5 rounded-lg border border-indigo-200 text-xs font-bold">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-indigo-950 shrink-0">From:</span>
              <DateInput
                value={customFrom}
                onChange={(e) => handleCustomRangeChange('from', e.target.value)}
                className="w-full sm:w-auto text-xs h-[28px] px-1.5 bg-white border border-gray-300 rounded-md text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-indigo-950 shrink-0">To:</span>
              <DateInput
                value={customTo}
                onChange={(e) => handleCustomRangeChange('to', e.target.value)}
                className="w-full sm:w-auto text-xs h-[28px] px-1.5 bg-white border border-gray-300 rounded-md text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Row 2: Purpose, Category, Location in 3-column row */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-gray-100">
          <select
            value={purposeFilter}
            onChange={(e) => {
              setPurposeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full text-[11px] sm:text-xs h-[32px] px-1.5 sm:px-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold cursor-pointer truncate shadow-2xs ${
              purposeFilter !== 'all' ? 'border-indigo-400 text-indigo-800 bg-indigo-50/60 font-black' : 'bg-white border-gray-300 text-gray-800'
            }`}
          >
            <option value="all">All Purposes</option>
            {VISIT_PURPOSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full text-[11px] sm:text-xs h-[32px] px-1.5 sm:px-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold cursor-pointer truncate shadow-2xs ${
              categoryFilter !== 'all' ? 'border-indigo-400 text-indigo-800 bg-indigo-50/60 font-black' : 'bg-white border-gray-300 text-gray-800'
            }`}
          >
            <option value="all">All Categories</option>
            {VISITOR_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full text-[11px] sm:text-xs h-[32px] px-1.5 sm:px-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold cursor-pointer truncate shadow-2xs ${
              locationFilter !== 'all' ? 'border-indigo-400 text-indigo-800 bg-indigo-50/60 font-black' : 'bg-white border-gray-300 text-gray-800'
            }`}
          >
            <option value="all">All Locations</option>
            <option value="Office">Office</option>
            <option value="Construction Site">Site</option>
          </select>
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

      {/* 3. KPI Section: Visitors by Purpose, Category, and Location (All KPIs at Top) */}
      <div className="flex flex-col gap-2.5 sm:gap-3">
        {/* Row 1: Visitors by Purpose KPI Cards */}
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-indigo-600" />
              <span>Visitors by Purpose</span>
            </h4>
            <span className="text-[10px] sm:text-xs font-semibold text-gray-400 truncate">
              {kpiPeriodLabel} · Tap to filter
            </span>
          </div>

          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { value: 'all', label: 'TOTAL VISITORS', count: baseVisitors.length, dot: 'bg-indigo-600' },
              ...VISIT_PURPOSE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label.toUpperCase(),
                count: purposeTabCounts[opt.value] || 0,
                dot: opt.dot
              }))
            ].map((t) => {
              const isActive = (t.value === 'all' && purposeFilter === 'all') || purposeFilter === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setCurrentPage(1);
                    setPurposeFilter(t.value === 'all' || purposeFilter === t.value ? 'all' : t.value);
                    scrollToRecords();
                  }}
                  className={`text-left p-2 sm:p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-sky-50/90 border-sky-300 ring-2 ring-sky-200/70 shadow-xs'
                      : 'bg-slate-50/70 border-gray-200/80 hover:bg-slate-100/70 hover:border-gray-300'
                  }`}
                  title={`Filter by ${t.label}`}
                >
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-start gap-1.5 leading-tight">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[3px] ${t.dot}`} />
                    <span className="truncate">{t.label}</span>
                  </span>
                  <span className="mt-1 sm:mt-1.5 text-lg sm:text-2xl font-black text-gray-900">{t.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Category and Location KPIs Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
          
          {/* Visits by Category (Takes 2 cols on md+) */}
          <div className="md:col-span-2 bg-white p-3 sm:p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-indigo-600" />
                <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Visits by Category
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-gray-400">
                  Tap to filter
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {dateFilteredStats.total} total
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {VISITOR_TYPE_OPTIONS.map((opt) => {
                const isSelected = categoryFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCurrentPage(1);
                      setCategoryFilter(categoryFilter === opt.value ? 'all' : opt.value);
                      scrollToRecords();
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200/60 font-bold shadow-2xs'
                        : 'bg-slate-50/70 hover:bg-slate-100/70 border-gray-200/80 hover:border-gray-300'
                    }`}
                    title={`Filter by ${opt.label}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                      <span className="text-[11px] sm:text-xs font-semibold text-gray-800 truncate">
                        {opt.label}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-gray-900 ml-1 shrink-0">
                      {dateFilteredStats.typeCounts?.[opt.value] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visits by Location (Takes 1 col on md+) */}
          <div className="md:col-span-1 bg-white p-3 sm:p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-indigo-600" />
                <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Visits by Location
                </h4>
              </div>
              <span className="text-[10px] font-semibold text-gray-400">
                Tap to filter
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 h-full">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setLocationFilter(locationFilter === 'Office' ? 'all' : 'Office');
                  scrollToRecords();
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between text-left ${
                  locationFilter === 'Office'
                    ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200/60 shadow-2xs'
                    : 'bg-slate-50/70 hover:bg-slate-100/70 border-gray-200/80 hover:border-gray-300'
                }`}
                title="Filter Corporate Office"
              >
                <span className="text-[10px] font-bold text-indigo-700 flex items-center gap-1 uppercase tracking-wide">
                  <Building2 size={12} />
                  Office
                </span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {dateFilteredStats.locationCounts?.Office || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setLocationFilter(locationFilter === 'Construction Site' ? 'all' : 'Construction Site');
                  scrollToRecords();
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between text-left ${
                  locationFilter === 'Construction Site'
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200/60 shadow-2xs'
                    : 'bg-slate-50/70 hover:bg-slate-100/70 border-gray-200/80 hover:border-gray-300'
                }`}
                title="Filter Construction Site"
              >
                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1 uppercase tracking-wide">
                  <MapPin size={12} />
                  Sites
                </span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {dateFilteredStats.locationCounts?.['Construction Site'] || 0}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 4. Primary Visitor Data Section (Records Table / Cards) */}
      <div ref={recordsSectionRef} className="flex flex-col gap-2.5">
        
        {/* Section Header with Search Bar and View Mode Switcher */}
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-2.5">
          {/* Top Row: Visitor Records & Matches on Left, Cards/Table toggle on Right */}
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1.5 shrink-0">
                <span>Visitor Records</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                {filteredVisitors.length} matches
              </span>
            </div>

            {/* Toggle between Cards View and Table View */}
            <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('columns')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                  viewMode === 'columns'
                    ? 'bg-white text-indigo-700 shadow-2xs font-black'
                    : 'text-gray-600 hover:text-gray-900 font-bold'
                }`}
              >
                <LayoutGrid size={12} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-700 shadow-2xs font-black'
                    : 'text-gray-600 hover:text-gray-900 font-bold'
                }`}
              >
                <Table size={12} />
                <span>Table</span>
              </button>
            </div>
          </div>

          {/* Active Filter Chips (Rendered cleanly when any filter is active) */}
          {(purposeFilter !== 'all' || categoryFilter !== 'all' || locationFilter !== 'all') && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Filtered by:</span>
              {purposeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setPurposeFilter('all')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                  title="Clear purpose filter"
                >
                  <span>Purpose: {purposeFilter}</span>
                  <X size={10} />
                </button>
              )}
              {categoryFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
                  title="Clear category filter"
                >
                  <span>Category: {categoryFilter}</span>
                  <X size={10} />
                </button>
              )}
              {locationFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setLocationFilter('all')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
                  title="Clear location filter"
                >
                  <span>Location: {locationFilter}</span>
                  <X size={10} />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPurposeFilter('all');
                  setCategoryFilter('all');
                  setLocationFilter('all');
                }}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline ml-0.5 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Search Bar - Big, spacious, and full-width */}
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor, phone, company, host, project..."
              className="w-full text-xs sm:text-sm h-[38px] sm:h-[40px] pl-9 pr-9 bg-slate-50/80 border border-gray-200 rounded-xl text-gray-800 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white shadow-2xs transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center cursor-pointer transition"
                title="Clear search"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* View Mode 1: Cards grouped by visit purpose (tabs) in a responsive grid */}
        {viewMode === 'columns' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs flex flex-col overflow-hidden">

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
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
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

      {/* 5. Daily Visitor Trends (Graph at the bottom) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp size={14} />
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                Daily Visitor Trends
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
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
        <div className="grid grid-cols-4 gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/80 text-xs w-full sm:w-auto self-start">
          {[
            { id: '7', label: 'Last 7 Days', short: '7 Days' },
            { id: '14', label: 'Last 14 Days', short: '14 Days' },
            { id: '30', label: 'Last 30 Days', short: '30 Days' },
            { id: 'month', label: 'This Month', short: 'Month' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTrendRange(tab.id)}
              className={`px-1.5 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold text-center transition cursor-pointer truncate ${
                trendRange === tab.id
                  ? 'bg-white text-indigo-700 shadow-2xs font-black ring-1 ring-black/5'
                  : 'text-gray-700 hover:text-gray-950 hover:bg-slate-200/60 font-bold'
              }`}
            >
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Chart Area with explicit height for reliable mobile rendering */}
        <div className="w-full h-[240px] sm:h-[280px]">
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
          onVisitorUpdated={handleVisitorUpdated}
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
