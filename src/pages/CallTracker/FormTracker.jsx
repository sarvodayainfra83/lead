import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, ClipboardList, Clock, Share2, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildShareClient } from '../../utils/productShare';
import { callTrackerApi } from '../../api/callTrackerApi';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { ENQUIRY_STATUSES, TERMINAL_STATUSES, DATE_STATUSES, CUSTOMER_STATUSES } from './callTrackerConstants';
import { getLeadTypeTextClass } from '../../utils/leadTypeColors';
import { useAuthStore } from '../../store/authStore';

const DEAL_STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Not Interested', label: 'Not Interested' }
];

/**
 * FormTracker
 * Pop-up "Call Now" modal opened from PendingTracker. Shows the lead's details for
 * reference, lets Product Type / Requirement / Sub Product Type / Investment Budget /
 * When to Buy Plan be updated on the spot (pre-filled from the lead's saved data), then logs
 * the outcome of the call as a new Call Tracker history entry.
 *
 * Props:
 *   isOpen  – boolean
 *   onClose – fn()
 *   lead    – the lead being called
 *   onSaved – fn() called after a successful save so the parent can refresh
 */
const initialFormState = {
  status: '',
  customerStatus: '',
  customerSaid: '',
  nextDate: '',
  requirement: '',
  requirementOption: '',
  customRequirement: '',
  customProductType: '',
  insuranceType: '',
  customInsuranceType: '',
  insuranceSubType: '',
  customInsuranceSubType: '',
  investmentBudget: '',
  whenToBuyPlan: '',
  siteVisited: false,
  meeting: false,
  dealStatus: 'Pending',
  exactBudget: '',
  assignedVisitor: ''
};

export default function FormTracker({ isOpen, onClose, lead, onSaved }) {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...initialFormState });
  const [requirementsList, setRequirementsList] = useState([]);
  const [realEstateProductsList, setRealEstateProductsList] = useState([]);
  const [mutualFundProductsList, setMutualFundProductsList] = useState([]);
  const [insuranceProductsList, setInsuranceProductsList] = useState([]);
  const [insuranceSubProductsList, setInsuranceSubProductsList] = useState([]);
  const [investmentBudgetsList, setInvestmentBudgetsList] = useState([]);
  const [visitorsList, setVisitorsList] = useState([]);

  const wasOpenRef = useRef(false);
  const lastLeadIdRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        masterApi.getRealEstateRequirements(),
        masterApi.getRealEstateProducts(),
        masterApi.getMutualFundProducts(),
        masterApi.getInsuranceProducts(),
        masterApi.getInsuranceSubProducts(),
        masterApi.getInvestmentBudgets(),
        masterApi.getVisitors()
      ]).then(([requirements, reProducts, mfProducts, insProducts, insSubProducts, budgets, visitors]) => {
        setRequirementsList(requirements);
        setRealEstateProductsList(reProducts);
        setMutualFundProductsList(mfProducts);
        setInsuranceProductsList(insProducts);
        setInsuranceSubProductsList(insSubProducts);
        setInvestmentBudgetsList(budgets);
        setVisitorsList(visitors || []);
      }).catch(console.error);
    }
  }, [isOpen]);

  const isOtherValue = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    return lower === 'other' || lower === 'others' || lower === 'add new' || lower === 'add_new' || lower === '+ add new';
  };

  const isRealEstate =
    (lead?.leadType || '').trim().toLowerCase() === 'real estate' ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LR');
  const isMutualFund = (lead?.leadType || '').trim().toLowerCase() === 'mutual fund';
  const isInsurance = (lead?.leadType || '').trim().toLowerCase().includes('insurance');

  // Only reset the outcome fields when the modal first opens or a different lead is opened
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const currentLeadId = lead?.id || lead?.leadNo;
    const isFirstOpen = !wasOpenRef.current;
    const isNewLead = currentLeadId && currentLeadId !== lastLeadIdRef.current;

    if (lead && (isFirstOpen || isNewLead)) {
      wasOpenRef.current = true;
      lastLeadIdRef.current = currentLeadId;

      const rawProduct = (lead.productType || '').trim();
      const masterProductList = isRealEstate ? realEstateProductsList : (isMutualFund ? mutualFundProductsList : []);
      const isProductPreset = rawProduct && masterProductList.some(
        opt => !isOtherValue(opt.productType) && opt.productType.toLowerCase() === rawProduct.toLowerCase()
      );

      const rawIns = (lead.insuranceType || lead.productType || '').trim();
      const isInsPreset = rawIns && insuranceProductsList.some(
        opt => !isOtherValue(opt.productType) && opt.productType.toLowerCase() === rawIns.toLowerCase()
      );

      const rawSub = (lead.insuranceSubType || '').trim();
      const isSubPreset = rawSub && insuranceSubProductsList.some(
        opt => !isOtherValue(opt.subProductType) && opt.subProductType.toLowerCase() === rawSub.toLowerCase()
      );

      const req = (lead.requirement || '').trim();
      const isReqPreset = req && requirementsList.some(
        r => !isOtherValue(r.requirement) && r.requirement.toLowerCase() === req.toLowerCase()
      );

      setFormData({
        status: '',
        customerStatus: lead.customerStatus || '',
        customerSaid: '',
        nextDate: '',
        requirement: req,
        requirementOption: isReqPreset
          ? requirementsList.find(r => r.requirement.toLowerCase() === req.toLowerCase())?.requirement
          : (req ? 'Others' : ''),
        customRequirement: isReqPreset ? '' : req,
        productType: isProductPreset ? rawProduct : (rawProduct ? 'Others' : ''),
        customProductType: isProductPreset ? '' : rawProduct,
        insuranceType: isInsPreset ? rawIns : (rawIns ? 'Others' : ''),
        customInsuranceType: isInsPreset ? '' : rawIns,
        insuranceSubType: isSubPreset ? rawSub : (rawSub ? 'Others' : ''),
        customInsuranceSubType: isSubPreset ? '' : rawSub,
        investmentBudget: lead.investmentBudget || '',
        whenToBuyPlan: lead.whenToBuyPlan || '',
        siteVisited: false,
        meeting: false,
        dealStatus: 'Pending',
        exactBudget: '',
        assignedVisitor: lead.assignedVisitor || user?.name || ''
      });
    }
  }, [isOpen, lead, requirementsList, realEstateProductsList, mutualFundProductsList, insuranceProductsList, insuranceSubProductsList, user]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'status' && !DATE_STATUSES.includes(value)) {
        updated.nextDate = '';
      }
      if (field === 'productType' && !isOtherValue(value)) {
        updated.customProductType = '';
      }
      if (field === 'insuranceType') {
        if (!isOtherValue(value)) {
          updated.customInsuranceType = '';
        }
        updated.insuranceSubType = '';
        updated.customInsuranceSubType = '';
      }
      if (field === 'insuranceSubType' && !isOtherValue(value)) {
        updated.customInsuranceSubType = '';
      }
      return updated;
    });
  };

  const handleRequirementOptionChange = (val) => {
    setFormData(prev => ({
      ...prev,
      requirementOption: val,
      requirement: isOtherValue(val) ? (prev.customRequirement || '') : val
    }));
  };

  const handleCustomRequirementChange = (text) => {
    setFormData(prev => ({
      ...prev,
      customRequirement: text,
      requirement: text
    }));
  };

  const requirementOptions = useMemo(() => {
    return (requirementsList || [])
      .filter(r => !isOtherValue(r.requirement))
      .map(r => ({ value: r.requirement, label: r.requirement }));
  }, [requirementsList]);

  const realEstateProductOptions = useMemo(() => {
    return (realEstateProductsList || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType }));
  }, [realEstateProductsList]);

  const mutualFundProductOptions = useMemo(() => {
    return (mutualFundProductsList || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType }));
  }, [mutualFundProductsList]);

  const insuranceProductOptions = useMemo(() => {
    return (insuranceProductsList || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType }));
  }, [insuranceProductsList]);

  const insuranceSubProductOptions = useMemo(() => {
    const currentInsType = isOtherValue(formData.insuranceType)
      ? (formData.customInsuranceType || '')
      : formData.insuranceType;
    return (insuranceSubProductsList || [])
      .filter(s => !isOtherValue(s.subProductType) && s.productType?.toLowerCase().trim() === currentInsType?.toLowerCase().trim())
      .map(s => ({ value: s.subProductType, label: s.subProductType }));
  }, [insuranceSubProductsList, formData.insuranceType, formData.customInsuranceType]);

  const investmentBudgetOptions = investmentBudgetsList.map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));

  const visitorOptions = useMemo(() => {
    const leadTypeClean = String(lead?.leadType || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const matching = (visitorsList || []).filter(v => {
      if (!leadTypeClean) return true;
      const vTypeClean = String(v.leadType || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return !vTypeClean || vTypeClean === leadTypeClean || vTypeClean.includes(leadTypeClean) || leadTypeClean.includes(vTypeClean);
    });

    const pool = matching.length > 0 ? matching : (visitorsList || []);
    const seen = new Set();
    const opts = [];

    // Prepend logged in user
    if (user?.name) {
      const cleanUser = String(user.name).replace(/\s+/g, ' ').trim();
      seen.add(cleanUser.toLowerCase());
      opts.push({ value: cleanUser, label: `${cleanUser} (You)` });
    }

    pool.forEach(v => {
      const raw = v?.personName || v?.name || v?.visitorName || v?.visitor_name;
      if (!raw) return;
      const clean = String(raw).replace(/\s+/g, ' ').trim();
      const lower = clean.toLowerCase();
      if (clean && !seen.has(lower)) {
        seen.add(lower);
        opts.push({ value: clean, label: clean });
      }
    });

    return opts;
  }, [visitorsList, lead, user]);

  // Default assignedVisitor if status is Site Visit/Meeting
  useEffect(() => {
    if (formData.status === 'Site Visit/Meeting' && !formData.assignedVisitor) {
      setFormData(prev => ({
        ...prev,
        assignedVisitor: lead?.assignedVisitor || user?.name || (visitorOptions[0]?.value || '')
      }));
    }
  }, [formData.status, visitorOptions, user, lead, formData.assignedVisitor]);

  // Read-only reference fields shown at the top of the form — everything NOT editable below
  const infoFields = [
    { key: 'leadType', label: 'Lead Type' },
    lead?.processType === 'Direct'
      ? { key: 'callerAssigned', label: 'Caller Name' }
      : { key: 'leadReceiver', label: 'Team Member Name' },
    { key: 'leadSource', label: 'Lead Source' },
    { key: 'referencerName', label: 'Reference Name' },
    { key: 'personName', label: 'Customer Name' },
    { key: 'number', label: 'Customer Number' },
    { key: 'email', label: 'Customer Email' },
    { key: 'dob', label: 'DOB' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'location', label: 'Customer Address' },
    ...(isInsurance ? [{ key: 'anyDesease', label: 'Medical Condition' }] : [])
  ];

  const handleClose = () => {
    setFormData({ ...initialFormState });
    onClose();
  };

  const handleShareProducts = () => {
    const shareClient = buildShareClient(lead);
    handleClose();
    navigate('/products', { state: { shareClient } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.status) { toast.error('Enquiry Received Status is required'); return; }
    if (!formData.customerStatus) { toast.error('Customer Status is required'); return; }
    if (!formData.customerSaid.trim()) { toast.error('What did Customer said is required'); return; }

    let finalProductType = formData.productType;
    if ((isRealEstate || isMutualFund) && isOtherValue(formData.productType)) {
      if (!formData.customProductType?.trim()) {
        toast.error('Please enter the new product type');
        return;
      }
      finalProductType = formData.customProductType.trim();
    }

    let finalInsuranceType = formData.insuranceType;
    if (isInsurance && isOtherValue(formData.insuranceType)) {
      if (!formData.customInsuranceType?.trim()) {
        toast.error('Please enter the new product type');
        return;
      }
      finalInsuranceType = formData.customInsuranceType.trim();
    }

    let finalRequirement = formData.requirement;
    if (isRealEstate && isOtherValue(formData.requirementOption || formData.requirement)) {
      if (!formData.customRequirement?.trim()) {
        toast.error('Please enter the new requirement');
        return;
      }
      finalRequirement = formData.customRequirement.trim();
    }

    let finalInsuranceSubType = formData.insuranceSubType;
    if (isInsurance && isOtherValue(formData.insuranceSubType)) {
      if (!formData.customInsuranceSubType?.trim()) {
        toast.error('Please enter the new sub product type');
        return;
      }
      finalInsuranceSubType = formData.customInsuranceSubType.trim();
    }

    setLoading(true);

    try {
      if (isRealEstate && isOtherValue(formData.productType) && finalProductType) {
        const exists = (realEstateProductsList || []).some(
          p => p.productType?.toLowerCase().trim() === finalProductType.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveRealEstateProduct({ productType: finalProductType });
          } catch (err) {
            console.error('Failed to save new real estate product to master:', err);
          }
        }
      }

      if (isMutualFund && isOtherValue(formData.productType) && finalProductType) {
        const exists = (mutualFundProductsList || []).some(
          p => p.productType?.toLowerCase().trim() === finalProductType.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveMutualFundProduct({ productType: finalProductType });
          } catch (err) {
            console.error('Failed to save new mutual fund product to master:', err);
          }
        }
      }

      if (isInsurance && isOtherValue(formData.insuranceType) && finalInsuranceType) {
        const exists = (insuranceProductsList || []).some(
          p => p.productType?.toLowerCase().trim() === finalInsuranceType.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveInsuranceProduct({ productType: finalInsuranceType });
          } catch (err) {
            console.error('Failed to save new insurance product to master:', err);
          }
        }
      }

      if (isRealEstate && isOtherValue(formData.requirementOption || formData.requirement) && finalRequirement) {
        const exists = (requirementsList || []).some(
          r => r.requirement?.toLowerCase().trim() === finalRequirement.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveRealEstateRequirement({ requirement: finalRequirement });
          } catch (err) {
            console.error('Failed to save new real estate requirement to master:', err);
          }
        }
      }

      if (isInsurance && isOtherValue(formData.insuranceSubType) && finalInsuranceSubType) {
        const exists = (insuranceSubProductsList || []).some(
          s => s.subProductType?.toLowerCase().trim() === finalInsuranceSubType.toLowerCase() &&
               s.productType?.toLowerCase().trim() === finalInsuranceType.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveInsuranceSubProduct({
              productType: finalInsuranceType,
              subProductType: finalInsuranceSubType
            });
          } catch (err) {
            console.error('Failed to save new insurance sub product to master:', err);
          }
        }
      }

      // 1. Persist any editable-field changes back to the lead itself
      const updates = {};
      if (formData.investmentBudget !== (lead.investmentBudget || '')) updates.investmentBudget = formData.investmentBudget;
      if (formData.whenToBuyPlan !== (lead.whenToBuyPlan || '')) updates.whenToBuyPlan = formData.whenToBuyPlan;

      if (isRealEstate) {
        const reqToSave = isOtherValue(formData.requirementOption || formData.requirement) ? finalRequirement : formData.requirement;
        const prodToSave = isOtherValue(formData.productType) ? finalProductType : formData.productType;
        if (reqToSave !== (lead.requirement || '')) updates.requirement = reqToSave;
        if (prodToSave !== (lead.productType || '')) updates.productType = prodToSave;
      } else if (isMutualFund) {
        const prodToSave = isOtherValue(formData.productType) ? finalProductType : formData.productType;
        if (prodToSave !== (lead.productType || '')) updates.productType = prodToSave;
      } else if (isInsurance) {
        const insTypeToSave = isOtherValue(formData.insuranceType) ? finalInsuranceType : formData.insuranceType;
        const subToSave = isOtherValue(formData.insuranceSubType) ? finalInsuranceSubType : formData.insuranceSubType;
        if (insTypeToSave !== (lead.insuranceType || '')) updates.insuranceType = insTypeToSave;
        if (subToSave !== (lead.insuranceSubType || '')) updates.insuranceSubType = subToSave;
      }

      if (Object.keys(updates).length > 0) {
        await leadApi.updateLead(lead.id || lead.leadNo, updates);
      }

      // 2. Save the call tracker entry
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const entry = {
        leadId: lead.id,
        leadNo: lead.leadNo,
        status: formData.status,
        customerStatus: formData.customerStatus,
        customerSaid: formData.customerSaid,
        nextDate: DATE_STATUSES.includes(formData.status) ? formData.nextDate : '',
        timestamp,
        timestampMs: now.getTime()
      };

      await callTrackerApi.saveCallTracker(entry);

      // 3. Save assigned visitor and visitor follow-up with hierarchy (parent_id) and visit_meet JSON if status is Site Visit/Meeting
      if (formData.status === 'Site Visit/Meeting') {
        const chosenVisitorName = formData.assignedVisitor || lead.assignedVisitor || user?.name || '';
        const matchedVisitor = (visitorsList || []).find(
          v => String(v.personName || v.name || v.visitorName || '').trim().toLowerCase() === chosenVisitorName.trim().toLowerCase()
        );
        const matchedVisitorId = matchedVisitor?.id || (chosenVisitorName === user?.name ? user?.id : '');
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const visitDate = formData.nextDate || todayStr;

        // Auto save assigned visitor
        let savedAssignment = null;
        try {
          savedAssignment = await siteVisitMeetingApi.saveAssignedVisitor({
            leadId: lead.id,
            leadNo: lead.leadNo,
            visitorName: chosenVisitorName,
            visitorId: matchedVisitorId,
            visitDate: visitDate,
            location: lead.location || lead.customerAddress || '',
            remarks: formData.customerSaid || '',
            status: 'Assigned',
            assignedBy: user?.name || ''
          });
        } catch (assignErr) {
          console.warn('Could not auto-save assigned visitor from FormTracker:', assignErr);
        }

        try {
          const visitMeet = {
            'site-visit': Boolean(formData.siteVisited),
            'meeting': Boolean(formData.meeting)
          };
          const existingFollowUps = await siteVisitMeetingApi.getVisitorFollowUpsByLeadId(lead.id, lead.leadNo);
          const previousFollowUp = existingFollowUps && existingFollowUps.length > 0 ? existingFollowUps[existingFollowUps.length - 1] : null;
          const parentId = (previousFollowUp?.id && siteVisitMeetingApi.isUuid(previousFollowUp.id)) ? previousFollowUp.id : null;
          const followUpNo = (existingFollowUps?.length || 0) + 1;
          const closingAmt = formData.dealStatus === 'Closed' ? (formData.exactBudget || formData.investmentBudget || '') : '';
          const mappedStatus = formData.dealStatus === 'Closed' ? 'Closed Won' : (formData.dealStatus === 'Not Interested' ? 'Not Interested' : 'Interested');

          await siteVisitMeetingApi.saveVisitorFollowUp({
            leadId: lead.id,
            leadNo: lead.leadNo,
            assignedVisitorId: savedAssignment?.id || null,
            parentId: parentId,
            parent_id: parentId,
            status: mappedStatus,
            dealOutcome: formData.dealStatus || 'Pending',
            deal_outcome: formData.dealStatus || 'Pending',
            closingAmount: closingAmt,
            closing_amount: closingAmt,
            visitMeet,
            visit_meet: visitMeet,
            visitDate: visitDate,
            whatHappened: formData.customerSaid || 'Followup call logged with Site Visit/Meeting',
            customerStatus: formData.customerStatus || lead.customerStatus || 'Hot',
            salesExecutive: chosenVisitorName || lead.callerAssigned || lead.leadReceiver || user?.name || '',
            visitorName: chosenVisitorName,
            visitorId: matchedVisitorId,
            followUpNo: followUpNo
          });
        } catch (visitErr) {
          console.error('Could not auto-save visitor follow-up from FormTracker:', visitErr);
        }
      }

      const isTerminal = TERMINAL_STATUSES.includes(formData.status);
      toast.success(
        isTerminal
          ? `Lead ${lead.leadNo} marked as ${formData.status} and removed from pending.`
          : `Lead ${lead.leadNo} updated (${formData.status}). It stays in pending.`
      );

      setFormData({ ...initialFormState });
      setLoading(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save call log:', err);
      toast.error('Failed to save call log');
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title={`Followup Call - ${lead.personName || lead.customerName || 'Lead'}${lead.leadNo ? ` (${lead.leadNo})` : ''}`}
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Save Followup'}
      loading={loading}
      maxWidth="max-w-2xl"
    >
      {/* Share Products — opens the Products page filtered to this client's lead type */}
      <div className="flex justify-end -mt-1 mb-1">
        <button
          type="button"
          onClick={handleShareProducts}
          title={`Share ${lead.leadType || ''} products with ${lead.personName || lead.customerName || 'this client'}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition active:scale-95"
        >
          <Share2 size={13} />
          <span>Share Products</span>
        </button>
      </div>

      {/* Lead Details Read-Only Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs mb-2">
        {infoFields.map(f => (
          <div key={f.key} className="space-y-0.5">
            <span className="text-[9.5px] sm:text-[10px] text-gray-500 uppercase tracking-tight font-semibold">{f.label}</span>
            <p className={`font-semibold truncate text-[11px] md:text-[12px] ${f.key === 'leadType' ? getLeadTypeTextClass(lead[f.key]) : 'text-gray-900'}`}>
              {lead[f.key] || '-'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:gap-x-3 sm:gap-y-2.5 md:gap-3.5">

        {/* REAL ESTATE: Product Type & Requirement — editable, pre-filled from the lead */}
        {isRealEstate && (
          <>
            <div className={`space-y-1 ${isOtherValue(formData.productType) ? 'col-span-2 sm:col-span-1' : 'col-span-1'} animate-in fade-in duration-200`}>
              <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Product Type</label>
              <SearchableDropdown
                options={realEstateProductOptions}
                value={formData.productType}
                onChange={(val) => handleChange('productType', val)}
                onAdd={(term) => {
                  handleChange('productType', 'Add New');
                  if (term) handleChange('customProductType', term);
                }}
                placeholder="Select product type"
              />
              {isOtherValue(formData.productType) && (
                <div className="relative mt-1 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                  <input
                    type="text"
                    autoFocus
                    ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
                    value={formData.customProductType}
                    onChange={(e) => handleChange('customProductType', e.target.value)}
                    placeholder="Enter new product type"
                    className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
            <div className={`space-y-1 ${isOtherValue(formData.requirementOption) ? 'col-span-2 sm:col-span-1' : 'col-span-1'} animate-in fade-in duration-200`}>
              <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Requirement</label>
              <SearchableDropdown
                options={requirementOptions}
                value={formData.requirementOption}
                onChange={handleRequirementOptionChange}
                onAdd={(term) => {
                  handleRequirementOptionChange('Add New');
                  if (term) handleCustomRequirementChange(term);
                }}
                placeholder="Select requirement"
              />
              {isOtherValue(formData.requirementOption) && (
                <div className="relative mt-1 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                  <input
                    type="text"
                    autoFocus
                    ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
                    value={formData.customRequirement}
                    onChange={(e) => handleCustomRequirementChange(e.target.value)}
                    placeholder="Enter new requirement"
                    className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* MUTUAL FUND: Product Type — editable, pre-filled from the lead */}
        {isMutualFund && (
          <div className={`space-y-1 ${isOtherValue(formData.productType) ? 'col-span-2 sm:col-span-1' : 'col-span-1'} animate-in fade-in duration-200`}>
            <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Product Type</label>
            <SearchableDropdown
              options={mutualFundProductOptions}
              value={formData.productType}
              onChange={(val) => handleChange('productType', val)}
              onAdd={(term) => {
                handleChange('productType', 'Add New');
                if (term) handleChange('customProductType', term);
              }}
              placeholder="Select product type"
            />
            {isOtherValue(formData.productType) && (
              <div className="relative mt-1 animate-in fade-in duration-200">
                <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  autoFocus
                  ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
                  value={formData.customProductType}
                  onChange={(e) => handleChange('customProductType', e.target.value)}
                  placeholder="Enter new product type"
                  className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                />
              </div>
            )}
          </div>
        )}

        {/* INSURANCE: Product Type & Sub Product Type — editable, pre-filled from the lead */}
        {isInsurance && (
          <>
            <div className={`space-y-1 ${isOtherValue(formData.insuranceType) ? 'col-span-2 sm:col-span-1' : 'col-span-1'} animate-in fade-in duration-200`}>
              <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Product Type</label>
              <SearchableDropdown
                options={insuranceProductOptions}
                value={formData.insuranceType}
                onChange={(val) => handleChange('insuranceType', val)}
                onAdd={(term) => {
                  handleChange('insuranceType', 'Add New');
                  if (term) handleChange('customInsuranceType', term);
                }}
                placeholder="Select product type"
              />
              {isOtherValue(formData.insuranceType) && (
                <div className="relative mt-1 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                  <input
                    type="text"
                    autoFocus
                    ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
                    value={formData.customInsuranceType}
                    onChange={(e) => handleChange('customInsuranceType', e.target.value)}
                    placeholder="Enter new product type"
                    className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>

            <div className={`space-y-1 ${isOtherValue(formData.insuranceSubType) ? 'col-span-2 sm:col-span-1' : 'col-span-1'} animate-in fade-in duration-200`}>
              <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Sub Product Type</label>
              <SearchableDropdown
                options={insuranceSubProductOptions}
                value={formData.insuranceSubType}
                onChange={(val) => handleChange('insuranceSubType', val)}
                onAdd={(term) => {
                  handleChange('insuranceSubType', 'Add New');
                  if (term) handleChange('customInsuranceSubType', term);
                }}
                placeholder={`Select ${isOtherValue(formData.insuranceType) ? (formData.customInsuranceType || 'product') : formData.insuranceType} sub type`}
              />
              {isOtherValue(formData.insuranceSubType) && (
                <div className="relative mt-1 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                  <input
                    type="text"
                    autoFocus
                    ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
                    value={formData.customInsuranceSubType}
                    onChange={(e) => handleChange('customInsuranceSubType', e.target.value)}
                    placeholder="Enter new sub product type"
                    className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Investment Budget — editable, pre-filled from the lead, every lead type */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Investment Budget</label>
          <SearchableDropdown
            options={investmentBudgetOptions}
            value={formData.investmentBudget}
            onChange={(val) => handleChange('investmentBudget', val)}
            placeholder="Select investment budget"
          />
        </div>

        {/* When to Buy Plan — editable, pre-filled from the lead, every lead type */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">When to Buy Plan</label>
          <div className="relative">
            <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              value={formData.whenToBuyPlan}
              onChange={(e) => handleChange('whenToBuyPlan', e.target.value)}
              placeholder="e.g. Immediate / 3 Months"
              className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Enquiry Received Status */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Status *</label>
          <SearchableDropdown
            options={ENQUIRY_STATUSES.map(v => ({ value: v, label: v }))}
            value={formData.status}
            onChange={(val) => handleChange('status', val)}
            placeholder="Select status"
          />
        </div>

        {/* Customer Status (Hot / Warm / Cold) */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Customer Status *</label>
          <SearchableDropdown
            options={CUSTOMER_STATUSES.map(v => ({ value: v, label: v }))}
            value={formData.customerStatus}
            onChange={(val) => handleChange('customerStatus', val)}
            placeholder="Select Hot / Warm / Cold"
          />
        </div>

        {formData.status && (
          <>
            {/* Date — Future Plan Date's next-call date, or the Site Visit/Meeting date */}
            {DATE_STATUSES.includes(formData.status) && (
              <div className="space-y-1 col-span-1 animate-in fade-in duration-200">
                <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">
                  {formData.status === 'Future Plan Date' ? 'Future Plan Date' : 'Visit/Meeting Date'}
                </label>
                <input
                  type="date"
                  value={formData.nextDate}
                  onChange={(e) => handleChange('nextDate', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] [color-scheme:light]"
                />
              </div>
            )}

            {/* When status is Site Visit/Meeting: Checkboxes (Site Visited, Meeting), Deal Status dropdown, Assigned Visitor, and Budget */}
            {formData.status === 'Site Visit/Meeting' && (
              <div className="space-y-3 col-span-2 p-2.5 sm:p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 items-center">
                  {/* Checkboxes: Site Visited & Meeting */}
                  <div className="space-y-1">
                    <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">
                      Visit / Meeting Type
                    </label>
                    <div className="flex items-center gap-4 pt-1">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.siteVisited}
                          onChange={(e) => handleChange('siteVisited', e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span>Site Visited</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.meeting}
                          onChange={(e) => handleChange('meeting', e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span>Meeting</span>
                      </label>
                    </div>
                  </div>

                  {/* Deal Status Dropdown */}
                  <div className="space-y-1">
                    <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">
                      Deal Status
                    </label>
                    <SearchableDropdown
                      options={DEAL_STATUS_OPTIONS}
                      value={formData.dealStatus || 'Pending'}
                      onChange={(val) => handleChange('dealStatus', val)}
                      placeholder="Select deal status"
                      height="h-[30px] md:h-[34px]"
                    />
                  </div>

                  {/* Assigned Visitor Dropdown */}
                  <div className="space-y-1">
                    <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">
                      Assigned Visitor *
                    </label>
                    <SearchableDropdown
                      options={visitorOptions}
                      value={formData.assignedVisitor || lead.assignedVisitor || user?.name || ''}
                      onChange={(val) => handleChange('assignedVisitor', val)}
                      placeholder="Select assigned visitor"
                      height="h-[30px] md:h-[34px]"
                    />
                  </div>
                </div>

                {/* Exact Budget text field if Deal is Closed */}
                {formData.dealStatus === 'Closed' && (
                  <div className="space-y-1 pt-1 animate-in fade-in duration-150">
                    <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-emerald-800 uppercase tracking-tight font-bold">
                      Closing Budget / Exact Budget *
                    </label>
                    <div className="relative">
                      <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600" size={13} />
                      <input
                        type="text"
                        value={formData.exactBudget}
                        onChange={(e) => handleChange('exactBudget', e.target.value)}
                        placeholder="Enter exact closing budget (e.g. 50 Lakh / 50,00,000)"
                        className="w-full border border-emerald-300 bg-white rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] font-semibold text-emerald-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* What did Customer said — asked for every status */}
            <div className="space-y-1 col-span-2">
              <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">What did Customer said *</label>
              <div className="relative">
                <MessageSquare className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
                <textarea
                  value={formData.customerSaid}
                  onChange={(e) => handleChange('customerSaid', e.target.value)}
                  placeholder="Enter what the customer said"
                  rows={2}
                  className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] resize-none"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </ModalForm>
  );
}
