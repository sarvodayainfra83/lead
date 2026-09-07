import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, LabelList
} from 'recharts';
import {
  Users, Clock, CheckCircle2, XCircle, TrendingUp, PhoneCall, CalendarClock, ArrowRight
} from 'lucide-react';
import { getLeads, getCallTrackers, getUsers } from '../../utils/storageManager';
import { LEAD_TYPES, LEAD_SOURCES } from '../Lead/leadConstants';
import { getLeadStatus, isLeadPending } from '../CallTracker/callTrackerConstants';

// Fixed status palette — reserved meanings, never reused for categorical series.
const STATUS_COLORS = {
  Received: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#059669' },
  Expected: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', hex: '#d97706' },
  'Not Interested': { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', hex: '#dc2626' },
  'Need Meeting': { text: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', hex: '#0891b2' },
  'Call Not Received': { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', hex: '#ea580c' },
  'Never Contacted': { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', hex: '#6b7280' }
};

// Fixed categorical order — assigned by each label's position in its source array, never by rank.
const CATEGORICAL = ['#7c3aed', '#0891b2', '#c026d3', '#65a30d', '#ea580c', '#db2777', '#0d9488', '#6b7280'];
const BRAND_NAVY = '#083459';

// Lead.timestamp is stored as "DD/MM/YYYY HH:MM:SS"
const parseLeadTimestamp = (ts) => {
  if (!ts) return null;
  const [datePart] = ts.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDate = (val) => {
  if (!val) return '-';
  const parts = val.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return val;
};

const StatTile = ({ icon: Icon, label, value, tone }) => (
  <div className={`flex items-center gap-3 rounded-xl border ${tone.border} ${tone.bg} p-3 md:p-4`}>
    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-white border ${tone.border}`}>
      <Icon size={18} className={tone.text} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide truncate">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${tone.text}`}>{value}</p>
    </div>
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col min-h-0">
    <h3 className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">{title}</h3>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-gray-600">{payload[0].value} lead{payload[0].value === 1 ? '' : 's'}</p>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();

  const {
    totalLeads, neverContactedCount, expectedCount, receivedCount, notInterestedCount,
    pendingCount, conversionRate, leadTypeData, leadSourceData, trendData,
    callerStats, upcomingFollowUps, recentLeads
  } = useMemo(() => {
    const leads = getLeads();
    const trackers = getCallTrackers();
    const users = getUsers();

    const leadsWithStatus = leads.map(l => ({ ...l, _status: getLeadStatus(trackers, l.id) }));

    const totalLeads = leads.length;
    const neverContactedCount = leadsWithStatus.filter(l => l._status === null).length;
    const expectedCount = leadsWithStatus.filter(l => l._status === 'Expected').length;
    const receivedCount = leadsWithStatus.filter(l => l._status === 'Received').length;
    const notInterestedCount = leadsWithStatus.filter(l => l._status === 'Not Interested').length;
    const pendingCount = leads.filter(l => isLeadPending(trackers, l)).length;
    const conversionRate = totalLeads > 0 ? Math.round((receivedCount / totalLeads) * 100) : 0;

    const leadTypeData = LEAD_TYPES.map((type, i) => ({
      name: type,
      value: leads.filter(l => l.leadType === type).length,
      color: CATEGORICAL[i % CATEGORICAL.length]
    }));

    const leadSourceData = LEAD_SOURCES.map((src, i) => ({
      name: src,
      value: leads.filter(l => l.leadSource === src).length,
      color: CATEGORICAL[i % CATEGORICAL.length]
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    // Leads created per day, last 14 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayBuckets = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dayBuckets.push({ key: dateKey(d), label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, value: 0 });
    }
    const bucketByKey = Object.fromEntries(dayBuckets.map(b => [b.key, b]));
    leads.forEach(l => {
      const d = parseLeadTimestamp(l.timestamp);
      if (!d) return;
      const key = dateKey(d);
      if (bucketByKey[key]) bucketByKey[key].value += 1;
    });
    const trendData = dayBuckets;

    // Caller performance
    const callerStats = users.map(u => {
      const assigned = leadsWithStatus.filter(l => l.callerAssigned === u.name);
      const total = assigned.length;
      const received = assigned.filter(l => l._status === 'Received').length;
      const pending = assigned.filter(l => l._status === null || l._status === 'Expected').length;
      const notInterested = assigned.filter(l => l._status === 'Not Interested').length;
      const rate = total > 0 ? Math.round((received / total) * 100) : 0;
      return { name: u.name, total, received, pending, notInterested, rate };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

    // Upcoming follow-ups: leads currently in "Expected" state, soonest next call date first
    const upcomingFollowUps = leadsWithStatus
      .filter(l => l._status === 'Expected')
      .map(l => {
        const forLead = trackers.filter(t => t.leadId === l.id).sort((a, b) => a.timestampMs - b.timestampMs);
        const latest = forLead[forLead.length - 1];
        return { ...l, nextCallDate: latest?.nextDate || '' };
      })
      .sort((a, b) => (a.nextCallDate || '9999').localeCompare(b.nextCallDate || '9999'))
      .slice(0, 6);

    // Recent leads
    const recentLeads = [...leads].reverse().slice(0, 6);

    return {
      totalLeads, neverContactedCount, expectedCount, receivedCount, notInterestedCount,
      pendingCount, conversionRate, leadTypeData, leadSourceData, trendData,
      callerStats, upcomingFollowUps, recentLeads
    };
  }, []);

  const todayKey = dateKey(new Date());

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="p-2 sm:p-4 md:p-6 space-y-4 md:space-y-6">


        {/* KPI Stat Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile icon={Users} label="Total Leads" value={totalLeads} tone={{ text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' }} />
          <StatTile icon={Clock} label="Pending Follow-ups" value={pendingCount} tone={{ text: STATUS_COLORS.Expected.text, bg: STATUS_COLORS.Expected.bg, border: STATUS_COLORS.Expected.border }} />
          <StatTile icon={CheckCircle2} label="Converted (Received)" value={receivedCount} tone={{ text: STATUS_COLORS.Received.text, bg: STATUS_COLORS.Received.bg, border: STATUS_COLORS.Received.border }} />
          <StatTile icon={XCircle} label="Not Interested" value={notInterestedCount} tone={{ text: STATUS_COLORS['Not Interested'].text, bg: STATUS_COLORS['Not Interested'].bg, border: STATUS_COLORS['Not Interested'].border }} />
          <StatTile icon={TrendingUp} label="Conversion Rate" value={`${conversionRate}%`} tone={{ text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' }} />
        </div>

        {/* Lead Type / Lead Source breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Leads by Type">
            {leadTypeData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={leadTypeData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="#e1e0d9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {leadTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#52514e', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400 italic py-8 text-center">No leads yet.</p>
            )}
          </ChartCard>

          <ChartCard title="Leads by Source">
            {leadSourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={leadSourceData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="#e1e0d9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {leadSourceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#52514e', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400 italic py-8 text-center">No leads yet.</p>
            )}
          </ChartCard>
        </div>

        {/* Leads over last 14 days */}
        <ChartCard title="Leads Created — Last 14 Days">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e1e0d9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {trendData.map((entry, i) => <Cell key={i} fill={entry.key === todayKey ? BRAND_NAVY : '#a2d0f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Caller Performance / Upcoming Follow-ups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Caller Performance</h3>
            {callerStats.length > 0 ? (
              <div className="space-y-3">
                {callerStats.map(c => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">{c.name}</span>
                      <span className="text-gray-500">{c.received}/{c.total} received · {c.rate}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.rate}%`, backgroundColor: BRAND_NAVY }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-4 text-center">No leads assigned yet.</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wide">Upcoming Follow-ups</h3>
              <button
                onClick={() => navigate('/call-tracker')}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            {upcomingFollowUps.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {upcomingFollowUps.map(l => (
                  <div key={l.leadNo} className="flex items-center justify-between py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{l.personName} <span className="text-indigo-600">· {l.leadNo}</span></p>
                      <p className="text-gray-500 truncate">{l.callerAssigned}</p>
                    </div>
                    <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                      <CalendarClock size={11} /> {formatDate(l.nextCallDate)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-4 text-center">No follow-ups scheduled.</p>
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wide">Recent Leads</h3>
            <button
              onClick={() => navigate('/lead')}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {recentLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 uppercase text-[10px] tracking-wide border-b border-gray-100">
                    <th className="py-2 pr-3">Lead No</th>
                    <th className="py-2 pr-3">Person Name</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Number</th>
                    <th className="py-2 pr-3">Caller</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map(l => {
                    const status = getLeadStatus(getCallTrackers(), l.id) || 'Never Contacted';
                    const tone = STATUS_COLORS[status] || STATUS_COLORS['Never Contacted'];
                    return (
                      <tr key={l.leadNo} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 font-bold text-indigo-600 whitespace-nowrap">{l.leadNo}</td>
                        <td className="py-2 pr-3 text-gray-800 whitespace-nowrap">{l.personName}</td>
                        <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{l.leadType}</td>
                        <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{l.number}</td>
                        <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{l.callerAssigned}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${tone.bg} ${tone.text} ${tone.border}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic py-4 text-center flex items-center justify-center gap-2">
              <PhoneCall size={14} /> No leads created yet.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
