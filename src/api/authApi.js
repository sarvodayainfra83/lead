import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getUsers as getLocalUsers, saveUser as saveLocalUser, deleteUser as deleteLocalUser } from '../utils/storageManager';

export const authApi = {
  // Login user by User ID Code and Password
  async loginUser(userIdCode, password) {
    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const matched = users.find(u => u.id === userIdCode && u.password === password);
      if (!matched) throw new Error('Invalid credentials');
      return matched;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id_code', userIdCode)
      .eq('password', password)
      .single();

    if (error || !data) {
      throw new Error('Invalid credentials');
    }

    return {
      id: data.user_id_code,
      dbId: data.id,
      serialNo: data.serial_no,
      name: data.name,
      number: data.number,
      gmail: data.gmail,
      password: data.password,
      role: data.role,
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
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching users from Supabase:', error);
      return getLocalUsers();
    }

    return data.map((u, index) => ({
      id: u.user_id_code,
      dbId: u.id,
      serialNo: index + 1,
      name: u.name,
      number: u.number,
      gmail: u.gmail,
      password: u.password,
      role: u.role,
      accessPages: u.access_pages || {}
    }));
  },

  // Save or update user
  async saveUser(userData) {
    if (!isSupabaseConfigured) {
      return saveLocalUser(userData);
    }

    const payload = {
      user_id_code: userData.id,
      name: userData.name,
      number: userData.number || '',
      gmail: userData.gmail || '',
      password: userData.password,
      role: userData.role,
      access_pages: userData.accessPages || {}
    };

    const { data, error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'user_id_code' })
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
      .eq('user_id_code', userIdCode);

    if (error) {
      console.error('Error deleting user from Supabase:', error);
      throw error;
    }

    deleteLocalUser(userIdCode);
  }
};
