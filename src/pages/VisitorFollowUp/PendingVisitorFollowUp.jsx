import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Filter, RotateCcw, Compass } from 'lucide-react';
import { visitorFollowUpApi } from '../../api/visitorFollowUpApi';
import { masterApi } from '../../api/masterApi';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import VisitorFollowUpModal from './VisitorFollowUpModal';
import {
  PENDING_TABLE_HEADERS,
  VISITOR_STATUS_OPTIONS,
  STATUS_STYLES,
  INTEREST_STYLES,
  formatDisplayDate
} from './visitorFollowUpConstants';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, matchesUserAssignment, matchesUserReceiver } from '../../utils/authUtils';
import { getLeadTypeTextClass, NEXT_DATE_CLASS } from '../../utils/leadTypeColors';

export default function PendingVisitorFollowUp({ tabBar, onRefresh }) {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [visitorsList, setVisitorsList] = useState([]);

  const initialFilters = {
    searchQuery: '',
    leadType: '',
    status: '',
    assignedVisitor: ''
  };
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingData, types] = await Promise.all([
        visitorFollowUpApi.getPendingFollowUpsWithLeads(),
        masterApi.getLeadTypes()
      ]);

      const userPending = (pendingData || []).filter(l =>
        isUserAdmin(user) ||
        matchesUserAssignment(l, user) ||
        matchesUserReceiver(l, user) ||
        (l.assignedVisitor && (l.assignedVisitor === user?.name || l.assignedVisitor === user?.id))
      );
      setLeads(userPending);
      setLeadTypesMaster(types || []);

      const visitors = Array.from(
        new Set((pendingData || []).map(p => p.assignedVisitor).filter(Boolean))
      );
      setVisitorsList(visitors);
    } catch (err) {
      console.error('Failed to load pending visitor follow-ups:', err);
      toast.error('Failed to load pending visits');
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

  const filteredLeads = leads.filter(l => {
    if (filters.leadType && l.leadType !== filters.leadType) return false;
    if (filters.status && l.status !== filters.status) return false;
    if (filters.assignedVisitor && l.assignedVisitor !== filters.assignedVisitor) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const searchable = [
        l.leadNo,
        l.customerName,
        l.personName,
        l.customerNumber,
        l.number,
        l.customerEmail,
        l.email,
        l.customerAddress,
        l.location,
        l.requirement,
        l.relationshipManager,
        l.leadReceiver,
        l.assignedVisitor,
        l.leadSource,
        l.referencerName,
        l.productType,
        l.insuranceSubType,
        l.remarks,
        l.visitRemarks,
        l.visitorRemarks,
        l.whatHappened,
        l.status
      ].map(v => (v || '').toLowerCase()).join(' ');

      if (!searchable.includes(q)) return false;
    }
    return true;
  }).reverse();

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderRow = (item, idx) => (
    <tr key={item.id || item.leadNo || idx} className="group hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      {/* Sticky Action Column */}
      <td
        className="px-3 py-2 text-center whitespace-nowrap bg-white group-hover:bg-indigo-50 transition-colors"
        style={{ position: 'sticky', left: 0, zIndex: 10, boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}
      >
        <button
          onClick={() => setSelectedLead(item)}
          title="Visit Now"
          className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide hover:bg-indigo-100 transition-colors"
        >
          <Compass size={12} /> Visit Now
        </button>
      </td>

      <td className="px-4 py-3 text-center text-[14px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDisplayDate(item.leadDate || item.timestamp || item.date || item.created_at)}</td>
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
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.customerAddress || item.location || ''}>{item.customerAddress || item.location || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.anyDesease || '-'}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.remarks || ''}>{item.remarks || '-'}</td>
      <td className={`px-4 py-3 text-center text-[13px] whitespace-nowrap ${NEXT_DATE_CLASS}`}>{formatDisplayDate(item.visitDate)}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.relationshipManager || item.leadReceiver || '-'}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.visitRemarks || ''}>{item.visitRemarks || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] font-bold text-indigo-700 bg-indigo-50/40 whitespace-nowrap">{item.assignedVisitor || '-'}</td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={item.visitorRemarks || ''}>{item.visitorRemarks || '-'}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.followUpNo ?? 0}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {item.status ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_STYLES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {item.status}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {item.interestLevel ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${INTEREST_STYLES[item.interestLevel] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {item.interestLevel}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-left text-[13px] text-gray-700 whitespace-nowrap max-w-[200px] truncate" title={item.whatHappened || ''}>{item.whatHappened || '-'}</td>
      <td className={`px-4 py-3 text-center text-[13px] whitespace-nowrap ${NEXT_DATE_CLASS}`}>{formatDisplayDate(item.nextVisitDate)}</td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id || item.leadNo} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] uppercase tracking-widest leading-none block mb-1">
            <span className="text-indigo-500">{item.leadNo} · </span>
            <span className={`font-semibold ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType || '-'}</span>
            <span className="text-indigo-500"> · Follow Up {item.followUpNo ?? 0}</span>
          </span>
          <h4 className="text-sm text-gray-900 font-semibold leading-tight">{item.customerName || item.personName || '-'}</h4>
        </div>
        {item.status && (
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase border ${STATUS_STYLES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {item.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Customer Number</p>
          <p className="text-gray-700 truncate leading-tight">{item.customerNumber || item.number || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Assigned Visitor</p>
          <p className="text-indigo-700 font-semibold truncate leading-tight">{item.assignedVisitor || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Visit Date</p>
          <p className={`truncate leading-tight ${NEXT_DATE_CLASS}`}>{formatDisplayDate(item.visitDate)}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Next Visit Date</p>
          <p className={`truncate leading-tight ${NEXT_DATE_CLASS}`}>{formatDisplayDate(item.nextVisitDate)}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Relationship Manager</p>
          <p className="text-gray-700 truncate leading-tight">{item.relationshipManager || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Interest Level</p>
          <p className="text-gray-700 truncate leading-tight">{item.interestLevel || '-'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Customer Address</p>
          <p className="text-gray-700 truncate leading-tight">{item.customerAddress || item.location || '-'}</p>
        </div>
        {item.whatHappened && (
          <div className="col-span-2">
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">What Happened</p>
            <p className="text-gray-700 leading-tight">{item.whatHappened}</p>
          </div>
        )}
      </div>

      <button
        onClick={() => setSelectedLead(item)}
        className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition-colors"
      >
        <Compass size={12} /> Visit Now
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
              placeholder="Search..."
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
            options={leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }))}
            value={filters.leadType}
            onChange={(val) => { setFilters({ ...filters, leadType: val }); setCurrentPage(1); }}
            placeholder="All Lead Type"
            height="h-[32px]"
          />
          <SearchableDropdown
            options={VISITOR_STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
            value={filters.status}
            onChange={(val) => { setFilters({ ...filters, status: val }); setCurrentPage(1); }}
            placeholder="All Status"
            height="h-[32px]"
          />
          <SearchableDropdown
            options={visitorsList.map(v => ({ value: v, label: v }))}
            value={filters.assignedVisitor}
            onChange={(val) => { setFilters({ ...filters, assignedVisitor: val }); setCurrentPage(1); }}
            placeholder="All Assigned Visitors"
            height="h-[32px]"
          />
        </div>

        {/* Desktop Row */}
        <div className="hidden lg:flex lg:flex-1 items-center gap-3">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-2.5 top-[11px] text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={filters.searchQuery}
              onChange={(e) => { setFilters({ ...filters, searchQuery: e.target.value }); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-sm h-[38px]"
            />
          </div>
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
              options={VISITOR_STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
              value={filters.status}
              onChange={(val) => { setFilters({ ...filters, status: val }); setCurrentPage(1); }}
              placeholder="All Status"
              height="h-[38px]"
            />
          </div>
          <div className="flex-1 min-w-0">
            <SearchableDropdown
              options={visitorsList.map(v => ({ value: v, label: v }))}
              value={filters.assignedVisitor}
              onChange={(val) => { setFilters({ ...filters, assignedVisitor: val }); setCurrentPage(1); }}
              placeholder="All Assigned Visitors"
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
          headers={PENDING_TABLE_HEADERS}
          data={paginatedLeads}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="3400px"
          stickyFirstColumn
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredLeads.length}
        />
      </div>

      {/* Visitor Follow Up Modal */}
      <VisitorFollowUpModal
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
        onSaved={() => {
          loadData();
          onRefresh?.();
        }}
      />
    </div>
  );
}
