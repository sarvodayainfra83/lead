import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';
import { getLeads, getCallTrackers, getCallerNamesMaster } from '../../utils/storageManager';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import { LEAD_TYPES } from '../Lead/leadConstants';

const LEAD_TYPE_FILTERS = ['All', ...LEAD_TYPES];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// "DD/MM/YYYY ..." → "YYYY-MM", used both to group into month options and to filter by month
const monthKeyOf = (timestamp) => {
  const parts = (timestamp || '').split(' ')[0].split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}` : '';
};

export default function CallerReport() {
  const [activeLeadType, setActiveLeadType] = useState('All');
  const [activeCaller, setActiveCaller] = useState('Complete');
  const [activeMonth, setActiveMonth] = useState('All');

  const callerOptions = useMemo(() => {
    const names = Array.from(new Set(getCallerNamesMaster().map(c => c.personName))).filter(Boolean).sort();
    return [{ value: 'Complete', label: 'Complete (All Callers)' }, ...names.map(n => ({ value: n, label: n }))];
  }, []);

  const monthOptions = useMemo(() => {
    const keys = new Set(getCallTrackers().map(t => monthKeyOf(t.timestamp)).filter(Boolean));
    const sorted = Array.from(keys).sort().reverse();
    return [
      { value: 'All', label: 'All Months' },
      ...sorted.map(key => {
        const [y, m] = key.split('-');
        return { value: key, label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}` };
      })
    ];
  }, []);

  const reportRows = useMemo(() => {
    const leads = getLeads();
    const trackers = getCallTrackers();
    const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));

    const filteredTrackers = trackers.filter(t => {
      const lead = leadsById[t.leadId];
      if (!lead) return false;
      if (activeLeadType !== 'All' && lead.leadType !== activeLeadType) return false;
      if (activeCaller !== 'Complete' && lead.callerAssigned !== activeCaller) return false;
      if (activeMonth !== 'All' && monthKeyOf(t.timestamp) !== activeMonth) return false;
      return true;
    });

    const byDate = {};
    filteredTrackers.forEach(t => {
      const dateKey = (t.timestamp || '').split(' ')[0]; // "DD/MM/YYYY"
      if (!dateKey) return;
      if (!byDate[dateKey]) {
        byDate[dateKey] = {
          date: dateKey, dateSort: dateKey.split('/').reverse().join('-'),
          callingTarget: 0, connected: 0, interested: 0, notInterested: 0, meeting: 0, callNotReceived: 0
        };
      }
      const row = byDate[dateKey];
      row.callingTarget += 1;
      if (t.status !== 'Call Not Received') row.connected += 1;
      if (t.status === 'Received') row.interested += 1;
      if (t.status === 'Not Interested') row.notInterested += 1;
      if (t.status === 'Need Meeting') row.meeting += 1;
      if (t.status === 'Call Not Received') row.callNotReceived += 1;
    });

    return Object.values(byDate)
      .sort((a, b) => b.dateSort.localeCompare(a.dateSort))
      .map((row, i) => ({ ...row, srNo: i + 1 }));
  }, [activeLeadType, activeCaller, activeMonth]);

  const totals = reportRows.reduce((acc, r) => ({
    callingTarget: acc.callingTarget + r.callingTarget,
    connected: acc.connected + r.connected,
    interested: acc.interested + r.interested,
    notInterested: acc.notInterested + r.notInterested,
    meeting: acc.meeting + r.meeting,
    callNotReceived: acc.callNotReceived + r.callNotReceived
  }), { callingTarget: 0, connected: 0, interested: 0, notInterested: 0, meeting: 0, callNotReceived: 0 });

  const handleExportExcel = () => {
    const exportRows = reportRows.map(r => ({
      'SR No': r.srNo,
      'Date': r.date,
      'Calling Target': r.callingTarget,
      'Connected Call': r.connected,
      'Interested Call': r.interested,
      'Not Interested Call': r.notInterested,
      'Meeting Call': r.meeting,
      'Call Not Received': r.callNotReceived
    }));
    exportRows.push({
      'SR No': 'Total',
      'Date': '',
      'Calling Target': totals.callingTarget,
      'Connected Call': totals.connected,
      'Interested Call': totals.interested,
      'Not Interested Call': totals.notInterested,
      'Meeting Call': totals.meeting,
      'Call Not Received': totals.callNotReceived
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Caller Report');

    const monthLabel = monthOptions.find(m => m.value === activeMonth)?.label.replace(/\s+/g, '_') || 'AllMonths';
    const typeLabel = activeLeadType === 'All' ? 'AllTypes' : activeLeadType.replace(/\s+/g, '_');
    const callerLabel = activeCaller === 'Complete' ? 'AllCallers' : activeCaller.replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `Caller_Report_${typeLabel}_${callerLabel}_${monthLabel}.xlsx`);
  };

  const tableHeaders = [
    "SR No", "Date", "Calling Target", "Connected Call", "Interested Call",
    "Not Interested Call", "Meeting Call", "Call Not Received"
  ];

  const renderRow = (row) => (
    <tr key={row.date} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.srNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{row.date}</td>
      <td className="px-4 py-3 text-center text-[13px] text-indigo-600 font-bold whitespace-nowrap">{row.callingTarget}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{row.connected}</td>
      <td className="px-4 py-3 text-center text-[13px] text-emerald-700 font-semibold whitespace-nowrap">{row.interested}</td>
      <td className="px-4 py-3 text-center text-[13px] text-red-700 font-semibold whitespace-nowrap">{row.notInterested}</td>
      <td className="px-4 py-3 text-center text-[13px] text-cyan-700 font-semibold whitespace-nowrap">{row.meeting}</td>
      <td className="px-4 py-3 text-center text-[13px] text-orange-700 font-semibold whitespace-nowrap">{row.callNotReceived}</td>
    </tr>
  );

  const renderCard = (row) => (
    <div key={row.date} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
        <h4 className="text-sm text-gray-900 font-semibold">{row.date}</h4>
        <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold uppercase">
          Target {row.callingTarget}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
        <div className="bg-slate-50 rounded p-1.5">
          <p className="text-gray-400 uppercase text-[8px]">Connected</p>
          <p className="text-gray-800 font-bold">{row.connected}</p>
        </div>
        <div className="bg-emerald-50 rounded p-1.5">
          <p className="text-emerald-600 uppercase text-[8px]">Interested</p>
          <p className="text-emerald-700 font-bold">{row.interested}</p>
        </div>
        <div className="bg-red-50 rounded p-1.5">
          <p className="text-red-600 uppercase text-[8px]">Not Interested</p>
          <p className="text-red-700 font-bold">{row.notInterested}</p>
        </div>
        <div className="bg-cyan-50 rounded p-1.5">
          <p className="text-cyan-600 uppercase text-[8px]">Meeting</p>
          <p className="text-cyan-700 font-bold">{row.meeting}</p>
        </div>
        <div className="bg-orange-50 rounded p-1.5 col-span-2">
          <p className="text-orange-600 uppercase text-[8px]">Call Not Received</p>
          <p className="text-orange-700 font-bold">{row.callNotReceived}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-2 md:space-y-6 flex flex-col h-full min-h-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 lg:gap-4 w-full px-2 sm:px-0">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 lg:gap-6 flex-1">
          {/* Lead Types Group */}
          <div className="flex items-center gap-2 flex-wrap">
            {LEAD_TYPE_FILTERS.map(type => (
              <button
                key={type}
                onClick={() => setActiveLeadType(type)}
                className={`flex items-center justify-center w-[110px] md:w-[140px] rounded-lg text-[10px] md:text-xs font-semibold uppercase tracking-wide transition-colors border h-[32px] lg:h-[38px] ${
                  activeLeadType === type
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Dropdowns Group */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <div className="w-full sm:w-56 flex-shrink-0">
              <SearchableDropdown
                options={callerOptions}
                value={activeCaller}
                onChange={setActiveCaller}
                placeholder="Select calling person"
                height="h-[32px] lg:h-[38px]"
              />
            </div>
            <div className="w-full sm:w-48 flex-shrink-0">
              <SearchableDropdown
                options={monthOptions}
                value={activeMonth}
                onChange={setActiveMonth}
                placeholder="Select month"
                height="h-[32px] lg:h-[38px]"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 h-[32px] lg:h-[38px] text-xs md:text-sm font-semibold shadow-sm transition xl:ml-auto flex-shrink-0"
        >
          <FileSpreadsheet size={16} />
          Export Excel
        </button>
      </div>

      {/* Report Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={reportRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="1200px"
          totalRow={[
            'Total', '', totals.callingTarget, totals.connected,
            totals.interested, totals.notInterested, totals.meeting, totals.callNotReceived
          ]}
        />
      </div>
    </div>
  );
}
