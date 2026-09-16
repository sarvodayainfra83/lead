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

  // Map DB row -> Frontend Attendance model
  mapFromDb(row) {
    const joinedUser = row.users || {};
    return {
      id: row.id,
      serialNo: row.serial_no || row.serialNo,
      userId: row.user_id || joinedUser.id || row.userId || '',
      userName: joinedUser.name || row.user_name || row.userName || row.name || '',
      date: row.date || '',
      timestamp: row.timestamp || '',
      timestampMs: row.timestamp_ms ? Number(row.timestamp_ms) : (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      status: row.status || 'In',
      photoUrl: row.photo_url || row.photoUrl || '',
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
      locationName: row.location_name || row.locationName || row.location || '',
      createdAt: row.created_at || row.createdAt
    };
  },

  // Map Frontend Attendance model -> DB row (user_name and timestamp_ms removed from table)
  mapToDb(entry) {
    return {
      user_id: entry.userId || null,
      date: entry.date || '',
      timestamp: entry.timestamp || '',
      status: entry.status || 'In',
      photo_url: entry.photoUrl || '',
      latitude: entry.latitude !== null && entry.latitude !== undefined ? Number(entry.latitude) : null,
      longitude: entry.longitude !== null && entry.longitude !== undefined ? Number(entry.longitude) : null,
      location_name: entry.locationName || entry.location || ''
    };
  },

  // Fetch all attendance logs (joins users table for user_name)
  async getAttendanceLogs() {
    if (!isSupabaseConfigured) {
      return getLocalAttendanceLogs().map(this.mapFromDb);
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
          return getLocalAttendanceLogs().map(this.mapFromDb);
        }
        return (fallbackData || []).map((row, idx) => ({
          ...this.mapFromDb(row),
          serialNo: idx + 1
        }));
      }

      return (data || []).map((row, idx) => ({
        ...this.mapFromDb(row),
        serialNo: idx + 1
      }));
    } catch (err) {
      console.warn('Supabase attendance logs fetch error:', err);
      return getLocalAttendanceLogs().map(this.mapFromDb);
    }
  },

  // Save attendance entry (with photo upload to bucket & coordinates)
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

    const payloadWithPhoto = {
      ...entry,
      photoUrl: finalPhotoUrl
    };

    if (!isSupabaseConfigured) {
      const created = saveLocalAttendanceLog(payloadWithPhoto);
      return this.mapFromDb(created);
    }

    try {
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

    const hasMarkedOut = userTodayLogs.some(l => (l.status || '').toUpperCase() === 'OUT');
    const hasMarkedIn = userTodayLogs.some(l => (l.status || '').toUpperCase() === 'IN');
    const hasMarkedHalfDay = userTodayLogs.some(l => (l.status || '').toUpperCase() === 'HALF DAY');

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

