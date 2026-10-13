import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getLeaveRequests as getLocalLeaveRequests,
  saveLeaveRequest as saveLocalLeaveRequest,
  saveLeaveRequests as saveLocalLeaveRequests,
  deleteLeaveRequest as deleteLocalLeaveRequest,
  getAttendanceLogs as getLocalAttendanceLogs,
  saveAttendanceLogs as saveLocalAttendanceLogs
} from '../utils/storageManager';

export const LEAVE_DURATION_TYPES = [
  'Full Day',
  'Half Day (First Half)',
  'Half Day (Second Half)'
];

export const LEAVE_CATEGORY_TYPES = [
  'Casual Leave',
  'Sick / Medical Leave',
  'Emergency Leave',
  'Planned / Vacation Leave',
  'Other'
];

export const LEAVE_STATUS_STYLES = {
  PENDING: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Pending'
  },
  APPROVED: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Approved'
  },
  REJECTED: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Rejected'
  },
  CANCELLED: {
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Cancelled'
  }
};

// Convert ISO (YYYY-MM-DD) or other date formats into Indian standard DD/MM/YYYY
export const toDDMMYYYY = (d) => {
  if (!d) return '';
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (trimmed.includes('/')) return trimmed;
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        // YYYY-MM-DD -> DD/MM/YYYY
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
    }
    d = new Date(trimmed);
  }
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Expand fromDate -> toDate range into an array of DD/MM/YYYY date strings
export const getDatesListFromRange = (fromDateStr, toDateStr) => {
  if (!fromDateStr) return [];
  const start = new Date(fromDateStr);
  const end = toDateStr ? new Date(toDateStr) : new Date(fromDateStr);
  if (isNaN(start.getTime())) return [];
  if (isNaN(end.getTime()) || end < start) {
    const single = toDDMMYYYY(start);
    return single ? [single] : [];
  }

  const dates = [];
  const cur = new Date(start);
  let count = 0;
  while (cur <= end && count < 90) {
    const formatted = toDDMMYYYY(cur);
    if (formatted) dates.push(formatted);
    cur.setDate(cur.getDate() + 1);
    count++;
  }
  return dates;
};

// Map DB snake_case -> Frontend camelCase
const mapDbToLeave = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.userId || '',
    userName: row.user_name || row.userName || 'Employee',
    userPosition: row.user_position || row.userPosition || '',
    leaveType: row.leave_type || row.leaveType || 'Full Day',
    leaveCategory: row.leave_category || row.leaveCategory || 'Casual Leave',
    fromDate: row.from_date || row.fromDate || '',
    toDate: row.to_date || row.toDate || '',
    totalDays: row.total_days !== undefined ? Number(row.total_days) : (row.totalDays || 1),
    reason: row.reason || '',
    documentUrl: row.document_url || row.documentUrl || '',
    status: (row.status || 'PENDING').toUpperCase(),
    reviewedBy: row.reviewed_by || row.reviewedBy || null,
    reviewedById: row.reviewed_by_id || row.reviewedById || null,
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
    adminNotes: row.admin_notes || row.adminNotes || '',
    appliedAt: row.applied_at || row.created_at || row.appliedAt || new Date().toISOString(),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
  };
};

// Map Frontend camelCase -> DB snake_case
const mapLeaveToDb = (item) => {
  return {
    user_id: item.userId || null,
    user_name: item.userName || 'Employee',
    user_position: item.userPosition || null,
    leave_type: item.leaveType || 'Full Day',
    leave_category: item.leaveCategory || 'Casual Leave',
    from_date: item.fromDate,
    to_date: item.toDate || item.fromDate,
    total_days: item.totalDays ? Number(item.totalDays) : 1,
    reason: item.reason?.trim() || '',
    document_url: item.documentUrl || null,
    status: (item.status || 'PENDING').toUpperCase(),
    reviewed_by: item.reviewedBy || null,
    reviewed_by_id: item.reviewedById || null,
    reviewed_at: item.reviewedAt || null,
    admin_notes: item.adminNotes || null
  };
};

export const leaveRequestApi = {
  // Fetch leave requests (all for Admin, own for employees)
  async getLeaveRequests(user = null) {
    const isAdmin = (user?.role || '').toUpperCase() === 'ADMIN' || (user?.role || '').toUpperCase() === 'TESTER';

    if (!isSupabaseConfigured) {
      const local = getLocalLeaveRequests().map(mapDbToLeave);
      if (isAdmin) return local;
      return local.filter(l =>
        l.userId === user?.id ||
        l.userId === user?.dbId ||
        l.userName?.toLowerCase() === user?.name?.toLowerCase()
      );
    }

    try {
      let query = supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin && user) {
        const uid = user.dbId || user.id;
        const name = user.name || '';
        query = query.or(`user_id.eq.${uid},user_name.ilike.%${name}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[Leave API] Supabase leave_requests query warning, falling back to local storage:', error.message);
        const local = getLocalLeaveRequests().map(mapDbToLeave);
        if (isAdmin) return local;
        return local.filter(l =>
          l.userId === user?.id ||
          l.userId === user?.dbId ||
          l.userName?.toLowerCase() === user?.name?.toLowerCase()
        );
      }

      return (data || []).map(mapDbToLeave);
    } catch (err) {
      console.warn('[Leave API] Network or schema error, using local storage fallback:', err);
      const local = getLocalLeaveRequests().map(mapDbToLeave);
      if (isAdmin) return local;
      return local.filter(l =>
        l.userId === user?.id ||
        l.userId === user?.dbId ||
        l.userName?.toLowerCase() === user?.name?.toLowerCase()
      );
    }
  },

  // Apply new leave request
  async applyLeaveRequest(payload, user) {
    const userId = user?.dbId || user?.id || 'emp_01';
    const userName = user?.name || user?.username || 'Employee';
    const userPosition = user?.position || '';

    const newLeave = {
      ...payload,
      userId,
      userName,
      userPosition,
      status: 'PENDING',
      appliedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // Always mirror in localStorage for immediate offline responsiveness
    saveLocalLeaveRequest(newLeave);

    if (!isSupabaseConfigured) {
      return newLeave;
    }

    try {
      const dbPayload = mapLeaveToDb(newLeave);
      const { data, error } = await supabase
        .from('leave_requests')
        .insert([dbPayload])
        .select()
        .single();

      if (error) {
        console.warn('[Leave API] Error saving to Supabase leave_requests, using local copy:', error);
        return newLeave;
      }

      return mapDbToLeave(data);
    } catch (err) {
      console.warn('[Leave API] Exception saving leave to Supabase:', err);
      return newLeave;
    }
  },

  // Admin Accept / Reject leave request
  async updateLeaveStatus(leaveId, { status, adminNotes = '', reviewedBy = 'Admin', reviewedById = null }) {
    const normalizedStatus = status.toUpperCase();
    const updatePayload = {
      status: normalizedStatus,
      adminNotes: adminNotes || '',
      reviewedBy,
      reviewedById,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update in local storage
    const localLeaves = getLocalLeaveRequests();
    const targetIdx = localLeaves.findIndex(l => l.id === leaveId);
    let updatedLocalLeave = null;
    if (targetIdx >= 0) {
      localLeaves[targetIdx] = {
        ...localLeaves[targetIdx],
        ...updatePayload
      };
      saveLocalLeaveRequests(localLeaves);
      updatedLocalLeave = localLeaves[targetIdx];
    } else {
      updatedLocalLeave = { id: leaveId, ...updatePayload };
    }

    // Synchronize attendance records (create/update leave logs for APPROVED, purge/revert for REJECTED)
    try {
      await this.syncLeaveWithAttendance(updatedLocalLeave, normalizedStatus);
    } catch (syncErr) {
      console.warn('[Leave API] Error syncing leave decision to attendance:', syncErr);
    }

    if (!isSupabaseConfigured) {
      return updatedLocalLeave;
    }

    try {
      const dbUpdate = {
        status: normalizedStatus,
        admin_notes: adminNotes || null,
        reviewed_by: reviewedBy,
        reviewed_by_id: reviewedById || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('leave_requests')
        .update(dbUpdate)
        .eq('id', leaveId)
        .select()
        .single();

      if (error) {
        console.warn('[Leave API] Error updating status in Supabase:', error);
        return updatedLocalLeave;
      }

      const mapped = mapDbToLeave(data);
      // Ensure Supabase attendance sync is complete with full DB record
      try {
        await this.syncLeaveWithAttendance(mapped, normalizedStatus);
      } catch (e) { }

      return mapped;
    } catch (err) {
      console.warn('[Leave API] Exception updating leave status:', err);
      return updatedLocalLeave;
    }
  },

  // Synchronize an approved or rejected leave with attendance logs
  async syncLeaveWithAttendance(leave, newStatus) {
    if (!leave || !leave.fromDate) return;

    const dates = getDatesListFromRange(leave.fromDate, leave.toDate || leave.fromDate);
    if (!dates.length) return;

    const normalizedStatus = (newStatus || leave.status || '').toUpperCase();
    const isApproved = normalizedStatus === 'APPROVED';
    const isRejected = normalizedStatus === 'REJECTED' || normalizedStatus === 'CANCELLED';

    const isHalfDay = (leave.leaveType || '').toLowerCase().includes('half');
    const attStatus = isHalfDay ? 'Half Day' : 'Leave';
    const leaveLocation = `Approved Leave (${leave.leaveCategory || 'Leave'})${leave.reason ? `: ${leave.reason}` : ''}`;

    // 1. Sync in Local Storage
    const localLogs = getLocalAttendanceLogs();
    const targetUserId = leave.userId || '';
    const targetUserName = (leave.userName || '').trim().toLowerCase();

    if (isApproved) {
      dates.forEach(dateStr => {
        const matchIdx = localLogs.findIndex(l => {
          const matchDate = (l.date || '').replace(/-/g, '/') === dateStr.replace(/-/g, '/');
          const matchId = targetUserId && l.userId === targetUserId;
          const matchName = targetUserName && (l.userName || '').trim().toLowerCase() === targetUserName;
          return matchDate && (matchId || matchName);
        });

        if (matchIdx >= 0) {
          localLogs[matchIdx] = {
            ...localLogs[matchIdx],
            status: attStatus,
            locationName: leaveLocation,
            leaveRequestId: leave.id,
            photoUrl: localLogs[matchIdx].photoUrl || leave.documentUrl || '',
            updatedAt: new Date().toISOString()
          };
        } else {
          const [dd, mm, yyyy] = dateStr.split('/');
          const fakeMs = new Date(`${yyyy}-${mm}-${dd}T09:00:00+05:30`).getTime() || Date.now();
          localLogs.push({
            id: `att_leave_${leave.id}_${dd}_${mm}_${yyyy}`,
            serialNo: localLogs.length + 1,
            userId: leave.userId || '',
            userName: leave.userName || 'Employee',
            date: dateStr,
            timestamp: `${dateStr} 09:00:00 AM`,
            timestampMs: fakeMs,
            inTime: isHalfDay ? '09:00 AM' : '-',
            outTime: '-',
            status: attStatus,
            photoUrl: leave.documentUrl || '',
            outPhotoUrl: '',
            latitude: null,
            longitude: null,
            accuracy: null,
            locationName: leaveLocation,
            geocodingStatus: 'RESOLVED',
            leaveRequestId: leave.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      });
      saveLocalAttendanceLogs(localLogs);
    } else if (isRejected) {
      const filteredLogs = [];
      localLogs.forEach(l => {
        const isThisLeave = l.leaveRequestId === leave.id || (typeof l.id === 'string' && l.id.startsWith(`att_leave_${leave.id}`));
        const matchDate = dates.includes((l.date || '').replace(/-/g, '/'));
        const matchId = targetUserId && l.userId === targetUserId;
        const matchName = targetUserName && (l.userName || '').trim().toLowerCase() === targetUserName;
        const isMatchingUserAndDate = matchDate && (matchId || matchName);

        if (isThisLeave || (isMatchingUserAndDate && (l.status?.toUpperCase() === 'LEAVE' || l.locationName?.startsWith('Approved Leave')))) {
          // If purely an auto-generated leave record without real check-in/check-out punch times, remove it
          if (!l.inTime || l.inTime === '-' || l.inTime === '09:00 AM') {
            return; // exclude
          } else {
            // Restore previous attendance status
            filteredLogs.push({
              ...l,
              status: l.outTime && l.outTime !== '-' ? 'Out' : 'In',
              locationName: l.locationName?.startsWith('Approved Leave') ? '-' : l.locationName,
              leaveRequestId: null
            });
          }
        } else {
          filteredLogs.push(l);
        }
      });
      saveLocalAttendanceLogs(filteredLogs);
    }

    // 2. Sync to Supabase if configured
    if (!isSupabaseConfigured) return;

    try {
      // Resolve user UUID
      let resolvedDbUserId = null;
      const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      if (isUuid(targetUserId)) {
        resolvedDbUserId = targetUserId;
      } else {
        const { data: uData } = await supabase
          .from('users')
          .select('id')
          .or(`name.ilike.%${leave.userName}%,username.ilike.%${leave.userName}%`)
          .maybeSingle();
        if (uData?.id) resolvedDbUserId = uData.id;
      }

      for (const dateStr of dates) {
        if (isApproved) {
          let query = supabase
            .from('attendance_logs')
            .select('id, user_id, date, status, location_name, photo_url, in_time, out_time')
            .eq('date', dateStr);

          if (resolvedDbUserId) {
            query = query.eq('user_id', resolvedDbUserId);
          }
          const { data: matchedRows } = await query;
          const existingRow = matchedRows && matchedRows.length > 0 ? matchedRows[0] : null;

          if (existingRow) {
            const updatePayload = {
              status: attStatus,
              location_name: leaveLocation,
              photo_url: existingRow.photo_url || leave.documentUrl || '',
              updated_at: new Date().toISOString()
            };
            const { error: updErr } = await supabase
              .from('attendance_logs')
              .update(updatePayload)
              .eq('id', existingRow.id);

            if (updErr && (updErr.code === '23514' || updErr.message?.includes('check constraint'))) {
              await supabase
                .from('attendance_logs')
                .update({ ...updatePayload, status: 'Half Day' })
                .eq('id', existingRow.id);
            }
          } else {
            const insertPayload = {
              user_id: resolvedDbUserId || null,
              date: dateStr,
              timestamp: `${dateStr} 09:00:00 AM`,
              in_time: isHalfDay ? '09:00 AM' : null,
              out_time: null,
              status: attStatus,
              photo_url: leave.documentUrl || '',
              location_name: leaveLocation,
              geocoding_status: 'RESOLVED',
              created_at: new Date().toISOString()
            };

            const { error: insErr } = await supabase
              .from('attendance_logs')
              .insert([insertPayload]);

            if (insErr && (insErr.code === '23514' || insErr.message?.includes('check constraint'))) {
              await supabase
                .from('attendance_logs')
                .insert([{ ...insertPayload, status: 'Half Day' }]);
            }
          }
        } else if (isRejected) {
          let query = supabase
            .from('attendance_logs')
            .select('id, user_id, status, in_time, out_time, location_name')
            .eq('date', dateStr);

          if (resolvedDbUserId) {
            query = query.eq('user_id', resolvedDbUserId);
          }
          const { data: matchedRows } = await query;
          for (const row of (matchedRows || [])) {
            const rowLoc = row.location_name || '';
            if (row.status?.toUpperCase() === 'LEAVE' || rowLoc.startsWith('Approved Leave')) {
              if (!row.in_time || row.in_time === '-' || row.in_time === '09:00 AM') {
                await supabase.from('attendance_logs').delete().eq('id', row.id);
              } else {
                await supabase.from('attendance_logs').update({
                  status: row.out_time ? 'Out' : 'In',
                  location_name: rowLoc.startsWith('Approved Leave') ? null : rowLoc,
                  updated_at: new Date().toISOString()
                }).eq('id', row.id);
              }
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn('[Leave API] Supabase syncLeaveWithAttendance warning:', dbErr);
    }
  },

  // Scan all approved leaves and ensure they are recorded in attendance logs
  async syncAllApprovedLeavesToAttendance() {
    try {
      const allLeaves = await this.getLeaveRequests({ role: 'ADMIN' });
      const approved = allLeaves.filter(l => (l.status || '').toUpperCase() === 'APPROVED');
      for (const leave of approved) {
        await this.syncLeaveWithAttendance(leave, 'APPROVED');
      }
    } catch (e) {
      console.warn('[Leave API] Error syncing approved leaves to attendance:', e);
    }
  },

  // Upload leave document/image (doctor prescription, letter, slip)
  async uploadLeaveDocument(fileOrDataUrl, userName = 'employee') {
    if (!fileOrDataUrl) return '';

    // If it's already a URL
    if (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://'))) {
      return fileOrDataUrl;
    }

    if (!isSupabaseConfigured) {
      return fileOrDataUrl;
    }

    try {
      let fileBlob = null;
      let contentType = 'image/jpeg';
      let fileExt = 'jpg';

      if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
        const parts = fileOrDataUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        fileExt = contentType.split('/')[1] || 'jpg';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        fileBlob = new Blob([u8arr], { type: contentType });
      } else if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
        fileBlob = fileOrDataUrl;
        contentType = fileOrDataUrl.type || 'image/jpeg';
        fileExt = contentType.split('/')[1] || 'jpg';
      } else {
        return fileOrDataUrl;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const sanitizedName = (userName || 'employee').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const filePath = `leave_documents/${year}/${month}/${sanitizedName}_${uniqueSuffix}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(filePath, fileBlob, {
          contentType: contentType,
          upsert: true
        });

      if (uploadError) {
        console.warn('[Leave API] Supabase storage upload warning:', uploadError);
        return fileOrDataUrl;
      }

      const { data: publicUrlData } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(filePath);

      return publicUrlData?.publicUrl || fileOrDataUrl;
    } catch (err) {
      console.warn('[Leave API] Failed to upload document, keeping local copy:', err);
      return fileOrDataUrl;
    }
  }
};
