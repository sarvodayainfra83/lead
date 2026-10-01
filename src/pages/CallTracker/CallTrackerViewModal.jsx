import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  X, Phone, Calendar, Clock, Mail, MapPin, Briefcase,
  FileText, IndianRupee, MessageSquare, UserCheck, Shield, ShieldCheck, Pencil, Thermometer, Share2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildShareClient } from '../../utils/productShare';
import { NEXT_DATE_CLASS } from '../../utils/leadTypeColors';
import { callTrackerApi } from '../../api/callTrackerApi';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';
import { CUSTOMER_STATUS_STYLES, formatDateTime } from './callTrackerConstants';
import SiteVisitFollowUpReport from '../../components/SiteVisitFollowUpReport';

const STATUS_STYLES = {
  Interested: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Deal Closed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Under Review': 'bg-purple-50 text-purple-700 border-purple-200',
  Pending: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Unassigned: 'bg-gray-100 text-gray-600 border-gray-200'
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
 * CallTrackerViewModal Component
 * Pure compact, fully responsive popup modal mounted via createPortal directly on document.body
 * with z-[100] to always sit cleanly above the sidebar, header, and all layouts.
 * Keeps customer information cards neatly on a single row in desktop mode.
 */
export default function CallTrackerViewModal({ isOpen, onClose, lead, onFollowup, onRemarkSaved }) {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);
  const navigate = useNavigate();

  // Admin remark editing: id -> draft text (row in edit mode), and id -> saved {adminRemark, updatedAt}
  const [remarkDrafts, setRemarkDrafts] = useState({});
  const [savedRemarks, setSavedRemarks] = useState({});
  const [savingRemarkId, setSavingRemarkId] = useState(null);

  useEffect(() => {
    setRemarkDrafts({});
    setSavedRemarks({});
  }, [lead?.id]);

  if (!isOpen || !lead) return null;

  // Apply remarks saved in this popup on top of the (snapshot) tracker rows
  const trackers = (lead.trackers || []).map(t => (savedRemarks[t.id] ? { ...t, ...savedRemarks[t.id] } : t));
  const latestCustomerStatus = [...trackers].reverse().find(t => t.customerStatus)?.customerStatus || '';

  const handleSaveRemark = async (trackerId) => {
    setSavingRemarkId(trackerId);
    try {
      const updated = await callTrackerApi.updateAdminRemark(trackerId, remarkDrafts[trackerId]);
      setSavedRemarks(prev => ({ ...prev, [trackerId]: { adminRemark: updated.adminRemark, updatedAt: updated.updatedAt } }));
      setRemarkDrafts(prev => {
        const next = { ...prev };
        delete next[trackerId];
        return next;
      });
      toast.success('Admin remark saved');
      onRemarkSaved?.();
    } catch (err) {
      console.error('Failed to save admin remark:', err);
      toast.error('Failed to save admin remark');
    } finally {
      setSavingRemarkId(null);
    }
  };

  // Helper to extract non-empty fields
  const isValid = (val) => {
    if (val === null || val === undefined) return false;
    const s = String(val).trim();
    return s !== '' && s !== '-' && s !== 'null' && s !== 'undefined';
  };

  const fields = [];

  if (isValid(lead.number || lead.customerNumber)) {
    fields.push({
      label: 'Phone Number',
      value: lead.number || lead.customerNumber,
      icon: Phone,
      isPhone: true
    });
  }

  if (isValid(lead.email || lead.customerEmail)) {
    fields.push({
      label: 'Email',
      value: lead.email || lead.customerEmail,
      icon: Mail,
      isEmail: true
    });
  }

  if (isValid(lead.dob) && formatDate(lead.dob) !== '-') {
    fields.push({
      label: 'DOB',
      value: formatDate(lead.dob),
      icon: Calendar
    });
  }

  if (isValid(lead.occupation)) {
    fields.push({
      label: 'Occupation',
      value: lead.occupation,
      icon: Briefcase
    });
  }

  if (isValid(lead.insuranceType || lead.productType)) {
    fields.push({
      label: 'Product Type',
      value: lead.insuranceType || lead.productType,
      icon: Shield
    });
  }

  if (isValid(lead.insuranceSubType)) {
    fields.push({
      label: 'Sub Product Type',
      value: lead.insuranceSubType,
      icon: ShieldCheck
    });
  }

  if (isValid(lead.anyDesease)) {
    fields.push({
      label: 'Medical Condition',
      value: lead.anyDesease,
      icon: FileText
    });
  }

  if (isValid(lead.requirement)) {
    fields.push({
      label: 'Requirement',
      value: lead.requirement,
      icon: FileText
    });
  }

  if (isValid(lead.investmentBudget)) {
    fields.push({
      label: 'Investment Budget',
      value: lead.investmentBudget,
      icon: IndianRupee
    });
  }

  if (isValid(lead.location || lead.customerAddress)) {
    fields.push({
      label: 'Customer Address',
      value: lead.location || lead.customerAddress,
      icon: MapPin,
      isLong: true
    });
  }

  if (isValid(lead.whenToBuyPlan)) {
    fields.push({
      label: 'When to Buy Plan',
      value: lead.whenToBuyPlan,
      icon: Clock
    });
  }

  if (isValid(lead.remarks)) {
    fields.push({
      label: 'Remarks',
      value: lead.remarks,
      icon: MessageSquare,
      isLong: true
    });
  }

  const lastDateOfCall = lead.dateOfCall || (lead.latestTracker?.timestamp ? formatDate(lead.latestTracker.timestamp) : null);
  const nextDateOfCall = lead.nextCallDate ? formatDate(lead.nextCallDate) : (lead.latestTracker?.nextDate ? formatDate(lead.latestTracker.nextDate) : null);

  // Desktop grid columns: keeps cards on a single row when count is <= 6
  const desktopGridClass = (() => {
    if (fields.length === 1) return 'md:grid-cols-1';
    if (fields.length === 2) return 'md:grid-cols-2';
    if (fields.length === 3) return 'md:grid-cols-3';
    if (fields.length === 4) return 'md:grid-cols-4';
    if (fields.length === 5) return 'md:grid-cols-5';
    if (fields.length === 6) return 'md:grid-cols-6';
    return 'md:grid-cols-3 lg:grid-cols-4';
  })();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col border border-gray-200 overflow-hidden max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Modal Header */}
        <div className="px-3.5 py-2.5 border-b border-gray-200 bg-slate-50 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
              {lead.personName || lead.customerName || 'Customer Details'}
            </h2>
            {lead.leadNo && (
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 shrink-0">
                Lead #{lead.leadNo}
              </span>
            )}
            {lead.status && (
              <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${STATUS_STYLES[lead.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {lead.status}
              </span>
            )}
            {(lead.leadType || lead.category) && (
              <span className="text-[11px] text-gray-500 font-medium hidden sm:inline shrink-0">
                Category: <strong className="text-gray-700">{lead.leadType || lead.category}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Share Products — opens the Products page filtered to this client's lead type */}
            <button
              onClick={() => {
                const shareClient = buildShareClient(lead);
                onClose();
                navigate('/products', { state: { shareClient } });
              }}
              title={`Share ${lead.leadType || ''} products with ${lead.personName || 'this client'}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white rounded text-xs font-semibold shadow-xs transition active:scale-95"
            >
              <Share2 size={11} />
              <span className="hidden sm:inline">Share Products</span>
              <span className="sm:hidden">Share</span>
            </button>
            {onFollowup && (
              <button
                onClick={() => onFollowup(lead)}
                title={`Log follow-up for ${lead.personName || 'Customer'}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition active:scale-95"
              >
                <Phone size={11} />
                <span>Followup</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-200 transition"
              title="Close popup"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable Compact Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-white">
          {/* Top Quick Highlights (only show populated items) */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {lastDateOfCall && lastDateOfCall !== '-' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={11} className="text-gray-400 shrink-0" />
                  <span className="truncate">Last Call</span>
                </span>
                <p className="text-xs font-bold text-gray-800 mt-0.5 truncate">
                  {lastDateOfCall}
                </p>
              </div>
            )}

            {nextDateOfCall && nextDateOfCall !== '-' && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-2 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={11} className="text-amber-600 shrink-0" />
                  <span className="truncate">Next Call</span>
                </span>
                <p className={`text-xs font-bold mt-0.5 truncate ${NEXT_DATE_CLASS}`}>
                  {nextDateOfCall}
                </p>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Phone size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">Total Calls</span>
              </span>
              <p className="text-xs font-bold text-indigo-600 mt-0.5">
                {lead.followUpCount || trackers.length} {lead.followUpCount === 1 ? 'Call' : 'Calls'}
              </p>
            </div>

            {latestCustomerStatus && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Thermometer size={11} className="text-gray-400 shrink-0" />
                  <span className="truncate">Customer Status</span>
                </span>
                <span className={`self-start mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[latestCustomerStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {latestCustomerStatus}
                </span>
              </div>
            )}

            {lead.callerAssigned && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <UserCheck size={11} className="text-gray-400 shrink-0" />
                  <span className="truncate">Assigned To</span>
                </span>
                <p className="text-xs font-bold text-gray-800 mt-0.5 truncate" title={lead.callerAssigned}>
                  {lead.callerAssigned}
                </p>
              </div>
            )}
          </div>

          {/* Customer Details Grid (ONLY fields with values, single row on desktop) */}
          {fields.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Customer Information</span>
                <span className="text-gray-400 font-normal">({fields.length} fields)</span>
              </div>
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${desktopGridClass} gap-2`}>
                {fields.map((col, cIdx) => {
                  const Icon = col.icon;
                  return (
                    <div
                      key={cIdx}
                      className={`bg-white border border-gray-200 rounded p-2 shadow-2xs flex flex-col justify-between transition-colors hover:border-indigo-200 ${
                        col.isLong ? 'col-span-1 sm:col-span-2 md:col-span-1' : 'col-span-1'
                      }`}
                    >
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                        {Icon && <Icon size={11} className="text-gray-400 shrink-0" />}
                        <span className="truncate" title={col.label}>{col.label}</span>
                      </div>
                      <div className="text-xs font-medium text-gray-800 break-words leading-snug" title={typeof col.value === 'string' ? col.value : undefined}>
                        {col.isPhone ? (
                          <a href={`tel:${col.value}`} className="text-indigo-600 hover:underline font-semibold">
                            {col.value}
                          </a>
                        ) : col.isEmail ? (
                          <a href={`mailto:${col.value}`} className="text-indigo-600 hover:underline break-all">
                            {col.value}
                          </a>
                        ) : (
                          col.value
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Call Records / History Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1">
                <span>Call History & Records</span>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold border border-indigo-200">
                  {trackers.length}
                </span>
              </span>
            </div>

            {trackers.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500 italic bg-slate-50 rounded-lg border border-dashed border-gray-200">
                No call records logged yet for this lead.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-2xs bg-white">
                <table className="w-full text-left text-xs border-collapse min-w-[860px]">
                  <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-2.5 py-1.5 text-center w-16 whitespace-nowrap">Follow Up</th>
                      <th className="px-2.5 py-1.5 text-center w-24 whitespace-nowrap">Date of Call</th>
                      <th className="px-2.5 py-1.5 text-center w-28 whitespace-nowrap">Status</th>
                      <th className="px-2.5 py-1.5 text-center w-24 whitespace-nowrap">Customer Status</th>
                      <th className="px-2.5 py-1.5 min-w-[160px]">What did Customer Said</th>
                      <th className="px-2.5 py-1.5 text-center w-24 whitespace-nowrap">Next Call</th>
                      <th className="px-2.5 py-1.5 text-center w-28 whitespace-nowrap">Caller</th>
                      <th className="px-2.5 py-1.5 min-w-[200px]">Admin Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trackers.map((t, idx) => (
                      <tr key={t.id || idx} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="px-2.5 py-1.5 text-center font-bold text-indigo-600 whitespace-nowrap">
                          #{t.followUpNo || idx + 1}
                        </td>
                        <td className="px-2.5 py-1.5 text-center text-gray-700 font-medium whitespace-nowrap">
                          {formatDate(t.timestamp)}
                        </td>
                        <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
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
                          {formatDate(t.nextDate)}
                        </td>
                        <td className="px-2.5 py-1.5 text-center text-gray-600 whitespace-nowrap">
                          {t.callerAssigned || lead.callerAssigned || '-'}
                        </td>
                        <td className="px-2.5 py-1.5 align-top">
                          {remarkDrafts[t.id] !== undefined ? (
                            <div className="space-y-1">
                              <textarea
                                value={remarkDrafts[t.id]}
                                onChange={(e) => setRemarkDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                                rows={2}
                                autoFocus
                                placeholder="Write remark for the caller..."
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                              />
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleSaveRemark(t.id)}
                                  disabled={savingRemarkId === t.id}
                                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold disabled:opacity-50 transition"
                                >
                                  {savingRemarkId === t.id ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setRemarkDrafts(prev => {
                                    const next = { ...prev };
                                    delete next[t.id];
                                    return next;
                                  })}
                                  disabled={savingRemarkId === t.id}
                                  className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-semibold transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-1.5">
                              {t.adminRemark ? (
                                <div className="min-w-0">
                                  <p className="text-gray-800 leading-snug whitespace-pre-wrap break-words">{t.adminRemark}</p>
                                  {t.updatedAt && (
                                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                      <Clock size={9} /> {formatDateTime(t.updatedAt)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                              {isAdmin && t.id && (
                                <button
                                  onClick={() => setRemarkDrafts(prev => ({ ...prev, [t.id]: t.adminRemark || '' }))}
                                  title={t.adminRemark ? 'Edit admin remark' : 'Add admin remark'}
                                  className="shrink-0 p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition"
                                >
                                  <Pencil size={10} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Site Visit / Meeting Follow-Up Details (visitor_follow_ups linked by lead_id) */}
          <SiteVisitFollowUpReport
            leadId={lead.id || lead.leadId}
            leadNo={lead.leadNo}
            initialFollowUps={lead.visitorFollowUps}
          />
        </div>

        {/* Compact Footer */}
        <div className="px-3.5 py-2 border-t border-gray-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-gray-500 font-medium">
            Showing all records for {lead.personName || 'customer'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 transition active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
