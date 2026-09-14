import { create } from 'zustand';
import { leadApi } from '../api/leadApi';
import { callTrackerApi } from '../api/callTrackerApi';
import { visitorApi } from '../api/visitorApi';
import { visitorFollowUpApi } from '../api/visitorFollowUpApi';
import { isLeadPending, getLeadStatus, CONVERTED_STATUSES } from '../pages/CallTracker/callTrackerConstants';
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
  pendingVisitorCount: 0,
  pendingVisitorFollowUpCount: 0,
  customerCount: 0,
  callerReportCount: 0,
  loaded: false,

  refresh: async () => {
    try {
      const user = useAuthStore.getState().user;
      const isAdmin = isUserAdmin(user);

      const [allLeads, allTrackers, allVisitors, allFollowUps] = await Promise.all([
        leadApi.getLeads(),
        callTrackerApi.getCallTrackers(),
        visitorApi.getAssignedVisitors(),
        visitorFollowUpApi.getVisitorFollowUps()
      ]);

      // Leads assigned to the user (or all if admin)
      const userLeads = isAdmin ? allLeads : allLeads.filter(l => matchesUserAssignment(l, user));
      const userTrackers = isAdmin ? allTrackers : allTrackers.filter(t => matchesUserAssignment(t, user));

      // Pending leads without caller assigned (exclude direct leads created in Call Tracker)
      const pendingLeadCount = isAdmin
        ? allLeads.filter(l => !l.callerAssigned && l.processType !== 'Direct').length
        : allLeads.filter(l => !l.callerAssigned && l.processType !== 'Direct' && matchesUserReceiver(l, user)).length;

      // Pending tracker leads awaiting a call
      const pendingTrackerCount = userLeads.filter(l => isLeadPending(userTrackers, l)).length;

      // Pending visitor assignment (Site Visit/Meeting leads not yet assigned a visitor)
      const assignedLeadSet = new Set(
        allVisitors.filter(v => v.status !== 'Cancelled').map(v => String(v.leadId || v.leadNo))
      );
      const pendingVisitorCount = userLeads.filter(l => {
        const status = getLeadStatus(userTrackers, l.id);
        return status === 'Site Visit/Meeting' && !assignedLeadSet.has(String(l.id)) && !assignedLeadSet.has(String(l.leadNo));
      }).length;

      // Pending visitor follow-ups
      const followUpsByLead = {};
      allFollowUps.forEach(f => {
        const key = String(f.leadId || f.leadNo);
        if (!followUpsByLead[key]) followUpsByLead[key] = [];
        followUpsByLead[key].push(f);
      });

      const pendingVisitorFollowUpCount = allVisitors.filter(a => {
        if (a.status === 'Cancelled') return false;
        if (!isAdmin) {
          const isAssigned = a.visitorName === user?.name || a.visitorId === user?.id;
          const isReceiver = userLeads.some(l => String(l.id) === String(a.leadId) || l.leadNo === a.leadNo);
          if (!isAssigned && !isReceiver) return false;
        }
        const leadFollowUps = (followUpsByLead[String(a.leadId)] || followUpsByLead[String(a.leadNo)] || [])
          .sort((x, y) => (x.timestampMs || 0) - (y.timestampMs || 0));
        const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;
        return !latestFollowUp || latestFollowUp.status === 'Future Plan';
      }).length;

      // Converted customers (Won/Interested, excluding rejected visitor follow-ups)
      const customerCount = userLeads.filter(l => {
        const leadFollowUps = (followUpsByLead[String(l.id)] || followUpsByLead[String(l.leadNo)] || [])
          .sort((x, y) => (x.timestampMs || 0) - (y.timestampMs || 0));
        const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;
        const callStatus = getLeadStatus(userTrackers, l.id);

        if (latestFollowUp) {
          const isRejected =
            latestFollowUp.dealOutcome === 'Rejected (Lost)' ||
            latestFollowUp.status === 'Not Interested' ||
            Boolean(latestFollowUp.rejectionReason);

          if (isRejected) return false;
          if (latestFollowUp.dealOutcome === 'Closed (Won)' || latestFollowUp.status === 'Interested') {
            return true;
          }
          return false;
        }
        return callStatus === 'Interested';
      }).length;

      // Distinct leads with call activity in caller report
      const callerReportCount = new Set(userTrackers.map(t => t.leadId || t.leadNo)).size;

      set({
        pendingLeadCount,
        pendingTrackerCount,
        pendingVisitorCount,
        pendingVisitorFollowUpCount,
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
