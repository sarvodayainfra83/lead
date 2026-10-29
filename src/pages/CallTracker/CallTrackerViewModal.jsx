import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  X, Phone, Calendar, Clock, Mail, MapPin, Briefcase,
  FileText, IndianRupee, MessageSquare, UserCheck, Shield, ShieldCheck, Pencil, Thermometer, Share2, User
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
  'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200',
  'Future Plan Date': 'bg-amber-50 text-amber-700 border-amber-200',
  'Call Not Received': 'bg-orange-50 text-orange-700 border-orange-200',
  'No WhatsApp Reply': 'bg-slate-100 text-slate-700 border-slate-300',
  'Site Visit/Meeting': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Meeting: 'bg-cyan-50 text-cyan-700 border-cyan-200',
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
 * Shows all lead and customer columns corresponding to the front table.
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

  const formatVal = (val) => {
    if (!isValid(val)) return '-';
    return String(val).trim();
  };

  const isInsurance = (lead.leadType || lead.category || '').toLowerCase().includes('insurance');
  const isRealEstate = (lead.leadType || lead.category || '').toLowerCase().includes('real') ||
    (lead.leadType || lead.category || '').toLowerCase().includes('estate') ||
    (lead.leadNo && String(lead.leadNo).startsWith('LR'));

  const refName = lead.referencerName || lead.referenceName;

  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';

  // Customer information split by relevance: what the caller needs while working the lead sits above the
  // call history; profile details (address, DOB, email...) sit at the bottom. Caller / Team Member / Site Assigned /
  // Lead Source / Ref Name are shown in the highlighted cards at the very top, so they are not repeated here.
  const primaryFields = [
    {
      label: 'Customer Name',
      value: formatVal(lead.personName || lead.customerName),
      icon: User,
      isCustomerName: true
    },
    {
      label: 'Phone Number',
      value: formatVal(lead.number || lead.customerNumber),
      icon: Phone,
      isPhone: true
    },
    {
      label: 'Requirement',
      value: formatVal(lead.requirement),
      icon: FileText
    },
    {
      label: 'Product Type',
      value: formatVal(lead.insuranceType || lead.productType),
      icon: Shield
    },
    ...(isInsurance || isValid(lead.insuranceSubType) ? [{
      label: 'Sub Product Type',
      value: formatVal(lead.insuranceSubType),
      icon: ShieldCheck
    }] : []),
    {
      label: 'Investment Budget',
      value: formatVal(lead.investmentBudget),
      icon: IndianRupee
    },
    {
      label: 'When to Buy Plan',
      value: formatVal(lead.whenToBuyPlan),
      icon: Clock
    },
    ...(isRealEstate || isValid(lead.siteLocation) ? [{
      label: 'Site Location',
      value: formatVal(lead.siteLocation),
      icon: MapPin
    }] : [])
  ];

  const secondaryFields = [
    {
      label: 'Customer Address',
      value: formatVal(lead.location || lead.customerAddress),
      icon: MapPin,
      isLong: true
    },
    ...(isInsurance || isValid(lead.anyDesease) ? [{
      label: 'Medical Condition',
      value: formatVal(lead.anyDesease),
      icon: FileText
    }] : []),
    {
      label: 'Occupation',
      value: formatVal(lead.occupation),
      icon: Briefcase
    },
    {
      label: 'DOB',
      value: isValid(lead.dob) ? formatDate(lead.dob) : '-',
      icon: Calendar
    },
    {
      label: 'Email',
      value: formatVal(lead.email || lead.customerEmail),
      icon: Mail,
      isEmail: true
    },
    {
      label: 'Remarks',
      value: formatVal(lead.remarks),
      icon: MessageSquare,
      isLong: true
    }
  ];

  // Renders one "Customer Information" style block of label/value cards
  const renderFieldSection = (title, list) => (
    <div className="border border-gray-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-gray-400 font-normal">({list.length} fields)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {list.map((col, cIdx) => {
          const Icon = col.icon;
          const isPlaceholder = !col.value || col.value === '-' || col.value === 'null';
          return (
            <div
              key={cIdx}
              className={`rounded-lg p-2.5 shadow-2xs flex flex-col justify-between transition-colors ${
                col.isCustomerName
                  ? 'bg-indigo-50/80 border-2 border-indigo-300 ring-1 ring-indigo-200'
                  : 'bg-white border border-gray-200 hover:border-indigo-200'
              } ${col.isLong ? 'col-span-1 sm:col-span-2 md:col-span-2' : 'col-span-1'}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 text-gray-500">
                {Icon && <Icon size={12} className={col.isCustomerName ? 'text-indigo-600 shrink-0' : 'text-gray-400 shrink-0'} />}
                <span className="truncate" title={col.label}>{col.label}</span>
              </div>
              <div className="text-xs font-medium text-gray-800 break-words leading-snug" title={typeof col.value === 'string' ? col.value : undefined}>
                {col.isCustomerName ? (
                  <span className="text-[13px] font-extrabold text-indigo-950 flex items-center gap-1">
                    {col.value}
                  </span>
                ) : col.isPhone && !isPlaceholder ? (
                  <div className="flex items-center justify-between gap-1">
                    <a href={`tel:${col.value}`} className="text-indigo-600 hover:underline font-bold truncate">
                      {col.value}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const cleanPhone = String(col.value).replace(/[^0-9+]/g, '');
                        const phoneWithCountry = cleanPhone.startsWith('91') || cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : `91${cleanPhone}`;
                        const message = encodeURIComponent(`Hello ${lead.personName || lead.customerName || 'Customer'}, greeting from Sarvodaya Infracon regarding your inquiry for ${lead.leadType || 'our services'}.`);
                        window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
                      }}
                      className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 transition inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
                      title="Chat on WhatsApp"
                    >
                      <MessageSquare size={10} />
                      <span>WA</span>
                    </button>
                  </div>
                ) : col.isEmail && !isPlaceholder ? (
                  <a href={`mailto:${col.value}`} className="text-indigo-600 hover:underline break-all">
                    {col.value}
                  </a>
                ) : isPlaceholder ? (
                  <span className="text-gray-400 font-normal italic">-</span>
                ) : (
                  col.value
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const lastDateOfCall = lead.dateOfCall || (lead.latestTracker?.timestamp ? formatDate(lead.latestTracker.timestamp) : null);
  const nextDateOfCall = lead.nextCallDate ? formatDate(lead.nextCallDate) : (lead.latestTracker?.nextDate ? formatDate(lead.latestTracker.nextDate) : null);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 md:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col border border-gray-100/80 ring-1 ring-black/5 overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header: Clear, prominent customer identity with avatar */}
        <div className="px-3.5 sm:px-5 py-3 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 flex-shrink-0">
          {/* Top row on mobile / Left group on desktop */}
          <div className="flex items-start sm:items-center justify-between sm:justify-start gap-2.5 min-w-0 flex-1">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
              <span className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                {initials(lead.personName || lead.customerName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-sm sm:text-base font-extrabold text-gray-900 truncate max-w-[200px] sm:max-w-none">
                    {lead.personName || lead.customerName || 'Customer Details'}
                  </h2>
                  {lead.leadNo && (
                    <span className="text-[10px] sm:text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 shrink-0">
                      Lead #{lead.leadNo}
                    </span>
                  )}
                </div>
                {/* Status Badges */}
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {lead.status && (
                    <span className={`text-[9.5px] sm:text-[10.5px] font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${STATUS_STYLES[lead.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {lead.status}
                    </span>
                  )}
                  {latestCustomerStatus && (
                    <span className={`text-[9.5px] sm:text-[10.5px] font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${CUSTOMER_STATUS_STYLES[latestCustomerStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {latestCustomerStatus}
                    </span>
                  )}
                  {(lead.leadType || lead.category) && (
                    <span className="text-[9.5px] sm:text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      {lead.leadType || lead.category}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile close button (top right) */}
            <button
              onClick={onClose}
              className="sm:hidden text-gray-400 hover:text-gray-700 p-1.5 -mr-1 -mt-1 rounded-lg hover:bg-gray-200 transition shrink-0 cursor-pointer"
              title="Close popup"
            >
              <X size={19} />
            </button>
          </div>

          {/* Action buttons (Share & Followup) + Desktop Close */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-gray-200/70 sm:border-t-0">
            {/* Share Products — opens the Products page filtered to this client's lead type */}
            <button
              onClick={() => {
                const shareClient = buildShareClient(lead);
                onClose();
                navigate('/products', { state: { shareClient } });
              }}
              title={`Share ${lead.leadType || ''} products with ${lead.personName || 'this client'}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <Share2 size={13} />
              <span>Share Products</span>
            </button>
            {onFollowup && (
              <button
                onClick={() => onFollowup(lead)}
                title={`Log follow-up for ${lead.personName || 'Customer'}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
              >
                <Phone size={13} />
                <span>Followup</span>
              </button>
            )}
            {/* Desktop close button */}
            <button
              onClick={onClose}
              className="hidden sm:inline-flex text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition cursor-pointer"
              title="Close popup"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Compact Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 bg-white">
          {/* Key Handling & Lead Source Highlighted Cards (Caller, Team Member, Site Assigned, Source, Ref) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {/* 1. Caller Assigned (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 border-2 border-amber-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[9.5px] font-extrabold text-amber-800 uppercase tracking-tight flex items-center gap-1">
                <UserCheck size={11} className="text-amber-600 shrink-0" />
                <span className="truncate">Caller Assigned</span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-amber-950 mt-1 truncate" title={lead.callerAssigned || 'Unassigned'}>
                {lead.callerAssigned || <span className="text-amber-600/70 font-normal italic">Unassigned</span>}
              </p>
            </div>

            {/* 2. Team Member (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-100/70 border-2 border-violet-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[9.5px] font-extrabold text-violet-800 uppercase tracking-tight flex items-center gap-1">
                <User size={11} className="text-violet-600 shrink-0" />
                <span className="truncate">Team Member</span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-violet-950 mt-1 truncate" title={lead.leadReceiver || lead.relationshipManager || 'Unassigned'}>
                {lead.leadReceiver || lead.relationshipManager || <span className="text-violet-600/70 font-normal italic">Unassigned</span>}
              </p>
            </div>

            {/* 3. Site Visit / Meeting Assigned To (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-100/70 border-2 border-indigo-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[9.5px] font-extrabold text-indigo-800 uppercase tracking-tight flex items-center gap-1">
                <MapPin size={11} className="text-indigo-600 shrink-0" />
                <span className="truncate" title={isRealEstate ? 'Site Visit Executive' : 'Meeting Executive'}>
                  {isRealEstate ? 'Site Visit Executive' : 'Meeting Executive'}
                </span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-indigo-950 mt-1 truncate" title={lead.assignedVisitor || 'Unassigned'}>
                {lead.assignedVisitor || <span className="text-indigo-600/70 font-normal italic">Unassigned</span>}
              </p>
            </div>

            {/* 4. Lead Source */}
            <div className="bg-gradient-to-br from-sky-50 to-slate-100 border border-sky-200 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[9.5px] font-extrabold text-sky-800 uppercase tracking-tight flex items-center gap-1">
                <FileText size={11} className="text-sky-600 shrink-0" />
                <span className="truncate">Lead Source</span>
              </span>
              <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1 truncate" title={lead.leadSource || '-'}>
                {lead.leadSource || '-'}
              </p>
            </div>

            {/* 5. Reference Name (HIGHLIGHTED) */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-100/70 border-2 border-emerald-300 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[9.5px] font-extrabold text-emerald-800 uppercase tracking-tight flex items-center gap-1">
                <Share2 size={11} className="text-emerald-600 shrink-0" />
                <span className="truncate">Ref Name</span>
              </span>
              <p className="text-xs sm:text-[13px] font-extrabold text-emerald-950 mt-1 truncate" title={refName || '-'}>
                {refName || <span className="text-gray-400 font-normal">-</span>}
              </p>
            </div>
          </div>

          {/* Top Quick Timing & Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">Last Call</span>
              </span>
              <p className="text-xs font-bold text-gray-800 mt-0.5 truncate">
                {lastDateOfCall && lastDateOfCall !== '-' ? lastDateOfCall : '-'}
              </p>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-2 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <Clock size={11} className="text-amber-600 shrink-0" />
                <span className="truncate">Next Call</span>
              </span>
              <p className={`text-xs font-bold mt-0.5 truncate ${nextDateOfCall && nextDateOfCall !== '-' ? NEXT_DATE_CLASS : 'text-gray-400'}`}>
                {nextDateOfCall && nextDateOfCall !== '-' ? nextDateOfCall : '-'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Phone size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">Total Calls</span>
              </span>
              <p className="text-xs font-bold text-indigo-600 mt-0.5">
                {lead.followUpCount || trackers.length} {(lead.followUpCount || trackers.length) === 1 ? 'Call' : 'Calls'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Thermometer size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">Customer Status</span>
              </span>
              {latestCustomerStatus ? (
                <span className={`self-start mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${CUSTOMER_STATUS_STYLES[latestCustomerStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {latestCustomerStatus}
                </span>
              ) : (
                <p className="text-xs font-medium text-gray-400 mt-0.5">-</p>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">Stage</span>
              </span>
              <p className="text-xs font-bold text-gray-800 mt-0.5 truncate">
                {lead.stage || (lead.visitorFollowUpCount > 0 ? 'Site Visit' : 'Leads / Calling')}
              </p>
            </div>
          </div>

          {renderFieldSection('Customer Information', primaryFields)}

          {/* Other profile details — own section, above the call & site-visit history */}
          {renderFieldSection('Other Details', secondaryFields)}

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
                      <th className="px-2.5 py-1.5 min-w-[180px]">Admin Remark</th>
                      <th className="px-2.5 py-1.5 min-w-[180px]">User Remark</th>
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
                        <td className="px-2.5 py-1.5 align-top">
                          {t.userRemark || (idx === trackers.length - 1 && lead.userRemark ? lead.userRemark : '') ? (
                            <div className="min-w-0">
                              <p className="text-gray-800 leading-snug whitespace-pre-wrap break-words">
                                {t.userRemark || (idx === trackers.length - 1 && lead.userRemark ? lead.userRemark : '')}
                              </p>
                              {(t.userRemarkDate || (idx === trackers.length - 1 && lead.userRemarkDate ? lead.userRemarkDate : null)) && (
                                <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                  <Clock size={9} /> {formatDateTime(t.userRemarkDate || lead.userRemarkDate)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
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
            leadType={lead.leadType}
            initialFollowUps={lead.visitorFollowUps}
          />
        </div>

        {/* Compact Footer */}
        <div className="px-3.5 py-2 border-t border-gray-200 bg-slate-50 flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[11px] text-gray-500 font-medium truncate">
            Showing all records for {lead.personName || 'customer'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 transition active:scale-95 shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
