import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getAttendanceLogs as getLocalAttendanceLogs,
  saveAttendanceLog as saveLocalAttendanceLog,
  deleteAttendanceLog as deleteLocalAttendanceLog
} from '../utils/storageManager';

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
        }

        grouped.set(groupKey, {
          ...existing,
          inTime: inTime || existing.inTime || '',
          outTime: outTime || existing.outTime || '',
          outPhotoUrl: existing.outPhotoUrl || (statusUpper === 'OUT' ? log.photoUrl : ''),
          outLocationName: existing.outLocationName || (statusUpper === 'OUT' ? log.locationName : ''),
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
    const statusUpper = (row.status || '').toUpperCase();
    const inTime = row.in_time || row.inTime || (statusUpper === 'IN' || statusUpper === 'HALF DAY' ? fallbackTime : (statusUpper === 'OUT' ? null : fallbackTime));
    const outTime = row.out_time || row.outTime || (statusUpper === 'OUT' ? fallbackTime : null);

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
      status: row.status || 'In',
      photoUrl: row.photo_url || row.photoUrl || '',
      outPhotoUrl: row.out_photo_url || row.outPhotoUrl || '',
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
      locationName: row.location_name || row.locationName || row.location || '',
      outLocationName: row.out_location_name || row.outLocationName || '',
      createdAt: row.created_at || row.createdAt
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
      location_name: entry.locationName || entry.location || '',
      out_location_name: entry.outLocationName || null
    };
  },

  // Fetch all attendance logs (joins users table for user_name, consolidates single-row per user per date)
  async getAttendanceLogs() {
    if (!isSupabaseConfigured) {
      const localLogs = getLocalAttendanceLogs().map(this.mapFromDb);
      return this.consolidateSingleDayRows(localLogs);
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
          console.warn('Fallback error fetching attendance logs from Supabase:', fallbackError);
          const localLogs = getLocalAttendanceLogs().map(this.mapFromDb);
          return this.consolidateSingleDayRows(localLogs);
        }
        const mapped = (fallbackData || []).map(this.mapFromDb);
        return this.consolidateSingleDayRows(mapped);
      }

      const mapped = (data || []).map(this.mapFromDb);
      return this.consolidateSingleDayRows(mapped);
    } catch (err) {
      console.warn('Supabase attendance logs fetch error:', err);
      const localLogs = getLocalAttendanceLogs().map(this.mapFromDb);
      return this.consolidateSingleDayRows(localLogs);
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
      locationName: isMarkingOut ? (existingTodayLog?.locationName || entry.locationName) : entry.locationName,
      outLocationName: isMarkingOut ? entry.locationName : (existingTodayLog?.outLocationName || null)
    };

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
        // If re-marking IN / Half Day, update primary photo & location
        if (!isMarkingOut) {
          if (finalPhotoUrl) updatePayload.photo_url = finalPhotoUrl;
          if (entry.locationName) updatePayload.location_name = entry.locationName;
          if (entry.latitude != null) updatePayload.latitude = Number(entry.latitude);
          if (entry.longitude != null) updatePayload.longitude = Number(entry.longitude);
        }

        const { data, error } = await supabase
          .from('attendance_logs')
          .update(updatePayload)
          .eq('id', existingTodayLog.id)
          .select('*, users(id, name, username)')
          .single();

        if (error) {
          console.warn('Error updating existing attendance log on Supabase, falling back to local:', error);
          const savedLocal = saveLocalAttendanceLog(payloadWithPhoto);
          return this.mapFromDb(savedLocal);
        }

        const updated = this.mapFromDb(data);
        saveLocalAttendanceLog(updated);
        return updated;
      } else {
        // INSERT NEW ROW (for IN punch)
        const payload = this.mapToDb(payloadWithPhoto);
        const { data, error } = await supabase
          .from('attendance_logs')
          .insert(payload)
          .select('*, users(id, name, username)')
          .single();

        if (error) {
          console.warn('Error inserting attendance log to Supabase, saving locally:', error);
          const createdLocal = saveLocalAttendanceLog(payloadWithPhoto);
          return this.mapFromDb(createdLocal);
        }

        const created = this.mapFromDb(data);
        saveLocalAttendanceLog(created);
        return created;
      }
    } catch (err) {
      console.warn('Attendance save failed on Supabase:', err);
      const createdLocal = saveLocalAttendanceLog(payloadWithPhoto);
      return this.mapFromDb(createdLocal);
    }
  },

  // Delete attendance entry
  async deleteAttendanceLog(id) {
    if (!isSupabaseConfigured) {
      return deleteLocalAttendanceLog(id);
    }

    try {
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Error deleting attendance log from Supabase:', error);
      }
    } catch (err) {
      console.warn('Supabase attendance delete error:', err);
    }

    deleteLocalAttendanceLog(id);
    return true;
  },

  // Reverse geocoding helper via OpenStreetMap Nominatim API
  async reverseGeocode(lat, lng) {
    if (!lat || !lng) return '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'en' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Geocoding request failed');
      const data = await res.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (e) {
      console.warn('Reverse geocode error:', e);
      return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
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

    const hasMarkedOut = userTodayLogs.some(l => 
      (l.status || '').toUpperCase() === 'OUT' || (l.outTime && l.outTime !== '-' && l.outTime !== '')
    );
    const hasMarkedIn = userTodayLogs.some(l => 
      (l.status || '').toUpperCase() === 'IN' || (l.inTime && l.inTime !== '-' && l.inTime !== '')
    );
    const hasMarkedHalfDay = userTodayLogs.some(l => 
      (l.status || '').toUpperCase() === 'HALF DAY'
    );

    // Rule 1: If already marked OUT today, no further In/Out/Half Day punches are permitted today
    if (hasMarkedOut) {
      return {
        todayDate,
        hasMarkedIn,
        hasMarkedOut: true,
        hasMarkedHalfDay,
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

