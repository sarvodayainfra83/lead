import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { siteVisitFollowUpApi } from './siteVisitFollowUpApi';
import {
  getLeadStatus,
  getLatestCustomerStatus,
  isFollowUpRejected,
  CUSTOMER_MASTER_STATUSES
} from '../pages/CallTracker/callTrackerConstants';

export const customerMasterApi = {
  // Fetch Customer Master records: leads whose latest call_trackers.customer_status is Hot or Warm
  // (excluding deals marked lost in Site Visit follow-up)
  async getConvertedCustomers() {
    const [leads, trackers, followUps] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      siteVisitFollowUpApi.getVisitorFollowUps()
    ]);

    // Group visitor follow-ups by lead
    const followUpsByLead = {};
    followUps.forEach(f => {
      const key = String(f.leadId || f.leadNo);
      if (!followUpsByLead[key]) followUpsByLead[key] = [];
      followUpsByLead[key].push(f);
    });

    return leads
      .map(lead => {
        const leadFollowUps = (followUpsByLead[String(lead.id)] || followUpsByLead[String(lead.leadNo)] || [])
          .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
        const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;

        const customerStatus = latestFollowUp?.customerStatus || getLatestCustomerStatus(trackers, lead.id, lead.leadNo);
        const isRejected = isFollowUpRejected(latestFollowUp);

        return {
          ...lead,
          status: isRejected ? 'Rejected (Lost)' : (latestFollowUp?.status || getLeadStatus(trackers, lead.id, lead.leadNo)),
          customerStatus,
          isConverted: CUSTOMER_MASTER_STATUSES.includes(customerStatus) && !isRejected,
          dealOutcome: latestFollowUp?.dealOutcome || null,
          rejectionReason: latestFollowUp?.rejectionReason || null,
          salesExecutive: latestFollowUp?.salesExecutive || null,
          closingAmount: latestFollowUp?.closingAmount || null,
          referenceNo: latestFollowUp?.referenceNo || null
        };
      })
      .filter(lead => lead.isConverted);
  }
};
