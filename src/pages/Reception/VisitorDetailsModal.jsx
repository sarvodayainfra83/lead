import React from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Phone, Building2, Briefcase, MapPin, Calendar, Clock,
  ShieldCheck, LogOut, MessageSquare, CheckCircle, AlertCircle
} from 'lucide-react';
import {
  VISITOR_STATUS_MAP,
  PURPOSE_STYLES,
  formatVisitorDate,
  formatVisitorTime,
  getVisitDuration
} from './receptionConstants';

export default function VisitorDetailsModal({ isOpen, onClose, visitor, onCheckOutClick }) {
  if (!isOpen || !visitor) return null;

  const statusConfig = VISITOR_STATUS_MAP[visitor.status] || {
    label: visitor.status || 'Unknown',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    dotColor: 'bg-gray-400'
  };

  const cleanPhone = String(visitor.mobileNumber || '').replace(/[^0-9]/g, '');
  const duration = getVisitDuration(visitor.checkInAt, visitor.checkOutAt);

  const handleWhatsApp = () => {
    if (!cleanPhone) return;
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const msg = encodeURIComponent(`Hello ${visitor.visitorName}, thank you for visiting Sarvodaya Infracon.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 ring-1 ring-black/5 w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <User size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {visitor.visitorName}
              </h3>
              <p className="text-[11px] text-gray-300 truncate">
                {visitor.companyName ? `${visitor.companyName} • ` : ''}Visitor Details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
              {statusConfig.label}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Quick Contact & Action Strip */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-gray-400" />
              <span className="font-bold text-sm text-gray-900 tracking-wide">{visitor.mobileNumber}</span>
              {visitor.visitorType && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700">
                  {visitor.visitorType}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href={`tel:${cleanPhone}`}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition"
              >
                Call
              </a>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition"
              >
                WhatsApp
              </button>
            </div>
          </div>

          {/* Visit Information Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Visit Purpose</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-semibold border ${PURPOSE_STYLES[visitor.visitPurpose] || PURPOSE_STYLES.Other}`}>
                {visitor.visitPurpose}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Visit Location</span>
              <span className="font-semibold text-gray-800 mt-1 inline-flex items-center gap-1">
                <MapPin size={12} className="text-gray-500" />
                {visitor.visitLocation}
              </span>
            </div>

            {visitor.projectName && (
              <div className="col-span-2 pt-1 border-t border-gray-200/80">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Project / Site Name</span>
                <span className="font-bold text-amber-800 mt-0.5 block">{visitor.projectName}</span>
              </div>
            )}
          </div>

          {/* Host & Meeting Staff Details */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
            <h4 className="text-[11px] uppercase font-bold text-indigo-900 tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-indigo-600" />
              <span>Host / Employee Meeting</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 text-[11px] block">Person Intended to Meet:</span>
                <span className="font-bold text-gray-900 mt-0.5 block">{visitor.personToMeetName || '-'}</span>
                {visitor.department && (
                  <span className="text-[10px] text-gray-500 block">Dept: {visitor.department}</span>
                )}
              </div>

              <div>
                <span className="text-gray-500 text-[11px] block">Person Actually Met:</span>
                <span className={`font-bold mt-0.5 block ${visitor.personActuallyMetName && visitor.personActuallyMetName !== visitor.personToMeetName ? 'text-purple-700' : 'text-gray-900'}`}>
                  {visitor.personActuallyMetName || visitor.personToMeetName || '-'}
                </span>
                {visitor.personActuallyMetName && visitor.personActuallyMetName !== visitor.personToMeetName && (
                  <span className="text-[10px] font-semibold text-purple-600 block">(Alternate Host)</span>
                )}
              </div>
            </div>
          </div>

          {/* Timeline & Durations */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <h4 className="text-[11px] uppercase font-bold text-slate-700 tracking-wider flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500" />
              <span>Visit Timeline</span>
            </h4>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Check-In</span>
                <span className="font-bold text-gray-800 mt-0.5 block">{formatVisitorTime(visitor.checkInAt)}</span>
                <span className="text-[9.5px] text-gray-500 block">{formatVisitorDate(visitor.checkInAt)}</span>
                {visitor.checkedInBy && (
                  <span className="text-[9px] text-indigo-600 block truncate" title={`By ${visitor.checkedInBy}`}>by {visitor.checkedInBy}</span>
                )}
              </div>

              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Check-Out</span>
                <span className="font-bold text-gray-800 mt-0.5 block">
                  {visitor.checkOutAt ? formatVisitorTime(visitor.checkOutAt) : 'Still Inside'}
                </span>
                <span className="text-[9.5px] text-gray-500 block">
                  {visitor.checkOutAt ? formatVisitorDate(visitor.checkOutAt) : '-'}
                </span>
                {visitor.checkedOutBy && (
                  <span className="text-[9px] text-emerald-600 block truncate" title={`By ${visitor.checkedOutBy}`}>by {visitor.checkedOutBy}</span>
                )}
              </div>

              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Total Duration</span>
                <span className="font-extrabold text-indigo-700 mt-1 text-sm block">{duration}</span>
                <span className="text-[9.5px] text-gray-400 block">{visitor.status === 'CHECKED_IN' ? 'In progress' : 'Completed'}</span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {visitor.remarks && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Remarks & Notes</span>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{visitor.remarks}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition"
          >
            Close
          </button>

          {visitor.status === 'CHECKED_IN' && onCheckOutClick && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCheckOutClick(visitor);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition active:scale-95"
            >
              <LogOut size={13} />
              <span>Check Out Visitor</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
