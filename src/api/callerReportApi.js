import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';
import { masterApi } from './masterApi';

const monthKeyOf = (timestamp) => {
  const parts = (timestamp || '').split(' ')[0].split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}` : '';
};

export const callerReportApi = {
  async getReportFilters() {
    const [callers, trackers] = await Promise.all([
      masterApi.getCallerNames(),
      callTrackerApi.getCallTrackers()
    ]);

    const callerNames = Array.from(new Set(callers.map(c => c.personName))).filter(Boolean).sort();
    const monthKeys = Array.from(new Set(trackers.map(t => monthKeyOf(t.timestamp)).filter(Boolean))).sort().reverse();

    return {
      callers: callerNames,
      monthKeys
    };
  },

  async getCallerReport({ activeLeadType = 'All', activeCaller = 'Complete', activeMonth = 'All' }) {
    const [leads, trackers] = await Promise.all([
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers()
    ]);

    const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));

    const filteredTrackers = trackers.filter(t => {
      const lead = leadsById[t.leadId];
      if (!lead) return false;
      if (activeLeadType !== 'All' && lead.leadType !== activeLeadType) return false;
      if (activeCaller !== 'Complete' && lead.callerAssigned !== activeCaller) return false;
      if (activeMonth !== 'All' && monthKeyOf(t.timestamp) !== activeMonth) return false;
      return true;
    });

    const byDate = {};
    filteredTrackers.forEach(t => {
      const dateKey = (t.timestamp || '').split(' ')[0]; // "DD/MM/YYYY"
      if (!dateKey) return;
      if (!byDate[dateKey]) {
        byDate[dateKey] = {
          date: dateKey,
          dateSort: dateKey.split('/').reverse().join('-'),
          callingTarget: 0,
          connected: 0,
          interested: 0,
          notInterested: 0,
          meeting: 0,
          callNotReceived: 0
        };
      }
      const row = byDate[dateKey];
      row.callingTarget += 1;
      if (t.status !== 'Call Not Received') row.connected += 1;
      if (t.status === 'Received') row.interested += 1;
      if (t.status === 'Not Interested') row.notInterested += 1;
      if (t.status === 'Need Meeting') row.meeting += 1;
      if (t.status === 'Call Not Received') row.callNotReceived += 1;
    });

    const sortedRows = Object.values(byDate)
      .sort((a, b) => b.dateSort.localeCompare(a.dateSort))
      .map((row, i) => ({ ...row, srNo: i + 1 }));

    const totals = sortedRows.reduce(
      (acc, r) => ({
        callingTarget: acc.callingTarget + r.callingTarget,
        connected: acc.connected + r.connected,
        interested: acc.interested + r.interested,
        notInterested: acc.notInterested + r.notInterested,
        meeting: acc.meeting + r.meeting,
        callNotReceived: acc.callNotReceived + r.callNotReceived
      }),
      { callingTarget: 0, connected: 0, interested: 0, notInterested: 0, meeting: 0, callNotReceived: 0 }
    );

    return {
      rows: sortedRows,
      totals
    };
  }
};
