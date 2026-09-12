import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { getLeadStatus, CONVERTED_STATUSES } from '../pages/CallTracker/callTrackerConstants';

export const customerMasterApi = {
  // Fetch converted customers (leads whose latest status is Interested or Site Visit/Meeting)
  async getConvertedCustomers() {
    const [leads, trackers] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers()
    ]);

    return leads
      .map(lead => ({ ...lead, status: getLeadStatus(trackers, lead.id) }))
      .filter(lead => CONVERTED_STATUSES.includes(lead.status));
  }
};
