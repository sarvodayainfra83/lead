import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Search, RotateCcw, Phone, Eye, Filter } from 'lucide-react';
import { callerReportApi } from '../../api/callerReportApi';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import CallerReportDetailModal from './CallerReportDetailModal';
import { LEAD_TYPES } from '../Lead/leadConstants';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';
import { getLeadTypeTextClass, NEXT_DATE_CLASS } from '../../utils/leadTypeColors';

const LEAD_TYPE_OPTIONS = [
  { value: 'All', label: 'All Lead Type' },
  ...LEAD_TYPES.map(type => ({ value: type, label: type }))
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-red-50 text-red-700 border-red-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200'
};

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

export default function CallerReport() {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);

  const [activeLeadType, setActiveLeadType] = useState('All');
  const [activeCaller, setActiveCaller] = useState(isAdmin ? 'Complete' : (user?.name || user?.id || 'Complete'));
  const [activeMonth, setActiveMonth] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [callerOptions, setCallerOptions] = useState(
    isAdmin
      ? [{ value: 'Complete', label: 'Complete (All Callers)' }]
      : [{ value: user?.name || user?.id, label: user?.name || user?.id }]
  );
  const [monthOptions, setMonthOptions] = useState([{ value: 'All', label: 'All Months' }]);
  const [allRecords, setAllRecords] = useState([]);
  const [totals, setTotals] = useState({
    callingTarget: 0, totalCalls: 0, interested: 0, futurePlan: 0, notInterested: 0, siteVisit: 0
  });

  // Modal tracking state for selected unique lead
  const [selectedLead, setSelectedLead] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => {
    callerReportApi.getReportFilters(user).then(({ callers, monthKeys }) => {
      if (isAdmin) {
        setCallerOptions([
          { value: 'Complete', label: 'Complete (All Callers)' },
          ...callers.map(n => ({ value: n, label: n }))
        ]);
      } else {
        const callerName = user?.name || user?.id || 'Assigned';
        setCallerOptions([{ value: callerName, label: callerName }]);
        setActiveCaller(callerName);
      }
      setMonthOptions([
        { value: 'All', label: 'All Months' },
        ...monthKeys.map(key => {
          const [y, m] = key.split('-');
          return { value: key, label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}` };
        })
      ]);
    });
  }, [user, isAdmin]);

  useEffect(() => {
    callerReportApi.getCallerReport({ activeLeadType, activeCaller, activeMonth, user })
      .then(({ allRecords: records, totals: reportTotals }) => {
        setAllRecords(records || []);
        setTotals(reportTotals);
        setCurrentPage(1);
      });
  }, [activeLeadType, activeCaller, activeMonth, user]);

  const handleResetFilters = () => {
    setActiveLeadType('All');
    setActiveCaller(isAdmin ? 'Complete' : (user?.name || user?.id || 'Complete'));
    setActiveMonth('All');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const filteredRecords = allRecords.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (r.leadNo || '').toLowerCase().includes(q) ||
        (r.personName || '').toLowerCase().includes(q) ||
        (r.number || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.leadType || '').toLowerCase().includes(q) ||
        (r.callerAssigned || '').toLowerCase().includes(q) ||
        (r.latestStatus || '').toLowerCase().includes(q) ||
        (r.latestCustomerSaid || '').toLowerCase().includes(q) ||
        (r.requirement || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportExcel = () => {
    const exportRows = filteredRecords.map((r, idx) => ({
      'SR No': idx + 1,
      'Lead No': r.leadNo || '-',
      'Lead Type': r.leadType || '-',
      'Caller Assigned': r.callerAssigned || '-',
      'Latest Status': r.latestStatus || '-',
      'Total Calls': r.followUpCount || 0,
      'What did Customer Said': r.latestCustomerSaid || '-',
      'Next Date': formatDate(r.latestNextDate),
      'Last Call Date': formatDate(r.latestCallDate),
      'Person Name': r.personName || '-',
      'Phone Number': r.number || '-',
      'Email': r.email || '-',
      'DOB': formatDate(r.dob),
      'Occupation': r.occupation || '-',
      'Requirement': r.requirement || '-',
      'Investment Range': r.investmentBudget || '-',
      'Address': r.location || '-',
      'When to Buy Plan': r.whenToBuyPlan || '-',
      'Remarks': r.remarks || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Caller Report');

    const monthLabel = monthOptions.find(m => m.value === activeMonth)?.label.replace(/\s+/g, '_') || 'AllMonths';
    const typeLabel = activeLeadType === 'All' ? 'AllTypes' : activeLeadType.replace(/\s+/g, '_');
    const callerLabel = activeCaller === 'Complete' ? 'AllCallers' : activeCaller.replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `Caller_Report_${typeLabel}_${callerLabel}_${monthLabel}.xlsx`);
  };

  const tableHeaders = [
    "Action", "SR No", "Lead No", "Lead Type", "Caller Assigned", "Latest Status", "Calls",
    "What did Customer Said", "Next Date", "Last Call Date", "Person Name", "Number", "Email", "DOB",
    "Occupation", "Requirement", "Investment Range", "Address", "When to Buy Plan", "Remarks"
  ];

  const renderRow = (item, idx) => {
    const srNo = (currentPage - 1) * itemsPerPage + idx + 1;
    return (
      <tr key={item.leadId || item.leadNo || idx} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <button
            onClick={() => setSelectedLead(item)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 transition shadow-2xs"
            title={`Track Status for ${item.leadNo}`}
          >
            <Eye size={13} />
            <span>View</span>
          </button>
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-500 whitespace-nowrap">{srNo}</td>
        <td className="px-4 py-3 text-center text-[13px] text-indigo-600 font-bold whitespace-nowrap">{item.leadNo}</td>
        <td className={`px-4 py-3 text-center text-[13px] font-semibold whitespace-nowrap ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.callerAssigned || '-'}</td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${STATUS_STYLES[item.latestStatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {item.latestStatus || '-'}
          </span>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {item.followUpCount} {item.followUpCount === 1 ? 'Call' : 'Calls'}
          </span>
        </td>
        <td className="px-4 py-3 text-left text-[13px] text-gray-700 max-w-[200px] truncate" title={item.latestCustomerSaid}>
          {item.latestCustomerSaid || '-'}
        </td>
        <td className={`px-4 py-3 text-center text-[13px] whitespace-nowrap ${NEXT_DATE_CLASS}`}>{formatDate(item.latestNextDate)}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.latestCallDate)}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.personName || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">
          {item.number ? (
            <a href={`tel:${item.number}`} className="inline-flex items-center gap-1 hover:text-indigo-600 transition">
              <Phone size={11} className="text-gray-400" />
              {item.number}
            </a>
          ) : '-'}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.email || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.dob)}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.occupation || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.requirement || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.investmentBudget || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.location || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.whenToBuyPlan || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-500 whitespace-nowrap max-w-[180px] truncate" title={item.remarks}>
          {item.remarks || '-'}
        </td>
      </tr>
    );
  };

  const renderCard = (item, idx) => {
    const srNo = (currentPage - 1) * itemsPerPage + idx + 1;
    return (
      <div key={item.leadId || item.leadNo || idx} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
        <div className="flex justify-between items-start border-b border-gray-100 pb-2">
          <div>
            <span className="text-[9px] uppercase tracking-widest leading-none block mb-1">
              <span className="text-indigo-500">#{srNo} · {item.leadNo} · </span>
              <span className={`font-semibold ${getLeadTypeTextClass(item.leadType)}`}>{item.leadType}</span>
            </span>
            <h4 className="text-sm text-gray-900 font-bold leading-tight">{item.personName}</h4>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase border ${STATUS_STYLES[item.latestStatus] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {item.latestStatus || '-'}
            </span>
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              {item.followUpCount} {item.followUpCount === 1 ? 'Call' : 'Calls'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Number</p>
            <p className="text-gray-700 truncate leading-tight font-medium">{item.number}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Next Date</p>
            <p className={`truncate leading-tight ${NEXT_DATE_CLASS}`}>{formatDate(item.latestNextDate)}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Caller</p>
            <p className="text-gray-700 truncate leading-tight">{item.callerAssigned || '-'}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Last Call Date</p>
            <p className="text-gray-700 truncate leading-tight">{formatDate(item.latestCallDate)}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Requirement</p>
            <p className="text-gray-700 truncate leading-tight">{item.requirement || '-'}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Investment</p>
            <p className="text-gray-700 truncate leading-tight">{item.investmentBudget || '-'}</p>
          </div>
          {item.latestCustomerSaid && (
            <div className="col-span-2">
              <p className="text-gray-400 uppercase tracking-tighter text-[8px]">What Customer Said</p>
              <p className="text-gray-700 leading-tight bg-gray-50 p-1.5 rounded">{item.latestCustomerSaid}</p>
            </div>
          )}
          {item.location && (
            <div className="col-span-2">
              <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Address</p>
              <p className="text-gray-700 leading-tight">{item.location}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setSelectedLead(item)}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Eye size={13} />
          <span>View Tracking Status ({item.followUpCount})</span>
        </button>
      </div>
    );
  };

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-2 md:space-y-4 flex flex-col h-full min-h-0">

      {/* Filter Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 lg:gap-3 w-full px-2 sm:px-0 flex-shrink-0">
        {/* Mobile Top Bar */}
        <div className="flex items-center gap-2 w-full xl:hidden">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search leads, caller, etc..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-xs h-[32px] shadow-xs"
            />
          </div>
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`flex items-center justify-center rounded-lg shadow-xs h-[32px] w-[32px] flex-shrink-0 transition ${showMobileFilters ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            title="Toggle Filters"
          >
            <Filter size={14} />
          </button>
          <button
            onClick={handleResetFilters}
            className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg h-[32px] w-[32px] flex-shrink-0 shadow-xs active:scale-95 hover:bg-gray-100"
            title="Reset Filters"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-[32px] px-2.5 text-xs font-semibold shadow-xs flex-shrink-0"
            title="Export Excel"
          >
            <FileSpreadsheet size={15} />
          </button>
        </div>

        {/* Mobile Collapsible Filters */}
        <div className={`${showMobileFilters ? 'grid' : 'hidden'} xl:hidden grid-cols-1 sm:grid-cols-3 gap-2 w-full`}>
          <SearchableDropdown
            options={LEAD_TYPE_OPTIONS}
            value={activeLeadType}
            onChange={setActiveLeadType}
            placeholder="All Lead Type"
            height="h-[32px]"
          />
          <SearchableDropdown
            options={callerOptions}
            value={activeCaller}
            onChange={setActiveCaller}
            placeholder="Select calling person"
            height="h-[32px]"
          />
          <SearchableDropdown
            options={monthOptions}
            value={activeMonth}
            onChange={setActiveMonth}
            placeholder="Select month"
            height="h-[32px]"
          />
        </div>

        {/* Desktop Row */}
        <div className="hidden xl:flex items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="w-64 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search leads, caller, etc..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-xs h-[38px] shadow-xs"
            />
          </div>

          {/* Lead Type Dropdown */}
          <div className="w-48 flex-shrink-0">
            <SearchableDropdown
              options={LEAD_TYPE_OPTIONS}
              value={activeLeadType}
              onChange={setActiveLeadType}
              placeholder="All Lead Type"
              height="h-[38px]"
            />
          </div>

          {/* Caller Dropdown */}
          <div className="w-52 flex-shrink-0">
            <SearchableDropdown
              options={callerOptions}
              value={activeCaller}
              onChange={setActiveCaller}
              placeholder="Select calling person"
              height="h-[38px]"
            />
          </div>

          {/* Month Dropdown */}
          <div className="w-44 flex-shrink-0">
            <SearchableDropdown
              options={monthOptions}
              value={activeMonth}
              onChange={setActiveMonth}
              placeholder="Select month"
              height="h-[38px]"
            />
          </div>

          {/* Reset Filters */}
          <button
            onClick={handleResetFilters}
            className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg w-[38px] h-[38px] hover:bg-gray-100 transition shadow-xs flex-shrink-0"
            title="Reset Filters"
          >
            <RotateCcw size={15} />
          </button>

          {/* Excel Export Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 h-[38px] text-xs font-semibold shadow-xs transition ml-auto flex-shrink-0"
          >
            <FileSpreadsheet size={15} />
            Export Excel ({filteredRecords.length})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRecords}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="2500px"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredRecords.length}
        />
      </div>

      {/* Lead Tracking Status Modal */}
      <CallerReportDetailModal
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
      />
    </div>
  );
}
