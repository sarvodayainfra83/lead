import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getAttendanceLogs as getLocalAttendanceLogs,
  saveAttendanceLogs as saveLocalAttendanceLogs,
  saveAttendanceLog as saveLocalAttendanceLog,
  deleteAttendanceLog as deleteLocalAttendanceLog,
  getLeaveRequests as getLocalLeaveRequests,
  getLocalLocationCache,
  addLocalLocationCacheEntry,
  getLastResolvedAddress,
  saveLastResolvedAddress
} from '../utils/storageManager';

// Haversine distance calculator between two coordinates in meters
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (Number(lat1) * Math.PI) / 180;
  const phi2 = (Number(lat2) * Math.PI) / 180;
  const deltaPhi = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const deltaLambda = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Check if a location name string is empty, placeholder, or raw coordinates
export const isRawCoordinatesOrEmpty = (str) => {
  if (!str) return true;
  const s = String(str).trim().toLowerCase();
  if (
    !s ||
    s === '-' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'location unavailable' ||
    s === 'current location' ||
    s.includes('current location')
  ) {
    return true;
  }
  // Matches patterns like "21.251431, 81.629805" or "21.251431,81.629805"
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s);
};

// Generate standard Google Maps search URL from coordinates
export const getGoogleMapsUrl = (lat, lng) => {
  if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) return null;
  return `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;
};


// Convert base64 data URL to binary Blob for efficient storage upload
function dataURLtoBlob(dataUrl) {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error('Error converting dataURL to Blob:', err);
    return null;
  }
}

export const attendanceApi = {
  // Upload attendance photo to Supabase Storage bucket ('attendance-photos')
  async uploadAttendancePhoto(photoData, userName = 'user') {
    if (!isSupabaseConfigured || !photoData) {
      return photoData;
    }

    // Already a remote URL
    if (typeof photoData === 'string' && (photoData.startsWith('http://') || photoData.startsWith('https://'))) {
      return photoData;
    }

    try {
      let fileBlob = null;
      let contentType = 'image/jpeg';
      let fileExt = 'jpg';

      if (typeof photoData === 'string' && photoData.startsWith('data:')) {
        fileBlob = dataURLtoBlob(photoData);
        if (!fileBlob) return photoData;
        contentType = fileBlob.type || 'image/jpeg';
        fileExt = contentType.split('/')[1] || 'jpg';
      } else if (photoData instanceof Blob || photoData instanceof File) {
        fileBlob = photoData;
        contentType = photoData.type || 'image/jpeg';
        fileExt = contentType.split('/')[1] || 'jpg';
      } else {
        return photoData;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const sanitizedName = (userName || 'employee').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const filePath = `${year}/${month}/${sanitizedName}_${uniqueSuffix}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(filePath, fileBlob, {
          contentType: contentType,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.warn('Could not upload image to attendance-photos bucket, storing locally/base64:', uploadError);
        return photoData;
      }

      const { data: publicUrlData } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(filePath);

      return publicUrlData?.publicUrl || photoData;
    } catch (err) {
      console.warn('Storage upload error, fallback to original data:', err);
      return photoData;
    }
  },

  // Resolve user UUID from user object or Supabase
  async getUserIdUuid(user) {
    if (!user) return null;
    if (user.dbId) return user.dbId;
    if (user.uuid) return user.uuid;
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    if (isUuid(user.id)) return user.id;

    if (isSupabaseConfigured) {
      try {
        if (user.id) {
          const { data } = await supabase.from('users').select('id').eq('username', user.id).maybeSingle();
          if (data?.id) return data.id;
        }
        if (user.name) {
          const { data } = await supabase.from('users').select('id').eq('name', user.name).maybeSingle();
          if (data?.id) return data.id;
        }
      } catch (e) {
        console.warn('Could not resolve user UUID from Supabase:', e);
      }
    }
    return null;
  },

  // Helper to consolidate multiple entries for the same user on the same date into a single row
  consolidateSingleDayRows(logs) {
    if (!Array.isArray(logs)) return [];
    const grouped = new Map();

    logs.forEach(log => {
      const dateKey = (log.date || '').replace(/-/g, '/');
      const userKey = (log.userId || log.userName || '').trim().toLowerCase();
      // If either userKey or dateKey is missing, keep separate
      if (!userKey || !dateKey) {
        grouped.set(log.id || Math.random().toString(), { ...log });
        return;
      }
      const groupKey = `${userKey}__${dateKey}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { ...log });
      } else {
        const existing = grouped.get(groupKey);
        const statusUpper = (log.status || '').toUpperCase();

        const inTime = existing.inTime || (statusUpper !== 'OUT' ? log.inTime : null);
        const outTime = existing.outTime || (statusUpper === 'OUT' ? (log.outTime || log.inTime) : log.outTime);

        let finalStatus = existing.status;
        if (statusUpper === 'OUT') {
          finalStatus = 'Out';
        } else if (statusUpper === 'HALF DAY') {
          finalStatus = 'Half Day';
        } else if (statusUpper === 'LEAVE' || statusUpper === 'ON LEAVE') {
          finalStatus = 'Leave';
        } else if ((existing.status || '').toUpperCase() === 'LEAVE') {
          finalStatus = 'Leave';
        } else if (statusUpper.includes('PENDING')) {
          finalStatus = (existing.status && existing.status !== '-' && !existing.status.toUpperCase().includes('PENDING'))
            ? existing.status
            : 'Pending Leave';
        }

        const isAnyLeave = statusUpper === 'LEAVE' ||
          (existing.status || '').toUpperCase() === 'LEAVE' ||
          statusUpper.includes('PENDING') ||
          (existing.status || '').toUpperCase().includes('PENDING');

        const leaveLocation = isAnyLeave
          ? (log.locationName || existing.locationName || '')
          : '';

        grouped.set(groupKey, {
          ...existing,
          inTime: inTime || existing.inTime || '',
          outTime: outTime || existing.outTime || '',
          photoUrl: existing.photoUrl || log.photoUrl || '',
          outPhotoUrl: existing.outPhotoUrl || (statusUpper === 'OUT' ? log.photoUrl : ''),
          locationName: leaveLocation || existing.locationName || log.locationName || '',
          outLocationName: existing.outLocationName || (statusUpper === 'OUT' ? log.locationName : ''),
          outLatitude: existing.outLatitude || (statusUpper === 'OUT' ? (log.outLatitude || log.latitude) : existing.outLatitude),
          outLongitude: existing.outLongitude || (statusUpper === 'OUT' ? (log.outLongitude || log.longitude) : existing.outLongitude),
          outAccuracy: existing.outAccuracy || (statusUpper === 'OUT' ? (log.outAccuracy || log.accuracy) : existing.outAccuracy),
          outGeocodingStatus: existing.outGeocodingStatus || (statusUpper === 'OUT' ? (log.outGeocodingStatus || log.geocodingStatus) : existing.outGeocodingStatus),
          leaveRequestId: existing.leaveRequestId || log.leaveRequestId || null,
          status: finalStatus
        });
      }
    });

    return Array.from(grouped.values()).map((row, idx) => ({
      ...row,
      serialNo: idx + 1
    }));
  },

  // Map DB row -> Frontend Attendance model
  mapFromDb(row) {
    const joinedUser = row.users || {};
    const fallbackTime = row.timestamp ? (row.timestamp.includes(' ') ? row.timestamp.split(' ')[1] : row.timestamp) : '';
    const locName = row.location_name || row.locationName || row.location || '';
    const statusUpper = (row.status || '').toUpperCase();
    const isApprovedLeave = statusUpper === 'LEAVE' || locName.startsWith('Approved Leave');
    let effectiveStatus = row.status || 'In';
    if (isApprovedLeave) {
      effectiveStatus = locName.toLowerCase().includes('half day') ? 'Half Day' : 'Leave';
    }

    const inTime = (isApprovedLeave && effectiveStatus === 'Leave')
      ? ''
      : (row.in_time || row.inTime || (statusUpper === 'IN' || statusUpper === 'HALF DAY' ? fallbackTime : (statusUpper === 'OUT' ? null : fallbackTime)));
    const outTime = (isApprovedLeave && effectiveStatus === 'Leave')
      ? ''
      : (row.out_time || row.outTime || (statusUpper === 'OUT' ? fallbackTime : null));

    return {
      id: row.id,
      serialNo: row.serial_no || row.serialNo,
      userId: row.user_id || joinedUser.id || row.userId || '',
      userName: joinedUser.name || row.user_name || row.userName || row.name || '',
      date: row.date || '',
      timestamp: row.timestamp || '',
      timestampMs: row.timestamp_ms ? Number(row.timestamp_ms) : (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      inTime: inTime || '',
      outTime: outTime || '',
      status: effectiveStatus,
      photoUrl: row.photo_url || row.photoUrl || '',
      outPhotoUrl: row.out_photo_url || row.outPhotoUrl || '',
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
      accuracy: row.accuracy !== null && row.accuracy !== undefined ? Number(row.accuracy) : null,
      locationName: row.location_name || row.locationName || row.location || '',
      geocodingStatus: row.geocoding_status || row.geocodingStatus || 'RESOLVED',
      outLatitude: row.out_latitude !== null && row.out_latitude !== undefined ? Number(row.out_latitude) : (row.outLatitude != null ? Number(row.outLatitude) : null),
      outLongitude: row.out_longitude !== null && row.out_longitude !== undefined ? Number(row.out_longitude) : (row.outLongitude != null ? Number(row.outLongitude) : null),
      outAccuracy: row.out_accuracy !== null && row.out_accuracy !== undefined ? Number(row.out_accuracy) : null,
      outLocationName: row.out_location_name || row.outLocationName || '',
      outGeocodingStatus: row.out_geocoding_status || row.outGeocodingStatus || 'RESOLVED',
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt
    };
  },

  // Map Frontend Attendance model -> DB row
  mapToDb(entry) {
    return {
      user_id: entry.userId || null,
      date: entry.date || '',
      timestamp: entry.timestamp || '',
      in_time: entry.inTime || null,
      out_time: entry.outTime || null,
      status: entry.status || 'In',
      photo_url: entry.photoUrl || '',
      out_photo_url: entry.outPhotoUrl || null,
      latitude: entry.latitude !== null && entry.latitude !== undefined ? Number(entry.latitude) : null,
      longitude: entry.longitude !== null && entry.longitude !== undefined ? Number(entry.longitude) : null,
      accuracy: entry.accuracy !== null && entry.accuracy !== undefined ? Number(entry.accuracy) : null,
      location_name: entry.locationName || entry.location || '',
      geocoding_status: entry.geocodingStatus || entry.geocoding_status || 'RESOLVED',
      out_latitude: entry.outLatitude !== null && entry.outLatitude !== undefined ? Number(entry.outLatitude) : null,
      out_longitude: entry.outLongitude !== null && entry.outLongitude !== undefined ? Number(entry.outLongitude) : null,
      out_accuracy: entry.outAccuracy !== null && entry.outAccuracy !== undefined ? Number(entry.outAccuracy) : null,
      out_location_name: entry.outLocationName || null,
      out_geocoding_status: entry.outGeocodingStatus || entry.out_geocoding_status || 'RESOLVED'
    };
  },

  // Merge approved leaves from leave_requests into attendance logs so approved leaves always show up
  // Merge approved and pending leaves from leave_requests into attendance logs
  async mergeApprovedLeaves(logs) {
    try {
      let leavesList = [];
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('leave_requests')
          .select('*')
          .in('status', ['APPROVED', 'PENDING']);
        if (!error && Array.isArray(data)) {
          leavesList = data;
        }
      }
      if (!leavesList.length) {
        const local = getLocalLeaveRequests();
        if (Array.isArray(local)) {
          leavesList = local.filter(l => {
            const s = (l.status || '').toUpperCase();
            return s === 'APPROVED' || s === 'PENDING';
          });
        }
      }

      if (!leavesList || !leavesList.length) return logs;

      const result = [...logs];

      const getDatesList = (fromStr, toStr) => {
        if (!fromStr) return [];
        const end = toStr || fromStr;
        const list = [];
        try {
          const cur = new Date(fromStr + 'T00:00:00');
          const endDate = new Date(end + 'T00:00:00');
          while (cur <= endDate) {
            const dd = String(cur.getDate()).padStart(2, '0');
            const mm = String(cur.getMonth() + 1).padStart(2, '0');
            const yyyy = cur.getFullYear();
            list.push(`${dd}/${mm}/${yyyy}`);
            cur.setDate(cur.getDate() + 1);
          }
        } catch (e) {}
        return list;
      };

      // Sort so APPROVED leaves are processed before PENDING leaves
      const sortedLeaves = [...leavesList].sort((a, b) => {
        const aStatus = (a.status || '').toUpperCase();
        const bStatus = (b.status || '').toUpperCase();
        if (aStatus === 'APPROVED' && bStatus !== 'APPROVED') return -1;
        if (bStatus === 'APPROVED' && aStatus !== 'APPROVED') return 1;
        return 0;
      });

      sortedLeaves.forEach(leave => {
        const sUpper = (leave.status || 'PENDING').toUpperCase();
        const isApproved = sUpper === 'APPROVED';
        const dates = getDatesList(leave.from_date || leave.fromDate, leave.to_date || leave.toDate);
        const isHalfDay = (leave.leave_type || leave.leaveType || '').toLowerCase().includes('half');
        const leaveStatus = isApproved ? (isHalfDay ? 'Half Day' : 'Leave') : 'Pending Leave';
        const leaveReason = leave.reason ? `: ${leave.reason}` : '';
        const leaveCategory = leave.leave_category || leave.leaveCategory || 'Casual Leave';
        const leaveLocation = isApproved
          ? `Approved Leave (${leaveCategory})${leaveReason}`
          : `Pending Leave (${leaveCategory})${leaveReason}`;
        const targetUserId = (leave.user_id || leave.userId || '').trim().toLowerCase();
        const targetUserName = (leave.user_name || leave.userName || '').trim().toLowerCase();

        dates.forEach(dateStr => {
          const existingIdx = result.findIndex(l => {
            const matchDate = (l.date || '').replace(/-/g, '/') === dateStr.replace(/-/g, '/');
            const matchUser = (targetUserId && (l.userId || '').toLowerCase() === targetUserId) ||
                              (targetUserName && (l.userName || '').trim().toLowerCase() === targetUserName);
            return matchDate && matchUser;
          });

          if (existingIdx >= 0) {
            const ex = result[existingIdx];
            // If already an approved leave, don't overwrite with pending
            if (!isApproved && (ex.isApprovedLeave || (ex.status || '').toUpperCase() === 'LEAVE')) {
              return;
            }
            if (!ex.inTime || ex.inTime === '-' || (ex.status || '').toUpperCase() === 'LEAVE' || (ex.status || '').toUpperCase().includes('PENDING')) {
              result[existingIdx] = {
                ...ex,
                status: leaveStatus,
                locationName: leaveLocation,
                photoUrl: ex.photoUrl || leave.document_url || leave.documentUrl || '',
                isApprovedLeave: isApproved,
                isPendingLeave: !isApproved
              };
            }
          } else {
            const [dd, mm, yyyy] = dateStr.split('/');
            const fakeMs = new Date(`${yyyy}-${mm}-${dd}T09:00:00+05:30`).getTime() || Date.now();
            result.push({
              id: `leave_${leave.id}_${dd}_${mm}_${yyyy}`,
              userId: leave.user_id || leave.userId || '',
              userName: leave.user_name || leave.userName || 'Employee',
              date: dateStr,
              timestamp: `${dateStr} 09:00:00 AM`,
              timestampMs: fakeMs,
              inTime: isApproved && isHalfDay ? '09:00 AM' : '-',
              outTime: '-',
              status: leaveStatus,
              photoUrl: leave.document_url || leave.documentUrl || '',
              outPhotoUrl: '',
              latitude: null,
              longitude: null,
              accuracy: null,
              locationName: leaveLocation,
              geocodingStatus: 'RESOLVED',
              createdAt: leave.created_at || leave.createdAt || new Date().toISOString(),
              updatedAt: leave.updated_at || leave.updatedAt || new Date().toISOString(),
              isApprovedLeave: isApproved,
              isPendingLeave: !isApproved
            });
          }
        });
      });

      return result;
    } catch (e) {
      console.warn('mergeApprovedLeaves error:', e);
      return logs;
    }
  },

  // Fetch all attendance logs (joins users table for user_name, consolidates single-row per user per date)
  async getAttendanceLogs() {
    if (!isSupabaseConfigured) {
      const localLogs = getLocalAttendanceLogs().map(this.mapFromDb);
      const merged = await this.mergeApprovedLeaves(localLogs);
      return this.consolidateSingleDayRows(merged);
    }

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*, users(id, name, username)')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Error fetching attendance logs with users join, trying fallback:', error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('attendance_logs')
          .select('*')
          .order('created_at', { ascending: true });

        if (fallbackError) {
          throw fallbackError;
        }
        const mapped = (fallbackData || []).map(this.mapFromDb);
        const merged = await this.mergeApprovedLeaves(mapped);
        return this.consolidateSingleDayRows(merged);
      }

      const mapped = (data || []).map(this.mapFromDb);
      const merged = await this.mergeApprovedLeaves(mapped);
      return this.consolidateSingleDayRows(merged);
    } catch (err) {
      console.error('Supabase attendance logs fetch error:', err);
      throw err;
    }
  },

  // Save attendance entry (manages record in a single row per user per date)
  async saveAttendanceLog(entry) {
    let finalPhotoUrl = entry.photoUrl || '';

    // Upload base64 photo to Supabase storage bucket if configured
    if (finalPhotoUrl && finalPhotoUrl.startsWith('data:')) {
      try {
        finalPhotoUrl = await this.uploadAttendancePhoto(finalPhotoUrl, entry.userName);
      } catch (uploadErr) {
        console.warn('Photo upload to bucket failed, keeping base64:', uploadErr);
      }
    }

    const isMarkingOut = (entry.status || '').toUpperCase() === 'OUT';

    // Find if user already has an existing attendance log for today
    const allLogs = await this.getAttendanceLogs();
    const entryUserKey = (entry.userId || entry.userName || '').trim().toLowerCase();
    const entryDate = (entry.date || this.getTodayDateIST()).replace(/-/g, '/');

    const existingTodayLog = allLogs.find(l => {
      const logDate = (l.date || '').replace(/-/g, '/');
      const logUserKey = (l.userId || l.userName || '').trim().toLowerCase();
      return logDate === entryDate && logUserKey && logUserKey === entryUserKey;
    });

    const payloadWithPhoto = {
      ...entry,
      photoUrl: isMarkingOut ? (existingTodayLog?.photoUrl || finalPhotoUrl) : finalPhotoUrl,
      outPhotoUrl: isMarkingOut ? finalPhotoUrl : (existingTodayLog?.outPhotoUrl || null),
      inTime: isMarkingOut ? (existingTodayLog?.inTime || entry.inTime || '') : (entry.inTime || entry.timestamp?.split(' ')[1] || ''),
      outTime: isMarkingOut ? (entry.outTime || entry.timestamp?.split(' ')[1] || '') : (existingTodayLog?.outTime || null),
      latitude: !isMarkingOut ? (entry.latitude != null ? entry.latitude : (existingTodayLog?.latitude ?? null)) : (existingTodayLog?.latitude ?? null),
      longitude: !isMarkingOut ? (entry.longitude != null ? entry.longitude : (existingTodayLog?.longitude ?? null)) : (existingTodayLog?.longitude ?? null),
      accuracy: !isMarkingOut ? (entry.accuracy != null ? entry.accuracy : (existingTodayLog?.accuracy ?? null)) : (existingTodayLog?.accuracy ?? null),
      locationName: isMarkingOut ? (existingTodayLog?.locationName || '') : (entry.locationName || ''),
      geocodingStatus: !isMarkingOut ? (entry.geocodingStatus || 'RESOLVED') : (existingTodayLog?.geocodingStatus || 'RESOLVED'),
      outLatitude: isMarkingOut ? (entry.latitude != null ? entry.latitude : (existingTodayLog?.outLatitude ?? null)) : (existingTodayLog?.outLatitude ?? null),
      outLongitude: isMarkingOut ? (entry.longitude != null ? entry.longitude : (existingTodayLog?.outLongitude ?? null)) : (existingTodayLog?.outLongitude ?? null),
      outAccuracy: isMarkingOut ? (entry.accuracy != null ? entry.accuracy : (existingTodayLog?.outAccuracy ?? null)) : (existingTodayLog?.outAccuracy ?? null),
      outLocationName: isMarkingOut ? (entry.locationName || '') : (existingTodayLog?.outLocationName ?? null),
      outGeocodingStatus: isMarkingOut ? (entry.geocodingStatus || 'RESOLVED') : (existingTodayLog?.outGeocodingStatus ?? 'RESOLVED')
    };

    console.groupCollapsed(`📝 [Attendance Log Saved] ${entry.userName || 'User'} marked ${entry.status || 'In'}`);
    console.log('Action:', isMarkingOut ? 'PUNCH OUT' : 'PUNCH IN');
    console.log('Captured IN Location:', {
      latitude: payloadWithPhoto.latitude,
      longitude: payloadWithPhoto.longitude,
      accuracy: payloadWithPhoto.accuracy,
      address: payloadWithPhoto.locationName,
      status: payloadWithPhoto.geocodingStatus,
      mapsUrl: getGoogleMapsUrl(payloadWithPhoto.latitude, payloadWithPhoto.longitude)
    });
    if (isMarkingOut) {
      console.log('Captured OUT Location:', {
        latitude: payloadWithPhoto.outLatitude,
        longitude: payloadWithPhoto.outLongitude,
        accuracy: payloadWithPhoto.outAccuracy,
        address: payloadWithPhoto.outLocationName,
        status: payloadWithPhoto.outGeocodingStatus,
        mapsUrl: getGoogleMapsUrl(payloadWithPhoto.outLatitude, payloadWithPhoto.outLongitude)
      });
    }
    console.log('Complete Payload:', payloadWithPhoto);
    console.groupEnd();

    if (existingTodayLog) {
      payloadWithPhoto.id = existingTodayLog.id;
    }

    if (!isSupabaseConfigured) {
      const saved = saveLocalAttendanceLog(payloadWithPhoto);
      return this.mapFromDb(saved);
    }

    try {
      if (existingTodayLog && existingTodayLog.id) {
        // UPDATE EXISTING ROW (Keep in a SINGLE ROW)
        const updatePayload = {
          status: entry.status || (isMarkingOut ? 'Out' : existingTodayLog.status),
          in_time: payloadWithPhoto.inTime || null,
          out_time: payloadWithPhoto.outTime || null,
          out_photo_url: payloadWithPhoto.outPhotoUrl || null,
          out_location_name: payloadWithPhoto.outLocationName || null
        };
        if (isMarkingOut) {
          if (entry.latitude != null) updatePayload.out_latitude = Number(entry.latitude);
          if (entry.longitude != null) updatePayload.out_longitude = Number(entry.longitude);
          if (entry.accuracy != null) updatePayload.out_accuracy = Number(entry.accuracy);
          updatePayload.out_location_name = entry.locationName || '';
          updatePayload.out_geocoding_status = entry.geocodingStatus || 'RESOLVED';
        } else {
          // If re-marking IN / Half Day, update primary photo & location
          if (finalPhotoUrl) updatePayload.photo_url = finalPhotoUrl;
          if (entry.latitude != null) updatePayload.latitude = Number(entry.latitude);
          if (entry.longitude != null) updatePayload.longitude = Number(entry.longitude);
          if (entry.accuracy != null) updatePayload.accuracy = Number(entry.accuracy);
          updatePayload.location_name = entry.locationName || '';
          updatePayload.geocoding_status = entry.geocodingStatus || 'RESOLVED';
        }

        const { data, error } = await supabase
          .from('attendance_logs')
          .update(updatePayload)
          .eq('id', existingTodayLog.id)
          .select('*, users(id, name, username)')
          .single();

        if (error) {
          // Fallback if extra columns not in Supabase yet
          const fallbackUpdatePayload = { ...updatePayload };
          delete fallbackUpdatePayload.accuracy;
          delete fallbackUpdatePayload.geocoding_status;
          delete fallbackUpdatePayload.out_latitude;
          delete fallbackUpdatePayload.out_longitude;
          delete fallbackUpdatePayload.out_accuracy;
          delete fallbackUpdatePayload.out_geocoding_status;

          const retry = await supabase
            .from('attendance_logs')
            .update(fallbackUpdatePayload)
            .eq('id', existingTodayLog.id)
            .select('*, users(id, name, username)')
            .single();

          if (retry.error) {
            console.error('Error updating existing attendance log on Supabase:', retry.error);
            throw retry.error;
          }
          return this.mapFromDb(retry.data);
        }

        return this.mapFromDb(data);
      } else {
        // INSERT NEW ROW (for IN punch)
        const payload = this.mapToDb(payloadWithPhoto);
        const { data, error } = await supabase
          .from('attendance_logs')
          .insert(payload)
          .select('*, users(id, name, username)')
          .single();

        if (error) {
          // Fallback insert if new columns not yet migrated in Supabase
          const fallbackPayload = { ...payload };
          delete fallbackPayload.accuracy;
          delete fallbackPayload.geocoding_status;
          delete fallbackPayload.out_accuracy;
          delete fallbackPayload.out_geocoding_status;

          const retry = await supabase
            .from('attendance_logs')
            .insert(fallbackPayload)
            .select('*, users(id, name, username)')
            .single();

          if (retry.error) {
            console.error('Error inserting attendance log to Supabase:', retry.error);
            throw retry.error;
          }
          return this.mapFromDb(retry.data);
        }

        return this.mapFromDb(data);
      }
    } catch (err) {
      console.error('Attendance save failed on Supabase:', err);
      throw err;
    }
  },

  // Update attendance IN / OUT time
async updateAttendanceLog(id, updatedFields) {
  if (!id) {
    throw new Error('Attendance ID is required');
  }

  const updatePayload = {};

  if (updatedFields.inTime !== undefined) {
    updatePayload.in_time = updatedFields.inTime || null;
  }

  if (updatedFields.outTime !== undefined) {
    updatePayload.out_time = updatedFields.outTime || null;
  }

  // Automatically track when attendance was edited
  updatePayload.updated_at = new Date().toISOString();

  // Local storage fallback
  if (!isSupabaseConfigured) {
    const localLogs = getLocalAttendanceLogs();

    const existing = localLogs.find(
      log => String(log.id) === String(id)
    );

    if (!existing) {
      throw new Error('Attendance record not found');
    }

    const updated = {
      ...existing,
      in_time: updatePayload.in_time ?? existing.in_time,
      out_time: updatePayload.out_time ?? existing.out_time,
      updated_at: updatePayload.updated_at
    };
    console.log(`Attendance log with ID ${id} updated locally:`, updated);

    saveLocalAttendanceLog(updated);


    return this.mapFromDb(updated);
  }

  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .update(updatePayload)
      .eq('id', id)
      .select('*, users(id, name, username)')
      .single();

    if (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }

    return this.mapFromDb(data);

  } catch (err) {
    console.error('Attendance update failed:', err);
    throw err;
  }
},

  // Delete attendance entry
  async deleteAttendanceLog(id) {
    if (!isSupabaseConfigured) {
      return deleteLocalAttendanceLog(id);
    }

    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting attendance log from Supabase:', error);
      throw error;
    }

    return true;
  },

  // 1. Search for nearby cached location (localStorage first, then Supabase location_cache within configurable 100-150m radius)
  async findNearbyLocationInCache(lat, lng, radiusMeters = 150) {
    if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) return null;
    const numLat = Number(lat);
    const numLng = Number(lng);

    // Step A: Check localStorage cache first
    try {
      const localCache = getLocalLocationCache();
      if (Array.isArray(localCache) && localCache.length > 0) {
        let closest = null;
        let minDistance = Infinity;

        for (const item of localCache) {
          if (
            item &&
            item.latitude != null &&
            item.longitude != null &&
            !isNaN(Number(item.latitude)) &&
            !isNaN(Number(item.longitude)) &&
            !isRawCoordinatesOrEmpty(item.address)
          ) {
            const dist = calculateDistanceMeters(numLat, numLng, Number(item.latitude), Number(item.longitude));
            if (dist <= radiusMeters && dist < minDistance) {
              minDistance = dist;
              closest = {
                latitude: Number(item.latitude),
                longitude: Number(item.longitude),
                address: String(item.address).trim(),
                accuracy: item.accuracy != null ? Number(item.accuracy) : null,
                distance: dist,
                source: 'local_cache'
              };
            }
          }
        }

        if (closest) {
          console.log(`🎯 [Cache HIT - LocalStorage] Found address within ${Math.round(closest.distance)}m (${radiusMeters}m limit):`, closest.address);
          return closest;
        }
      }
    } catch (err) {
      console.warn('Error reading localStorage location cache:', err);
    }

    // Step B: Check Supabase location_cache table if configured
    if (isSupabaseConfigured) {
      try {
        // Bounding box pre-filter (~330m) to reduce data fetched
        const latDelta = 0.003;
        const lngDelta = 0.003;

        const { data, error } = await supabase
          .from('location_cache')
          .select('id, latitude, longitude, address, accuracy')
          .gte('latitude', numLat - latDelta)
          .lte('latitude', numLat + latDelta)
          .gte('longitude', numLng - lngDelta)
          .lte('longitude', numLng + lngDelta)
          .limit(30);

        if (!error && Array.isArray(data) && data.length > 0) {
          let closest = null;
          let minDistance = Infinity;

          for (const item of data) {
            if (
              item &&
              item.latitude != null &&
              item.longitude != null &&
              !isNaN(Number(item.latitude)) &&
              !isNaN(Number(item.longitude)) &&
              !isRawCoordinatesOrEmpty(item.address)
            ) {
              const dist = calculateDistanceMeters(numLat, numLng, Number(item.latitude), Number(item.longitude));
              if (dist <= radiusMeters && dist < minDistance) {
                minDistance = dist;
                closest = {
                  latitude: Number(item.latitude),
                  longitude: Number(item.longitude),
                  address: String(item.address).trim(),
                  accuracy: item.accuracy != null ? Number(item.accuracy) : null,
                  distance: dist,
                  source: 'supabase_cache'
                };
              }
            }
          }

          if (closest) {
            console.log(`🎯 [Cache HIT - Supabase] Found address within ${Math.round(closest.distance)}m (${radiusMeters}m limit):`, closest.address);
            // Populate localStorage cache as well for offline/faster future lookups
            try {
              addLocalLocationCacheEntry({
                latitude: closest.latitude,
                longitude: closest.longitude,
                address: closest.address,
                accuracy: closest.accuracy
              });
            } catch (e) {}
            return closest;
          }
        }
      } catch (err) {
        console.warn('Error reading Supabase location_cache table:', err);
      }
    }

    return null;
  },

  // 2. Save resolved location to cache (both Supabase and localStorage)
  async saveLocationToCache(lat, lng, address, accuracy = null) {
    if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) return;
    if (isRawCoordinatesOrEmpty(address)) return;

    const numLat = Number(lat);
    const numLng = Number(lng);
    const numAcc = accuracy != null && !isNaN(Number(accuracy)) ? Number(accuracy) : null;
    const cleanAddress = String(address).trim();

    // Save to localStorage
    try {
      addLocalLocationCacheEntry({
        latitude: numLat,
        longitude: numLng,
        address: cleanAddress,
        accuracy: numAcc
      });
    } catch (e) {
      console.warn('Error saving to localStorage location cache:', e);
    }

    // Save to Supabase location_cache table
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('location_cache')
          .insert({
            latitude: numLat,
            longitude: numLng,
            address: cleanAddress,
            accuracy: numAcc
          });
      } catch (err) {
        console.warn('Could not save to Supabase location_cache table:', err);
      }
    }
  },

  // 3. Direct Nominatim reverse geocode call
  async reverseGeocodeNominatim(lat, lng) {
    if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) return null;
    const startTime = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${Number(lat)}&lon=${Number(lng)}&zoom=18&addressdetails=1`;

    console.group(`🌐 [Nominatim Reverse Geocoding] Coordinates: (${lat}, ${lng})`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'SarvodayaLeadManagementApp/1.0'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!res.ok) throw new Error(`Nominatim HTTP status: ${res.status} ${res.statusText}`);
      const data = await res.json();
      console.log(`⏱️ Nominatim response received (${durationMs}ms):`, data?.display_name);
      console.groupEnd();

      if (data && data.display_name && !isRawCoordinatesOrEmpty(data.display_name)) {
        return data.display_name;
      }
      return null;
    } catch (err) {
      console.warn('❌ Nominatim reverse geocode call failed:', err);
      console.groupEnd();
      return null;
    }
  },

  // 4. Location Address Resolution Pipeline
  // Order: 1. Cache (150m) -> 2. Nominatim -> 3. Final Cache -> 4. Pending (Coordinates preserved)
  async resolveLocationAddress(lat, lng, accuracy = null, radiusMeters = 150) {
    console.group(`🎯 [Location Resolution Pipeline] Lat: ${lat}, Lng: ${lng}, Radius: ${radiusMeters}m`);
    console.log('🗺️ View exact coordinates on Google Maps:', getGoogleMapsUrl(lat, lng));

    if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
      console.warn('⚠️ Missing coordinates');
      console.groupEnd();
      return {
        address: '',
        geocodingStatus: 'RESOLVED',
        source: 'none',
        isFallback: false
      };
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    // Step 1: Check existing location cache (localStorage first, then Supabase location_cache within 150m)
    try {
      const cached = await this.findNearbyLocationInCache(numLat, numLng, radiusMeters);
      if (cached && cached.address && !isRawCoordinatesOrEmpty(cached.address)) {
        console.log(`🎉 [Cache HIT] Reusing address from ${cached.source}:`, cached.address);
        saveLastResolvedAddress({
          address: cached.address,
          latitude: numLat,
          longitude: numLng,
          accuracy
        });
        console.groupEnd();
        return {
          address: cached.address,
          geocodingStatus: 'RESOLVED',
          source: cached.source || 'cache',
          isFallback: false
        };
      }
    } catch (cacheErr) {
      console.warn('Cache lookup failed:', cacheErr);
    }

    // Step 2: If neither cache produces a valid nearby address, call Nominatim
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      console.log('🚀 Calling Nominatim reverse geocoding API...');
      try {
        const nominatimAddress = await this.reverseGeocodeNominatim(numLat, numLng);
        if (nominatimAddress && !isRawCoordinatesOrEmpty(nominatimAddress)) {
          console.log('🎉 [Nominatim SUCCESS] Address resolved:', nominatimAddress);
          // Save to shared cache & local storage
          await this.saveLocationToCache(numLat, numLng, nominatimAddress, accuracy);
          saveLastResolvedAddress({
            address: nominatimAddress,
            latitude: numLat,
            longitude: numLng,
            accuracy
          });
          console.groupEnd();
          return {
            address: nominatimAddress,
            geocodingStatus: 'RESOLVED',
            source: 'nominatim',
            isFallback: false
          };
        } else {
          console.warn('⚠️ Nominatim did not return a usable address.');
        }
      } catch (nomErr) {
        console.warn('Nominatim resolution failed:', nomErr);
      }
    }

    // Step 3: If Nominatim fails, perform a final nearby-cache lookup to handle concurrent updates / race conditions
    try {
      const finalCheck = await this.findNearbyLocationInCache(numLat, numLng, radiusMeters);
      if (finalCheck && finalCheck.address && !isRawCoordinatesOrEmpty(finalCheck.address)) {
        console.log(`🎉 [Final Cache Check HIT]:`, finalCheck.address);
        console.groupEnd();
        return {
          address: finalCheck.address,
          geocodingStatus: 'RESOLVED',
          source: finalCheck.source || 'cache',
          isFallback: false
        };
      }
    } catch (finalCheckErr) {
      console.warn('Final cache check failed:', finalCheckErr);
    }

    // Step 4: No valid human-readable address available.
    // Preserve current GPS coordinates and keep address resolution pending.
    console.log('⚠️ [Fallback] Unable to resolve address. Preserving GPS coordinates with PENDING status.');
    console.groupEnd();
    return {
      address: '',
      geocodingStatus: 'PENDING',
      source: 'coordinates',
      isFallback: true
    };
  },

  // Backward compatible reverseGeocode method returning address string
  async reverseGeocode(lat, lng, accuracy = null) {
    const result = await this.resolveLocationAddress(lat, lng, accuracy);
    return result.address;
  },

  // Controlled retry for pending geocoding records (e.g. when back online)
  async retryPendingGeocoding(onSuccessCallback = null) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (this._isRetrying) return;
    this._isRetrying = true;

    console.groupCollapsed('🔄 [Location Service] Retrying pending geocoding records...');

    try {
      if (isSupabaseConfigured) {
        // Query pending attendance_logs from Supabase
        const { data: pendingLogs, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .or('geocoding_status.eq.PENDING,out_geocoding_status.eq.PENDING')
          .limit(10);

        if (!error && Array.isArray(pendingLogs) && pendingLogs.length > 0) {
          console.log(`Found ${pendingLogs.length} pending records in Supabase to resolve`);
          let updatedCount = 0;

          for (const log of pendingLogs) {
            const updates = {};

            // Retry IN punch location
            if (log.geocoding_status === 'PENDING' && log.latitude != null && log.longitude != null) {
              const res = await this.resolveLocationAddress(log.latitude, log.longitude, log.accuracy);
              if (res.geocodingStatus === 'RESOLVED') {
                updates.location_name = res.address;
                updates.geocoding_status = 'RESOLVED';
              }
            }

            // Retry OUT punch location
            if (log.out_geocoding_status === 'PENDING') {
              const outLat = log.out_latitude != null ? log.out_latitude : log.latitude;
              const outLng = log.out_longitude != null ? log.out_longitude : log.longitude;
              if (outLat != null && outLng != null) {
                const res = await this.resolveLocationAddress(outLat, outLng, log.out_accuracy || log.accuracy);
                if (res.geocodingStatus === 'RESOLVED') {
                  updates.out_location_name = res.address;
                  updates.out_geocoding_status = 'RESOLVED';
                }
              }
            }

            if (Object.keys(updates).length > 0) {
              updates.updated_at = new Date().toISOString();
              const { error: updateError } = await supabase
                .from('attendance_logs')
                .update(updates)
                .eq('id', log.id);

              if (!updateError) {
                updatedCount++;
              }
            }
          }

          console.log(`Successfully updated ${updatedCount} records in Supabase`);
          if (updatedCount > 0 && typeof onSuccessCallback === 'function') {
            onSuccessCallback();
          }
        } else {
          console.log('No pending Supabase records found.');
        }
      }

      // Local-only mode: process pending records in local storage
      const localLogs = isSupabaseConfigured ? [] : getLocalAttendanceLogs();
      let localModified = false;
      for (const log of localLogs) {
        if (log.geocoding_status === 'PENDING' && log.latitude != null && log.longitude != null) {
          const res = await this.resolveLocationAddress(log.latitude, log.longitude, log.accuracy);
          if (res.geocodingStatus === 'RESOLVED') {
            log.location_name = res.address;
            log.geocoding_status = 'RESOLVED';
            localModified = true;
          }
        }
        const isPendingOut = (log.out_geocoding_status === 'PENDING' || log.outGeocodingStatus === 'PENDING');
        const outLat = log.out_latitude != null ? log.out_latitude : (log.outLatitude != null ? log.outLatitude : log.latitude);
        const outLng = log.out_longitude != null ? log.out_longitude : (log.outLongitude != null ? log.outLongitude : log.longitude);
        if (isPendingOut && outLat != null && outLng != null) {
          const res = await this.resolveLocationAddress(outLat, outLng, log.out_accuracy || log.outAccuracy || log.accuracy);
          if (res.geocodingStatus === 'RESOLVED') {
            log.out_location_name = res.address;
            log.outLocationName = res.address;
            log.out_geocoding_status = 'RESOLVED';
            log.outGeocodingStatus = 'RESOLVED';
            localModified = true;
          }
        }
      }
      if (localModified) {
        saveLocalAttendanceLogs(localLogs);
        console.log('Updated pending records in local storage.');
        if (typeof onSuccessCallback === 'function') {
          onSuccessCallback();
        }
      }
    } catch (err) {
      console.warn('⚠️ retryPendingGeocoding error:', err);
    } finally {
      console.groupEnd();
      this._isRetrying = false;
    }
  },

  // Get current date in IST (Asia/Kolkata) formatted as DD/MM/YYYY
  getTodayDateIST() {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date());
  },

  // Check if an attendance record was marked today in IST
  isLogFromTodayIST(log) {
    if (!log) return false;
    const todayIST = this.getTodayDateIST();
    if (log.date && log.date.replace(/-/g, '/') === todayIST.replace(/-/g, '/')) {
      return true;
    }
    const ts = log.timestampMs || log.createdAt;
    if (ts) {
      try {
        const logDate = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(new Date(ts));
        if (logDate === todayIST) return true;
      } catch (e) { }
    }
    return false;
  },

  // Evaluate user's punches today (IST) and return allowed options and locked state
  getUserTodayAttendanceStatus(logs, user) {
    const todayDate = this.getTodayDateIST();
    if (!user || !Array.isArray(logs)) {
      return {
        todayDate,
        hasMarkedIn: false,
        hasMarkedOut: false,
        hasMarkedHalfDay: false,
        isOnLeave: false,
        isLocked: false,
        allowedStatuses: ['In', 'Half Day'],
        defaultStatus: 'In',
        message: ''
      };
    }

    const currentUserId = user.dbId || user.id;
    const currentUserName = (user.name || '').trim().toLowerCase();

    // Filter logs for this user recorded today in IST
    const userTodayLogs = logs.filter(l => {
      const matchId = (
        (user.dbId && l.userId === user.dbId) ||
        (user.id && l.userId === user.id) ||
        (currentUserId && l.userId === currentUserId)
      );
      const matchName = currentUserName && l.userName && l.userName.trim().toLowerCase() === currentUserName;
      return (matchId || matchName) && this.isLogFromTodayIST(l);
    });

    const isOnLeave = userTodayLogs.some(l => 
      (l.status || '').toUpperCase() === 'LEAVE' || (l.status || '').toUpperCase() === 'ON LEAVE'
    );
    const hasMarkedOut = userTodayLogs.some(l => 
      (l.status || '').toUpperCase() === 'OUT' || (l.outTime && l.outTime !== '-' && l.outTime !== '')
    );
    const hasMarkedIn = userTodayLogs.some(l => 
      (l.status || '').toUpperCase() === 'IN' || (l.inTime && l.inTime !== '-' && l.inTime !== '')
    );
    const hasMarkedHalfDay = userTodayLogs.some(l => 
      (l.status || '').toUpperCase() === 'HALF DAY'
    );

    // Rule 0: If on approved full-day leave today, punches are locked
    if (isOnLeave) {
      return {
        todayDate,
        hasMarkedIn: false,
        hasMarkedOut: false,
        hasMarkedHalfDay: false,
        isOnLeave: true,
        isLocked: true,
        allowedStatuses: [],
        defaultStatus: '',
        message: 'You have an approved leave for today.'
      };
    }

    // Rule 1: If already marked OUT today, no further In/Out/Half Day punches are permitted today
    if (hasMarkedOut) {
      return {
        todayDate,
        hasMarkedIn,
        hasMarkedOut: true,
        hasMarkedHalfDay,
        isOnLeave: false,
        isLocked: true,
        allowedStatuses: [],
        defaultStatus: '',
        message: 'You have already marked OUT today. Next check-in opens tomorrow after 12:00 AM IST.'
      };
    }

    // Rule 2: If already marked IN today, cannot mark IN again; only Half Day or OUT is permitted
    if (hasMarkedIn) {
      const allowedStatuses = hasMarkedHalfDay ? ['Out'] : ['Out', 'Half Day'];
      return {
        todayDate,
        hasMarkedIn: true,
        hasMarkedOut: false,
        hasMarkedHalfDay,
        isLocked: false,
        allowedStatuses,
        defaultStatus: 'Out',
        message: 'You have already marked IN today. You can mark Half Day or OUT.'
      };
    }

    // If marked Half Day directly without IN, they can mark OUT when leaving
    if (hasMarkedHalfDay) {
      return {
        todayDate,
        hasMarkedIn: false,
        hasMarkedOut: false,
        hasMarkedHalfDay: true,
        isLocked: false,
        allowedStatuses: ['Out'],
        defaultStatus: 'Out',
        message: 'You have marked Half Day today. You can mark OUT when leaving.'
      };
    }

    // Default: fresh day, can mark IN or Half Day
    return {
      todayDate,
      hasMarkedIn: false,
      hasMarkedOut: false,
      hasMarkedHalfDay: false,
      isLocked: false,
      allowedStatuses: ['In', 'Half Day'],
      defaultStatus: 'In',
      message: ''
    };
  }


};

