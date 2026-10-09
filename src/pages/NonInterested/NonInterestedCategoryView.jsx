import React, { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Search, RotateCcw, UserCheck, MessageSquare,
  Phone, MapPin, Calendar, Eye, X, ChevronDown, ChevronUp,
  FileSpreadsheet, Mail, Briefcase, FileText, Clock, IndianRupee, Check, UserX,
  CalendarDays
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import PageTabs from '../../components/PageTabs';
import {
  DATE_FILTER_OPTIONS,
  parseDateObj
} from '../SiteVisitMeeting/siteVisitMeetingConstants';
import { CUSTOMER_STATUS_STYLES } from '../CallTracker/callTrackerConstants';
import { NEXT_DATE_CLASS } from '../../utils/leadTypeColors';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Deal Lock': 'bg-violet-100 text-violet-800 border-violet-400',
  'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
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

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

// Format YYYY-MM-DD or DD/MM/YYYY to DD/MM/YYYY
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

export default function NonInterestedCategoryView({
  category, // 'Real Estate' | 'Insurance' | 'Mutual Fund'
  tabs = [],
  activeTab,
  onTabChange,
  leads = [],
  loading = false,
  visitorsMaster = [],
  onRefresh,
  onAssignVisitor,
  onLogFollowUp,
  onViewHistory
}) {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [visitorFilter, setVisitorFilter] = useState('all');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Mobile card view: expanded accordion card IDs
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
      `Hello ${item.customerName || item.personName || 'Customer'}, regarding your inquiry with Sarvodaya Infracon for ${category}.`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  // Filter leads
  const filteredLeads = useMemo(() => {
    let list = leads || [];

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

    // Customer status filter (Hot, Warm, Cold)
    if (customerStatusFilter !== 'all') {
      list = list.filter(l => (l.customerStatus || '').toLowerCase() === customerStatusFilter.toLowerCase());
    }

    // Visitor filter
    if (visitorFilter && visitorFilter !== 'all') {
      list = list.filter(l => l.assignedVisitor === visitorFilter);
    }

    // Date filter
    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      list = list.filter(item => {
        const mObj = parseDateObj(item.meetingDate || item.visitDate);
        const nextObj = parseDateObj(item.nextMeetingDate || item.nextVisitDate || item.nextCallDate || item.nextDate);

        const mTime = mObj ? new Date(mObj.getFullYear(), mObj.getMonth(), mObj.getDate()).getTime() : null;
        const nextTime = nextObj ? new Date(nextObj.getFullYear(), nextObj.getMonth(), nextObj.getDate()).getTime() : null;

        const targetTime = nextTime || mTime;
        if (!targetTime) return false;

        if (dateFilter === 'today') return mTime === today.getTime() || nextTime === today.getTime();
        if (dateFilter === 'yesterday') return mTime === yesterday.getTime() || nextTime === yesterday.getTime();
        if (dateFilter === 'overdue') {
          return targetTime < today.getTime();
        }
        if (dateFilter === 'upcoming') return (nextTime && nextTime > today.getTime()) || (mTime && mTime > today.getTime());
        if (dateFilter === 'custom') {
          let fromMs = null;
          let toMs = null;
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
          if (fromMs !== null || toMs !== null) {
            const checkMatch = (t) => {
              if (!t) return false;
              if (fromMs !== null && t < fromMs) return false;
              if (toMs !== null && t > toMs) return false;
              return true;
            };
            return checkMatch(mTime) || checkMatch(nextTime);
          }
          return true;
        }
        return true;
      });
    }

    return list;
  }, [leads, searchQuery, customerStatusFilter, visitorFilter, dateFilter, customFrom, customTo]);

  // Visitor filter options
  const visitorOptions = useMemo(() => {
    const seen = new Set();
    const opts = [{ value: 'all', label: 'All Visitors' }];
    (visitorsMaster || []).forEach(v => {
      const name = String(v.personName || v.name || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        opts.push({ value: name, label: name });
      }
    });
    leads.forEach(l => {
      if (l.assignedVisitor && !seen.has(l.assignedVisitor.toLowerCase())) {
        seen.add(l.assignedVisitor.toLowerCase());
        opts.push({ value: l.assignedVisitor, label: l.assignedVisitor });
      }
    });
    return opts;
  }, [visitorsMaster, leads]);

  // Date filter options
  const dateFilterOptions = useMemo(() => {
    return DATE_FILTER_OPTIONS.map(opt => {
      if (opt.value === 'custom' && customFrom && customTo) {
        return {
          value: 'custom',
          label: `Custom: ${formatShortDate(customFrom)} – ${formatShortDate(customTo)}`
        };
      }
      return opt;
    });
  }, [customFrom, customTo]);

  // Count active dropdown filters
  const activeFiltersCount = (customerStatusFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0) +
    (visitorFilter !== 'all' ? 1 : 0);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setCustomerStatusFilter('all');
    setDateFilter('all');
    setCustomFrom('');
    setCustomTo('');
    setVisitorFilter('all');
    setCurrentPage(1);
    toast.success('Filters cleared');
  }, []);

  // Listen for sidebar click to reset filters
  useEffect(() => {
    const handleClear = (e) => {
      if (!e?.detail?.path || e.detail.path === '/non-interested') {
        handleClearFilters();
      }
    };
    window.addEventListener('app:clear-filters', handleClear);
    return () => window.removeEventListener('app:clear-filters', handleClear);
  }, [handleClearFilters]);

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.error('No non-interested records to export');
      return;
    }

    const exportData = filteredLeads.map((item, idx) => ({
      'SR No': idx + 1,
      'Last Meeting Date': formatDate(item.meetingDate || item.visitDate),
      'Next Meeting Date': formatDate(item.nextMeetingDate || item.nextVisitDate),
      'Customer Name': item.customerName || item.personName || '-',
      'Status': item.status || 'Not Interested',
      'Site Visited': (item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit) ? 'Yes' : 'No',
      'Meeting': item.visitMeet?.meeting ? 'Yes' : 'No',
      'Customer Status': item.customerStatus || '-',
      'Latest Feedback / Reason': item.whatHappened || item.visitorRemarks || item.callTrackerRemarks || '-',
      'Phone Number': item.customerNumber || item.number || '-',
      'Assigned Visitor': item.assignedVisitor || '-',
      'Total Calls / Visits': item.followUpCount || 0,
      'Location': item.location || item.customerAddress || '-',
      'Relationship Manager': item.relationshipManager || '-',
      'Remarks': item.leadRemarks || item.remarks || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${category} Non-interested`);
    XLSX.writeFile(workbook, `NonInterested_${category.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Table Headers
  const tableHeaders = [
    "Action",
    "Last Meeting Date",
    "Next Meeting Date",
    "Customer Name",
    "Status",
    "Site Visited",
    "Meeting",
    "Customer Status",
    "Latest Feedback",
    "Phone Number",
    "Assigned Visitor",
    "Total Visits",
    "Location",
    "Relationship Manager",
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
    const hasSiteVisited = Boolean(item.visitMeet?.['site-visit'] ?? item.visitMeet?.siteVisit ?? item.visitMeet?.site_visit);
    const hasMeeting = Boolean(item.visitMeet?.meeting);

    return (
      <tr
        key={leadKey}
        onClick={(e) => {
          if (!e.currentTarget.contains(e.target)) return;
          if (e.target.closest('button, a, input, select, label, [role="combobox"], [role="listbox"]')) return;
          onViewHistory(item);
        }}
        className="group cursor-pointer transition-colors border-b border-gray-100 hover:bg-rose-50/40"
      >
        {/* Action column */}
        <td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            {onLogFollowUp && (
              <button
                onClick={() => onLogFollowUp(item)}
                title={`Followup — log a follow-up for ${item.customerName || item.personName || 'Customer'}`}
                aria-label="Followup"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white transition active:scale-95"
              >
                <Phone size={13} />
              </button>
            )}

            {/* View history timeline */}
            <button
              onClick={() => onViewHistory(item)}
              title={`View ${item.followUpCount || 0} record${item.followUpCount === 1 ? '' : 's'} & details`}
              aria-label="View"
              className="relative w-7 h-7 inline-flex items-center justify-center rounded-md bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-600 hover:text-white transition active:scale-95"
            >
              <Eye size={13} />
              {item.followUpCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold leading-4 border border-white">
                  {item.followUpCount}
                </span>
              )}
            </button>
          </div>
        </td>

        {/* 1. Last Meeting Date */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          {(item.meetingDate || item.visitDate) ? (
            <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
              <Calendar size={12} className="text-gray-400" />
              {formatDate(item.meetingDate || item.visitDate)}
            </span>
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </td>

        {/* 2. Next Meeting Date */}
        <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
          {(item.nextMeetingDate || item.nextVisitDate) ? (
            <span className={`inline-flex items-center gap-1 font-semibold ${NEXT_DATE_CLASS}`}>
              <Calendar size={12} />
              {formatDate(item.nextMeetingDate || item.nextVisitDate)}
            </span>
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </td>

        {/* 3. Customer Name */}
        <td className="px-3 py-2 text-left text-xs font-bold whitespace-nowrap max-w-[190px] truncate" title={item.customerName || item.personName}>
          <span className="text-gray-900 truncate hover:text-rose-600 transition">
            {item.customerName || item.personName || '-'}
          </span>
        </td>

        {/* 4. Status */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase border tracking-wide ${STATUS_STYLES[item.status] || 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {item.status || 'Not Interested'}
          </span>
        </td>

        {/* 5. Site Visited */}
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

        {/* 6. Meeting */}
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

        {/* 7. Customer Status */}
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
        <td className="px-3 py-2 text-left text-xs text-gray-700 max-w-[220px] truncate" title={item.whatHappened || item.visitorRemarks || item.callTrackerRemarks || ''}>
          {item.whatHappened || item.visitorRemarks || item.callTrackerRemarks ? (
            <span className="italic text-gray-800">"{item.whatHappened || item.visitorRemarks || item.callTrackerRemarks}"</span>
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
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {item.followUpCount || 0} {item.followUpCount === 1 ? 'Visit' : 'Visits'}
          </span>
        </td>

        {/* 12. Location */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={item.location || item.customerAddress}>
          {item.location || item.customerAddress || '-'}
        </td>

        {/* 13. Relationship Manager */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap">
          {item.relationshipManager || '-'}
        </td>

        {/* 14. Remarks */}
        <td className="px-3 py-2 text-center text-xs text-gray-500 whitespace-nowrap max-w-[160px] truncate" title={item.leadRemarks || item.remarks}>
          {item.leadRemarks || item.remarks || '-'}
        </td>
      </tr>
    );
  };

  // Render Mobile Card View
  const renderCard = (item, idx) => {
    const leadKey = item.id || item.leadNo || idx;
    const isExpanded = expandedCardIds.has(leadKey);

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
    if (item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit) details.push({ label: 'Site Visited', value: 'Yes', icon: Check });
    if (item.visitMeet?.meeting) details.push({ label: 'Meeting', value: 'Yes', icon: Check });
    if (isValid(item.relationshipManager)) details.push({ label: 'Relationship Manager', value: item.relationshipManager, icon: UserCheck });
    if (isValid(item.whenToBuyPlan)) details.push({ label: 'When to Buy', value: item.whenToBuyPlan, icon: Clock });
    if (isValid(item.leadRemarks || item.remarks)) details.push({ label: 'Remarks', value: item.leadRemarks || item.remarks, icon: MessageSquare, isLong: true });

    return (
      <div
        key={leadKey}
        className={`bg-white rounded-xl border transition shadow-2xs p-3 space-y-2.5 ${isExpanded ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/10' : 'border-gray-200'}`}
      >
        {/* Card Header: Name, Lead #, Status */}
        <div className="flex items-center justify-between gap-1.5 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h4
              onClick={() => onViewHistory(item)}
              className="font-bold text-sm text-gray-900 truncate cursor-pointer hover:text-rose-600"
            >
              {item.customerName || item.personName || 'Unnamed Customer'}
            </h4>
            {item.leadNo && (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                #{item.leadNo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
              <UserX size={9} className="stroke-[2.5]" /> Not Interested
            </span>
            {(item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit) && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check size={9} className="stroke-[2.5]" /> Site Visited
              </span>
            )}
            {item.visitMeet?.meeting && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-50 text-violet-700 border border-violet-200">
                <Check size={9} className="stroke-[2.5]" /> Meeting
              </span>
            )}
          </div>
        </div>

        {/* Primary Row: Phone, Total Visits, Last Meeting Date, Next Meeting Date */}
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

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Total Visits / Calls</span>
            <span className="font-bold text-gray-700 mt-0.5 inline-block">
              {item.followUpCount || 0} {item.followUpCount === 1 ? 'Visit' : 'Visits'}
            </span>
          </div>

          {(item.meetingDate || item.visitDate) && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} className="text-gray-400" />
                Last Meeting Date
              </span>
              <span className="font-medium text-gray-700 mt-0.5 inline-block">{formatDate(item.meetingDate || item.visitDate)}</span>
            </div>
          )}

          {(item.nextMeetingDate || item.nextVisitDate) && (
            <div>
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <Clock size={10} className="text-amber-600" />
                Next Followup
              </span>
              <span className={`font-bold mt-0.5 inline-block ${NEXT_DATE_CLASS}`}>
                {formatDate(item.nextMeetingDate || item.nextVisitDate)}
              </span>
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
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Visitor:</span>
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

        {/* Latest Feedback snippet */}
        {(item.whatHappened || item.visitorRemarks || item.callTrackerRemarks) && (
          <div className="bg-rose-50/50 border border-rose-100 rounded p-2 text-xs text-rose-900">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-0.5">Reason / Feedback</span>
            <p className="leading-tight italic">"{item.whatHappened || item.visitorRemarks || item.callTrackerRemarks}"</p>
          </div>
        )}

        {/* Action Buttons: Followup on left, Hide/Details on right */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-gray-100">
          {onLogFollowUp ? (
            <button
              onClick={() => onLogFollowUp(item)}
              className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs active:scale-95 transition"
            >
              <MessageSquare size={12} />
              <span>Followup</span>
            </button>
          ) : null}

          <button
            onClick={() => toggleCardExpand(leadKey)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${
              isExpanded
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
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
      {/* Header Bar: Row 1 = Lead Category Tabs; Row 2 = Search & Actions Controls */}
      <div className="flex flex-col gap-1.5 w-full flex-shrink-0">
        {/* Row 1: Lead Category Button Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap w-full pb-0.5">
          <PageTabs
            tabs={tabs}
            activeKey={activeTab}
            onChange={(key) => { onTabChange?.(key); setCurrentPage(1); }}
          />
        </div>

        {/* Row 2: Search + Export + Refresh + Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto scrollbar-hide w-full justify-between sm:justify-end pb-0.5">
          {/* Search Input */}
          <div className="relative min-w-[140px] sm:min-w-[180px] max-w-full sm:max-w-[240px] flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder={`Search ${category} non-interested...`}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-7 text-xs focus:outline-none focus:border-rose-500 h-[34px] shadow-xs transition"
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
              title={`Export ${category} non-interested to Excel`}
              className="flex items-center justify-center gap-1 px-2.5 sm:px-3 rounded-lg text-xs font-semibold h-[34px] transition border shrink-0 bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 shadow-xs active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}

          {/* Clear Filters */}
          {(activeFiltersCount > 0 || searchQuery) && (
            <button
              onClick={handleClearFilters}
              title="Clear all filters & search"
              className="flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg h-[34px] px-2.5 sm:px-3 text-xs font-semibold transition gap-1 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar (Always visible) */}
      <div className="p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 sm:gap-2.5 flex-wrap text-xs">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">
          Filter By:
        </span>

        {/* Customer Status Filter */}
        <div className="w-[130px] sm:w-[150px]">
          <select
            value={customerStatusFilter}
            onChange={(e) => { setCustomerStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-rose-500 h-[30px]"
          >
            <option value="all">All Customer Status</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
            <option value="Hot">Hot</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="w-[130px] sm:w-[150px]">
          <select
            value={dateFilter}
            onChange={(e) => {
              const val = e.target.value;
              setDateFilter(val);
              if (val === 'custom' && !customFrom && !customTo) {
                const t = getTodayStr();
                setCustomFrom(t);
                setCustomTo(t);
              }
              setCurrentPage(1);
            }}
            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-rose-500 h-[30px]"
          >
            {dateFilterOptions.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Custom Date Range Inline Inputs */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-1 bg-white border border-gray-300 focus-within:border-rose-500 rounded px-2 h-[30px] shadow-xs">
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
            <div className="flex items-center gap-1 bg-white border border-gray-300 focus-within:border-rose-500 rounded px-2 h-[30px] shadow-xs">
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

        {/* Visitor Filter */}
        {visitorOptions.length > 0 && (
          <div className="w-[140px] sm:w-[170px]">
            <select
              value={visitorFilter}
              onChange={(e) => { setVisitorFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-rose-500 h-[30px]"
            >
              {visitorOptions.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Clear in filter bar */}
        {activeFiltersCount > 0 && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold underline ml-auto cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main Full-Height Compact Table View */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-semibold tracking-wide uppercase">Loading {category} Non-interested...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-4 space-y-3">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-200">
              <UserX size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">No {category} Non-interested Records Found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                There are currently no non-interested or rejected customers recorded for {category}.
              </p>
            </div>
            {(searchQuery || customerStatusFilter !== 'all' || dateFilter !== 'all' || visitorFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-rose-100 transition"
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
