import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, RotateCcw } from 'lucide-react';
import { attendanceApi } from '../../api/attendanceApi';
import { masterApi } from '../../api/masterApi';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';

const STATUS_BADGES = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'HALF DAY': 'bg-amber-50 text-amber-700 border-amber-200',
  ABSENT: 'bg-red-50 text-red-700 border-red-200'
};

export default function AllAttendanceTab({ tabBar }) {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);

  const [dailySummaries, setDailySummaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const initialFilters = {
    searchQuery: '',
    status: '',
    employee: ''
  };
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logs, receivers] = await Promise.all([
        attendanceApi.getAttendanceLogs(),
        masterApi.getLeadReceivers()
      ]);

      const seen = new Set();
      const receiverNames = [];
      (receivers || []).forEach(r => {
        const raw = r?.personName;
        if (!raw) return;
        const clean = String(raw).replace(/\s+/g, ' ').trim();
        const lower = clean.toLowerCase();
        if (clean && !seen.has(lower)) {
          seen.add(lower);
          receiverNames.push(clean);
        }
      });

      const userList = receiverNames.map(name => ({ id: name, name }));
      setEmployees(userList);

      // Group logs by Date + Employee Name
      const grouped = {};
      logs.forEach(log => {
        const dateKey = log.date || (log.timestamp ? log.timestamp.split(' ')[0] : 'Unknown');
        const userKey = log.userName || 'Unknown';
        const key = `${dateKey}___${userKey}`;

        if (!grouped[key]) {
          grouped[key] = {
            date: dateKey,
            name: userKey,
            inTimes: [],
            outTimes: [],
            latestTimestampMs: log.timestampMs || 0
          };
        }

        const timeStr = log.timestamp && log.timestamp.includes(' ')
          ? log.timestamp.split(' ')[1]
          : '';

        if (log.status?.toUpperCase() === 'IN') {
          grouped[key].inTimes.push({ time: timeStr, ms: log.timestampMs });
        } else if (log.status?.toUpperCase() === 'OUT') {
          grouped[key].outTimes.push({ time: timeStr, ms: log.timestampMs });
        }

        if ((log.timestampMs || 0) > grouped[key].latestTimestampMs) {
          grouped[key].latestTimestampMs = log.timestampMs;
        }
      });

      // Calculate check-in, check-out, working hours, and status for each entry
      const rows = Object.values(grouped).map(group => {
        group.inTimes.sort((a, b) => a.ms - b.ms);
        group.outTimes.sort((a, b) => a.ms - b.ms);

        const firstIn = group.inTimes[0] || null;
        const lastOut = group.outTimes[group.outTimes.length - 1] || null;

        const checkIn = firstIn ? firstIn.time.slice(0, 5) : '-';
        const checkOut = lastOut ? lastOut.time.slice(0, 5) : '-';

        let workingHours = '-';
        let status = 'PRESENT';

        if (firstIn && lastOut && lastOut.ms > firstIn.ms) {
          const diffMs = lastOut.ms - firstIn.ms;
          const totalMinutes = Math.floor(diffMs / (1000 * 60));
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          workingHours = `${hours} hrs ${mins} mins`;

          if (hours < 4) {
            status = 'HALF DAY';
          } else {
            status = 'PRESENT';
          }
        } else if (firstIn) {
          status = 'PRESENT';
        }

        return {
          id: `${group.date}_${group.name}`,
          date: group.date,
          name: group.name,
          checkIn,
          checkOut,
          workingHours,
          status,
          sortMs: group.latestTimestampMs
        };
      });

      // Scope for regular users if not admin
      const scopedRows = isAdmin
        ? rows
        : rows.filter(r => r.name === user?.name || r.name === user?.id);

      setDailySummaries(scopedRows.sort((a, b) => b.sortMs - a.sortMs));
    } catch (err) {
      console.error('Failed to compute daily attendance report:', err);
      toast.error('Failed to load attendance report');
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

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'PRESENT', label: 'Present' },
    { value: 'HALF DAY', label: 'Half Day' },
    { value: 'ABSENT', label: 'Absent' }
  ];

  const employeeOptions = [
    { value: '', label: 'All Employees' },
    ...Array.from(new Set(employees.map(e => e.name))).filter(Boolean).map(n => ({ value: n, label: n }))
  ];

  const filteredRows = dailySummaries.filter(row => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.employee && row.name !== filters.employee) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        row.name.toLowerCase().includes(q) ||
        row.date.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const tableHeaders = [
    "DATE", "NAME", "CHECK-IN", "CHECK-OUT", "WORKING HOURS", "STATUS"
  ];

  const renderRow = (item) => (
    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">
        {item.date}
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-semibold whitespace-nowrap">
        {item.name}
      </td>
      <td className="px-4 py-3 text-center text-[13px] font-mono text-emerald-700 font-semibold whitespace-nowrap">
        {item.checkIn}
      </td>
      <td className="px-4 py-3 text-center text-[13px] font-mono text-gray-600 whitespace-nowrap">
        {item.checkOut}
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">
        {item.workingHours}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
          STATUS_BADGES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'
        }`}>
          {item.status}
        </span>
      </td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-indigo-500 font-bold block mb-0.5">
            {item.date}
          </span>
          <h4 className="text-sm font-bold text-gray-900 leading-tight">{item.name}</h4>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
          STATUS_BADGES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'
        }`}>
          {item.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Check-In</p>
          <p className="text-emerald-700 font-bold font-mono truncate">{item.checkIn}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Check-Out</p>
          <p className="text-gray-700 font-mono truncate">{item.checkOut}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Hours</p>
          <p className="text-gray-700 truncate">{item.workingHours}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 flex flex-col h-full min-h-0">
      {/* Top Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full flex-shrink-0">
        {tabBar && <div className="w-full lg:w-auto lg:flex-shrink-0">{tabBar}</div>}

        <div className="flex-1 min-w-0 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
          <input
            type="text"
            placeholder="Search employees..."
            value={filters.searchQuery}
            onChange={(e) => { setFilters({ ...filters, searchQuery: e.target.value }); setCurrentPage(1); }}
            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm h-[38px] shadow-2xs transition-colors"
          />
        </div>

        <div className="w-full sm:w-44">
          <SearchableDropdown
            options={statusOptions}
            value={filters.status}
            onChange={(val) => { setFilters({ ...filters, status: val }); setCurrentPage(1); }}
            placeholder="All Status"
            height="h-[38px]"
          />
        </div>

        <div className="w-full sm:w-48">
          <SearchableDropdown
            options={employeeOptions}
            value={filters.employee}
            onChange={(val) => { setFilters({ ...filters, employee: val }); setCurrentPage(1); }}
            placeholder="All Employees"
            height="h-[38px]"
          />
        </div>

        <button
          onClick={handleClearFilters}
          className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg w-[38px] h-[38px] hover:bg-gray-100 transition-colors shadow-2xs flex-shrink-0"
          title="Clear Filters"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="1000px"
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
