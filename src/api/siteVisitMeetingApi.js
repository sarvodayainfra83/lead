import { supabase, isSupabaseConfigured } from './supabaseClient';
import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import {
  getAssignedVisitors as getLocalAssignedVisitors,
  saveAssignedVisitor as saveLocalAssignedVisitor,
  updateAssignedVisitor as updateLocalAssignedVisitor,
  deleteAssignedVisitor as deleteLocalAssignedVisitor,
  getVisitorFollowUps as getLocalVisitorFollowUps,
  saveVisitorFollowUp as saveLocalVisitorFollowUp,
  updateVisitorFollowUp as updateLocalVisitorFollowUp,
  deleteVisitorFollowUp as deleteLocalVisitorFollowUp
} from '../utils/storageManager';
import { refreshBadgeCounts } from '../store/badgeCountStore';
import { getLatestTrackerForLead, normalizeCustomerStatus } from '../pages/CallTracker/callTrackerConstants';

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

const formatDateForDb = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      const fullYear = y < 100 ? 2000 + y : y;
      return `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-').map(Number);
    return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
};

/**
 * siteVisitMeetingApi
 * Unified API managing both Visitor Assignments and Visit Follow-Ups for the
 * Site Visit / Meeting module.
 */
export const siteVisitMeetingApi = {
  isUuid(val) {
    return isUuid(val);
  },

  // ---------------------------------------------------------------------------
  // ASSIGNED VISITORS (assigned_visitors table)
  // ---------------------------------------------------------------------------
  mapAssignedVisitorFromDb(row) {
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

  mapAssignedVisitorToDb(entry, resolvedLeadId = null) {
    const leadId = resolvedLeadId || (isUuid(entry.leadId) ? entry.leadId : null);
    const callTrackerId = isUuid(entry.callTrackerId) ? entry.callTrackerId : null;
    const visitorId = isUuid(entry.visitorId) ? entry.visitorId : null;

    return {
      lead_id: leadId,
      lead_no: entry.leadNo,
      call_tracker_id: callTrackerId,
      visitor_name: entry.visitorName,
      visitor_id: visitorId,
      visit_date: formatDateForDb(entry.visitDate),
      location: entry.location || '',
      remarks: entry.remarks || '',
      status: entry.status || 'Assigned',
      assigned_by: entry.assignedBy || '',
      timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString()
    };
  },

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
    return data.map(this.mapAssignedVisitorFromDb);
  },

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

    const payload = this.mapAssignedVisitorToDb(entry, leadId);
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

    const created = this.mapAssignedVisitorFromDb(data);
    saveLocalAssignedVisitor(created);
    refreshBadgeCounts();
    return created;
  },

  async updateAssignedVisitor(id, updatedFields) {
    if (!isSupabaseConfigured) {
      const res = updateLocalAssignedVisitor(id, updatedFields);
      refreshBadgeCounts();
      return res;
    }

    const payload = {};
    if (updatedFields.visitorName !== undefined) payload.visitor_name = updatedFields.visitorName;
    if (updatedFields.visitorId !== undefined) payload.visitor_id = updatedFields.visitorId;
    if (updatedFields.visitDate !== undefined) payload.visit_date = formatDateForDb(updatedFields.visitDate);
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

    const updated = this.mapAssignedVisitorFromDb(data);
    updateLocalAssignedVisitor(id, updated);
    refreshBadgeCounts();
    return updated;
  },

  async deleteAssignedVisitor(id) {
    if (!isSupabaseConfigured) {
      deleteLocalAssignedVisitor(id);
      refreshBadgeCounts();
      return;
    }
    const { error } = await supabase.from('assigned_visitors').delete().eq('id', id);
    if (error) console.error('Error deleting assigned visitor from Supabase:', error);
    deleteLocalAssignedVisitor(id);
    refreshBadgeCounts();
  },

  // ---------------------------------------------------------------------------
  // VISITOR FOLLOW UPS (visitor_follow_ups table)
  // ---------------------------------------------------------------------------
  mapFollowUpFromDb(row) {
    const rawStatus = row.customer_status || row.interest_level || '';
    let customerStatus = normalizeCustomerStatus(rawStatus);
    if (!customerStatus && rawStatus) {
      const s = String(rawStatus).trim().toLowerCase();
      if (s === 'high' || s === 'hot') customerStatus = 'Hot';
      else if (s === 'medium' || s === 'warm') customerStatus = 'Warm';
      else if (s === 'low' || s === 'cold') customerStatus = 'Cold';
    }

    return {
      id: row.id,
      leadId: row.lead_id,
      leadNo: row.lead_no,
      assignedVisitorId: row.assigned_visitor_id,
      visitorName: row.visitor_name,
      visitorId: row.visitor_id,
      visitDate: row.visit_date,
      status: row.status,
      customerStatus: customerStatus || '',
      customer_status: customerStatus || '',
      interestLevel: customerStatus || '',
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

  mapFollowUpToDb(entry, resolvedLeadId = null) {
    const leadId = resolvedLeadId || (isUuid(entry.leadId) ? entry.leadId : null);
    const assignedVisitorId = isUuid(entry.assignedVisitorId) ? entry.assignedVisitorId : null;
    const visitorId = isUuid(entry.visitorId) ? entry.visitorId : null;

    const rawStatus = entry.customerStatus || entry.customer_status || entry.interestLevel || null;
    let customerStatus = normalizeCustomerStatus(rawStatus);
    if (!customerStatus && rawStatus) {
      const s = String(rawStatus).trim().toLowerCase();
      if (s === 'high' || s === 'hot') customerStatus = 'Hot';
      else if (s === 'medium' || s === 'warm') customerStatus = 'Warm';
      else if (s === 'low' || s === 'cold') customerStatus = 'Cold';
    }

    // Map to old constraint values ('High', 'Medium', 'Low') for legacy interest_level column compatibility
    const legacyInterestLevel = customerStatus === 'Hot' ? 'High' : (customerStatus === 'Warm' ? 'Medium' : (customerStatus === 'Cold' ? 'Low' : null));

    return {
      lead_id: leadId,
      lead_no: entry.leadNo,
      assigned_visitor_id: assignedVisitorId,
      visitor_name: entry.visitorName,
      visitor_id: visitorId,
      visit_date: formatDateForDb(entry.visitDate),
      status: entry.status,
      customer_status: customerStatus || null,
      interest_level: legacyInterestLevel,
      what_happened: entry.whatHappened || '',
      next_visit_date: formatDateForDb(entry.nextVisitDate),
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
    return data.map(this.mapFollowUpFromDb);
  },

  async getVisitorFollowUpsByLeadId(leadId, leadNo = null) {
    if (!isSupabaseConfigured) {
      const all = getLocalVisitorFollowUps();
      return all
        .filter(f => (leadId && String(f.leadId) === String(leadId)) || (leadNo && String(f.leadNo) === String(leadNo)))
        .sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0));
    }

    let query = supabase.from('visitor_follow_ups').select('*');
    if (leadId && isUuid(leadId)) {
      query = query.eq('lead_id', leadId);
    } else if (leadNo) {
      query = query.eq('lead_no', leadNo);
    } else if (leadId) {
      query = query.eq('lead_no', leadId);
    } else {
      return [];
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.warn('Error fetching visitor follow ups by leadId from Supabase:', error.message);
      const all = getLocalVisitorFollowUps();
      return all
        .filter(f => (leadId && String(f.leadId) === String(leadId)) || (leadNo && String(f.leadNo) === String(leadNo)))
        .sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0));
    }
    return data.map(this.mapFollowUpFromDb);
  },

  async saveVisitorFollowUp(entry) {
    const rawCustStatus = entry.customerStatus || entry.customer_status || '';
    let customerStatus = normalizeCustomerStatus(rawCustStatus);
    if (!customerStatus && rawCustStatus) {
      const s = String(rawCustStatus).trim().toLowerCase();
      if (s === 'high' || s === 'hot') customerStatus = 'Hot';
      else if (s === 'medium' || s === 'warm') customerStatus = 'Warm';
      else if (s === 'low' || s === 'cold') customerStatus = 'Cold';
    }

    const normalizedEntry = {
      ...entry,
      customerStatus: customerStatus || '',
      customer_status: customerStatus || '',
      interestLevel: customerStatus || ''
    };

    if (!isSupabaseConfigured) {
      const saved = saveLocalVisitorFollowUp({
        ...normalizedEntry,
        id: normalizedEntry.id || `VFU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString()
      });

      // Sync customer_status to call tracker
      if (customerStatus && (normalizedEntry.leadId || normalizedEntry.leadNo)) {
        try {
          const trackers = await callTrackerApi.getCallTrackers();
          const leadTrackers = trackers
            .filter(t => String(t.leadId) === String(normalizedEntry.leadId) || String(t.leadNo) === String(normalizedEntry.leadNo))
            .sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0));
          const latestTracker = leadTrackers[leadTrackers.length - 1];
          if (latestTracker?.id) {
            await callTrackerApi.updateCustomerStatus(latestTracker.id, customerStatus);
          }
        } catch (trackerErr) {
          console.warn('Could not sync customer_status to call_tracker:', trackerErr);
        }
      }

      refreshBadgeCounts();
      return saved;
    }

    let leadId = isUuid(normalizedEntry.leadId) ? normalizedEntry.leadId : null;
    if (!leadId && normalizedEntry.leadNo) {
      try {
        const { data: leadRow } = await supabase
          .from('leads')
          .select('id')
          .eq('lead_no', normalizedEntry.leadNo)
          .maybeSingle();
        if (leadRow?.id) leadId = leadRow.id;
      } catch (e) {
        console.warn('Could not resolve lead_id by lead_no:', e);
      }
    }

    const payload = this.mapFollowUpToDb(normalizedEntry, leadId);
    let { data, error } = await supabase
      .from('visitor_follow_ups')
      .insert(payload)
      .select()
      .single();

    // Fallback: if Supabase doesn't have customer_status column yet
    if (error && error.message && error.message.includes('customer_status')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.customer_status;
      const retry = await supabase
        .from('visitor_follow_ups')
        .insert(fallbackPayload)
        .select()
        .single();
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }

    if (error) {
      console.error('Error saving visitor follow up to Supabase:', error);
      const fallback = saveLocalVisitorFollowUp({
        ...normalizedEntry,
        id: normalizedEntry.id || `VFU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString()
      });
      refreshBadgeCounts();
      throw error;
    }

    const created = this.mapFollowUpFromDb(data);
    saveLocalVisitorFollowUp(created);

    // Sync customer_status to latest call tracker
    if (customerStatus && (normalizedEntry.leadId || normalizedEntry.leadNo)) {
      try {
        const trackers = await callTrackerApi.getCallTrackers();
        const leadTrackers = trackers
          .filter(t => String(t.leadId) === String(normalizedEntry.leadId) || String(t.leadNo) === String(normalizedEntry.leadNo))
          .sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0));
        const latestTracker = leadTrackers[leadTrackers.length - 1];
        if (latestTracker?.id) {
          await callTrackerApi.updateCustomerStatus(latestTracker.id, customerStatus);
        }
      } catch (trackerErr) {
        console.warn('Could not sync customer_status to call_tracker:', trackerErr);
      }
    }

    refreshBadgeCounts();
    return created;
  },

  async updateVisitorFollowUp(id, updatedFields) {
    if (!isSupabaseConfigured) {
      const res = updateLocalVisitorFollowUp(id, updatedFields);
      refreshBadgeCounts();
      return res;
    }

    const payload = {};
    if (updatedFields.status !== undefined) payload.status = updatedFields.status;
    if (updatedFields.customerStatus !== undefined || updatedFields.customer_status !== undefined) {
      const raw = updatedFields.customerStatus || updatedFields.customer_status;
      let cs = normalizeCustomerStatus(raw);
      if (!cs && raw) {
        const s = String(raw).trim().toLowerCase();
        if (s === 'high' || s === 'hot') cs = 'Hot';
        else if (s === 'medium' || s === 'warm') cs = 'Warm';
        else if (s === 'low' || s === 'cold') cs = 'Cold';
      }
      payload.customer_status = cs || null;
      payload.interest_level = cs === 'Hot' ? 'High' : (cs === 'Warm' ? 'Medium' : (cs === 'Cold' ? 'Low' : null));
    } else if (updatedFields.interestLevel !== undefined) {
      payload.interest_level = updatedFields.interestLevel;
    }
    if (updatedFields.whatHappened !== undefined) payload.what_happened = updatedFields.whatHappened;
    if (updatedFields.nextVisitDate !== undefined) payload.next_visit_date = formatDateForDb(updatedFields.nextVisitDate);
    if (updatedFields.dealOutcome !== undefined) payload.deal_outcome = updatedFields.dealOutcome;
    if (updatedFields.rejectionReason !== undefined) payload.rejection_reason = updatedFields.rejectionReason;
    if (updatedFields.closingAmount !== undefined) payload.closing_amount = updatedFields.closingAmount;
    if (updatedFields.salesExecutive !== undefined) payload.sales_executive = updatedFields.salesExecutive;
    payload.updated_at = new Date().toISOString();

    let { data, error } = await supabase
      .from('visitor_follow_ups')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error && error.message && error.message.includes('customer_status')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.customer_status;
      const retry = await supabase
        .from('visitor_follow_ups')
        .update(fallbackPayload)
        .eq('id', id)
        .select()
        .single();
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }

    if (error) {
      console.error('Error updating visitor follow up in Supabase:', error);
      updateLocalVisitorFollowUp(id, updatedFields);
      refreshBadgeCounts();
      throw error;
    }

    const updated = this.mapFollowUpFromDb(data);
    updateLocalVisitorFollowUp(id, updated);
    refreshBadgeCounts();
    return updated;
  },

  async deleteVisitorFollowUp(id) {
    if (!isSupabaseConfigured) {
      deleteLocalVisitorFollowUp(id);
      refreshBadgeCounts();
      return;
    }
    const { error } = await supabase.from('visitor_follow_ups').delete().eq('id', id);
    if (error) console.error('Error deleting visitor follow up from Supabase:', error);
    deleteLocalVisitorFollowUp(id);
    refreshBadgeCounts();
  },

  // ---------------------------------------------------------------------------
  // UNIFIED SITE VISIT / MEETING DATA PIPELINE
  // ---------------------------------------------------------------------------

  /**
   * Fetches all leads in the Site Visit / Meeting pipeline, combining:
   * 1. Leads whose latest Call Tracker status is 'Site Visit/Meeting'
   * 2. Leads that have an assigned visitor record
   * 3. Leads that have visitor follow-up logs
   *
   * Computes clean stage statuses:
   * - 'Pending Assignment' (awaiting visitor)
   * - 'Assigned' (visitor assigned, awaiting visit/feedback)
   * - 'Future Plan' (re-visit scheduled)
   * - 'Interested' (Closed Won or In Progress)
   * - 'Not Interested' (Rejected)
   * - 'Did Not Show'
   */
  async getAllSiteVisitMeetingLeads() {
    const [leads, trackers, assignedVisitors, followUps] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      this.getAssignedVisitors(),
      this.getVisitorFollowUps()
    ]);

    const leadsById = Object.fromEntries(leads.map(l => [String(l.id), l]));
    const leadsByNo = Object.fromEntries(leads.map(l => [String(l.leadNo), l]));

    // Group assigned visitors by lead
    const assignmentsByLead = {};
    assignedVisitors.forEach(a => {
      if (a.status === 'Cancelled') return;
      const key = String(a.leadId || a.leadNo);
      if (!assignmentsByLead[key]) assignmentsByLead[key] = [];
      assignmentsByLead[key].push(a);
    });

    // Group follow-ups by lead
    const followUpsByLead = {};
    followUps.forEach(f => {
      const key = String(f.leadId || f.leadNo);
      if (!followUpsByLead[key]) followUpsByLead[key] = [];
      followUpsByLead[key].push(f);
    });

    // Map of leads that qualify for Site Visit / Meeting
    const candidateLeadsMap = new Map();

    // 1. Leads currently marked as Site Visit/Meeting in Call Tracker
    leads.forEach(lead => {
      const latest = getLatestTrackerForLead(trackers, lead.id, lead.leadNo);
      if (latest && String(latest.status || '').toLowerCase().includes('visit')) {
        candidateLeadsMap.set(String(lead.id), lead);
      }
    });

    // 2. Leads with assigned visitors
    assignedVisitors.forEach(a => {
      if (a.status === 'Cancelled') return;
      const lead = leadsById[String(a.leadId)] || leadsByNo[String(a.leadNo)];
      if (lead) {
        candidateLeadsMap.set(String(lead.id), lead);
      } else if (!leadApi.isLeadTypeRestricted()) {
        candidateLeadsMap.set(String(a.leadId || a.leadNo), {
          id: a.leadId,
          leadNo: a.leadNo,
          customerName: a.visitorName || 'Unknown Customer',
          customerAddress: a.location
        });
      }
    });

    // 3. Leads with follow up records
    followUps.forEach(f => {
      const lead = leadsById[String(f.leadId)] || leadsByNo[String(f.leadNo)];
      if (lead) {
        candidateLeadsMap.set(String(lead.id), lead);
      } else if (!leadApi.isLeadTypeRestricted()) {
        candidateLeadsMap.set(String(f.leadId || f.leadNo), {
          id: f.leadId,
          leadNo: f.leadNo
        });
      }
    });

    const unifiedList = [];

    candidateLeadsMap.forEach((lead) => {
      const leadKeyId = String(lead.id);
      const leadKeyNo = String(lead.leadNo);

      // Latest tracker
      const latestTracker = getLatestTrackerForLead(trackers, lead.id, lead.leadNo);

      // All assignments for this lead (sorted latest first)
      const leadAssignments = (assignmentsByLead[leadKeyId] || assignmentsByLead[leadKeyNo] || [])
        .sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));
      const latestAssignment = leadAssignments[0] || null;

      // All follow-ups for this lead (sorted chronologically)
      const leadFollowUps = (followUpsByLead[leadKeyId] || followUpsByLead[leadKeyNo] || [])
        .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
      const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;

      // Determine computed overall status
      let computedStatus = 'Pending Assignment';
      if (latestFollowUp) {
        computedStatus = latestFollowUp.status || 'Assigned';
      } else if (latestAssignment) {
        computedStatus = 'Assigned';
      }

      // Meeting Date: The date of the assigned visit or scheduled meeting
      const meetingDate = latestAssignment?.visitDate
        || latestTracker?.nextDate
        || lead.visitDate
        || (leadFollowUps.length > 0 ? leadFollowUps[0].visitDate : '')
        || '';

      // Next Meeting Date: Next visit/meeting date if available from latest follow-up
      const nextMeetingDate = latestFollowUp?.nextVisitDate || '';

      const scheduledVisitDate = nextMeetingDate || meetingDate || '';

      unifiedList.push({
        ...lead,
        id: latestAssignment?.id || latestFollowUp?.id || `svm-${lead.id}`,
        leadId: lead.id,
        leadNo: lead.leadNo || '',
        leadType: lead.leadType || '',
        leadSource: lead.leadSource || '',
        referencerName: lead.referencerName || '',
        productType: lead.productType || '',
        requirement: lead.requirement || '',
        insuranceSubType: lead.insuranceSubType || '',
        anyDesease: lead.anyDesease || '',
        customerName: lead.customerName || lead.personName || '',
        customerNumber: lead.customerNumber || lead.number || '',
        customerEmail: lead.customerEmail || lead.email || '',
        customerAddress: lead.customerAddress || lead.location || '',
        dob: lead.dob || '',
        occupation: lead.occupation || '',
        investmentBudget: lead.investmentBudget || '',
        whenToBuyPlan: lead.whenToBuyPlan || '',
        leadRemarks: lead.remarks || '',
        relationshipManager: lead.leadReceiver || lead.personName || '',
        // Dates
        meetingDate,
        nextMeetingDate,
        nextVisitDate: nextMeetingDate,
        visitDate: meetingDate || scheduledVisitDate,
        // Call Tracker info
        callTrackerId: latestTracker?.id || null,
        callTrackerRemarks: latestTracker?.customerSaid || '',
        // Visitor Assignment info
        assignedVisitorId: latestAssignment?.id || null,
        assignedVisitor: latestAssignment?.visitorName || latestFollowUp?.visitorName || '',
        visitorId: latestAssignment?.visitorId || latestFollowUp?.visitorId || '',
        location: latestAssignment?.location || lead.customerAddress || lead.location || '',
        visitorRemarks: latestAssignment?.remarks || '',
        assignedAt: latestAssignment?.timestamp || latestAssignment?.created_at || '',
        // Follow-Up info
        followUps: leadFollowUps,
        followUpCount: leadFollowUps.length,
        followUpNo: leadFollowUps.length,
        latestFollowUp,
        // Computed lifecycle status
        status: computedStatus,
        customerStatus: latestFollowUp?.customerStatus || latestFollowUp?.customer_status || latestTracker?.customerStatus || '',
        customer_status: latestFollowUp?.customerStatus || latestFollowUp?.customer_status || latestTracker?.customerStatus || '',
        interestLevel: latestFollowUp?.customerStatus || latestFollowUp?.customer_status || latestTracker?.customerStatus || latestFollowUp?.interestLevel || '',
        dealOutcome: latestFollowUp?.dealOutcome || '',
        rejectionReason: latestFollowUp?.rejectionReason || '',
        salesExecutive: latestFollowUp?.salesExecutive || '',
        closingAmount: latestFollowUp?.closingAmount || '',
        referenceNo: latestFollowUp?.referenceNo || '',
        dealRemarks: latestFollowUp?.dealRemarks || '',
        whatHappened: latestFollowUp?.whatHappened || '',
        nextVisitDate: latestFollowUp?.nextVisitDate || '',
        lastUpdated: latestFollowUp?.createdAt || latestAssignment?.timestamp || latestTracker?.timestamp || lead.timestamp || ''
      });
    });

    // Sort by latest activity descending
    return unifiedList.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
  },

  // Backward compatibility methods for existing callers
  async getPendingVisitorsWithLeads() {
    const all = await this.getAllSiteVisitMeetingLeads();
    return all.filter(item => item.status === 'Pending Assignment');
  },

  async getHistoryVisitorsWithLeads() {
    const all = await this.getAllSiteVisitMeetingLeads();
    return all.filter(item => item.assignedVisitorId);
  },

  async getPendingFollowUpsWithLeads() {
    const all = await this.getAllSiteVisitMeetingLeads();
    return all.filter(item => item.status === 'Assigned' || item.status === 'Future Plan');
  },

  async getHistoryFollowUpsWithLeads() {
    const all = await this.getAllSiteVisitMeetingLeads();
    return all.filter(item => item.followUpCount > 0);
  }
};

// Aliases for compatibility
export const siteVisitApi = siteVisitMeetingApi;
export const siteVisitFollowUpApi = siteVisitMeetingApi;
export const visitorApi = siteVisitMeetingApi;
export const visitorFollowUpApi = siteVisitMeetingApi;

export default siteVisitMeetingApi;
