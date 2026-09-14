import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { visitorFollowUpApi } from './visitorFollowUpApi';
import { getLeadStatus, CONVERTED_STATUSES } from '../pages/CallTracker/callTrackerConstants';

export const customerMasterApi = {
  // Fetch converted customers (leads whose latest outcome is Won/Interested and NOT rejected)
  async getConvertedCustomers() {
    const [leads, trackers, followUps] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      visitorFollowUpApi.getVisitorFollowUps()
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

        const callStatus = getLeadStatus(trackers, lead.id, lead.leadNo);

        let isConverted = false;
        let finalStatus = callStatus;

        if (latestFollowUp) {
          const isRejected =
            latestFollowUp.dealOutcome === 'Rejected (Lost)' ||
            latestFollowUp.status === 'Not Interested' ||
            Boolean(latestFollowUp.rejectionReason);

          if (isRejected) {
            isConverted = false;
            finalStatus = 'Rejected (Lost)';
          } else if (latestFollowUp.dealOutcome === 'Closed (Won)' || latestFollowUp.status === 'Interested') {
            isConverted = true;
            finalStatus = 'Interested';
          } else {
            // Future Plan, Did Not Show -> in progress, not converted
            isConverted = false;
            finalStatus = latestFollowUp.status;
          }
        } else {
          // No visitor follow up: converted if call tracker status is Interested
          if (callStatus === 'Interested') {
            isConverted = true;
            finalStatus = 'Interested';
          }
        }

        return {
          ...lead,
          status: finalStatus,
          isConverted,
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
