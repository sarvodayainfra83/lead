import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  UserPlus, Search, RefreshCw, X, RotateCcw, FileSpreadsheet, Eye, LogOut,
  Pencil, Phone, Calendar, Clock, MapPin, Building2, Briefcase, User,
  CheckCircle2, AlertCircle, BarChart3, ChevronDown, ChevronUp, UserCheck
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import NewVisitorModal from './NewVisitorModal';
import CheckOutModal from './CheckOutModal';
import VisitorDetailsModal from './VisitorDetailsModal';
import EditVisitorModal from './EditVisitorModal';
import ReceptionReportsModal from './ReceptionReportsModal';
import { visitorApi } from '../../api/visitorApi';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, isUserAdmin } from '../../utils/authUtils';
import {
  VISIT_PURPOSE_OPTIONS,
  VISIT_LOCATION_OPTIONS,
  VISITOR_STATUS_MAP,
  PURPOSE_STYLES,
  DATE_FILTER_OPTIONS,
  formatVisitorDate,
  formatVisitorTime,
  getVisitDuration
} from './receptionConstants';

export default function Reception() {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);
  const canEdit = hasFullAccess(user, 'reception') || isAdmin;

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [checkoutVisitor, setCheckoutVisitor] = useState(null);
  const [detailsVisitor, setDetailsVisitor] = useState(null);
  const [editVisitor, setEditVisitor] = useState(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

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

  // Real-time Dashboard KPI stats (calculated from all actual visitor records)
  const stats = useMemo(() => {
    return visitorApi.calculateStats(visitors);
  }, [visitors]);

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
        (v.personActuallyMetName && v.personActuallyMetName.toLowerCase().includes(q)) ||
        (v.projectName && v.projectName.toLowerCase().includes(q)) ||
        (v.remarks && v.remarks.toLowerCase().includes(q))
      ));
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(v => v.status === statusFilter);
    }

    // Purpose filter
    if (purposeFilter !== 'all') {
      list = list.filter(v => v.visitPurpose === purposeFilter);
    }

    // Location filter
    if (locationFilter !== 'all') {
      list = list.filter(v => v.visitLocation === locationFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Start of week (Sunday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      // Start of month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      list = list.filter(v => {
        if (!v.checkInAt) return false;
        const d = new Date(v.checkInAt);
        if (isNaN(d.getTime())) return false;
        const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (dateFilter === 'today') {
          return itemDate.getTime() === today.getTime();
        }
        if (dateFilter === 'yesterday') {
          return itemDate.getTime() === yesterday.getTime();
        }
        if (dateFilter === 'week') {
          return itemDate.getTime() >= startOfWeek.getTime();
        }
        if (dateFilter === 'month') {
          return itemDate.getTime() >= startOfMonth.getTime();
        }
        if (dateFilter === 'custom') {
          if (!customFrom && !customTo) return true;
          let fromMs = customFrom ? new Date(customFrom).setHours(0, 0, 0, 0) : null;
          let toMs = customTo ? new Date(customTo).setHours(23, 59, 59, 999) : null;
          const time = d.getTime();
          if (fromMs && time < fromMs) return false;
          if (toMs && time > toMs) return false;
          return true;
        }
        return true;
      });
    }

    return list;
  }, [visitors, searchQuery, statusFilter, purposeFilter, locationFilter, dateFilter, customFrom, customTo]);

  // Count active filters
  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) +
    (purposeFilter !== 'all' ? 1 : 0) +
    (locationFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'today' ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFilter('today');
    setCustomFrom('');
    setCustomTo('');
    setStatusFilter('all');
    setPurposeFilter('all');
    setLocationFilter('all');
    setCurrentPage(1);
    toast.success('Filters reset to Today');
  }, []);

  // Quick filter from KPI cards
  const applyKpiFilter = (type) => {
    setCurrentPage(1);
    if (type === 'today') {
      setDateFilter('today');
      setStatusFilter('all');
      setPurposeFilter('all');
    } else if (type === 'inside') {
      setStatusFilter('CHECKED_IN');
      setDateFilter('all');
    } else if (type === 'meetings') {
      setDateFilter('today');
      setPurposeFilter('Meeting');
      setStatusFilter('all');
    } else if (type === 'siteVisits') {
      setDateFilter('today');
      setPurposeFilter('Site Visit');
      setStatusFilter('all');
    } else if (type === 'awaiting') {
      setStatusFilter('CHECKED_IN');
    }
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

  // Check-out handler
  const handleConfirmCheckout = async (visitorId, payload) => {
    await visitorApi.checkOutVisitor(visitorId, payload, user);
    loadData();
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

  // Table Headers
  const tableHeaders = [
    "Action",
    "Visitor Name",
    "Contact",
    "Visit Purpose",
    "Office / Site",
    "Person to Meet",
    "Check-In Time",
    "Check-Out Time",
    "Status"
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
    const isInside = item.status === 'CHECKED_IN';
    const statusCfg = VISITOR_STATUS_MAP[item.status] || VISITOR_STATUS_MAP.CHECKED_IN;
    const duration = getVisitDuration(item.checkInAt, item.checkOutAt);

    return (
      <tr
        key={item.id || idx}
        onClick={() => setDetailsVisitor(item)}
        className="group cursor-pointer transition-colors border-b border-gray-100 hover:bg-indigo-50/40"
      >
        {/* Action column */}
        <td className="px-2 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            {/* View Details */}
            <button
              onClick={() => setDetailsVisitor(item)}
              title="View full visitor details"
              aria-label="View Details"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-600 hover:text-white transition active:scale-95 cursor-pointer"
            >
              <Eye size={13} />
            </button>

            {/* Quick Check Out button (active only if checked in) */}
            {canEdit && isInside && (
              <button
                onClick={() => setCheckoutVisitor(item)}
                title="Process Check-Out"
                aria-label="Check Out"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition active:scale-95 cursor-pointer"
              >
                <LogOut size={13} />
              </button>
            )}

            {/* Edit button */}
            {canEdit && (
              <button
                onClick={() => setEditVisitor(item)}
                title="Edit visitor details"
                aria-label="Edit"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition active:scale-95 cursor-pointer"
              >
                <Pencil size={12} />
              </button>
            )}
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
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${PURPOSE_STYLES[item.visitPurpose] || PURPOSE_STYLES.Other}`}>
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
            {item.personActuallyMetName && item.personActuallyMetName !== item.personToMeetName && (
              <span className="text-[9.5px] text-purple-700 font-bold" title={`Actually met: ${item.personActuallyMetName}`}>
                Met: {item.personActuallyMetName}
              </span>
            )}
          </div>
        </td>

        {/* 6. Check-In Time */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          <div className="inline-flex flex-col items-center">
            <span className="font-bold text-gray-800">
              {formatVisitorTime(item.checkInAt)}
            </span>
            <span className="text-[10px] text-gray-400">
              {formatVisitorDate(item.checkInAt)}
            </span>
          </div>
        </td>

        {/* 7. Check-Out Time */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          {item.checkOutAt ? (
            <div className="inline-flex flex-col items-center">
              <span className="font-bold text-gray-800">
                {formatVisitorTime(item.checkOutAt)}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">
                ({duration})
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Inside ({duration})
            </span>
          )}
        </td>

        {/* 8. Status */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
            {statusCfg.label}
          </span>
        </td>
      </tr>
    );
  };

  // Render Mobile Card View
  const renderCard = (item, idx) => {
    const isExpanded = expandedCardIds.has(item.id || idx);
    const isInside = item.status === 'CHECKED_IN';
    const statusCfg = VISITOR_STATUS_MAP[item.status] || VISITOR_STATUS_MAP.CHECKED_IN;
    const duration = getVisitDuration(item.checkInAt, item.checkOutAt);

    return (
      <div
        key={item.id || idx}
        className={`bg-white rounded-xl border transition shadow-2xs p-3 space-y-2.5 ${
          isExpanded ? 'border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/10' : 'border-gray-200'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between gap-1.5 border-b border-gray-100 pb-2">
          <div className="min-w-0">
            <h4
              onClick={() => setDetailsVisitor(item)}
              className="font-bold text-sm text-gray-900 truncate cursor-pointer hover:text-indigo-600"
            >
              {item.visitorName}
            </h4>
            {item.companyName && (
              <span className="text-[11px] text-gray-500 block truncate">{item.companyName}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Primary Row: Mobile, Purpose, Host */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Contact</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <a href={`tel:${cleanPhone(item.mobileNumber)}`} className="font-semibold text-indigo-600 hover:underline">
                {item.mobileNumber}
              </a>
              <button
                onClick={(e) => handleWhatsApp(item, e)}
                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200"
              >
                WA
              </button>
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
            <span className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-semibold border ${PURPOSE_STYLES[item.visitPurpose] || PURPOSE_STYLES.Other}`}>
              {item.visitPurpose}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Duration</span>
            <span className="font-bold text-indigo-700 mt-0.5 block">
              {duration}
            </span>
          </div>
        </div>

        {/* Check-In & Check-Out Timestamps */}
        <div className="flex items-center justify-between text-[11px] text-gray-600 bg-gray-50 p-2 rounded-lg">
          <div>
            <span className="text-gray-400 block text-[9.5px]">Check-In:</span>
            <span className="font-semibold">{formatVisitorTime(item.checkInAt)}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-400 block text-[9.5px]">Check-Out:</span>
            <span className="font-semibold">{item.checkOutAt ? formatVisitorTime(item.checkOutAt) : 'Currently Inside'}</span>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="pt-2 border-t border-gray-100 text-xs space-y-1.5 animate-in fade-in duration-150">
            <div>
              <span className="text-gray-400">Location:</span>{' '}
              <span className="font-semibold text-gray-800">{item.visitLocation}</span>
              {item.projectName && <span className="text-amber-800 font-bold ml-1">({item.projectName})</span>}
            </div>
            {item.personActuallyMetName && item.personActuallyMetName !== item.personToMeetName && (
              <div>
                <span className="text-gray-400">Actually Met:</span>{' '}
                <span className="font-bold text-purple-700">{item.personActuallyMetName}</span>
              </div>
            )}
            {item.remarks && (
              <div>
                <span className="text-gray-400">Remarks:</span>{' '}
                <span className="text-gray-700 italic">{item.remarks}</span>
              </div>
            )}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
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
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              View
            </button>
            {canEdit && isInside && (
              <button
                type="button"
                onClick={() => setCheckoutVisitor(item)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                Check Out
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50/50 p-2 sm:p-3 md:p-4 gap-2.5 sm:gap-3">
      
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

      {/* 5 Real-Time Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 flex-shrink-0">
        
        {/* Card 1: Total Visitors Today */}
        <div
          onClick={() => applyKpiFilter('today')}
          className="p-2.5 sm:p-3 rounded-xl border border-indigo-200/90 bg-indigo-50/50 hover:bg-indigo-100/50 transition cursor-pointer shadow-2xs flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">Total Today</span>
            <User size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-indigo-950">{stats.totalToday}</span>
            <span className="text-[10px] font-semibold text-indigo-600">Registered</span>
          </div>
        </div>

        {/* Card 2: Currently Inside */}
        <div
          onClick={() => applyKpiFilter('inside')}
          className="p-2.5 sm:p-3 rounded-xl border border-emerald-200/90 bg-emerald-50/50 hover:bg-emerald-100/50 transition cursor-pointer shadow-2xs flex flex-col justify-between group ring-1 ring-emerald-300/40"
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Currently Inside
            </span>
            <CheckCircle2 size={14} className="group-hover:scale-110 transition text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-950">{stats.currentlyInside}</span>
            <span className="text-[10px] font-bold text-emerald-700">On premises</span>
          </div>
        </div>

        {/* Card 3: Meetings Today */}
        <div
          onClick={() => applyKpiFilter('meetings')}
          className="p-2.5 sm:p-3 rounded-xl border border-violet-200/90 bg-violet-50/50 hover:bg-violet-100/50 transition cursor-pointer shadow-2xs flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-violet-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">Meetings Today</span>
            <Briefcase size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-violet-950">{stats.meetingsToday}</span>
            <span className="text-[10px] font-semibold text-violet-600">Office Hosts</span>
          </div>
        </div>

        {/* Card 4: Site Visits Today */}
        <div
          onClick={() => applyKpiFilter('siteVisits')}
          className="p-2.5 sm:p-3 rounded-xl border border-amber-200/90 bg-amber-50/50 hover:bg-amber-100/50 transition cursor-pointer shadow-2xs flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">Site Visits Today</span>
            <MapPin size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-amber-950">{stats.siteVisitsToday}</span>
            <span className="text-[10px] font-semibold text-amber-700">Construction</span>
          </div>
        </div>

        {/* Card 5: Awaiting Check-Out */}
        <div
          onClick={() => applyKpiFilter('awaiting')}
          className="col-span-2 sm:col-span-1 p-2.5 sm:p-3 rounded-xl border border-rose-200/90 bg-rose-50/50 hover:bg-rose-100/50 transition cursor-pointer shadow-2xs flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">Awaiting Checkout</span>
            <Clock size={14} className="group-hover:scale-110 transition" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-rose-950">{stats.awaitingCheckout}</span>
            <span className="text-[10px] font-semibold text-rose-600">Pending Exit</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar Strip */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-gray-200 shadow-2xs flex-shrink-0 flex items-center justify-between gap-2 flex-wrap text-xs">
        
        {/* Left Side: Search + Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          
          {/* Search Box */}
          <div className="relative min-w-[180px] sm:min-w-[220px] flex-1 max-w-sm">
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

          {/* Date Filter Dropdown */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            {DATE_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Custom Date Pickers (when custom is picked) */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1 animate-in fade-in duration-150">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white h-[34px]"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white h-[34px]"
              />
            </div>
          )}

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="CHECKED_IN">Checked In (Inside)</option>
            <option value="CHECKED_OUT">Checked Out</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Purpose Filter Dropdown */}
          <select
            value={purposeFilter}
            onChange={(e) => setPurposeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            <option value="all">All Purposes</option>
            {VISIT_PURPOSE_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Location Filter Dropdown */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700 h-[34px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer hidden md:inline-block"
          >
            <option value="all">All Locations</option>
            {VISIT_LOCATION_OPTIONS.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Right Side: Active filters indicator and Clear button */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer h-[34px]"
          >
            <RotateCcw size={12} />
            <span>Reset Filters ({activeFiltersCount})</span>
          </button>
        )}
      </div>

      {/* Main Visitor Register Data Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex flex-col">
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

      {checkoutVisitor && (
        <CheckOutModal
          isOpen={Boolean(checkoutVisitor)}
          onClose={() => setCheckoutVisitor(null)}
          visitor={checkoutVisitor}
          onConfirm={handleConfirmCheckout}
        />
      )}

      {detailsVisitor && (
        <VisitorDetailsModal
          isOpen={Boolean(detailsVisitor)}
          onClose={() => setDetailsVisitor(null)}
          visitor={detailsVisitor}
          onCheckOutClick={(v) => setCheckoutVisitor(v)}
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
