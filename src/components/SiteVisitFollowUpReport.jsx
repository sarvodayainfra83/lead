import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, AlertCircle, UserCheck,
  MapPin, MessageSquare, IndianRupee, Tag, Shield, Check
} from 'lucide-react';
import { siteVisitMeetingApi } from '../api/siteVisitMeetingApi';
import { CUSTOMER_STATUS_STYLES } from '../pages/CallTracker/callTrackerConstants';

const STATUS_STYLES = {
  Interested: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Interested'
  },
  'Future Plan': {
    badge: 'bg-purple-50 text-purple-700 border-purple-300',
    dot: 'bg-purple-500',
    label: 'Future Plan'
  },
  'Not Interested': {
    badge: 'bg-rose-50 text-rose-700 border-rose-300',
    dot: 'bg-rose-500',
    label: 'Not Interested'
  },
  'Did Not Show': {
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-500',
    label: 'Did Not Show'
  },
  Assigned: {
    badge: 'bg-sky-50 text-sky-700 border-sky-300',
    dot: 'bg-sky-500',
    label: 'Assigned'
  }
};

const formatDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim().split('T')[0].split(' ')[0];
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}`;
      } else {
        return `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
      }
    }
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const fullYear = y.length === 2 ? `20${y}` : y;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${fullYear}`;
    }
  }
  return str || '-';
};

/**
 * SiteVisitFollowUpReport
 * Reusable component to render all site visit / meeting follow-up records
 * fetched from the visitor_follow_ups table by lead_id (fk) or lead_no.
 */
export default function SiteVisitFollowUpReport({ leadId, leadNo, initialFollowUps = null, className = '' }) {
  const [followUps, setFollowUps] = useState(initialFollowUps || []);
  const [loading, setLoading] = useState(!initialFollowUps);

  useEffect(() => {
    let cancelled = false;
    if (leadId || leadNo) {
      setLoading(true);
      siteVisitMeetingApi.getVisitorFollowUpsByLeadId(leadId, leadNo)
        .then(records => {
          if (!cancelled) setFollowUps(records || []);
        })
        .catch(err => {
          console.error('Failed to load visitor follow ups:', err);
          if (!cancelled && !initialFollowUps) setFollowUps([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [leadId, leadNo]);

  // Synchronize when initialFollowUps updates
  useEffect(() => {
    if (initialFollowUps && initialFollowUps.length > 0) {
      setFollowUps(initialFollowUps);
    }
  }, [initialFollowUps]);

  const latestFollowUp = followUps[followUps.length - 1] || null;
  const dealFollowUp = [...followUps].reverse().find(f => f.dealOutcome || f.closingAmount || f.salesExecutive || f.referenceNo) || null;

  return (
    <div className={`border border-gray-100 rounded-xl p-4 bg-white shadow-xs space-y-3.5 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-700">
          <MapPin size={14} className="text-emerald-600" />
          Site Visit / Meeting Follow-Ups
          <span className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-emerald-200">
            {followUps.length}
          </span>
        </h4>
        {latestFollowUp && (
          <span className="text-[11px] text-gray-500 font-medium">
            Latest: <strong className="text-gray-800">{formatDate(latestFollowUp.visitDate || latestFollowUp.createdAt)}</strong>
          </span>
        )}
      </div>

      {loading && followUps.length === 0 ? (
        <div className="py-4 flex items-center justify-center gap-2 text-xs text-gray-500">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Loading site visit follow-ups...
        </div>
      ) : followUps.length === 0 ? (
        <div className="py-4 text-center text-xs text-gray-500 italic bg-slate-50 rounded-lg border border-dashed border-gray-200">
          No site visit follow-ups logged yet for this lead.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Follow-Ups</p>
              <p className="font-bold text-emerald-600 mt-0.5">{followUps.length}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Latest Status</p>
              <span className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_STYLES[latestFollowUp?.status]?.badge || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[latestFollowUp?.status]?.dot || 'bg-gray-400'}`} />
                {latestFollowUp?.status || '-'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customer Status</p>
              <div className="mt-0.5">
                {(latestFollowUp?.customerStatus || latestFollowUp?.customer_status || latestFollowUp?.interestLevel) ? (
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[latestFollowUp.customerStatus || latestFollowUp.customer_status || latestFollowUp.interestLevel] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {latestFollowUp.customerStatus || latestFollowUp.customer_status || latestFollowUp.interestLevel}
                  </span>
                ) : (
                  <span className="text-gray-400 italic text-xs">-</span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assigned Visitor</p>
              <p className="font-bold text-gray-800 mt-0.5 truncate flex items-center gap-1" title={latestFollowUp?.visitorName}>
                <UserCheck size={11} className="text-indigo-500 shrink-0" />
                <span className="truncate">{latestFollowUp?.visitorName || '-'}</span>
              </p>
            </div>
          </div>

          {/* Deal Details Highlight Card (if recorded) */}
          {dealFollowUp && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                  <CheckCircle size={14} className="text-emerald-600" />
                  Deal Details
                </span>
                {dealFollowUp.dealOutcome && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {dealFollowUp.dealOutcome}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-gray-700">
                {dealFollowUp.closingAmount && (
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">Closing Amount / Budget</span>
                    <span className="font-bold text-emerald-900 text-xs">{dealFollowUp.closingAmount}</span>
                  </div>
                )}
                {dealFollowUp.salesExecutive && (
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">Sales Executive</span>
                    <span className="font-semibold text-gray-800 text-xs">{dealFollowUp.salesExecutive}</span>
                  </div>
                )}
                {dealFollowUp.referenceNo && (
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">Reference / Unit No</span>
                    <span className="font-mono font-semibold text-gray-800 text-xs">{dealFollowUp.referenceNo}</span>
                  </div>
                )}
                {dealFollowUp.rejectionReason && (
                  <div>
                    <span className="text-rose-500 block text-[10px] uppercase font-semibold">Rejection Reason</span>
                    <span className="font-medium text-rose-700 text-xs">{dealFollowUp.rejectionReason}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Follow-Ups Table */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[780px]">
              <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Follow Up #</th>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Visit Date</th>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Visitor Name</th>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Visit Status</th>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Site Visited</th>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Meeting</th>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Customer Status</th>
                  <th className="px-2.5 py-1.5 min-w-[200px]">Customer Feedback / What Happened</th>
                  <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Next Scheduled Visit</th>
                  <th className="px-2.5 py-1.5 min-w-[160px]">Deal Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {followUps.map((fu, idx) => {
                  const statusCfg = STATUS_STYLES[fu.status] || {
                    badge: 'bg-gray-100 text-gray-700 border-gray-200',
                    dot: 'bg-gray-400'
                  };
                  const custStatus = fu.customerStatus || fu.customer_status || fu.interestLevel || '';
                  const hasSiteVisited = Boolean(fu.visitMeet?.['site-visit'] ?? fu.visitMeet?.siteVisit ?? fu.visitMeet?.site_visit);
                  const hasMeeting = Boolean(fu.visitMeet?.meeting);

                  return (
                    <tr key={fu.id || idx} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="px-2.5 py-1.5 text-center font-bold text-emerald-700 whitespace-nowrap">
                        <div>#{fu.followUpNo || idx + 1}</div>
                        {(fu.parentId || fu.parent_id) && (
                          <div className="text-[9px] font-normal text-slate-500">↳ Linked</div>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-center text-gray-700 font-medium whitespace-nowrap font-mono text-[11px]">
                        {formatDate(fu.visitDate || fu.createdAt)}
                      </td>
                      <td className="px-2.5 py-1.5 text-center text-gray-800 font-medium whitespace-nowrap">
                        {fu.visitorName || '-'}
                      </td>
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusCfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {fu.status || '-'}
                        </span>
                      </td>
                      {/* Site Visited */}
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                        {hasSiteVisited ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check size={10} className="stroke-[2.5]" /> Yes
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      {/* Meeting */}
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                        {hasMeeting ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                            <Check size={10} className="stroke-[2.5]" /> Yes
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                        {custStatus ? (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[custStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {custStatus}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-gray-800 leading-snug">
                        {fu.whatHappened || <span className="text-gray-300 italic">No feedback recorded</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                        {fu.nextVisitDate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-mono">
                            <Clock size={10} />
                            {formatDate(fu.nextVisitDate)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-gray-700 leading-tight">
                        {fu.dealOutcome || fu.closingAmount || fu.salesExecutive || fu.referenceNo ? (
                          <div className="space-y-0.5 text-[11px]">
                            {fu.dealOutcome && (
                              <span className="font-bold text-emerald-800 block">{fu.dealOutcome}</span>
                            )}
                            {fu.closingAmount && (
                              <span className="text-emerald-700 font-semibold block">₹ {fu.closingAmount}</span>
                            )}
                            {fu.salesExecutive && (
                              <span className="text-gray-500 block text-[10px]">Exec: {fu.salesExecutive}</span>
                            )}
                            {fu.referenceNo && (
                              <span className="font-mono text-gray-500 block text-[10px]">Ref: {fu.referenceNo}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
