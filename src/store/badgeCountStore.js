import { create } from 'zustand';
import { leadApi } from '../api/leadApi';
import { callTrackerApi } from '../api/callTrackerApi';
import { siteVisitMeetingApi } from '../api/siteVisitMeetingApi';
import { customerMasterApi } from '../api/customerMasterApi';
import { nonInterestedApi } from '../api/nonInterestedApi';
import { registerBadgeRefresh, refreshBadgeCounts } from '../utils/badgeNotifier';
import {
  isLeadPending, getLeadStatus, isDirectSiteVisitLead, buildCalledLeadKeys, isInFollowUpQueue
} from '../pages/CallTracker/callTrackerConstants';
import { useAuthStore } from './authStore';
import {
  isUserAdmin, hasFullAccess, getUserLeadTypeScope, matchesUserAssignment, matchesUserReceiver, matchesUserVisitor, matchesUserConnection, matchesAuthorizedUserForNonInterested
} from '../utils/authUtils';

const ALL_CATEGORIES = ['Real Estate', 'Insurance', 'Mutual Fund'];

// Same category partitioning as the Lead & Followup, Hot Customers and Non-interested tabs
const isInCategory = (l, category) => {
  const type = (l.leadType || '').toLowerCase();
  const no = String(l.leadNo || '');
  if (category === 'Real Estate') return type.includes('real') || type.includes('estate') || no.startsWith('LR');
  if (category === 'Insurance') return type.includes('insurance') || no.startsWith('LI');
  if (category === 'Mutual Fund') return type.includes('mutual') || type.includes('fund') || no.startsWith('LM');
  return false;
};

// Categories whose tabs the user can see on those pages
const getVisibleCategories = (user) => {
  const scope = getUserLeadTypeScope(user);
  if (scope?.categories?.length > 0) return scope.categories;
  if (scope?.category) return [scope.category];
  return ALL_CATEGORIES;
};

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
  pendingSiteVisitMeetingCount: 0,
  siteVisitMeetingCount: 0,
  callTrackerCount: 0,
  customerCount: 0,
  nonInterestedCount: 0,
  callerReportCount: 0,
  loaded: false,

  refresh: async () => {
    try {
      const user = useAuthStore.getState().user;
      const isAdmin = isUserAdmin(user);
      const isStrictAdmin = (user?.role || '').trim().toUpperCase() === 'ADMIN';

      const [allLeads, allTrackers, allVisitors, allFollowUps] = await Promise.all([
        leadApi.getLeads(),
        callTrackerApi.getCallTrackers(),
        siteVisitMeetingApi.getAssignedVisitors(),
        siteVisitMeetingApi.getVisitorFollowUps()
      ]);

      // Leads assigned to the user (or all if admin)
      const userLeads = isAdmin ? allLeads : allLeads.filter(l => matchesUserAssignment(l, user));
      const userLeadIdSet = new Set(userLeads.flatMap(l => [String(l.id), String(l.leadNo)].filter(Boolean)));
      const userTrackers = isAdmin ? allTrackers : allTrackers.filter(t => userLeadIdSet.has(String(t.leadId)) || userLeadIdSet.has(String(t.leadNo)));

      // Pending leads without caller assigned (exclude direct leads and direct site visit leads)
      const pendingLeadCount = isAdmin
        ? allLeads.filter(l => !l.callerAssigned && l.processType !== 'Direct' && !isDirectSiteVisitLead(l)).length
        : allLeads.filter(l => !l.callerAssigned && l.processType !== 'Direct' && !isDirectSiteVisitLead(l) && matchesUserReceiver(l, user)).length;

      // Pending tracker leads awaiting a call (must use allTrackers to check actual terminal status)
      const pendingTrackerCount = userLeads.filter(l => isLeadPending(allTrackers, l)).length;

      // Pending visitor assignment (Site Visit/Meeting leads not yet assigned a visitor)
      const assignedLeadSet = new Set(
        allVisitors.filter(v => v.status !== 'Cancelled').map(v => String(v.leadId || v.leadNo))
      );
      const pendingVisitorCount = allLeads.filter(l => {
        const isUserMatch = isAdmin || matchesUserAssignment(l, user) || matchesUserReceiver(l, user);
        if (!isUserMatch) return false;
        const status = getLeadStatus(allTrackers, l.id, l.leadNo);
        return (status === 'Site Visit/Meeting' || status === 'Meeting') && !assignedLeadSet.has(String(l.id)) && !assignedLeadSet.has(String(l.leadNo));
      }).length;

      // Pending visitor follow-ups
      const followUpsByLead = {};
      (allFollowUps || []).forEach(f => {
        const idKey = f.leadId != null ? String(f.leadId) : null;
        const noKey = f.leadNo != null ? String(f.leadNo).trim() : null;
        if (idKey) {
          if (!followUpsByLead[idKey]) followUpsByLead[idKey] = [];
          followUpsByLead[idKey].push(f);
        }
        if (noKey && noKey !== idKey) {
          if (!followUpsByLead[noKey]) followUpsByLead[noKey] = [];
          followUpsByLead[noKey].push(f);
        }
      });

      // allLeads is already scoped to the user's lead type — hide visits of other lead types
      const visibleLeadKeys = new Set(allLeads.flatMap(l => [String(l.id), String(l.leadNo)]));
      const leadTypeRestricted = leadApi.isLeadTypeRestricted();

      const pendingVisitorFollowUpCount = allVisitors.filter(a => {
        if (a.status === 'Cancelled') return false;
        if (leadTypeRestricted && !visibleLeadKeys.has(String(a.leadId)) && !visibleLeadKeys.has(String(a.leadNo))) return false;
        if (!isStrictAdmin) {
          const isAssigned = matchesUserVisitor(a, user);
          if (!isAssigned) return false;
        }
        const leadFollowUps = (followUpsByLead[String(a.leadId)] || followUpsByLead[String(a.leadNo)] || [])
          .sort((x, y) => (x.timestampMs || 0) - (y.timestampMs || 0));
        const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;
        return !latestFollowUp || ['Future Plan', 'Under Negotiation', 'Call Not Received', 'No WhatsApp Reply'].includes(latestFollowUp.status);
      }).length;

      // Counts below mirror exactly what the Lead & Followup, Hot Customers and Non-interested pages list
      const visibleCategories = getVisibleCategories(user);
      const isVisible = (l) => visibleCategories.some(c => isInCategory(l, c));

      // Lead & Followup: accessible leads with a caller (or call history), except direct site-visit leads
      const calledLeadKeys = buildCalledLeadKeys(allTrackers);
      const callTrackerCount = allLeads.filter(l =>
        !isDirectSiteVisitLead(l) && isInFollowUpQueue(l, calledLeadKeys) &&
        (isAdmin || matchesUserConnection(l, user)) && isVisible(l)
      ).length;

      // Site Visit / Meeting: every lead its tabs list — only ADMIN sees all, others their connected leads
      const siteVisitMeetingCount = siteVisitMeetingApi.buildSiteVisitMeetingLeads(allLeads, allTrackers, allVisitors, allFollowUps)
        .filter(l => (isStrictAdmin || matchesUserConnection(l, user)) && isVisible(l))
        .length;

      // Hot Customers badge: only Hot customers (Warm ones are listed on the page but not counted here),
      // excluding lost visitor follow-ups
      const customerCount = customerMasterApi.buildConvertedCustomers(allLeads, allTrackers, allFollowUps)
        .filter(c => c.customerStatus === 'Hot' && matchesUserConnection(c, user) && isVisible(c))
        .length;

      // Non-interested: leads marked Not Interested / Rejected in Call Tracker or Site Visit follow-ups
      const nonInterestedCount = nonInterestedApi.buildNonInterestedLeads(allLeads, allTrackers, allVisitors, allFollowUps)
        .filter(l => (isStrictAdmin || matchesAuthorizedUserForNonInterested(l, user)) && isVisible(l))
        .length;

      // Distinct leads with call activity in caller report
      const callerReportCount = new Set(userTrackers.map(t => t.leadId || t.leadNo)).size;

      set({
        pendingLeadCount,
        pendingTrackerCount,
        pendingVisitorCount,
        pendingVisitorFollowUpCount,
        pendingSiteVisitMeetingCount: isStrictAdmin ? (pendingVisitorCount + pendingVisitorFollowUpCount) : pendingVisitorFollowUpCount,
        siteVisitMeetingCount,
        callTrackerCount,
        customerCount,
        nonInterestedCount,
        callerReportCount,
        loaded: true
      });
    } catch (err) {
      console.error('Badge count refresh error:', err);
    }
  }
}));

// Register the store refresh function into the decoupled badge notifier
registerBadgeRefresh(() => {
  useBadgeCountStore.getState().refresh();
});

export { refreshBadgeCounts };

