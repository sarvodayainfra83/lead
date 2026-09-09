import { supabase, isSupabaseConfigured } from './supabaseClient';
import { leadApi } from './leadApi';
import {
  getCallTrackers as getLocalCallTrackers,
  saveCallTracker as saveLocalCallTracker,
  deleteCallTracker as deleteLocalCallTracker
} from '../utils/storageManager';
import { refreshBadgeCounts } from '../store/badgeCountStore';

export const callTrackerApi = {
  // Map DB row -> Frontend Tracker model
  mapFromDb(row) {
    return {
      id: row.id,
      leadId: row.lead_id,
      leadNo: row.lead_no,
      status: row.status,
      customerSaid: row.customer_said || '',
      nextDate: row.next_date,
      timestamp: row.timestamp,
      timestampMs: Number(row.timestamp_ms)
    };
  },

  // Map Frontend Tracker model -> DB row
  mapToDb(entry) {
    return {
      lead_id: entry.leadId,
      lead_no: entry.leadNo,
      status: entry.status,
      customer_said: entry.customerSaid || '',
      next_date: entry.nextDate,
      timestamp: entry.timestamp,
      timestamp_ms: entry.timestampMs || Date.now()
    };
  },

  // Get all call tracker history entries
  async getCallTrackers() {
    if (!isSupabaseConfigured) {
      return getLocalCallTrackers();
    }

    const { data, error } = await supabase
      .from('call_trackers')
      .select('*')
      .order('timestamp_ms', { ascending: true });

    if (error) {
      console.error('Error fetching call trackers from Supabase:', error);
      return getLocalCallTrackers();
    }

    return data.map(this.mapFromDb);
  },

  // Get all call trackers joined with full lead and master details via Foreign Key
  async getCallTrackersWithLeads() {
    if (!isSupabaseConfigured) {
      const [leads, trackers] = await Promise.all([
        leadApi.getLeads(),
        getLocalCallTrackers()
      ]);
      const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));
      return trackers.map(t => ({
        ...t,
        ...(leadsById[t.leadId] || {})
      }));
    }

    const { data, error } = await supabase
      .from('call_trackers')
      .select(`
        *,
        leads!lead_id (
          id,
          lead_no,
          person_name,
          number,
          email,
          dob,
          occupation,
          investment_budget,
          location,
          when_to_buy_plan,
          requirement,
          remarks,
          timestamp,
          master_lead_types!lead_type_id (id, lead_type),
          master_lead_receivers!lead_receiver_id (id, person_name),
          master_lead_sources!lead_source_id (id, lead_source),
          master_caller_names!caller_assigned_id (id, person_name)
        )
      `)
      .order('timestamp_ms', { ascending: true });

    if (error) {
      console.error('Error fetching joined call trackers from Supabase:', error);
      const [leads, trackers] = await Promise.all([
        leadApi.getLeads(),
        getLocalCallTrackers()
      ]);
      const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));
      return trackers.map(t => ({
        ...t,
        ...(leadsById[t.leadId] || {})
      }));
    }

    return (data || []).map(row => {
      const lead = row.leads || {};
      return {
        id: row.id,
        leadId: row.lead_id,
        leadNo: row.lead_no || lead.lead_no || '',
        status: row.status,
        customerSaid: row.customer_said || '',
        nextDate: row.next_date || '',
        timestamp: row.timestamp || '',
        timestampMs: Number(row.timestamp_ms) || 0,
        // Joined Lead details via Foreign Key
        personName: lead.person_name || '',
        number: lead.number || '',
        email: lead.email || '',
        dob: lead.dob || '',
        occupation: lead.occupation || '',
        investmentBudget: lead.investment_budget || '',
        location: lead.location || '',
        whenToBuyPlan: lead.when_to_buy_plan || '',
        requirement: lead.requirement || '',
        remarks: lead.remarks || '',
        leadDate: lead.timestamp || '',
        leadType: lead.master_lead_types?.lead_type || lead.lead_type || '',
        leadReceiver: lead.master_lead_receivers?.person_name || lead.lead_receiver || '',
        leadSource: lead.master_lead_sources?.lead_source || lead.lead_source || '',
        callerAssigned: lead.master_caller_names?.person_name || lead.caller_assigned || ''
      };
    });
  },

  // Save new call outcome log entry
  async saveCallTracker(entry) {
    if (!isSupabaseConfigured) {
      const res = saveLocalCallTracker(entry);
      refreshBadgeCounts();
      return res;
    }

    const payload = this.mapToDb(entry);
    const { data, error } = await supabase
      .from('call_trackers')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error saving call tracker to Supabase:', error);
      saveLocalCallTracker(entry);
      refreshBadgeCounts();
      throw error;
    }

    const created = this.mapFromDb(data);
    saveLocalCallTracker(created);
    refreshBadgeCounts();
    return created;
  },

  // Delete call tracker entry
  async deleteCallTracker(id) {
    if (!isSupabaseConfigured) {
      const res = deleteLocalCallTracker(id);
      refreshBadgeCounts();
      return res;
    }

    const { error } = await supabase
      .from('call_trackers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting call tracker from Supabase:', error);
      throw error;
    }

    deleteLocalCallTracker(id);
    refreshBadgeCounts();
  }
};
