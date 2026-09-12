import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Info, Search, Filter, RotateCcw } from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import { LEAD_TYPES, LEAD_SOURCES } from './leadConstants';
import { formatLeadDate } from './PendingLead';
import { useAuthStore } from '../../store/authStore';
import { matchesUserAssignment } from '../../utils/authUtils';
import { getLeadTypeTextClass } from '../../utils/leadTypeColors';

/**
 * HistoryLead
 * Read-only view of every lead that already has a caller assigned — once assigned
 * from PendingLead, a lead moves here (and simultaneously into Call Tracker's Pending).
 */
export default function HistoryLead() {
  const user = useAuthStore(state => state.user);
  const [leads, setLeads] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const initialFilters = { searchQuery: '', leadType: '', leadSource: '', callerAssigned: '' };
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => {
    leadApi.getLeads().then(allLeads => {
      setLeads(allLeads.filter(l => !!l.callerAssigned && matchesUserAssignment(l, user)));
    });
  }, [user]);

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const filteredLeads = leads.filter(l => {
    if (filters.leadType && l.leadType !== filters.leadType) return false;
    if (filters.leadSource && l.leadSource !== filters.leadSource) return false;
    if (filters.callerAssigned && l.callerAssigned !== filters.callerAssigned) return false;

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
  });

  const sortedLeads = [...filteredLeads].reverse();
  const totalPages = Math.ceil(sortedLeads.length / itemsPerPage);
  const paginatedLeads = sortedLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Format YYYY-MM-DD → DD/MM/YYYY for display
  const formatDate = (val) => {
    if (!val) return '-';
    const parts = val.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return val;
  };

  // Display formatted DD/MM/YYYY date (only date, not time)
  const leadDate = (item) => {
    return formatLeadDate(item.timestamp || item.date || item.created_at);
  };
  const tableHeaders = [
    "Lead No", "Lead Date", "Assign Caller", "Lead Type", "Team Member Name", "Lead Source",
    "Reference Name", "Product Type", "Requirement", "Sub Product Type",
    "Customer Name", "Customer Number", "Customer Email", "Customer DOB", "Customer Occupation",
    "Investment Budget", "Customer Address", "When to Buy Plan", "Medical Condition", "Remarks",
    "Process Type"
  ];

  const renderRow = (item) => (
    <tr key={item.leadNo} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[14px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{leadDate(item)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.callerAssigned}</td>
      <td className={`px-4 py-3 text-center text-[13px] font-semibold whitespace-nowrap ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.leadReceiver}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.leadSource}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.referencerName || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.productType || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.requirement || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.insuranceSubType || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.personName}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.number}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.email || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.dob)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.occupation || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.investmentBudget || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.location || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.anyDesease || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.remarks}>
        {item.remarks || '-'}
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.processType || '-'}</td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.leadNo} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] uppercase tracking-widest leading-none block mb-1">
            <span className="text-indigo-500">{item.leadNo} · </span>
            <span className={`font-semibold ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType}</span>
            <span className="text-indigo-500"> · {leadDate(item)}</span>
          </span>
          <h4 className="text-sm text-gray-900 leading-tight">{item.personName}</h4>
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
          <p className="text-gray-700 truncate leading-tight">{item.leadSource}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Team Member Name</p>
          <p className="text-gray-700 truncate leading-tight">{item.leadReceiver}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Reference Name</p>
          <p className="text-gray-700 truncate leading-tight">{item.referencerName || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Product Type</p>
          <p className="text-gray-700 truncate leading-tight">{item.productType || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Requirement</p>
          <p className="text-gray-700 truncate leading-tight">{item.requirement || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Sub Product Type</p>
          <p className="text-gray-700 truncate leading-tight">{item.insuranceSubType || '-'}</p>
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
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Investment Budget</p>
          <p className="text-gray-700 truncate leading-tight">{item.investmentBudget || '-'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Address</p>
          <p className="text-gray-700 truncate leading-tight">{item.location || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">When to Buy</p>
          <p className="text-gray-700 truncate leading-tight">{item.whenToBuyPlan || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Medical Condition</p>
          <p className="text-gray-700 truncate leading-tight">{item.anyDesease || '-'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Remarks</p>
          <p className="text-gray-700 leading-tight">{item.remarks || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Process Type</p>
          <p className="text-gray-700 truncate leading-tight">{item.processType || '-'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full flex-shrink-0">
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
            options={LEAD_SOURCES.map(v => ({ value: v, label: v }))}
            value={filters.leadSource}
            onChange={(val) => { setFilters({ ...filters, leadSource: val }); setCurrentPage(1); }}
            placeholder="All Lead Source"
            height="h-[32px]"
          />
          <div className="col-span-2">
            <SearchableDropdown
              options={Array.from(new Set(leads.map(l => l.callerAssigned))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
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
              options={LEAD_SOURCES.map(v => ({ value: v, label: v }))}
              value={filters.leadSource}
              onChange={(val) => { setFilters({ ...filters, leadSource: val }); setCurrentPage(1); }}
              placeholder="All Lead Source"
              height="h-[38px]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <SearchableDropdown
              options={Array.from(new Set(leads.map(l => l.callerAssigned))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
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

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedLeads}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="3200px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={sortedLeads.length}
        />
      </div>
    </div>
  );
}
