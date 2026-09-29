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

// Customer temperature captured per call (call_trackers.customer_status)
export const CUSTOMER_STATUSES = ['Hot', 'Warm', 'Cold'];

// Customer Master lists leads whose latest Customer Status is one of these
export const CUSTOMER_MASTER_STATUSES = ['Hot', 'Warm'];

// Normalize any stored casing/spacing ('warm', ' HOT ') to 'Hot' / 'Warm' / 'Cold'
export const normalizeCustomerStatus = (val) => {
  const s = String(val || '').trim().toLowerCase();
  return CUSTOMER_STATUSES.find(c => c.toLowerCase() === s) || '';
};

// Latest non-empty Hot / Warm / Cold recorded across a lead's calls ('' if never recorded)
export const getLatestCustomerStatus = (trackers, leadId, leadNo) => {
  const forLead = getTrackersForLead(trackers, leadId, leadNo);
  for (let i = forLead.length - 1; i >= 0; i--) {
    const status = normalizeCustomerStatus(forLead[i].customerStatus);
    if (status) return status;
  }
  return '';
};

// A lost deal from Site Visit follow-up keeps a lead out of Customer Master even if Hot/Warm
export const isFollowUpRejected = (followUp) => Boolean(
  followUp && (
    followUp.dealOutcome === 'Rejected (Lost)' ||
    followUp.status === 'Not Interested' ||
    followUp.rejectionReason
  )
);

export const CUSTOMER_STATUS_STYLES = {
  Hot: 'bg-red-50 text-red-700 border-red-200',
  Warm: 'bg-amber-50 text-amber-700 border-amber-200',
  Cold: 'bg-sky-50 text-sky-700 border-sky-200'
};

// Format an ISO timestamp (e.g. updated_at) as DD/MM/YYYY HH:MM
export const formatDateTime = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// A lead's current tracking state is derived from its call tracker entries, not stored as a
// flag on the lead itself — this keeps History a true append-only log of every call made.

// All entries for one lead, oldest first — used to number follow-ups in call order.
export const getTrackersForLead = (trackers, leadId, leadNo, leadNumber = null) => {
  const sId = leadId != null ? String(leadId) : null;
  const sNo = leadNo != null ? String(leadNo).trim() : null;
  const sNum = leadNumber != null ? String(leadNumber).trim() : null;

  return (trackers || [])
    .filter(t => {
      const tLeadId = t.leadId != null ? String(t.leadId) : null;
      const tLeadNo = t.leadNo != null ? String(t.leadNo).trim() : null;
      const tNum = (t.number || t.customerNumber) != null ? String(t.number || t.customerNumber).trim() : null;

      if (sId && (tLeadId === sId || tLeadNo === sId)) return true;
      if (sNo && (tLeadNo === sNo || tLeadId === sNo)) return true;
      if (sNum && tNum && sNum === tNum) return true;
      return false;
    })
    .sort((a, b) => (Number(a.timestampMs) || 0) - (Number(b.timestampMs) || 0));
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
