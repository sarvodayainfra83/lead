import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { authApi } from './authApi';
import { attendanceApi } from './attendanceApi';
import { siteVisitApi } from './siteVisitApi';
import { siteVisitFollowUpApi } from './siteVisitFollowUpApi';
import {
  getLeadStatus, isLeadPending, CONVERTED_STATUSES, getTrackersForLead, getLatestCustomerStatus
} from '../pages/CallTracker/callTrackerConstants';
import { LEAD_TYPES, LEAD_SOURCES, parseLeadDate } from '../pages/Lead/leadConstants';
import { isUserAdmin, matchesUserAssignment, matchesUserReceiver, getLeadCategory } from '../utils/authUtils';

const CATEGORICAL = ['#7c3aed', '#0891b2', '#c026d3', '#65a30d', '#ea580c', '#db2777', '#0d9488', '#6b7280'];

const parseLeadTimestamp = (ts) => {
  if (!ts) return null;
  const [datePart] = ts.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dashboardApi = {
  // Everything the category-tab dashboard needs, loaded once and sliced per tab on the page.
  // Leads come already scoped to the user's lead type (leadApi.getLeads); role USER is further
  // limited to their own assigned leads and their own attendance.
  async getDashboardData(user = null) {
    const [allLeads, allTrackers, allUsers, attendanceLogs, allVisits, allVisitFollowUps] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      authApi.getUsers().catch(() => []),
      attendanceApi.getAttendanceLogs().catch(() => []),
      siteVisitApi.getAssignedVisitors().catch(() => []),
      siteVisitFollowUpApi.getVisitorFollowUps().catch(() => [])
    ]);

    const isAdmin = isUserAdmin(user);
    // Role USER: only their own leads — assigned to them as caller or received by them (Team Member)
    const leads = isAdmin ? allLeads : allLeads.filter(l => matchesUserAssignment(l, user) || matchesUserReceiver(l, user));

    const enrichedLeads = leads.map(lead => {
      const leadTrackers = getTrackersForLead(allTrackers, lead.id, lead.leadNo);
      const latest = leadTrackers[leadTrackers.length - 1] || null;
      return {
        ...lead,
        category: getLeadCategory(lead.leadType, lead.leadNo),
        createdDate: parseLeadDate(lead),
        trackers: leadTrackers,
        latestTracker: latest,
        status: latest?.status || null,
        customerStatus: getLatestCustomerStatus(allTrackers, lead.id, lead.leadNo),
        lastActivityMs: Number(latest?.timestampMs) || 0
      };
    });

    // Every call entry, joined to its (visible) lead
    const calls = enrichedLeads.flatMap(lead => lead.trackers.map(t => ({
      ...t,
      timestampMs: Number(t.timestampMs) || 0,
      leadId: lead.id,
      leadNo: lead.leadNo,
      personName: lead.personName,
      number: lead.number,
      category: lead.category,
      callerAssigned: lead.callerAssigned || ''
    })));

    const employees = (isAdmin ? allUsers : allUsers.filter(u => matchesUserAssignment(u.name, user) || matchesUserAssignment(u.id, user)))
      .filter(u => u.name && u.name.trim())
      .map(u => ({
        id: u.id,
        dbId: u.dbId,
        name: u.name.trim(),
        role: u.role,
        position: u.position || '',
        number: u.number || '',
        email: u.gmail || '',
        leadType: u.leadType || '',
        category: getLeadCategory(u.leadType)
      }));

    const employeeKeys = new Set(employees.flatMap(e => [e.name.toLowerCase(), String(e.dbId || ''), String(e.id || '').toLowerCase()]));
    const attendance = (attendanceLogs || []).filter(a => (
      isAdmin ||
      employeeKeys.has(String(a.userName || '').trim().toLowerCase()) ||
      employeeKeys.has(String(a.userId || ''))
    ));

    // Site visits & visitor follow-ups, only for leads this user can see
    const leadByKey = {};
    enrichedLeads.forEach(l => {
      leadByKey[String(l.id)] = l;
      if (l.leadNo) leadByKey[String(l.leadNo)] = l;
    });
    const joinLead = (item) => leadByKey[String(item.leadId)] || leadByKey[String(item.leadNo)];
    const toMs = (val) => {
      if (!val) return 0;
      const t = new Date(val).getTime();
      return isNaN(t) ? 0 : t;
    };
    const visits = (allVisits || [])
      .map(v => ({ v, lead: joinLead(v) }))
      .filter(({ lead }) => lead)
      .map(({ v, lead }) => ({
        ...v,
        category: lead.category,
        personName: lead.personName,
        visitMs: toMs(v.visitDate) || toMs(v.timestamp)
      }));
    const visitFollowUps = (allVisitFollowUps || [])
      .map(f => ({ f, lead: joinLead(f) }))
      .filter(({ lead }) => lead)
      .map(({ f, lead }) => ({
        ...f,
        category: lead.category,
        personName: lead.personName,
        timestampMs: Number(f.timestampMs) || toMs(f.createdAt)
      }));

    return { leads: enrichedLeads, calls, employees, attendance, visits, visitFollowUps };
  },

  async getDashboardMetrics(user = null) {
    const [allLeads, allTrackers, allUsers] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      authApi.getUsers()
    ]);

    const isAdmin = isUserAdmin(user);
    const leads = isAdmin ? allLeads : allLeads.filter(l => matchesUserAssignment(l, user));
    const trackers = isAdmin ? allTrackers : allTrackers.filter(t => matchesUserAssignment(t, user));

    const leadsWithStatus = leads.map(l => ({ ...l, _status: getLeadStatus(trackers, l.id) }));

    const totalLeads = leads.length;
    const neverContactedCount = leadsWithStatus.filter(l => l._status === null).length;
    const futurePlanCount = leadsWithStatus.filter(l => l._status === 'Future Plan Date').length;
    const convertedCount = leadsWithStatus.filter(l => CONVERTED_STATUSES.includes(l._status)).length;
    const notInterestedCount = leadsWithStatus.filter(l => l._status === 'Not Interested').length;
    const pendingCount = leads.filter(l => isLeadPending(trackers, l)).length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    // Site Visit/Meeting leads — latest tracker status is 'Site Visit/Meeting'
    const siteVisitCount = leadsWithStatus.filter(l => l._status === 'Site Visit/Meeting').length;

    // Build site visit/meeting leads list with their date & caller
    const siteVisitLeads = leads
      .filter(l => getLeadStatus(trackers, l.id) === 'Site Visit/Meeting')
      .map(l => {
        const list = (trackers.filter(t => t.leadId === l.id))
          .sort((a, b) => a.timestampMs - b.timestampMs);
        const latest = list[list.length - 1];
        return {
          id: l.id,
          leadNo: l.leadNo,
          personName: l.personName,
          number: l.number,
          callerAssigned: l.callerAssigned || 'Unassigned',
          nextDate: latest?.nextDate || null,
          customerSaid: latest?.customerSaid || ''
        };
      })
      .sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));

    const leadTypeData = LEAD_TYPES.map((type, i) => ({
      name: type,
      value: leads.filter(l => l.leadType === type).length,
      color: CATEGORICAL[i % CATEGORICAL.length]
    }));

    const leadSourceData = LEAD_SOURCES.map((src, i) => ({
      name: src,
      value: leads.filter(l => l.leadSource === src).length,
      color: CATEGORICAL[i % CATEGORICAL.length]
    })).filter(d => d.value > 0);

    // 14-day creation trend
    const days = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }

    const trendData = days.map(d => {
      const key = dateKey(d);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = leads.filter(l => {
        const ld = parseLeadTimestamp(l.timestamp);
        return ld && dateKey(ld) === key;
      }).length;
      return { date: label, count };
    });

    // Caller Performance Leaderboard
    const relevantUsers = isAdmin
      ? allUsers
      : allUsers.filter(u => matchesUserAssignment(u.name, user) || matchesUserAssignment(u.id, user));

    // Deduplicate by caller name so multiple user entries for the same person don't produce duplicate items
    const seenCallerNames = new Set();
    const callerStats = [];

    relevantUsers
      .filter(u => u.name && u.name.trim())
      .forEach(u => {
        const callerName = u.name.trim();
        if (!seenCallerNames.has(callerName.toLowerCase())) {
          seenCallerNames.add(callerName.toLowerCase());
          const assignedLeads = leadsWithStatus.filter(l => 
            (l.callerAssigned && l.callerAssigned.trim().toLowerCase() === callerName.toLowerCase()) ||
            l.callerAssignedId === u.id
          );
          const total = assignedLeads.length;
          const converted = assignedLeads.filter(l => CONVERTED_STATUSES.includes(l._status)).length;
          const pending = assignedLeads.filter(l => isLeadPending(trackers, l)).length;
          const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
          if (total > 0) {
            callerStats.push({ id: u.id, name: callerName, total, converted, pending, rate });
          }
        }
      });

    callerStats.sort((a, b) => b.converted - a.converted || b.rate - a.rate);

    // Upcoming Follow-ups (leads with non-terminal status and nextDate)
    const trackersByLead = {};
    trackers.forEach(t => {
      if (!trackersByLead[t.leadId]) trackersByLead[t.leadId] = [];
      trackersByLead[t.leadId].push(t);
    });

    const upcomingFollowUps = [];
    leads.forEach(l => {
      const list = trackersByLead[l.id] || [];
      const latest = list.length > 0 ? list[list.length - 1] : null;
      if (latest && latest.nextDate && latest.status === 'Future Plan Date') {
        upcomingFollowUps.push({
          id: l.id,
          leadNo: l.leadNo,
          personName: l.personName,
          leadType: l.leadType,
          callerAssigned: l.callerAssigned || 'Unassigned',
          status: latest.status,
          nextDate: latest.nextDate
        });
      }
    });

    upcomingFollowUps.sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));

    const recentLeads = [...leads]
      .reverse()
      .slice(0, 5)
      .map(l => ({
        ...l,
        status: getLeadStatus(trackers, l.id) || 'Never Contacted'
      }));

    return {
      totalLeads,
      neverContactedCount,
      futurePlanCount,
      convertedCount,
      notInterestedCount,
      pendingCount,
      conversionRate,
      siteVisitCount,
      siteVisitLeads,
      leadTypeData,
      leadSourceData,
      trendData,
      callerStats,
      upcomingFollowUps,
      recentLeads
    };
  }
};
