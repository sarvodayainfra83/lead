import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Phone, Search, Info, Filter, RotateCcw } from 'lucide-react';
import { getLeads, getCallTrackers } from '../../utils/storageManager';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import FormTracker from './FormTracker';
import { LEAD_TYPES } from '../Lead/leadConstants';
import { isLeadPending, getTrackersForLead } from './callTrackerConstants';

const STATUS_STYLES = {
  Received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Expected: 'bg-amber-50 text-amber-700 border-amber-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Need Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Call Not Received': 'bg-orange-50 text-orange-700 border-orange-200'
};

export default function PendingTracker({ tabBar }) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [pendingRows, setPendingRows] = useState([]);
  const [callLead, setCallLead] = useState(null); // lead currently being called

  const initialFilters = {
    searchQuery: '',
    leadType: '',
    callerAssigned: '',
    date: ''
  };
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const loadPending = () => {
    const leads = getLeads();
    const trackers = getCallTrackers();
    const rows = leads
      .filter(lead => isLeadPending(trackers, lead))
      .map(lead => {
        const trackersForLead = getTrackersForLead(trackers, lead.id);
        const latest = trackersForLead[trackersForLead.length - 1] || null;
        return {
          ...lead,
          followUpNo: trackersForLead.length,
          status: latest?.status || '',
          customerSaid: latest?.customerSaid || '',
          nextCallDate: latest?.nextDate || ''
        };
      });
    setPendingRows(rows);
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const filteredRows = pendingRows.filter(l => {
    if (filters.leadType && l.leadType !== filters.leadType) return false;
    if (filters.callerAssigned && l.callerAssigned !== filters.callerAssigned) return false;
    if (filters.date && l.nextCallDate !== filters.date) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        l.leadNo.toLowerCase().includes(q) ||
        l.personName.toLowerCase().includes(q) ||
        l.number.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.location || '').toLowerCase().includes(q)
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
    "Action", "Lead No", "Lead Type", "Follow Up No", "Status", "What did Customer Show", "Next Call Date",
    "Person Name", "Number", "Email", "DOB", "Occupation",
    "Investment Range", "Address", "When to Buy Plan", "Assign Caller", "Remarks", "Process Type"
  ];

  const processTypeBadge = (item) => {
    const type = item.processType || 'Lead';
    const isDirect = type === 'Direct';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
        isDirect ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
      }`}>
        {type}
      </span>
    );
  };

  const renderRow = (item) => (
    <tr key={item.leadNo} className="group hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      {/* Action column (sticky first) */}
      <td
        className="px-3 py-2 text-center whitespace-nowrap bg-white group-hover:bg-indigo-50 transition-colors"
        style={{ position: 'sticky', left: 0, zIndex: 10, boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}
      >
        <button
          onClick={() => setCallLead(item)}
          title="Call Now"
          className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide hover:bg-indigo-100 transition-colors"
        >
          <Phone size={12} /> Call Now
        </button>
      </td>
      <td className="px-4 py-3 text-center text-[14px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.leadType}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.followUpNo}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {item.status ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_STYLES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {item.status}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-700 max-w-[220px] truncate" title={item.customerSaid || ''}>
        {item.customerSaid || '-'}
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.nextCallDate)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.personName}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.number}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.email || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.dob)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.occupation || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.investmentBudget || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.location || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.callerAssigned}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.remarks}>
        {item.remarks || '-'}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap">{processTypeBadge(item)}</td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.leadNo} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">{item.leadNo} · {item.leadType}</span>
          <h4 className="text-sm text-gray-900 leading-tight">{item.personName}</h4>
        </div>
        <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold uppercase">
          Follow Up {item.followUpNo}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Number</p>
          <p className="text-gray-700 truncate leading-tight">{item.number}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Next Call Date</p>
          <p className="text-gray-700 truncate leading-tight">{formatDate(item.nextCallDate)}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Status</p>
          <p className="text-gray-700 truncate leading-tight">{item.status || '-'}</p>
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
          <p className="text-gray-700 truncate leading-tight">{item.callerAssigned}</p>
        </div>
        {item.customerSaid && (
          <div className="col-span-2">
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">What Customer Said</p>
            <p className="text-gray-700 leading-tight">{item.customerSaid}</p>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Remarks</p>
          <p className="text-gray-700 leading-tight">{item.remarks || '-'}</p>
        </div>
        <div className="col-span-2 flex justify-between items-center mt-1">
          <span className="text-gray-400 uppercase tracking-tighter text-[8px]">Process Type</span>
          {processTypeBadge(item)}
        </div>
      </div>

      <button
        onClick={() => setCallLead(item)}
        className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5"
      >
        <Phone size={12} /> Call Now
      </button>
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
              placeholder="Search pending leads..."
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
            options={Array.from(new Set(pendingRows.map(l => l.callerAssigned))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
            value={filters.callerAssigned}
            onChange={(val) => { setFilters({ ...filters, callerAssigned: val }); setCurrentPage(1); }}
            placeholder="All Assigned Caller"
            height="h-[32px]"
          />
          <div className="col-span-2 sm:col-span-1">
            <input
              type="date"
              value={filters.date}
              onChange={(e) => { setFilters({ ...filters, date: e.target.value }); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-[13px] h-[32px] text-gray-600"
            />
          </div>
        </div>

        {/* Desktop Row */}
        <div className="hidden lg:flex lg:flex-1 items-center gap-3">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-2.5 top-[11px] text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search pending leads..."
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
              options={Array.from(new Set(pendingRows.map(l => l.callerAssigned))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
              value={filters.callerAssigned}
              onChange={(val) => { setFilters({ ...filters, callerAssigned: val }); setCurrentPage(1); }}
              placeholder="All Assigned Caller"
              height="h-[38px]"
            />
          </div>
          <div className="flex-1 min-w-0 max-w-[150px]">
            <input
              type="date"
              value={filters.date}
              onChange={(e) => { setFilters({ ...filters, date: e.target.value }); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-sm h-[38px] text-gray-600"
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
          minWidth="2450px"
          stickyFirstColumn
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredRows.length}
        />
      </div>

      {/* Call Now Modal */}
      <FormTracker
        isOpen={!!callLead}
        onClose={() => setCallLead(null)}
        lead={callLead}
        onSaved={loadPending}
      />
    </div>
  );
}
