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
      next_date: entry.nextDate && String(entry.nextDate).trim() ? String(entry.nextDate).trim() : null,
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
    const [leads, trackers] = await Promise.all([
      leadApi.getLeads(),
      this.getCallTrackers()
    ]);
    const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));
    return trackers.map(t => {
      const lead = leadsById[t.leadId] || {};
      return {
        ...t,
        ...lead,
        id: t.id,
        leadId: t.leadId,
        leadNo: t.leadNo || lead.leadNo || '',
        leadDate: lead.timestamp || '',
        personName: lead.customerName || lead.personName || '',
        number: lead.customerNumber || lead.number || '',
        email: lead.customerEmail || lead.email || '',
        location: lead.customerAddress || lead.location || ''
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
