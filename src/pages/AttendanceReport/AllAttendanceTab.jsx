import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Search, RotateCcw, Image as ImageIcon, Clock, ExternalLink, Calendar, MapPin } from 'lucide-react';
import { attendanceApi, isRawCoordinatesOrEmpty, getGoogleMapsUrl } from '../../api/attendanceApi';
import { authApi } from '../../api/authApi';
import { masterApi } from '../../api/masterApi';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import PhotoViewModal from '../Attendance/PhotoViewModal';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, isUserHR } from '../../utils/authUtils';

const STATUS_BADGES = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'HALF DAY': 'bg-amber-50 text-amber-700 border-amber-200',
  ABSENT: 'bg-red-50 text-red-700 border-red-200'
};

const parseLogDateStr = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/').map(Number);
    if (parts.length === 3) {
      const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
      return new Date(year, parts[1] - 1, parts[0]);
    }
  } else if (str.includes('-')) {
    const parts = str.split('-').map(Number);
    if (parts.length === 3) {
      if (parts[0] > 1000) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
        return new Date(year, parts[1] - 1, parts[0]);
      }
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const formatTimeDisplay = (rawTime) => {
  if (!rawTime || rawTime === '-') return '-';
  const str = String(rawTime).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)$/i.test(str)) {
    return str;
  }
  let timePart = str;
  if (str.includes(' ')) {
    const parts = str.split(' ');
    timePart = parts[1] || parts[0];
  }
  const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2];
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
    }
  }
  return str;
};

export default function AllAttendanceTab({ tabBar }) {
  const { user } = useAuthStore();
  const isAdminOrHR = isUserAdmin(user) || isUserHR(user);

  const [dailySummaries, setDailySummaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewLog, setViewLog] = useState(null);

  const initialFilters = {
    searchQuery: '',
    status: '',
    employee: '',
    startDate: '',
    endDate: ''
  };
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logs, dbUsers, receivers] = await Promise.all([
        attendanceApi.getAttendanceLogs(),
        authApi.getUsers().catch(() => []),
        masterApi.getLeadReceivers().catch(() => [])
      ]);

      const seen = new Set();
      const userList = [];
      const userMap = new Map();

      // 1. Primary: actual users from users table
      (dbUsers || []).forEach(u => {
        const rawName = u.name || u.id;
        if (!rawName) return;
        const clean = String(rawName).trim();
        const lower = clean.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          userList.push({ id: u.id || clean, name: clean });
        }
        if (u.id) userMap.set(String(u.id).toLowerCase(), clean);
        if (u.dbId) userMap.set(String(u.dbId).toLowerCase(), clean);
        userMap.set(lower, clean);
      });

      // 2. Secondary: master lead receivers
      (receivers || []).forEach(r => {
        const raw = r?.personName;
        if (!raw) return;
        const clean = String(raw).replace(/\s+/g, ' ').trim();
        const lower = clean.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          userList.push({ id: clean, name: clean });
        }
        userMap.set(lower, clean);
      });

      // 3. Any additional log userNames
      (logs || []).forEach(l => {
        const raw = l.userName;
        if (!raw) return;
        const clean = String(raw).trim();
        const lower = clean.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          userList.push({ id: clean, name: clean });
        }
      });

      setEmployees(userList);

      // Group logs by Date + Employee Name
      const grouped = {};
      (logs || []).forEach(log => {
        const dateKey = log.date || (log.timestamp ? log.timestamp.split(' ')[0] : 'Unknown');
        const resolvedName = (log.userId && userMap.get(String(log.userId).toLowerCase())) ||
          (log.userName && userMap.get(String(log.userName).toLowerCase())) ||
          log.userName || 'Unknown';
        const key = `${dateKey}___${resolvedName}`;

        if (!grouped[key]) {
          grouped[key] = {
            date: dateKey,
            name: resolvedName,
            userName: resolvedName,
            userId: log.userId,
            inTimes: [],
            outTimes: [],
            latestTimestampMs: log.timestampMs || 0,
            photoUrl: log.photoUrl || '',
            outPhotoUrl: log.outPhotoUrl || '',
            locationName: log.locationName || log.outLocationName || '',
            outLocationName: log.outLocationName || '',
            latitude: log.latitude,
            longitude: log.longitude
          };
        }

        const timeStr = log.inTime || log.outTime || (log.timestamp && log.timestamp.includes(' ')
          ? log.timestamp.split(' ')[1]
          : '');

        if (log.status?.toUpperCase() === 'IN') {
          grouped[key].inTimes.push({ time: log.inTime || timeStr, ms: log.timestampMs || 0 });
          if (log.photoUrl) grouped[key].photoUrl = log.photoUrl;
          if (log.locationName) grouped[key].locationName = log.locationName;
          if (log.latitude) grouped[key].latitude = log.latitude;
          if (log.longitude) grouped[key].longitude = log.longitude;
        } else if (log.status?.toUpperCase() === 'OUT') {
          grouped[key].outTimes.push({ time: log.outTime || timeStr, ms: log.timestampMs || 0 });
          if (log.outPhotoUrl || log.photoUrl) grouped[key].outPhotoUrl = log.outPhotoUrl || log.photoUrl;
          if (log.outLocationName || log.locationName) grouped[key].outLocationName = log.outLocationName || log.locationName;
        } else {
          // Half Day or other status
          if (log.inTime) grouped[key].inTimes.push({ time: log.inTime, ms: log.timestampMs || 0 });
          if (log.outTime) grouped[key].outTimes.push({ time: log.outTime, ms: log.timestampMs || 0 });
          if (log.photoUrl && !grouped[key].photoUrl) grouped[key].photoUrl = log.photoUrl;
          if (log.outPhotoUrl && !grouped[key].outPhotoUrl) grouped[key].outPhotoUrl = log.outPhotoUrl;
          if (log.locationName && !grouped[key].locationName) grouped[key].locationName = log.locationName;
          if (log.latitude && !grouped[key].latitude) grouped[key].latitude = log.latitude;
          if (log.longitude && !grouped[key].longitude) grouped[key].longitude = log.longitude;
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

        const checkIn = firstIn ? firstIn.time : '-';
        const checkOut = lastOut ? lastOut.time : '-';

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
          userName: group.name,
          userId: group.userId,
          checkIn,
          checkOut,
          inTime: checkIn,
          outTime: checkOut,
          photoUrl: group.photoUrl,
          outPhotoUrl: group.outPhotoUrl,
          locationName: group.locationName || group.outLocationName,
          latitude: group.latitude,
          longitude: group.longitude,
          workingHours,
          status,
          sortMs: group.latestTimestampMs
        };
      });

      // Scope for regular users if not admin/HR
      const scopedRows = isAdminOrHR
        ? rows
        : rows.filter(r =>
          (user?.name && r.name.toLowerCase() === user.name.toLowerCase()) ||
          (user?.id && r.name.toLowerCase() === user.id.toLowerCase()) ||
          (user?.id && r.userId === user.id) ||
          (user?.dbId && r.userId === user.dbId)
        );

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

  const handleClearFilters = useCallback(() => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  }, [initialFilters]);

  // Listen for sidebar click to reset filters
  useEffect(() => {
    const handleClear = (e) => {
      if (!e?.detail?.path || e.detail.path === '/attendance-report') {
        handleClearFilters();
      }
    };
    window.addEventListener('app:clear-filters', handleClear);
    return () => window.removeEventListener('app:clear-filters', handleClear);
  }, [handleClearFilters]);

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

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const rowD = parseLogDateStr(row.date);
      if (!rowD || rowD < start) return false;
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      const rowD = parseLogDateStr(row.date);
      if (!rowD || rowD > end) return false;
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        (row.name || '').toLowerCase().includes(q) ||
        (row.date || '').toLowerCase().includes(q) ||
        (row.status || '').toLowerCase().includes(q) ||
        (row.locationName || '').toLowerCase().includes(q)
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
    "DATE", "NAME", "PHOTO", "IN TIME", "OUT TIME", "LOCATION", "WORKING HOURS", "STATUS"
  ];

  const renderRow = (item) => {
    const mapsUrl = getGoogleMapsUrl(item.latitude, item.longitude);
    const isFallbackLocation = isRawCoordinatesOrEmpty(item.locationName);

    return (
      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 font-medium whitespace-nowrap">
          {item.date}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-semibold whitespace-nowrap">
          {item.name}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {item.photoUrl || item.outPhotoUrl ? (
            <button
              onClick={() => setViewLog(item)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition shadow-2xs cursor-pointer"
            >
              <ImageIcon size={13} /> View Photo
            </button>
          ) : (
            <span className="text-gray-300 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {item.checkIn && item.checkIn !== '-' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-semibold">
              <Clock size={12} className="text-emerald-600" />
              {formatTimeDisplay(item.checkIn)}
            </span>
          ) : (
            <span className="text-gray-400 font-mono text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {item.checkOut && item.checkOut !== '-' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono font-semibold">
              <Clock size={12} className="text-rose-600" />
              {formatTimeDisplay(item.checkOut)}
            </span>
          ) : (
            <span className="text-gray-400 font-mono text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-left text-[13px] text-gray-700 max-w-[280px]" title={!isFallbackLocation ? item.locationName : undefined}>
          {mapsUrl && isFallbackLocation ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-800 flex items-center gap-1 whitespace-nowrap">
                📍 Current Location
              </span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium whitespace-nowrap"
              >
                <span>View on Map</span>
                <ExternalLink size={11} />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-gray-800 hover:text-indigo-600 transition group min-w-0 truncate"
                >
                  <span className="truncate">{item.locationName || "-"}</span>
                  <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 flex-shrink-0" />
                </a>
              ) : (
                <span className="truncate">{item.locationName || "-"}</span>
              )}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap font-medium">
          {item.workingHours}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${STATUS_BADGES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {item.status}
          </span>
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const mapsUrl = getGoogleMapsUrl(item.latitude, item.longitude);
    const isFallbackLocation = isRawCoordinatesOrEmpty(item.locationName);

    return (
      <div key={item.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
        <div className="flex justify-between items-start border-b border-gray-100 pb-2">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-indigo-500 font-bold block mb-0.5">
              {item.date}
            </span>
            <h4 className="text-sm font-bold text-gray-900 leading-tight">{item.name}</h4>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_BADGES[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {item.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">In Time</p>
            <p className="text-emerald-700 font-bold font-mono truncate">{formatTimeDisplay(item.checkIn)}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Out Time</p>
            <p className="text-rose-700 font-mono font-bold truncate">{formatTimeDisplay(item.checkOut)}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Hours</p>
            <p className="text-gray-700 truncate">{item.workingHours}</p>
          </div>
        </div>

        {(item.locationName || (item.latitude && item.longitude)) && (
          <div className="text-[10px] pt-1">
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Location</p>
            {mapsUrl && isFallbackLocation ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-gray-800">📍 Current Location</span>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 font-medium"
                >
                  <span>View on Map</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <p className="text-gray-700 truncate">{item.locationName || "-"}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
          {(item.photoUrl || item.outPhotoUrl) && (
            <button
              onClick={() => setViewLog(item)}
              className="flex-1 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <ImageIcon size={12} /> View Photo
            </button>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition"
            >
              <ExternalLink size={12} /> View on Map
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 flex flex-col h-full min-h-0">
      {/* Top Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full flex-shrink-0">
        {tabBar && <div className="w-full lg:w-auto lg:flex-shrink-0">{tabBar}</div>}

        {/* Datewise Filter Inputs */}
        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs h-[34px] flex-shrink-0">
          <Calendar size={14} className="text-indigo-600 flex-shrink-0" />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setCurrentPage(1); }}
            className="text-xs text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            title="From Date"
          />
          <span className="text-gray-400 text-xs font-bold">-</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setCurrentPage(1); }}
            className="text-xs text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            title="To Date"
          />
        </div>

        <div className="flex-1 min-w-0 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
          <input
            type="text"
            placeholder="Search employee, location..."
            value={filters.searchQuery}
            onChange={(e) => { setFilters({ ...filters, searchQuery: e.target.value }); setCurrentPage(1); }}
            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm h-[34px] shadow-2xs transition-colors"
          />
        </div>

        <div className="w-full sm:w-40">
          <SearchableDropdown
            options={statusOptions}
            value={filters.status}
            onChange={(val) => { setFilters({ ...filters, status: val }); setCurrentPage(1); }}
            placeholder="All Status"
            height="h-[34px]"
          />
        </div>

        <div className="w-full sm:w-44">
          <SearchableDropdown
            options={employeeOptions}
            value={filters.employee}
            onChange={(val) => { setFilters({ ...filters, employee: val }); setCurrentPage(1); }}
            placeholder="All Employees"
            height="h-[34px]"
          />
        </div>

        <button
          onClick={handleClearFilters}
          className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg w-[34px] h-[34px] hover:bg-gray-100 transition-colors shadow-2xs flex-shrink-0"
          title="Clear Filters"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          loading={loading}
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="1200px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredRows.length}
        />
      </div>

      {/* Photo View Modal */}
      <PhotoViewModal
        isOpen={!!viewLog}
        onClose={() => setViewLog(null)}
        log={viewLog}
      />
    </div>
  );
}
