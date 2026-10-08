import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { authApi } from './authApi';
import { attendanceApi } from './attendanceApi';
import { siteVisitMeetingApi } from './siteVisitMeetingApi';
import {
  getLeadStatus, isLeadPending, CONVERTED_STATUSES, getTrackersForLead, getLatestCustomerStatus,
  getFollowUpsForLead, getEffectiveCustomerStatus, isFollowUpRejected,
  isDirectSiteVisitLead, buildCalledLeadKeys, isInFollowUpQueue
} from '../pages/CallTracker/callTrackerConstants';
import { LEAD_TYPES, LEAD_SOURCES, parseLeadDate } from '../pages/Lead/leadConstants';
import { isUserAdmin, matchesUserAssignment, matchesUserReceiver, matchesUserConnection, getLeadCategory } from '../utils/authUtils';

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
  // limited to their own connected leads and their own attendance.
  async getDashboardData(user = null) {
    const [allLeads, allTrackers, allUsers, attendanceLogs, allVisits, allVisitFollowUps] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      authApi.getUsers().catch(() => []),
      attendanceApi.getAttendanceLogs().catch(() => []),
      siteVisitMeetingApi.getAssignedVisitors().catch(() => []),
      siteVisitMeetingApi.getVisitorFollowUps().catch(() => [])
    ]);

    const isAdmin = isUserAdmin(user);

    // Pre-group assigned visitors by leadId and leadNo
    const visitsByLead = {};
    (allVisits || []).forEach(v => {
      if (v.status === 'Cancelled') return;
      const idKey = v.leadId != null ? String(v.leadId) : null;
      const noKey = v.leadNo != null ? String(v.leadNo).trim() : null;
      if (idKey) {
        if (!visitsByLead[idKey]) visitsByLead[idKey] = [];
        visitsByLead[idKey].push(v);
      }
      if (noKey && noKey !== idKey) {
        if (!visitsByLead[noKey]) visitsByLead[noKey] = [];
        visitsByLead[noKey].push(v);
      }
    });

    // Pre-group visitor follow-ups by leadId and leadNo
    const followUpsByLead = {};
    (allVisitFollowUps || []).forEach(f => {
      const idKey = f.leadId != null ? String(f.leadId) : null;
      const noKey = f.leadNo != null ? String(f.leadNo).trim() : null;
      if (idKey) {
        if (!followUpsByLead[idKey]) followUpsByLead[idKey] = [];
        followUpsByLead[idKey].push(f);
      }
      if (noKey && noKey !== idKey) {
        if (!followUpsByLead[noKey]) followUpsByLead[noKey] = [];
        followUpsByLead[noKey].push(f);
      }
    });

    // Role USER: only their own connected leads — as caller, receiver or visitor, or as Sales Executive on
    // the latest visit follow-up. Same rule as the Hot Customers page, so their counts match.
    const calledLeadKeys = buildCalledLeadKeys(allTrackers);
    // Leads the Site Visit / Meeting page lists — its card opens that page, so the count uses the same list
    const siteVisitListIds = new Set(
      siteVisitMeetingApi.buildSiteVisitMeetingLeads(allLeads, allTrackers, allVisits || [], allVisitFollowUps || [])
        .map(l => String(l.leadId))
    );
    const enrichedLeads = allLeads.map(lead => {
      const leadIdStr = lead.id != null ? String(lead.id) : '';
      const leadNoStr = lead.leadNo != null ? String(lead.leadNo).trim() : '';

      const leadTrackers = getTrackersForLead(allTrackers, lead.id, lead.leadNo);
      const latestTracker = leadTrackers[leadTrackers.length - 1] || null;

      const rawVisits = [
        ...(leadIdStr && visitsByLead[leadIdStr] ? visitsByLead[leadIdStr] : []),
        ...(leadNoStr && visitsByLead[leadNoStr] ? visitsByLead[leadNoStr] : [])
      ];
      const seenVisitIds = new Set();
      const leadVisits = [];
      rawVisits.forEach(v => {
        const vid = v.id || `${v.leadNo}-${v.timestamp || v.created_at}`;
        if (!seenVisitIds.has(vid)) {
          seenVisitIds.add(vid);
          leadVisits.push(v);
        }
      });
      const latestVisit = leadVisits[leadVisits.length - 1] || null;

      const rawFollowUps = [
        ...(leadIdStr && followUpsByLead[leadIdStr] ? followUpsByLead[leadIdStr] : []),
        ...(leadNoStr && followUpsByLead[leadNoStr] ? followUpsByLead[leadNoStr] : [])
      ];
      const seenFollowUpIds = new Set();
      const leadFollowUps = [];
      rawFollowUps.forEach(f => {
        const fid = f.id || `${f.leadNo}-${f.timestampMs || f.createdAt || f.created_at}`;
        if (!seenFollowUpIds.has(fid)) {
          seenFollowUpIds.add(fid);
          leadFollowUps.push(f);
        }
      });
      leadFollowUps.sort((a, b) => {
        const aMs = Number(a.timestampMs) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bMs = Number(b.timestampMs) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return aMs - bMs;
      });
      const latestFollowUp = leadFollowUps[leadFollowUps.length - 1] || null;

      const assignedVisitor = latestVisit?.visitorName || latestFollowUp?.visitorName || lead.assignedVisitor || '';
      const connectionObject = {
        ...lead,
        assignedVisitor,
        visitorName: assignedVisitor,
        assignedVisitorId: latestVisit?.visitorId || latestVisit?.visitor_id,
        salesExecutive: latestFollowUp?.salesExecutive || lead.salesExecutive,
        visitorFollowUps: leadFollowUps,
        followUps: leadFollowUps
      };

      if (!isAdmin && !matchesUserConnection(connectionObject, user)) {
        return null;
      }

      const latestTrackerMs = Number(latestTracker?.timestampMs) || 0;
      const latestFollowUpMs = latestFollowUp ? (Number(latestFollowUp.timestampMs) || (latestFollowUp.createdAt ? new Date(latestFollowUp.createdAt).getTime() : 0)) : 0;
      const lastActivityMs = Math.max(latestTrackerMs, latestFollowUpMs);

      // Customer status considering both trackers and visitor follow-ups
      const customerStatus = getEffectiveCustomerStatus(leadTrackers, leadFollowUps, lead.id, lead.leadNo);

      // Current active status
      let currentStatus = latestTracker?.status || lead.status || null;
      if (latestFollowUpMs >= latestTrackerMs && latestFollowUp?.status) {
        currentStatus = isFollowUpRejected(latestFollowUp) ? 'Rejected (Lost)' : latestFollowUp.status;
      }

      // Status as the Lead & Followup list shows it — only leads that list carries, latest call only
      // (matched by phone too). The Converted / Future Plan cards open that list, so their counts use this.
      const inFollowUpList = !isDirectSiteVisitLead(lead) && isInFollowUpQueue(lead, calledLeadKeys) &&
        (isAdmin || matchesUserConnection(lead, user));
      const latestListTracker = getTrackersForLead(allTrackers, lead.id, lead.leadNo, lead.number || lead.customerNumber).pop();
      const followUpListStatus = inFollowUpList
        ? (latestListTracker?.status || (lead.callerAssigned ? 'Pending' : 'Unassigned'))
        : null;

      // Site Visit detection: assigned visitor, follow ups, direct site visit, or visit tracker status
      const isSiteVisit = Boolean(
        leadVisits.length > 0 ||
        leadFollowUps.length > 0 ||
        (latestTracker?.status && String(latestTracker.status).toLowerCase().includes('visit')) ||
        (lead.status && String(lead.status).toLowerCase().includes('visit')) ||
        (latestTracker?.status && String(latestTracker.status).toLowerCase().includes('meeting')) ||
        (lead.status && String(lead.status).toLowerCase().includes('meeting')) ||
        (lead.visitMeet?.['site-visit'] || lead.visitMeet?.meeting)
      );

      return {
        ...lead,
        category: getLeadCategory(lead.leadType, lead.leadNo),
        createdDate: parseLeadDate(lead),
        trackers: leadTrackers,
        followUps: leadFollowUps,
        visits: leadVisits,
        assignedVisitor,
        latestTracker,
        latestFollowUp,
        latestVisit,
        isSiteVisit,
        siteVisitsCount: Math.max(leadVisits.length, leadFollowUps.length, isSiteVisit ? 1 : 0),
        status: currentStatus,
        followUpListStatus,
        inSiteVisitList: siteVisitListIds.has(String(lead.id)),
        customerStatus,
        // Deal marked lost in a Site Visit follow-up — not a Hot/Warm client (same rule as Hot Customers page)
        isLost: isFollowUpRejected(latestFollowUp),
        lastActivityMs
      };
    }).filter(Boolean);

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
    const leads = isAdmin ? allLeads : allLeads.filter(l => matchesUserConnection(l, user));
    const trackers = isAdmin ? allTrackers : allTrackers.filter(t => matchesUserConnection(t, user));

    const leadsWithStatus = leads.map(l => ({ ...l, _status: getLeadStatus(trackers, l.id) }));

    const totalLeads = leads.length;
    const neverContactedCount = leadsWithStatus.filter(l => l._status === null).length;
    const futurePlanCount = leadsWithStatus.filter(l => l._status === 'Future Plan Date').length;
    const convertedCount = leadsWithStatus.filter(l => CONVERTED_STATUSES.includes(l._status)).length;
    const notInterestedCount = leadsWithStatus.filter(l => l._status === 'Not Interested').length;
    const pendingCount = leads.filter(l => isLeadPending(trackers, l)).length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    // Site Visit/Meeting leads — latest tracker status is 'Site Visit/Meeting' or 'Meeting'
    const siteVisitCount = leadsWithStatus.filter(l => l._status === 'Site Visit/Meeting' || l._status === 'Meeting').length;

    // Build site visit/meeting leads list with their date & caller
    const siteVisitLeads = leads
      .filter(l => {
        const s = getLeadStatus(trackers, l.id);
        return s === 'Site Visit/Meeting' || s === 'Meeting';
      })
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
