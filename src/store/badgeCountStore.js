import { create } from 'zustand';
import { leadApi } from '../api/leadApi';
import { callTrackerApi } from '../api/callTrackerApi';
import { isLeadPending, getLeadStatus } from '../pages/CallTracker/callTrackerConstants';
import { useAuthStore } from './authStore';
import { isUserAdmin, matchesUserAssignment, matchesUserReceiver } from '../utils/authUtils';

/**
 * Sidebar badge counts store.
 * Fetches live row-counts scoped to the current user's permissions:
 * - Admin: sees global counts.
 * - User: sees only their assigned queues.
 */
export const useBadgeCountStore = create((set) => ({
  pendingLeadCount: 0,
  pendingTrackerCount: 0,
  customerCount: 0,
  callerReportCount: 0,
  loaded: false,

  refresh: async () => {
    try {
      const user = useAuthStore.getState().user;
      const isAdmin = isUserAdmin(user);

      const [allLeads, allTrackers] = await Promise.all([
        leadApi.getLeads(),
        callTrackerApi.getCallTrackers()
      ]);

      // Leads assigned to the user (or all if admin)
      const userLeads = isAdmin ? allLeads : allLeads.filter(l => matchesUserAssignment(l, user));
      const userTrackers = isAdmin ? allTrackers : allTrackers.filter(t => matchesUserAssignment(t, user));

      // Pending leads without caller assigned
      const pendingLeadCount = isAdmin
        ? allLeads.filter(l => !l.callerAssigned).length
        : allLeads.filter(l => !l.callerAssigned && matchesUserReceiver(l, user)).length;

      // Pending tracker leads awaiting a call
      const pendingTrackerCount = userLeads.filter(l => isLeadPending(userTrackers, l)).length;

      // Converted customers
      const customerCount = userLeads.filter(l => getLeadStatus(userTrackers, l.id) === 'Received').length;

      // Distinct leads with call activity in caller report
      const callerReportCount = new Set(userTrackers.map(t => t.leadId || t.leadNo)).size;

      set({
        pendingLeadCount,
        pendingTrackerCount,
        customerCount,
        callerReportCount,
        loaded: true
      });
    } catch (err) {
      console.error('Badge count refresh error:', err);
    }
  }
}));

// Quick helper to trigger a refresh from outside React components
export const refreshBadgeCounts = () => {
  useBadgeCountStore.getState().refresh();
};


