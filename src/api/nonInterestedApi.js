import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { siteVisitMeetingApi } from './siteVisitMeetingApi';
import { getLatestTrackerForLead, normalizeCustomerStatus } from '../pages/CallTracker/callTrackerConstants';

/**
 * Helper to check if a status string represents "Not Interested" or "Rejected"
 */
const isNotInterestedStatus = (val) => {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === 'not interested' ||
    s === 'not_interested' ||
    s === 'rejected' ||
    s === 'rejected (lost)' ||
    s === 'lost' ||
    s.includes('not interested') ||
    s.includes('rejected')
  );
};

export const nonInterestedApi = {
  /**
   * Fetches all leads who are marked as "Not Interested" or "Rejected",
   * either in Call Tracker or Site Visit / Meeting follow-ups.
   * Formats the objects to match the exact schema used in Site Visit / Meeting table.
   */
  async getNonInterestedLeads() {
    const [leads, trackers, assignedVisitors, followUps] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers(),
      siteVisitMeetingApi.getAssignedVisitors(),
      siteVisitMeetingApi.getVisitorFollowUps()
    ]);
    return this.buildNonInterestedLeads(leads, trackers, assignedVisitors, followUps);
  },

  // Same as getNonInterestedLeads, from already-fetched data (used by the sidebar badge counts)
  buildNonInterestedLeads(leads, trackers, assignedVisitors, followUps) {
    const cleanKey = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      if (!s || s === 'null' || s === 'undefined' || s === '-' || s === '0') return null;
      return s;
    };

    // Group assigned visitors by lead
    const assignmentsByLeadId = {};
    const assignmentsByLeadNo = {};
    (assignedVisitors || []).forEach(a => {
      if (a.status === 'Cancelled') return;
      const kId = cleanKey(a.leadId);
      const kNo = cleanKey(a.leadNo);
      if (kId) {
        if (!assignmentsByLeadId[kId]) assignmentsByLeadId[kId] = [];
        assignmentsByLeadId[kId].push(a);
      }
      if (kNo) {
        if (!assignmentsByLeadNo[kNo]) assignmentsByLeadNo[kNo] = [];
        assignmentsByLeadNo[kNo].push(a);
      }
    });

    // Group follow-ups by lead
    const followUpsByLeadId = {};
    const followUpsByLeadNo = {};
    (followUps || []).forEach(f => {
      const kId = cleanKey(f.leadId);
      const kNo = cleanKey(f.leadNo);
      if (kId) {
        if (!followUpsByLeadId[kId]) followUpsByLeadId[kId] = [];
        followUpsByLeadId[kId].push(f);
      }
      if (kNo) {
        if (!followUpsByLeadNo[kNo]) followUpsByLeadNo[kNo] = [];
        followUpsByLeadNo[kNo].push(f);
      }
    });

    // Group call trackers by lead
    const trackersByLeadId = {};
    const trackersByLeadNo = {};
    (trackers || []).forEach(t => {
      const kId = cleanKey(t.leadId);
      const kNo = cleanKey(t.leadNo);
      if (kId) {
        if (!trackersByLeadId[kId]) trackersByLeadId[kId] = [];
        trackersByLeadId[kId].push(t);
      }
      if (kNo) {
        if (!trackersByLeadNo[kNo]) trackersByLeadNo[kNo] = [];
        trackersByLeadNo[kNo].push(t);
      }
    });

    const nonInterestedList = [];

    leads.forEach(lead => {
      const kId = cleanKey(lead.id);
      const kNo = cleanKey(lead.leadNo);

      // Latest call tracker
      const latestTracker = getLatestTrackerForLead(trackers, lead.id, lead.leadNo);

      // All assignments for this lead
      const seenAssignmentIds = new Set();
      const leadAssignments = [];
      const assignmentCandidates = [
        ...(kId && assignmentsByLeadId[kId] ? assignmentsByLeadId[kId] : []),
        ...(kNo && assignmentsByLeadNo[kNo] ? assignmentsByLeadNo[kNo] : [])
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

      // All follow-ups for this lead
      const seenFollowUpIds = new Set();
      const leadFollowUps = [];
      const followUpCandidates = [
        ...(kId && followUpsByLeadId[kId] ? followUpsByLeadId[kId] : []),
        ...(kNo && followUpsByLeadNo[kNo] ? followUpsByLeadNo[kNo] : [])
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

      // All trackers for this lead
      const leadTrackers = [
        ...(kId && trackersByLeadId[kId] ? trackersByLeadId[kId] : []),
        ...(kNo && trackersByLeadNo[kNo] ? trackersByLeadNo[kNo] : [])
      ];

      // Determine if this lead is currently Non-interested based on latest activity
      const latestFollowUpTime = latestFollowUp ? (Number(latestFollowUp.timestampMs) || new Date(latestFollowUp.createdAt || 0).getTime()) : 0;
      const latestTrackerTime = latestTracker ? (Number(latestTracker.timestampMs) || new Date(latestTracker.timestamp || 0).getTime()) : 0;

      let isCandidate = false;
      if (latestFollowUp && latestFollowUpTime >= latestTrackerTime) {
        isCandidate = isNotInterestedStatus(latestFollowUp.status) || isNotInterestedStatus(latestFollowUp.dealOutcome);
      } else if (latestTracker) {
        isCandidate = isNotInterestedStatus(latestTracker.status) || isNotInterestedStatus(latestTracker.customerStatus);
      } else if (latestFollowUp) {
        isCandidate = isNotInterestedStatus(latestFollowUp.status) || isNotInterestedStatus(latestFollowUp.dealOutcome);
      } else {
        isCandidate = isNotInterestedStatus(lead.status);
      }

      if (!isCandidate) return;

      // Format dates
      const meetingDate = latestAssignment?.visitDate
        || latestTracker?.nextDate
        || lead.visitDate
        || (leadFollowUps.length > 0 ? leadFollowUps[0].visitDate : '')
        || latestTracker?.date
        || '';

      const nextMeetingDate = latestFollowUp?.nextVisitDate || latestTracker?.nextDate || '';

      const latestFeedback = latestFollowUp?.whatHappened
        || latestFollowUp?.visitorRemarks
        || latestTracker?.customerSaid
        || lead.remarks
        || '';

      const customerStatus = latestFollowUp?.customerStatus
        || latestFollowUp?.customer_status
        || latestTracker?.customerStatus
        || (isLeadStatusNotInterested ? 'Cold' : 'Cold');

      nonInterestedList.push({
        ...lead,
        id: latestFollowUp?.id || latestAssignment?.id || latestTracker?.id || `non-int-${lead.id}`,
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
        relationshipManager: lead.leadReceiver || '',
        // Dates
        meetingDate,
        nextMeetingDate,
        nextVisitDate: nextMeetingDate,
        nextCallDate: latestTracker?.nextDate || lead.nextCallDate || '',
        visitDate: meetingDate,
        // Call Tracker info
        trackers: leadTrackers,
        callerAssigned: lead.callerAssigned || latestTracker?.callerAssigned || '',
        caller: lead.caller || latestTracker?.caller || lead.callerAssigned || '',
        callTrackerId: latestTracker?.id || null,
        callTrackerRemarks: latestTracker?.customerSaid || '',
        // Visitor Assignment info
        assignedVisitorId: latestAssignment?.id || null,
        assignedVisitor: latestAssignment?.visitorName || latestFollowUp?.visitorName || lead.assignedVisitor || '',
        visitorId: latestAssignment?.visitorId || latestFollowUp?.visitorId || lead.visitorId || '',
        location: latestAssignment?.location || lead.customerAddress || lead.location || '',
        visitorRemarks: latestAssignment?.remarks || '',
        assignedAt: latestAssignment?.timestamp || latestAssignment?.created_at || '',
        // Follow-Up info
        followUps: leadFollowUps,
        followUpCount: leadFollowUps.length || (latestTracker ? 1 : 0),
        followUpNo: leadFollowUps.length || 1,
        latestFollowUp,
        visitMeet: latestFollowUp?.visitMeet || latestFollowUp?.visit_meet || (leadFollowUps.find(f => f.visitMeet || f.visit_meet)?.visitMeet) || lead.visitMeet || lead.visit_meet || null,
        visit_meet: latestFollowUp?.visitMeet || latestFollowUp?.visit_meet || (leadFollowUps.find(f => f.visitMeet || f.visit_meet)?.visitMeet) || lead.visitMeet || lead.visit_meet || null,
        parentId: latestFollowUp?.parentId || latestFollowUp?.parent_id || null,
        parent_id: latestFollowUp?.parentId || latestFollowUp?.parent_id || null,
        // Computed lifecycle status
        status: 'Not Interested',
        customerStatus: customerStatus || 'Cold',
        customer_status: customerStatus || 'Cold',
        interestLevel: customerStatus || 'Cold',
        dealOutcome: latestFollowUp?.dealOutcome || 'Rejected (Lost)',
        rejectionReason: latestFollowUp?.rejectionReason || latestFeedback || 'Not Interested',
        salesExecutive: latestFollowUp?.salesExecutive || '',
        closingAmount: latestFollowUp?.closingAmount || '',
        referenceNo: latestFollowUp?.referenceNo || '',
        dealRemarks: latestFollowUp?.dealRemarks || '',
        whatHappened: latestFeedback,
        lastUpdated: latestFollowUp?.createdAt || latestTracker?.timestamp || latestAssignment?.timestamp || lead.timestamp || ''
      });
    });

    // Sort by latest activity descending
    return nonInterestedList.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));
  }
};
