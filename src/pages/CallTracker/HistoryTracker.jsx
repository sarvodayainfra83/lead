import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Info, Filter, RotateCcw } from 'lucide-react';
import { getLeads, getCallTrackers } from '../../utils/storageManager';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import { LEAD_TYPES } from '../Lead/leadConstants';
import { ENQUIRY_STATUSES, annotateFollowUpNumbers } from './callTrackerConstants';

const STATUS_STYLES = {
  Received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Expected: 'bg-amber-50 text-amber-700 border-amber-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Need Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Call Not Received': 'bg-orange-50 text-orange-700 border-orange-200'
};

export default function HistoryTracker({ tabBar }) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);

  const initialFilters = {
    searchQuery: '',
    leadType: '',
    status: '',
    callerAssigned: ''
  };
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => {
    const leads = getLeads();
    const trackers = getCallTrackers();
    const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));
    const rows = annotateFollowUpNumbers(trackers).map(t => ({
      ...(leadsById[t.leadId] || {}),
      ...t
    }));
    setHistoryRows(rows);
  }, []);

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const filteredRows = historyRows.filter(r => {
    if (filters.leadType && r.leadType !== filters.leadType) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.callerAssigned && r.callerAssigned !== filters.callerAssigned) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        (r.leadNo || '').toLowerCase().includes(q) ||
        (r.personName || '').toLowerCase().includes(q) ||
        (r.number || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  }).reverse();

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice(
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

  const tableHeaders = [
    "Lead No", "Lead Type", "Lead Source", "Person Name", "Number", "Email", "DOB", "Occupation",
    "Investment Range", "Address", "When to Buy Plan", "Assign Caller", "Status",
    "What did Customer Said", "Next Date", "Follow Up No"
  ];

  const renderRow = (item) => (
    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[14px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.leadType || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.leadSource || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.personName || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.number || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.email || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.dob)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.occupation || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.investmentBudget || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.location || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.callerAssigned || '-'}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_STYLES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {item.status}
        </span>
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.customerSaid}>
        {item.customerSaid || '-'}
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.nextDate)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.followUpNo}</td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">{item.leadNo} · Follow Up {item.followUpNo}</span>
          <h4 className="text-sm text-gray-900 leading-tight">{item.personName}</h4>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase border ${STATUS_STYLES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {item.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Number</p>
          <p className="text-gray-700 truncate leading-tight">{item.number || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Next Date</p>
          <p className="text-gray-700 truncate leading-tight">{formatDate(item.nextDate)}</p>
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
        <div className="col-span-2">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Assign Caller</p>
          <p className="text-gray-700 truncate leading-tight">{item.callerAssigned || '-'}</p>
        </div>
        {item.customerSaid && (
          <div className="col-span-2">
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">What Customer Said</p>
            <p className="text-gray-700 leading-tight">{item.customerSaid}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-2 md:space-y-6 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full px-2 sm:px-0">
        {tabBar && <div className="w-full lg:w-auto lg:flex-shrink-0">{tabBar}</div>}
        {/* Mobile Top Bar */}
        <div className="flex items-center gap-2 w-full lg:hidden">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-[9px] text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search history..."
              value={filters.searchQuery}
              onChange={(e) => { setFilters({ ...filters, searchQuery: e.target.value }); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-xs h-[32px]"
            />
          </div>
          <button
             onClick={() => setShowMobileFilters(!showMobileFilters)}
             className={`flex items-center justify-center rounded-lg shadow-sm h-[32px] w-[32px] flex-shrink-0 transition ${showMobileFilters ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter size={14} />
          </button>
          <button
            onClick={handleClearFilters}
            className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg h-[32px] w-[32px] flex-shrink-0 shadow-sm active:scale-95"
            title="Clear Filters"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Mobile Collapsible Filters */}
        <div className={`${showMobileFilters ? 'grid' : 'hidden'} lg:hidden grid-cols-2 gap-2 w-full`}>
          <SearchableDropdown
            options={LEAD_TYPES.map(v => ({ value: v, label: v }))}
            value={filters.leadType}
            onChange={(val) => { setFilters({ ...filters, leadType: val }); setCurrentPage(1); }}
            placeholder="All Lead Type"
            height="h-[32px]"
          />
          <SearchableDropdown
            options={ENQUIRY_STATUSES.map(v => ({ value: v, label: v }))}
            value={filters.status}
            onChange={(val) => { setFilters({ ...filters, status: val }); setCurrentPage(1); }}
            placeholder="All Status"
            height="h-[32px]"
          />
          <div className="col-span-2">
            <SearchableDropdown
              options={Array.from(new Set(historyRows.map(r => r.callerAssigned))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
              value={filters.callerAssigned}
              onChange={(val) => { setFilters({ ...filters, callerAssigned: val }); setCurrentPage(1); }}
              placeholder="All Assigned Caller"
              height="h-[32px]"
            />
          </div>
        </div>

        {/* Desktop Row */}
        <div className="hidden lg:flex lg:flex-1 items-center gap-3">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-2.5 top-[11px] text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search history..."
              value={filters.searchQuery}
              onChange={(e) => { setFilters({ ...filters, searchQuery: e.target.value }); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-sm h-[38px]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <SearchableDropdown
              options={LEAD_TYPES.map(v => ({ value: v, label: v }))}
              value={filters.leadType}
              onChange={(val) => { setFilters({ ...filters, leadType: val }); setCurrentPage(1); }}
              placeholder="All Lead Type"
              height="h-[38px]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <SearchableDropdown
              options={ENQUIRY_STATUSES.map(v => ({ value: v, label: v }))}
              value={filters.status}
              onChange={(val) => { setFilters({ ...filters, status: val }); setCurrentPage(1); }}
              placeholder="All Status"
              height="h-[38px]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <SearchableDropdown
              options={Array.from(new Set(historyRows.map(r => r.callerAssigned))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
              value={filters.callerAssigned}
              onChange={(val) => { setFilters({ ...filters, callerAssigned: val }); setCurrentPage(1); }}
              placeholder="All Assigned Caller"
              height="h-[38px]"
            />
          </div>
          <button
            onClick={handleClearFilters}
            className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded w-[38px] h-[38px] hover:bg-gray-100 transition-colors shadow-sm flex-shrink-0"
            title="Clear Filters"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="2250px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredRows.length}
        />
      </div>
    </div>
  );
}
