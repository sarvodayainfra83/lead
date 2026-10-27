import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  UserPlus, Search, RefreshCw, X, RotateCcw, FileSpreadsheet, Eye, LogOut,
  Pencil, Phone, Calendar, Clock, MapPin, User,
  CheckCircle2, AlertCircle, BarChart3, ChevronDown, ChevronUp, UserCheck
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import NewVisitorModal from './NewVisitorModal';
import VisitorDetailsModal from './VisitorDetailsModal';
import EditVisitorModal from './EditVisitorModal';
import ReceptionReportsModal from './ReceptionReportsModal';
import VisitBreakdownChips from './VisitBreakdownChips';
import DateInput from '../../components/DateInput';
import { visitorApi } from '../../api/visitorApi';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, isUserAdmin } from '../../utils/authUtils';
import {
  VISIT_PURPOSE_OPTIONS,
  VISIT_LOCATION_OPTIONS,
  PURPOSE_STYLES,
  getPurposeKey,
  VISITOR_TYPE_OPTIONS,
  getVisitorTypeKey,
  DATE_FILTER_OPTIONS,
  formatVisitorDate,
  formatVisitorTime,
  emptyCounts
} from './receptionConstants';

// Helper for matching date filter across records & KPIs
const matchesDateFilter = (checkInAt, filterType, fromDate, toDate) => {
  if (filterType === 'all') return true;
  if (!checkInAt) return false;
  const d = new Date(checkInAt);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Start of week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (filterType === 'today') {
    return itemDate.getTime() === today.getTime();
  }
  if (filterType === 'yesterday') {
    return itemDate.getTime() === yesterday.getTime();
  }
  if (filterType === 'week') {
    return itemDate.getTime() >= startOfWeek.getTime();
  }
  if (filterType === 'month') {
    return itemDate.getTime() >= startOfMonth.getTime();
  }
  if (filterType === 'custom') {
    if (!fromDate && !toDate) return true;
    let fromMs = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : null;
    let toMs = toDate ? new Date(toDate + 'T23:59:59.999').getTime() : null;
    const time = d.getTime();
    if (fromMs && !isNaN(fromMs) && time < fromMs) return false;
    if (toMs && !isNaN(toMs) && time > toMs) return false;
    return true;
  }
  return true;
};

const getDateFilterLabel = (filter) => {
  switch (filter) {
    case 'today':
      return 'Visitors Today';
    case 'yesterday':
      return 'Visitors Yesterday';
    case 'week':
      return 'Visitors This Week';
    case 'month':
      return 'Visitors This Month';
    case 'custom':
      return 'Filtered Visitors';
    default:
      return 'Total Visitors';
  }
};

const getCategoryBreakdownTitle = (filter) => {
  switch (filter) {
    case 'today':
      return 'Category Today';
    case 'yesterday':
      return 'Category Yesterday';
    case 'week':
      return 'Category (This Week)';
    case 'month':
      return 'Category (This Month)';
    case 'custom':
      return 'Category (Filtered)';
    default:
      return 'Category Breakdown';
  }
};

export default function Reception() {
  const { user } = useAuthStore();
  const location = useLocation();
  const initFilters = location.state || {};
  const isAdmin = isUserAdmin(user);
  const canEdit = hasFullAccess(user, 'reception') || isAdmin;

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States (initialized from location.state if navigated with params)
  const [searchQuery, setSearchQuery] = useState(initFilters.searchQuery || '');
  const [dateFilter, setDateFilter] = useState(initFilters.dateFilter || 'today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [purposeFilter, setPurposeFilter] = useState(initFilters.purposeFilter || 'all');
  const [locationFilter, setLocationFilter] = useState(initFilters.locationFilter || 'all');
  const [categoryFilter, setCategoryFilter] = useState(initFilters.categoryFilter || 'all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [detailsVisitor, setDetailsVisitor] = useState(null);
  const [editVisitor, setEditVisitor] = useState(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [showKpiCards, setShowKpiCards] = useState(true);

  // Mobile accordion expand set
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());
  const toggleCardExpand = (id) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Load visitors data
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

  // Sync state if navigated with filters from Receptionist Dashboard
  useEffect(() => {
    if (location.state) {
      if (location.state.dateFilter !== undefined) setDateFilter(location.state.dateFilter);
      if (location.state.purposeFilter !== undefined) setPurposeFilter(location.state.purposeFilter);
      if (location.state.locationFilter !== undefined) setLocationFilter(location.state.locationFilter);
      if (location.state.categoryFilter !== undefined) setCategoryFilter(location.state.categoryFilter);
      if (location.state.searchQuery !== undefined) setSearchQuery(location.state.searchQuery);
      if (location.state.openNewModal) setIsNewModalOpen(true);
      if (location.state.openReports) setIsReportsOpen(true);
      setCurrentPage(1);
    }
  }, [location.state]);

  // Real-time Dashboard KPI stats (calculated from all actual visitor records)
  const stats = useMemo(() => {
    return visitorApi.calculateStats(visitors);
  }, [visitors]);

  // Dynamic KPI counts & category breakdown scoped to the active date filter
  const dateScopedStats = useMemo(() => {
    const purposeCounts = emptyCounts(VISIT_PURPOSE_OPTIONS);
    const typeCounts = emptyCounts(VISITOR_TYPE_OPTIONS);
    let total = 0;

    (visitors || []).forEach(v => {
      if (!matchesDateFilter(v.checkInAt, dateFilter, customFrom, customTo)) return;

      total++;
      const pKey = getPurposeKey(v.visitPurpose);
      if (purposeCounts[pKey] !== undefined) {
        purposeCounts[pKey]++;
      } else {
        purposeCounts.Other = (purposeCounts.Other || 0) + 1;
      }

      const tKey = getVisitorTypeKey(v.visitorType);
      if (typeCounts[tKey] !== undefined) {
        typeCounts[tKey]++;
      } else {
        typeCounts.Other = (typeCounts.Other || 0) + 1;
      }
    });

    return {
      total,
      purposeCounts,
      typeCounts
    };
  }, [visitors, dateFilter, customFrom, customTo]);

  // Filtering records
  const filteredVisitors = useMemo(() => {
    let list = visitors || [];

    // Search query (Visitor Name, Phone, Company, Person to Meet)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(v => (
        (v.visitorName && v.visitorName.toLowerCase().includes(q)) ||
        (v.mobileNumber && v.mobileNumber.includes(q)) ||
        (v.companyName && v.companyName.toLowerCase().includes(q)) ||
        (v.personToMeetName && v.personToMeetName.toLowerCase().includes(q)) ||
        (v.projectName && v.projectName.toLowerCase().includes(q)) ||
        (v.remarks && v.remarks.toLowerCase().includes(q))
      ));
    }

    // Purpose filter
    if (purposeFilter !== 'all') {
      list = list.filter(v => getPurposeKey(v.visitPurpose) === purposeFilter);
    }

    // Visitor category filter
    if (categoryFilter !== 'all') {
      list = list.filter(v => getVisitorTypeKey(v.visitorType) === categoryFilter);
    }

    // Location filter
    if (locationFilter !== 'all') {
      list = list.filter(v => v.visitLocation === locationFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      list = list.filter(v => matchesDateFilter(v.checkInAt, dateFilter, customFrom, customTo));
    }

    return list;
  }, [visitors, searchQuery, purposeFilter, categoryFilter, locationFilter, dateFilter, customFrom, customTo]);

  // Count active filters
  const activeFiltersCount =
    (purposeFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (locationFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'today' ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFilter('today');
    setCustomFrom('');
    setCustomTo('');
    setPurposeFilter('all');
    setCategoryFilter('all');
    setLocationFilter('all');
    setCurrentPage(1);
    toast.success("Filters reset to Today's Visitors");
  }, []);

  // Quick filter from KPI cards: optionally of one purpose ('all' = every purpose)
  const applyKpiFilter = (purpose) => {
    setCurrentPage(1);
    setPurposeFilter(purpose);
    setCategoryFilter('all');
    setLocationFilter('all');
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (!filteredVisitors || filteredVisitors.length === 0) {
      toast.error('No visitor records to export');
      return;
    }

    const exportData = filteredVisitors.map((item, idx) => ({
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
      'Visit Date': formatVisitorDate(item.checkInAt),
      'Arrival Time': formatVisitorTime(item.checkInAt),
      'Checked-In By': item.checkedInBy || '-',
      'Remarks': item.remarks || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitor Register');
    const filename = `Visitor_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success('Visitor register exported to Excel');
  };

  // Edit save handler
  const handleSaveEdit = async (visitorId, updates) => {
    await visitorApi.updateVisitor(visitorId, updates);
    loadData();
  };

  // New registration handler
  const handleCreateVisitor = async (payload) => {
    await visitorApi.registerVisitor(payload, user);
    loadData();
  };

  const handleVisitorUpdated = useCallback((updated) => {
    if (!updated?.id) return;
    setVisitors((prev) => prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
    setDetailsVisitor((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

  // Table Headers
  const tableHeaders = [
    "Action",
    "Visitor Name",
    "Contact",
    "Visit Purpose",
    "Office / Site",
    "Person to Meet",
    "Visit Date & Time"
  ];

  // Pagination calculation
  const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage) || 1;
  const paginatedVisitors = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVisitors.slice(start, start + itemsPerPage);
  }, [filteredVisitors, currentPage, itemsPerPage]);

  const cleanPhone = (num) => String(num || '').replace(/[^0-9]/g, '');

  const handleWhatsApp = (item, e) => {
    e?.stopPropagation?.();
    const phone = cleanPhone(item.mobileNumber);
    if (!phone) return;
    const phoneWithCountry = phone.startsWith('91') ? phone : `91${phone}`;
    const msg = encodeURIComponent(`Hello ${item.visitorName}, thank you for visiting Sarvodaya Infracon.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank');
  };

  // Render Table Row (Desktop)
  const renderRow = (item, idx) => {
    return (
      <tr
        key={item.id || idx}
        onClick={() => setDetailsVisitor(item)}
        className="group cursor-pointer transition-colors border-b border-gray-100 hover:bg-indigo-50/40"
      >
        {/* Action column */}
        <td className="px-2 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center">
            {/* View Details */}
            <button
              onClick={() => setDetailsVisitor(item)}
              title="View full visitor details"
              aria-label="View Details"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-600 hover:text-white transition active:scale-95 cursor-pointer"
            >
              <Eye size={13} />
            </button>
          </div>
        </td>

        {/* 1. Visitor Name */}
        <td className="px-3 py-2 text-left text-xs font-bold whitespace-nowrap max-w-[200px] truncate" title={item.visitorName}>
          <div className="flex flex-col items-start gap-0.5 truncate">
            <span className="text-gray-900 truncate hover:text-indigo-600 transition">
              {item.visitorName}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {item.companyName && (
                <span className="text-[10px] font-normal text-gray-500 truncate max-w-[130px]">
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

        {/* 2. Contact */}
        <td className="px-3 py-2 text-center text-xs text-gray-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1.5">
            <a
              href={`tel:${cleanPhone(item.mobileNumber)}`}
              className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-medium"
            >
              <Phone size={11} className="text-gray-400" />
              {item.mobileNumber}
            </a>
            <button
              onClick={(e) => handleWhatsApp(item, e)}
              className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
              title="Send WhatsApp"
            >
              WA
            </button>
          </div>
        </td>

        {/* 3. Visit Purpose */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${PURPOSE_STYLES[getPurposeKey(item.visitPurpose)] || PURPOSE_STYLES.Other}`}>
            {item.visitPurpose}
          </span>
        </td>

        {/* 4. Office / Site */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          <div className="inline-flex flex-col items-center">
            <span className="inline-flex items-center gap-1 text-gray-800 font-medium">
              <MapPin size={11} className={item.visitLocation === 'Construction Site' ? 'text-amber-500' : 'text-indigo-500'} />
              {item.visitLocation}
            </span>
            {item.projectName && (
              <span className="text-[10px] font-bold text-amber-700 truncate max-w-[140px]" title={item.projectName}>
                {item.projectName}
              </span>
            )}
          </div>
        </td>

        {/* 5. Person to Meet */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap max-w-[180px] truncate" title={item.personToMeetName}>
          <div className="inline-flex flex-col items-center">
            <span className="font-semibold text-gray-900 truncate">
              {item.personToMeetName || '-'}
            </span>
          </div>
        </td>

        {/* 6. Visit Date & Time */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
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
  };

  // Render Mobile Card View
  const renderCard = (item, idx) => {
    const isExpanded = expandedCardIds.has(item.id || idx);

    return (
      <div
        key={item.id || idx}
        className={`bg-white rounded-xl border transition shadow-2xs p-3.5 space-y-2.5 ${
          isExpanded ? 'border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/10' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        {/* Card Header: Visitor Name, Company & Visit Date */}
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
          <div className="min-w-0 flex-1">
            <h4
              onClick={() => setDetailsVisitor(item)}
              className="font-bold text-sm text-gray-900 truncate cursor-pointer hover:text-indigo-600 leading-tight"
            >
              {item.visitorName || 'Unnamed Visitor'}
            </h4>
            {item.companyName && (
              <span className="text-[11px] text-gray-500 block truncate mt-0.5">{item.companyName}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
              {formatVisitorDate(item.checkInAt)}
            </span>
          </div>
        </div>

        {/* Primary Info Grid: Contact, Host, Purpose, Visit Time */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Contact</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <a href={`tel:${cleanPhone(item.mobileNumber)}`} className="font-bold text-indigo-600 hover:underline">
                {item.mobileNumber || '-'}
              </a>
              {item.mobileNumber && (
                <button
                  type="button"
                  onClick={(e) => handleWhatsApp(item, e)}
                  className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                  title="Open WhatsApp chat"
                >
                  WA
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Host Person</span>
            <span className="font-bold text-gray-800 mt-0.5 block truncate">
              {item.personToMeetName || '-'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Purpose</span>
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${PURPOSE_STYLES[getPurposeKey(item.visitPurpose)] || PURPOSE_STYLES.Other}`}>
              {item.visitPurpose || 'Other'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Visit Time</span>
            <span className="font-bold text-gray-800 mt-0.5 block">
              {formatVisitorTime(item.checkInAt)}
            </span>
          </div>
        </div>

        {/* Visit Location Banner */}
        <div className="flex items-center justify-between text-[11px] text-gray-700 bg-gray-50/80 p-2 rounded-lg border border-gray-100">
          <div>
            <span className="text-gray-400 block text-[9.5px] uppercase font-semibold">Location:</span>
            <span className="font-bold text-gray-800">{item.visitLocation || 'Corporate Office'}</span>
          </div>
          {item.projectName && (
            <div className="text-right">
              <span className="text-gray-400 block text-[9.5px] uppercase font-semibold">Project:</span>
              <span className="font-bold text-amber-800">{item.projectName}</span>
            </div>
          )}
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="pt-2 border-t border-gray-100 text-xs space-y-1.5 animate-in fade-in duration-150">
            {item.remarks && (
              <div>
                <span className="text-gray-400">Remarks:</span>{' '}
                <span className="text-gray-700 italic">{item.remarks}</span>
              </div>
            )}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
          <button
            type="button"
            onClick={() => toggleCardExpand(item.id || idx)}
            className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{isExpanded ? 'Less' : 'More Details'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDetailsVisitor(item)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95 cursor-pointer"
            >
              View
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full md:h-full md:min-h-0 bg-gray-50/50 p-2 sm:p-3 md:p-4 gap-2.5 sm:gap-3">
      
      {/* Top Banner / Header Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0 bg-white p-3 sm:p-3.5 rounded-xl border border-gray-200 shadow-2xs">
        <div>
          <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <UserCheck size={16} />
            </span>
            Reception / Visitor Management
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
            Real-time office and construction site visitor registration, host coordination & departure logs.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh records"
            className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[34px] w-[34px] transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* Reports & Analytics Modal Button */}
          <button
            type="button"
            onClick={() => setIsReportsOpen(true)}
            title="View visitor breakdown and analytics"
            className="inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold h-[34px] bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition shadow-2xs active:scale-95 cursor-pointer"
          >
            <BarChart3 size={14} className="text-slate-600" />
            <span className="hidden sm:inline">Reports & Analytics</span>
          </button>

          {/* Export to Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            title="Export filtered records to Excel"
            className="inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold h-[34px] bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition shadow-2xs active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {/* + New Visitor Primary Action Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-bold h-[34px] bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm active:scale-95 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ New Visitor</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile KPI Summary Toggle Bar */}
      <div className="flex items-center justify-between md:hidden px-0.5">
        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 size={13} className="text-indigo-600" />
          Visitor Summary
        </span>
        <button
          type="button"
          onClick={() => setShowKpiCards(prev => !prev)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 active:scale-95 transition cursor-pointer"
        >
          {showKpiCards ? (
            <>
              <ChevronUp size={12} />
              <span>Enlarge Records List</span>
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              <span>Show Summary Cards</span>
            </>
          )}
        </button>
      </div>

      {/* Compact Quick-Pill Bar (shown when KPI cards are collapsed on mobile) */}
      {!showKpiCards && (
        <div className="flex flex-wrap items-center gap-1.5 md:hidden text-xs animate-in fade-in duration-150">
          {[{ value: 'all', label: getDateFilterLabel(dateFilter), count: dateScopedStats.total }, ...VISIT_PURPOSE_OPTIONS.map(opt => ({
            value: opt.value,
            label: opt.label,
            count: dateScopedStats.purposeCounts?.[opt.value] || 0
          }))].map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => applyKpiFilter(p.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shrink-0 font-bold active:scale-95 ${
                purposeFilter === p.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <span>{p.label}:</span>
              <span className="bg-white px-1.5 py-0.2 rounded-full text-[10px] text-indigo-900 font-extrabold">{p.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* KPIs: total visitors + one tile per visit purpose (click to filter) */}
      <div className={`${showKpiCards ? 'grid' : 'hidden md:grid'} grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 flex-shrink-0 animate-in fade-in duration-200`}>
        {[
          {
            value: 'all',
            label: getDateFilterLabel(dateFilter),
            count: dateScopedStats.total,
            dot: 'bg-indigo-500'
          },
          ...VISIT_PURPOSE_OPTIONS.map(opt => ({
            value: opt.value,
            label: opt.label,
            count: dateScopedStats.purposeCounts?.[opt.value] || 0,
            dot: opt.dot
          }))
        ].map(t => {
          const isActive = purposeFilter === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => applyKpiFilter(t.value)}
              className={`text-left p-2.5 sm:p-3 rounded-xl border transition cursor-pointer shadow-2xs flex flex-col justify-between h-full ${
                isActive ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30'
              }`}
            >
              <span className="min-h-[26px] sm:min-h-[28px] text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-gray-500 flex items-start gap-1.5 leading-tight">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[3px] ${t.dot}`} />
                <span className="line-clamp-2">{t.label}</span>
              </span>
              <span className="mt-1.5 text-xl sm:text-2xl font-black text-gray-900">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Counts by Visitor Category (click to filter) */}
      <div className={`${showKpiCards ? 'flex' : 'hidden md:flex'} bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex-shrink-0`}>
        <VisitBreakdownChips
          title={getCategoryBreakdownTitle(dateFilter)}
          icon={User}
          options={VISITOR_TYPE_OPTIONS}
          counts={dateScopedStats.typeCounts}
          active={categoryFilter}
          onSelect={(val) => { setCategoryFilter(val); setCurrentPage(1); }}
        />
      </div>

      {/* Filter & Search Bar Strip */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-gray-200 shadow-2xs flex-shrink-0 flex items-center justify-between gap-2 flex-wrap text-xs">
        
        {/* Left Side: Search + Dropdowns */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 flex-1 min-w-0">

          {/* Search Box */}
          <div className="relative w-full sm:min-w-[220px] sm:flex-1 sm:max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor, phone, company, host..."
              className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Dropdown Filters: equal-width grid on mobile, inline row on larger screens */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            {/* Date Filter Dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPurposeFilter('all');
                setCategoryFilter('all');
                setLocationFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto min-w-0 truncate border border-gray-200 rounded-lg px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              {DATE_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Purpose Filter Dropdown */}
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="w-full sm:w-auto min-w-0 truncate border border-gray-200 rounded-lg px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="all">All Purposes</option>
              {VISIT_PURPOSE_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Visitor Category Filter Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto min-w-0 truncate border border-gray-200 rounded-lg px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="all">All Categories</option>
              {VISITOR_TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Location Filter Dropdown */}
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="min-w-0 truncate border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer hidden md:inline-block"
            >
              <option value="all">All Locations</option>
              {VISIT_LOCATION_OPTIONS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Pickers (when custom is picked) */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1 w-full sm:w-auto animate-in fade-in duration-150">
              <DateInput
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full sm:w-auto border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white h-[34px]"
              />
              <span className="text-gray-400 shrink-0">to</span>
              <DateInput
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full sm:w-auto border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white h-[34px]"
              />
            </div>
          )}

          {/* Active filters indicator and Clear button */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer h-[34px] shrink-0"
            >
              <RotateCcw size={12} />
              <span>Reset Filters ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner when Today has 0 records but past records exist */}
      {dateFilter === 'today' && filteredVisitors.length === 0 && visitors.length > 0 && !loading && (
        <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-indigo-950">
                0 visitors recorded for Today
              </p>
              <p className="text-[11px] sm:text-xs text-indigo-700 mt-0.5">
                You have <strong className="font-bold text-indigo-900">{visitors.length} total visitor record{visitors.length > 1 ? 's' : ''}</strong> available on earlier dates.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setDateFilter('all'); setCurrentPage(1); }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Eye size={13} />
            <span>View All Visitors ({visitors.length})</span>
          </button>
        </div>
      )}

      {/* Main Visitor Register Data Table */}
      <div className={`bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex flex-col transition-all duration-300 ${
        showKpiCards ? 'flex-1 min-h-[500px] md:min-h-0' : 'flex-1 min-h-[640px] md:min-h-0'
      }`}>
        <DataTable
          headers={tableHeaders}
          data={paginatedVisitors}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="min-w-[950px]"
          loading={loading}
          loadingText="Loading visitor records..."
          totalResults={filteredVisitors.length}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => {
            setItemsPerPage(val);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Modals */}
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
          onClose={() => setDetailsVisitor(null)}
          visitor={detailsVisitor}
          onVisitorUpdated={handleVisitorUpdated}
        />
      )}

      {editVisitor && (
        <EditVisitorModal
          isOpen={Boolean(editVisitor)}
          onClose={() => setEditVisitor(null)}
          visitor={editVisitor}
          onSave={handleSaveEdit}
        />
      )}

      {isReportsOpen && (
        <ReceptionReportsModal
          isOpen={isReportsOpen}
          onClose={() => setIsReportsOpen(false)}
          stats={stats}
          visitors={filteredVisitors}
          onExportExcel={handleExportExcel}
        />
      )}
    </div>
  );
}
