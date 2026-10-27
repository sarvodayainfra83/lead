import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getVisitorLogs as getLocalVisitorLogs,
  saveVisitorLog as saveLocalVisitorLog,
  saveVisitorLogs as saveLocalVisitorLogs,
  deleteVisitorLog as deleteLocalVisitorLog
} from '../utils/storageManager';
import {
  VISIT_PURPOSE_OPTIONS,
  VISITOR_TYPE_OPTIONS,
  getPurposeKey,
  getVisitorTypeKey,
  emptyCounts
} from '../pages/Reception/receptionConstants';
import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { siteVisitMeetingApi } from './siteVisitMeetingApi';

// Normalize DB row (snake_case) to Frontend Object (camelCase)
const mapDbToVisitor = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    visitorName: row.visitor_name || row.visitorName || '',
    mobileNumber: row.mobile_number || row.mobileNumber || '',
    companyName: row.company_name || row.companyName || '',
    visitorType: row.visitor_type || row.visitorType || 'Guest',
    visitPurpose: row.visit_purpose || row.visitPurpose || 'Other',
    visitLocation: row.visit_location || row.visitLocation || 'Office',
    projectName: row.project_name || row.projectName || '',
    projectId: row.project_id || row.projectId || null,
    personToMeetId: row.person_to_meet_id || row.personToMeetId || null,
    personToMeetName: row.person_to_meet_name || row.personToMeetName || '',
    department: row.department || '',
    remarks: row.remarks || '',
    adminRemark: row.admin_remark || row.adminRemark || '',
    adminRemarkDate: row.admin_remark_date || row.adminRemarkDate || null,
    checkInAt: row.check_in_at || row.checkInAt || row.created_at || new Date().toISOString(),
    checkedInBy: row.checked_in_by || row.checkedInBy || '',
    checkedInById: row.checked_in_by_id || row.checkedInById || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
  };
};

// Normalize Frontend Object to DB row (snake_case)
const mapVisitorToDb = (item) => {
  const payload = {
    visitor_name: item.visitorName?.trim(),
    mobile_number: item.mobileNumber?.trim(),
    company_name: item.companyName?.trim() || null,
    visitor_type: item.visitorType || 'Guest',
    visit_purpose: item.visitPurpose || 'Other',
    visit_location: item.visitLocation || 'Office',
    project_name: item.projectName?.trim() || null,
    project_id: item.projectId || null,
    person_to_meet_id: item.personToMeetId || null,
    person_to_meet_name: item.personToMeetName?.trim() || '',
    department: item.department?.trim() || null,
    remarks: item.remarks?.trim() || null,
    check_in_at: item.checkInAt || new Date().toISOString(),
    checked_in_by: item.checkedInBy?.trim() || null,
    checked_in_by_id: item.checkedInById || null,
    updated_at: new Date().toISOString()
  };
  if (item.adminRemark !== undefined) {
    payload.admin_remark = item.adminRemark ? String(item.adminRemark).trim() : null;
  }
  if (item.adminRemarkDate !== undefined) {
    payload.admin_remark_date = item.adminRemarkDate || null;
  }
  return payload;
};

const isDateToday = (dateVal) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

export const visitorApi = {
  /**
   * Fetch all visitor logs, latest first.
   */
  async getVisitorLogs() {
    if (!isSupabaseConfigured) {
      return getLocalVisitorLogs().map(mapDbToVisitor);
    }

    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select('*')
        .order('check_in_at', { ascending: false });

      if (error) {
        // Table not yet migrated in Supabase - smoothly fallback to localStorage
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          console.warn('[Visitor API] visitor_logs table not found in Supabase. Using localStorage fallback. Run supabase_visitor_logs_migration.sql in Supabase SQL editor.');
          return getLocalVisitorLogs().map(mapDbToVisitor);
        }
        throw error;
      }

      return (data || []).map(mapDbToVisitor);
    } catch (err) {
      console.warn('[Visitor API] Error fetching from Supabase, falling back to local storage:', err);
      return getLocalVisitorLogs().map(mapDbToVisitor);
    }
  },

  /**
   * Register a new visitor entry (who came, when, and for what purpose).
   */
  async registerVisitor(formData, currentUser) {
    const nowIso = new Date().toISOString();
    const newVisitorObj = {
      visitorName: formData.visitorName?.trim(),
      mobileNumber: formData.mobileNumber?.trim(),
      companyName: formData.companyName?.trim() || '',
      visitorType: formData.visitorType || 'Guest',
      visitPurpose: formData.visitPurpose || 'Other',
      visitLocation: formData.visitLocation || 'Office',
      projectName: formData.projectName?.trim() || '',
      projectId: formData.projectId || null,
      personToMeetId: formData.personToMeetId || null,
      personToMeetName: formData.personToMeetName?.trim() || '',
      department: formData.department?.trim() || '',
      remarks: formData.remarks?.trim() || '',
      checkInAt: formData.checkInAt || nowIso,
      checkedInBy: currentUser?.name || currentUser?.username || 'Receptionist',
      checkedInById: currentUser?.dbId || null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (isSupabaseConfigured) {
      try {
        const payload = mapVisitorToDb(newVisitorObj);
        const { data, error } = await supabase
          .from('visitor_logs')
          .insert([payload])
          .select()
          .single();

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
            console.warn('[Visitor API] visitor_logs table not in Supabase yet. Saved to local storage.');
            return saveLocalVisitorLog(newVisitorObj);
          }
          throw error;
        }

        return mapDbToVisitor(data);
      } catch (err) {
        console.warn('[Visitor API] Error inserting into Supabase, using local record:', err);
        return saveLocalVisitorLog(newVisitorObj);
      }
    }

    return saveLocalVisitorLog(newVisitorObj);
  },

  /**
   * Update visitor details (e.g. edit remarks, adminRemark, purpose, person to meet).
   */
  async updateVisitor(id, updateData) {
    const nowIso = new Date().toISOString();
    const updatedObj = { ...updateData, id, updatedAt: nowIso };

    if (!isSupabaseConfigured) saveLocalVisitorLog(updatedObj);

    if (isSupabaseConfigured) {
      try {
        const dbPayload = mapVisitorToDb(updatedObj);
        let { data, error } = await supabase
          .from('visitor_logs')
          .update(dbPayload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (error) {
          // If admin_remark column is missing in Supabase, retry without it so other updates don't fail
          if (error.code === '42703' || error.message?.includes('admin_remark')) {
            console.warn('[Visitor API] admin_remark column not present in Supabase visitor_logs table. Run supabase_visitor_logs_admin_remark_migration.sql.');
            const safePayload = { ...dbPayload };
            delete safePayload.admin_remark;
            delete safePayload.admin_remark_date;
            const retryRes = await supabase
              .from('visitor_logs')
              .update(safePayload)
              .eq('id', id)
              .select()
              .maybeSingle();

            if (!retryRes.error && retryRes.data) {
              return {
                ...mapDbToVisitor(retryRes.data),
                adminRemark: updatedObj.adminRemark || '',
                adminRemarkDate: updatedObj.adminRemarkDate || null
              };
            }
          }
          throw error;
        }

        if (data) {
          return mapDbToVisitor(data);
        }
      } catch (err) {
        console.warn('[Visitor API] Supabase update failed:', err);
      }
    }

    return updatedObj;
  },

  /**
   * Fetch all subsequent follow-ups (Call Trackers, Site Visit / Meeting Follow-Ups, Assigned Visits)
   * matching this customer by phone number, lead link, or visitor identity.
   */
  async getCustomerFollowUps(visitor) {
    if (!visitor) return { followUps: [], matchedLead: null };

    const cleanDigits = (val) => String(val || '').replace(/[^0-9]/g, '');
    const vPhone = cleanDigits(visitor.mobileNumber);
    const last10 = vPhone.length >= 10 ? vPhone.slice(-10) : (vPhone.length >= 7 ? vPhone : '');
    const vNameLower = String(visitor.visitorName || '').trim().toLowerCase();

    try {
      const [leads, allTrackers, allFollowUps, allAssigned] = await Promise.all([
        leadApi.getLeads().catch(() => []),
        callTrackerApi.getCallTrackers().catch(() => []),
        siteVisitMeetingApi.getVisitorFollowUps().catch(() => []),
        siteVisitMeetingApi.getAssignedVisitors().catch(() => [])
      ]);

      // Match lead by phone (primary) or full name
      const matchedLeads = (leads || []).filter(l => {
        const lPhone = cleanDigits(l.customerNumber || l.number || l.phone || l.mobile);
        if (last10 && lPhone && (lPhone.endsWith(last10) || lPhone.includes(last10))) return true;
        if (vNameLower && l.personName && String(l.personName).trim().toLowerCase() === vNameLower) return true;
        if (vNameLower && l.customerName && String(l.customerName).trim().toLowerCase() === vNameLower) return true;
        return false;
      });

      const primaryLead = matchedLeads[0] || null;
      const leadIds = new Set(matchedLeads.map(l => String(l.id)));
      const leadNos = new Set(matchedLeads.map(l => String(l.leadNo || '')).filter(Boolean));

      const followUpsList = [];

      // 1. Call Tracker followups
      (allTrackers || []).forEach(t => {
        const matchesLead = (t.leadId && leadIds.has(String(t.leadId))) || (t.leadNo && leadNos.has(String(t.leadNo)));
        if (matchesLead) {
          followUpsList.push({
            id: `ct_${t.id}`,
            type: 'Call Tracker',
            category: 'Call Follow-Up',
            icon: 'phone',
            followUpNo: t.followUpNo || null,
            date: t.timestamp,
            timestampMs: Number(t.timestampMs) || (t.timestamp ? new Date(t.timestamp).getTime() : 0),
            status: t.status || 'Call Logged',
            customerStatus: t.customerStatus || '',
            handler: t.callerAssigned || primaryLead?.callerAssigned || '-',
            customerFeedback: t.customerSaid || '',
            nextDate: t.nextDate || null,
            adminRemark: t.adminRemark || '',
            userRemark: t.userRemark || '',
            leadNo: t.leadNo || primaryLead?.leadNo || ''
          });
        }
      });

      // 2. Site Visit / Meeting follow-ups (visitor_follow_ups)
      (allFollowUps || []).forEach(f => {
        const matchesVisitorId = visitor.id && f.visitorId && String(f.visitorId) === String(visitor.id);
        const matchesLead = (f.leadId && leadIds.has(String(f.leadId))) || (f.leadNo && leadNos.has(String(f.leadNo)));
        const matchesName = vNameLower && f.visitorName && String(f.visitorName).trim().toLowerCase() === vNameLower;

        if (matchesVisitorId || matchesLead || matchesName) {
          const isSiteVisit = Boolean(f.visitMeet?.['site-visit'] || f.visitMeet?.siteVisit);
          const isMeeting = Boolean(f.visitMeet?.meeting);
          const category = isSiteVisit ? 'Site Visit Follow-Up' : (isMeeting ? 'Meeting Follow-Up' : 'Visit Follow-Up');

          followUpsList.push({
            id: `vf_${f.id}`,
            type: 'Site Visit / Meeting',
            category,
            icon: isSiteVisit ? 'map-pin' : 'users',
            followUpNo: f.followUpNo || null,
            date: f.visitDate || f.createdAt,
            timestampMs: Number(f.timestampMs) || (f.createdAt ? new Date(f.createdAt).getTime() : 0),
            status: f.status || f.dealOutcome || 'Visit Logged',
            customerStatus: f.customerStatus || f.customer_status || f.interestLevel || '',
            handler: f.salesExecutive || f.visitorName || '-',
            customerFeedback: f.whatHappened || '',
            nextDate: f.nextVisitDate ? (f.nextVisitTime ? `${f.nextVisitDate} (${f.nextVisitTime})` : f.nextVisitDate) : null,
            dealOutcome: f.dealOutcome || '',
            closingAmount: f.closingAmount || '',
            referenceNo: f.referenceNo || '',
            rejectionReason: f.rejectionReason || '',
            dealRemarks: f.dealRemarks || '',
            leadNo: f.leadNo || primaryLead?.leadNo || ''
          });
        }
      });

      // 3. Assigned visits (scheduled upcoming assignments not yet marked as follow-ups)
      (allAssigned || []).forEach(a => {
        const matchesVisitorId = visitor.id && a.visitorId && String(a.visitorId) === String(visitor.id);
        const matchesLead = (a.leadId && leadIds.has(String(a.leadId))) || (a.leadNo && leadNos.has(String(a.leadNo)));
        if ((matchesVisitorId || matchesLead) && a.status === 'Assigned') {
          const alreadyInFollowUps = followUpsList.some(f => f.type === 'Site Visit / Meeting');
          if (!alreadyInFollowUps) {
            followUpsList.push({
              id: `av_${a.id}`,
              type: 'Assigned Visit',
              category: 'Scheduled Visit / Meeting',
              icon: 'calendar',
              date: a.visitDate || a.timestamp,
              timestampMs: a.timestamp ? new Date(a.timestamp).getTime() : 0,
              status: a.status || 'Assigned',
              customerStatus: '',
              handler: a.visitorName || '-',
              customerFeedback: a.remarks || 'Visit assigned and scheduled',
              nextDate: a.visitDate || null,
              leadNo: a.leadNo || primaryLead?.leadNo || ''
            });
          }
        }
      });

      // Sort latest first
      followUpsList.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

      return {
        followUps: followUpsList,
        matchedLead: primaryLead
      };
    } catch (err) {
      console.warn('[Visitor API] Error fetching customer follow-ups:', err);
      return { followUps: [], matchedLead: null };
    }
  },

  /**
   * Compute reception dashboard statistics from visitor records.
   */
  calculateStats(visitors = []) {
    let totalToday = 0;
    let meetingsToday = 0; // 'Meeting to Director'
    let propertyEnquiriesToday = 0;

    const todayPurposeCounts = emptyCounts(VISIT_PURPOSE_OPTIONS);
    const todayTypeCounts = emptyCounts(VISITOR_TYPE_OPTIONS);

    const todayLocationCounts = {
      Office: 0,
      'Construction Site': 0
    };

    const purposeCounts = emptyCounts(VISIT_PURPOSE_OPTIONS);
    const typeCounts = emptyCounts(VISITOR_TYPE_OPTIONS);

    const locationCounts = {
      Office: 0,
      'Construction Site': 0
    };

    const employeeVisits = {};

    visitors.forEach(v => {
      const isToday = isDateToday(v.checkInAt);

      if (isToday) {
        totalToday++;
        const purpose = getPurposeKey(v.visitPurpose);
        if (purpose === 'Meeting to Director') meetingsToday++;
        if (purpose === 'Property Enquiry') propertyEnquiriesToday++;

        // Purpose & visitor category breakdown for today
        todayPurposeCounts[purpose]++;
        todayTypeCounts[getVisitorTypeKey(v.visitorType)]++;

        // Location breakdown for today
        const loc = v.visitLocation === 'Construction Site' ? 'Construction Site' : 'Office';
        todayLocationCounts[loc] = (todayLocationCounts[loc] || 0) + 1;
      }

      // Purpose & visitor category breakdown (all time)
      purposeCounts[getPurposeKey(v.visitPurpose)]++;
      typeCounts[getVisitorTypeKey(v.visitorType)]++;

      // Location breakdown (all time)
      const loc = v.visitLocation === 'Construction Site' ? 'Construction Site' : 'Office';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;

      // Employee breakdown
      const emp = v.personToMeetName || 'Unassigned';
      employeeVisits[emp] = (employeeVisits[emp] || 0) + 1;
    });

    return {
      totalToday,
      meetingsToday,
      propertyEnquiriesToday,
      todayPurposeCounts,
      todayTypeCounts,
      todayLocationCounts,
      purposeCounts,
      typeCounts,
      locationCounts,
      employeeVisits
    };
  }
};
