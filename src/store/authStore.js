import { create } from 'zustand';
import { authApi } from '../api/authApi';

/**
 * Auth store
 * Only the login ID is kept in the browser ('session'). The user's profile — role, lead type
 * and page access — is ALWAYS loaded fresh from the database: on app start, when the window
 * regains focus, and every minute. So access changes made by the admin apply right away, and a
 * deleted user is logged out. Nothing else about the user is cached.
 */
const SESSION_KEY = 'session';

// Remove the old full-profile cache (it kept stale page access and the password)
localStorage.removeItem('user');

const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
};

const initialSession = readSession();

const isSameUser = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.dbId === b.dbId &&
    a.name === b.name &&
    a.role === b.role &&
    a.position === b.position &&
    a.leadTypeId === b.leadTypeId &&
    a.leadType === b.leadType &&
    a.number === b.number &&
    a.gmail === b.gmail &&
    (a.avatarUrl || a.avatar_url || '') === (b.avatarUrl || b.avatar_url || '') &&
    JSON.stringify(a.accessPages || {}) === JSON.stringify(b.accessPages || {})
  );
};

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  // true while the saved session is being verified against the database
  checking: Boolean(initialSession),

  loginWithApi: async (userIdCode, password) => {
    const user = await authApi.loginUser(userIdCode, password); // validates credentials and returns profile
    if (!user) throw new Error('Invalid credentials');
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id }));
    set({ user, isAuthenticated: true, checking: false });
    return user;
  },

  login: (userData) => {
    const { password, ...safe } = userData || {};
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: safe.id }));
    set({ user: safe, isAuthenticated: true, checking: false });
  },

  updateUser: (updatedData) => {
    const current = get().user || {};
    const merged = { ...current, ...updatedData };
    set({ user: merged });
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false, checking: false });
  },

  // Re-load the logged-in user from the database (called on start, focus and on a timer)
  refreshUser: async () => {
    const session = readSession();
    if (!session) {
      if (get().user !== null || get().isAuthenticated !== false) {
        set({ user: null, isAuthenticated: false, checking: false });
      }
      return null;
    }
    try {
      const fresh = await authApi.getUserByUsername(session.id);
      if (!fresh) {
        // User was deleted — end the session
        get().logout();
        return null;
      }
      const current = get().user;
      // Only trigger a state change if the user data actually changed, avoiding spurious re-renders
      if (!isSameUser(current, fresh)) {
        set({ user: fresh, isAuthenticated: true, checking: false });
      } else if (get().checking) {
        set({ checking: false });
      }
      return fresh;
    } catch (err) {
      // Could not reach the server: keep whatever we have, but never grant access without a profile
      console.error('Could not refresh user:', err);
      if (get().checking) set({ checking: false });
      return get().user;
    }
  },

  initializeAuth: () => get().refreshUser()
}));

// Verify the saved session once the app loads, then keep permissions live
if (initialSession) {
  useAuthStore.getState().refreshUser();
}
if (typeof window !== 'undefined') {
  let lastRefreshTime = Date.now();
  const throttledRefresh = () => {
    const now = Date.now();
    // Throttle: don't hit the DB more than once every 60 seconds on window focus
    if (now - lastRefreshTime < 60 * 1000) return;
    lastRefreshTime = now;
    if (readSession()) useAuthStore.getState().refreshUser();
  };

  window.addEventListener('focus', throttledRefresh);
  setInterval(throttledRefresh, 60 * 1000);
}

export { useAuthStore };
