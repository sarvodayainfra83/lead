import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  X, User, Phone, Building2, Briefcase, MapPin, Calendar, Clock,
  ShieldCheck, LogOut, MessageSquare, CheckCircle, AlertCircle,
  Pencil, Check, TrendingUp, History, Sparkles, ChevronRight
} from 'lucide-react';
import {
  PURPOSE_STYLES,
  getPurposeKey,
  formatVisitorDate,
  formatVisitorTime
} from './receptionConstants';
import { visitorApi } from '../../api/visitorApi';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, hasFullAccess } from '../../utils/authUtils';

export default function VisitorDetailsModal({ isOpen, onClose, visitor, onVisitorUpdated }) {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);
  const canManageAdminRemark = isAdmin || hasFullAccess(user, 'reception') || hasFullAccess(user, 'receptionDashboard');

  const [currentVisitor, setCurrentVisitor] = useState(visitor);
  const [followUpsData, setFollowUpsData] = useState({ followUps: [], matchedLead: null });
  const [loadingFollowUps, setLoadingFollowUps] = useState(true);

  // Admin remark editing state
  const [isEditingAdminRemark, setIsEditingAdminRemark] = useState(false);
  const [adminRemarkDraft, setAdminRemarkDraft] = useState('');
  const [savingAdminRemark, setSavingAdminRemark] = useState(false);

  useEffect(() => {
    setCurrentVisitor(visitor);
    setIsEditingAdminRemark(false);
    setAdminRemarkDraft(visitor?.adminRemark || '');
  }, [visitor]);

  // Load customer follow-up history across modules
  useEffect(() => {
    if (!isOpen || !visitor) return;
    let cancelled = false;
    setLoadingFollowUps(true);

    visitorApi.getCustomerFollowUps(visitor)
      .then((res) => {
        if (!cancelled) {
          setFollowUpsData(res || { followUps: [], matchedLead: null });
        }
      })
      .catch((err) => {
        console.error('Failed to load follow-ups for visitor:', err);
        if (!cancelled) {
          setFollowUpsData({ followUps: [], matchedLead: null });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFollowUps(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, visitor]);

  if (!isOpen || !currentVisitor) return null;

  const cleanPhone = String(currentVisitor.mobileNumber || '').replace(/[^0-9]/g, '');

  const handleWhatsApp = () => {
    if (!cleanPhone) return;
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const msg = encodeURIComponent(`Hello ${currentVisitor.visitorName}, thank you for visiting Sarvodaya Infracon.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank');
  };

  const handleSaveAdminRemark = async () => {
    const text = adminRemarkDraft.trim();
    setSavingAdminRemark(true);
    try {
      const nowIso = new Date().toISOString();
      const updated = await visitorApi.updateVisitor(currentVisitor.id, {
        adminRemark: text,
        adminRemarkDate: text ? nowIso : null
      });

      const updatedObj = {
        ...currentVisitor,
        adminRemark: text,
        adminRemarkDate: text ? nowIso : null
      };

      setCurrentVisitor(updatedObj);
      setIsEditingAdminRemark(false);
      toast.success(text ? 'Admin remark saved successfully' : 'Admin remark cleared');
      onVisitorUpdated?.(updated || updatedObj);
    } catch (err) {
      console.error('Failed to save admin remark:', err);
      toast.error('Failed to save admin remark');
    } finally {
      setSavingAdminRemark(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 ring-1 ring-black/5 w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <User size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {currentVisitor.visitorName}
              </h3>
              <p className="text-[11px] text-gray-300 truncate">
                {currentVisitor.companyName ? `${currentVisitor.companyName} • ` : ''}Visitor Details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 text-xs">
          
          {/* Quick Contact & Action Strip */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-gray-400" />
              <span className="font-bold text-sm text-gray-900 tracking-wide">{currentVisitor.mobileNumber}</span>
              {currentVisitor.visitorType && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700">
                  {currentVisitor.visitorType}
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
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition cursor-pointer"
              >
                WhatsApp
              </button>
            </div>
          </div>

          {/* Visit Information Grid */}
          <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Visit Purpose</span>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-semibold border ${PURPOSE_STYLES[getPurposeKey(currentVisitor.visitPurpose)] || PURPOSE_STYLES.Other}`}>
                {currentVisitor.visitPurpose}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Visit Location</span>
              <span className="font-semibold text-gray-800 mt-1 inline-flex items-center gap-1">
                <MapPin size={12} className="text-gray-500" />
                {currentVisitor.visitLocation}
              </span>
            </div>

            {currentVisitor.projectName && (
              <div className="col-span-2 pt-1 border-t border-gray-200/80">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Project / Site Name</span>
                <span className="font-bold text-amber-800 mt-0.5 block">{currentVisitor.projectName}</span>
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
              <div className="col-span-2">
                <span className="text-gray-500 text-[11px] block">Person to Meet:</span>
                <span className="font-bold text-gray-900 mt-0.5 block">{currentVisitor.personToMeetName || '-'}</span>
                {currentVisitor.department && (
                  <span className="text-[10px] text-gray-500 block">Dept: {currentVisitor.department}</span>
                )}
              </div>
            </div>
          </div>

          {/* Arrival / Registration Log */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <h4 className="text-[11px] uppercase font-bold text-slate-700 tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-500" />
              <span>Visit Registration Log</span>
            </h4>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Visit Date</span>
                <span className="font-bold text-gray-800 mt-0.5 block">{formatVisitorDate(currentVisitor.checkInAt)}</span>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Visit Time</span>
                <span className="font-bold text-gray-800 mt-0.5 block">{formatVisitorTime(currentVisitor.checkInAt)}</span>
              </div>
            </div>

            {currentVisitor.checkedInBy && (
              <div className="pt-1 text-center">
                <span className="text-[10px] text-gray-500">Registered by receptionist: </span>
                <span className="text-[10px] font-bold text-indigo-700">{currentVisitor.checkedInBy}</span>
              </div>
            )}
          </div>

          {/* Remarks & Notes */}
          {currentVisitor.remarks && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Remarks & Notes</span>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{currentVisitor.remarks}</p>
            </div>
          )}

          {/* ADMIN REMARK SECTION */}
          <div className="p-3.5 bg-gradient-to-br from-violet-50/80 via-purple-50/40 to-slate-50 border border-violet-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-violet-700" />
                <span className="text-[11px] uppercase font-bold text-violet-950 tracking-wider">
                  Admin Remark
                </span>
                {currentVisitor.adminRemarkDate && (
                  <span className="text-[10px] text-violet-600 font-medium hidden sm:inline">
                    • {formatVisitorDate(currentVisitor.adminRemarkDate)} {formatVisitorTime(currentVisitor.adminRemarkDate)}
                  </span>
                )}
              </div>

              {canManageAdminRemark && !isEditingAdminRemark && (
                <button
                  type="button"
                  onClick={() => {
                    setAdminRemarkDraft(currentVisitor.adminRemark || '');
                    setIsEditingAdminRemark(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-violet-700 bg-violet-100/80 hover:bg-violet-200 border border-violet-200 transition cursor-pointer"
                >
                  <Pencil size={11} />
                  <span>{currentVisitor.adminRemark ? 'Edit Remark' : '+ Add Remark'}</span>
                </button>
              )}
            </div>

            {isEditingAdminRemark ? (
              <div className="space-y-2 pt-1">
                <textarea
                  value={adminRemarkDraft}
                  onChange={(e) => setAdminRemarkDraft(e.target.value)}
                  rows={2}
                  placeholder="Enter admin remarks, instructions, or notes for this visitor..."
                  className="w-full text-xs p-2.5 bg-white border border-violet-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500 shadow-2xs resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingAdminRemark(false);
                      setAdminRemarkDraft(currentVisitor.adminRemark || '');
                    }}
                    disabled={savingAdminRemark}
                    className="px-2.5 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAdminRemark}
                    disabled={savingAdminRemark}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg shadow-xs transition cursor-pointer"
                  >
                    {savingAdminRemark ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={12} />
                        <span>Save Remark</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : currentVisitor.adminRemark ? (
              <div>
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-xs bg-white/80 p-2.5 rounded-lg border border-violet-100 font-medium">
                  {currentVisitor.adminRemark}
                </p>
                {currentVisitor.adminRemarkDate && (
                  <p className="text-[10px] text-violet-500 font-medium mt-1 sm:hidden">
                    Logged: {formatVisitorDate(currentVisitor.adminRemarkDate)} {formatVisitorTime(currentVisitor.adminRemarkDate)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic text-[11px] py-0.5">
                {canManageAdminRemark
                  ? 'No admin remark added yet. Click "+ Add Remark" to add guidance or notes.'
                  : 'No admin remark added yet.'}
              </p>
            )}
          </div>

          {/* CUSTOMER FOLLOW-UPS SECTION */}
          <div className="space-y-2">
            {loadingFollowUps ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-500">
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Checking customer follow-ups...</span>
              </div>
            ) : followUpsData.followUps.length === 0 ? (
              // Condition when NO follow-up exists:
              // "agr nhi hai to mtt show uske banaye ek kuch chota hai text daal do ki bhai followups nhi hua hai"
              <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock size={13} className="text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">
                    Abhi is customer ka koi aage ka follow-up nahi hua hai
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-600 tracking-wide uppercase">
                  No Follow-Up Yet
                </span>
              </div>
            ) : (
              // Condition when follow-up exists:
              // "age jaise uss customers se koi aage ka followups hua hai yaa folloup exists krta hai to vo followup show hona chahiye"
              <div className="border border-indigo-100 rounded-xl bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/60 p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <TrendingUp size={13} />
                    </span>
                    <div>
                      <h4 className="text-[11px] uppercase font-bold text-slate-900 tracking-wider">
                        Customer Follow-Up History
                      </h4>
                      {followUpsData.matchedLead && (
                        <p className="text-[10px] text-gray-500">
                          Linked Lead: <strong className="text-indigo-600 font-mono">#{followUpsData.matchedLead.leadNo || followUpsData.matchedLead.id}</strong>
                          {followUpsData.matchedLead.leadType && ` • ${followUpsData.matchedLead.leadType}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                    {followUpsData.followUps.length} {followUpsData.followUps.length === 1 ? 'Follow-Up Record' : 'Follow-Up Records'}
                  </span>
                </div>

                {/* Follow-up Timeline Items */}
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {followUpsData.followUps.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5 text-xs hover:border-indigo-300 transition"
                    >
                      {/* Top row: Type, Date, Status */}
                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                            item.type === 'Call Tracker'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {item.type === 'Call Tracker' ? <Phone size={10} /> : <MapPin size={10} />}
                            <span>{item.category}</span>
                          </span>

                          {item.followUpNo && (
                            <span className="text-[10px] font-bold text-gray-500">
                              #{item.followUpNo}
                            </span>
                          )}

                          <span className="text-[10px] text-gray-500 font-medium">
                            {formatVisitorDate(item.date)} {item.date && String(item.date).includes('T') ? formatVisitorTime(item.date) : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          {item.status && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.status}
                            </span>
                          )}
                          {item.customerStatus && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              item.customerStatus === 'Hot'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : item.customerStatus === 'Warm'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-sky-100 text-sky-800 border border-sky-200'
                            }`}>
                              {item.customerStatus}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Handler / Executive */}
                      {item.handler && item.handler !== '-' && (
                        <div className="text-[11px] text-gray-600 flex items-center gap-1">
                          <span className="text-gray-400">Handled By:</span>
                          <strong className="text-gray-800 font-semibold">{item.handler}</strong>
                        </div>
                      )}

                      {/* Discussion / What customer said / what happened */}
                      {item.customerFeedback && (
                        <div className="bg-slate-50/90 p-2 rounded-lg border border-slate-100 text-gray-700 leading-snug">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Discussion / Notes</span>
                          <p className="whitespace-pre-wrap">{item.customerFeedback}</p>
                        </div>
                      )}

                      {/* Next Scheduled Action */}
                      {item.nextDate && (
                        <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 font-semibold pt-0.5">
                          <Calendar size={11} className="text-indigo-500" />
                          <span>Next Follow-Up Scheduled: {item.nextDate}</span>
                        </div>
                      )}

                      {/* Deal details if closed/locked */}
                      {(item.dealOutcome || item.closingAmount || item.referenceNo) && (
                        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {item.dealOutcome && <span>{item.dealOutcome}</span>}
                          {item.closingAmount && <span>• ₹{item.closingAmount}</span>}
                          {item.referenceNo && <span>• Unit #{item.referenceNo}</span>}
                        </div>
                      )}

                      {/* Admin Remark on follow-up */}
                      {item.adminRemark && (
                        <div className="text-[11px] text-violet-800 bg-violet-50/80 px-2 py-1 rounded-lg border border-violet-100">
                          <span className="font-bold text-[10px] uppercase block text-violet-600">Admin Remark on Follow-Up:</span>
                          <span>{item.adminRemark}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
