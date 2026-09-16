import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getUsers as getLocalUsers, saveUser as saveLocalUser, deleteUser as deleteLocalUser } from '../utils/storageManager';

export const authApi = {
  // Login user by Username and Password
  async loginUser(userIdCode, password) {
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const matched = users.find(u => u.id === userIdCode && u.password === password);
      if (!matched) throw new Error('Invalid credentials');
      return matched;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .eq('username', userIdCode)
      .eq('password', password)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Invalid credentials');
    }

    return {
      id: data.username,
      dbId: data.id,
      name: data.name,
      number: data.number,
      gmail: data.gmail,
      password: data.password,
      role: data.role,
      position: data.position || '',
      leadTypeId: data.lead_type_id || null,
      leadType: data.master_lead_types?.lead_type || '',
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

      return fallbackData.map((u, index) => ({
        id: u.username,
        dbId: u.id,
        serialNo: index + 1,
        name: u.name,
        number: u.number,
        gmail: u.gmail,
        password: u.password,
        role: u.role,
        position: u.position || '',
        leadTypeId: u.lead_type_id || null,
        leadType: '',
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
      role: u.role,
      position: u.position || '',
      leadTypeId: u.lead_type_id || null,
      leadType: u.master_lead_types?.lead_type || '',
      accessPages: u.access_pages || {}
    }));
  },

  // Save or update user
  async saveUser(userData) {
    if (!isSupabaseConfigured) {
      return saveLocalUser(userData);
    }

    const payload = {
      username: userData.id,
      name: userData.name,
      number: userData.number || '',
      gmail: userData.gmail || '',
      password: userData.password,
      role: userData.role,
      position: userData.position || null,
      lead_type_id: userData.leadTypeId || null,
      access_pages: userData.accessPages || {}
    };

    const { data, error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'username' })
      .select();

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
