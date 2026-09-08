import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { getLeadStatus } from '../pages/CallTracker/callTrackerConstants';

export const customerMasterApi = {
  // Fetch converted customers (leads with latest status === 'Received')
  async getConvertedCustomers() {
    const [leads, trackers] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers()
    ]);

    return leads.filter(lead => getLeadStatus(trackers, lead.id) === 'Received');
  }
};
