import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Search, X, RotateCcw, RefreshCw, Users, Building2, ShieldCheck, TrendingUp } from 'lucide-react';
import { customerMasterApi } from '../../api/customerMasterApi';
import DataTable from '../../components/DataTable';
import PageTabs from '../../components/PageTabs';
import SearchableDropdown from '../../components/SearchableDropdown';
import { LEAD_SOURCES } from '../Lead/leadConstants';
import { useAuthStore } from '../../store/authStore';
import { matchesUserAssignment, getUserLeadTypeScope } from '../../utils/authUtils';
import { getLeadTypeTextClass } from '../../utils/leadTypeColors';
import { CUSTOMER_MASTER_STATUSES, CUSTOMER_STATUS_STYLES } from '../CallTracker/callTrackerConstants';
import LeadDetailsModal from '../Lead/LeadDetailsModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildShareClient } from '../../utils/productShare';

const TABS = [
  { key: 'Real Estate', label: 'Real Estate', icon: Building2 },
  { key: 'Insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'Mutual Fund', label: 'Mutual Fund', icon: TrendingUp }
];

// Same category partitioning as the Lead and Call Tracker pages
const getCategory = (l) => {
  const type = (l.leadType || '').toLowerCase();
  const no = String(l.leadNo || '');
  if (type.includes('insurance') || no.startsWith('LI')) return 'Insurance';
  if (type.includes('mutual') || type.includes('fund') || no.startsWith('LM')) return 'Mutual Fund';
  if (type.includes('real') || type.includes('estate') || no.startsWith('LR')) return 'Real Estate';
  return '';
};

// Customer Master lists leads whose latest Customer Status (call_trackers.customer_status) is Hot or Warm.
export default function Customermaster() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  // Tab / filter handed over from a Dashboard card, e.g. { tab: 'Insurance', customerStatus: 'Hot' }
  const navState = useLocation().state || {};

  // Customer whose full record + complete call tracker report is open in the popup
  const [detailsCustomer, setDetailsCustomer] = useState(null);

  // Initial tab from the Dashboard card, else the user's assigned lead type
  const initialTab = useMemo(() => {
    if (navState.tab) return navState.tab;
    const scope = getUserLeadTypeScope(user);
    if (scope?.categories?.length > 0) return scope.categories[0];
    if (user?.leadType) {
      const norm = user.leadType.toLowerCase();
      if (norm.includes('insurance')) return 'Insurance';
      if (norm.includes('mutual')) return 'Mutual Fund';
      if (norm.includes('real') || norm.includes('estate')) return 'Real Estate';
    }
    return 'Real Estate';
  }, [user, navState.tab]);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Role USER gets tabs of all their assigned lead types (both/all tabs if multiple)
  const scope = getUserLeadTypeScope(user);
  const visibleTabs = scope?.categories?.length > 0
    ? TABS.filter(t => scope.categories.includes(t.key))
    : (scope?.category ? TABS.filter(t => t.key === scope.category) : TABS);

  const initialFilters = {
    searchQuery: '',
    leadSource: '',
    callerAssigned: '',
    customerStatus: ''
  };
  const [filters, setFilters] = useState({ ...initialFilters, customerStatus: navState.customerStatus || '' });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerMasterApi.getConvertedCustomers();
      setCustomers((data || []).filter(c => matchesUserAssignment(c, user)));
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const activeFilterCount = [filters.leadSource, filters.callerAssigned, filters.customerStatus].filter(Boolean).length;

  // Live counts per category tab
  const categoryCounts = useMemo(() => {
    const counts = { 'Real Estate': 0, 'Insurance': 0, 'Mutual Fund': 0 };
    customers.forEach(c => {
      const cat = getCategory(c);
      if (cat) counts[cat] += 1;
    });
    return counts;
  }, [customers]);

  const callerOptions = useMemo(() => (
    Array.from(new Set(customers.map(c => c.callerAssigned))).filter(Boolean).sort().map(v => ({ value: v, label: v }))
  ), [customers]);

  const filteredCustomers = customers.filter(c => {
    if (getCategory(c) !== activeTab) return false;
    if (filters.leadSource && c.leadSource !== filters.leadSource) return false;
    if (filters.callerAssigned && c.callerAssigned !== filters.callerAssigned) return false;
    if (filters.customerStatus && c.customerStatus !== filters.customerStatus) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        (c.leadNo || '').toLowerCase().includes(q) ||
        (c.personName || '').toLowerCase().includes(q) ||
        (c.number || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  }).reverse();

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Format YYYY-MM-DD → DD/MM/YYYY for display
  const formatDate = (val) => {
    if (!val) return '-';
    const parts = val.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return val;
  };

  // Distinct text color per Lead Type so the column is easy to scan at a glance (shared across the app)
  const leadTypeColorClass = getLeadTypeTextClass;

  const statusBadgeClass = (status) => {
    switch (status) {
      case 'Interested': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Future Plan Date': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Site Visit/Meeting':
      case 'Meeting': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'Not Interested': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const customerStatusBadge = (value, size = 'text-[10px]') => (
    value ? (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${size} font-bold uppercase border ${CUSTOMER_STATUS_STYLES[value] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
        {value}
      </span>
    ) : '-'
  );

  const tableHeaders = [
    "Lead No", "Lead Type", "Lead Source", "Person Name", "Customer Status", "Number", "Email", "DOB",
    "Occupation", "Requirement", "Investment Range", "Address", "When to Buy Plan", "Assign Caller", "Status"
  ];

  const renderRow = (item) => (
    <tr
      key={item.leadNo}
      onClick={() => setDetailsCustomer(item)}
      title="Click to view full record & call report"
      className="cursor-pointer hover:bg-indigo-50/30 transition-colors border-b border-gray-100"
    >
      <td className="px-4 py-3 text-center text-[14px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo}</td>
      <td className={`px-4 py-3 text-center text-[13px] font-semibold whitespace-nowrap ${leadTypeColorClass(item.leadType)}`}>{item.leadType}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.leadSource}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.personName}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap">{customerStatusBadge(item.customerStatus)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.number}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.email || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.dob)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.occupation || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.requirement || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.investmentBudget || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.location || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.callerAssigned}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClass(item.status)}`}>
          {item.status || '-'}
        </span>
      </td>
    </tr>
  );

  const renderCard = (item) => (
    <div
      key={item.leadNo}
      onClick={() => setDetailsCustomer(item)}
      className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2 cursor-pointer hover:border-indigo-200 active:scale-[0.99] transition"
    >
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className={`text-[9px] uppercase tracking-widest leading-none block mb-1 font-semibold ${leadTypeColorClass(item.leadType)}`}>{item.leadNo} · {item.leadType}</span>
          <h4 className="text-sm text-gray-900 leading-tight">{item.personName}</h4>
        </div>
        <div className="flex items-center gap-1">
          {customerStatusBadge(item.customerStatus, 'text-[9px]')}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border whitespace-nowrap ${statusBadgeClass(item.status)}`}>
            {item.status || '-'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Number</p>
          <p className="text-gray-700 truncate leading-tight">{item.number}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Assign Caller</p>
          <p className="text-gray-700 truncate leading-tight">{item.callerAssigned}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Source</p>
          <p className="text-gray-700 truncate leading-tight">{item.leadSource || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Email</p>
          <p className="text-gray-700 truncate leading-tight">{item.email || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">DOB</p>
          <p className="text-gray-700 truncate leading-tight">{formatDate(item.dob)}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Occupation</p>
          <p className="text-gray-700 truncate leading-tight">{item.occupation || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Investment Range</p>
          <p className="text-gray-700 truncate leading-tight">{item.investmentBudget || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">When to Buy</p>
          <p className="text-gray-700 truncate leading-tight">{item.whenToBuyPlan || '-'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Address</p>
          <p className="text-gray-700 truncate leading-tight">{item.location || '-'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 space-y-1">
      {/* Header Bar: Row 1 = Lead Category Tabs; Row 2 = Search & Actions Controls */}
      <div className="flex flex-col gap-1.5 w-full flex-shrink-0">
        {/* Row 1: Lead Category Button Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap w-full pb-0.5">
          <PageTabs
            tabs={visibleTabs.map(t => ({ ...t, count: categoryCounts[t.key] ?? 0 }))}
            activeKey={activeTab}
            onChange={(key) => { setActiveTab(key); setCurrentPage(1); }}
          />
        </div>

        {/* Row 2: Search + Filter + Refresh + Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-hide w-full justify-between sm:justify-end pb-0.5">
          {/* Search Input */}
          <div className="relative min-w-[140px] sm:min-w-[180px] max-w-full sm:max-w-[240px] flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <input
              type="text"
              placeholder={`Search ${activeTab} customers...`}
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-7 text-xs focus:outline-none focus:border-indigo-500 h-[34px] shadow-xs transition"
            />
            {filters.searchQuery && (
              <button
                onClick={() => updateFilter('searchQuery', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg h-[34px] w-[34px] shrink-0 transition disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Clear Filters (visible when any filter or search query is active) */}
          {(activeFilterCount > 0 || filters.searchQuery) && (
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
      <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex-wrap">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0 mr-1">
          Filter Options:
        </span>

        <div className="w-[130px] lg:w-[150px]">
          <SearchableDropdown
            options={CUSTOMER_MASTER_STATUSES.map(v => ({ value: v, label: v }))}
            value={filters.customerStatus}
            onChange={(val) => updateFilter('customerStatus', val)}
            placeholder="Hot & Warm"
            height="h-[30px]"
          />
        </div>

        <div className="w-[130px] lg:w-[150px]">
          <SearchableDropdown
            options={LEAD_SOURCES.map(v => ({ value: v, label: v }))}
            value={filters.leadSource}
            onChange={(val) => updateFilter('leadSource', val)}
            placeholder="All Lead Source"
            height="h-[30px]"
          />
        </div>

        <div className="w-[130px] lg:w-[150px]">
          <SearchableDropdown
            options={callerOptions}
            value={filters.callerAssigned}
            onChange={(val) => updateFilter('callerAssigned', val)}
            placeholder="All Assigned Caller"
            height="h-[30px]"
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setFilters(prev => ({ ...prev, leadSource: '', callerAssigned: '', customerStatus: '' }));
              setCurrentPage(1);
            }}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline ml-auto cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main Full-Height Table View */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs flex flex-col">
        {loading && customers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-semibold tracking-wide uppercase">Loading {activeTab} Customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-4 space-y-3">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-200">
              <Users size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">No {activeTab} Customers Found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Customers appear here once their latest Customer Status is Hot or Warm.
              </p>
            </div>
            {(activeFilterCount > 0 || filters.searchQuery) && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-100 transition"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <DataTable
              headers={tableHeaders}
              data={paginatedCustomers}
              renderRow={renderRow}
              renderCard={renderCard}
              minWidth="1950px"
              viewMode="auto"
              cardsGridClassName="grid grid-cols-1 gap-2.5 p-2 sm:p-3"
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
              totalResults={filteredCustomers.length}
            />
          </div>
        )}
      </div>

      {/* Full customer record + complete call tracker report (fetched by lead_id) */}
      <LeadDetailsModal
        isOpen={Boolean(detailsCustomer)}
        onClose={() => setDetailsCustomer(null)}
        lead={detailsCustomer}
        onShareProducts={(customer) => {
          setDetailsCustomer(null);
          navigate('/products', { state: { shareClient: buildShareClient(customer) } });
        }}
      />
    </div>
  );
}
