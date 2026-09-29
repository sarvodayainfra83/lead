// Period ranges and per-employee MIS calculations for the MIS Report page.

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' }
];

const DAY_MS = 24 * 60 * 60 * 1000;

const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const toInputDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fromInputDate = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

// { fromMs, toMs } — toMs is exclusive (start of the day after the range)
export const getPeriodRange = (period, customFrom, customTo) => {
  const today = midnight(new Date());
  const tomorrow = new Date(today.getTime() + DAY_MS);
  switch (period) {
    case 'today':
      return { fromMs: today.getTime(), toMs: tomorrow.getTime() };
    case 'yesterday':
      return { fromMs: today.getTime() - DAY_MS, toMs: today.getTime() };
    case 'week': {
      // Week starts on Monday
      const offset = (today.getDay() + 6) % 7;
      return { fromMs: today.getTime() - offset * DAY_MS, toMs: tomorrow.getTime() };
    }
    case 'month':
      return { fromMs: new Date(today.getFullYear(), today.getMonth(), 1).getTime(), toMs: tomorrow.getTime() };
    case 'lastMonth':
      return {
        fromMs: new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime(),
        toMs: new Date(today.getFullYear(), today.getMonth(), 1).getTime()
      };
    case 'custom': {
      const from = fromInputDate(customFrom) || today;
      const to = fromInputDate(customTo) || today;
      const [a, b] = from <= to ? [from, to] : [to, from];
      return { fromMs: a.getTime(), toMs: b.getTime() + DAY_MS };
    }
    default:
      return { fromMs: 0, toMs: tomorrow.getTime() };
  }
};

// Attendance 'date' is stored as DD/MM/YYYY
export const parseAttendanceDate = (val) => {
  const [d, m, y] = String(val || '').split(' ')[0].split('/').map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
};

export const formatDate = (ms) => {
  if (!ms) return '-';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const formatTime = (ms) => {
  if (!ms) return '-';
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

// Working days (Mon–Sat) in the range, counted only up to today
export const countWorkingDays = (fromMs, toMs, earliestMs = 0) => {
  const todayEnd = midnight(new Date()).getTime() + DAY_MS;
  const start = Math.max(fromMs, earliestMs);
  const end = Math.min(toMs, todayEnd);
  let days = 0;
  for (let t = midnight(new Date(start)).getTime(); t < end; t += DAY_MS) {
    if (new Date(t).getDay() !== 0) days += 1;
  }
  return days;
};

export const normName = (s) => String(s || '').trim().toLowerCase();

const inRange = (ms, range) => ms >= range.fromMs && ms < range.toMs;

/**
 * Build one MIS row per employee for the given (already tab-filtered) data and period.
 * Calls & outcomes are attributed to the lead's assigned caller, enquiries to the lead's
 * receiver (Team Member), site visits / deals to the visitor.
 */
export const buildEmployeeRows = ({ employees, leads, calls, attendance, visits, visitFollowUps, range }) => {
  const rows = new Map();
  const todayMs = midnight(new Date()).getTime();

  const ensure = (name, info = {}) => {
    const key = normName(name);
    if (!key) return null;
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        name: String(name).trim(),
        position: '', leadType: '', number: '', email: '', role: '',
        // leads
        assigned: 0, newLeads: 0, enquiries: 0, notCalled: 0,
        // calls
        calls: 0, todayCalls: 0, leadsCalled: new Set(),
        // outcomes of calls made in the period
        interested: 0, futurePlan: 0, siteVisit: 0, notInterested: 0,
        // current temperature of leads called in the period
        hot: 0, warm: 0, cold: 0,
        // visits
        visitsAssigned: 0, visitsDone: 0, dealsWon: 0, closingAmount: 0,
        // attendance
        presentDays: 0, todayIn: '', todayOut: '', lastInTime: '',
        firstAttendanceMs: 0
      });
    }
    const row = rows.get(key);
    Object.entries(info).forEach(([k, v]) => { if (v && !row[k]) row[k] = v; });
    return row;
  };

  employees
    .filter(e => String(e.role || '').toUpperCase() !== 'ADMIN')
    .forEach(e => ensure(e.name, { position: e.position, leadType: e.leadType, number: e.number, email: e.email, role: e.role }));

  leads.forEach(l => {
    const caller = ensure(l.callerAssigned || 'Unassigned');
    if (caller) {
      caller.assigned += 1;
      if (l.createdDate && inRange(l.createdDate.getTime(), range)) caller.newLeads += 1;
      if (l.trackers.length === 0) caller.notCalled += 1;
    }
    if (l.leadReceiver && l.createdDate && inRange(l.createdDate.getTime(), range)) {
      const receiver = ensure(l.leadReceiver);
      if (receiver) receiver.enquiries += 1;
    }
  });

  const leadById = Object.fromEntries(leads.map(l => [String(l.id), l]));
  calls.forEach(c => {
    const row = ensure(c.callerAssigned || 'Unassigned');
    if (!row) return;
    if (c.timestampMs >= todayMs && c.timestampMs < todayMs + DAY_MS) row.todayCalls += 1;
    if (!inRange(c.timestampMs, range)) return;
    row.calls += 1;
    row.leadsCalled.add(String(c.leadId));
    // Remember each lead's last call in the period — outcomes count leads, not calls
    if (!row.lastCallByLead) row.lastCallByLead = {};
    const prev = row.lastCallByLead[c.leadId];
    if (!prev || c.timestampMs >= prev.timestampMs) row.lastCallByLead[c.leadId] = c;
  });
  rows.forEach(row => {
    Object.values(row.lastCallByLead || {}).forEach(c => {
      if (c.status === 'Interested') row.interested += 1;
      if (c.status === 'Future Plan Date') row.futurePlan += 1;
      if (c.status === 'Site Visit/Meeting') row.siteVisit += 1;
      if (c.status === 'Not Interested') row.notInterested += 1;
    });
    delete row.lastCallByLead;
  });
  // Temperature: each lead once, using its current Hot / Warm / Cold
  rows.forEach(row => {
    row.leadsCalled.forEach(id => {
      const lead = leadById[id];
      if (lead?.customerStatus === 'Hot') row.hot += 1;
      if (lead?.customerStatus === 'Warm') row.warm += 1;
      if (lead?.customerStatus === 'Cold') row.cold += 1;
    });
  });

  visits.forEach(v => {
    if (!inRange(v.visitMs, range)) return;
    const row = ensure(v.visitorName);
    if (!row) return;
    row.visitsAssigned += 1;
    if (v.status === 'Completed') row.visitsDone += 1;
  });
  visitFollowUps.forEach(f => {
    if (!inRange(f.timestampMs, range)) return;
    const row = ensure(f.visitorName);
    if (!row) return;
    if (f.dealOutcome === 'Closed (Won)') {
      row.dealsWon += 1;
      row.closingAmount += Number(String(f.closingAmount || '0').replace(/[^0-9.]/g, '')) || 0;
    }
  });

  const todayStr = formatDate(todayMs);
  attendance.forEach(a => {
    const row = rows.get(normName(a.userName));
    if (!row) return;
    const day = parseAttendanceDate(a.date);
    if (!day) return;
    const dayMs = day.getTime();
    if (!row.firstAttendanceMs || dayMs < row.firstAttendanceMs) row.firstAttendanceMs = dayMs;
    if (a.date === todayStr) {
      row.todayIn = a.inTime || 'Present';
      row.todayOut = a.outTime || '';
    }
    if (inRange(dayMs, range) && (a.inTime || a.status)) {
      row.presentDays += 1;
      row.lastInTime = a.inTime || row.lastInTime;
    }
  });

  const list = Array.from(rows.values()).map(r => {
    const workingDays = countWorkingDays(range.fromMs, range.toMs, range.fromMs === 0 ? r.firstAttendanceMs : 0);
    const conversion = r.leadsCalled.size ? Math.round((r.interested / r.leadsCalled.size) * 100) : 0;
    return {
      ...r,
      leadsCalledCount: r.leadsCalled.size,
      workingDays,
      attendancePct: workingDays ? Math.min(100, Math.round((r.presentDays / workingDays) * 100)) : 0,
      avgCallsPerDay: r.presentDays ? Math.round((r.calls / r.presentDays) * 10) / 10 : r.calls,
      conversion
    };
  });

  // Performance score: 60% conversion, 40% call activity relative to the busiest employee
  const maxCalls = Math.max(1, ...list.map(r => r.calls));
  return list
    .map(r => {
      const score = Math.round(r.conversion * 0.6 + (r.calls / maxCalls) * 100 * 0.4);
      const rating = r.calls === 0 && r.assigned === 0 ? '-'
        : score >= 70 ? 'Excellent' : score >= 45 ? 'Good' : score >= 20 ? 'Average' : 'Low';
      return { ...r, score, rating };
    })
    .sort((a, b) => b.score - a.score || b.calls - a.calls || a.name.localeCompare(b.name));
};

// Day-by-day breakdown for one employee (used in the employee detail popup)
export const buildDailyBreakdown = ({ employeeName, leads, calls, attendance, range }) => {
  const key = normName(employeeName);
  const todayEnd = midnight(new Date()).getTime() + DAY_MS;
  const start = range.fromMs || (() => {
    const firsts = [
      ...calls.filter(c => normName(c.callerAssigned) === key).map(c => c.timestampMs),
      ...attendance.filter(a => normName(a.userName) === key).map(a => parseAttendanceDate(a.date)?.getTime() || 0)
    ].filter(Boolean);
    return firsts.length ? Math.min(...firsts) : todayEnd - 30 * DAY_MS;
  })();
  const end = Math.min(range.toMs, todayEnd);

  const days = [];
  for (let t = midnight(new Date(start)).getTime(); t < end; t += DAY_MS) {
    days.push({ dayMs: t, calls: 0, interested: 0, futurePlan: 0, siteVisit: 0, notInterested: 0, newLeads: 0, inTime: '', outTime: '', present: false });
  }
  const byDay = Object.fromEntries(days.map(d => [d.dayMs, d]));
  const dayOf = (ms) => byDay[midnight(new Date(ms)).getTime()];

  calls.filter(c => normName(c.callerAssigned) === key).forEach(c => {
    const d = dayOf(c.timestampMs);
    if (!d) return;
    d.calls += 1;
    if (c.status === 'Interested') d.interested += 1;
    if (c.status === 'Future Plan Date') d.futurePlan += 1;
    if (c.status === 'Site Visit/Meeting') d.siteVisit += 1;
    if (c.status === 'Not Interested') d.notInterested += 1;
  });
  leads.filter(l => normName(l.callerAssigned) === key && l.createdDate).forEach(l => {
    const d = byDay[l.createdDate.getTime()];
    if (d) d.newLeads += 1;
  });
  attendance.filter(a => normName(a.userName) === key).forEach(a => {
    const day = parseAttendanceDate(a.date);
    const d = day && byDay[day.getTime()];
    if (!d) return;
    d.present = true;
    d.inTime = a.inTime || '';
    d.outTime = a.outTime || '';
  });

  return days.reverse(); // newest day first
};

// One Excel row per call: call outcome + every customer / lead detail (as shown in the popups)
export const callToExportRow = (c, lead = {}) => ({
  Date: formatDate(c.timestampMs),
  Time: formatTime(c.timestampMs),
  Employee: c.callerAssigned || lead.callerAssigned || '-',
  'Lead No': c.leadNo || lead.leadNo || '-',
  'Lead Type': lead.leadType || '-',
  'Lead Date': lead.createdDate ? formatDate(lead.createdDate.getTime()) : '-',
  'Customer Name': c.personName || lead.personName || '-',
  Phone: c.number || lead.number || '-',
  Email: lead.email || '-',
  DOB: lead.dob || '-',
  Occupation: lead.occupation || '-',
  Address: lead.location || '-',
  'Lead Source': lead.leadSource || '-',
  'Team Member': lead.leadReceiver || '-',
  'Referencer': lead.referencerName || '-',
  'Product Type': lead.productType || lead.insuranceType || '-',
  'Sub Product Type': lead.insuranceSubType || '-',
  Requirement: lead.requirement || '-',
  'Site Location': lead.siteLocation || '-',
  'Investment Budget': lead.investmentBudget || '-',
  'When to Buy': lead.whenToBuyPlan || '-',
  'Medical Condition': lead.anyDesease || '-',
  'Call Status': c.status || '-',
  'Customer Status': c.customerStatus || '-',
  'What Customer Said': c.customerSaid || '-',
  'Next Call Date': c.nextDate ? String(c.nextDate).split('T')[0].split('-').reverse().join('/') : '-',
  'Admin Remark': c.adminRemark || '-',
  'Lead Remarks': lead.remarks || '-',
  'Current Lead Status': lead.status || 'Not Called',
  'Current Customer Status': lead.customerStatus || '-'
});

// Day-wise rows (attendance + calls) for one employee, labelled with their name
export const dailyToExportRows = (employeeName, daily) => daily.map(d => ({
  Employee: employeeName,
  Date: formatDate(d.dayMs),
  Attendance: d.present ? 'Present' : (new Date(d.dayMs).getDay() === 0 ? 'Sunday' : 'Absent'),
  'In Time': d.inTime || '-',
  'Out Time': d.outTime || '-',
  Calls: d.calls,
  Interested: d.interested,
  'Future Plan': d.futurePlan,
  'Site Visit': d.siteVisit,
  'Not Interested': d.notInterested,
  'New Leads': d.newLeads
}));
