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

  // Map DB row -> Frontend Attendance model
  mapFromDb(row) {
    return {
      id: row.id,
      serialNo: row.serial_no || row.serialNo,
      userId: row.user_id || row.userId || '',
      userName: row.user_name || row.userName || row.name || '',
      date: row.date || '',
      timestamp: row.timestamp || '',
      timestampMs: Number(row.timestamp_ms || row.timestampMs || Date.now()),
      status: row.status || 'In',
      photoUrl: row.photo_url || row.photoUrl || '',
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
      locationName: row.location_name || row.locationName || row.location || '',
      createdAt: row.created_at || row.createdAt
    };
  },

  // Map Frontend Attendance model -> DB row
  mapToDb(entry) {
    return {
      user_id: entry.userId || null,
      user_name: entry.userName || entry.name || '',
      date: entry.date || '',
      timestamp: entry.timestamp || '',
      timestamp_ms: entry.timestampMs || Date.now(),
      status: entry.status || 'In',
      photo_url: entry.photoUrl || '',
      latitude: entry.latitude !== null && entry.latitude !== undefined ? Number(entry.latitude) : null,
      longitude: entry.longitude !== null && entry.longitude !== undefined ? Number(entry.longitude) : null,
      location_name: entry.locationName || entry.location || ''
    };
  },

  // Fetch all attendance logs
  async getAttendanceLogs() {
    if (!isSupabaseConfigured) {
      return getLocalAttendanceLogs().map(this.mapFromDb);
    }

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .order('timestamp_ms', { ascending: true });

      if (error) {
        console.warn('Error fetching attendance logs from Supabase, falling back locally:', error);
        return getLocalAttendanceLogs().map(this.mapFromDb);
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
        .select()
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
  }
};

