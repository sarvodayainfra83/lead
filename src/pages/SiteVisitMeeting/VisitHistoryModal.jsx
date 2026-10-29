import React from 'react';
import { createPortal } from 'react-dom';
import {
  X, Calendar, UserCheck, MessageSquare, Phone, MapPin,
  Clock, CheckCircle, AlertCircle, FileText, ArrowRight, User, Share2, Thermometer
} from 'lucide-react';
import { formatDisplayDate, STATUS_STYLES, CUSTOMER_STATUS_STYLES } from './siteVisitMeetingConstants';
import { getLeadTypeBadgeClass, NEXT_DATE_CLASS } from '../../utils/leadTypeColors';
import { getVisitMeetCounts } from './SiteVisitCategoryView';

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';

export default function VisitHistoryModal({ isOpen, onClose, lead, onAssignVisitor, onLogFollowUp }) {
  if (!isOpen || !lead) return null;

  const followUps = lead.followUps || [];
  const isRealEstateLead = !lead.leadType || lead.leadType.toLowerCase().includes('real') || String(lead.leadNo || '').toUpperCase().startsWith('LR');
  // Insurance / Mutual Fund have meetings (Online / Offline) and calls, no site visits — wording says Meeting
  // instead of Visit, and a Revisit reads 'Remeeting' (stored as 'Revisit')
  const isMeetingOnly = !isRealEstateLead;
  const statusText = (status) => (isMeetingOnly && status === 'Revisit' ? 'Remeeting' : status);
  const visitWord = isMeetingOnly ? 'Meeting' : 'Visit';
  const { visits: totalVisits, meetings: totalMeetings, calls: pageCalls } = getVisitMeetCounts(lead);
  // Lead & Followup calls (passed by the Non-interested page), shown alongside the visit follow-ups
  const callHistory = lead.callHistory || [];
  const totalCalls = pageCalls + callHistory.length;
  const entryTime = (e) => Number(e.timestampMs) || new Date(e.createdAt || 0).getTime() || 0;
  const historyEntries = callHistory.length > 0
    ? [...callHistory, ...followUps].sort((a, b) => entryTime(a) - entryTime(b))
    : followUps;
  // Latest Online / Offline meeting type (Insurance)
  const latestMeetingMode = [...followUps].reverse().find(f => f.visitMeet?.meetingMode)?.visitMeet?.meetingMode || '';
  const nextDate = lead.nextMeetingDate || lead.nextVisitDate || '';
  const refName = lead.referencerName || lead.referenceName || '';
  const cleanPhone = String(lead.customerNumber || lead.number || '').replace(/[^0-9+]/g, '');

  const handleWhatsApp = () => {
    if (!cleanPhone) return;
    const phoneWithCountry = cleanPhone.startsWith('91') || cleanPhone.startsWith('+')
      ? cleanPhone.replace('+', '')
      : `91${cleanPhone}`;
    const message = encodeURIComponent(
      `Hello ${lead.customerName || lead.personName || 'Customer'}, regarding your site visit / meeting inquiry with Sarvodaya Infracon.`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  // Schedule summary: who takes it, when, type and totals
  const scheduleCard = (
    <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
          {visitWord} Schedule
        </span>
        <button
          onClick={() => { onClose(); onAssignVisitor(lead); }}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
        >
          {lead.assignedVisitor ? 'Reassign' : '+ Assign'}
        </button>
      </div>
      <div className={`grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs ${isMeetingOnly ? 'sm:grid-cols-4' : ''}`}>
        <div>
          <span className="text-[10px] text-gray-400 block">Assigned To</span>
          <span className="font-semibold text-gray-800">{lead.assignedVisitor || <span className="text-amber-600 font-medium">Unassigned</span>}</span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">{visitWord} Date</span>
          <span className="font-semibold text-gray-800">{formatDisplayDate(lead.meetingDate || lead.visitDate)}</span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">Next {visitWord}</span>
          <span className={`font-semibold ${nextDate ? NEXT_DATE_CLASS : 'text-gray-400'}`}>{nextDate ? formatDisplayDate(nextDate) : '-'}</span>
        </div>
        {isMeetingOnly ? (
          <div>
            <span className="text-[10px] text-gray-400 block">Meeting Type</span>
            <span className="font-semibold text-gray-800">{latestMeetingMode ? `${latestMeetingMode} Meeting` : '-'}</span>
          </div>
        ) : <div />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {!isMeetingOnly && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {totalVisits} {totalVisits === 1 ? 'Visit' : 'Visits'}
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
          {totalMeetings} {totalMeetings === 1 ? 'Meeting' : 'Meetings'}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
          {totalCalls} {totalCalls === 1 ? 'Call' : 'Calls'}
        </span>
      </div>
    </div>
  );

  const remarkCard = (
    <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-1">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
        Remark
      </span>
      {lead.visitorRemarks || lead.remarks || lead.callTrackerRemarks ? (
        <p className="text-xs text-gray-800 italic leading-relaxed">
          "{lead.visitorRemarks || lead.remarks || lead.callTrackerRemarks}"
        </p>
      ) : (
        <p className="text-xs text-gray-400 italic">
          No remarks provided.
        </p>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-5 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100/80 ring-1 ring-black/5 w-full max-w-3xl lg:max-w-4xl max-h-[88dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header: Prominent customer name & details */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="w-8 h-8 rounded-full bg-white/20 text-white font-extrabold text-xs flex items-center justify-center shrink-0 border border-white/20">
              {initials(lead.customerName || lead.personName)}
            </span>
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                {lead.customerName || lead.personName || 'Customer Details'}
              </h2>
              <span className="text-xs font-bold tracking-tight text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/20 font-mono shrink-0">
                {lead.leadNo || 'Lead'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold shrink-0 ${getLeadTypeBadgeClass(lead.leadType)}`}>
                {lead.leadType || 'Real Estate'}
              </span>
              {lead.status && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border shrink-0 ${STATUS_STYLES[lead.status]?.badge || 'bg-white/20 text-white border-white/30'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[lead.status]?.dot || 'bg-white'}`} />
                  {statusText(lead.status)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Overview + history scroll together so the overview never squeezes the history on small screens */}
        <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Client & Visit Overview Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-gray-200 text-xs space-y-3">
          {/* Top Key Handling Highlight Cards: Caller, Team Member, Site Assigned, Lead Source, Ref */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {/* 1. Caller Assigned (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 border-2 border-amber-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={12} className="text-amber-600 shrink-0" />
                <span className="truncate">Caller Assigned</span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-amber-950 mt-1 truncate" title={lead.callerAssigned || lead.callerName || lead.caller || 'Unassigned'}>
                {lead.callerAssigned || lead.callerName || lead.caller || <span className="text-amber-600/70 font-normal italic">Unassigned</span>}
              </p>
            </div>

            {/* 2. Team Member (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-100/70 border-2 border-violet-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-violet-800 uppercase tracking-wider flex items-center gap-1">
                <User size={12} className="text-violet-600 shrink-0" />
                <span className="truncate">Team Member</span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-violet-950 mt-1 truncate" title={lead.leadReceiver || lead.relationshipManager || 'Unassigned'}>
                {lead.leadReceiver || lead.relationshipManager || <span className="text-violet-600/70 font-normal italic">Unassigned</span>}
              </p>
            </div>

            {/* 3. Site Visit / Meeting Assigned To (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-100/70 border-2 border-indigo-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} className="text-indigo-600 shrink-0" />
                <span className="truncate">{isMeetingOnly ? 'Meeting Executive' : 'Site Visit Executive'}</span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-indigo-950 mt-1 truncate" title={lead.assignedVisitor || 'Unassigned'}>
                {lead.assignedVisitor || <span className="text-indigo-600/70 font-normal italic">Unassigned</span>}
              </p>
            </div>

            {/* 4. Lead Source */}
            <div className="bg-gradient-to-br from-sky-50 to-slate-100 border border-sky-200 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold text-sky-800 uppercase tracking-wider flex items-center gap-1">
                <FileText size={12} className="text-sky-600 shrink-0" />
                <span className="truncate">Lead Source</span>
              </span>
              <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1 truncate" title={lead.leadSource || '-'}>
                {lead.leadSource || '-'}
              </p>
            </div>

            {/* 5. Reference Name (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-100/70 border-2 border-emerald-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <Share2 size={12} className="text-emerald-600 shrink-0" />
                <span className="truncate">Ref Name</span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-emerald-950 mt-1 truncate" title={refName || '-'}>
                {refName || <span className="text-gray-400 font-normal">-</span>}
              </p>
            </div>
          </div>

          {/* Customer Details Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-white rounded-lg p-2.5 border border-indigo-200 bg-indigo-50/40">
              <span className="text-[10px] text-indigo-700 uppercase tracking-wider font-extrabold block">Customer</span>
              <span className="font-extrabold text-gray-900 truncate block text-sm mt-0.5">
                {lead.customerName || lead.personName || '-'}
              </span>
              {(lead.customerNumber || cleanPhone) && (
                <div className="flex items-center gap-2 mt-1">
                  <a
                    href={`tel:${cleanPhone}`}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                  >
                    <Phone size={10} /> {lead.customerNumber || cleanPhone}
                  </a>
                  <button
                    onClick={handleWhatsApp}
                    className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 transition inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                    title="WhatsApp"
                  >
                    WA
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-2.5 border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Customer Status</span>
              {lead.customerStatus ? (
                <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[lead.customerStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  <Thermometer size={11} />
                  {lead.customerStatus}
                </span>
              ) : (
                <span className="font-bold text-gray-800 mt-1 block text-sm">-</span>
              )}
            </div>

            <div className="bg-white rounded-lg p-2.5 border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">{visitWord} Date</span>
              <span className="font-bold text-gray-800 mt-1 flex items-center gap-1 font-mono text-sm">
                <Calendar size={12} className="text-gray-400 shrink-0" />
                {formatDisplayDate(lead.meetingDate || lead.visitDate)}
              </span>
            </div>

            <div className="bg-white rounded-lg p-2.5 border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Next {visitWord}</span>
              <span className={`font-bold mt-1 flex items-center gap-1 font-mono text-sm ${nextDate ? NEXT_DATE_CLASS : 'text-gray-400'}`}>
                <Clock size={12} className="text-gray-400 shrink-0" />
                {nextDate ? formatDisplayDate(nextDate) : '-'}
              </span>
            </div>
          </div>

          {(lead.location || lead.customerAddress) && (
            <div className="pt-2 border-t border-gray-200 flex items-center gap-1 text-gray-600">
              <MapPin size={11} className="text-gray-400 shrink-0" />
              <span className="font-medium truncate">{lead.location || lead.customerAddress}</span>
            </div>
          )}
        </div>

        {/* Content Body: Timeline Cards */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Insurance / Mutual Fund: meeting schedule details first */}
          {isMeetingOnly && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-600" />
                {visitWord} Scheduling Details
              </h4>
              {scheduleCard}
            </div>
          )}

          {/* Section: Visit Follow-Ups */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-indigo-600" />
                Follow-Up History
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {historyEntries.length}
                </span>
              </h4>
              <button
                onClick={() => { onClose(); onLogFollowUp(lead); }}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                + Log Follow-Up
              </button>
            </div>

            {historyEntries.length === 0 ? (
              <div className="py-5 text-center text-xs text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No follow-ups recorded yet. Click "+ Log Follow-Up" to record what happened during the visit.
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyEntries.map((fu, idx) => {
                  const statusCfg = STATUS_STYLES[fu.status] || {
                    badge: 'bg-gray-100 text-gray-700 border-gray-200',
                    dot: 'bg-gray-400'
                  };

                  return (
                    <div
                      key={fu.id || idx}
                      className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-3.5 space-y-2 hover:border-gray-300 transition"
                    >
                      {/* Top Row: #, Status, Type Badges, Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-xs">
                            {fu.isCall ? `Call #${fu.followUpNo}` : `Follow-Up #${fu.followUpNo || idx + 1}`}
                          </span>
                          {fu.isCall && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              <Phone size={10} /> Lead &amp; Followup
                            </span>
                          )}
                          {(fu.parentId || fu.parent_id) && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200" title={`Parent Follow-up ID: ${fu.parentId || fu.parent_id}`}>
                              ↳ Followup Call
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusText(fu.status)}
                          </span>
                          {(fu.customerStatus || fu.customer_status || fu.interestLevel) && (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[fu.customerStatus || fu.customer_status || fu.interestLevel] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {fu.customerStatus || fu.customer_status || fu.interestLevel}
                            </span>
                          )}

                          {/* Site Visited & Meeting Checkbox Badges */}
                          {fu.visitMeet?.['site-visit'] && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <CheckCircle size={10} /> Site Visited
                            </span>
                          )}
                          {fu.visitMeet?.meeting && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                              <CheckCircle size={10} /> {fu.visitMeet?.meetingMode ? `${fu.visitMeet.meetingMode} Meeting` : 'Meeting'}
                            </span>
                          )}
                          {fu.visitMeet?.call && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              <Phone size={10} /> Call
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {formatDisplayDate(fu.visitDate || fu.createdAt)}
                        </span>
                      </div>

                      {/* Customer Feedback / Summary */}
                      {fu.whatHappened && (
                        <p className="text-gray-800 text-xs leading-relaxed">
                          {fu.whatHappened}
                        </p>
                      )}
                      {fu.isCall && fu.adminRemark && (
                        <p className="text-[11px] text-gray-600">
                          <span className="font-semibold text-gray-500">Admin Remark:</span> {fu.adminRemark}
                        </p>
                      )}

                      {/* Deal Details (if recorded) */}
                      {(fu.dealOutcome || fu.closingAmount || fu.salesExecutive || fu.referenceNo) && (
                        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 space-y-1.5">
                          <div className="font-bold text-emerald-900 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle size={13} className="text-emerald-600" />
                              Deal Details
                            </span>
                            {fu.dealOutcome && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {fu.dealOutcome}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-gray-700">
                            {fu.closingAmount && (
                              <div>
                                <span className="text-gray-400 block text-[10px]">Closing Amount / Range</span>
                                <span className="font-semibold text-emerald-900">{fu.closingAmount}</span>
                              </div>
                            )}
                            {fu.salesExecutive && (
                              <div>
                                <span className="text-gray-400 block text-[10px]">Sales Executive</span>
                                <span className="font-semibold text-gray-800">{fu.salesExecutive}</span>
                              </div>
                            )}
                            {fu.referenceNo && (
                              <div>
                                <span className="text-gray-400 block text-[10px]">Reference / Unit No</span>
                                <span className="font-mono font-semibold text-gray-800">{fu.referenceNo}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Next Scheduled Visit (if future plan) */}
                      {fu.nextVisitDate && (
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200 font-semibold">
                          <Clock size={12} />
                          Next Scheduled Visit: {formatDisplayDate(fu.nextVisitDate)}{(fu.nextVisitTime || fu.next_visit_time) ? ` at ${fu.nextVisitTime || fu.next_visit_time}` : ''}
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {fu.rejectionReason && (
                        <div className="flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 font-medium">
                          <AlertCircle size={12} />
                          Reason: {fu.rejectionReason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Scheduling Details & Remark. Insurance / Mutual Fund show the schedule at the top,
              so only the remark stays here, in the left column */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {!isMeetingOnly && (
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-600" />
                {visitWord} Scheduling Details
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {!isMeetingOnly && scheduleCard}
              {remarkCard}
            </div>
          </div>
        </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onClose(); onAssignVisitor(lead); }}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg shadow-2xs transition flex items-center gap-1"
            >
              <UserCheck size={13} className="text-indigo-600" />
              {isMeetingOnly
                ? (lead.assignedVisitor ? 'Reassign Meeting' : 'Assign Meeting')
                : (lead.assignedVisitor ? 'Reassign Site Visit Executive' : 'Assign Site Visit Executive')}
            </button>
            <button
              onClick={() => { onClose(); onLogFollowUp(lead); }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition flex items-center gap-1"
            >
              <MessageSquare size={13} />
              Log Follow-Up
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
