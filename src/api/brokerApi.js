import { supabase, isSupabaseConfigured } from './supabaseClient';

const LOCAL_STORAGE_KEY = 'pcb_brokers_v1';

// Dummy data completely removed — starts with clean, empty broker records
export const INITIAL_BROKERS_DUMMY = [];

const DUMMY_IDS = new Set(['brk-101', 'brk-102', 'brk-103', 'brk-104', 'brk-105']);

// Helper: Get local brokers without dummy seed
const getLocalBrokers = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out any previously seeded dummy items
    const realBrokersOnly = parsed.filter(b => b?.id && !DUMMY_IDS.has(b.id));
    if (realBrokersOnly.length !== parsed.length) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realBrokersOnly));
    }
    return realBrokersOnly;
  } catch (err) {
    console.warn('Error reading brokers from localStorage:', err);
    return [];
  }
};

const saveLocalBrokers = (items) => {
  try {
    const realOnly = (items || []).filter(b => b?.id && !DUMMY_IDS.has(b.id));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realOnly));
  } catch (err) {
    console.error('Failed to save brokers to localStorage:', err);
  }
};

const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

// Normalize DB row to frontend camelCase object
const normalizeBrokerRow = (row) => ({
  id: row.id,
  userId: row.user_id || null,
  createdByName: row.created_by_name || '',
  name: row.name || '',
  phone: row.phone || '',
  alternatePhone: row.alternate_phone || '',
  email: row.email || '',
  businessName: row.business_name || '',
  dealPreferred: row.deal_preferred || '',
  pan: row.pan || '',
  aadharNo: row.aadhar_no || '',
  businessAddress: row.business_address || '',
  reraNo: row.rera_no || '',
  photoUrl: row.photo_url || '',
  businessPhotoUrl: row.business_photo_url || '',
  projectType: row.project_type || '',
  commissionPercentage: row.commission_percentage != null ? Number(row.commission_percentage) : 0,
  status: row.status || 'ACTIVE',
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString()
});

// Normalize frontend payload to DB snake_case columns
const toDbPayload = (b) => {
  const payload = {
    name: (b.name || '').trim(),
    phone: (b.phone || '').trim(),
    alternate_phone: (b.alternatePhone || '').trim() || null,
    email: (b.email || '').trim().toLowerCase(),
    business_name: (b.businessName || '').trim() || null,
    deal_preferred: (b.dealPreferred || '').trim(),
    pan: (b.pan || '').trim().toUpperCase(),
    aadhar_no: (b.aadharNo || '').trim(),
    business_address: (b.businessAddress || '').trim(),
    rera_no: (b.reraNo || '').trim().toUpperCase(),
    photo_url: b.photoUrl || null,
    business_photo_url: b.businessPhotoUrl || null,
    project_type: (b.projectType || '').trim(),
    commission_percentage: b.commissionPercentage != null ? parseFloat(b.commissionPercentage) || 0 : 0,
    status: b.status || 'ACTIVE',
    created_by_name: b.createdByName || null
  };

  // Only assign user_id if valid UUID format to avoid Postgres syntax error
  const rawUserId = b.userId || b.user_id;
  if (rawUserId && isUuid(rawUserId)) {
    payload.user_id = rawUserId;
  }

  return payload;
};

export const brokerApi = {
  /**
   * Fetch all brokers
   */
  async getBrokers() {
    if (!isSupabaseConfigured) {
      return getLocalBrokers();
    }

    try {
      const { data, error } = await supabase
        .from('brokers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist yet, gracefully fall back to local real brokers
        console.warn('Brokers table not available in Supabase, checking local data:', error.message);
        return getLocalBrokers();
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(normalizeBrokerRow);
    } catch (err) {
      console.warn('Failed to fetch from Supabase brokers table:', err);
      return getLocalBrokers();
    }
  },

  /**
   * Create a new broker
   */
  async createBroker(brokerData) {
    const payload = toDbPayload(brokerData);
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('brokers')
          .insert(payload)
          .select()
          .single();

        if (!error && data) {
          return normalizeBrokerRow(data);
        }
        console.warn('Supabase insert failed, storing locally:', error?.message);
      } catch (err) {
        console.warn('Supabase insert error, storing locally:', err);
      }
    }

    // Local fallback creation
    const newBroker = {
      id: `brk-${Date.now()}`,
      ...brokerData,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const local = getLocalBrokers();
    const updated = [newBroker, ...local];
    saveLocalBrokers(updated);
    return newBroker;
  },

  /**
   * Update an existing broker
   */
  async updateBroker(id, brokerData) {
    const payload = toDbPayload(brokerData);
    payload.updated_at = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('brokers')
          .update(payload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error && data) {
          return normalizeBrokerRow(data);
        }
      } catch (err) {
        console.warn('Supabase update failed, updating locally:', err);
      }
    }

    // Local fallback update
    const local = getLocalBrokers();
    const idx = local.findIndex(b => b.id === id);
    if (idx !== -1) {
      const merged = {
        ...local[idx],
        ...brokerData,
        id,
        updatedAt: new Date().toISOString()
      };
      local[idx] = merged;
      saveLocalBrokers(local);
      return merged;
    }

    return { id, ...brokerData };
  },

  /**
   * Delete a broker
   */
  async deleteBroker(id) {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('brokers')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('Supabase delete error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase delete exception:', err);
      }
    }

    if (!isSupabaseConfigured) {
      const local = getLocalBrokers();
      saveLocalBrokers(local.filter(b => b.id !== id));
    }
    return true;
  },

  /**
   * Helper: Convert File or Blob to Data URL
   */
  async fileToDataUrl(file) {
    if (!file) return null;
    if (typeof file === 'string') return file;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
};
