import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, MessageSquare, Mail, MapPin, User, Calendar, Briefcase, Wallet, Shield, Home, TrendingUp, UserCheck, Clock, FileText, PhoneCall, Share2 } from 'lucide-react';
import { formatLeadDate } from './leadConstants';
import { getLeadTypeBadgeClass, NEXT_DATE_CLASS } from '../../utils/leadTypeColors';
import { callTrackerApi } from '../../api/callTrackerApi';
import { CUSTOMER_STATUS_STYLES, formatDateTime } from '../CallTracker/callTrackerConstants';
import SiteVisitFollowUpReport from '../../components/SiteVisitFollowUpReport';

const CALL_STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Under Review': 'bg-purple-50 text-purple-700 border-purple-200'
};

// Format YYYY-MM-DD / ISO / DD/MM/YYYY call tracker dates as DD/MM/YYYY
const formatCallDate = (val) => {
  if (!val) return '-';
  const str = String(val).trim().split('T')[0].split(' ')[0];
  const parts = str.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return str || '-';
};

export default function LeadDetailsModal({ isOpen, onClose, lead, onEdit, onShareProducts }) {
  // Call report: full call_trackers history for this lead (by lead_id)
  const [callRecords, setCallRecords] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !lead?.id) return;
    let cancelled = false;
    setCallsLoading(true);
    callTrackerApi.getCallTrackersByLeadId(lead.id)
      .then(records => { if (!cancelled) setCallRecords(records || []); })
      .catch(err => {
        console.error('Failed to load call report for lead:', err);
        if (!cancelled) setCallRecords([]);
      })
      .finally(() => { if (!cancelled) setCallsLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, lead?.id]);

  if (!isOpen || !lead) return null;

  const latestCall = callRecords[callRecords.length - 1] || null;

  const formatDate = (val) => {
    if (!val) return '-';
    const parts = String(val).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return val;
  };

  const getCleanPhone = (num) => String(num || '').replace(/[^0-9+]/g, '');

  const handleWhatsApp = () => {
    const cleanPhone = getCleanPhone(lead.number || lead.customerNumber);
    if (!cleanPhone) return;
    const phoneWithCountry = cleanPhone.startsWith('91') || cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `91${cleanPhone}`;
    const message = encodeURIComponent(`Hello ${lead.personName || lead.customerName || 'Customer'}, greeting from Sarvodaya Infracon regarding your inquiry for ${lead.leadType || 'our services'}.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  // Mounted on document.body so the page layout / app header can't clip or overlap it
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base sm:text-lg font-bold tracking-tight text-white bg-white/10 px-3 py-1 rounded-lg border border-white/20">
              {lead.leadNo}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getLeadTypeBadgeClass(lead.leadType)}`}>
              {lead.leadType}
            </span>
            {lead.processType && (
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
                {lead.processType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onShareProducts && (
              <button
                onClick={() => onShareProducts(lead)}
                title={`Share ${lead.leadType || ''} products with ${lead.personName || lead.customerName || 'this client'}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 shadow-xs transition active:scale-95"
              >
                <Share2 size={13} />
                <span>Share Products</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Quick Info Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wider font-medium">Lead Date</p>
              <p className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5">
                <Calendar size={12} className="text-indigo-500" />
                {formatLeadDate(lead.timestamp || lead.created_at || lead.date)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wider font-medium">Caller Assigned</p>
              <p className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5 truncate">
                <UserCheck size={12} className="text-emerald-500 flex-shrink-0" />
                <span className={lead.callerAssigned ? 'text-emerald-700' : 'text-amber-600 italic'}>
                  {lead.callerAssigned || 'Unassigned'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wider font-medium">Team Member</p>
              <p className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5 truncate">
                <User size={12} className="text-blue-500 flex-shrink-0" />
                {lead.leadReceiver || '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wider font-medium">Lead Source</p>
              <p className="font-semibold text-gray-800 mt-0.5 truncate">
                {lead.leadSource || '-'}
              </p>
            </div>
          </div>

          {/* Customer Details */}
          <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-xs">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-indigo-600">
              <User size={14} /> Customer Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500 text-[11px]">Full Name</p>
                <p className="text-gray-900 font-semibold text-sm">{lead.personName || lead.customerName || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Phone Number</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={`tel:${getCleanPhone(lead.number || lead.customerNumber)}`}
                    className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Phone size={12} /> {lead.number || lead.customerNumber || '-'}
                  </a>
                  {lead.number && (
                    <button
                      onClick={handleWhatsApp}
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[10px] font-semibold hover:bg-emerald-100 transition flex items-center gap-1"
                    >
                      <MessageSquare size={10} /> WhatsApp
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Email</p>
                <p className="text-gray-900 font-medium">
                  {lead.email || lead.customerEmail ? (
                    <a href={`mailto:${lead.email || lead.customerEmail}`} className="text-indigo-600 hover:underline flex items-center gap-1">
                      <Mail size={12} /> {lead.email || lead.customerEmail}
                    </a>
                  ) : '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Date of Birth</p>
                <p className="text-gray-800 font-medium">{formatDate(lead.dob)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Occupation</p>
                <p className="text-gray-800 font-medium">{lead.occupation || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Address / Location</p>
                <p className="text-gray-800 font-medium flex items-center gap-1">
                  <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                  {lead.location || lead.customerAddress || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Lead Specific Requirement Details */}
          <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-xs">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-indigo-600">
              <Briefcase size={14} /> Requirement & Product Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500 text-[11px]">Product Type</p>
                <p className="text-gray-900 font-semibold">{lead.productType || lead.insuranceType || '-'}</p>
              </div>
              {lead.leadType === 'Real Estate' && (
                <>
                  <div>
                    <p className="text-gray-500 text-[11px]">Requirement (Configuration)</p>
                    <p className="text-gray-900 font-semibold">{lead.requirement || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[11px]">Site Location Preference</p>
                    <p className="text-gray-800 font-medium">{lead.siteLocation || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[11px]">When to Buy Plan</p>
                    <p className="text-gray-800 font-medium">{lead.whenToBuyPlan || '-'}</p>
                  </div>
                </>
              )}
              {lead.leadType === 'Insurance' && (
                <>
                  <div>
                    <p className="text-gray-500 text-[11px]">Insurance Sub-Type</p>
                    <p className="text-gray-900 font-semibold">{lead.insuranceSubType || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[11px]">Medical Condition / Pre-existing Disease</p>
                    <p className="text-gray-800 font-medium">{lead.anyDesease || 'None'}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-gray-500 text-[11px]">Investment Budget</p>
                <p className="text-emerald-700 font-bold">{lead.investmentBudget || '-'}</p>
              </div>
              {lead.referencerName && (
                <div>
                  <p className="text-gray-500 text-[11px]">Referencer Name</p>
                  <p className="text-gray-800 font-medium">{lead.referencerName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          {lead.remarks && (
            <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-xs">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-gray-700">
                <FileText size={14} /> Remarks & Notes
              </h4>
              <p className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                {lead.remarks}
              </p>
            </div>
          )}

          {/* Call Report (call_trackers linked by lead_id) */}
          <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 text-indigo-600">
              <PhoneCall size={14} /> Call Report
              <span className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-indigo-200">
                {callRecords.length}
              </span>
            </h4>

            {callsLoading ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading call records...
              </div>
            ) : callRecords.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500 italic bg-slate-50 rounded-lg border border-dashed border-gray-200">
                No call records logged yet for this lead.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Calls</p>
                    <p className="font-bold text-indigo-600 mt-0.5">{callRecords.length}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Latest Status</p>
                    <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CALL_STATUS_STYLES[latestCall?.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {latestCall?.status || '-'}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Call</p>
                    <p className="font-bold text-gray-800 mt-0.5">{formatCallDate(latestCall?.timestamp)}</p>
                  </div>
                  <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-2">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Next Call</p>
                    <p className={`font-bold mt-0.5 ${latestCall?.nextDate ? NEXT_DATE_CLASS : 'text-gray-400'}`}>
                      {formatCallDate(latestCall?.nextDate)}
                    </p>
                  </div>
                </div>

                {/* All call records */}
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                    <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Follow Up</th>
                        <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Date of Call</th>
                        <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Status</th>
                        <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Customer Status</th>
                        <th className="px-2.5 py-1.5 min-w-[160px]">What did Customer Said</th>
                        <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Next Call</th>
                        <th className="px-2.5 py-1.5 text-center whitespace-nowrap">Caller</th>
                        <th className="px-2.5 py-1.5 min-w-[160px]">Admin Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {callRecords.map((t, idx) => (
                        <tr key={t.id || idx} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-2.5 py-1.5 text-center font-bold text-indigo-600 whitespace-nowrap">#{idx + 1}</td>
                          <td className="px-2.5 py-1.5 text-center text-gray-700 font-medium whitespace-nowrap">{formatCallDate(t.timestamp)}</td>
                          <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CALL_STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {t.status || '-'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                            {t.customerStatus ? (
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[t.customerStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {t.customerStatus}
                              </span>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-2.5 py-1.5 text-gray-800 leading-snug">
                            {t.customerSaid || <span className="text-gray-300">-</span>}
                          </td>
                          <td className={`px-2.5 py-1.5 text-center font-semibold whitespace-nowrap ${t.nextDate ? NEXT_DATE_CLASS : 'text-gray-400'}`}>
                            {formatCallDate(t.nextDate)}
                          </td>
                          <td className="px-2.5 py-1.5 text-center text-gray-600 whitespace-nowrap">
                            {t.callerAssigned || lead.callerAssigned || '-'}
                          </td>
                          <td className="px-2.5 py-1.5 text-gray-800 leading-snug">
                            {t.adminRemark ? (
                              <>
                                <p className="whitespace-pre-wrap break-words">{t.adminRemark}</p>
                                {t.updatedAt && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(t.updatedAt)}</p>
                                )}
                              </>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Site Visit / Meeting Follow-Up Details (visitor_follow_ups linked by lead_id) */}
          <SiteVisitFollowUpReport
            leadId={lead.id}
            leadNo={lead.leadNo}
            initialFollowUps={lead.visitorFollowUps}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${getCleanPhone(lead.number || lead.customerNumber)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition"
            >
              <Phone size={13} /> Call
            </a>
            <button
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 shadow-xs transition"
            >
              <MessageSquare size={13} /> WhatsApp
            </button>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => { onClose(); onEdit(lead); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition"
              >
                Edit Lead
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
