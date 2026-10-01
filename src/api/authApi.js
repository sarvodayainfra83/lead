import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getUsers as getLocalUsers, saveUser as saveLocalUser, deleteUser as deleteLocalUser } from '../utils/storageManager';

const resolveUserRole = (rawRole, accessPages) => {
  const r = String(rawRole || '').trim().toUpperCase();
  if (r === 'TESTER' || accessPages?.__role === 'TESTER' || accessPages?.__is_tester) {
    return 'TESTER';
  }
  return r || 'USER';
};

export const authApi = {
  // Login user by Username, Email, or Phone and Password
  async loginUser(userIdCode, password) {
    const cleanId = String(userIdCode || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanId || !cleanPassword) {
      throw new Error('Invalid credentials');
    }

    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const matched = users.find(
        u => (u.id?.toLowerCase() === cleanId.toLowerCase() || u.gmail?.toLowerCase() === cleanId.toLowerCase() || u.number === cleanId) &&
          u.password === cleanPassword
      );
      if (!matched) throw new Error('Invalid credentials');
      return matched;
    }

    let query = supabase
      .from('users')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .eq('password', cleanPassword);

    // Support username (case-insensitive), email, or phone number
    if (cleanId.includes(',') || cleanId.includes('(') || cleanId.includes(')')) {
      query = query.ilike('username', cleanId);
    } else {
      query = query.or(`username.ilike.${cleanId},gmail.ilike.${cleanId},number.eq.${cleanId}`);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Database error during login:', error);
      throw new Error('Database error during login');
    }

    if (!data) {
      throw new Error('Invalid credentials');
    }

    return {
      id: data.username,
      dbId: data.id,
      name: data.name,
      number: data.number,
      gmail: data.gmail,
      password: data.password,
      role: resolveUserRole(data.role, data.access_pages),
      position: data.position || '',
      leadTypeId: data.lead_type_id || null,
      leadType: data.lead_type || data.access_pages?.__assigned_lead_types || data.master_lead_types?.lead_type || '',
      accessPages: data.access_pages || {}
    };
  },

  // Load the CURRENT user fresh from the database (role, lead type, page access) — used on every
  // app start / focus so permission changes made by the admin apply immediately. Returns null if
  // the user no longer exists.
  async getUserByUsername(userIdCode) {
    if (!userIdCode) return null;
    const cleanId = String(userIdCode).trim();
    if (!isSupabaseConfigured) {
      const u = getLocalUsers().find(x => x.id?.toLowerCase() === cleanId.toLowerCase());
      if (!u) return null;
      const { password, ...rest } = u;
      return { ...rest, accessPages: u.accessPages || {} };
    }

    const { data, error } = await supabase
      .from('users')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .ilike('username', cleanId)
      .maybeSingle();

    if (error) throw error; // network / server problem — caller keeps the session and retries
    if (!data) return null;

    return {
      id: data.username,
      dbId: data.id,
      name: data.name,
      number: data.number,
      gmail: data.gmail,
      role: resolveUserRole(data.role, data.access_pages),
      position: data.position || '',
      leadTypeId: data.lead_type_id || null,
      leadType: data.lead_type || data.access_pages?.__assigned_lead_types || data.master_lead_types?.lead_type || '',
      accessPages: data.access_pages || {}
    };
  },

  // Get all registered users
  async getUsers() {
    if (!isSupabaseConfigured) {
      return getLocalUsers();
    }

    const { data, error } = await supabase
      .from('users')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .order('created_at', { ascending: true });

    if (error) {
      // Fallback query without relation if column/fk is being created
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (fallbackError) {
        console.error('Error fetching users from Supabase:', fallbackError);
        return getLocalUsers();
      }

      let typeMap = {};
      try {
        const { data: ltData } = await supabase.from('master_lead_types').select('id, lead_type');
        if (ltData) {
          ltData.forEach(t => { typeMap[t.id] = t.lead_type; });
        }
      } catch (e) {
        console.warn('Could not fetch lead types for user fallback:', e);
      }

      return fallbackData.map((u, index) => ({
        id: u.username,
        dbId: u.id,
        serialNo: index + 1,
        name: u.name,
        number: u.number,
        gmail: u.gmail,
        password: u.password,
        role: resolveUserRole(u.role, u.access_pages),
        position: u.position || '',
        leadTypeId: u.lead_type_id || null,
        leadType: u.lead_type || u.access_pages?.__assigned_lead_types || (u.lead_type_id && typeMap[u.lead_type_id]) || '',
        accessPages: u.access_pages || {}
      }));
    }

    return data.map((u, index) => ({
      id: u.username,
      dbId: u.id,
      serialNo: index + 1,
      name: u.name,
      number: u.number,
      gmail: u.gmail,
      password: u.password,
      role: resolveUserRole(u.role, u.access_pages),
      position: u.position || '',
      leadTypeId: u.lead_type_id || null,
      leadType: u.lead_type || u.access_pages?.__assigned_lead_types || u.master_lead_types?.lead_type || '',
      accessPages: u.access_pages || {}
    }));
  },

  // Save or update user
  async saveUser(userData) {
    if (!isSupabaseConfigured) {
      return saveLocalUser(userData);
    }

    const accessPages = {
      ...(userData.accessPages || {}),
      __assigned_lead_types: userData.leadType || ''
    };

    if (userData.role === 'TESTER') {
      accessPages.__role = 'TESTER';
      accessPages.__is_tester = true;
    }

    let payload = {
      username: userData.id,
      name: userData.name,
      number: userData.number || '',
      gmail: userData.gmail || '',
      password: userData.password,
      role: userData.role,
      position: userData.position || null,
      lead_type: userData.leadType || null,
      lead_type_id: userData.leadTypeId || null,
      access_pages: accessPages
    };

    let { data, error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'username' })
      .select();

    // Fallback: If database has older users_role_check constraint rejecting 'TESTER', fallback to 'USER' in role column with __role in access_pages
    if (error && (error.message?.includes('users_role_check') || error.message?.includes('role') || error.code === '23514')) {
      payload.role = 'USER';
      ({ data, error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'username' })
        .select());
    }

    if (error && (error.message?.includes('lead_type') || error.code === 'PGRST204')) {
      delete payload.lead_type;
      ({ data, error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'username' })
        .select());
    }

    if (error) {
      console.error('Error saving user to Supabase:', error);
      saveLocalUser(userData);
      throw error;
    }

    saveLocalUser(userData); // Keep synced locally
    return data[0];
  },

  // Delete user
  async deleteUser(userIdCode) {
    if (!isSupabaseConfigured) {
      return deleteLocalUser(userIdCode);
    }

    // 1. Fetch user to obtain dbId (UUID) and username
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', userIdCode)
        .maybeSingle();

      if (userRow) {
        // Disconnect foreign key in attendance_logs so deletion won't fail with FK constraint error (23503)
        if (userRow.id) {
          await supabase
            .from('attendance_logs')
            .update({ user_id: null })
            .eq('user_id', userRow.id);
        }
        await supabase
          .from('attendance_logs')
          .update({ user_id: null })
          .eq('user_id', userRow.username);
      }
    } catch (cleanErr) {
      console.warn('Could not un-link attendance logs before deleting user:', cleanErr);
    }

    // 2. Delete user row
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('username', userIdCode);

    if (error) {
      console.error('Error deleting user from Supabase:', error);
      throw error;
    }

    deleteLocalUser(userIdCode);
  }
};
