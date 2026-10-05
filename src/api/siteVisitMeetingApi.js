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

    let visitMeet = { 'site-visit': false, meeting: false };
    if (row.visit_meet) {
      if (typeof row.visit_meet === 'object' && row.visit_meet !== null) {
        visitMeet = {
          'site-visit': Boolean(row.visit_meet['site-visit'] ?? row.visit_meet.siteVisit ?? row.visit_meet.site_visit),
          meeting: Boolean(row.visit_meet.meeting)
        };
      } else if (typeof row.visit_meet === 'string') {
        try {
          const parsed = JSON.parse(row.visit_meet);
          visitMeet = {
            'site-visit': Boolean(parsed['site-visit'] ?? parsed.siteVisit ?? parsed.site_visit),
            meeting: Boolean(parsed.meeting)
          };
        } catch {}
      }
    }

    return {
      id: row.id,
      parentId: row.parent_id || row.parentId || null,
      parent_id: row.parent_id || row.parentId || null,
      leadId: row.lead_id,
      leadNo: row.lead_no,
      assignedVisitorId: row.assigned_visitor_id,
      visitorName: row.visitor_name,
      visitorId: row.visitor_id,
      visitDate: row.visit_date,
      visitMeet,
      visit_meet: visitMeet,
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
    const rawLeadId = resolvedLeadId || entry.leadId || entry.lead_id;
    const leadId = isUuid(rawLeadId) ? rawLeadId.trim() : null;

    const rawParentId = entry.parentId || entry.parent_id;
    const parentId = isUuid(rawParentId) ? rawParentId.trim() : null;

    const rawAssignedVisitorId = entry.assignedVisitorId || entry.assigned_visitor_id;
    const assignedVisitorId = isUuid(rawAssignedVisitorId) ? rawAssignedVisitorId.trim() : null;

    const rawVisitorId = entry.visitorId || entry.visitor_id;
    const visitorId = isUuid(rawVisitorId) ? rawVisitorId.trim() : null;

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

    let visitMeet = entry.visitMeet || entry.visit_meet;
    if (!visitMeet && (entry.siteVisited !== undefined || entry.meeting !== undefined)) {
      visitMeet = {
        'site-visit': Boolean(entry.siteVisited),
        'meeting': Boolean(entry.meeting)
      };
    }
    if (!visitMeet || typeof visitMeet !== 'object') {
      visitMeet = { 'site-visit': false, 'meeting': false };
    }

    return {
      parent_id: parentId,
      lead_id: leadId,
      lead_no: entry.leadNo || '',
      assigned_visitor_id: assignedVisitorId,
      visitor_name: entry.visitorName || entry.visitor_name || entry.salesExecutive || 'Assigned Visitor',
      visitor_id: visitorId,
      visit_date: formatDateForDb(entry.visitDate),
      visit_meet: visitMeet,
      status: entry.status || entry.dealOutcome || 'Interested',
      customer_status: customerStatus || null,
      interest_level: legacyInterestLevel,
      what_happened: entry.whatHappened || entry.what_happened || '',
      next_visit_date: formatDateForDb(entry.nextVisitDate || entry.next_visit_date),
      deal_outcome: entry.dealOutcome || entry.deal_outcome || null,
      rejection_reason: entry.rejectionReason || entry.reason || entry.rejection_reason || null,
      sales_executive: entry.salesExecutive || entry.sales_executive || entry.visitorName || null,
      closing_amount: entry.closingAmount !== null && entry.closingAmount !== undefined && String(entry.closingAmount).trim() !== '' ? String(entry.closingAmount).trim() : null,
      reference_no: entry.referenceNo || entry.reference_no || null,
      deal_remarks: entry.dealRemarks || entry.deal_remarks || null,
      follow_up_no: Number(entry.followUpNo || entry.follow_up_no) || 1,
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

    const localFollowUps = getLocalVisitorFollowUps() || [];
    const localById = Object.fromEntries(localFollowUps.map(f => [String(f.id), f]));
    const localByLead = {};
    localFollowUps.forEach(f => {
      const key = String(f.leadId || f.leadNo);
      if (!localByLead[key] || (f.visitMeet?.['site-visit'] || f.visitMeet?.meeting)) {
        localByLead[key] = f;
      }
    });

    return data.map(row => {
      const mapped = this.mapFollowUpFromDb(row);
      // Fallback to local storage if DB column visit_meet is not yet migrated
      if (!mapped.visitMeet?.['site-visit'] && !mapped.visitMeet?.meeting) {
        const local = localById[String(mapped.id)] || localByLead[String(mapped.leadId)] || localByLead[String(mapped.leadNo)];
        if (local?.visitMeet?.['site-visit'] || local?.visitMeet?.meeting) {
          mapped.visitMeet = local.visitMeet;
          mapped.visit_meet = local.visitMeet;
        }
      }
      return mapped;
    });
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

    const localFollowUps = getLocalVisitorFollowUps() || [];
    const localById = Object.fromEntries(localFollowUps.map(f => [String(f.id), f]));
    const localByLead = {};
    localFollowUps.forEach(f => {
      const key = String(f.leadId || f.leadNo);
      if (!localByLead[key] || (f.visitMeet?.['site-visit'] || f.visitMeet?.meeting)) {
        localByLead[key] = f;
      }
    });

    return data.map(row => {
      const mapped = this.mapFollowUpFromDb(row);
      if (!mapped.visitMeet?.['site-visit'] && !mapped.visitMeet?.meeting) {
        const local = localById[String(mapped.id)] || localByLead[String(mapped.leadId)] || localByLead[String(mapped.leadNo)];
        if (local?.visitMeet?.['site-visit'] || local?.visitMeet?.meeting) {
          mapped.visitMeet = local.visitMeet;
          mapped.visit_meet = local.visitMeet;
        }
      }
      return mapped;
    });
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
        if (leadRow?.id && isUuid(leadRow.id)) {
          leadId = leadRow.id;
        }
      } catch (e) {
        console.warn('Could not resolve lead_id by lead_no:', e);
      }
    }

    let payload = this.mapFollowUpToDb(normalizedEntry, leadId);

    // Auto-resolve parent_id and follow_up_no from previous record if not provided
    if (!payload.parent_id && (leadId || normalizedEntry.leadNo)) {
      try {
        let parentQuery = supabase.from('visitor_follow_ups').select('id, follow_up_no');
        if (leadId && normalizedEntry.leadNo) {
          parentQuery = parentQuery.or(`lead_id.eq.${leadId},lead_no.eq.${normalizedEntry.leadNo}`);
        } else if (leadId) {
          parentQuery = parentQuery.eq('lead_id', leadId);
        } else if (normalizedEntry.leadNo) {
          parentQuery = parentQuery.eq('lead_no', normalizedEntry.leadNo);
        }
        const { data: prevRows } = await parentQuery.order('created_at', { ascending: false }).limit(1);
        if (prevRows && prevRows.length > 0 && isUuid(prevRows[0].id)) {
          payload.parent_id = prevRows[0].id;
          if (!payload.follow_up_no || payload.follow_up_no <= 1) {
            payload.follow_up_no = (Number(prevRows[0].follow_up_no) || 1) + 1;
          }
        }
      } catch (parentErr) {
        console.warn('Could not auto-resolve parent_id for visitor follow up:', parentErr);
      }
    }

    // Auto-resolve assigned_visitor_id from assigned_visitors table if not provided
    if (!payload.assigned_visitor_id && (leadId || normalizedEntry.leadNo)) {
      try {
        let assignQuery = supabase.from('assigned_visitors').select('id');
        if (leadId && normalizedEntry.leadNo) {
          assignQuery = assignQuery.or(`lead_id.eq.${leadId},lead_no.eq.${normalizedEntry.leadNo}`);
        } else if (leadId) {
          assignQuery = assignQuery.eq('lead_id', leadId);
        } else if (normalizedEntry.leadNo) {
          assignQuery = assignQuery.eq('lead_no', normalizedEntry.leadNo);
        }
        const { data: assignRows } = await assignQuery.order('created_at', { ascending: false }).limit(1);
        if (assignRows && assignRows.length > 0 && isUuid(assignRows[0].id)) {
          payload.assigned_visitor_id = assignRows[0].id;
        }
      } catch (assignLookupErr) {
        console.warn('Could not auto-resolve assigned_visitor_id for visitor follow up:', assignLookupErr);
      }
    }

    // Dynamic multi-try insertion to ensure database compatibility with schema
    let data = null;
    let error = null;

    const tryInsert = async (p) => {
      return await supabase.from('visitor_follow_ups').insert(p).select().single();
    };

    let res = await tryInsert(payload);
    data = res.data;
    error = res.error;

    if (error) {
      console.warn('Initial insert into visitor_follow_ups failed:', error.message);
      let retryPayload = { ...payload };

      // Handle missing optional columns or foreign key issues gracefully
      if (error.message?.includes('parent_id') || error.code === '23503') {
        retryPayload.parent_id = null;
      }
      if (error.message?.includes('assigned_visitor_id')) {
        retryPayload.assigned_visitor_id = null;
      }
      if (error.message?.includes('visitor_id')) {
        retryPayload.visitor_id = null;
      }
      if (error.message?.includes('visit_meet') || error.message?.includes('schema cache')) {
        delete retryPayload.visit_meet;
      }
      if (error.message?.includes('customer_status')) {
        delete retryPayload.customer_status;
      }
      if (error.message?.includes('deal_outcome')) {
        delete retryPayload.deal_outcome;
      }
      if (error.message?.includes('closing_amount')) {
        delete retryPayload.closing_amount;
      }
      if (error.message?.includes('sales_executive')) {
        delete retryPayload.sales_executive;
      }
      if (error.message?.includes('reference_no')) {
        delete retryPayload.reference_no;
      }
      if (error.message?.includes('deal_remarks')) {
        delete retryPayload.deal_remarks;
      }

      res = await tryInsert(retryPayload);
      if (!res.error) {
        data = { ...res.data, visit_meet: payload.visit_meet, parent_id: payload.parent_id };
        error = null;
      } else {
        // Fallback to core base schema columns
        const minimalPayload = {
          lead_id: retryPayload.lead_id,
          lead_no: retryPayload.lead_no,
          visitor_name: retryPayload.visitor_name,
          visitor_id: retryPayload.visitor_id,
          visit_date: retryPayload.visit_date,
          status: retryPayload.status,
          interest_level: retryPayload.interest_level,
          what_happened: retryPayload.what_happened,
          next_visit_date: retryPayload.next_visit_date,
          follow_up_no: retryPayload.follow_up_no,
          timestamp_ms: retryPayload.timestamp_ms
        };
        const minRes = await tryInsert(minimalPayload);
        if (!minRes.error) {
          data = { ...minRes.data, visit_meet: payload.visit_meet, parent_id: payload.parent_id };
          error = null;
        } else {
          error = minRes.error;
          console.error('All insert attempts to visitor_follow_ups failed:', error);
        }
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

    // Group assigned visitors by lead (both leadId and leadNo)
    const assignmentsByLeadId = {};
    const assignmentsByLeadNo = {};
    assignedVisitors.forEach(a => {
      if (a.status === 'Cancelled') return;
      if (a.leadId) {
        const idKey = String(a.leadId);
        if (!assignmentsByLeadId[idKey]) assignmentsByLeadId[idKey] = [];
        assignmentsByLeadId[idKey].push(a);
      }
      if (a.leadNo) {
        const noKey = String(a.leadNo);
        if (!assignmentsByLeadNo[noKey]) assignmentsByLeadNo[noKey] = [];
        assignmentsByLeadNo[noKey].push(a);
      }
    });

    // Group follow-ups by lead (both leadId and leadNo)
    const followUpsByLeadId = {};
    const followUpsByLeadNo = {};
    followUps.forEach(f => {
      if (f.leadId) {
        const idKey = String(f.leadId);
        if (!followUpsByLeadId[idKey]) followUpsByLeadId[idKey] = [];
        followUpsByLeadId[idKey].push(f);
      }
      if (f.leadNo) {
        const noKey = String(f.leadNo);
        if (!followUpsByLeadNo[noKey]) followUpsByLeadNo[noKey] = [];
        followUpsByLeadNo[noKey].push(f);
      }
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
      const leadKeyId = String(lead.id || '');
      const leadKeyNo = String(lead.leadNo || '');

      // Latest tracker
      const latestTracker = getLatestTrackerForLead(trackers, lead.id, lead.leadNo);

      // All assignments for this lead (deduplicated and sorted latest first)
      const seenAssignmentIds = new Set();
      const leadAssignments = [];
      const assignmentCandidates = [
        ...(leadKeyId && assignmentsByLeadId[leadKeyId] ? assignmentsByLeadId[leadKeyId] : []),
        ...(leadKeyNo && assignmentsByLeadNo[leadKeyNo] ? assignmentsByLeadNo[leadKeyNo] : [])
      ];
      assignmentCandidates.forEach(a => {
        const aid = a.id || `${a.leadNo}-${a.timestamp || a.created_at}`;
        if (!seenAssignmentIds.has(aid)) {
          seenAssignmentIds.add(aid);
          leadAssignments.push(a);
        }
      });
      leadAssignments.sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));
      const latestAssignment = leadAssignments[0] || null;

      // All follow-ups for this lead (deduplicated and sorted chronologically)
      const seenFollowUpIds = new Set();
      const leadFollowUps = [];
      const followUpCandidates = [
        ...(leadKeyId && followUpsByLeadId[leadKeyId] ? followUpsByLeadId[leadKeyId] : []),
        ...(leadKeyNo && followUpsByLeadNo[leadKeyNo] ? followUpsByLeadNo[leadKeyNo] : [])
      ];
      followUpCandidates.forEach(f => {
        const fid = f.id || `${f.leadNo}-${f.timestampMs || f.createdAt}`;
        if (!seenFollowUpIds.has(fid)) {
          seenFollowUpIds.add(fid);
          leadFollowUps.push(f);
        }
      });
      leadFollowUps.sort((a, b) => (Number(a.timestampMs) || new Date(a.createdAt || 0).getTime()) - (Number(b.timestampMs) || new Date(b.createdAt || 0).getTime()));
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
        nextCallDate: latestTracker?.nextDate || lead.nextCallDate || '',
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
        visitMeet: latestFollowUp?.visitMeet || latestFollowUp?.visit_meet || (leadFollowUps.find(f => f.visitMeet || f.visit_meet)?.visitMeet) || lead.visitMeet || lead.visit_meet || null,
        visit_meet: latestFollowUp?.visitMeet || latestFollowUp?.visit_meet || (leadFollowUps.find(f => f.visitMeet || f.visit_meet)?.visitMeet) || lead.visitMeet || lead.visit_meet || null,
        parentId: latestFollowUp?.parentId || latestFollowUp?.parent_id || null,
        parent_id: latestFollowUp?.parentId || latestFollowUp?.parent_id || null,
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
