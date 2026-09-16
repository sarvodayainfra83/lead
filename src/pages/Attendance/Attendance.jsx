import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Search, Image as ImageIcon, ExternalLink, RotateCcw, MapPin, Calendar, UserCheck, Clock, CheckCircle2
} from 'lucide-react';
import { attendanceApi } from '../../api/attendanceApi';
import DataTable from '../../components/DataTable';
import AttendanceModal from './AttendanceModal';
import PhotoViewModal from './PhotoViewModal';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, hasFullAccess } from '../../utils/authUtils';

export default function Attendance() {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);
  const canEdit = hasFullAccess(user, 'attendance');

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewLog, setViewLog] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const todayStatus = attendanceApi.getUserTodayAttendanceStatus(logs, user);

  const formatInTime = (item) => {
    if (!item) return '-';
    if (item.timestamp && typeof item.timestamp === 'string') {
      const parts = item.timestamp.trim().split(' ');
      if (parts.length >= 2) {
        const timePart = parts[1];
        const [h, m, s] = timePart.split(':');
        if (h !== undefined && m !== undefined) {
          const hourNum = parseInt(h, 10);
          if (!isNaN(hourNum)) {
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const hour12 = hourNum % 12 || 12;
            return `${String(hour12).padStart(2, '0')}:${m}${s ? `:${s}` : ''} ${ampm}`;
          }
        }
        return timePart;
      }
    }
    if (item.timestampMs) {
      const d = new Date(item.timestampMs);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    }
    return '-';
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await attendanceApi.getAttendanceLogs();
      const userLogs = isAdmin
        ? allLogs
        : allLogs.filter(l => l.userName === user?.name || l.userId === user?.id || l.userId === user?.dbId);
      setLogs(userLogs);
    } catch (err) {
      console.error('Failed to load attendance logs:', err);
      toast.error('Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [user]);

  // Check for restored attendance session on mount (survives Android low-memory tab reload)
  useEffect(() => {
    try {
      const savedSessionStr = sessionStorage.getItem('attendance_camera_session');
      if (savedSessionStr) {
        const savedSession = JSON.parse(savedSessionStr);
        const isFresh = (Date.now() - (savedSession.timestamp || 0)) < 10 * 60 * 1000;
        if (isFresh) {
          setShowModal(true);
        } else {
          sessionStorage.removeItem('attendance_camera_session');
        }
      }
    } catch (e) {
      console.warn('Error reading saved attendance session:', e);
    }
  }, []);

  const filteredLogs = logs.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.userName || '').toLowerCase().includes(q) ||
      (item.date || '').toLowerCase().includes(q) ||
      (item.status || '').toLowerCase().includes(q) ||
      (item.locationName || '').toLowerCase().includes(q)
    );
  }).reverse();

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const tableHeaders = [
    "SERIAL NO", "DATE", "NAME", "PHOTO", "STATUS", "IN TIME", "LOCATION"
  ];

  const renderRow = (item, index) => {
    const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
    const mapsUrl = item.latitude && item.longitude
      ? `https://maps.google.com/?q=${item.latitude},${item.longitude}`
      : null;

    const getStatusBadgeClass = (status) => {
      const s = (status || '').toUpperCase();
      if (s === 'IN') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (s === 'HALF DAY') return 'bg-amber-50 text-amber-700 border-amber-200';
      return 'bg-blue-50 text-blue-700 border-blue-200';
    };

    return (
      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center text-[13px] font-bold text-gray-700 whitespace-nowrap">
          {serialNo}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">
          {item.date || item.timestamp?.split(' ')[0] || '-'}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-semibold whitespace-nowrap">
          {item.userName}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {item.photoUrl ? (
            <button
              onClick={() => setViewLog(item)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition shadow-2xs"
            >
              <ImageIcon size={13} /> View Image
            </button>
          ) : (
            <span className="text-gray-300 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getStatusBadgeClass(item.status)}`}>
            {item.status}
          </span>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-semibold">
            <Clock size={12} className="text-emerald-600" />
            {formatInTime(item)}
          </span>
        </td>
        <td className="px-4 py-3 text-left text-[13px] text-gray-700 max-w-[360px] truncate" title={item.locationName}>
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-gray-800 hover:text-indigo-600 transition group"
            >
              <span className="truncate">{item.locationName || 'View Map'}</span>
              <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 flex-shrink-0" />
            </a>
          ) : (
            <span>{item.locationName || '-'}</span>
          )}
        </td>
      </tr>
    );
  };

  const renderCard = (item, index) => {
    const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
    const mapsUrl = item.latitude && item.longitude
      ? `https://maps.google.com/?q=${item.latitude},${item.longitude}`
      : null;
    const getStatusBadgeClass = (status) => {
      const s = (status || '').toUpperCase();
      if (s === 'IN') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (s === 'HALF DAY') return 'bg-amber-50 text-amber-700 border-amber-200';
      return 'bg-blue-50 text-blue-700 border-blue-200';
    };

    return (
      <div key={item.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
        <div className="flex justify-between items-start border-b border-gray-100 pb-2">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-indigo-500 font-bold block mb-0.5">
              Log #{serialNo} · {item.date}
            </span>
            <h4 className="text-sm font-bold text-gray-900 leading-tight">{item.userName}</h4>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeClass(item.status)}`}>
              {item.status}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
              <Clock size={10} className="text-emerald-600" />
              {formatInTime(item)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-[10px]">
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Time</p>
            <p className="text-gray-700 font-medium truncate">{item.timestamp?.split(' ')[1] || item.date}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Location</p>
            <p className="text-gray-700 leading-tight">{item.locationName || '-'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
          {item.photoUrl && (
            <button
              onClick={() => setViewLog(item)}
              className="flex-1 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
            >
              <ImageIcon size={12} /> View Photo
            </button>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
            >
              <ExternalLink size={12} /> Google Maps
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3 w-full flex-shrink-0">
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
          <input
            type="text"
            placeholder="Search attendance logs..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm h-[38px] shadow-2xs transition-colors"
          />
        </div>

        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-4 h-[38px] text-xs sm:text-sm font-bold uppercase tracking-wider shadow-sm transition active:scale-95 flex-shrink-0 cursor-pointer ${
              todayStatus.isLocked
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : todayStatus.hasMarkedIn
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {todayStatus.isLocked ? (
              <>
                <CheckCircle2 size={16} /> Completed Today
              </>
            ) : todayStatus.hasMarkedIn ? (
              <>
                <Clock size={16} /> Mark Out / Half Day
              </>
            ) : (
              <>
                <UserCheck size={16} /> Attendance
              </>
            )}
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedLogs}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="1200px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredLogs.length}
        />
      </div>

      {/* Attendance Capture Modal */}
      <AttendanceModal
        isOpen={showModal}
        onClose={() => {
          try {
            sessionStorage.removeItem('attendance_camera_session');
          } catch (e) { }
          setShowModal(false);
        }}
        onSaved={loadLogs}
        existingLogs={logs}
      />

      {/* Photo Lightbox Modal */}
      <PhotoViewModal
        isOpen={!!viewLog}
        onClose={() => setViewLog(null)}
        log={viewLog}
      />
    </div>
  );
}
