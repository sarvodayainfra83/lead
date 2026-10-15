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
    checkInAt: row.check_in_at || row.checkInAt || row.created_at || new Date().toISOString(),
    checkedInBy: row.checked_in_by || row.checkedInBy || '',
    checkedInById: row.checked_in_by_id || row.checkedInById || null,
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
