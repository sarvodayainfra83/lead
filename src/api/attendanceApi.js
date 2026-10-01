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
      accuracy: row.accuracy !== null && row.accuracy !== undefined ? Number(row.accuracy) : null,
      locationName: row.location_name || row.locationName || row.location || '',
      geocodingStatus: row.geocoding_status || row.geocodingStatus || 'RESOLVED',
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
      outAccuracy: isMarkingOut ? (entry.accuracy != null ? entry.accuracy : null) : (existingTodayLog?.outAccuracy || null),
      outLocationName: isMarkingOut ? entry.locationName : (existingTodayLog?.outLocationName || null),
      outGeocodingStatus: isMarkingOut ? (entry.geocodingStatus || 'RESOLVED') : (existingTodayLog?.outGeocodingStatus || 'RESOLVED')
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
        if (isMarkingOut) {
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

  // 1. Search for nearby cached location within radius (default 100 meters)
  async findNearbyLocationInCache(lat, lng, radiusMeters = 100) {
    if (lat == null || lng == null) return null;
    const numLat = Number(lat);
    const numLng = Number(lng);

    // Check local storage cache first
    try {
      const localCache = getLocalLocationCache();
      if (Array.isArray(localCache) && localCache.length > 0) {
        let closest = null;
        let minDistance = Infinity;

        for (const item of localCache) {
          if (item.latitude != null && item.longitude != null && item.address) {
            const dist = calculateDistanceMeters(numLat, numLng, item.latitude, item.longitude);
            if (dist <= radiusMeters && dist < minDistance) {
              minDistance = dist;
              closest = { ...item, distance: dist };
            }
          }
        }

        if (closest) {
          return closest;
        }
      }
    } catch (err) {
      console.warn('Error reading local location cache:', err);
    }

    // Check Supabase location_cache table if configured
    if (isSupabaseConfigured) {
      try {
        // Bounding box pre-filter (~220m radius)
        const latDelta = 0.002;
        const lngDelta = 0.002;

        const { data, error } = await supabase
          .from('location_cache')
          .select('*')
          .gte('latitude', numLat - latDelta)
          .lte('latitude', numLat + latDelta)
          .gte('longitude', numLng - lngDelta)
          .lte('longitude', numLng + lngDelta)
          .limit(20);

        if (!error && Array.isArray(data) && data.length > 0) {
          let closest = null;
          let minDistance = Infinity;

          for (const item of data) {
            if (item.latitude != null && item.longitude != null && item.address) {
              const dist = calculateDistanceMeters(numLat, numLng, item.latitude, item.longitude);
              if (dist <= radiusMeters && dist < minDistance) {
                minDistance = dist;
                closest = { ...item, distance: dist };
              }
            }
          }

          if (closest) {
            // Also store in local cache for offline reuse
            addLocalLocationCacheEntry({
              latitude: closest.latitude,
              longitude: closest.longitude,
              address: closest.address,
              accuracy: closest.accuracy
            });
            return closest;
          }
        }
      } catch (err) {
        console.warn('Error querying Supabase location_cache:', err);
      }
    }

    return null;
  },

  // 2. Save resolved location to cache (both Supabase and local storage)
  async saveLocationToCache(lat, lng, address, accuracy = null) {
    if (lat == null || lng == null || !address) return;
    const numLat = Number(lat);
    const numLng = Number(lng);
    const numAcc = accuracy != null ? Number(accuracy) : null;

    // Save to local storage
    addLocalLocationCacheEntry({
      latitude: numLat,
      longitude: numLng,
      address,
      accuracy: numAcc
    });

    // Save to Supabase location_cache table
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('location_cache')
          .insert({
            latitude: numLat,
            longitude: numLng,
            address,
            accuracy: numAcc
          });
      } catch (err) {
        console.warn('Could not save to Supabase location_cache table:', err);
      }
    }
  },

  // 3. Direct Nominatim reverse geocode call
  async reverseGeocodeNominatim(lat, lng) {
    if (lat == null || lng == null) return null;
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
      if (!res.ok) throw new Error(`Geocoding HTTP status: ${res.status}`);
      const data = await res.json();
      return data.display_name || null;
    } catch (err) {
      console.warn('Nominatim reverse geocode error:', err);
      return null;
    }
  },

  // 4. 5-Tier Location Address Resolution
  async resolveLocationAddress(lat, lng, accuracy = null) {
    if (lat == null || lng == null) {
      return {
        address: '',
        geocodingStatus: 'RESOLVED',
        source: 'none',
        isFallback: false
      };
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    // Tier 1: Check Location Cache (within 100m radius)
    try {
      const cached = await this.findNearbyLocationInCache(numLat, numLng, 100);
      if (cached && cached.address) {
        saveLastResolvedAddress(cached.address);
        return {
          address: cached.address,
          geocodingStatus: 'RESOLVED',
          source: 'cache',
          isFallback: false
        };
      }
    } catch (cacheErr) {
      console.warn('Cache lookup failed:', cacheErr);
    }

    // Tier 2: OpenStreetMap Nominatim Reverse Geocoding
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      try {
        const nominatimAddress = await this.reverseGeocodeNominatim(numLat, numLng);
        if (nominatimAddress) {
          // Save to shared cache & local storage
          this.saveLocationToCache(numLat, numLng, nominatimAddress, accuracy);
          saveLastResolvedAddress(nominatimAddress);
          return {
            address: nominatimAddress,
            geocodingStatus: 'RESOLVED',
            source: 'nominatim',
            isFallback: false
          };
        }
      } catch (nomErr) {
        console.warn('Nominatim resolution failed:', nomErr);
      }
    }

    // Tier 3: Local Last Known Address Fallback
    const lastKnownAddress = getLastResolvedAddress();
    if (lastKnownAddress) {
      return {
        address: `${lastKnownAddress} (Approximate / Offline)`,
        geocodingStatus: 'PENDING',
        source: 'last_known',
        isFallback: true
      };
    }

    // Tier 4: Raw GPS Coordinates Fallback
    return {
      address: `${numLat.toFixed(6)}, ${numLng.toFixed(6)}`,
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

    try {
      if (isSupabaseConfigured) {
        // Query pending attendance_logs from Supabase
        const { data: pendingLogs, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .or('geocoding_status.eq.PENDING,out_geocoding_status.eq.PENDING')
          .limit(10);

        if (!error && Array.isArray(pendingLogs) && pendingLogs.length > 0) {
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

          if (updatedCount > 0 && typeof onSuccessCallback === 'function') {
            onSuccessCallback();
          }
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
        if (log.out_geocoding_status === 'PENDING' && log.latitude != null && log.longitude != null) {
          const res = await this.resolveLocationAddress(log.latitude, log.longitude, log.out_accuracy || log.accuracy);
          if (res.geocodingStatus === 'RESOLVED') {
            log.out_location_name = res.address;
            log.out_geocoding_status = 'RESOLVED';
            localModified = true;
          }
        }
      }
      if (localModified) {
        saveLocalAttendanceLogs(localLogs);
        if (typeof onSuccessCallback === 'function') {
          onSuccessCallback();
        }
      }
    } catch (err) {
      console.warn('retryPendingGeocoding error:', err);
    } finally {
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

