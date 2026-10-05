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

    const leadsById = Object.fromEntries(leads.map(l => [String(l.id), l]));
    const leadsByNo = Object.fromEntries(leads.map(l => [String(l.leadNo), l]));

    // Group assigned visitors by lead
    const assignmentsByLeadId = {};
    const assignmentsByLeadNo = {};
    (assignedVisitors || []).forEach(a => {
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

    // Group follow-ups by lead
    const followUpsByLeadId = {};
    const followUpsByLeadNo = {};
    (followUps || []).forEach(f => {
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

    const nonInterestedList = [];

    leads.forEach(lead => {
      const leadKeyId = String(lead.id || '');
      const leadKeyNo = String(lead.leadNo || '');

      // Latest call tracker
      const latestTracker = getLatestTrackerForLead(trackers, lead.id, lead.leadNo);

      // All assignments for this lead
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

      // All follow-ups for this lead
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

      // Determine if this lead is Non-interested
      const isLeadStatusNotInterested = isNotInterestedStatus(lead.status);
      const isTrackerNotInterested = isNotInterestedStatus(latestTracker?.status) || isNotInterestedStatus(latestTracker?.customerStatus);
      const isFollowUpNotInterested = isNotInterestedStatus(latestFollowUp?.status) || isNotInterestedStatus(latestFollowUp?.dealOutcome);

      // Must have at least one valid "Not Interested" indication as its latest state
      const isCandidate = (
        (latestFollowUp && isFollowUpNotInterested) ||
        (!latestFollowUp && latestTracker && isTrackerNotInterested) ||
        (!latestFollowUp && !latestTracker && isLeadStatusNotInterested) ||
        isFollowUpNotInterested ||
        isTrackerNotInterested ||
        isLeadStatusNotInterested
      );

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
        relationshipManager: lead.leadReceiver || lead.personName || '',
        // Dates
        meetingDate,
        nextMeetingDate,
        nextVisitDate: nextMeetingDate,
        visitDate: meetingDate,
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
