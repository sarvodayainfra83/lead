import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getAttendanceLogs as getLocalAttendanceLogs,
  saveAttendanceLogs as saveLocalAttendanceLogs,
  saveAttendanceLog as saveLocalAttendanceLog,
  deleteAttendanceLog as deleteLocalAttendanceLog,
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
  if (!s || s === '-' || s === 'location unavailable' || s === 'current location') return true;
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
        }

        grouped.set(groupKey, {
          ...existing,
          inTime: inTime || existing.inTime || '',
          outTime: outTime || existing.outTime || '',
          outPhotoUrl: existing.outPhotoUrl || (statusUpper === 'OUT' ? log.photoUrl : ''),
          outLocationName: existing.outLocationName || (statusUpper === 'OUT' ? log.locationName : ''),
          outLatitude: existing.outLatitude || (statusUpper === 'OUT' ? (log.outLatitude || log.latitude) : existing.outLatitude),
          outLongitude: existing.outLongitude || (statusUpper === 'OUT' ? (log.outLongitude || log.longitude) : existing.outLongitude),
          outAccuracy: existing.outAccuracy || (statusUpper === 'OUT' ? (log.outAccuracy || log.accuracy) : existing.outAccuracy),
          outGeocodingStatus: existing.outGeocodingStatus || (statusUpper === 'OUT' ? (log.outGeocodingStatus || log.geocodingStatus) : existing.outGeocodingStatus),
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
      latitude: !isMarkingOut ? (entry.latitude != null ? entry.latitude : existingTodayLog?.latitude) : (existingTodayLog?.latitude || entry.latitude),
      longitude: !isMarkingOut ? (entry.longitude != null ? entry.longitude : existingTodayLog?.longitude) : (existingTodayLog?.longitude || entry.longitude),
      accuracy: !isMarkingOut ? (entry.accuracy != null ? entry.accuracy : existingTodayLog?.accuracy) : (existingTodayLog?.accuracy || entry.accuracy),
      locationName: isMarkingOut ? (existingTodayLog?.locationName || entry.locationName) : entry.locationName,
      geocodingStatus: !isMarkingOut ? (entry.geocodingStatus || 'RESOLVED') : (existingTodayLog?.geocodingStatus || 'RESOLVED'),
      outLatitude: isMarkingOut ? (entry.latitude != null ? entry.latitude : (existingTodayLog?.outLatitude || null)) : (existingTodayLog?.outLatitude || null),
      outLongitude: isMarkingOut ? (entry.longitude != null ? entry.longitude : (existingTodayLog?.outLongitude || null)) : (existingTodayLog?.outLongitude || null),
      outAccuracy: isMarkingOut ? (entry.accuracy != null ? entry.accuracy : null) : (existingTodayLog?.outAccuracy || null),
      outLocationName: isMarkingOut ? entry.locationName : (existingTodayLog?.outLocationName || null),
      outGeocodingStatus: isMarkingOut ? (entry.geocodingStatus || 'RESOLVED') : (existingTodayLog?.outGeocodingStatus || 'RESOLVED')
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
          if (entry.geocodingStatus) updatePayload.out_geocoding_status = entry.geocodingStatus;
        } else {
          // If re-marking IN / Half Day, update primary photo & location
          if (finalPhotoUrl) updatePayload.photo_url = finalPhotoUrl;
          if (entry.locationName) updatePayload.location_name = entry.locationName;
          if (entry.latitude != null) updatePayload.latitude = Number(entry.latitude);
          if (entry.longitude != null) updatePayload.longitude = Number(entry.longitude);
          if (entry.accuracy != null) updatePayload.accuracy = Number(entry.accuracy);
          if (entry.geocodingStatus) updatePayload.geocoding_status = entry.geocodingStatus;
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
            console.warn('Error updating existing attendance log on Supabase, falling back to local:', retry.error);
            const savedLocal = saveLocalAttendanceLog(payloadWithPhoto);
            return this.mapFromDb(savedLocal);
          }
          const updated = this.mapFromDb(retry.data);
          saveLocalAttendanceLog({ ...updated, ...payloadWithPhoto });
          return updated;
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
            console.warn('Error inserting attendance log to Supabase, saving locally:', retry.error);
            const createdLocal = saveLocalAttendanceLog(payloadWithPhoto);
            return this.mapFromDb(createdLocal);
          }
          const created = this.mapFromDb(retry.data);
          saveLocalAttendanceLog({ ...created, ...payloadWithPhoto });
          return created;
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

    const updated = this.mapFromDb(data);

    // Keep local cache in sync
    saveLocalAttendanceLog(updated);

    return updated;

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

  // 1. Search for nearby cached location (BLOCKED FOR TESTING - ALWAYS CALLS EXTERNAL API)
  async findNearbyLocationInCache(lat, lng, radiusMeters = 100) {
    console.log('🚫 [Location Cache BYPASSED] Location cache lookup disabled for testing. Query will go directly to OpenStreetMap API.');
    return null;
  },

  // 2. Save resolved location to cache (BLOCKED FOR TESTING)
  async saveLocationToCache(lat, lng, address, accuracy = null) {
    console.log('🚫 [Location Cache BYPASSED] Saving to cache is currently disabled for testing.');
  },

  // 3. Direct LocationIQ reverse geocode call (Primary External Service)
  async reverseGeocodeLocationIQ(lat, lng) {
    if (lat == null || lng == null) return null;
    const startTime = Date.now();
    const apiKey = import.meta.env.VITE_LOCATIONIQ_API_KEY || 'pk.1adde45db2f5ae1b33dd981425f6db1a';
    const url = `https://us1.locationiq.com/v1/reverse?key=${apiKey}&lat=${lat}&lon=${lng}&format=json&addressdetails=1&normalizeaddress=1`;

    console.group(`🌐 [LocationIQ API Request] Fetching exact address for Coordinates: (${lat}, ${lng})`);
    console.log('📡 Endpoint URL:', url);
    console.log('🎯 Parameters:', { latitude: lat, longitude: lng, format: 'json', addressdetails: 1, normalizeaddress: 1 });
    console.log('🗺️ View exact location on Google Maps:', getGoogleMapsUrl(lat, lng));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      console.log(`⏱️ HTTP Response Status: ${res.status} ${res.statusText} (${durationMs}ms)`);

      if (!res.ok) throw new Error(`LocationIQ HTTP status: ${res.status} ${res.statusText}`);
      const data = await res.json();

      console.log('📦 Complete Raw Response JSON from LocationIQ:', data);

      // Build structured human-readable address
      const addr = data.address || {};
      const specific = addr.name || addr.amenity || addr.shop || addr.building || '';
      const street = addr.road || addr.street || '';
      const neighbourhood = addr.neighbourhood || addr.suburb || addr.residential || '';
      const city = addr.city || addr.town || addr.village || '';
      const county = addr.county || '';
      const state = addr.state || '';
      const postcode = addr.postcode || '';
      const country = addr.country || '';

      const parts = [];
      if (specific) parts.push(specific);
      if (street && !parts.includes(street)) parts.push(street);
      if (neighbourhood && !parts.includes(neighbourhood)) parts.push(neighbourhood);
      if (city && !parts.includes(city)) parts.push(city);
      if (county && !parts.includes(county) && !county.toLowerCase().includes(city.toLowerCase())) parts.push(county);
      if (state && !parts.includes(state)) parts.push(state);
      if (postcode) parts.push(postcode);
      if (country && !parts.includes(country)) parts.push(country);

      const resolvedAddress = parts.length > 0 ? parts.join(', ') : (data.display_name || null);

      console.log('📍 Extracted Full Address:', resolvedAddress);
      console.log('🏠 Breakdown of Address Components:');
      if (data?.address) {
        console.table(data.address);
      }
      console.groupEnd();

      return resolvedAddress;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      console.error(`❌ LocationIQ API call failed after ${durationMs}ms:`, err);
      console.groupEnd();
      return null;
    }
  },

  // 4. Direct BigDataCloud reverse geocode call (Secondary External Service)
  async reverseGeocodeBigDataCloud(lat, lng) {
    if (lat == null || lng == null) return null;
    const startTime = Date.now();
    const apiKey = import.meta.env.VITE_BIGDATACLOUD_API_KEY || 'bdc_9f845c6872ff4c8bbbecaf159f115f5d';
    const url = `https://api.bigdatacloud.net/data/reverse-geocode?latitude=${lat}&longitude=${lng}&localityLanguage=en&key=${apiKey}`;

    console.group(`🌐 [BigDataCloud API Request] Fetching address for Coordinates: (${lat}, ${lng})`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!res.ok) throw new Error(`BigDataCloud HTTP status: ${res.status} ${res.statusText}`);
      const data = await res.json();

      const parts = [];
      const locality = data.locality || '';
      const city = data.city || '';
      const state = data.principalSubdivision || '';
      const country = data.countryName || '';
      const postcode = data.postcode || '';

      const adminNames = (data.localityInfo?.administrative || [])
        .map(a => a.name)
        .filter(name => name && name !== country && name !== state && name !== city && name !== locality);

      if (locality) parts.push(locality);
      if (city && city.toLowerCase() !== locality.toLowerCase()) parts.push(city);
      if (adminNames.length > 0) {
        adminNames.forEach(name => {
          if (!parts.some(p => p.toLowerCase() === name.toLowerCase())) {
            parts.push(name);
          }
        });
      }
      if (state && !parts.some(p => p.toLowerCase() === state.toLowerCase())) parts.push(state);
      if (postcode) parts.push(postcode);
      if (country && !parts.some(p => p.toLowerCase() === country.toLowerCase())) parts.push(country);

      const resolvedAddress = parts.length > 0 ? parts.join(', ') : (data.locality || data.city || data.principalSubdivision || null);
      console.log('📍 BigDataCloud Resolved Address:', resolvedAddress);
      console.groupEnd();
      return resolvedAddress;
    } catch (err) {
      console.error(`❌ BigDataCloud API call failed:`, err);
      console.groupEnd();
      return null;
    }
  },

  // 5. OpenStreetMap Nominatim reverse geocode call (Tertiary / Fallback)
  async reverseGeocodeNominatim(lat, lng) {
    if (lat == null || lng == null) return null;
    const startTime = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    console.group(`🌐 [OpenStreetMap API Fallback] Fetching live address for Coordinates: (${lat}, ${lng})`);
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

      if (!res.ok) throw new Error(`Geocoding HTTP status: ${res.status} ${res.statusText}`);
      const data = await res.json();
      console.log('📦 OpenStreetMap Response:', data);
      console.groupEnd();

      return data.display_name || null;
    } catch (err) {
      console.error(`❌ OpenStreetMap Nominatim API call failed:`, err);
      console.groupEnd();
      return null;
    }
  },

  // 6. Location Address Resolution Pipeline (LocationIQ Primary)
  async resolveLocationAddress(lat, lng, accuracy = null) {
    console.group(`🎯 [Location Detection Pipeline] Resolving location via LocationIQ for Lat: ${lat}, Lng: ${lng}, Accuracy: ${accuracy}m`);
    console.log('⏰ Triggered At:', new Date().toISOString());
    console.log('📶 Online Status:', typeof navigator !== 'undefined' ? navigator.onLine : 'unknown');
    console.log('🗺️ Google Maps Link:', getGoogleMapsUrl(lat, lng));

    if (lat == null || lng == null) {
      console.warn('⚠️ Missing coordinates (latitude or longitude is null/undefined)');
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

    // Primary: LocationIQ Reverse Geocoding API
    console.log('🚀 Calling LocationIQ Reverse Geocoding API...');
    try {
      const liqAddress = await this.reverseGeocodeLocationIQ(numLat, numLng);
      if (liqAddress) {
        console.log('🎉 [LocationIQ SUCCESS] Received exact human-readable address:', liqAddress);
        console.groupEnd();
        return {
          address: liqAddress,
          geocodingStatus: 'RESOLVED',
          source: 'locationiq',
          isFallback: false
        };
      } else {
        console.warn('⚠️ LocationIQ did not return address. Attempting BigDataCloud fallback...');
      }
    } catch (liqErr) {
      console.error('❌ LocationIQ call failed:', liqErr);
    }

    // Secondary Fallback: BigDataCloud
    try {
      const bdcAddress = await this.reverseGeocodeBigDataCloud(numLat, numLng);
      if (bdcAddress) {
        console.log('🎉 [BigDataCloud Fallback SUCCESS] Address:', bdcAddress);
        console.groupEnd();
        return {
          address: bdcAddress,
          geocodingStatus: 'RESOLVED',
          source: 'bigdatacloud',
          isFallback: false
        };
      }
    } catch (bdcErr) {
      console.error('❌ BigDataCloud fallback failed:', bdcErr);
    }

    // Tertiary Fallback: OpenStreetMap
    try {
      const osmAddress = await this.reverseGeocodeNominatim(numLat, numLng);
      if (osmAddress) {
        console.log('🎉 [OpenStreetMap Fallback SUCCESS] Address:', osmAddress);
        console.groupEnd();
        return {
          address: osmAddress,
          geocodingStatus: 'RESOLVED',
          source: 'nominatim',
          isFallback: false
        };
      }
    } catch (osmErr) {
      console.error('❌ OpenStreetMap fallback failed:', osmErr);
    }

    // Final Fallback if all APIs fail
    console.log('⚠️ [Fallback] Unable to fetch address. Storing coordinates with PENDING status.');
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

      // Also process pending records in local storage
      const localLogs = getLocalAttendanceLogs();
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

