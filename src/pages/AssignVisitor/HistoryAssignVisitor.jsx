import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { visitorApi } from '../../api/visitorApi';
import { masterApi } from '../../api/masterApi';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import { HISTORY_TABLE_HEADERS, formatDisplayDate } from './assignVisitorConstants';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, matchesUserAssignment, matchesUserReceiver } from '../../utils/authUtils';
import { getLeadTypeTextClass, NEXT_DATE_CLASS } from '../../utils/leadTypeColors';

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: "Today" },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'custom', label: 'Custom Date' },
];

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateObj = (item) => {
  const val = item?.visitDate || item?.assignedAt || item?.leadDate || item?.timestamp || item?.date || item?.created_at;
  if (!val) return null;
  const str = String(val).trim().split('T')[0].split(' ')[0];
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? Number(`20${y}`) : Number(y);
      return new Date(fullYear, Number(m) - 1, Number(d));
    }
  }
  return null;
};

export default function HistoryAssignVisitor({ tabBar, onRefresh }) {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [historyLeads, setHistoryLeads] = useState([]);
  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [visitorsList, setVisitorsList] = useState([]);

  const initialFilters = {
    searchQuery: '',
    leadType: '',
    visitorName: '',
    dateFilter: '',
    customDate: ''
  };
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyData, types] = await Promise.all([
        visitorApi.getHistoryVisitorsWithLeads(),
        masterApi.getLeadTypes()
      ]);

      const userHistory = (historyData || []).filter(l =>
        isUserAdmin(user) ||
        matchesUserAssignment(l, user) ||
        matchesUserReceiver(l, user) ||
        (l.assignedVisitor && (l.assignedVisitor === user?.name || l.assignedVisitor === user?.id))
      );
      setHistoryLeads(userHistory);
      setLeadTypesMaster(types || []);

      const visitors = Array.from(
        new Set((userHistory || []).map(h => h.assignedVisitor || h.visitorName).filter(Boolean))
      );
      setVisitorsList(visitors);
    } catch (err) {
      console.error('Failed to load history visitor assignments:', err);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const filteredLeads = historyLeads.filter(l => {
    if (filters.leadType && l.leadType !== filters.leadType) return false;
    if (filters.visitorName && (l.assignedVisitor || l.visitorName) !== filters.visitorName) return false;

    if (filters.dateFilter && filters.dateFilter !== 'all') {
      const d = parseDateObj(l);
      if (!d) return false;
      if (filters.dateFilter === 'today') {
        if (d.getTime() !== today.getTime()) return false;
      } else if (filters.dateFilter === 'yesterday') {
        if (d.getTime() !== yesterday.getTime()) return false;
      } else if (filters.dateFilter === 'overdue') {
        if (d.getTime() >= yesterday.getTime()) return false;
      } else if (filters.dateFilter === 'upcoming') {
        if (d.getTime() <= today.getTime()) return false;
      } else if (filters.dateFilter === 'custom') {
        if (!filters.customDate) return true;
        const [cy, cm, cd] = filters.customDate.split('-').map(Number);
        if (cy && cm && cd) {
          const targetDate = new Date(cy, cm - 1, cd);
          if (d.getTime() !== targetDate.getTime()) return false;
        }
      }
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const searchable = [
        l.leadNo,
        l.assignedVisitor,
        l.visitorName,
        l.customerName,
        l.personName,
        l.customerNumber,
        l.number,
        l.customerEmail,
        l.email,
        l.location,
        l.customerAddress,
        l.visitorRemarks,
        l.remarks,
        l.relationshipManager,
        l.leadReceiver,
        l.leadSource,
        l.referencerName,
        l.productType,
        l.requirement,
        l.insuranceSubType,
        l.callTrackerRemarks
      ].map(v => (v || '').toLowerCase()).join(' ');

      if (!searchable.includes(q)) return false;
    }
    return true;
  }).reverse();

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderRow = (item, idx) => (
    <tr key={item.id || idx} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[14px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDisplayDate(item.leadDate || item.timestamp || item.date || item.created_at)}</td>
      <td className="px-4 py-3 text-center text-[13px] font-bold text-indigo-700 bg-indigo-50/40 whitespace-nowrap">{item.assignedVisitor || item.visitorName || '-'}</td>
      <td className={`px-4 py-3 text-center text-[13px] whitespace-nowrap ${NEXT_DATE_CLASS}`}>{formatDisplayDate(item.visitDate)}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.location || ''}>{item.location || '-'}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-700 font-medium whitespace-nowrap max-w-[200px] truncate" title={item.visitorRemarks || ''}>{item.visitorRemarks || '-'}</td>
      <td className={`px-4 py-3 text-center text-[13px] font-semibold whitespace-nowrap ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.leadSource || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.referencerName || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.productType || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.requirement || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.insuranceSubType || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.customerName || item.personName || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.customerNumber || item.number || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.customerEmail || item.email || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDisplayDate(item.dob)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.occupation || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.investmentBudget || '-'}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.customerAddress || ''}>{item.customerAddress || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.anyDesease || '-'}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.remarks || ''}>{item.remarks || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.relationshipManager || item.leadReceiver || '-'}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.callTrackerRemarks || ''}>{item.callTrackerRemarks || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-500 whitespace-nowrap">{formatDisplayDate(item.assignedAt || item.created_at)}</td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] uppercase tracking-widest leading-none block mb-1">
            <span className="text-indigo-500">{item.leadNo} · </span>
            <span className={`font-semibold ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType || '-'}</span>
            <span className="text-indigo-500"> · {formatDisplayDate(item.leadDate || item.timestamp || item.date || item.created_at)}</span>
          </span>
          <h4 className="text-sm text-gray-900 font-semibold leading-tight">{item.customerName || item.personName || '-'}</h4>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
          {item.assignedVisitor || item.visitorName || 'Assigned'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Assigned Visitor</p>
          <p className="text-indigo-700 font-semibold truncate leading-tight">{item.assignedVisitor || item.visitorName || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Visit Date</p>
          <p className={`truncate leading-tight ${NEXT_DATE_CLASS}`}>{formatDisplayDate(item.visitDate)}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Customer Number</p>
          <p className="text-gray-700 truncate leading-tight">{item.customerNumber || item.number || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Relationship Manager</p>
          <p className="text-gray-700 truncate leading-tight">{item.relationshipManager || item.leadReceiver || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Lead Source</p>
          <p className="text-gray-700 truncate leading-tight">{item.leadSource || '-'}</p>
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
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Customer Email</p>
          <p className="text-gray-700 truncate leading-tight">{item.customerEmail || item.email || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Customer DOB</p>
          <p className="text-gray-700 truncate leading-tight">{formatDisplayDate(item.dob)}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Customer Occupation</p>
          <p className="text-gray-700 truncate leading-tight">{item.occupation || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Investment Budget</p>
          <p className="text-gray-700 truncate leading-tight">{item.investmentBudget || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">When to Buy Plan</p>
          <p className="text-gray-700 truncate leading-tight">{item.whenToBuyPlan || '-'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Location / Address</p>
          <p className="text-gray-700 truncate leading-tight">{item.location || item.customerAddress || '-'}</p>
        </div>
        {item.visitorRemarks && (
          <div className="col-span-2">
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Visitor Remarks</p>
            <p className="text-gray-700 leading-tight">{item.visitorRemarks}</p>
          </div>
        )}
        {item.remarks && (
          <div className="col-span-2">
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Lead Remarks</p>
            <p className="text-gray-700 leading-tight">{item.remarks}</p>
          </div>
        )}
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Assigned At</p>
          <p className="text-gray-500 truncate leading-tight">{formatDisplayDate(item.assignedAt || item.created_at)}</p>
        </div>
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
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Mobile Collapsible Filters */}
        <div className={`${showMobileFilters ? 'grid' : 'hidden'} lg:hidden grid-cols-1 sm:grid-cols-3 gap-2 w-full`}>
          <SearchableDropdown
            options={DATE_FILTER_OPTIONS}
            value={filters.dateFilter}
            onChange={(val) => {
              const next = { ...filters, dateFilter: val };
              if (val === 'custom' && !filters.customDate) {
                next.customDate = getTodayStr();
              }
              setFilters(next);
              setCurrentPage(1);
            }}
            placeholder="All Dates"
            height="h-[32px]"
          />
          {filters.dateFilter === 'custom' && (
            <div className="col-span-1 sm:col-span-3">
              <input
                type="date"
                value={filters.customDate || ''}
                onChange={(e) => { setFilters({ ...filters, customDate: e.target.value }); setCurrentPage(1); }}
                className="w-full bg-white border border-indigo-300 rounded px-2.5 py-1 focus:outline-none focus:border-indigo-500 text-xs h-[32px] text-gray-700 shadow-sm"
                title="Select custom date"
              />
            </div>
          )}
          <SearchableDropdown
            options={leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }))}
            value={filters.leadType}
            onChange={(val) => { setFilters({ ...filters, leadType: val }); setCurrentPage(1); }}
            placeholder="All Lead Type"
            height="h-[32px]"
          />
          <SearchableDropdown
            options={visitorsList.map(v => ({ value: v, label: v }))}
            value={filters.visitorName}
            onChange={(val) => { setFilters({ ...filters, visitorName: val }); setCurrentPage(1); }}
            placeholder="All Visitors"
            height="h-[32px]"
          />
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
              options={DATE_FILTER_OPTIONS}
              value={filters.dateFilter}
              onChange={(val) => {
                const next = { ...filters, dateFilter: val };
                if (val === 'custom' && !filters.customDate) {
                  next.customDate = getTodayStr();
                }
                setFilters(next);
                setCurrentPage(1);
              }}
              placeholder="All Dates"
              height="h-[38px]"
            />
          </div>
          {filters.dateFilter === 'custom' && (
            <div className="min-w-[140px] max-w-[160px] animate-in fade-in duration-150">
              <input
                type="date"
                value={filters.customDate || ''}
                onChange={(e) => { setFilters({ ...filters, customDate: e.target.value }); setCurrentPage(1); }}
                className="w-full bg-white border border-indigo-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm h-[38px] text-gray-700 shadow-sm font-medium"
                title="Select custom date"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <SearchableDropdown
              options={leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }))}
              value={filters.leadType}
              onChange={(val) => { setFilters({ ...filters, leadType: val }); setCurrentPage(1); }}
              placeholder="All Lead Type"
              height="h-[38px]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <SearchableDropdown
              options={visitorsList.map(v => ({ value: v, label: v }))}
              value={filters.visitorName}
              onChange={(val) => { setFilters({ ...filters, visitorName: val }); setCurrentPage(1); }}
              placeholder="All Visitors"
              height="h-[38px]"
            />
          </div>
          <button
            onClick={handleClearFilters}
            className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded w-[38px] h-[38px] hover:bg-gray-100 transition-colors shadow-sm flex-shrink-0"
            title="Clear Filters"
          >
            <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={HISTORY_TABLE_HEADERS}
          data={paginatedLeads}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="3100px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredLeads.length}
        />
      </div>
    </div>
  );
}
