import { create } from 'zustand';
import { authApi } from '../api/authApi';

const storedUser = localStorage.getItem('user');
let parsedUser = null;
try {
  parsedUser = storedUser ? JSON.parse(storedUser) : null;
} catch (e) {
  parsedUser = null;
}

const useAuthStore = create((set) => ({
  user: parsedUser,
  isAuthenticated: !!parsedUser,

  loginWithApi: async (userIdCode, password) => {
    const userData = await authApi.loginUser(userIdCode, password);
    set({
      user: userData,
      isAuthenticated: true
    });
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  },

  login: (userData) => {
    set({
      user: userData,
      isAuthenticated: true
    });
    localStorage.setItem('user', JSON.stringify(userData));
  },

  logout: () => {
    set({
      user: null,
      isAuthenticated: false
    });
    localStorage.removeItem('user');
  },

  initializeAuth: () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        set({
          user: JSON.parse(storedUser),
          isAuthenticated: true
        });
      } catch (e) {
        set({ user: null, isAuthenticated: false });
      }
    }
  }
}));

export { useAuthStore };
