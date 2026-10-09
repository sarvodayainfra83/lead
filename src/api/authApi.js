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
      avatarUrl: data.avatar_url || data.profile_image || data.access_pages?.__avatar_url || '',
      avatar_url: data.avatar_url || data.profile_image || data.access_pages?.__avatar_url || '',
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
      return {
        ...rest,
        avatarUrl: u.avatarUrl || u.avatar_url || '',
        avatar_url: u.avatarUrl || u.avatar_url || '',
        accessPages: u.accessPages || {}
      };
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
      avatarUrl: data.avatar_url || data.profile_image || data.access_pages?.__avatar_url || '',
      avatar_url: data.avatar_url || data.profile_image || data.access_pages?.__avatar_url || '',
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
        throw fallbackError;
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
        avatarUrl: u.avatar_url || u.profile_image || u.access_pages?.__avatar_url || '',
        avatar_url: u.avatar_url || u.profile_image || u.access_pages?.__avatar_url || '',
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
      avatarUrl: u.avatar_url || u.profile_image || u.access_pages?.__avatar_url || '',
      avatar_url: u.avatar_url || u.profile_image || u.access_pages?.__avatar_url || '',
      password: u.password,
      role: resolveUserRole(u.role, u.access_pages),
      position: u.position || '',
      leadTypeId: u.lead_type_id || null,
      leadType: u.lead_type || u.access_pages?.__assigned_lead_types || u.master_lead_types?.lead_type || '',
      accessPages: u.access_pages || {}
    }));
  },

  // Upload user profile avatar image to Supabase Storage 'avatars' bucket
  async uploadAvatar(file, username) {
    if (!file) return null;

    if (!isSupabaseConfigured) {
      if (typeof file === 'string') return file;
      if (file instanceof File || file instanceof Blob) {
        return new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.readAsDataURL(file);
        });
      }
      return null;
    }

    try {
      let fileBlob = file;
      let fileExt = 'jpg';
      let contentType = file.type || 'image/jpeg';

      if (typeof file === 'string' && file.startsWith('data:')) {
        const arr = file.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        fileBlob = new Blob([u8arr], { type: mime });
        contentType = mime;
        fileExt = mime.split('/')[1] || 'jpg';
      } else if (file.name) {
        const parts = file.name.split('.');
        if (parts.length > 1) fileExt = parts.pop().toLowerCase();
      }

      const cleanUser = String(username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fileName = `avatar_${cleanUser}_${uniqueSuffix}.${fileExt}`;
      const filePath = `${cleanUser}/${fileName}`;

      // Upload to 'avatars' bucket
      let { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileBlob, {
          contentType,
          cacheControl: '3600',
          upsert: true
        });

      // Fallback: If 'avatars' bucket is missing or errors, try 'products' bucket as secondary fallback
      if (uploadError) {
        console.warn("Upload to 'avatars' bucket failed, attempting secondary storage fallback:", uploadError);
        const fallbackRes = await supabase.storage
          .from('products')
          .upload(`avatars/${filePath}`, fileBlob, {
            contentType,
            cacheControl: '3600',
            upsert: true
          });

        if (!fallbackRes.error) {
          const { data: publicUrlData } = supabase.storage
            .from('products')
            .getPublicUrl(`avatars/${filePath}`);
          if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
        }

        // If storage bucket fails completely, return inline base64 so user avatar still updates
        if (file instanceof File || file instanceof Blob) {
          return new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(file);
          });
        }
        if (typeof file === 'string') return file;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrlData?.publicUrl || null;
    } catch (err) {
      console.error('Error uploading avatar:', err);
      if (file instanceof File || file instanceof Blob) {
        return new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.readAsDataURL(file);
        });
      }
      return typeof file === 'string' ? file : null;
    }
  },

  // Update current user's profile (name, email, phone number, password, profile image)
  async updateProfile(userIdCode, updates = {}) {
    const cleanId = String(userIdCode || '').trim();
    if (!cleanId) throw new Error('User ID is required');

    let finalAvatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl : undefined;

    // If an image file was provided, upload to Supabase avatars bucket first
    if (updates.avatarFile) {
      const uploaded = await this.uploadAvatar(updates.avatarFile, cleanId);
      if (uploaded) finalAvatarUrl = uploaded;
    }

    if (!isSupabaseConfigured) {
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id?.toLowerCase() === cleanId.toLowerCase());
      if (userIndex === -1) throw new Error('User not found');

      const existing = users[userIndex];
      const updated = {
        ...existing,
        name: updates.name !== undefined ? updates.name.trim() : existing.name,
        gmail: updates.gmail !== undefined ? updates.gmail.trim() : existing.gmail,
        number: updates.number !== undefined ? updates.number.trim() : existing.number,
        avatarUrl: finalAvatarUrl !== undefined ? finalAvatarUrl : (existing.avatarUrl || ''),
        avatar_url: finalAvatarUrl !== undefined ? finalAvatarUrl : (existing.avatar_url || '')
      };

      if (updates.password && updates.password.trim()) {
        updated.password = updates.password.trim();
      }

      saveLocalUser(updated);
      return updated;
    }

    // 1. Fetch current user from DB to preserve roles and access_pages
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .ilike('username', cleanId)
      .maybeSingle();

    if (fetchError || !currentUser) {
      throw new Error('User not found in database');
    }

    const accessPages = {
      ...(currentUser.access_pages || {})
    };

    if (finalAvatarUrl !== undefined) {
      accessPages.__avatar_url = finalAvatarUrl;
    }

    const payload = {
      name: updates.name !== undefined ? updates.name.trim() : currentUser.name,
      gmail: updates.gmail !== undefined ? updates.gmail.trim() : currentUser.gmail,
      number: updates.number !== undefined ? updates.number.trim() : currentUser.number,
      access_pages: accessPages,
      updated_at: new Date().toISOString()
    };

    if (finalAvatarUrl !== undefined) {
      payload.avatar_url = finalAvatarUrl;
    }

    if (updates.password && updates.password.trim()) {
      payload.password = updates.password.trim();
    }

    let { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', currentUser.id)
      .select('*, master_lead_types!lead_type_id(id, lead_type)');

    // Fallback if avatar_url column does not exist yet
    if (error && (error.message?.includes('avatar_url') || error.code === 'PGRST204')) {
      delete payload.avatar_url;
      ({ data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', currentUser.id)
        .select('*, master_lead_types!lead_type_id(id, lead_type)'));
    }

    if (error) {
      console.error('Error updating user profile in Supabase:', error);
      throw error;
    }

    const updatedRow = (data && data[0]) ? data[0] : currentUser;
    const formattedUser = {
      id: updatedRow.username,
      dbId: updatedRow.id,
      name: updatedRow.name,
      number: updatedRow.number,
      gmail: updatedRow.gmail,
      avatarUrl: updatedRow.avatar_url || accessPages.__avatar_url || finalAvatarUrl || '',
      avatar_url: updatedRow.avatar_url || accessPages.__avatar_url || finalAvatarUrl || '',
      password: updatedRow.password,
      role: resolveUserRole(updatedRow.role, updatedRow.access_pages),
      position: updatedRow.position || '',
      leadTypeId: updatedRow.lead_type_id || null,
      leadType: updatedRow.lead_type || updatedRow.access_pages?.__assigned_lead_types || updatedRow.master_lead_types?.lead_type || '',
      accessPages: updatedRow.access_pages || {}
    };

    return formattedUser;
  },

  // Save or update user (Admin / Settings)
  async saveUser(userData) {
    if (!isSupabaseConfigured) {
      return saveLocalUser(userData);
    }

    const accessPages = {
      ...(userData.accessPages || {}),
      __assigned_lead_types: userData.leadType || ''
    };

    if (userData.avatarUrl || userData.avatar_url) {
      accessPages.__avatar_url = userData.avatarUrl || userData.avatar_url;
    }

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
      avatar_url: userData.avatarUrl || userData.avatar_url || null,
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

    if (error && (error.message?.includes('avatar_url') || error.code === 'PGRST204')) {
      delete payload.avatar_url;
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
      throw error;
    }

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
  }
};
