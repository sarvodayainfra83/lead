import { supabase, isSupabaseConfigured } from './supabaseClient';
import { leadApi } from './leadApi';
import { visitorApi } from './visitorApi';
import { callTrackerApi } from './callTrackerApi';
import {
  getVisitorFollowUps as getLocalVisitorFollowUps,
  saveVisitorFollowUp as saveLocalVisitorFollowUp,
  updateVisitorFollowUp as updateLocalVisitorFollowUp,
  deleteVisitorFollowUp as deleteLocalVisitorFollowUp
} from '../utils/storageManager';
import { refreshBadgeCounts } from '../store/badgeCountStore';

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

export const visitorFollowUpApi = {
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
      assignedVisitorId: row.assigned_visitor_id,
      visitorName: row.visitor_name,
      visitorId: row.visitor_id,
      visitDate: row.visit_date,
      status: row.status,
      interestLevel: row.interest_level || '',
      whatHappened: row.what_happened || '',
      nextVisitDate: row.next_visit_date || '',
      dealOutcome: row.deal_outcome || '',
      rejectionReason: row.rejection_reason || row.reason || '',
      salesExecutive: row.sales_executive || '',
      closingAmount: row.closing_amount !== null && row.closing_amount !== undefined ? row.closing_amount : '',
      referenceNo: row.reference_no || '',
      dealRemarks: row.deal_remarks || '',
      followUpNo: row.follow_up_no || 1,
      timestampMs: row.timestamp_ms || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      createdAt: row.created_at || new Date().toISOString()
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

    let nextVisitDate = entry.nextVisitDate;
    if (nextVisitDate && String(nextVisitDate).includes('/')) {
      const parts = String(nextVisitDate).trim().split(' ')[0].split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        const fullYear = y < 100 ? 2000 + y : y;
        nextVisitDate = `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    const leadId = resolvedLeadId || (isUuid(entry.leadId) ? entry.leadId : null);
    const assignedVisitorId = isUuid(entry.assignedVisitorId) ? entry.assignedVisitorId : null;
    const visitorId = isUuid(entry.visitorId) ? entry.visitorId : null;

    return {
      lead_id: leadId,
      lead_no: entry.leadNo,
      assigned_visitor_id: assignedVisitorId,
      visitor_name: entry.visitorName,
      visitor_id: visitorId,
      visit_date: visitDate || null,
      status: entry.status,
      interest_level: entry.interestLevel || null,
      what_happened: entry.whatHappened || '',
      next_visit_date: nextVisitDate || null,
      deal_outcome: entry.dealOutcome || null,
      rejection_reason: entry.rejectionReason || entry.reason || null,
      sales_executive: entry.salesExecutive || null,
      closing_amount: entry.closingAmount !== null && entry.closingAmount !== undefined && String(entry.closingAmount).trim() !== '' ? String(entry.closingAmount).trim() : null,
      reference_no: entry.referenceNo || null,
      deal_remarks: entry.dealRemarks || null,
      follow_up_no: entry.followUpNo || 1,
      timestamp_ms: entry.timestampMs || Date.now()
    };
  },

  // Get all follow up records
  async getVisitorFollowUps() {
    if (!isSupabaseConfigured) {
      return getLocalVisitorFollowUps();
    }

    const { data, error } = await supabase
      .from('visitor_follow_ups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching visitor follow ups from Supabase:', error);
      return getLocalVisitorFollowUps();
    }

    return data.map(this.mapFromDb);
  },

  // Save a new visitor follow up entry
  async saveVisitorFollowUp(entry) {
    if (!isSupabaseConfigured) {
      const saved = saveLocalVisitorFollowUp({
        ...entry,
        id: entry.id || `VFU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
      .from('visitor_follow_ups')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error saving visitor follow up to Supabase:', error);
      const fallback = saveLocalVisitorFollowUp({
        ...entry,
        id: entry.id || `VFU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString()
      });
      refreshBadgeCounts();
      throw error;
    }

    const created = this.mapFromDb(data);
    saveLocalVisitorFollowUp(created);
    refreshBadgeCounts();
    return created;
  },

  // Update existing follow up
  async updateVisitorFollowUp(id, updatedFields) {
    if (!isSupabaseConfigured) {
      const res = updateLocalVisitorFollowUp(id, updatedFields);
      refreshBadgeCounts();
      return res;
    }

    const payload = {};
    if (updatedFields.status !== undefined) payload.status = updatedFields.status;
    if (updatedFields.interestLevel !== undefined) payload.interest_level = updatedFields.interestLevel;
    if (updatedFields.whatHappened !== undefined) payload.what_happened = updatedFields.whatHappened;
    if (updatedFields.nextVisitDate !== undefined) payload.next_visit_date = updatedFields.nextVisitDate;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('visitor_follow_ups')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating visitor follow up in Supabase:', error);
      updateLocalVisitorFollowUp(id, updatedFields);
      refreshBadgeCounts();
      throw error;
    }

    const updated = this.mapFromDb(data);
    updateLocalVisitorFollowUp(id, updated);
    refreshBadgeCounts();
    return updated;
  },

  // Delete follow up
  async deleteVisitorFollowUp(id) {
    if (!isSupabaseConfigured) {
      deleteLocalVisitorFollowUp(id);
      refreshBadgeCounts();
      return;
    }

    const { error } = await supabase
      .from('visitor_follow_ups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting visitor follow up from Supabase:', error);
    }
    deleteLocalVisitorFollowUp(id);
    refreshBadgeCounts();
  },

  // Get leads in Pending Visitor Follow Up queue
  async getPendingFollowUpsWithLeads() {
    const [leads, assignedVisitors, followUps, trackers] = await Promise.all([
      leadApi.getLeads(),
      visitorApi.getAssignedVisitors(),
      this.getVisitorFollowUps(),
      callTrackerApi.getCallTrackers()
    ]);

    const leadsById = Object.fromEntries(leads.map(l => [String(l.id), l]));
    const leadsByNo = Object.fromEntries(leads.map(l => [String(l.leadNo), l]));

    // Group follow-ups by leadId/leadNo
    const followUpsByLead = {};
    followUps.forEach(f => {
      const key = String(f.leadId || f.leadNo);
      if (!followUpsByLead[key]) followUpsByLead[key] = [];
      followUpsByLead[key].push(f);
    });

    // Active assigned visitors
    const activeAssignments = assignedVisitors.filter(a => a.status !== 'Cancelled');

    // Group assignments by lead (take latest if multiple)
    const latestAssignmentByLead = {};
    activeAssignments.forEach(a => {
      const key = String(a.leadId || a.leadNo);
      if (!latestAssignmentByLead[key] || new Date(a.timestamp || a.created_at || 0) > new Date(latestAssignmentByLead[key].timestamp || latestAssignmentByLead[key].created_at || 0)) {
        latestAssignmentByLead[key] = a;
      }
    });

    const pendingList = [];

    Object.entries(latestAssignmentByLead).forEach(([leadKey, assignment]) => {
      const lead = leadsById[String(assignment.leadId)] || leadsByNo[String(assignment.leadNo)] || leadsById[leadKey] || leadsByNo[leadKey] || {};
      const leadFollowUps = (followUpsByLead[String(lead.id)] || followUpsByLead[String(lead.leadNo)] || followUpsByLead[leadKey] || [])
        .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));

      const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;

      // If no follow-up yet -> Pending (Follow Up No = 0)
      // If latest follow-up is 'Future Plan' -> Still Pending (Follow Up No = count)
      // If 'Interested', 'Not Interested', or 'Did Not Show' -> Completed / Converted (Not Pending)
      const isPending = !latestFollowUp || latestFollowUp.status === 'Future Plan';

      if (isPending) {
        // Trackers for this lead to get initial visit remarks
        const trackersForLead = trackers.filter(t => String(t.leadId || t.leadNo) === String(lead.id || lead.leadNo));
        const latestTracker = trackersForLead[trackersForLead.length - 1] || null;

        pendingList.push({
          ...lead,
          assignedVisitorId: assignment.id,
          assignedVisitor: assignment.visitorName,
          visitorId: assignment.visitorId,
          visitDate: latestFollowUp?.nextVisitDate || assignment.visitDate || lead.visitDate || '',
          location: assignment.location || lead.customerAddress || lead.location || '',
          relationshipManager: lead.leadReceiver || lead.personName || '',
          visitRemarks: latestTracker?.customerSaid || lead.remarks || '',
          visitorRemarks: assignment.remarks || '',
          followUpNo: leadFollowUps.length,
          status: latestFollowUp?.status || '',
          interestLevel: latestFollowUp?.interestLevel || '',
          whatHappened: latestFollowUp?.whatHappened || '',
          nextVisitDate: latestFollowUp?.nextVisitDate || ''
        });
      }
    });

    return pendingList;
  },

  // Get all history follow up logs joined with lead information
  async getHistoryFollowUpsWithLeads() {
    const [leads, followUps, assignedVisitors, trackers] = await Promise.all([
      leadApi.getLeads(),
      this.getVisitorFollowUps(),
      visitorApi.getAssignedVisitors(),
      callTrackerApi.getCallTrackers()
    ]);

    const leadsById = Object.fromEntries(leads.map(l => [String(l.id), l]));
    const leadsByNo = Object.fromEntries(leads.map(l => [String(l.leadNo), l]));
    const assignmentsById = Object.fromEntries(assignedVisitors.map(a => [String(a.id), a]));

    return followUps.map((fu, idx) => {
      const lead = leadsById[String(fu.leadId)] || leadsByNo[String(fu.leadNo)] || {};
      const assignment = assignmentsById[String(fu.assignedVisitorId)] || {};
      const trackersForLead = trackers.filter(t => String(t.leadId || t.leadNo) === String(lead.id || lead.leadNo));
      const latestTracker = trackersForLead[trackersForLead.length - 1] || null;

      return {
        ...lead,
        ...fu,
        id: fu.id || `fu-${idx}`,
        leadNo: fu.leadNo || lead.leadNo || '-',
        leadDate: lead.timestamp || lead.date || lead.created_at || '',
        assignedVisitor: fu.visitorName || assignment.visitorName || '-',
        visitDate: fu.visitDate || assignment.visitDate || '',
        followUpNo: fu.followUpNo || 1,
        status: fu.status,
        interestLevel: fu.interestLevel || '-',
        dealOutcome: fu.dealOutcome || '',
        rejectionReason: fu.rejectionReason || '',
        salesExecutive: fu.salesExecutive || '',
        closingAmount: fu.closingAmount || '',
        referenceNo: fu.referenceNo || '',
        dealRemarks: fu.dealRemarks || '',
        whatHappened: fu.whatHappened || '-',
        nextVisitDate: fu.nextVisitDate || '-',
        location: assignment.location || lead.customerAddress || lead.location || '-',
        relationshipManager: lead.leadReceiver || lead.personName || '-',
        leadType: lead.leadType || '-',
        leadSource: lead.leadSource || '-',
        referencerName: lead.referencerName || '-',
        productType: lead.productType || '-',
        requirement: lead.requirement || '-',
        insuranceSubType: lead.insuranceSubType || '-',
        customerName: lead.customerName || lead.personName || '-',
        customerNumber: lead.customerNumber || lead.number || '-',
        customerEmail: lead.customerEmail || lead.email || '-',
        dob: lead.dob || '',
        occupation: lead.occupation || '-',
        investmentBudget: lead.investmentBudget || '-',
        customerAddress: lead.customerAddress || lead.location || '-',
        whenToBuyPlan: lead.whenToBuyPlan || '-',
        anyDesease: lead.anyDesease || '-',
        remarks: lead.remarks || '-',
        visitRemarks: latestTracker?.customerSaid || '-',
        visitorRemarks: assignment.remarks || '-',
        followUpLoggedAt: fu.createdAt || fu.timestamp || ''
      };
    });
  }
};
