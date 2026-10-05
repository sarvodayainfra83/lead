import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Search, X, RotateCcw, RefreshCw, Plus, Upload, UserCheck, Phone, MessageSquare,
  Pencil, Trash2, Info, Calendar, Clock, CheckSquare, MapPin,
  Square, ChevronDown, ChevronUp, AlertCircle, Sparkles, Building2, ShieldCheck, TrendingUp
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import PageTabs from '../../components/PageTabs';
import SearchableDropdown from '../../components/SearchableDropdown';
import { formatLeadDate, parseLeadDate, DATE_FILTER_OPTIONS, getTodayStr, LEAD_SOURCES, isDirectSiteVisitLead } from './leadConstants';
import { getLeadTypeTextClass, getLeadTypeBadgeClass } from '../../utils/leadTypeColors';
import { leadApi } from '../../api/leadApi';
import { useAuthStore } from '../../store/authStore';
import { isUserTester } from '../../utils/authUtils';

export default function LeadCategoryView({
  category, // 'Real Estate' | 'Insurance' | 'Mutual Fund'ch
  tabs = [],
  activeTab,
  onTabChange,
  initialDateFilter, // e.g. 'today' when opened from the Dashboard's Today's Leads card
  leads = [],
  loading = false,
  callersMaster = [],
  canEdit = false,
  onRefresh,
  onAddLead,
  onBulkUpload,
  onEditLead,
  onViewDetails
}) {
  const user = useAuthStore(state => state.user);
  const isTester = isUserTester(user);

  const [searchQuery, setSearchQuery] = useState('');
  const [callerStatusFilter, setCallerStatusFilter] = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [dateFilter, setDateFilter] = useState(initialDateFilter || 'all');
  const [customDate, setCustomDate] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('');
  const [callerFilter, setCallerFilter] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [requirementFilter, setRequirementFilter] = useState('');
  const viewMode = 'auto'; // Table on desktop, cards on mobile (same as Call Tracker)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Multi-selection for batch caller assignment
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchCaller, setBatchCaller] = useState('');
  const [batchAssigning, setBatchAssigning] = useState(false);

  // Inline assignment state for single row/card quick assignment
  const [inlineAssignments, setInlineAssignments] = useState({});

  // Reset any selections and batch state when category tab changes
  useEffect(() => {
    setSelectedIds(new Set());
    setBatchCaller('');
    setInlineAssignments({});
  }, [category]);

  // Sorting: Guaranteed newest / latest added leads at top
  const getLeadTime = (l) => {
    const t = l.timestamp || l.created_at || l.date;
    if (!t) return 0;
    const d = new Date(t);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const getCleanPhone = (num) => String(num || '').replace(/[^0-9+]/g, '');

  const handleWhatsApp = (item, e) => {
    e?.stopPropagation?.();
    const cleanPhone = getCleanPhone(item.number || item.customerNumber);
    if (!cleanPhone) return;
    const phoneWithCountry = cleanPhone.startsWith('91') || cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `91${cleanPhone}`;
    const message = encodeURIComponent(`Hello ${item.personName || item.customerName || 'Customer'}, regarding your inquiry with Sarvodaya Infracon for ${category}.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  // Distinct filter options extracted from leads for this category
  const distinctProductTypes = useMemo(() => {
    const set = new Set();
    leads.forEach(l => {
      const pt = l.productType || l.insuranceType;
      if (pt) set.add(pt);
    });
    return Array.from(set).sort();
  }, [leads]);

  const distinctRequirements = useMemo(() => {
    const set = new Set();
    leads.forEach(l => {
      if (l.requirement) set.add(l.requirement);
    });
    return Array.from(set).sort();
  }, [leads]);

  // Caller dropdown options for this category
  const callerOptions = useMemo(() => {
    const filtered = callersMaster.filter(c => !c.leadType || c.leadType === category);
    const seen = new Set();
    const opts = [];
    for (const c of filtered) {
      if (c.personName && !seen.has(c.personName)) {
        seen.add(c.personName);
        opts.push({ value: c.personName, label: c.personName });
      }
    }
    // Also include any callers currently assigned in this list
    leads.forEach(l => {
      if (l.callerAssigned && !seen.has(l.callerAssigned)) {
        seen.add(l.callerAssigned);
        opts.push({ value: l.callerAssigned, label: l.callerAssigned });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [callersMaster, category, leads]);

  // Dates for date filter
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Category-specific date counts
  const dateCounts = useMemo(() => {
    let allCount = leads.length;
    let todayCount = 0;
    let yesterdayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let customCount = 0;

    const todayTime = today.getTime();
    const yesterdayTime = yesterday.getTime();
    let chosenCustomTime = null;
    if (customDate) {
      const [cy, cm, cd] = customDate.split('-').map(Number);
      if (cy && cm && cd) {
        chosenCustomTime = new Date(cy, cm - 1, cd).getTime();
      }
    }

    leads.forEach(l => {
      const d = parseLeadDate(l);
      if (!d) return;
      const targetTime = d.getTime();

      if (targetTime === todayTime) {
        todayCount++;
      } else if (targetTime === yesterdayTime) {
        yesterdayCount++;
      }

      if (targetTime < yesterdayTime) {
        overdueCount++;
      } else if (targetTime > todayTime) {
        upcomingCount++;
      }

      if (chosenCustomTime !== null && targetTime === chosenCustomTime) {
        customCount++;
      }
    });

    return { all: allCount, today: todayCount, yesterday: yesterdayCount, overdue: overdueCount, upcoming: upcomingCount, custom: customCount };
  }, [leads, today, yesterday, customDate]);

  // Dropdown options for All Dates & other timeframes
  const allDatesFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: `All Dates (${dateCounts.all})` },
      { value: 'yesterday', label: `Yesterday (${dateCounts.yesterday})` },
      { value: 'overdue', label: `Overdue (${dateCounts.overdue})` },
      { value: 'upcoming', label: `Upcoming (${dateCounts.upcoming})` },
      { value: 'custom', label: customDate ? `Custom Date (${dateCounts.custom})` : 'Custom Date' },
    ];
  }, [dateCounts, customDate]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (callerStatusFilter && callerStatusFilter !== 'all') count++;
    if (dateFilter && dateFilter !== 'all') count++;
    if (customDate) count++;
    if (leadSourceFilter) count++;
    if (callerFilter) count++;
    if (productTypeFilter) count++;
    if (requirementFilter) count++;
    return count;
  }, [callerStatusFilter, dateFilter, customDate, leadSourceFilter, callerFilter, productTypeFilter, requirementFilter]);

  const handleClearFilters = useCallback(() => {
    setCallerStatusFilter('all');
    setDateFilter('all');
    setCustomDate('');
    setLeadSourceFilter('');
    setCallerFilter('');
    setProductTypeFilter('');
    setRequirementFilter('');
    setSearchQuery('');
    setCurrentPage(1);
    toast.success('Filters reset');
  }, []);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // Caller Status Filter
      if (callerStatusFilter === 'unassigned' && l.callerAssigned) return false;
      if (callerStatusFilter === 'assigned' && !l.callerAssigned) return false;

      // Specific Caller Filter
      if (callerFilter && l.callerAssigned !== callerFilter) return false;

      // Lead Source Filter
      if (leadSourceFilter && l.leadSource !== leadSourceFilter) return false;

      // Product Type Filter
      if (productTypeFilter) {
        const pt = l.productType || l.insuranceType;
        if (pt !== productTypeFilter) return false;
      }

      // Requirement Filter (Real Estate)
      if (requirementFilter && l.requirement !== requirementFilter) return false;

      // Date Filter
      if (dateFilter && dateFilter !== 'all') {
        const d = parseLeadDate(l);
        if (!d) return false;
        if (dateFilter === 'today') {
          if (d.getTime() !== today.getTime()) return false;
        } else if (dateFilter === 'yesterday') {
          if (d.getTime() !== yesterday.getTime()) return false;
        } else if (dateFilter === 'overdue') {
          if (d.getTime() >= yesterday.getTime()) return false;
        } else if (dateFilter === 'upcoming') {
          if (d.getTime() <= today.getTime()) return false;
        } else if (dateFilter === 'custom') {
          if (customDate) {
            const [cy, cm, cd] = customDate.split('-').map(Number);
            if (cy && cm && cd) {
              const target = new Date(cy, cm - 1, cd);
              if (d.getTime() !== target.getTime()) return false;
            }
          }
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const leadNo = (l.leadNo || '').toLowerCase();
        const name = (l.personName || l.customerName || '').toLowerCase();
        const phone = (l.number || l.customerNumber || '').toLowerCase();
        const email = (l.email || l.customerEmail || '').toLowerCase();
        const loc = (l.location || l.customerAddress || '').toLowerCase();
        const caller = (l.callerAssigned || '').toLowerCase();
        const req = (l.requirement || '').toLowerCase();
        const prod = (l.productType || l.insuranceType || '').toLowerCase();

        if (
          !leadNo.includes(q) &&
          !name.includes(q) &&
          !phone.includes(q) &&
          !email.includes(q) &&
          !loc.includes(q) &&
          !caller.includes(q) &&
          !req.includes(q) &&
          !prod.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [leads, callerStatusFilter, callerFilter, leadSourceFilter, productTypeFilter, requirementFilter, dateFilter, customDate, searchQuery]);

  // Sort: Latest added leads at top (created_at / timestamp descending)
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      const timeB = getLeadTime(b);
      const timeA = getLeadTime(a);
      if (timeB !== timeA) return timeB - timeA;
      // Fallback: Lead No sequence descending
      return String(b.leadNo || '').localeCompare(String(a.leadNo || ''), undefined, { numeric: true });
    });
  }, [filteredLeads]);

  // Quick Metrics for current category
  const metrics = useMemo(() => {
    const total = leads.length;
    const unassigned = leads.filter(l => !l.callerAssigned).length;
    const assigned = leads.filter(l => !!l.callerAssigned).length;
    const addedToday = leads.filter(l => {
      const d = parseLeadDate(l);
      return d && d.getTime() === today.getTime();
    }).length;

    return { total, unassigned, assigned, addedToday };
  }, [leads, today]);

  // Pagination
  const totalPages = Math.ceil(sortedLeads.length / itemsPerPage) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedLeads.slice(start, start + itemsPerPage);
  }, [sortedLeads, currentPage, itemsPerPage]);

  // Selection handlers for batch assignment (excludes direct site visit leads)
  const selectableLeads = useMemo(() => {
    return paginatedLeads.filter(l => !isDirectSiteVisitLead(l));
  }, [paginatedLeads]);

  const allCurrentChecked = selectableLeads.length > 0 && selectableLeads.every(l => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allCurrentChecked) {
        selectableLeads.forEach(l => next.delete(l.id));
      } else {
        selectableLeads.forEach(l => next.add(l.id));
      }
      return next;
    });
  };

  const toggleSelectRow = (id, e) => {
    e?.stopPropagation?.();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch caller assignment commit
  const handleBatchAssign = async () => {
    if (!batchCaller) {
      toast.error('Please choose a caller to assign');
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Select at least one lead');
      return;
    }

    setBatchAssigning(true);
    try {
      const map = {};
      ids.forEach(id => { map[id] = batchCaller; });
      await leadApi.assignCallerToLeads(map);
      toast.success(`Assigned ${ids.length} lead${ids.length > 1 ? 's' : ''} to ${batchCaller}`);
      setSelectedIds(new Set());
      setBatchCaller('');
      await onRefresh?.();
    } catch (err) {
      console.error('Batch assign failed:', err);
      toast.error('Failed to assign caller. Please try again.');
    } finally {
      setBatchAssigning(false);
    }
  };

  // Quick single-row inline caller assignment
  const handleQuickAssign = async (lead, callerName) => {
    if (!callerName) return;
    try {
      await leadApi.updateLead(lead.id, {
        callerAssigned: callerName,
        leadType: lead.leadType,
        leadTypeId: lead.leadTypeId
      });
      toast.success(`Assigned Lead ${lead.leadNo} to ${callerName}`);
      setInlineAssignments(prev => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
      await onRefresh?.();
    } catch (err) {
      console.error('Failed to assign caller:', err);
      toast.error('Failed to assign caller');
    }
  };

  // Delete lead
  const handleDelete = async (item, e) => {
    e?.stopPropagation?.();
    if (!window.confirm(`Delete lead ${item.leadNo} (${item.personName || item.customerName})? This cannot be undone.`)) {
      return;
    }
    try {
      await leadApi.deleteLead(item.id);
      toast.success(`Lead ${item.leadNo} deleted`);
      await onRefresh?.();
    } catch (err) {
      console.error('Failed to delete lead:', err);
      toast.error('Failed to delete lead');
    }
  };

  const formatDate = (val) => {
    if (!val) return '-';
    const parts = String(val).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return val;
  };

  // Table Headers tailored to category
  const tableHeaders = useMemo(() => {
    const headers = [
      <div key="select-all" className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={allCurrentChecked}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
          title="Select all on this page"
        />
      </div>,
      "Lead Date",
      "Caller Assigned",
      "Customer Name",
      "Customer Mobile",
      "Email",
      "Location"
    ];

    if (category === 'Real Estate') {
      headers.push("Product Type", "Requirement", "Site Location", "Investment Budget", "When to Buy");
    } else if (category === 'Insurance') {
      headers.push("Insurance Type", "Sub Product Type", "Medical Condition", "Investment Budget");
    } else if (category === 'Mutual Fund') {
      headers.push("Product Type", "Investment Budget");
    }

    headers.push("Lead Source", "Team Member", "Remarks");

    if (isTester) {
      headers.push("Actions");
    }

    return headers;
  }, [category, isTester, allCurrentChecked]);

  // Render Table Row (Desktop)
  const renderRow = (item, index) => {
    const isSelected = selectedIds.has(item.id);
    const dateFormatted = formatLeadDate(item.timestamp || item.created_at || item.date);

    return (
      <tr
        key={item.id || item.leadNo || index}
        onClick={(e) => {
          // Open lead details + call report, except when clicking controls (checkbox, buttons, links, caller picker)
          if (!e.currentTarget.contains(e.target)) return;
          if (e.target.closest('button, a, input, select, label, [role="combobox"], [role="listbox"]')) return;
          onViewDetails?.(item);
        }}
        className={`group cursor-pointer transition-colors border-b border-gray-100 hover:bg-indigo-50/40 ${isSelected ? 'bg-indigo-50/60' : (index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}`}
      >
        {/* Checkbox */}
        <td
          className="px-3 py-2.5 text-center whitespace-nowrap"
          style={{ position: 'sticky', left: 0, zIndex: 10, background: 'inherit' }}
        >
          {isDirectSiteVisitLead(item) ? (
            <input
              type="checkbox"
              disabled
              checked={false}
              className="w-4 h-4 rounded text-gray-300 bg-gray-100 border-gray-300 cursor-not-allowed opacity-40"
              title="Direct Site Visit lead - caller assignment disabled"
            />
          ) : (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => toggleSelectRow(item.id, e)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
          )}
        </td>

        {/* Lead Date */}
        <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap font-medium">
          {dateFormatted}
        </td>

        {/* Caller Assigned / Inline Picker */}
        <td className="px-4 py-2.5 text-center whitespace-nowrap min-w-[180px]">
          {isDirectSiteVisitLead(item) ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
              title={`Direct Site Visit assigned to ${item.assignedVisitor || 'Visitor'}`}
            >
              <MapPin size={12} className="text-blue-600" />
              <span>Site Visit ({item.assignedVisitor || 'Assigned'})</span>
            </span>
          ) : item.callerAssigned ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <UserCheck size={12} className="text-emerald-600" />
              {item.callerAssigned}
            </span>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <div className="w-32">
                <SearchableDropdown
                  options={callerOptions}
                  value={inlineAssignments[item.id] || ''}
                  onChange={(val) => {
                    setInlineAssignments(prev => ({ ...prev, [item.id]: val }));
                    handleQuickAssign(item, val);
                  }}
                  placeholder="Assign caller"
                  height="h-[28px]"
                />
              </div>
            </div>
          )}
        </td>

        {/* Customer Name */}
        <td className="px-4 py-2.5 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="cursor-pointer hover:text-indigo-600 transition" onClick={() => onViewDetails?.(item)}>
              {item.personName || item.customerName || '-'}
            </span>
            {item.visitorFollowUpCount > 0 && (
              <span
                onClick={(e) => { e.stopPropagation(); onViewDetails?.(item); }}
                title={`Site Visit: ${item.siteVisitStatus || 'Recorded'} (${item.visitorFollowUpCount} follow-ups)`}
                className="cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition"
              >
                <MapPin size={10} className="text-emerald-600" />
                <span>Visit: {item.siteVisitStatus || `${item.visitorFollowUpCount}`}</span>
              </span>
            )}
          </div>
        </td>

        {/* Phone */}
        <td className="px-4 py-2.5 text-center text-xs whitespace-nowrap">
          {item.number || item.customerNumber ? (
            <div className="flex items-center justify-center gap-1.5">
              <a
                href={`tel:${getCleanPhone(item.number || item.customerNumber)}`}
                className="font-medium text-gray-700 hover:text-indigo-600 flex items-center gap-1"
                title="Click to call"
              >
                <Phone size={11} className="text-emerald-500" />
                {item.number || item.customerNumber}
              </a>
              <button
                onClick={(e) => handleWhatsApp(item, e)}
                title="Send WhatsApp"
                className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition"
              >
                <MessageSquare size={12} />
              </button>
            </div>
          ) : '-'}
        </td>

        {/* Email */}
        <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap">
          {item.email || item.customerEmail || '-'}
        </td>

        {/* Location */}
        <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap max-w-[140px] truncate" title={item.location || item.customerAddress}>
          {item.location || item.customerAddress || '-'}
        </td>

        {/* Category Specific Columns */}
        {category === 'Real Estate' && (
          <>
            <td className="px-4 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
              {item.productType || '-'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
              {item.requirement || '-'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap">
              {item.siteLocation || '-'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs font-semibold text-emerald-700 whitespace-nowrap">
              {item.investmentBudget || '-'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap">
              {item.whenToBuyPlan || '-'}
            </td>
          </>
        )}

        {category === 'Insurance' && (
          <>
            <td className="px-4 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
              {item.insuranceType || item.productType || '-'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
              {item.insuranceSubType || '-'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap max-w-[120px] truncate" title={item.anyDesease}>
              {item.anyDesease || 'None'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs font-semibold text-emerald-700 whitespace-nowrap">
              {item.investmentBudget || '-'}
            </td>
          </>
        )}

        {category === 'Mutual Fund' && (
          <>
            <td className="px-4 py-2.5 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
              {item.productType || '-'}
            </td>
            <td className="px-4 py-2.5 text-center text-xs font-semibold text-emerald-700 whitespace-nowrap">
              {item.investmentBudget || '-'}
            </td>
          </>
        )}

        {/* Lead Source */}
        <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap">
          {item.leadSource || '-'}
        </td>

        {/* Receiver */}
        <td className="px-4 py-2.5 text-center text-xs text-gray-600 whitespace-nowrap">
          {item.leadReceiver || '-'}
        </td>

        {/* Remarks */}
        <td className="px-4 py-2.5 text-left text-xs text-gray-500 whitespace-nowrap max-w-[160px] truncate" title={item.remarks}>
          {item.remarks || '-'}
        </td>

        {/* Actions */}
        {isTester && (
          <td
            className="px-3 py-2.5 text-center whitespace-nowrap"
            style={{ position: 'sticky', right: 0, zIndex: 10, background: 'inherit' }}
          >
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => onViewDetails?.(item)}
                title="View Full Details"
                className="p-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                <Info size={13} />
              </button>
              <button
                onClick={() => onEditLead?.(item)}
                title="Edit Lead"
                className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={(e) => handleDelete(item, e)}
                title="Delete Lead"
                className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </td>
        )}
      </tr>
    );
  };

  // Render Mobile Card View (optimized for touch & pure mobile responsiveness)
  const renderCard = (item, index) => {
    const isSelected = selectedIds.has(item.id);
    const dateFormatted = formatLeadDate(item.timestamp || item.created_at || item.date);

    return (
      <div
        key={item.id || item.leadNo || index}
        className={`bg-white rounded-xl border transition-all shadow-xs p-3.5 space-y-3 ${isSelected ? 'border-indigo-400 bg-indigo-50/20 ring-1 ring-indigo-300' : 'border-gray-200 hover:border-gray-300'}`}
      >
        {/* Card Top Row: Checkbox, Lead No, Date, Status */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-2">
            {isDirectSiteVisitLead(item) ? (
              <input
                type="checkbox"
                disabled
                checked={false}
                className="w-4 h-4 rounded text-gray-300 bg-gray-100 border-gray-300 cursor-not-allowed opacity-40"
                title="Direct Site Visit lead - caller assignment disabled"
              />
            ) : (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => toggleSelectRow(item.id, e)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
              />
            )}
            <button
              onClick={() => onViewDetails?.(item)}
              className="font-bold text-xs px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100 transition"
            >
              {item.leadNo}
            </button>
            <span className="text-[11px] text-gray-500 font-medium">
              {dateFormatted}
            </span>
          </div>

          <div>
            {isDirectSiteVisitLead(item) ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <MapPin size={10} className="text-blue-600" />
                <span className="max-w-[110px] truncate">Site Visit ({item.assignedVisitor || 'Assigned'})</span>
              </span>
            ) : item.callerAssigned ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <UserCheck size={10} />
                <span className="max-w-[90px] truncate">{item.callerAssigned}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Unassigned
              </span>
            )}
          </div>
        </div>

        {/* Customer Primary Info */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4
                onClick={() => onViewDetails?.(item)}
                className="font-bold text-sm text-gray-900 leading-tight hover:text-indigo-600 cursor-pointer truncate"
              >
                {item.personName || item.customerName || 'Unnamed Customer'}
              </h4>
              {item.visitorFollowUpCount > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); onViewDetails?.(item); }}
                  className="cursor-pointer inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300"
                >
                  <MapPin size={9} className="text-emerald-600" />
                  <span>Visit: {item.siteVisitStatus || `${item.visitorFollowUpCount}`}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 mt-1">
              {(item.number || item.customerNumber) && (
                <span className="font-semibold text-gray-800">{item.number || item.customerNumber}</span>
              )}
              {(item.email || item.customerEmail) && (
                <span className="text-gray-500 truncate max-w-[180px]">{item.email || item.customerEmail}</span>
              )}
              {(item.location || item.customerAddress) && (
                <span className="text-gray-500 truncate max-w-[180px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                  {item.location || item.customerAddress}
                </span>
              )}
            </div>
          </div>

          {/* Quick Call & WhatsApp Buttons */}
          {(item.number || item.customerNumber) && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a
                href={`tel:${getCleanPhone(item.number || item.customerNumber)}`}
                className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition shadow-2xs"
                title="Call"
              >
                <Phone size={13} />
              </a>
              <button
                onClick={(e) => handleWhatsApp(item, e)}
                className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-2xs"
                title="WhatsApp"
              >
                <MessageSquare size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Category Key Pills */}
        <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
          {(item.productType || item.insuranceType) && (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200/60">
              {item.productType || item.insuranceType}
            </span>
          )}
          {item.requirement && (
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-medium border border-amber-200/60">
              {item.requirement}
            </span>
          )}
          {item.siteLocation && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-medium border border-blue-200/60">
              Site: {item.siteLocation}
            </span>
          )}
          {item.insuranceSubType && (
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-medium border border-sky-200/60">
              {item.insuranceSubType}
            </span>
          )}
          {item.anyDesease && item.anyDesease !== 'None' && (
            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-medium border border-rose-200/60">
              Condition: {item.anyDesease}
            </span>
          )}
          {item.investmentBudget && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60">
              ₹ {item.investmentBudget}
            </span>
          )}
        </div>

        {/* Inline Quick Assign for Unassigned Leads (excluding Direct Site Visit) */}
        {!item.callerAssigned && !isDirectSiteVisitLead(item) && (
          <div className="pt-1">
            <SearchableDropdown
              options={callerOptions}
              value={inlineAssignments[item.id] || ''}
              onChange={(val) => {
                setInlineAssignments(prev => ({ ...prev, [item.id]: val }));
                handleQuickAssign(item, val);
              }}
              placeholder="Assign caller to this lead..."
              height="h-[32px]"
            />
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
          <div className="text-[10px] text-gray-400">
            Source: <span className="text-gray-600 font-medium">{item.leadSource || 'Direct'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onViewDetails?.(item)}
              className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100 text-[11px] font-medium transition flex items-center gap-1"
            >
              <Info size={12} /> Details
            </button>
            {isTester && (
              <>
                <button
                  onClick={() => onEditLead?.(item)}
                  className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium border border-indigo-200 transition flex items-center gap-1"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  onClick={(e) => handleDelete(item, e)}
                  className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-medium border border-red-200 transition flex items-center gap-1"
                >
                  <Trash2 size={11} /> Del
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-1">
      {/* Header Bar: Mobile = 2 Rows (Row 1: Tabs, Row 2: Controls & Search); Desktop = 2 Rows matching Call Tracker */}
      <div className="flex flex-col gap-1.5 w-full flex-shrink-0">
        {/* Row 1: Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap w-full pb-0.5">
          <PageTabs tabs={tabs} activeKey={activeTab} onChange={(key) => { onTabChange?.(key); setCurrentPage(1); }} />
        </div>

        {/* Row 2: Dates & Action Buttons on Left, Search/Refresh/Reset on Right */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-1.5 w-full">
          {/* Dates & Add Lead / Bulk Upload Controls */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap shrink-0 w-full xl:w-auto pb-0.5">
            {/* Dedicated Tab / Button for Today's Lead */}
            <button
              type="button"
              onClick={() => {
                setDateFilter('today');
                setCurrentPage(1);
              }}
              title="Show Today's Leads"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold h-[34px] transition-all border shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                dateFilter === 'today'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-300/60 font-bold'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900 font-semibold shadow-xs'
              }`}
            >
              <Calendar size={13} className={dateFilter === 'today' ? 'text-white' : 'text-gray-400'} />
              <span>Today's Lead</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                dateFilter === 'today' ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                {dateCounts.today}
              </span>
            </button>

            {/* Dropdown for All Dates & other date options */}
            <div className="w-[145px] sm:w-[170px] shrink-0">
              <SearchableDropdown
                options={allDatesFilterOptions}
                value={dateFilter === 'today' ? '' : dateFilter}
                onChange={(val) => {
                  setDateFilter(val);
                  if (val === 'custom' && !customDate) {
                    setCustomDate(getTodayStr());
                  }
                  setCurrentPage(1);
                }}
                placeholder={dateFilter === 'today' ? "Other Dates" : "All Dates"}
                height="h-[34px]"
                triggerClassName={
                  dateFilter !== 'today'
                    ? "w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white border border-blue-600 rounded-lg px-2.5 py-1 flex justify-between items-center cursor-pointer shadow-sm h-[34px] font-bold text-xs tracking-wide active:scale-[0.98] ring-2 ring-sky-300/50"
                    : ""
                }
                icon={Clock}
              />
            </div>

            {/* Custom Date Input */}
            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-gray-300 rounded-lg px-2 text-xs h-[34px] text-gray-700 focus:outline-none focus:border-indigo-500 shadow-2xs font-medium shrink-0 cursor-pointer"
              />
            )}

            {canEdit && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onAddLead?.(category)}
                  className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 h-[34px] shrink-0 whitespace-nowrap active:scale-95"
                >
                  <Plus size={14} className="shrink-0" />
                  <span>Add Lead</span>
                </button>

                <button
                  onClick={() => onBulkUpload?.(category)}
                  className="flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 h-[34px] shrink-0 whitespace-nowrap active:scale-95"
                >
                  <Upload size={14} className="shrink-0" />
                  <span>Bulk Upload</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Controls: Search + Refresh + Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-hide w-full xl:w-auto xl:flex-1 justify-between sm:justify-end pb-0.5">
            {/* Search Input */}
            <div className="relative min-w-[120px] max-w-full sm:max-w-[220px] flex-1 shrink">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={`Search ${category} leads...`}
                className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-7 text-xs focus:outline-none focus:border-indigo-500 h-[34px] shadow-xs transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
              className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[34px] w-[34px] shrink-0 transition disabled:opacity-50 active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Clear Filters (visible when any filter or search query is active) */}
            {(activeFiltersCount > 0 || searchQuery) && (
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

      {/* Filter Options Bar (Always Visible) */}
      <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0 mr-1">
          Filter Options:
        </span>

        {/* Caller Status Filter */}
        <div className="w-[130px] lg:w-[150px]">
          <select
            value={callerStatusFilter}
            onChange={(e) => { setCallerStatusFilter(e.target.value); setCurrentPage(1); }}
            title="Status"
            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 h-[30px]"
          >
            <option value="all">All Leads</option>
            <option value="unassigned">Unassigned (Pending)</option>
            <option value="assigned">Caller Assigned</option>
          </select>
        </div>

        {/* Product Type Filter */}
        {distinctProductTypes.length > 0 && (
          <div className="w-[130px] lg:w-[150px]">
            <select
              value={productTypeFilter}
              onChange={(e) => { setProductTypeFilter(e.target.value); setCurrentPage(1); }}
              title="Product Type"
              className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 h-[30px]"
            >
              <option value="">All Products</option>
              {distinctProductTypes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        {/* Requirement Filter (Real Estate only) */}
        {category === 'Real Estate' && distinctRequirements.length > 0 && (
          <div className="w-[130px] lg:w-[150px]">
            <select
              value={requirementFilter}
              onChange={(e) => { setRequirementFilter(e.target.value); setCurrentPage(1); }}
              title="Requirement"
              className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 h-[30px]"
            >
              <option value="">All Requirements</option>
              {distinctRequirements.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {/* Assigned Caller Filter */}
        <div className="w-[130px] lg:w-[150px]">
          <select
            value={callerFilter}
            onChange={(e) => { setCallerFilter(e.target.value); setCurrentPage(1); }}
            title="Caller"
            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 h-[30px]"
          >
            <option value="">All Callers</option>
            {callerOptions.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Lead Source Filter */}
        <div className="w-[130px] lg:w-[150px]">
          <select
            value={leadSourceFilter}
            onChange={(e) => { setLeadSourceFilter(e.target.value); setCurrentPage(1); }}
            title="Source"
            className="w-full bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 h-[30px]"
          >
            <option value="">All Sources</option>
            {LEAD_SOURCES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Batch Caller Assignment Floating Bar (smooth, light-themed, appears when leads are checked) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-5 sm:bottom-7 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] sm:w-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/95 border border-indigo-200 text-gray-900 shadow-2xl rounded-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200 ring-1 ring-indigo-100">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {selectedIds.size}
            </span>
            <span className="text-xs sm:text-sm font-bold text-gray-800 whitespace-nowrap">
              {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="hidden sm:block h-5 w-px bg-gray-200"></div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-48 text-gray-900">
              <SearchableDropdown
                options={callerOptions}
                value={batchCaller}
                onChange={setBatchCaller}
                placeholder="Assign to caller..."
                height="h-[32px]"
              />
            </div>

            <button
              onClick={handleBatchAssign}
              disabled={batchAssigning || !batchCaller}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition active:scale-95 whitespace-nowrap"
            >
              <UserCheck size={13} />
              <span>{batchAssigning ? 'Assigning...' : 'Assign'}</span>
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition whitespace-nowrap"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Main Full-Height Table / Card View */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col">
          <DataTable
            loading={loading}
            headers={tableHeaders}
            data={paginatedLeads}
            renderRow={renderRow}
            renderCard={renderCard}
            minWidth="1400px"
            stickyFirstColumn={true}
            stickyLastColumn={canEdit}
            disableDragScroll={true}
            viewMode={viewMode}
            cardsGridClassName="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2 sm:p-3"
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(num) => { setItemsPerPage(num); setCurrentPage(1); }}
            totalResults={sortedLeads.length}
          />
        </div>
      </div>
    </div>
  );
}
