import { callTrackerApi } from './callTrackerApi';
import { masterApi } from './masterApi';
import { isUserAdmin, matchesUserAssignment } from '../utils/authUtils';

const monthKeyOf = (timestamp) => {
  if (!timestamp) return '';
  const datePart = String(timestamp).trim().split('T')[0].split(' ')[0];
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return parts[0].length === 4 ? `${parts[0]}-${parts[1]}` : `${parts[2]}-${parts[1]}`;
    }
  }
  if (datePart.includes('/')) {
    const parts = datePart.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}`;
    }
  }
  return '';
};

export const callerReportApi = {
  async getReportFilters(user = null) {
    const [callers, trackers] = await Promise.all([
      masterApi.getCallerNames(),
      callTrackerApi.getCallTrackers()
    ]);

    const isAdmin = isUserAdmin(user);
    const callerNames = isAdmin
      ? Array.from(new Set(callers.map(c => c.personName))).filter(Boolean).sort()
      : [user?.name || user?.id].filter(Boolean);

    const userTrackers = isAdmin
      ? trackers
      : trackers.filter(t => matchesUserAssignment(t, user));

    const monthKeys = Array.from(new Set(userTrackers.map(t => monthKeyOf(t.timestamp)).filter(Boolean))).sort().reverse();

    return {
      callers: callerNames,
      monthKeys
    };
  },

  async getCallerReport({ activeLeadType = 'All', activeCaller = 'Complete', activeMonth = 'All', user = null }) {
    // Fetch call tracker records joined with full lead data via Foreign Key
    const trackersWithLeads = await callTrackerApi.getCallTrackersWithLeads();

    // Filter trackers by user permission and active filters
    const filteredTrackers = trackersWithLeads.filter(t => {
      if (!matchesUserAssignment(t, user)) return false;
      if (activeLeadType !== 'All' && t.leadType !== activeLeadType) return false;
      if (activeCaller !== 'Complete' && t.callerAssigned !== activeCaller) return false;
      if (activeMonth !== 'All' && monthKeyOf(t.timestamp) !== activeMonth) return false;
      return true;
    });

    // Group filtered trackers by unique Lead (leadId or leadNo)
    const leadsMap = new Map();
    filteredTrackers.forEach(t => {
      const key = t.leadId || t.leadNo || t.id;
      if (!leadsMap.has(key)) {
        leadsMap.set(key, {
          leadId: t.leadId,
          leadNo: t.leadNo,
          personName: t.personName,
          number: t.number,
          email: t.email,
          dob: t.dob,
          occupation: t.occupation,
          investmentBudget: t.investmentBudget,
          location: t.location,
          whenToBuyPlan: t.whenToBuyPlan,
          requirement: t.requirement,
          remarks: t.remarks,
          leadDate: t.leadDate,
          leadType: t.leadType,
          leadReceiver: t.leadReceiver,
          leadSource: t.leadSource,
          callerAssigned: t.callerAssigned,
          trackers: []
        });
      }
      leadsMap.get(key).trackers.push(t);
    });

    // Annotate trackers for each lead with followUpNo (call order) and identify latest status
    const leadRows = Array.from(leadsMap.values()).map(lead => {
      const sortedTrackers = [...lead.trackers].sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
      const annotatedTrackers = sortedTrackers.map((t, idx) => ({
        ...t,
        followUpNo: idx + 1
      }));
      const latest = annotatedTrackers[annotatedTrackers.length - 1] || {};

      return {
        ...lead,
        followUpCount: annotatedTrackers.length,
        latestStatus: latest.status || '-',
        latestCustomerSaid: latest.customerSaid || '',
        latestNextDate: latest.nextDate || '',
        latestCallDate: latest.timestamp ? latest.timestamp.split(' ')[0] : '',
        latestTimestampMs: latest.timestampMs || 0,
        trackers: annotatedTrackers
      };
    }).sort((a, b) => (b.latestTimestampMs || 0) - (a.latestTimestampMs || 0));

    // Summary totals based on unique leads and their latest outcome
    const totals = {
      callingTarget: leadRows.length,
      totalCalls: filteredTrackers.length,
      interested: leadRows.filter(l => l.latestStatus === 'Interested').length,
      futurePlan: leadRows.filter(l => l.latestStatus === 'Future Plan Date').length,
      notInterested: leadRows.filter(l => l.latestStatus === 'Not Interested').length,
      siteVisit: leadRows.filter(l => l.latestStatus === 'Site Visit/Meeting').length
    };

    return {
      leadRows,
      totals,
      allRecords: leadRows
    };
  }
};
