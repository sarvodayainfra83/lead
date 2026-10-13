import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Search, RotateCcw, FileSpreadsheet, Eye, X, Calendar, Phone,
  User, Briefcase, IndianRupee, Layers, Handshake, ClipboardList, LayoutGrid,
  Building2, ShieldCheck, TrendingUp
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import DataTable from '../../components/DataTable';
import PageTabs from '../../components/PageTabs';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, getUserLeadTypeScope, matchesUserConnection } from '../../utils/authUtils';

// A closed deal = a Site Visit / Meeting follow-up with outcome 'Deal Lock' (or a legacy "Closed Won" status),
// the same rule as the Dashboard's Deal Closed card
const isLockedStatus = (status) => {
  const s = String(status || '').toLowerCase().trim();
  return s === 'deal lock' || s === 'closed won' || s === 'closed' || s === 'deal closed';
};

const categoryOf = (lead) => {
  const type = (lead.leadType || '').toLowerCase();
  const no = lead.leadNo || '';
  if (type.includes('insurance') || no.startsWith('LI')) return 'Insurance';
  if (type.includes('mutual') || type.includes('fund') || no.startsWith('LM')) return 'Mutual Fund';
  return 'Real Estate';
};

const logMs = (f) => Number(f?.timestampMs) || (f?.createdAt ? new Date(f.createdAt).getTime() : 0);

const formatAmount = (val) => {
  const n = Number(String(val ?? '').replace(/[^0-9.]/g, ''));
  return n > 0 ? `₹${n.toLocaleString('en-IN')}` : '';
};

const formatMsDate = (ms) => {
  if (!ms) return '-';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// YYYY-MM-DD / DD/MM/YYYY / ISO → DD/MM/YYYY
const formatDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim().split('T')[0].split(' ')[0];
  const parts = str.includes('-') ? str.split('-') : str.split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts;
    return a.length === 4 ? `${c.padStart(2, '0')}/${b.padStart(2, '0')}/${a}` : `${a.padStart(2, '0')}/${b.padStart(2, '0')}/${c.length === 2 ? `20${c}` : c}`;
  }
  return str || '-';
};

const CATEGORY_STYLES = {
  'Real Estate': 'bg-amber-50 text-amber-700 border-amber-200',
  Insurance: 'bg-sky-50 text-sky-700 border-sky-200',
  'Mutual Fund': 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

// Product / plan line shown in the list: what the customer chose for their lead type
const planOf = (d) => {
  if (d.category === 'Insurance') return [d.insuranceType || d.productType, d.insuranceSubType].filter(Boolean).join(' · ');
  if (d.category === 'Real Estate') return [d.productType, d.requirement].filter(Boolean).join(' · ');
  return d.productType || '';
};

const Field = ({ label, value, wide = false }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="text-[13px] text-gray-800 font-medium break-words whitespace-pre-wrap">{value || '-'}</p>
  </div>
);

const Section = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-gray-200 overflow-hidden">
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
      <Icon size={14} className="text-indigo-600" />
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700">{title}</h4>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 p-3">{children}</div>
  </div>
);

function DealDetailsModal({ deal, onClose }) {
  if (!deal) return null;
  const isInsurance = deal.category === 'Insurance';
  const isRealEstate = deal.category === 'Real Estate';
  const history = [...(deal.followUps || [])].reverse();

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 truncate">{deal.customerName || 'Customer'}</h3>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${CATEGORY_STYLES[deal.category]}`}>{deal.category}</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border bg-violet-600 text-white border-violet-700">Deal Closed</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {deal.leadNo || '-'} · Closed on {formatMsDate(deal.closedMs)}
              {deal.amountText ? ` · ${deal.amountText}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Section icon={User} title="Customer Details">
            <Field label="Customer Name" value={deal.customerName} />
            <Field label="Phone Number" value={deal.customerNumber} />
            <Field label="Email" value={deal.customerEmail} />
            <Field label="Date of Birth" value={deal.dob ? formatDate(deal.dob) : ''} />
            <Field label="Occupation" value={deal.occupation} />
            <Field label="Customer Status" value={deal.customerStatus} />
            <Field label="Address" value={deal.customerAddress} wide />
          </Section>

          <Section icon={Layers} title="Product & Investment Plan">
            <Field label="Lead Type" value={deal.category} />
            <Field label="Product Type" value={isInsurance ? (deal.insuranceType || deal.productType) : deal.productType} />
            {isRealEstate && <Field label="Requirement" value={deal.requirement} />}
            {isRealEstate && <Field label="Site Location" value={deal.siteLocation} />}
            {isInsurance && <Field label="Insurance Sub Type" value={deal.insuranceSubType} />}
            {isInsurance && <Field label="Any Disease" value={deal.anyDesease} />}
            <Field label="Investment Budget" value={deal.investmentBudget} />
            <Field label="When To Buy / Plan" value={deal.whenToBuyPlan} />
          </Section>

          <Section icon={Handshake} title="Deal Details">
            <Field label="Deal Closed On" value={formatMsDate(deal.closedMs)} />
            <Field label="Closing Amount" value={deal.amountText} />
            <Field label="Sales Executive" value={deal.salesExecutive} />
            <Field label="Reference No" value={deal.referenceNo} />
            <Field label={isRealEstate ? 'Assigned Visitor' : 'Meeting Assigned To'} value={deal.assignedVisitor} />
            <Field label="Meeting / Visit Date" value={deal.meetingDate ? formatDate(deal.meetingDate) : ''} />
            <Field label="Closing Feedback" value={deal.closingFeedback} wide />
            {deal.dealRemarks && <Field label="Deal Remarks" value={deal.dealRemarks} wide />}
          </Section>

          <Section icon={Briefcase} title="Lead Details">
            <Field label="Lead No" value={deal.leadNo} />
            <Field label="Lead Source" value={deal.leadSource} />
            <Field label="Referencer Name" value={deal.referencerName} />
            <Field label="Lead Receiver / RM" value={deal.leadReceiver || deal.relationshipManager} />
            <Field label="Caller Assigned" value={deal.callerAssigned} />
            <Field label="Lead Created On" value={deal.timestamp ? formatDate(deal.timestamp) : ''} />
            <Field label="Lead Remarks" value={deal.leadRemarks} wide />
          </Section>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
              <ClipboardList size={14} className="text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700">Follow-up History ({history.length})</h4>
            </div>
            {history.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {history.map((f, i) => (
                  <li key={f.id || i} className="px-3 py-2 text-xs flex gap-3">
                    <span className="text-gray-500 font-mono whitespace-nowrap">{formatMsDate(logMs(f))}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${isLockedStatus(f.status) ? 'bg-violet-100 text-violet-800 border-violet-300' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {isLockedStatus(f.status) ? 'Deal Lock' : (f.status || '-')}
                        </span>
                        {f.visitorName && <span className="text-gray-500">by {f.visitorName}</span>}
                      </div>
                      {f.whatHappened && <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{f.whatHappened}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 italic p-3">No follow-ups recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DealClosed() {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  // The Dashboard's Deal Closed card opens this page on its lead type tab
  const navTab = useLocation().state?.tab;
  const [activeTab, setActiveTab] = useState(navTab || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewDeal, setViewDeal] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const leads = await siteVisitMeetingApi.getAllSiteVisitMeetingLeads();
      const scope = getUserLeadTypeScope(user);
      const scopeCats = scope?.categories?.length > 0 ? scope.categories : (scope?.category ? [scope.category] : null);

      const rows = (leads || [])
        .map(lead => {
          const followUps = lead.followUps || [];
          const dealFollowUp = [...followUps].reverse().find(f => isLockedStatus(f.status)) || null;
          if (!dealFollowUp && !isLockedStatus(lead.status)) return null;
          const deal = dealFollowUp || lead;
          const closedMs = dealFollowUp ? logMs(dealFollowUp) : (new Date(lead.lastUpdated || 0).getTime() || 0);
          return {
            ...lead,
            category: categoryOf(lead),
            dealFollowUp,
            closedMs,
            closingAmount: deal.closingAmount,
            amountText: formatAmount(deal.closingAmount),
            salesExecutive: deal.salesExecutive || deal.visitorName || lead.assignedVisitor || '',
            referenceNo: deal.referenceNo || '',
            dealRemarks: deal.dealRemarks || '',
            closingFeedback: deal.whatHappened || lead.whatHappened || ''
          };
        })
        .filter(Boolean)
        // Non-admins see only the deals they're connected to, within their lead types (same as Site Visit / Meeting)
        .filter(d => isAdmin || matchesUserConnection(d, user))
        .filter(d => isAdmin || !scopeCats || scopeCats.includes(d.category))
        .sort((a, b) => b.closedMs - a.closedMs);

      setDeals(rows);
    } catch (err) {
      console.error('Failed to load closed deals:', err);
      toast.error('Failed to load closed deals');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  }, []);

  // Listen for sidebar click to reset filters
  useEffect(() => {
    const handleClear = (e) => {
      if (!e?.detail?.path || e.detail.path === '/deal-closed') handleClearFilters();
    };
    window.addEventListener('app:clear-filters', handleClear);
    return () => window.removeEventListener('app:clear-filters', handleClear);
  }, [handleClearFilters]);

  // Rows after the search and closed-date filters (tab counts use these)
  const baseFiltered = useMemo(() => {
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    const q = searchQuery.trim().toLowerCase();
    return deals.filter(d => {
      if (fromMs !== null && d.closedMs < fromMs) return false;
      if (toMs !== null && d.closedMs > toMs) return false;
      if (!q) return true;
      return [
        d.leadNo, d.customerName, d.customerNumber, d.customerEmail, d.customerAddress, d.productType,
        d.insuranceType, d.insuranceSubType, d.requirement, d.investmentBudget, d.salesExecutive,
        d.referenceNo, d.assignedVisitor, d.leadSource, d.closingFeedback
      ].some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [deals, searchQuery, fromDate, toDate]);

  const filteredDeals = useMemo(
    () => (activeTab === 'All' ? baseFiltered : baseFiltered.filter(d => d.category === activeTab)),
    [baseFiltered, activeTab]
  );

  const totalAmount = useMemo(
    () => filteredDeals.reduce((sum, d) => sum + (Number(String(d.closingAmount ?? '').replace(/[^0-9.]/g, '')) || 0), 0),
    [filteredDeals]
  );

  const availableCats = useMemo(() => {
    const scope = getUserLeadTypeScope(user);
    const cats = ['Real Estate', 'Insurance', 'Mutual Fund'];
    if (isAdmin) return cats;
    if (scope?.categories?.length > 0) return cats.filter(c => scope.categories.includes(c));
    if (scope?.category) return [scope.category];
    return cats;
  }, [user, isAdmin]);

  const CAT_ICONS = { 'Real Estate': Building2, Insurance: ShieldCheck, 'Mutual Fund': TrendingUp };
  const tabs = [
    ...(availableCats.length > 1 ? [{ key: 'All', label: 'All', icon: LayoutGrid, count: baseFiltered.length }] : []),
    ...availableCats.map(c => ({ key: c, label: c, icon: CAT_ICONS[c], count: baseFiltered.filter(d => d.category === c).length }))
  ];
  const currentTab = tabs.some(t => t.key === activeTab) ? activeTab : tabs[0]?.key;
  useEffect(() => {
    if (currentTab && currentTab !== activeTab) setActiveTab(currentTab);
  }, [currentTab, activeTab]);

  const isFilterActive = searchQuery || fromDate || toDate;

  const exportToExcel = () => {
    if (filteredDeals.length === 0) {
      toast.error('No closed deals to export');
      return;
    }
    const data = filteredDeals.map((d, i) => ({
      'SR No': i + 1,
      'Deal Closed On': formatMsDate(d.closedMs),
      'Lead No': d.leadNo || '-',
      'Lead Type': d.category,
      'Customer Name': d.customerName || '-',
      'Phone Number': d.customerNumber || '-',
      'Email': d.customerEmail || '-',
      'Address': d.customerAddress || '-',
      'Date of Birth': d.dob ? formatDate(d.dob) : '-',
      'Occupation': d.occupation || '-',
      'Product Type': (d.category === 'Insurance' ? (d.insuranceType || d.productType) : d.productType) || '-',
      'Requirement': d.requirement || '-',
      'Site Location': d.siteLocation || '-',
      'Insurance Sub Type': d.insuranceSubType || '-',
      'Any Disease': d.anyDesease || '-',
      'Investment Budget': d.investmentBudget || '-',
      'When To Buy / Plan': d.whenToBuyPlan || '-',
      'Closing Amount': d.amountText || '-',
      'Sales Executive': d.salesExecutive || '-',
      'Reference No': d.referenceNo || '-',
      'Assigned Visitor / Meeting By': d.assignedVisitor || '-',
      'Closing Feedback': d.closingFeedback || '-',
      'Deal Remarks': d.dealRemarks || '-',
      'Customer Status': d.customerStatus || '-',
      'Lead Source': d.leadSource || '-',
      'Referencer Name': d.referencerName || '-',
      'Lead Receiver / RM': d.leadReceiver || d.relationshipManager || '-',
      'Caller Assigned': d.callerAssigned || '-',
      'Total Follow-ups': (d.followUps || []).length,
      'Lead Remarks': d.leadRemarks || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deal Closed');
    XLSX.writeFile(wb, `Deal_Closed_${String(currentTab || 'All').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const tableHeaders = [
    'Action', 'Closed On', 'Lead No', 'Lead Type', 'Customer Name', 'Phone Number', 'Product / Plan',
    'Investment Budget', 'Closing Amount', 'Sales Executive', 'Reference No', 'Address'
  ];

  const totalPages = Math.ceil(filteredDeals.length / itemsPerPage) || 1;
  const paginated = filteredDeals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderRow = (d) => (
    <tr
      key={d.leadId || d.id}
      onClick={() => setViewDeal(d)}
      className="cursor-pointer hover:bg-violet-50/60 transition-colors border-b border-gray-100"
    >
      <td className="px-3 py-2.5 text-center whitespace-nowrap">
        <button
          onClick={(e) => { e.stopPropagation(); setViewDeal(d); }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold cursor-pointer"
        >
          <Eye size={13} /> View
        </button>
      </td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-700 whitespace-nowrap">{formatMsDate(d.closedMs)}</td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-700 font-mono whitespace-nowrap">{d.leadNo || '-'}</td>
      <td className="px-3 py-2.5 text-center whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${CATEGORY_STYLES[d.category]}`}>{d.category}</span>
      </td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-900 font-semibold whitespace-nowrap">{d.customerName || '-'}</td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-700 whitespace-nowrap">{d.customerNumber || '-'}</td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-700 max-w-[220px] truncate" title={planOf(d)}>{planOf(d) || '-'}</td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-700 whitespace-nowrap">{d.investmentBudget || '-'}</td>
      <td className="px-3 py-2.5 text-center text-[13px] font-bold text-emerald-700 whitespace-nowrap">{d.amountText || '-'}</td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-700 whitespace-nowrap">{d.salesExecutive || '-'}</td>
      <td className="px-3 py-2.5 text-center text-[13px] text-gray-700 whitespace-nowrap">{d.referenceNo || '-'}</td>
      <td className="px-3 py-2.5 text-left text-[13px] text-gray-700 max-w-[240px] truncate" title={d.customerAddress}>{d.customerAddress || '-'}</td>
    </tr>
  );

  const renderCard = (d) => (
    <div
      key={d.leadId || d.id}
      onClick={() => setViewDeal(d)}
      className="bg-white rounded-xl border border-violet-200 border-l-4 border-l-violet-500 shadow-2xs p-3 space-y-2 cursor-pointer"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-widest text-violet-600 font-bold">{d.leadNo || '-'} · Closed {formatMsDate(d.closedMs)}</p>
          <h4 className="text-sm font-bold text-gray-900 truncate">{d.customerName || 'Customer'}</h4>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border shrink-0 ${CATEGORY_STYLES[d.category]}`}>{d.category}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex items-center gap-1 text-gray-700 min-w-0"><Phone size={11} className="text-gray-400 shrink-0" /><span className="truncate">{d.customerNumber || '-'}</span></div>
        <div className="flex items-center gap-1 font-bold text-emerald-700 min-w-0"><IndianRupee size={11} className="shrink-0" /><span className="truncate">{d.amountText ? d.amountText.replace('₹', '') : '-'}</span></div>
        <div className="col-span-2 text-gray-700 truncate"><span className="text-gray-400">Plan: </span>{planOf(d) || '-'}</div>
        <div className="text-gray-700 truncate"><span className="text-gray-400">Budget: </span>{d.investmentBudget || '-'}</div>
        <div className="text-gray-700 truncate"><span className="text-gray-400">By: </span>{d.salesExecutive || '-'}</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      <div className="flex flex-col xl:flex-row xl:items-center gap-2 w-full flex-shrink-0">
        <PageTabs tabs={tabs} activeKey={currentTab} onChange={(k) => { setActiveTab(k); setCurrentPage(1); }} fill className="w-full xl:w-auto" />

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:flex-1 xl:justify-end">
          <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 h-[34px] shadow-2xs shrink-0">
            <Calendar size={14} className="text-indigo-600 shrink-0" />
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="text-xs text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              title="Closed From"
            />
            <span className="text-gray-400 text-xs font-bold">-</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
              className="text-xs text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              title="Closed To"
            />
          </div>

          <div className="relative flex-1 min-w-[160px] sm:max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search customer, product, lead no..."
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 text-xs focus:outline-none focus:border-indigo-500 h-[34px] shadow-2xs"
            />
          </div>

          {isAdmin && (
            <button
              onClick={exportToExcel}
              title="Export closed deals to Excel"
              className="flex items-center justify-center gap-1 px-3 rounded-lg text-xs font-semibold h-[34px] border shrink-0 bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}

          {isFilterActive && (
            <button
              onClick={handleClearFilters}
              title="Clear filters"
              className="flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg h-[34px] px-3 text-xs font-semibold gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs flex-shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 font-semibold">
          <Handshake size={13} /> {filteredDeals.length} deal{filteredDeals.length === 1 ? '' : 's'} closed
        </span>
        {totalAmount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            <IndianRupee size={13} /> {totalAmount.toLocaleString('en-IN')} total closing amount
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          loading={loading}
          headers={tableHeaders}
          data={paginated}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="1300px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredDeals.length}
        />
      </div>

      <DealDetailsModal deal={viewDeal} onClose={() => setViewDeal(null)} />
    </div>
  );
}
