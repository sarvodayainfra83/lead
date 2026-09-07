import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

/**
 * AccessGuard
 * Enforces the Page Access levels configured in Setting — Admins always pass;
 * Users are blocked when their level for this page is 'none' (or unset).
 *
 * Props:
 *   pageKey  – key into the user's accessPages map (matches Setting.jsx's APP_PAGES)
 *   children – the page to render when access is allowed
 */
const AccessGuard = ({ pageKey, children }) => {
  const { user } = useAuthStore();

  if (!user) return null; // ProtectedRoute handles the unauthenticated case

  const hasAccess = user.role === 'ADMIN' || (user.accessPages?.[pageKey] && user.accessPages[pageKey] !== 'none');

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <ShieldAlert size={24} className="text-red-500" />
        </div>
        <p className="text-base font-bold text-gray-800">Access Restricted</p>
        <p className="text-sm text-gray-500 max-w-xs">
          You don't have permission to view this page. Contact your administrator if you need access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default AccessGuard;
