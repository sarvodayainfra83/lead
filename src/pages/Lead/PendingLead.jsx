import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Save, Info, Pencil, Trash2, Search, Filter, RotateCcw, Upload } from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import LeadForm from './LeadForm';
import LeadEdit from './LeadEdit';
import BulkUploadLead from './BulkUploadLead';
import { LEAD_TYPES, LEAD_SOURCES } from './leadConstants';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, matchesUserReceiver, hasFullAccess } from '../../utils/authUtils';
import { getLeadTypeTextClass } from '../../utils/leadTypeColors';

/**
 * Formats a lead's timestamp into DD/MM/YYYY (date only, no time).
 * Correctly handles DB values like "2026-08-09 16:37:10+00" (where 08 = Day, 09 = Month) -> "08/09/2026"
 * As well as standard formats like "DD/MM/YYYY HH:MM:SS" -> "DD/MM/YYYY"
 */
export const formatLeadDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim();

  // If already in DD/MM/YYYY or DD/MM/YYYY HH:mm:ss format
  if (str.includes('/')) {
    const datePart = str.split(' ')[0];
    const parts = datePart.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${fullYear}`;
    }
  }

  // If in DB format e.g. "2026-08-09 16:37:10+00" or "2026-08-09T..."
  // Database format is YYYY-DD-MM (e.g. 2026-08-09 -> 8th September 2026)
  if (str.includes('-')) {
    const datePart = str.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const year = parts[0];
        const day = String(parts[1]).padStart(2, '0');
        const month = String(parts[2]).padStart(2, '0');
        return `${day}/${month}/${year}`;
      } else {
        const day = String(parts[0]).padStart(2, '0');
        const month = String(parts[1]).padStart(2, '0');
        const year = parts[2];
        return `${day}/${month}/${year}`;
      }
    }
  }

  return str.split(' ')[0] || '-';
};

/**
 * Returns a Date object set to midnight for the lead based on its DD/MM/YYYY date.
 */
export const parseLeadDate = (item) => {
  const val = item?.timestamp || item?.date || item?.created_at;
  if (!val) return null;
  const formatted = formatLeadDate(val);
  if (!formatted || formatted === '-') return null;
  const parts = formatted.split('/').map(Number);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y) return new Date(y, m - 1, d);
  }
  return null;
};

export const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: "Today's Lead" },
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

/**
 * PendingLead
 * Leads that don't have a caller assigned yet. Check one or more rows to reveal
 * an "Assign Caller" picker for each, then Save to commit the batch — assigned
 * leads drop out of this list (into HistoryLead) and into Call Tracker's Pending queue.
 */
export default function PendingLead({ setHeaderAction }) {
  const [showFormModal, setShowFormModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [leads, setLeads] = useState([]);
  const [callersMaster, setCallersMaster] = useState([]);
  const [editLead, setEditLead] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [assignments, setAssignments] = useState({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const initialFilters = { searchQuery: '', leadType: '', leadSource: '', dateFilter: '', customDate: '' };
  const [filters, setFilters] = useState({ ...initialFilters });

  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'lead');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const load = async () => {
    const [allLeads, callers] = await Promise.all([
      leadApi.getLeads(),
      masterApi.getCallerNames()
    ]);
    const unassigned = allLeads.filter(l => !l.callerAssigned);
    setLeads(isUserAdmin(user) ? unassigned : unassigned.filter(l => matchesUserReceiver(l, user)));
    setCallersMaster(callers);
  };
  useEffect(() => { load(); }, [user]);

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const filteredLeads = leads.filter(l => {
    if (filters.leadType && l.leadType !== filters.leadType) return false;
    if (filters.leadSource && l.leadSource !== filters.leadSource) return false;

    if (filters.dateFilter && filters.dateFilter !== 'all') {
      const d = parseLeadDate(l);
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

  const callerOptionsFor = (leadType) => {
    const filtered = callersMaster.filter(c => !leadType || c.leadType === leadType);
    const seen = new Set();
    const unique = [];
    for (const c of filtered) {
      if (c.personName && !seen.has(c.personName)) {
        seen.add(c.personName);
        unique.push({ value: c.personName, label: c.personName });
      }
    }
    return unique;
  };

  const toggleRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setAssignments(a => {
          const rest = { ...a };
          delete rest[id];
          return rest;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allChecked = paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.has(l.id));
  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allChecked) {
        paginatedLeads.forEach(l => next.delete(l.id));
      } else {
        paginatedLeads.forEach(l => next.add(l.id));
      }
      return next;
    });
  };

  const handleSaveAssignments = useCallback(async () => {
    const idsToSave = Array.from(selectedIds).filter(id => assignments[id]);
    if (idsToSave.length === 0) {
      toast.error('Select at least one row and choose a caller to assign');
      return;
    }
    const assignmentsMap = {};
    idsToSave.forEach(id => { assignmentsMap[id] = assignments[id]; });
    await leadApi.assignCallerToLeads(assignmentsMap);
    toast.success(`Caller assigned to ${idsToSave.length} lead${idsToSave.length > 1 ? 's' : ''}`);
    setSelectedIds(new Set());
    setAssignments({});
    await load();
  }, [selectedIds, assignments]);

  const handleAssignCaller = (id, val) => {
    setAssignments(prev => {
      const next = { ...prev };
      if (Object.keys(prev).length === 0 && selectedIds.has(id)) {
        selectedIds.forEach(selectedId => {
          next[selectedId] = val;
        });
      } else {
        next[id] = val;
      }
      return next;
    });
  };

  const openAdd = useCallback(() => setShowFormModal(true), []);
  const openBulkUpload = useCallback(() => setShowBulkUpload(true), []);

  useEffect(() => {
    if (setHeaderAction) {
      setHeaderAction(
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {canEdit && (
            <button
              onClick={handleSaveAssignments}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 sm:px-4 h-[30px] sm:h-[32px] lg:h-[38px] text-xs md:text-sm font-semibold shadow-sm transition"
            >
              <Save size={14} /> Save
            </button>
          )}
          {canEdit && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2.5 sm:px-4 h-[30px] sm:h-[32px] lg:h-[38px] text-xs md:text-sm font-semibold shadow-sm transition"
            >
              <Plus size={15} /> Add Lead
            </button>
          )}
          {canEdit && (
            <button
              onClick={openBulkUpload}
              className="flex items-center gap-1 bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-lg px-2.5 sm:px-4 h-[30px] sm:h-[32px] lg:h-[38px] text-xs md:text-sm font-semibold shadow-sm transition"
            >
              <Upload size={14} /> Upload
            </button>
          )}
        </div>
      );
    }
    return () => setHeaderAction && setHeaderAction(null);
  }, [setHeaderAction, handleSaveAssignments, openAdd, openBulkUpload, canEdit]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete lead ${item.leadNo} "${item.personName}"? This cannot be undone.`)) return;
    await leadApi.deleteLead(item.id);
    await load();
    toast.success(`Lead ${item.leadNo} deleted`);
  };

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
    <input key="select-all" type="checkbox" checked={allChecked} onChange={toggleAll} className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" />,
    "Lead No", "Lead Date", "Assign Caller", "Lead Type", "Team Member Name", "Lead Source",
    "Reference Name", "Product Type", "Requirement", "Sub Product Type",
    "Customer Name", "Customer Number", "Customer Email", "Customer DOB", "Customer Occupation",
    "Investment Budget", "Customer Address", "When to Buy Plan", "Medical Condition", "Remarks",
    "Process Type"
  ];
  if (canEdit) tableHeaders.push("Action");

  const renderRow = (item) => (
    <tr key={item.leadNo} className="group hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td
        className="px-3 py-2 text-center whitespace-nowrap bg-white group-hover:bg-indigo-50 transition-colors"
        style={{ position: 'sticky', left: 0, zIndex: 10, boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}
      >
        <input
          type="checkbox"
          checked={selectedIds.has(item.id)}
          onChange={() => toggleRow(item.id)}
          className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
        />
      </td>
      <td className="px-4 py-3 text-center text-[14px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{leadDate(item)}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap min-w-[170px]">
        {selectedIds.has(item.id) ? (
          <SearchableDropdown
            options={callerOptionsFor(item.leadType)}
            value={assignments[item.id] || ''}
            onChange={(val) => handleAssignCaller(item.id, val)}
            placeholder="Select caller"
            height="h-[30px]"
          />
        ) : (
          <span className="text-gray-300 text-[11px] italic">Select row to assign</span>
        )}
      </td>
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
      {canEdit && (
        <td
          className="px-3 py-2 text-center whitespace-nowrap bg-white group-hover:bg-indigo-50 transition-colors"
          style={{ position: 'sticky', right: 0, zIndex: 10, boxShadow: '-2px 0 4px rgba(0,0,0,0.08)' }}
        >
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => setEditLead(item)} title="Edit Lead" className="inline-flex items-center justify-center p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(item)} title="Delete Lead" className="inline-flex items-center justify-center p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      )}
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.leadNo} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => toggleRow(item.id)}
            className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer mt-0.5"
          />
          <div>
            <span className="text-[9px] uppercase tracking-widest leading-none block mb-1">
              <span className="text-indigo-500">{item.leadNo} · </span>
              <span className={`font-semibold ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType}</span>
              <span className="text-indigo-500"> · {leadDate(item)}</span>
            </span>
            <h4 className="text-sm text-gray-900 leading-tight">{item.personName}</h4>
          </div>
        </div>
      </div>

      {selectedIds.has(item.id) && (
        <SearchableDropdown
          options={callerOptionsFor(item.leadType)}
          value={assignments[item.id] || ''}
          onChange={(val) => handleAssignCaller(item.id, val)}
          placeholder="Select caller"
          height="h-[32px]"
        />
      )}

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Number</p>
          <p className="text-gray-700 truncate leading-tight">{item.number}</p>
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

      {canEdit && (
        <div className="flex gap-1.5">
          <button onClick={() => setEditLead(item)} className="flex-1 bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1">
            <Pencil size={11} /> Edit
          </button>
          <button onClick={() => handleDelete(item)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1">
            <Trash2 size={11} /> Del
          </button>
        </div>
      )}
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
            placeholder="All Lead Dates"
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
              placeholder="All Lead Dates"
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
          minWidth="3400px"
          stickyFirstColumn
          stickyLastColumn
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={sortedLeads.length}
        />
      </div>

      <LeadForm
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSaved={load}
      />

      <LeadEdit
        isOpen={!!editLead}
        onClose={() => setEditLead(null)}
        lead={editLead}
        onUpdated={load}
      />

      <BulkUploadLead
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onImported={load}
      />
    </div>
  );
}
