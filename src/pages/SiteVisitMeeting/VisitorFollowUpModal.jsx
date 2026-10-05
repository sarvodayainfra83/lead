import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { MessageSquare, Calendar, X, CheckCircle, Clock } from 'lucide-react';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { authApi } from '../../api/authApi';
import { masterApi } from '../../api/masterApi';
import SearchableDropdown from '../../components/SearchableDropdown';
import {
  formatInputDate,
  CUSTOMER_STATUS_OPTIONS,
  DEAL_OUTCOME_OPTIONS,
  DEFAULT_BUDGET_RANGES
} from './siteVisitMeetingConstants';
import { getLeadTypeBadgeClass } from '../../utils/leadTypeColors';

const VISITOR_STATUS_OPTIONS = [
  'Interested',
  'Future Plan',
  'Not Interested',
  'Did Not Show'
];

const resolveInitialCustomerStatus = (lead) => {
  const raw = lead?.latestFollowUp?.customerStatus || lead?.latestFollowUp?.customer_status || lead?.customerStatus || lead?.interestLevel || '';
  const s = String(raw).trim().toLowerCase();
  if (s === 'hot' || s === 'high') return 'Hot';
  if (s === 'warm' || s === 'medium') return 'Warm';
  if (s === 'cold' || s === 'low') return 'Cold';
  return 'Warm';
};

export default function VisitorFollowUpModal({ isOpen, onClose, lead, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [budgetOptions, setBudgetOptions] = useState([]);
  const [showManualDealDetails, setShowManualDealDetails] = useState(false);

  const [formData, setFormData] = useState({
    status: '',
    customerStatus: 'Warm',
    whatHappened: '',
    nextVisitDate: '',
    // Deal Details
    dealOutcome: 'Closed (Won)',
    closingAmount: '',
    salesExecutive: '',
    referenceNo: ''
  });

  const [visitMeet, setVisitMeet] = useState({
    'site-visit': false,
    meeting: false
  });

  const [leadTypes, setLeadTypes] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchMasters = async () => {
      try {
        const [userList, budgetList, leadTypeList] = await Promise.all([
          authApi.getUsers().catch(() => []),
          masterApi.getInvestmentBudgets().catch(() => []),
          masterApi.getLeadTypes().catch(() => [])
        ]);
        if (isMounted) {
          setUsers(userList || []);
          setLeadTypes(leadTypeList || []);
          if (budgetList && budgetList.length > 0) {
            setBudgetOptions(budgetList.map(b => ({ value: b.investmentBudget, label: b.investmentBudget })));
          } else {
            setBudgetOptions(DEFAULT_BUDGET_RANGES.map(b => ({ value: b, label: b })));
          }
        }
      } catch (e) {
        console.warn('Error loading masters in follow up modal:', e);
      }
    };
    fetchMasters();
    return () => { isMounted = false; };
  }, []);

  const wasOpenRef = useRef(false);
  const lastLeadIdRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const currentId = lead?.id || lead?.leadNo;
    const isFirstOpen = !wasOpenRef.current;
    const isNewLead = currentId && currentId !== lastLeadIdRef.current;

    if (lead && (isFirstOpen || isNewLead)) {
      wasOpenRef.current = true;
      lastLeadIdRef.current = currentId;

      const initialStatus = lead.status === 'Pending Assignment' ? '' : (lead.latestFollowUp?.status || '');
      const initialDealOutcome = lead.latestFollowUp?.dealOutcome || lead.dealOutcome || 'Closed (Won)';
      const initialClosingAmount = lead.latestFollowUp?.closingAmount || lead.closingAmount || lead.investmentBudget || '';
      const initialSalesExecutive = lead.latestFollowUp?.salesExecutive || lead.salesExecutive || lead.assignedVisitor || '';
      const initialRef = lead.latestFollowUp?.referenceNo || lead.referenceNo || '';
      const initialVisitMeet = lead.visitMeet || lead.latestFollowUp?.visitMeet || lead.visit_meet || lead.latestFollowUp?.visit_meet || {};

      setFormData({
        status: initialStatus,
        customerStatus: resolveInitialCustomerStatus(lead),
        whatHappened: '',
        nextVisitDate: formatInputDate(lead.nextVisitDate || ''),
        dealOutcome: initialDealOutcome,
        closingAmount: initialClosingAmount,
        salesExecutive: initialSalesExecutive,
        referenceNo: initialRef
      });
      setVisitMeet({
        'site-visit': Boolean(initialVisitMeet['site-visit'] ?? initialVisitMeet.siteVisit ?? initialVisitMeet.site_visit),
        meeting: Boolean(initialVisitMeet.meeting)
      });
      setShowManualDealDetails(Boolean(initialDealOutcome && initialDealOutcome !== 'Rejected (Lost)'));
    }
  }, [lead, isOpen]);

  const salesExecutiveOptions = useMemo(() => {
    // Build map of id <-> name
    const typeIdToName = {};
    const typeNameToId = {};
    (leadTypes || []).forEach(lt => {
      const id = String(lt.id || '').trim();
      const name = String(lt.leadType || '').trim().toLowerCase();
      if (id && name) {
        typeIdToName[id] = name;
        typeNameToId[name] = id;
      }
    });

    // Resolve target lead type name & id
    const targetTypeName = String(lead?.leadType || '').trim().toLowerCase();
    const targetTypeId = String(lead?.leadTypeId || typeNameToId[targetTypeName] || '').trim();

    const matchingUsers = (users || []).filter(u => {
      const uTypeId = String(u.leadTypeId || u.lead_type_id || '').trim();
      const uTypeName = String(u.leadType || (uTypeId ? typeIdToName[uTypeId] : '') || '').trim().toLowerCase();

      // Check direct lead type match
      const matchesType = (targetTypeName && uTypeName && targetTypeName === uTypeName) ||
                          (targetTypeId && uTypeId && targetTypeId === uTypeId);

      // Universal users (no lead type assigned) or Admins/Managers available across lead types
      const isUniversal = !uTypeName && !uTypeId;
      const isAdminOrMgr = String(u.role || '').toUpperCase() === 'ADMIN' ||
                           String(u.position || '').toLowerCase().includes('manager') ||
                           String(u.position || '').toLowerCase().includes('admin');

      return matchesType || isUniversal || isAdminOrMgr;
    });

    const pool = matchingUsers.length > 0 ? matchingUsers : (users || []);

    const opts = pool.map(u => ({
      value: u.name,
      label: u.position ? `${u.name} (${u.position})` : u.name
    }));

    // Prepend assigned visitor if present and not in list
    if (lead?.assignedVisitor && !opts.some(o => o.value.toLowerCase() === lead.assignedVisitor.toLowerCase())) {
      opts.unshift({
        value: lead.assignedVisitor,
        label: `${lead.assignedVisitor} (Assigned Visitor)`
      });
    }

    return opts;
  }, [users, leadTypes, lead]);

  const budgetRangeOptions = useMemo(() => {
    const opts = [...budgetOptions];
    if (lead?.investmentBudget && !opts.some(o => o.value.toLowerCase() === lead.investmentBudget.toLowerCase())) {
      opts.unshift({
        value: lead.investmentBudget,
        label: `${lead.investmentBudget} (Customer Budget)`
      });
    }
    return opts;
  }, [budgetOptions, lead]);

  if (!isOpen || !lead) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const statusOptions = VISITOR_STATUS_OPTIONS.map(s => ({ value: s, label: s }));
  const isDealSectionVisible = formData.status === 'Interested' || showManualDealDetails;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.status) {
      toast.error('Please select a visit outcome status');
      return;
    }

    if (!formData.whatHappened.trim()) {
      toast.error('Customer Feedback / What Happened is required');
      return;
    }

    if ((formData.status === 'Future Plan' || formData.status === 'Did Not Show') && !formData.nextVisitDate) {
      toast.error('Next Visit / Follow-up Date is required');
      return;
    }

    if (isDealSectionVisible && formData.status === 'Interested' && !formData.dealOutcome) {
      toast.error('Please select a deal outcome');
      return;
    }

    setLoading(true);
    try {
      const followUpCount = (lead.followUps?.length || 0) + 1;
      const isCloseDeal = isDealSectionVisible && formData.status !== 'Not Interested';
      const previousFollowUp = lead.latestFollowUp || (lead.followUps?.length > 0 ? lead.followUps[lead.followUps.length - 1] : null);
      const parentId = (previousFollowUp?.id && siteVisitMeetingApi.isUuid(previousFollowUp.id)) ? previousFollowUp.id : null;

      const entry = {
        leadId: lead.leadId || lead.id,
        leadNo: lead.leadNo,
        parentId,
        parent_id: parentId,
        assignedVisitorId: lead.assignedVisitorId || null,
        visitorName: lead.assignedVisitor || '',
        visitorId: lead.visitorId || null,
        visitDate: lead.visitDate || formatInputDate(new Date()),
        visitMeet,
        visit_meet: visitMeet,
        status: formData.status,
        customerStatus: formData.customerStatus || 'Warm',
        customer_status: formData.customerStatus || 'Warm',
        interestLevel: formData.customerStatus || 'Warm',
        whatHappened: formData.whatHappened.trim(),
        nextVisitDate: (formData.status === 'Future Plan' || formData.status === 'Did Not Show') ? formData.nextVisitDate : null,
        dealOutcome: formData.status === 'Not Interested'
          ? 'Rejected (Lost)'
          : (isCloseDeal ? (formData.dealOutcome || 'Closed (Won)') : null),
        rejectionReason: formData.status === 'Not Interested' ? 'Not Interested' : null,
        salesExecutive: isCloseDeal ? (formData.salesExecutive || null) : null,
        closingAmount: isCloseDeal ? (formData.closingAmount || null) : null,
        referenceNo: isCloseDeal ? (formData.referenceNo || null) : null,
        dealRemarks: null,
        followUpNo: followUpCount
      };

      await siteVisitMeetingApi.saveVisitorFollowUp(entry);
      toast.success(`Follow-up #${followUpCount} saved for ${lead.leadNo || 'lead'}`);

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving visitor follow up:', err);
      toast.error('Failed to save follow up: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-5 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100/80 ring-1 ring-black/5 w-full max-w-xl max-h-[88dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold tracking-tight text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/20 font-mono">
              {lead.leadNo || 'Lead'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${getLeadTypeBadgeClass(lead.leadType)}`}>
              {lead.leadType || 'Real Estate'}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white truncate">
              Log Visit Follow-Up
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lead Context Summary */}
        <div className="flex-shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 bg-slate-50 border-b border-gray-200 text-xs flex flex-wrap gap-x-4 sm:gap-x-5 gap-y-1 text-gray-600">
          <div>
            <span className="text-gray-400">Customer:</span>{' '}
            <span className="font-bold text-gray-900">{lead.customerName || lead.personName || '-'}</span>
          </div>
          <div>
            <span className="text-gray-400">Contact:</span>{' '}
            <span className="font-semibold text-gray-800">{lead.customerNumber || lead.number || '-'}</span>
          </div>
          <div>
            <span className="text-gray-400">Assigned Visitor:</span>{' '}
            <span className="font-bold text-indigo-600">{lead.assignedVisitor || 'Unassigned'}</span>
          </div>
          {lead.followUps?.length ? (
            <div className="text-[11px] text-purple-700 font-semibold">
              Previous Follow-ups: #{lead.followUps.length}
            </div>
          ) : null}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 text-xs">
          {/* Outcome Status & Interest Level (2-column on mobile) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
            <div>
              <label className="block font-semibold text-gray-700 mb-1 text-[11px] sm:text-xs">
                Visit Outcome Status <span className="text-red-500">*</span>
              </label>
              <SearchableDropdown
                options={statusOptions}
                value={formData.status}
                onChange={(val) => handleChange('status', val)}
                placeholder="Select outcome..."
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1 text-[11px] sm:text-xs truncate">
                Customer Status <span className="text-gray-400 font-normal hidden sm:inline">(HOT / Warm / Cold)</span>
              </label>
              <SearchableDropdown
                options={CUSTOMER_STATUS_OPTIONS}
                value={formData.customerStatus}
                onChange={(val) => handleChange('customerStatus', val)}
                placeholder="Select Hot / Warm / Cold..."
              />
            </div>
          </div>

          {/* Activity Type: Site Visited & Meeting Checkboxes */}
          <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 border border-slate-200 rounded-lg p-2 sm:p-2.5">
            <span className="font-semibold text-gray-700 text-[11px] sm:text-xs">Activity:</span>
            {(!lead?.leadType || lead?.leadType?.toLowerCase().includes('real') || (lead?.leadNo || '').toUpperCase().startsWith('LR')) && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={Boolean(visitMeet['site-visit'])}
                  onChange={(e) => setVisitMeet(prev => ({ ...prev, 'site-visit': e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>Site Visited</span>
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
              <input
                type="checkbox"
                checked={Boolean(visitMeet.meeting)}
                onChange={(e) => setVisitMeet(prev => ({ ...prev, meeting: e.target.checked }))}
                className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
              />
              <span>Meeting</span>
            </label>
          </div>

          {/* Conditional Next Visit Schedule (only when Future Plan or Did Not Show) */}
          {(formData.status === 'Future Plan' || formData.status === 'Did Not Show') && (
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-2">
              <h4 className="font-bold text-purple-800 text-xs flex items-center gap-1.5">
                <Clock size={14} /> Next Visit / Follow-up Schedule
              </h4>
              <div>
                <label className="block font-medium text-gray-700 mb-1 text-[11px] sm:text-xs">
                  Next Scheduled Date <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="date"
                    value={formData.nextVisitDate}
                    onChange={(e) => handleChange('nextVisitDate', e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    required
                  />
                  <Calendar size={14} className="absolute left-3 top-2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Deal Details (Brought back for Close Deal) */}
          {isDealSectionVisible && (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/90 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                  <CheckCircle size={15} className="text-emerald-600" />
                  Deal Details
                </h4>
                {formData.status !== 'Interested' && (
                  <button
                    type="button"
                    onClick={() => setShowManualDealDetails(false)}
                    className="text-[11px] text-gray-400 hover:text-gray-600"
                  >
                    Hide
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* 1. Deal Outcome * */}
                <div>
                  <label className="block font-medium text-gray-700 mb-1 text-[11px] sm:text-xs">
                    Deal Outcome <span className="text-red-500">*</span>
                  </label>
                  <SearchableDropdown
                    options={DEAL_OUTCOME_OPTIONS}
                    value={formData.dealOutcome}
                    onChange={(val) => handleChange('dealOutcome', val)}
                    placeholder="Select Outcome"
                  />
                </div>

                {/* 2. Closing Amount (₹) / Budget in Range */}
                <div>
                  <label className="block font-medium text-gray-700 mb-1 text-[11px] sm:text-xs">
                    Closing Amount (₹)
                  </label>
                  <SearchableDropdown
                    options={budgetRangeOptions}
                    value={formData.closingAmount}
                    onChange={(val) => handleChange('closingAmount', val)}
                    placeholder="e.g. 50,00,000"
                  />
                </div>

                {/* 3. Sales Executive */}
                <div>
                  <label className="block font-medium text-gray-700 mb-1 text-[11px] sm:text-xs">
                    Sales Executive
                  </label>
                  <SearchableDropdown
                    options={salesExecutiveOptions}
                    value={formData.salesExecutive}
                    onChange={(val) => handleChange('salesExecutive', val)}
                    placeholder="Executive"
                  />
                </div>

                {/* 4. Reference / Unit No */}
                <div>
                  <label className="block font-medium text-gray-700 mb-1 text-[11px] sm:text-xs">
                    Reference / Unit No
                  </label>
                  <input
                    type="text"
                    value={formData.referenceNo}
                    onChange={(e) => handleChange('referenceNo', e.target.value)}
                    placeholder="e.g. Flat #302, Policy #..."
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {!isDealSectionVisible && formData.status !== 'Not Interested' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowManualDealDetails(true)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
              >
                <CheckCircle size={12} /> + Record Deal / Close Details
              </button>
            </div>
          )}

          {/* What Happened / Feedback (Always Required) */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1 text-[11px] sm:text-xs">
              What Happened / Customer Feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.whatHappened}
              onChange={(e) => handleChange('whatHappened', e.target.value)}
              placeholder="Enter customer feedback, points discussed, outcome details..."
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              {loading ? 'Saving...' : 'Save Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
