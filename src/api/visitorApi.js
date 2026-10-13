import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getVisitorLogs as getLocalVisitorLogs,
  saveVisitorLog as saveLocalVisitorLog,
  saveVisitorLogs as saveLocalVisitorLogs,
  deleteVisitorLog as deleteLocalVisitorLog
} from '../utils/storageManager';

// Normalize DB row (snake_case) to Frontend Object (camelCase)
const mapDbToVisitor = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    visitorName: row.visitor_name || row.visitorName || '',
    mobileNumber: row.mobile_number || row.mobileNumber || '',
    companyName: row.company_name || row.companyName || '',
    visitorType: row.visitor_type || row.visitorType || 'Guest',
    visitPurpose: row.visit_purpose || row.visitPurpose || 'Meeting',
    visitLocation: row.visit_location || row.visitLocation || 'Office',
    projectName: row.project_name || row.projectName || '',
    projectId: row.project_id || row.projectId || null,
    personToMeetId: row.person_to_meet_id || row.personToMeetId || null,
    personToMeetName: row.person_to_meet_name || row.personToMeetName || '',
    department: row.department || '',
    personActuallyMetId: row.person_actually_met_id || row.personActuallyMetId || null,
    personActuallyMetName: row.person_actually_met_name || row.personActuallyMetName || '',
    remarks: row.remarks || '',
    checkInAt: row.check_in_at || row.checkInAt || row.created_at || new Date().toISOString(),
    checkOutAt: row.check_out_at || row.checkOutAt || null,
    checkedInBy: row.checked_in_by || row.checkedInBy || '',
    checkedInById: row.checked_in_by_id || row.checkedInById || null,
    checkedOutBy: row.checked_out_by || row.checkedOutBy || '',
    checkedOutById: row.checked_out_by_id || row.checkedOutById || null,
    status: row.status || 'CHECKED_IN',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
  };
};

// Normalize Frontend Object to DB row (snake_case)
const mapVisitorToDb = (item) => {
  return {
    visitor_name: item.visitorName?.trim(),
    mobile_number: item.mobileNumber?.trim(),
    company_name: item.companyName?.trim() || null,
    visitor_type: item.visitorType || 'Guest',
    visit_purpose: item.visitPurpose || 'Meeting',
    visit_location: item.visitLocation || 'Office',
    project_name: item.projectName?.trim() || null,
    project_id: item.projectId || null,
    person_to_meet_id: item.personToMeetId || null,
    person_to_meet_name: item.personToMeetName?.trim() || '',
    department: item.department?.trim() || null,
    person_actually_met_id: item.personActuallyMetId || null,
    person_actually_met_name: item.personActuallyMetName?.trim() || null,
    remarks: item.remarks?.trim() || null,
    check_in_at: item.checkInAt || new Date().toISOString(),
    check_out_at: item.checkOutAt || null,
    checked_in_by: item.checkedInBy?.trim() || null,
    checked_in_by_id: item.checkedInById || null,
    checked_out_by: item.checkedOutBy?.trim() || null,
    checked_out_by_id: item.checkedOutById || null,
    status: item.status || 'CHECKED_IN',
    updated_at: new Date().toISOString()
  };
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
   * Register a new visitor with status 'CHECKED_IN'.
   */
  async registerVisitor(formData, currentUser) {
    const nowIso = new Date().toISOString();
    const newVisitorObj = {
      visitorName: formData.visitorName?.trim(),
      mobileNumber: formData.mobileNumber?.trim(),
      companyName: formData.companyName?.trim() || '',
      visitorType: formData.visitorType || 'Guest',
      visitPurpose: formData.visitPurpose || 'Meeting',
      visitLocation: formData.visitLocation || 'Office',
      projectName: formData.projectName?.trim() || '',
      projectId: formData.projectId || null,
      personToMeetId: formData.personToMeetId || null,
      personToMeetName: formData.personToMeetName?.trim() || '',
      department: formData.department?.trim() || '',
      personActuallyMetId: null,
      personActuallyMetName: '',
      remarks: formData.remarks?.trim() || '',
      checkInAt: formData.checkInAt || nowIso,
      checkOutAt: null,
      checkedInBy: currentUser?.name || currentUser?.username || 'Receptionist',
      checkedInById: currentUser?.dbId || null,
      checkedOutBy: null,
      checkedOutById: null,
      status: 'CHECKED_IN',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Save locally as reliable cache / fallback
    const localSaved = saveLocalVisitorLog(newVisitorObj);

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
            return localSaved;
          }
          throw error;
        }

        return mapDbToVisitor(data);
      } catch (err) {
        console.warn('[Visitor API] Error inserting into Supabase, using local record:', err);
        return localSaved;
      }
    }

    return localSaved;
  },

  /**
   * Check out an active visitor.
   */
  async checkOutVisitor(id, checkoutData = {}, currentUser) {
    const nowIso = new Date().toISOString();
    const checkoutUpdates = {
      checkOutAt: nowIso,
      checkedOutBy: currentUser?.name || currentUser?.username || 'Receptionist',
      checkedOutById: currentUser?.dbId || null,
      status: 'CHECKED_OUT',
      updatedAt: nowIso
    };

    if (checkoutData.personActuallyMetName) {
      checkoutUpdates.personActuallyMetName = checkoutData.personActuallyMetName.trim();
      checkoutUpdates.personActuallyMetId = checkoutData.personActuallyMetId || null;
    }

    if (checkoutData.checkoutRemarks) {
      const extraRemarks = checkoutData.checkoutRemarks.trim();
      checkoutUpdates.remarks = checkoutData.existingRemarks
        ? `${checkoutData.existingRemarks} | Checkout: ${extraRemarks}`
        : `Checkout: ${extraRemarks}`;
    }

    // Update in local cache
    saveLocalVisitorLog({ id, ...checkoutUpdates });

    if (isSupabaseConfigured) {
      try {
        const dbPayload = {
          check_out_at: checkoutUpdates.checkOutAt,
          checked_out_by: checkoutUpdates.checkedOutBy,
          checked_out_by_id: checkoutUpdates.checkedOutById,
          status: 'CHECKED_OUT',
          updated_at: nowIso
        };

        if (checkoutUpdates.personActuallyMetName) {
          dbPayload.person_actually_met_name = checkoutUpdates.personActuallyMetName;
          dbPayload.person_actually_met_id = checkoutUpdates.personActuallyMetId;
        }

        if (checkoutUpdates.remarks) {
          dbPayload.remarks = checkoutUpdates.remarks;
        }

        const { data, error } = await supabase
          .from('visitor_logs')
          .update(dbPayload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error && data) {
          return mapDbToVisitor(data);
        }
      } catch (err) {
        console.warn('[Visitor API] Supabase checkout update failed, local fallback used:', err);
      }
    }

    return { id, ...checkoutUpdates };
  },

  /**
   * Update visitor details (e.g. edit remarks, purpose, person to meet).
   */
  async updateVisitor(id, updateData) {
    const nowIso = new Date().toISOString();
    const updatedObj = { ...updateData, id, updatedAt: nowIso };

    saveLocalVisitorLog(updatedObj);

    if (isSupabaseConfigured) {
      try {
        const dbPayload = mapVisitorToDb(updatedObj);
        const { data, error } = await supabase
          .from('visitor_logs')
          .update(dbPayload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error && data) {
          return mapDbToVisitor(data);
        }
      } catch (err) {
        console.warn('[Visitor API] Supabase update failed:', err);
      }
    }

    return updatedObj;
  },

  /**
   * Cancel a visitor registration.
   */
  async cancelVisitor(id, reason = '', currentUser) {
    const cancelUpdates = {
      status: 'CANCELLED',
      remarks: reason ? `[Cancelled]: ${reason}` : '[Cancelled]',
      updatedAt: new Date().toISOString()
    };

    saveLocalVisitorLog({ id, ...cancelUpdates });

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('visitor_logs')
          .update({
            status: 'CANCELLED',
            remarks: cancelUpdates.remarks,
            updated_at: cancelUpdates.updatedAt
          })
          .eq('id', id);
      } catch (err) {
        console.warn('[Visitor API] Supabase cancel failed:', err);
      }
    }

    return { id, ...cancelUpdates };
  },

  /**
   * Compute reception dashboard statistics from visitor records.
   */
  calculateStats(visitors = []) {
    let totalToday = 0;
    let currentlyInside = 0;
    let meetingsToday = 0;
    let siteVisitsToday = 0;
    let awaitingCheckout = 0;

    const purposeCounts = {
      Meeting: 0,
      'Site Visit': 0,
      'Supply Item': 0,
      Broking: 0,
      Other: 0
    };

    const locationCounts = {
      Office: 0,
      'Construction Site': 0
    };

    const employeeVisits = {};

    visitors.forEach(v => {
      const isToday = isDateToday(v.checkInAt);
      const isInside = v.status === 'CHECKED_IN';

      if (isToday) {
        totalToday++;
        if (v.visitPurpose === 'Meeting') meetingsToday++;
        if (v.visitPurpose === 'Site Visit') siteVisitsToday++;
      }

      if (isInside) {
        currentlyInside++;
        awaitingCheckout++;
      }

      // Purpose breakdown (for today or all time)
      const p = v.visitPurpose || 'Other';
      if (purposeCounts[p] !== undefined) {
        purposeCounts[p]++;
      } else {
        purposeCounts.Other++;
      }

      // Location breakdown
      const loc = v.visitLocation === 'Construction Site' ? 'Construction Site' : 'Office';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;

      // Employee breakdown
      const emp = v.personActuallyMetName || v.personToMeetName || 'Unassigned';
      employeeVisits[emp] = (employeeVisits[emp] || 0) + 1;
    });

    return {
      totalToday,
      currentlyInside,
      meetingsToday,
      siteVisitsToday,
      awaitingCheckout,
      purposeCounts,
      locationCounts,
      employeeVisits
    };
  }
};
