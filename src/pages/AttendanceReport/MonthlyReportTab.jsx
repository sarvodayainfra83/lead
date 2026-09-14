import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { attendanceApi } from '../../api/attendanceApi';
import { masterApi } from '../../api/masterApi';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Calculates working days in a month up to today (or end of month if in the past),
 * excluding Sundays.
 */
const getWorkingDaysInMonth = (year, monthIndex) => {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === monthIndex;
  
  const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const maxDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;

  let workingDays = 0;
  for (let d = 1; d <= maxDay; d++) {
    const dayOfWeek = new Date(year, monthIndex, d).getDay();
    // 0 is Sunday
    if (dayOfWeek !== 0) {
      workingDays++;
    }
  }
  return workingDays > 0 ? workingDays : 1;
};

// Default designation mapping
const getEmployeeDesignation = (user) => {
  if (user.role === 'ADMIN') return 'Administrator';
  if (user.designation) return user.designation;
  return 'Relationship Manager';
};

const getEmployeeDepartment = (user) => {
  return user.department || 'Sales';
};

export default function MonthlyReportTab({ tabBar }) {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reportRows, setReportRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [workingDaysCount, setWorkingDaysCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const year = selectedDate.getFullYear();
  const monthIndex = selectedDate.getMonth();
  const monthName = MONTH_NAMES[monthIndex];

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const [logs, receivers] = await Promise.all([
        attendanceApi.getAttendanceLogs(),
        masterApi.getLeadReceivers()
      ]);

      const workingDays = getWorkingDaysInMonth(year, monthIndex);
      setWorkingDaysCount(workingDays);

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
      const users = receiverNames.map(name => ({ id: name, name, role: 'USER' }));

      // Filter logs for the selected month and year
      const monthLogs = logs.filter(log => {
        let logDate = null;
        if (log.date && log.date.includes('/')) {
          const [d, m, y] = log.date.split('/').map(Number);
          const fullYear = y < 100 ? 2000 + y : y;
          logDate = new Date(fullYear, m - 1, d);
        } else if (log.timestampMs) {
          logDate = new Date(log.timestampMs);
        }

        if (!logDate || isNaN(logDate.getTime())) return false;
        return logDate.getFullYear() === year && logDate.getMonth() === monthIndex;
      });

      // Group logs by (employeeName, dateString) to get distinct days
      const daysByUser = {};
      users.forEach(u => {
        if (u.name) daysByUser[u.name] = {};
      });

      monthLogs.forEach(log => {
        const uName = log.userName;
        if (!daysByUser[uName]) daysByUser[uName] = {};
        const dKey = log.date || (log.timestamp ? log.timestamp.split(' ')[0] : 'd');
        if (!daysByUser[uName][dKey]) {
          daysByUser[uName][dKey] = { in: false, out: false, minMs: log.timestampMs, maxMs: log.timestampMs };
        }
        if (log.status?.toUpperCase() === 'IN') daysByUser[uName][dKey].in = true;
        if (log.status?.toUpperCase() === 'OUT') daysByUser[uName][dKey].out = true;
        if (log.timestampMs < daysByUser[uName][dKey].minMs) daysByUser[uName][dKey].minMs = log.timestampMs;
        if (log.timestampMs > daysByUser[uName][dKey].maxMs) daysByUser[uName][dKey].maxMs = log.timestampMs;
      });

      // Calculate Present, Half Day, Absent, and Consistency %
      const activeUsers = users.filter(u => u.name);
      const scopedUsers = isAdmin
        ? activeUsers
        : activeUsers.filter(u => u.name === user?.name || u.id === user?.id);

      const rows = scopedUsers.map(u => {
        const userDays = daysByUser[u.name] || {};
        let presentCount = 0;
        let halfDayCount = 0;

        Object.values(userDays).forEach(dayInfo => {
          if (dayInfo.in) {
            if (dayInfo.out && dayInfo.maxMs > dayInfo.minMs) {
              const diffHours = (dayInfo.maxMs - dayInfo.minMs) / (1000 * 60 * 60);
              if (diffHours < 4) {
                halfDayCount++;
              } else {
                presentCount++;
              }
            } else {
              presentCount++;
            }
          }
        });

        // Ensure counts don't exceed working days
        const effectivePresent = Math.min(presentCount, workingDays);
        const effectiveHalfDay = Math.min(halfDayCount, Math.max(0, workingDays - effectivePresent));
        const absentCount = Math.max(0, workingDays - (effectivePresent + effectiveHalfDay));

        const effectiveWorked = effectivePresent + (effectiveHalfDay * 0.5);
        const consistencyPct = workingDays > 0
          ? Math.round((effectiveWorked / workingDays) * 100)
          : 0;

        return {
          id: u.id || u.name,
          name: u.name,
          designation: getEmployeeDesignation(u),
          department: getEmployeeDepartment(u),
          workingDays,
          present: effectivePresent,
          halfDay: effectiveHalfDay,
          absent: absentCount,
          consistency: consistencyPct
        };
      });

      setReportRows(rows);
    } catch (err) {
      console.error('Failed to load monthly attendance report:', err);
      toast.error('Failed to load monthly attendance report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyData();
  }, [selectedDate, user]);

  const handlePrevMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const tableHeaders = [
    "NAME", "DESIGNATION", "DEPARTMENT", "WORKING DAYS", "PRESENT", "HALF DAY", "ABSENT", "CONSISTENCY"
  ];

  const getConsistencyColor = (pct) => {
    if (pct >= 75) return 'text-emerald-600 font-bold';
    if (pct >= 50) return 'text-amber-600 font-bold';
    return 'text-rose-600 font-bold';
  };

  const renderRow = (item) => (
    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-semibold whitespace-nowrap">
        {item.name}
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">
        {item.designation}
      </td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">
        {item.department}
      </td>
      <td className="px-4 py-3 text-center text-[13px] font-bold text-gray-700 whitespace-nowrap">
        {item.workingDays}
      </td>
      <td className="px-4 py-3 text-center text-[13px] font-bold text-emerald-600 whitespace-nowrap">
        {item.present}
      </td>
      <td className="px-4 py-3 text-center text-[13px] font-bold text-amber-600 whitespace-nowrap">
        {item.halfDay}
      </td>
      <td className="px-4 py-3 text-center text-[13px] font-bold text-rose-600 whitespace-nowrap">
        {item.absent}
      </td>
      <td className={`px-4 py-3 text-center text-[13px] whitespace-nowrap ${getConsistencyColor(item.consistency)}`}>
        {item.consistency}%
      </td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-indigo-500 font-bold block mb-0.5">
            {item.designation} · {item.department}
          </span>
          <h4 className="text-sm font-bold text-gray-900 leading-tight">{item.name}</h4>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          item.consistency >= 75
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : item.consistency >= 50
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {item.consistency}%
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 text-[10px] text-center bg-gray-50/70 p-2 rounded-lg border border-gray-100">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Working</p>
          <p className="text-gray-800 font-bold">{item.workingDays}</p>
        </div>
        <div>
          <p className="text-emerald-700 uppercase tracking-tighter text-[8px]">Present</p>
          <p className="text-emerald-700 font-bold">{item.present}</p>
        </div>
        <div>
          <p className="text-amber-700 uppercase tracking-tighter text-[8px]">Half Day</p>
          <p className="text-amber-700 font-bold">{item.halfDay}</p>
        </div>
        <div>
          <p className="text-rose-700 uppercase tracking-tighter text-[8px]">Absent</p>
          <p className="text-rose-700 font-bold">{item.absent}</p>
        </div>
      </div>
    </div>
  );

  const filteredRows = reportRows.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.designation || '').toLowerCase().includes(q) ||
      (item.department || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-3 flex flex-col h-full min-h-0">
      {/* Top Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 w-full flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
          {tabBar && <div className="flex-shrink-0">{tabBar}</div>}

          {/* Month Picker Box */}
          <div className="flex items-center bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-semibold text-gray-700 shadow-2xs h-[38px] flex-shrink-0">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="Previous Month"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar size={14} className="text-indigo-600" />
              <span>{monthName}, {year}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="Next Month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Search bar */}
          <div className="flex-1 min-w-0 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
            <input
              type="text"
              placeholder="Search employee, designation..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm h-[38px] shadow-2xs transition-colors"
            />
          </div>

          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
              className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg w-[38px] h-[38px] hover:bg-gray-100 transition-colors shadow-2xs flex-shrink-0"
              title="Clear Search"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>

        {/* Working days indicator */}
        <div className="text-xs text-gray-500 font-medium whitespace-nowrap self-end lg:self-center bg-gray-50/80 border border-gray-200/80 px-3 py-1.5 rounded-lg h-[38px] flex items-center shadow-2xs">
          <span><strong className="text-gray-900 font-bold">{workingDaysCount}</strong> working days this month</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="1100px"
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
