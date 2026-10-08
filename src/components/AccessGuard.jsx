import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, Eye, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { canViewPage } from '../utils/authUtils';

// Pages a Dashboard KPI can drill into even without page access — opened view-only, scoped to the
// user's own records, and still hidden from the sidebar.
const DASHBOARD_DRILLDOWN_PAGES = ['lead', 'callTracker', 'siteVisitMeeting', 'customerMaster', 'nonInterested'];

/**
 * Is this page open only because the user drilled into it from a Dashboard KPI
 * (i.e. they have Dashboard access but no access of their own to the page)?
 */
export const isDashboardDrilldown = (user, pageKey, locationState) => (
  Boolean(user) &&
  Boolean(locationState?.fromDashboard) &&
  DASHBOARD_DRILLDOWN_PAGES.includes(pageKey) &&
  !canViewPage(user, pageKey) &&
  canViewPage(user, 'dashboard')
);

export const useDashboardDrilldown = (pageKey) => {
  const user = useAuthStore(state => state.user);
  const location = useLocation();
  return isDashboardDrilldown(user, pageKey, location.state);
};

/**
 * AccessGuard
 * Enforces the Page Access levels configured in Setting — Admins always pass; Users are blocked
 * unless the admin explicitly granted View or Full Access for this page (deny by default).
 * Exceptions: a Dashboard KPI drill-down opens the page view-only (see DASHBOARD_DRILLDOWN_PAGES), and
 * "Share Product" from a lead opens Products to pick & share products (editing there is admin-only anyway).
 *
 * Props:
 *   pageKey  – key into the user's accessPages map (matches Setting.jsx's APP_PAGES)
 *   children – the page to render when access is allowed
 */
const AccessGuard = ({ pageKey, children }) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null; // ProtectedRoute handles the unauthenticated case

  if (isDashboardDrilldown(user, pageKey, location.state)) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-shrink-0 mx-2 sm:mx-3 mt-2 flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] sm:text-xs text-sky-800">
          <span className="flex items-center gap-1.5 font-semibold">
            <Eye size={13} className="shrink-0" />
            View-only · opened from Dashboard
          </span>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900 hover:underline whitespace-nowrap"
          >
            <ArrowLeft size={13} /> Back to Dashboard
          </button>
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    );
  }

  // Share Product from a lead / customer: allowed even without Products page access
  if (pageKey === 'products' && location.state?.shareClient) {
    return <>{children}</>;
  }

  if (!canViewPage(user, pageKey)) {
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
