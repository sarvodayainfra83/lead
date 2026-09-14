import { supabase, isSupabaseConfigured } from './supabaseClient';
import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import {
  getAssignedVisitors as getLocalAssignedVisitors,
  saveAssignedVisitor as saveLocalAssignedVisitor,
  updateAssignedVisitor as updateLocalAssignedVisitor,
  deleteAssignedVisitor as deleteLocalAssignedVisitor
} from '../utils/storageManager';
import { refreshBadgeCounts } from '../store/badgeCountStore';
import { getLatestTrackerForLead } from '../pages/CallTracker/callTrackerConstants';

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

export const visitorApi = {
  // Helper to validate UUID
  isUuid(val) {
    return isUuid(val);
  },

  // Map DB row -> Frontend Model
  mapFromDb(row) {
    return {
      id: row.id,
      leadId: row.lead_id,
      leadNo: row.lead_no,
      callTrackerId: row.call_tracker_id,
      visitorName: row.visitor_name,
      visitorId: row.visitor_id,
      visitDate: row.visit_date,
      location: row.location || '',
      remarks: row.remarks || '',
      status: row.status || 'Assigned',
      assignedBy: row.assigned_by || '',
      timestamp: row.timestamp || row.created_at || new Date().toISOString()
    };
  },

  // Map Frontend Model -> DB row
  mapToDb(entry, resolvedLeadId = null) {
    let visitDate = entry.visitDate;
    if (visitDate && String(visitDate).includes('/')) {
      const parts = String(visitDate).trim().split(' ')[0].split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        const fullYear = y < 100 ? 2000 + y : y;
        visitDate = `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    const leadId = resolvedLeadId || (isUuid(entry.leadId) ? entry.leadId : null);
    const callTrackerId = isUuid(entry.callTrackerId) ? entry.callTrackerId : null;
    const visitorId = isUuid(entry.visitorId) ? entry.visitorId : null;

    return {
      lead_id: leadId,
      lead_no: entry.leadNo,
      call_tracker_id: callTrackerId,
      visitor_name: entry.visitorName,
      visitor_id: visitorId,
      visit_date: visitDate || null,
      location: entry.location || '',
      remarks: entry.remarks || '',
      status: entry.status || 'Assigned',
      assigned_by: entry.assignedBy || '',
      timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString()
    };
  },

  // Get all assigned visitor records
  async getAssignedVisitors() {
    if (!isSupabaseConfigured) {
      return getLocalAssignedVisitors();
    }

    const { data, error } = await supabase
      .from('assigned_visitors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching assigned visitors from Supabase:', error);
      return getLocalAssignedVisitors();
    }

    return data.map(this.mapFromDb);
  },

  // Save new visitor assignment
  async saveAssignedVisitor(entry) {
    if (!isSupabaseConfigured) {
      const saved = saveLocalAssignedVisitor({
        ...entry,
        id: entry.id || `AV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString()
      });
      refreshBadgeCounts();
      return saved;
    }

    // Resolve lead_id if not already a UUID
    let leadId = isUuid(entry.leadId) ? entry.leadId : null;
    if (!leadId && entry.leadNo) {
      try {
        const { data: leadRow } = await supabase
          .from('leads')
          .select('id')
          .eq('lead_no', entry.leadNo)
          .maybeSingle();
        if (leadRow?.id) leadId = leadRow.id;
      } catch (e) {
        console.warn('Could not resolve lead_id by lead_no:', e);
      }
    }

    const payload = this.mapToDb(entry, leadId);
    const { data, error } = await supabase
      .from('assigned_visitors')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error saving assigned visitor to Supabase:', error);
      const fallback = saveLocalAssignedVisitor({
        ...entry,
        id: entry.id || `AV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString()
      });
      refreshBadgeCounts();
      throw error;
    }

    const created = this.mapFromDb(data);
    saveLocalAssignedVisitor(created);
    refreshBadgeCounts();
    return created;
  },

  // Update existing visitor assignment
  async updateAssignedVisitor(id, updatedFields) {
    if (!isSupabaseConfigured) {
      const res = updateLocalAssignedVisitor(id, updatedFields);
      refreshBadgeCounts();
      return res;
    }

    const payload = {};
    if (updatedFields.visitorName !== undefined) payload.visitor_name = updatedFields.visitorName;
    if (updatedFields.visitDate !== undefined) payload.visit_date = updatedFields.visitDate;
    if (updatedFields.location !== undefined) payload.location = updatedFields.location;
    if (updatedFields.remarks !== undefined) payload.remarks = updatedFields.remarks;
    if (updatedFields.status !== undefined) payload.status = updatedFields.status;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('assigned_visitors')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating assigned visitor in Supabase:', error);
      updateLocalAssignedVisitor(id, updatedFields);
      refreshBadgeCounts();
      throw error;
    }

    const updated = this.mapFromDb(data);
    updateLocalAssignedVisitor(id, updated);
    refreshBadgeCounts();
    return updated;
  },

  // Delete visitor assignment
  async deleteAssignedVisitor(id) {
    if (!isSupabaseConfigured) {
      deleteLocalAssignedVisitor(id);
      refreshBadgeCounts();
      return;
    }

    const { error } = await supabase
      .from('assigned_visitors')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting assigned visitor from Supabase:', error);
    }
    deleteLocalAssignedVisitor(id);
    refreshBadgeCounts();
  },

  // Get all leads awaiting visitor assignment (latest Call Tracker status is 'Site Visit/Meeting' and not yet assigned)
  async getPendingVisitorsWithLeads() {
    const [leads, trackers, assigned] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      this.getAssignedVisitors()
    ]);

    // Assigned lead ids/numbers
    const assignedLeadMap = new Set(
      assigned
        .filter(a => a.status !== 'Cancelled')
        .map(a => String(a.leadId || a.leadNo))
    );

    return leads
      .filter(lead => {
        const latest = getLatestTrackerForLead(trackers, lead.id, lead.leadNo);
        if (!latest || latest.status !== 'Site Visit/Meeting') return false;
        // Not already assigned
        return !assignedLeadMap.has(String(lead.id)) && !assignedLeadMap.has(String(lead.leadNo));
      })
      .map(lead => {
        const latest = getLatestTrackerForLead(trackers, lead.id, lead.leadNo);
        return {
          ...lead,
          callTrackerId: latest?.id,
          visitDate: latest?.nextDate || '',
          relationshipManager: lead.leadReceiver || lead.personName || '',
          visitRemarks: latest?.customerSaid || ''
        };
      });
  },

  // Get full history of assigned visitors joined with lead details
  async getHistoryVisitorsWithLeads() {
    const [leads, trackers, assigned] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      this.getAssignedVisitors()
    ]);

    const leadsById = Object.fromEntries(leads.map(l => [String(l.id), l]));
    const leadsByNo = Object.fromEntries(leads.map(l => [String(l.leadNo), l]));

    return assigned.map(item => {
      const lead = leadsById[String(item.leadId)] || leadsByNo[String(item.leadNo)] || {};
      const latestTracker = getLatestTrackerForLead(trackers, lead.id || item.leadId, lead.leadNo || item.leadNo);
      return {
        ...lead,
        ...item,
        id: item.id,
        leadId: item.leadId,
        leadNo: item.leadNo || lead.leadNo || '',
        leadDate: lead.timestamp || '',
        assignedVisitor: item.visitorName || '',
        visitDate: item.visitDate || '',
        location: item.location || lead.customerAddress || lead.location || '',
        visitorRemarks: item.remarks || '',
        relationshipManager: lead.leadReceiver || '',
        callTrackerRemarks: latestTracker?.customerSaid || '',
        assignedAt: item.timestamp || item.created_at || ''
      };
    });
  }
};
