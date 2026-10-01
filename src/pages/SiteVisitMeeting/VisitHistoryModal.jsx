import React from 'react';
import { createPortal } from 'react-dom';
import {
  X, Calendar, UserCheck, MessageSquare, Phone, MapPin,
  Clock, CheckCircle, AlertCircle, FileText, ArrowRight
} from 'lucide-react';
import { formatDisplayDate, STATUS_STYLES, CUSTOMER_STATUS_STYLES } from './siteVisitMeetingConstants';
import { getLeadTypeBadgeClass, NEXT_DATE_CLASS } from '../../utils/leadTypeColors';

export default function VisitHistoryModal({ isOpen, onClose, lead, onAssignVisitor, onLogFollowUp }) {
  if (!isOpen || !lead) return null;

  const followUps = lead.followUps || [];
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-sm sm:text-base font-bold tracking-tight text-white bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/20 font-mono">
              {lead.leadNo || 'Lead'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getLeadTypeBadgeClass(lead.leadType)}`}>
              {lead.leadType || 'Real Estate'}
            </span>
            <span className="hidden sm:inline-block text-xs text-gray-300 font-medium truncate max-w-[200px]">
              {lead.customerName || lead.personName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Client & Visit Overview Bar */}
        <div className="flex-shrink-0 p-4 bg-slate-50 border-b border-gray-200 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Customer</span>
              <span className="font-bold text-gray-900 truncate block text-sm">
                {lead.customerName || lead.personName || '-'}
              </span>
              {lead.customerNumber && (
                <div className="flex items-center gap-2 mt-1">
                  <a
                    href={`tel:${cleanPhone}`}
                    className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
                  >
                    <Phone size={10} /> {lead.customerNumber}
                  </a>
                  <button
                    onClick={handleWhatsApp}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold"
                    title="WhatsApp"
                  >
                    WA
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Current Status</span>
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLES[lead.status]?.badge || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[lead.status]?.dot || 'bg-gray-400'}`} />
                {lead.status}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Assigned Visitor</span>
              <span className="font-bold text-gray-800 mt-1 flex items-center gap-1">
                <UserCheck size={12} className="text-indigo-500 shrink-0" />
                <span className="truncate">{lead.assignedVisitor || <span className="text-amber-600 font-medium">Unassigned</span>}</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Visit Date</span>
              <span className="font-bold text-gray-800 mt-1 flex items-center gap-1 font-mono">
                <Calendar size={12} className="text-gray-400 shrink-0" />
                {formatDisplayDate(lead.visitDate)}
              </span>
            </div>
          </div>

          {(lead.location || lead.customerAddress) && (
            <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center gap-1 text-gray-600">
              <MapPin size={11} className="text-gray-400 shrink-0" />
              <span className="truncate">{lead.location || lead.customerAddress}</span>
            </div>
          )}
        </div>

        {/* Content Body: Timeline Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Section: Visit Follow-Ups */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-indigo-600" />
                Follow-Up History
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {followUps.length}
                </span>
              </h4>
              <button
                onClick={() => { onClose(); onLogFollowUp(lead); }}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                + Log Follow-Up
              </button>
            </div>

            {followUps.length === 0 ? (
              <div className="py-5 text-center text-xs text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No follow-ups recorded yet. Click "+ Log Follow-Up" to record what happened during the visit.
              </div>
            ) : (
              <div className="space-y-2.5">
                {followUps.map((fu, idx) => {
                  const statusCfg = STATUS_STYLES[fu.status] || {
                    badge: 'bg-gray-100 text-gray-700 border-gray-200',
                    dot: 'bg-gray-400'
                  };

                  return (
                    <div
                      key={fu.id || idx}
                      className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-3.5 space-y-2 hover:border-gray-300 transition"
                    >
                      {/* Top Row: #, Status, Date */}
                      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-xs">
                            Follow-Up #{fu.followUpNo || idx + 1}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {fu.status}
                          </span>
                          {(fu.customerStatus || fu.customer_status || fu.interestLevel) && (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[fu.customerStatus || fu.customer_status || fu.interestLevel] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {fu.customerStatus || fu.customer_status || fu.interestLevel}
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
                          Next Scheduled Visit: {formatDisplayDate(fu.nextVisitDate)}
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

          {/* Section: Initial Request & Visitor Assignment */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Calendar size={13} className="text-indigo-600" />
              Visit Scheduling Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Call Followup Scheduling */}
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Followup
                  </span>
                  <button
                    onClick={() => { onClose(); onAssignVisitor(lead); }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {lead.assignedVisitor ? 'Reassign' : '+ Assign'}
                  </button>
                </div>
                <p className="text-gray-800 text-xs">
                  {lead.callTrackerRemarks ? `"${lead.callTrackerRemarks}"` : 'Site Visit / Meeting requested.'}
                </p>
                {lead.relationshipManager && (
                  <p className="text-[11px] text-gray-500 pt-0.5">
                    Visited By: <span className="font-semibold text-gray-700">{lead.relationshipManager}</span>
                  </p>
                )}
              </div>

              {/* Remark */}
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Remark
                </span>
                {lead.visitorRemarks || lead.remarks ? (
                  <p className="text-xs text-gray-800 italic leading-relaxed">
                    "{lead.visitorRemarks || lead.remarks}"
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No remarks provided.
                  </p>
                )}
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
              {lead.assignedVisitor ? 'Reassign Visitor' : 'Assign Visitor'}
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
