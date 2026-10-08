import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { siteVisitFollowUpApi } from './siteVisitFollowUpApi';
import {
  getEffectiveCustomerStatus,
  isFollowUpRejected,
  CUSTOMER_MASTER_STATUSES,
  normalizeCustomerStatus
} from '../pages/CallTracker/callTrackerConstants';

export const customerMasterApi = {
  // Fetch Customer Master records: leads whose latest customer status (from Call Tracker or Site Visit/Meeting) is Hot or Warm
  // (excluding deals marked lost in Site Visit follow-up)
  async getConvertedCustomers() {
    const [leads, trackers, followUps] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      siteVisitFollowUpApi.getVisitorFollowUps()
    ]);
    return this.buildConvertedCustomers(leads, trackers, followUps);
  },

  // Same as getConvertedCustomers, from already-fetched data (used by the sidebar badge counts)
  buildConvertedCustomers(leads, trackers, followUps) {

    // Pre-group visitor follow-ups by both leadId and leadNo
    const followUpsByLead = {};
    (followUps || []).forEach(f => {
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

    // Pre-group trackers by both leadId and leadNo
    const trackersByLead = {};
    (trackers || []).forEach(t => {
      const idKey = t.leadId != null ? String(t.leadId) : null;
      const noKey = t.leadNo != null ? String(t.leadNo).trim() : null;
      if (idKey) {
        if (!trackersByLead[idKey]) trackersByLead[idKey] = [];
        trackersByLead[idKey].push(t);
      }
      if (noKey && noKey !== idKey) {
        if (!trackersByLead[noKey]) trackersByLead[noKey] = [];
        trackersByLead[noKey].push(t);
      }
    });

    return (leads || [])
      .map(lead => {
        const leadIdStr = lead.id != null ? String(lead.id) : '';
        const leadNoStr = lead.leadNo != null ? String(lead.leadNo).trim() : '';

        // Deduplicate follow-ups for this lead
        const rawFollowUps = [
          ...(leadIdStr && followUpsByLead[leadIdStr] ? followUpsByLead[leadIdStr] : []),
          ...(leadNoStr && followUpsByLead[leadNoStr] ? followUpsByLead[leadNoStr] : [])
        ];
        const seenFollowUpIds = new Set();
        const leadFollowUps = [];
        rawFollowUps.forEach(f => {
          const fid = f.id || `${f.leadNo}-${f.timestampMs || f.createdAt || f.created_at}`;
          if (!seenFollowUpIds.has(fid)) {
            seenFollowUpIds.add(fid);
            leadFollowUps.push(f);
          }
        });
        leadFollowUps.sort((a, b) => {
          const aMs = Number(a.timestampMs) || (a.createdAt ? new Date(a.createdAt).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0));
          const bMs = Number(b.timestampMs) || (b.createdAt ? new Date(b.createdAt).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0));
          return aMs - bMs;
        });

        // Deduplicate trackers for this lead
        const rawTrackers = [
          ...(leadIdStr && trackersByLead[leadIdStr] ? trackersByLead[leadIdStr] : []),
          ...(leadNoStr && trackersByLead[leadNoStr] ? trackersByLead[leadNoStr] : [])
        ];
        const seenTrackerIds = new Set();
        const leadTrackers = [];
        rawTrackers.forEach(t => {
          const tid = t.id || `${t.leadNo}-${t.timestampMs || t.createdAt}`;
          if (!seenTrackerIds.has(tid)) {
            seenTrackerIds.add(tid);
            leadTrackers.push(t);
          }
        });
        leadTrackers.sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0));

        const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;
        const latestTracker = leadTrackers[leadTrackers.length - 1] || null;

        // Effective customer status across trackers and visitor follow-ups
        const customerStatus = getEffectiveCustomerStatus(leadTrackers, leadFollowUps, lead.id, lead.leadNo);
        const isRejected = isFollowUpRejected(latestFollowUp);

        // Determine active status: pick status from the most recent interaction
        const latestFollowUpMs = latestFollowUp ? (Number(latestFollowUp.timestampMs) || (latestFollowUp.createdAt ? new Date(latestFollowUp.createdAt).getTime() : 0)) : 0;
        const latestTrackerMs = latestTracker ? (Number(latestTracker.timestampMs) || 0) : 0;

        let activeStatus = lead.status || null;
        if (latestFollowUpMs >= latestTrackerMs && latestFollowUp?.status) {
          activeStatus = latestFollowUp.status;
        } else if (latestTracker?.status) {
          activeStatus = latestTracker.status;
        }

        return {
          ...lead,
          status: isRejected ? 'Rejected (Lost)' : activeStatus,
          customerStatus,
          isConverted: CUSTOMER_MASTER_STATUSES.includes(customerStatus) && !isRejected,
          dealOutcome: latestFollowUp?.dealOutcome || null,
          rejectionReason: latestFollowUp?.rejectionReason || null,
          salesExecutive: latestFollowUp?.salesExecutive || null,
          closingAmount: latestFollowUp?.closingAmount || null,
          referenceNo: latestFollowUp?.referenceNo || null,
          lastActivityMs: Math.max(latestFollowUpMs, latestTrackerMs)
        };
      })
      .filter(lead => lead.isConverted);
  }
};
