// Shared constants for the Call Tracker module

export const ENQUIRY_STATUSES = ['Interested', 'Not Interested', 'Future Plan Date', 'Site Visit/Meeting'];

// All three resolve a lead — it leaves the Pending call queue. Only Future Plan Date leaves
// it open, awaiting a further call on the date given.
export const TERMINAL_STATUSES = ['Interested', 'Not Interested', 'Site Visit/Meeting'];

// Which terminal outcomes convert the lead into a Customer Master record.
// Site Visit/Meeting moves to Assign Visitor stage instead of Customer Master.
export const CONVERTED_STATUSES = ['Interested'];

// Statuses that also collect a date — Future Plan Date's next-call-on date, or the scheduled
// Site Visit/Meeting date.
export const DATE_STATUSES = ['Future Plan Date', 'Site Visit/Meeting'];

// A lead's current tracking state is derived from its call tracker entries, not stored as a
// flag on the lead itself — this keeps History a true append-only log of every call made.

// All entries for one lead, oldest first — used to number follow-ups in call order.
export const getTrackersForLead = (trackers, leadId, leadNo) => {
  return (trackers || [])
    .filter(t => (leadId && t.leadId === leadId) || (leadNo && t.leadNo === leadNo) || (t.leadNo && t.leadNo === leadId))
    .sort((a, b) => a.timestampMs - b.timestampMs);
};

export const getLatestTrackerForLead = (trackers, leadId, leadNo) => {
  const forLead = getTrackersForLead(trackers, leadId, leadNo);
  return forLead.length > 0 ? forLead[forLead.length - 1] : null;
};

// A lead only enters the Call Tracker's Pending queue once it has an assigned caller —
// before that it lives in the Lead module's own Pending (awaiting assignment) list instead.
// Once assigned (or created directly in Call Tracker), it stays pending until a call is logged
// as Interested, Not Interested, or Site Visit/Meeting.
export const isLeadPending = (trackers, lead) => {
  if (!lead?.callerAssigned && lead?.processType !== 'Direct') return false;
  const latest = getLatestTrackerForLead(trackers, lead?.id, lead?.leadNo);
  return !latest || !TERMINAL_STATUSES.includes(latest.status);
};

// The lead's current outcome status, e.g. to find converted "Received" customers.
export const getLeadStatus = (trackers, leadId, leadNo) => {
  return getLatestTrackerForLead(trackers, leadId, leadNo)?.status || null;
};

// Every tracker entry annotated with its 1-based follow-up number within its lead's history
// (call order), for the History table's "Follow up No" column.
export const annotateFollowUpNumbers = (trackers) => {
  const counts = {};
  const chronological = [...trackers].sort((a, b) => a.timestampMs - b.timestampMs);
  return chronological.map(t => {
    counts[t.leadId] = (counts[t.leadId] || 0) + 1;
    return { ...t, followUpNo: counts[t.leadId] };
  });
};
