import React, { useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Search, RotateCcw, RefreshCw, UserCheck, MessageSquare,
  Phone, MapPin, Calendar, Eye, X, ChevronDown, ChevronUp,
  FileSpreadsheet, Mail, Briefcase, FileText, Clock, IndianRupee, Check, CheckCircle2
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

// Check if a lead has a Closed (Won) deal
export const isDealClosed = (item) => {
  if (!item) return false;
  const statusNorm = String(item.status || '').toLowerCase().trim();
  const dealOutcomeNorm = String(item.dealOutcome || item.deal_outcome || '').toLowerCase().trim();
  
  if (
    dealOutcomeNorm.includes('won') ||
    dealOutcomeNorm.includes('closed') ||
    dealOutcomeNorm.includes('token')
  ) {
    return true;
  }
  if (
    statusNorm.includes('closed won') ||
    statusNorm === 'closed' ||
    statusNorm === 'deal closed'
  ) {
    return true;
  }
  if (item.closingAmount && Number(String(item.closingAmount).replace(/[^0-9.]/g, '')) > 0) {
    return true;
  }
  if (Array.isArray(item.followUps) && item.followUps.length > 0) {
    return item.followUps.some(f => {
      const fOutcome = String(f.dealOutcome || f.deal_outcome || '').toLowerCase().trim();
      const fStatus = String(f.status || '').toLowerCase().trim();
      const hasAmt = f.closingAmount && Number(String(f.closingAmount).replace(/[^0-9.]/g, '')) > 0;
      return (
        fOutcome.includes('won') ||
        fOutcome.includes('closed') ||
        fOutcome.includes('token') ||
        fStatus.includes('closed won') ||
        fStatus === 'closed' ||
        hasAmt
      );
    });
  }
  return false;
};

const STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Future Plan': 'bg-amber-50 text-amber-700 border-amber-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Assigned: 'bg-sky-50 text-sky-700 border-sky-200',
  'Pending Assignment': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Did Not Show': 'bg-slate-100 text-slate-700 border-slate-300',
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

export default function SiteVisitCategoryView({
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
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [showClosedDealsOnly, setShowClosedDealsOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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
    if (!isAdmin) {
      list = list.filter(l => {
        const status = String(l.status || '').trim();
        const visitor = String(l.assignedVisitor || '').trim();
        return status !== 'Pending Assignment' && status !== 'Unassigned' && visitor !== '' && visitor.toLowerCase() !== 'unassigned';
      });
    }
    const todayTime = today.getTime();
    const yesterdayTime = new Date(today.getTime() - 86400000).getTime();

    let allCount = list.length;
    let todayCount = 0;
    let yesterdayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let customCount = 0;

    let chosenCustomTime = null;
    if (customDate) {
      const parts = customDate.split('-').map(Number);
      if (parts.length === 3) chosenCustomTime = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
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

      if (isTodayMatch) todayCount++;
      if (isYesterdayMatch) yesterdayCount++;
      if (targetTime < todayTime && (item.status === 'Pending Assignment' || item.status === 'Assigned' || item.status === 'Future Plan')) overdueCount++;
      if ((nextTime && nextTime > todayTime) || (callTime && callTime > todayTime) || (mTime && mTime > todayTime)) upcomingCount++;
      if (chosenCustomTime !== null && (mTime === chosenCustomTime || nextTime === chosenCustomTime || callTime === chosenCustomTime)) customCount++;
    });

    return { all: allCount, today: todayCount, yesterday: yesterdayCount, overdue: overdueCount, upcoming: upcomingCount, custom: customCount };
  }, [leads, isAdmin, today, customDate]);

  const dateFilterOptions = useMemo(() => [
    { value: 'today', label: `Today's Followup (${dateCounts.today})` },
    { value: 'all', label: `All Dates (${dateCounts.all})` },
    { value: 'yesterday', label: `Yesterday (${dateCounts.yesterday})` },
    { value: 'upcoming', label: `Upcoming (${dateCounts.upcoming})` },
    { value: 'overdue', label: `Overdue (${dateCounts.overdue})` },
    { value: 'custom', label: customDate ? `Custom Date (${dateCounts.custom})` : 'Custom Date' }
  ], [dateCounts, customDate]);

  // Count total closed deals in this category
  const closedDealsCount = useMemo(() => {
    let list = leads || [];
    if (!isAdmin) {
      list = list.filter(l => {
        const status = String(l.status || '').trim();
        const visitor = String(l.assignedVisitor || '').trim();
        return status !== 'Pending Assignment' && status !== 'Unassigned' && visitor !== '' && visitor.toLowerCase() !== 'unassigned';
      });
    }
    return list.filter(isDealClosed).length;
  }, [leads, isAdmin]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let list = leads || [];

    // For USER role (non-admin): only show assigned leads
    if (!isAdmin) {
      list = list.filter(l => {
        const status = String(l.status || '').trim();
        const visitor = String(l.assignedVisitor || '').trim();
        return status !== 'Pending Assignment' && status !== 'Unassigned' && visitor !== '' && visitor.toLowerCase() !== 'unassigned';
      });
    }

    // Filter for Closed Deals only if button is active
    if (showClosedDealsOnly) {
      list = list.filter(isDealClosed);
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

    // Date filter
    if (dateFilter && dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

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
            (item.status === 'Pending Assignment' || item.status === 'Assigned' || item.status === 'Future Plan');
        }
        if (dateFilter === 'upcoming') {
          return (nextTime && nextTime > today.getTime()) || (callTime && callTime > today.getTime()) || (mTime && mTime > today.getTime());
        }
        if (dateFilter === 'custom' && customDate) {
          const parts = customDate.split('-');
          if (parts.length === 3) {
            const cDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
            return mTime === cDate || nextTime === cDate || callTime === cDate;
          }
        }
        return true;
      });
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
  }, [leads, searchQuery, dateFilter, customDate, category, isAdmin, showClosedDealsOnly]);

  // Check if any non-default filter is active
  const isFilterActive = dateFilter !== 'today' || searchQuery || showClosedDealsOnly || (dateFilter === 'custom' && customDate);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFilter('today');
    setCustomDate('');
    setShowClosedDealsOnly(false);
    setCurrentPage(1);
    toast.success('Filters reset to Today');
  }, []);

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.error('No visits data to export');
      return;
    }

    const exportData = filteredLeads.map((item, idx) => ({
      'SR No': idx + 1,
      'Meeting Date': formatDate(item.meetingDate || item.visitDate),
      'Next Meeting Date': formatDate(item.nextMeetingDate || item.nextVisitDate),
      'Customer Name': item.customerName || item.personName || '-',
      ...(isAdmin ? { 'Status': item.status || '-' } : {}),
      'Site Visited': (item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit) ? 'Yes' : 'No',
      'Meeting': item.visitMeet?.meeting ? 'Yes' : 'No',
      'Customer Status': item.customerStatus || '-',
      'Latest Feedback': item.whatHappened || item.visitorRemarks || '-',
      'Phone Number': item.customerNumber || item.number || '-',
      'Assigned Visitor': item.assignedVisitor || '-',
      'Total Visits': item.followUpCount || 0,
      'Location': item.location || item.customerAddress || '-',
      'Relationship Manager': item.relationshipManager || '-',
      'Remarks': item.leadRemarks || item.remarks || '-'
    }));

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
        className="group cursor-pointer transition-colors border-b border-gray-100 hover:bg-indigo-50/40"
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

            {/* View history timeline (visit count badge) */}
            <button
              onClick={() => onViewHistory(item)}
              title={`View ${item.followUpCount || 0} visit record${item.followUpCount === 1 ? '' : 's'} & details`}
              aria-label="View"
              className="relative w-7 h-7 inline-flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition active:scale-95"
            >
              <Eye size={13} />
              {item.followUpCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold leading-4 border border-white">
                  {item.followUpCount}
                </span>
              )}
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
            {isDealClosed(item) && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 shadow-2xs">
                <CheckCircle2 size={9} className="stroke-[2.5] text-emerald-700" />
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
                {item.status}
              </span>
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </td>
        )}

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

        {/* 6. Latest Feedback */}
        <td className="px-3 py-2 text-left text-xs text-gray-700 max-w-[220px] truncate" title={item.whatHappened || item.visitorRemarks || ''}>
          {item.whatHappened || item.visitorRemarks ? (
            <span>"{item.whatHappened || item.visitorRemarks}"</span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>

        {/* 7. Phone Number */}
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

        {/* 8. Assigned Visitor */}
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

        {/* 9. Total Visits */}
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {item.followUpCount || 0} {item.followUpCount === 1 ? 'Visit' : 'Visits'}
          </span>
        </td>

        {/* 10. Location */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={item.location || item.customerAddress}>
          {item.location || item.customerAddress || '-'}
        </td>

        {/* 11. Relationship Manager */}
        <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap">
          {item.relationshipManager || '-'}
        </td>

        {/* 12. Remarks */}
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
    if (item.visitMeet?.['site-visit'] || item.visitMeet?.siteVisit || item.visitMeet?.site_visit) details.push({ label: 'Site Visited', value: 'Yes', icon: Check });
    if (item.visitMeet?.meeting) details.push({ label: 'Meeting', value: 'Yes', icon: Check });
    if (isValid(item.relationshipManager)) details.push({ label: 'Relationship Manager', value: item.relationshipManager, icon: UserCheck });
    if (isValid(item.whenToBuyPlan)) details.push({ label: 'When to Buy', value: item.whenToBuyPlan, icon: Clock });
    if (isValid(item.leadRemarks || item.remarks)) details.push({ label: 'Remarks', value: item.leadRemarks || item.remarks, icon: MessageSquare, isLong: true });

    return (
      <div
        key={leadKey}
        className={`bg-white rounded-xl border transition shadow-2xs p-3 space-y-2.5 ${isExpanded ? 'border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/10' : 'border-gray-200'}`}
      >
        {/* Card Header: Name, Lead #, Status */}
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
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {isDealClosed(item) && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                <CheckCircle2 size={9} className="stroke-[2.5] text-emerald-700" /> Closed Deal
              </span>
            )}
            {isAdmin && item.status && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${STATUS_STYLES[item.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {item.status}
              </span>
            )}
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

        {/* Primary Row: Phone, Total Visits, Meeting Date, Next Meeting Date */}
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
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Total Visits</span>
            <span className="font-bold text-gray-700 mt-0.5 inline-block">
              {item.followUpCount || 0} {item.followUpCount === 1 ? 'Visit' : 'Visits'}
            </span>
          </div>

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

        {/* Latest Feedback snippet (if any) */}
        {(item.whatHappened || item.visitorRemarks) && (
          <div className="bg-slate-50 border border-slate-100 rounded p-2 text-xs text-gray-700">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Feedback</span>
            <p className="leading-tight italic">"{item.whatHappened || item.visitorRemarks}"</p>
          </div>
        )}

        {/* Action Buttons: Followup on left, Hide/Details on right */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-gray-100">
          {onLogFollowUp ? (<button
            onClick={() => onLogFollowUp(item)}
            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs active:scale-95 transition"
          >
            <MessageSquare size={12} />
            <span>Followup</span>
          </button>) : null}

          <button
            onClick={() => toggleCardExpand(leadKey)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${
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
      {/* Header Bar: Mobile = 2 Rows (Row 1: Tabs, Row 2: All Other Controls); Desktop = 1 Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-1.5 w-full flex-shrink-0">
        {/* Row 1 on Mobile / Left on Desktop: Lead Category Button Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap shrink-0 w-full xl:w-auto pb-0.5">
          <PageTabs
            tabs={tabs}
            activeKey={activeTab}
            onChange={(key) => { onTabChange?.(key); setCurrentPage(1); }}
          />
        </div>

        {/* Row 2 on Mobile / Right on Desktop: Search + Date Filter + Closed Deal + Export + Refresh + Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-hide w-full xl:w-auto xl:flex-1 justify-between sm:justify-end pb-0.5">
          {/* Search Input */}
          <div className="relative min-w-[120px] max-w-full sm:max-w-[220px] flex-1 shrink">
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

          {/* Date Filter Dropdown (Shifted directly into top bar & defaulted to Today's Date) */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-[155px] sm:w-[185px] shrink-0">
              <SearchableDropdown
                options={dateFilterOptions}
                value={dateFilter}
                onChange={(val) => {
                  setDateFilter(val);
                  if (val === 'custom' && !customDate) {
                    const now = new Date();
                    setCustomDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
                  }
                  setCurrentPage(1);
                }}
                placeholder="Select Date"
                height="h-[34px]"
                triggerClassName={dateFilter === 'today' ? "w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-600 rounded-lg px-2.5 py-1 flex justify-between items-center cursor-pointer shadow-sm h-[34px] font-semibold text-xs tracking-wide active:scale-[0.98]" : ""}
                icon={Calendar}
              />
            </div>

            {/* Custom Date Input if 'custom' is selected */}
            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => { setCustomDate(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-lg px-2 text-xs font-medium text-gray-700 h-[34px] focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
              />
            )}
          </div>

          {/* Closed Deal Toggle Button */}
          <button
            onClick={() => {
              setShowClosedDealsOnly(prev => !prev);
              setCurrentPage(1);
            }}
            title={showClosedDealsOnly ? `Show all ${category} visits/deals` : `Show only closed deals for ${category}`}
            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold h-[34px] transition border shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
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

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[34px] w-[34px] shrink-0 transition disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>

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
                onClick={() => setShowClosedDealsOnly(false)}
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
