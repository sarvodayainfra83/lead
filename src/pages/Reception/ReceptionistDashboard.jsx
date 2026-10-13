import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  UserCheck, Users, Clock, Briefcase, MapPin, CheckCircle2, AlertCircle,
  LogOut, UserPlus, FileSpreadsheet, BarChart3, RefreshCw, Eye, Phone,
  Building2, ArrowRight, ShieldCheck, Calendar, ChevronRight, Layers,
  ExternalLink, Sparkles, TrendingUp, RotateCcw
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
import CheckOutModal from './CheckOutModal';
import VisitorDetailsModal from './VisitorDetailsModal';
import ReceptionReportsModal from './ReceptionReportsModal';
import { visitorApi } from '../../api/visitorApi';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, isUserAdmin } from '../../utils/authUtils';
import {
  VISITOR_STATUS_MAP,
  PURPOSE_STYLES,
  formatVisitorDate,
  formatVisitorTime,
  getVisitDuration
} from './receptionConstants';

export default function ReceptionistDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);
  const canEdit = hasFullAccess(user, 'reception') || hasFullAccess(user, 'receptionDashboard') || isAdmin;

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [checkoutVisitor, setCheckoutVisitor] = useState(null);
  const [detailsVisitor, setDetailsVisitor] = useState(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  // Reference to "Currently Inside" table for the Check-Out Quick Action
  const insideTableRef = useRef(null);

  // Fetch visitors
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await visitorApi.getVisitorLogs();
      setVisitors(data || []);
    } catch (err) {
      console.error('Failed to load visitors:', err);
      toast.error('Could not load visitor logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live calculated stats
  const stats = useMemo(() => {
    return visitorApi.calculateStats(visitors);
  }, [visitors]);

  // Active visitors currently inside
  const insideVisitors = useMemo(() => {
    return (visitors || []).filter(v => v.status === 'CHECKED_IN');
  }, [visitors]);

  // Helper to extract YYYY-MM-DD in local timezone
  const getLocalDateKey = (dateVal) => {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Trends Graph Filter States
  const [trendRange, setTrendRange] = useState('7'); // '7', '14', '30', 'month'
  const [trendLocation, setTrendLocation] = useState('all'); // 'all', 'Office', 'Construction Site'
  const [trendPurpose, setTrendPurpose] = useState('all'); // 'all', 'Meeting', 'Site Visit', etc.

  // Dynamic Daily Visitor Trends data based on active filters
  const { filteredTrendData, totalTrendVisits, avgTrendVisits, rangeLabelText } = useMemo(() => {
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
      dayCount = Math.max(1, now.getDate()); // 1st of current month until today
      label = 'This Month';
    }

    // Build array of days in chronological order
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = getLocalDateKey(d);
      const isToday = i === 0;
      const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthStr = d.toLocaleDateString('en-GB', { month: 'short' });

      const shortLabel = `${dayNum} ${monthStr}`;
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
        dayName,
        fullDate,
        visitors: 0,
        isToday
      });
      if (key) countsByDate[key] = 0;
    }

    // Tally actual registrations from visitor logs matching filter criteria
    (visitors || []).forEach(v => {
      // Exclude cancelled visits
      if (v.status === 'CANCELLED') return;
      if (!v.checkInAt) return;

      // Filter by Location
      if (trendLocation !== 'all' && v.visitLocation !== trendLocation) return;

      // Filter by Purpose
      if (trendPurpose !== 'all' && v.visitPurpose !== trendPurpose) return;

      const key = getLocalDateKey(v.checkInAt);
      if (key && countsByDate[key] !== undefined) {
        countsByDate[key]++;
      }
    });

    const data = days.map(d => ({
      ...d,
      visitors: countsByDate[d.dateKey] || 0
    }));

    const total = data.reduce((acc, curr) => acc + curr.visitors, 0);
    const avg = days.length > 0 ? (total / days.length).toFixed(1) : '0';

    return {
      filteredTrendData: data,
      totalTrendVisits: total,
      avgTrendVisits: avg,
      rangeLabelText: label
    };
  }, [visitors, trendRange, trendLocation, trendPurpose]);

  // Clean custom tooltip for trends chart
  const CustomTrendTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-slate-700/80">
          <p className="font-semibold text-slate-200">
            {item.fullDate} {item.isToday ? '(Today)' : ''}
          </p>
          <p className="text-emerald-400 font-bold text-sm mt-0.5">
            {item.visitors} {item.visitors === 1 ? 'visitor' : 'visitors'}
          </p>
          {(trendLocation !== 'all' || trendPurpose !== 'all') && (
            <p className="text-[10px] text-slate-400 mt-1 border-t border-slate-800 pt-1">
              Filter: {trendLocation !== 'all' ? trendLocation : ''} {trendLocation !== 'all' && trendPurpose !== 'all' ? '• ' : ''}{trendPurpose !== 'all' ? trendPurpose : ''}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Clean phone utility
  const cleanPhone = (num) => String(num || '').replace(/[^0-9]/g, '');

  // WhatsApp click handler
  const handleWhatsApp = (item, e) => {
    e?.stopPropagation?.();
    const phone = cleanPhone(item.mobileNumber);
    if (!phone) return;
    const phoneWithCountry = phone.startsWith('91') ? phone : `91${phone}`;
    const msg = encodeURIComponent(`Hello ${item.visitorName}, thank you for visiting Sarvodaya Infracon.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank');
  };

  // Check-out confirmed handler
  const handleConfirmCheckout = async (visitorId, payload) => {
    try {
      await visitorApi.checkOutVisitor(visitorId, payload, user);
      await loadData();
    } catch (err) {
      console.error('Failed to check out visitor:', err);
      throw err;
    }
  };

  // New visitor created handler
  const handleCreateVisitor = async (payload) => {
    try {
      await visitorApi.registerVisitor(payload, user);
      await loadData();
    } catch (err) {
      console.error('Failed to register visitor:', err);
      throw err;
    }
  };

  // Export to Excel for Reports Modal
  const handleExportExcel = () => {
    if (!visitors || visitors.length === 0) {
      toast.error('No visitor records to export');
      return;
    }

    const exportData = visitors.map((item, idx) => ({
      'SR No': idx + 1,
      'Visitor Name': item.visitorName || '-',
      'Mobile Number': item.mobileNumber || '-',
      'Company / Org': item.companyName || '-',
      'Visitor Type': item.visitorType || '-',
      'Visit Purpose': item.visitPurpose || '-',
      'Location': item.visitLocation || 'Office',
      'Project / Site': item.projectName || '-',
      'Person to Meet': item.personToMeetName || '-',
      'Department': item.department || '-',
      'Person Actually Met': item.personActuallyMetName || item.personToMeetName || '-',
      'Check-In Date': formatVisitorDate(item.checkInAt),
      'Check-In Time': formatVisitorTime(item.checkInAt),
      'Check-Out Date': item.checkOutAt ? formatVisitorDate(item.checkOutAt) : '-',
      'Check-Out Time': item.checkOutAt ? formatVisitorTime(item.checkOutAt) : 'Inside',
      'Duration': getVisitDuration(item.checkInAt, item.checkOutAt),
      'Status': item.status === 'CHECKED_IN' ? 'Checked In' : (item.status === 'CHECKED_OUT' ? 'Checked Out' : 'Cancelled'),
      'Checked-In By': item.checkedInBy || '-',
      'Checked-Out By': item.checkedOutBy || '-',
      'Remarks': item.remarks || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitor Register');
    const filename = `Visitor_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success('Visitor register exported to Excel');
  };

  // KPI card click: Navigate to the existing Reception page with corresponding filters
  const handleKpiClick = (type) => {
    switch (type) {
      case 'today':
        navigate('/reception', { state: { dateFilter: 'today', statusFilter: 'all', purposeFilter: 'all', locationFilter: 'all' } });
        break;
      case 'inside':
        navigate('/reception', { state: { dateFilter: 'all', statusFilter: 'CHECKED_IN', purposeFilter: 'all', locationFilter: 'all' } });
        break;
      case 'meetings':
        navigate('/reception', { state: { dateFilter: 'today', purposeFilter: 'Meeting', statusFilter: 'all' } });
        break;
      case 'siteVisits':
        navigate('/reception', { state: { dateFilter: 'today', purposeFilter: 'Site Visit', statusFilter: 'all' } });
        break;
      case 'awaiting':
        navigate('/reception', { state: { dateFilter: 'all', statusFilter: 'CHECKED_IN' } });
        break;
      case 'checkedOut':
        navigate('/reception', { state: { dateFilter: 'today', statusFilter: 'CHECKED_OUT' } });
        break;
      default:
        navigate('/reception');
    }
  };

  // Quick action: Check-Out (Scroll or focus the Currently Inside table)
  const handleScrollToInsideTable = () => {
    if (insideTableRef.current) {
      insideTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Visual pulse highlight
      insideTableRef.current.classList.add('ring-2', 'ring-emerald-500');
      setTimeout(() => {
        insideTableRef.current?.classList.remove('ring-2', 'ring-emerald-500');
      }, 1500);
    }
  };

  // Current formatted date banner string (e.g., "Monday, 13 Oct 2026")
  const todayDateStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/60 p-2 sm:p-3 md:p-4 gap-3 sm:gap-4 overflow-y-auto">
      
      {/* 1. Header Banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Receptionist Dashboard
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Front Desk
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500">
              Live visitor monitoring, premise security, and quick check-out operations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Current Date Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700">
            <Calendar size={13} className="text-gray-500" />
            <span>{todayDateStr}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh records"
            className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[36px] w-[36px] transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* + New Visitor Primary Action Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-bold h-[36px] bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm active:scale-95 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ New Visitor</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top KPI Cards (Live Database Data) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        
        {/* Card 1: Total Visitors Today */}
        <div
          onClick={() => handleKpiClick('today')}
          className="p-3 bg-white hover:bg-indigo-50/40 border border-gray-200 hover:border-indigo-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group"
          title="Click to view all today's visitors in Reception register"
        >
          <div className="flex items-center justify-between text-gray-600 group-hover:text-indigo-600 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Total Today
            </span>
            <Users size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 group-hover:text-indigo-950 transition">
              {stats.totalToday}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-indigo-600 flex items-center gap-0.5">
              <span>View</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium truncate">
            Registered today
          </span>
        </div>

        {/* Card 2: Currently Inside */}
        <div
          onClick={() => handleKpiClick('inside')}
          className="p-3 bg-white hover:bg-emerald-50/40 border border-gray-200 hover:border-emerald-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group ring-1 ring-emerald-500/10"
          title="Click to filter currently inside visitors"
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Inside
            </span>
            <CheckCircle2 size={14} className="group-hover:scale-110 transition text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-emerald-950">
              {stats.currentlyInside}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
              <span>Active</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-emerald-700/80 mt-1 font-medium truncate">
            On premises now
          </span>
        </div>

        {/* Card 3: Meetings Today */}
        <div
          onClick={() => handleKpiClick('meetings')}
          className="p-3 bg-white hover:bg-violet-50/40 border border-gray-200 hover:border-violet-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group"
          title="Click to view today's meetings"
        >
          <div className="flex items-center justify-between text-gray-600 group-hover:text-violet-600 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Meetings
            </span>
            <Briefcase size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 group-hover:text-violet-950 transition">
              {stats.meetingsToday}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-violet-600 flex items-center gap-0.5">
              <span>View</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium truncate">
            Office host visits
          </span>
        </div>

        {/* Card 4: Site Visits Today */}
        <div
          onClick={() => handleKpiClick('siteVisits')}
          className="p-3 bg-white hover:bg-amber-50/40 border border-gray-200 hover:border-amber-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group"
          title="Click to view today's site visits"
        >
          <div className="flex items-center justify-between text-gray-600 group-hover:text-amber-600 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Site Visits
            </span>
            <MapPin size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 group-hover:text-amber-950 transition">
              {stats.siteVisitsToday}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-amber-600 flex items-center gap-0.5">
              <span>View</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium truncate">
            Construction site
          </span>
        </div>

        {/* Card 5: Awaiting Checkout */}
        <div
          onClick={() => handleKpiClick('awaiting')}
          className="p-3 bg-white hover:bg-rose-50/40 border border-gray-200 hover:border-rose-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group"
          title="Click to view visitors awaiting checkout"
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              Awaiting Out
            </span>
            <Clock size={14} className="group-hover:scale-110 transition text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-rose-950">
              {stats.awaitingCheckout}
            </span>
            <span className="text-[10px] font-bold text-rose-700 flex items-center gap-0.5">
              <span>Exit pending</span>
            </span>
          </div>
          <span className="text-[10px] text-rose-700/80 mt-1 font-medium truncate">
            Needs departure log
          </span>
        </div>

        {/* Card 6: Checked Out Today */}
        <div
          onClick={() => handleKpiClick('checkedOut')}
          className="p-3 bg-white hover:bg-slate-100/60 border border-gray-200 hover:border-slate-300 rounded-xl transition cursor-pointer shadow-2xs flex flex-col justify-between group"
          title="Click to view visitors checked out today"
        >
          <div className="flex items-center justify-between text-gray-600 group-hover:text-slate-700 transition">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Checked Out
            </span>
            <LogOut size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 group-hover:text-slate-950 transition">
              {stats.checkedOutToday || 0}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-slate-600 flex items-center gap-0.5">
              <span>View</span>
              <ChevronRight size={10} />
            </span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium truncate">
            Departed today
          </span>
        </div>
      </div>

      {/* 3. Quick Actions Panel */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          
          {/* Action 1: New Visitor */}
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 text-indigo-900 transition text-left cursor-pointer group active:scale-98"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
              <UserPlus size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">New Visitor</span>
              <span className="text-[10px] text-indigo-700/80 block truncate">Register entry</span>
            </div>
          </button>

          {/* Action 2: Check-Out */}
          <button
            type="button"
            onClick={handleScrollToInsideTable}
            className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-900 transition text-left cursor-pointer group active:scale-98"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
              <LogOut size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">Check-Out</span>
              <span className="text-[10px] text-emerald-700/80 block truncate">
                {stats.awaitingCheckout} awaiting exit
              </span>
            </div>
          </button>

          {/* Action 3: Visitor Register */}
          <button
            type="button"
            onClick={() => navigate('/reception')}
            className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-lg border border-gray-200 bg-gray-50/60 hover:bg-gray-100/80 text-gray-800 transition text-left cursor-pointer group active:scale-98"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
              <Users size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">Visitor Register</span>
              <span className="text-[10px] text-gray-500 block truncate">Full log & history</span>
            </div>
          </button>

          {/* Action 4: Daily Report */}
          <button
            type="button"
            onClick={() => setIsReportsOpen(true)}
            className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100/60 text-purple-900 transition text-left cursor-pointer group active:scale-98"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
              <BarChart3 size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">Daily Report</span>
              <span className="text-[10px] text-purple-700/80 block truncate">Analytics & export</span>
            </div>
          </button>

        </div>
      </div>

      {/* 4. Daily Visitor Trends (Bar Chart with Filters) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-3">
        {/* Header & Metric Badges */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp size={14} />
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-gray-900">
                Daily Visitor Trends
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {rangeLabelText}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Visitor registrations per calendar day (including active and completed visits).
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

        {/* Graph Filters Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Time Range Pills */}
          <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/80 text-xs flex-wrap">
            {[
              { id: '7', label: 'Last 7 Days' },
              { id: '14', label: 'Last 14 Days' },
              { id: '30', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' }
            ].map(tab => (
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

          {/* Location & Purpose Dropdown Filters + Reset */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Location Filter */}
            <select
              value={trendLocation}
              onChange={(e) => setTrendLocation(e.target.value)}
              className="text-xs h-[30px] px-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer shadow-2xs"
            >
              <option value="all">All Locations</option>
              <option value="Office">Corporate Office</option>
              <option value="Construction Site">Construction Site</option>
            </select>

            {/* Purpose Filter */}
            <select
              value={trendPurpose}
              onChange={(e) => setTrendPurpose(e.target.value)}
              className="text-xs h-[30px] px-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer shadow-2xs"
            >
              <option value="all">All Purposes</option>
              <option value="Meeting">Meeting</option>
              <option value="Site Visit">Site Visit</option>
              <option value="Supply Item">Supply Item</option>
              <option value="Broking">Broking</option>
              <option value="Other">Other</option>
            </select>

            {/* Reset Filters Button */}
            {(trendRange !== '7' || trendLocation !== 'all' || trendPurpose !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setTrendRange('7');
                  setTrendLocation('all');
                  setTrendPurpose('all');
                }}
                title="Reset graph filters"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Chart Area */}
        <div className="w-full">
          {loading ? (
            <div className="h-[210px] flex flex-col items-center justify-center text-gray-400">
              <RefreshCw size={20} className="animate-spin text-indigo-600 mb-1.5" />
              <span className="text-xs">Loading trends data...</span>
            </div>
          ) : (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredTrendData}
                  margin={{ top: 16, right: 12, left: -22, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortLabel"
                    interval={filteredTrendData.length > 20 ? 3 : (filteredTrendData.length > 10 ? 1 : 0)}
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
                    maxBarSize={filteredTrendData.length > 14 ? 26 : 42}
                  >
                    {filteredTrendData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isToday ? '#4f46e5' : '#818cf8'}
                        className="transition-opacity hover:opacity-85"
                      />
                    ))}
                    <LabelList
                      dataKey="visitors"
                      position="top"
                      formatter={(val) => (val > 0 ? val : (filteredTrendData.length <= 7 ? 0 : ''))}
                      style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Legend / Helper Footer */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
              <span className="font-medium text-gray-600">Today</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-400" />
              <span className="font-medium text-gray-600">Previous Days</span>
            </span>
          </div>
          <span className="text-[10px] text-gray-400">
            {trendLocation !== 'all' || trendPurpose !== 'all' ? (
              <span className="font-semibold text-indigo-600">
                Filtered: {trendLocation !== 'all' ? trendLocation : ''} {trendLocation !== 'all' && trendPurpose !== 'all' ? '• ' : ''}{trendPurpose !== 'all' ? trendPurpose : ''}
              </span>
            ) : (
              '*Excludes cancelled registrations.'
            )}
          </span>
        </div>
      </div>

      {/* 5. Today's Visitor Summary (Pure Numbers - No Graphs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        
        {/* Panel A: Breakdown by Purpose (Today) */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Briefcase size={15} className="text-indigo-600" />
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Visits by Purpose (Today)
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {stats.totalToday} total
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { key: 'Meeting', label: 'Meeting', count: stats.todayPurposeCounts?.Meeting || 0, badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                { key: 'Site Visit', label: 'Site Visit', count: stats.todayPurposeCounts?.['Site Visit'] || 0, badge: 'bg-amber-50 text-amber-700 border-amber-200' },
                { key: 'Supply Item', label: 'Supply Item', count: stats.todayPurposeCounts?.['Supply Item'] || 0, badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                { key: 'Broking', label: 'Broking', count: stats.todayPurposeCounts?.Broking || 0, badge: 'bg-purple-50 text-purple-700 border-purple-200' },
                { key: 'Other', label: 'Other', count: stats.todayPurposeCounts?.Other || 0, badge: 'bg-gray-50 text-gray-700 border-gray-200' }
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={() => navigate('/reception', { state: { dateFilter: 'today', purposeFilter: item.key, statusFilter: 'all' } })}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50/70 hover:bg-gray-100 border border-gray-100 transition cursor-pointer group"
                  title={`View today's ${item.label} visits`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.key === 'Meeting' ? 'bg-indigo-500' : item.key === 'Site Visit' ? 'bg-amber-500' : item.key === 'Supply Item' ? 'bg-cyan-500' : item.key === 'Broking' ? 'bg-purple-500' : 'bg-gray-400'}`} />
                    <span className="text-xs font-semibold text-gray-800 group-hover:text-indigo-600 transition">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-gray-900 group-hover:text-indigo-600 transition">
                      {item.count}
                    </span>
                    <ChevronRight size={12} className="text-gray-400 group-hover:text-indigo-500 transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel B: Breakdown by Location (Today) */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-indigo-600" />
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Visits by Location (Today)
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {stats.totalToday} total
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Corporate Office */}
              <div
                onClick={() => navigate('/reception', { state: { dateFilter: 'today', locationFilter: 'Office', statusFilter: 'all' } })}
                className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-100/50 transition cursor-pointer flex flex-col justify-between group shadow-2xs"
                title="View today's Corporate Office visits"
              >
                <div className="flex items-center justify-between text-indigo-700">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Building2 size={14} />
                    Corporate Office
                  </span>
                  <ChevronRight size={13} className="text-indigo-400 group-hover:text-indigo-700 transition" />
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-black text-indigo-950">
                    {stats.todayLocationCounts?.Office || 0}
                  </span>
                  <span className="text-[10px] text-indigo-700 block font-medium mt-0.5">
                    Visitors at head office
                  </span>
                </div>
              </div>

              {/* Construction Site */}
              <div
                onClick={() => navigate('/reception', { state: { dateFilter: 'today', locationFilter: 'Construction Site', statusFilter: 'all' } })}
                className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-100/50 transition cursor-pointer flex flex-col justify-between group shadow-2xs"
                title="View today's Construction Site visits"
              >
                <div className="flex items-center justify-between text-amber-700">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <MapPin size={14} />
                    Construction Site
                  </span>
                  <ChevronRight size={13} className="text-amber-400 group-hover:text-amber-700 transition" />
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-black text-amber-950">
                    {stats.todayLocationCounts?.['Construction Site'] || 0}
                  </span>
                  <span className="text-[10px] text-amber-700 block font-medium mt-0.5">
                    On-site inspections & visits
                  </span>
                </div>
              </div>
            </div>

            {/* Quick summary line */}
            <div className="mt-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-600 flex items-center justify-between">
              <span>Ratio: Office vs Sites</span>
              <span className="font-bold text-gray-900">
                {stats.todayLocationCounts?.Office || 0} : {stats.todayLocationCounts?.['Construction Site'] || 0}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 5. Visitors Currently Inside Table */}
      <div
        ref={insideTableRef}
        className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex flex-col transition duration-300"
      >
        {/* Table Section Header */}
        <div className="p-3 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Visitors Currently Inside
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {insideVisitors.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Visitors checked in but not yet checked out. Click "Check Out" upon departure.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/reception', { state: { dateFilter: 'all', statusFilter: 'CHECKED_IN' } })}
              className="inline-flex items-center gap-1 text-xs text-indigo-200 hover:text-white transition font-medium"
            >
              <span>Open in Register</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-500">
            <RefreshCw size={24} className="animate-spin text-indigo-600 mb-2" />
            <p className="text-xs">Loading on-premise visitors...</p>
          </div>
        ) : insideVisitors.length === 0 ? (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center text-gray-500">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-sm font-bold text-gray-900">No visitors currently inside</h4>
            <p className="text-xs text-gray-500 mt-0.5 max-w-sm">
              All visitors have checked out. When a new visitor checks in, they will appear here.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
              >
                <UserPlus size={13} />
                <span>Register New Visitor</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Action</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Visitor Name</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Contact Number</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Visit Purpose</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Office / Site</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Person to Meet</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Check-In Time</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Time Spent</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {insideVisitors.map((item, idx) => {
                  const duration = getVisitDuration(item.checkInAt, null);
                  return (
                    <tr
                      key={item.id || idx}
                      onClick={() => setDetailsVisitor(item)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Action */}
                      <td
                        className="px-2 py-2 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setCheckoutVisitor(item)}
                              title="Process Check-Out"
                              aria-label="Check Out"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <LogOut size={12} />
                              <span>Check Out</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDetailsVisitor(item)}
                            title="View Visitor Details"
                            aria-label="View Details"
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-700 hover:text-white transition active:scale-95 cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>

                      {/* Visitor Name */}
                      <td className="px-3 py-2 text-left whitespace-nowrap max-w-[200px] truncate" title={item.visitorName}>
                        <div className="flex flex-col items-start truncate">
                          <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition truncate">
                            {item.visitorName}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {item.companyName && (
                              <span className="text-[10px] text-gray-500 truncate max-w-[130px]">
                                {item.companyName}
                              </span>
                            )}
                            {item.visitorType && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                {item.visitorType}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Number */}
                      <td
                        className="px-3 py-2 text-left whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${cleanPhone(item.mobileNumber)}`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
                          >
                            <Phone size={11} className="text-gray-400" />
                            {item.mobileNumber}
                          </a>
                          <button
                            type="button"
                            onClick={(e) => handleWhatsApp(item, e)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                            title="Send WhatsApp"
                          >
                            WA
                          </button>
                        </div>
                      </td>

                      {/* Visit Purpose */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PURPOSE_STYLES[item.visitPurpose] || PURPOSE_STYLES.Other}`}>
                          {item.visitPurpose}
                        </span>
                      </td>

                      {/* Office / Site */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 text-gray-800 font-medium">
                            <MapPin size={11} className={item.visitLocation === 'Construction Site' ? 'text-amber-500' : 'text-indigo-500'} />
                            {item.visitLocation}
                          </span>
                          {item.projectName && (
                            <span className="text-[10px] font-bold text-amber-700 truncate max-w-[130px]" title={item.projectName}>
                              {item.projectName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Person to Meet */}
                      <td className="px-3 py-2 text-center whitespace-nowrap max-w-[170px] truncate" title={item.personToMeetName}>
                        <div className="inline-flex flex-col items-center truncate">
                          <span className="font-semibold text-gray-900 truncate">
                            {item.personToMeetName || '-'}
                          </span>
                          {item.department && (
                            <span className="text-[10px] text-gray-400 truncate">
                              {item.department}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Check-In Time */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-bold text-gray-800">
                            {formatVisitorTime(item.checkInAt)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatVisitorDate(item.checkInAt)}
                          </span>
                        </div>
                      </td>

                      {/* Time Spent */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock size={11} className="text-amber-600" />
                          {duration}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Inside
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALS */}
      
      {/* 1. New Visitor Modal */}
      {isNewModalOpen && (
        <NewVisitorModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSaved={handleCreateVisitor}
        />
      )}

      {/* 2. Check-Out Modal */}
      {checkoutVisitor && (
        <CheckOutModal
          isOpen={Boolean(checkoutVisitor)}
          visitor={checkoutVisitor}
          onClose={() => setCheckoutVisitor(null)}
          onConfirm={handleConfirmCheckout}
        />
      )}

      {/* 3. Visitor Details Modal */}
      {detailsVisitor && (
        <VisitorDetailsModal
          isOpen={Boolean(detailsVisitor)}
          visitor={detailsVisitor}
          onClose={() => setDetailsVisitor(null)}
          onCheckOutClick={(v) => {
            setDetailsVisitor(null);
            setCheckoutVisitor(v);
          }}
        />
      )}

      {/* 4. Reception Reports Modal */}
      {isReportsOpen && (
        <ReceptionReportsModal
          isOpen={isReportsOpen}
          onClose={() => setIsReportsOpen(false)}
          stats={stats}
          visitors={visitors}
          onExportExcel={handleExportExcel}
        />
      )}

    </div>
  );
}
