import { supabase, isSupabaseConfigured } from './supabaseClient';
import { leadApi } from './leadApi';
import {
  getCallTrackers as getLocalCallTrackers,
  saveCallTracker as saveLocalCallTracker,
  saveCallTrackers as saveLocalCallTrackers,
  deleteCallTracker as deleteLocalCallTracker
} from '../utils/storageManager';
import { refreshBadgeCounts } from '../store/badgeCountStore';
import { normalizeCustomerStatus } from '../pages/CallTracker/callTrackerConstants';
import { nowIST } from './leadApi';

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
      timestampMs: Number(row.timestamp_ms),
      customerStatus: normalizeCustomerStatus(row.customer_status),
      adminRemark: row.admin_remark || '',
      adminRemarkDate: row.admin_remark_date || null,
      userRemark: row.user_remark || '',
      updatedAt: row.updated_at || null
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
      timestamp_ms: entry.timestampMs || Date.now(),
      customer_status: entry.customerStatus || null,
      updated_at: new Date().toISOString()
    };
  },

  // Admin: add / edit the admin remark on a single call tracker row (stamps updated_at)
  async updateAdminRemark(id, adminRemark) {
    const updatedAt = nowIST();
    const remark = String(adminRemark || '').trim();

    const updateLocal = () => {
      const trackers = getLocalCallTrackers();
      saveLocalCallTrackers(trackers.map(t => (
        String(t.id) === String(id) ? { ...t, adminRemark: remark, updatedAt } : t
      )));
    };

    if (!isSupabaseConfigured) {
      updateLocal();
      return { id, adminRemark: remark, updatedAt };
    }

    const { data, error } = await supabase
      .from('call_trackers')
      .update({ admin_remark: remark || null, admin_remark_date: updatedAt, updated_at: updatedAt })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating admin remark in Supabase:', error);
      throw error;
    }

    updateLocal();
    return this.mapFromDb(data);
  },

  // Update customer status (Hot / Warm / Cold) on a call tracker row
  async updateCustomerStatus(id, customerStatus) {
    const updatedAt = new Date().toISOString();
    const status = normalizeCustomerStatus(customerStatus);

    const updateLocal = () => {
      const trackers = getLocalCallTrackers();
      saveLocalCallTrackers(trackers.map(t => (
        String(t.id) === String(id) ? { ...t, customerStatus: status, updatedAt } : t
      )));
    };

    if (!isSupabaseConfigured) {
      updateLocal();
      return { id, customerStatus: status, updatedAt };
    }

    try {
      const { data, error } = await supabase
        .from('call_trackers')
        .update({ customer_status: status || null, updated_at: updatedAt })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.warn('Error updating customer status in Supabase:', error);
      } else if (data) {
        updateLocal();
        return this.mapFromDb(data);
      }
    } catch (e) {
      console.warn('Exception updating customer status in Supabase:', e);
    }

    updateLocal();
    return { id, customerStatus: status, updatedAt };
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

  // Get the full call history of a single lead (call_trackers.lead_id), oldest first
  async getCallTrackersByLeadId(leadId) {
    if (leadId == null || leadId === '') return [];
    const localForLead = () => getLocalCallTrackers()
      .filter(t => String(t.leadId) === String(leadId))
      .sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0));

    if (!isSupabaseConfigured) {
      return localForLead();
    }

    const { data, error } = await supabase
      .from('call_trackers')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp_ms', { ascending: true });

    if (error) {
      console.error('Error fetching call trackers for lead from Supabase:', error);
      return localForLead();
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
    const leadsByNo = Object.fromEntries(leads.map(l => [l.leadNo, l]));
    const restricted = leadApi.isLeadTypeRestricted();
    return trackers
      .filter(t => !restricted || leadsById[t.leadId] || leadsByNo[t.leadNo])
      .map(t => {
        const lead = leadsById[t.leadId] || leadsByNo[t.leadNo] || {};
        return {
          ...lead,
          ...t,
          id: t.id,
          leadId: t.leadId || lead.id,
          leadNo: t.leadNo || lead.leadNo || '',
          leadDate: lead.timestamp || '',
          personName: lead.customerName || lead.personName || '',
          number: lead.customerNumber || lead.number || '',
          email: lead.customerEmail || lead.email || '',
          location: lead.customerAddress || lead.location || '',
          requirement: lead.requirement || '',
          investmentBudget: lead.investmentBudget || '',
          whenToBuyPlan: lead.whenToBuyPlan || '',
          callerAssigned: lead.callerAssigned || t.callerAssigned || '',
          leadSource: lead.leadSource || ''
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
