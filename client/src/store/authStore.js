import { create } from 'zustand';

const useAuthStore = create((set) => ({
  // State
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,

  // Actions
  login: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  // Helpers
  isAuthenticated: () => !!localStorage.getItem('token'),
  isOwner:         () => JSON.parse(localStorage.getItem('user') || '{}')?.role === 'owner',
  isCustomer:      () => JSON.parse(localStorage.getItem('user') || '{}')?.role === 'customer',
}));

export default useAuthStore;
