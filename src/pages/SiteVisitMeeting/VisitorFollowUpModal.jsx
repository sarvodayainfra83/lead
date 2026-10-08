import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { MessageSquare, Calendar, X, CheckCircle, Clock, Share2, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { authApi } from '../../api/authApi';
import { masterApi } from '../../api/masterApi';
import { leadApi } from '../../api/leadApi';
import SearchableDropdown from '../../components/SearchableDropdown';
import {
  formatInputDate,
  CUSTOMER_STATUS_OPTIONS,
  DEFAULT_BUDGET_RANGES
} from './siteVisitMeetingConstants';
import { getLeadTypeBadgeClass, getLeadTypeTextClass } from '../../utils/leadTypeColors';
import { getLeadCategory, getUserLeadCategories } from '../../utils/authUtils';
import { getInvestmentBudgetsForLeadType } from '../Lead/leadConstants';
import { tomorrowInputDate } from '../CallTracker/callTrackerConstants';
import { buildShareClient } from '../../utils/productShare';

const VISITOR_STATUS_OPTIONS = [
  'Deal Lock',
  'Future Plan',
  'Not Interested',
  'Did Not Show',
  'Under Negotiation',
  'Call Not Received',
  'No WhatsApp Reply'
];

// Customer couldn't be reached (call not picked up / WhatsApp unanswered): only the retry date is needed
const NO_CONTACT_STATUSES = ['Call Not Received', 'No WhatsApp Reply'];

// Outcomes that need a next visit / follow-up date
const NEXT_DATE_STATUSES = ['Future Plan', 'Did Not Show', 'Under Negotiation', ...NO_CONTACT_STATUSES];

const isOtherValue = (val) => {
  if (!val) return false;
  const lower = String(val).toLowerCase().trim();
  return lower === 'other' || lower === 'others' || lower === 'add new' || lower === 'add_new' || lower === '+ add new';
};

const resolveInitialCustomerStatus = (lead) => {
  const raw = lead?.latestFollowUp?.customerStatus || lead?.latestFollowUp?.customer_status || lead?.customerStatus || lead?.interestLevel || '';
  const s = String(raw).trim().toLowerCase();
  if (s === 'hot' || s === 'high') return 'Hot';
  if (s === 'warm' || s === 'medium') return 'Warm';
  if (s === 'cold' || s === 'low') return 'Cold';
  return 'Warm';
};

const resolveInitialVisitMeet = (lead) => {
  const isRealEstate = !lead?.leadType || lead?.leadType?.toLowerCase().includes('real') || (lead?.leadNo || '').toUpperCase().startsWith('LR');

  if (!isRealEstate) {
    return { 'site-visit': false, meeting: true };
  }

  // Find latest previous follow-up with visitMeet
  const previousFollowUps = lead?.followUps || [];
  const prevWithActivity = [...previousFollowUps].reverse().find(f => {
    const vm = f?.visitMeet || f?.visit_meet;
    if (!vm) return false;
    const sv = vm['site-visit'] ?? vm.siteVisit ?? vm.site_visit;
    const mt = vm.meeting;
    return Boolean(sv || mt);
  });

  const vm = lead?.latestFollowUp?.visitMeet
    || lead?.latestFollowUp?.visit_meet
    || prevWithActivity?.visitMeet
    || prevWithActivity?.visit_meet
    || lead?.visitMeet
    || lead?.visit_meet;

  if (vm) {
    const hasSiteVisit = Boolean(vm['site-visit'] ?? vm.siteVisit ?? vm.site_visit);
    const hasMeeting = Boolean(vm.meeting);

    if (hasSiteVisit && !hasMeeting) {
      return { 'site-visit': true, meeting: false };
    }
    if (hasMeeting && !hasSiteVisit) {
      return { 'site-visit': false, meeting: true };
    }
    if (hasSiteVisit) {
      return { 'site-visit': true, meeting: false };
    }
  }

  // If lead had siteVisited or meeting flags directly
  if (lead?.siteVisited || lead?.site_visited) {
    return { 'site-visit': true, meeting: false };
  }
  if (lead?.meeting) {
    return { 'site-visit': false, meeting: true };
  }

  // Default fallback for Real Estate: Site Visited
  return { 'site-visit': true, meeting: false };
};

const getLeadFieldVal = (lead, key) => {
  if (!lead) return '-';
  if (key === 'personName') return lead.personName || lead.customerName || '-';
  if (key === 'number') return lead.number || lead.customerNumber || '-';
  if (key === 'email') return lead.email || lead.customerEmail || '-';
  if (key === 'location') return lead.location || lead.customerAddress || '-';
  if (key === 'leadReceiver') return lead.leadReceiver || lead.relationshipManager || lead.callerAssigned || '-';
  if (key === 'callerAssigned') return lead.callerAssigned || lead.leadReceiver || '-';
  return lead[key] || '-';
};

export default function VisitorFollowUpModal({ isOpen, onClose, lead, onSaved }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [leadTypes, setLeadTypes] = useState([]);
  const [requirementsList, setRequirementsList] = useState([]);
  const [realEstateProductsList, setRealEstateProductsList] = useState([]);
  const [mutualFundProductsList, setMutualFundProductsList] = useState([]);
  const [insuranceProductsList, setInsuranceProductsList] = useState([]);
  const [insuranceSubProductsList, setInsuranceSubProductsList] = useState([]);

  const isRealEstate =
    !lead?.leadType ||
    (lead?.leadType || '').trim().toLowerCase().includes('real') ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LR');
  const isMutualFund =
    (lead?.leadType || '').trim().toLowerCase().includes('mutual') ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LM');
  const isInsurance =
    (lead?.leadType || '').trim().toLowerCase().includes('insurance') ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LI');

  const [formData, setFormData] = useState({
    status: '',
    customerStatus: 'Warm',
    whatHappened: '',
    nextVisitDate: '',
    // Product / Requirement Details
    requirement: '',
    requirementOption: '',
    customRequirement: '',
    productType: '',
    customProductType: '',
    insuranceType: '',
    customInsuranceType: '',
    insuranceSubType: '',
    customInsuranceSubType: '',
    investmentBudget: '',
    whenToBuyPlan: '',
    // Deal Details (Deal Lock only)
    closingAmount: '',
    salesExecutive: '',
    referenceNo: ''
  });

  const [visitMeet, setVisitMeet] = useState({
    'site-visit': false,
    meeting: false
  });

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      Promise.all([
        authApi.getUsers().catch(() => []),
        masterApi.getInvestmentBudgets().catch(() => []),
        masterApi.getLeadTypes().catch(() => []),
        masterApi.getRealEstateRequirements().catch(() => []),
        masterApi.getRealEstateProducts().catch(() => []),
        masterApi.getMutualFundProducts().catch(() => []),
        masterApi.getInsuranceProducts().catch(() => []),
        masterApi.getInsuranceSubProducts().catch(() => [])
      ]).then(([userList, budgetList, leadTypeList, requirements, reProducts, mfProducts, insProducts, insSubProducts]) => {
        if (isMounted) {
          setUsers(userList || []);
          setBudgets(budgetList || []);
          setLeadTypes(leadTypeList || []);
          setRequirementsList(requirements || []);
          setRealEstateProductsList(reProducts || []);
          setMutualFundProductsList(mfProducts || []);
          setInsuranceProductsList(insProducts || []);
          setInsuranceSubProductsList(insSubProducts || []);
        }
      }).catch(console.error);
    }
    return () => { isMounted = false; };
  }, [isOpen]);

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

      const matchProduct = (list, raw) => list.find(o => !isOtherValue(o.productType) && o.productType.toLowerCase() === raw.toLowerCase())?.productType || raw;
      const productValue = isProductPreset ? matchProduct(masterProductList, rawProduct) : rawProduct;
      const insValue = isInsPreset ? matchProduct(insuranceProductsList, rawIns) : rawIns;
      const subValue = isSubPreset
        ? (insuranceSubProductsList.find(o => !isOtherValue(o.subProductType) && o.subProductType.toLowerCase() === rawSub.toLowerCase())?.subProductType || rawSub)
        : rawSub;
      const reqValue = isReqPreset
        ? (requirementsList.find(r => r.requirement.toLowerCase() === req.toLowerCase())?.requirement || req)
        : req;

      const initialStatus = '';
      const initialClosingAmount = lead.latestFollowUp?.closingAmount || lead.closingAmount || lead.investmentBudget || '';
      const initialSalesExecutive = lead.latestFollowUp?.salesExecutive || lead.salesExecutive || lead.assignedVisitor || '';
      const initialRef = lead.latestFollowUp?.referenceNo || lead.referenceNo || '';

      setFormData({
        status: initialStatus,
        customerStatus: resolveInitialCustomerStatus(lead),
        whatHappened: '',
        nextVisitDate: formatInputDate(lead.nextVisitDate || ''),
        requirement: reqValue,
        requirementOption: reqValue,
        customRequirement: '',
        productType: productValue,
        customProductType: '',
        insuranceType: insValue,
        customInsuranceType: '',
        insuranceSubType: subValue,
        customInsuranceSubType: '',
        investmentBudget: lead.investmentBudget || '',
        whenToBuyPlan: lead.whenToBuyPlan || '',
        closingAmount: initialClosingAmount,
        salesExecutive: initialSalesExecutive,
        referenceNo: initialRef
      });
      setVisitMeet(resolveInitialVisitMeet(lead));
    }
  }, [lead, isOpen, requirementsList, realEstateProductsList, mutualFundProductsList, insuranceProductsList, insuranceSubProductsList, isRealEstate, isMutualFund, isInsurance]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Unanswered call / WhatsApp: next follow-up defaults to tomorrow (the user can pick another date)
      if (field === 'status' && NO_CONTACT_STATUSES.includes(value) && (!NO_CONTACT_STATUSES.includes(prev.status) || !prev.nextVisitDate)) {
        next.nextVisitDate = tomorrowInputDate();
      }
      if (field === 'productType' && !isOtherValue(value)) {
        next.customProductType = '';
      }
      if (field === 'insuranceType') {
        if (!isOtherValue(value)) {
          next.customInsuranceType = '';
        }
        next.insuranceSubType = '';
        next.customInsuranceSubType = '';
      }
      if (field === 'insuranceSubType' && !isOtherValue(value)) {
        next.customInsuranceSubType = '';
      }
      return next;
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

  const withSelected = (options, value) => (
    value && !isOtherValue(value) && !options.some(o => o.value === value)
      ? [...options, { value, label: value }]
      : options
  );

  const requirementOptions = useMemo(() => {
    return withSelected((requirementsList || [])
      .filter(r => !isOtherValue(r.requirement))
      .map(r => ({ value: r.requirement, label: r.requirement })), formData.requirementOption);
  }, [requirementsList, formData.requirementOption]);

  const realEstateProductOptions = useMemo(() => {
    return withSelected((realEstateProductsList || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType })), formData.productType);
  }, [realEstateProductsList, formData.productType]);

  const mutualFundProductOptions = useMemo(() => {
    return withSelected((mutualFundProductsList || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType })), formData.productType);
  }, [mutualFundProductsList, formData.productType]);

  const insuranceProductOptions = useMemo(() => {
    return withSelected((insuranceProductsList || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType })), formData.insuranceType);
  }, [insuranceProductsList, formData.insuranceType]);

  const insuranceSubProductOptions = useMemo(() => {
    const currentInsType = isOtherValue(formData.insuranceType)
      ? (formData.customInsuranceType || '')
      : formData.insuranceType;
    return withSelected((insuranceSubProductsList || [])
      .filter(s => !isOtherValue(s.subProductType) && s.productType?.toLowerCase().trim() === currentInsType?.toLowerCase().trim())
      .map(s => ({ value: s.subProductType, label: s.subProductType })), formData.insuranceSubType);
  }, [insuranceSubProductsList, formData.insuranceType, formData.customInsuranceType, formData.insuranceSubType]);

  const investmentBudgetOptions = useMemo(() => {
    const options = getInvestmentBudgetsForLeadType(budgets, lead?.leadType)
      .map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));
    if (formData.investmentBudget && !options.some(o => o.value === formData.investmentBudget)) {
      options.push({ value: formData.investmentBudget, label: formData.investmentBudget });
    }
    return options;
  }, [budgets, lead?.leadType, formData.investmentBudget]);

  const salesExecutiveOptions = useMemo(() => {
    const typeIdToName = {};
    (leadTypes || []).forEach(lt => {
      if (lt.id && lt.leadType) typeIdToName[String(lt.id).trim()] = lt.leadType;
    });

    const leadCategory = getLeadCategory(lead?.leadType, lead?.leadNo);
    const pool = (users || []).filter(u => {
      const typeId = String(u.leadTypeId || u.lead_type_id || '').trim();
      const userCategories = getUserLeadCategories(u.leadType || typeIdToName[typeId] || '');
      return Boolean(leadCategory) && userCategories.includes(leadCategory);
    });

    const opts = pool.map(u => ({
      value: u.name,
      label: u.position ? `${u.name} (${u.position})` : u.name
    }));

    const savedExecutive = lead?.latestFollowUp?.salesExecutive || lead?.salesExecutive;
    if (savedExecutive && !opts.some(o => o.value.toLowerCase() === savedExecutive.toLowerCase())) {
      opts.unshift({ value: savedExecutive, label: `${savedExecutive} (Current)` });
    }

    if (lead?.assignedVisitor && !opts.some(o => o.value.toLowerCase() === lead.assignedVisitor.toLowerCase())) {
      opts.unshift({
        value: lead.assignedVisitor,
        label: `${lead.assignedVisitor} (Assigned Visitor)`
      });
    }

    return opts;
  }, [users, leadTypes, lead]);

  const budgetRangeOptions = useMemo(() => {
    const names = budgets.length > 0
      ? getInvestmentBudgetsForLeadType(budgets, lead?.leadType).map(b => b.investmentBudget)
      : DEFAULT_BUDGET_RANGES;
    const seen = new Set();
    const opts = [];
    names.forEach(name => {
      const clean = String(name || '').replace(/\s+/g, ' ').trim();
      const key = clean.toLowerCase();
      if (clean && !seen.has(key)) {
        seen.add(key);
        opts.push({ value: clean, label: clean });
      }
    });
    if (lead?.investmentBudget && !opts.some(o => o.value.toLowerCase() === lead.investmentBudget.toLowerCase())) {
      opts.unshift({
        value: lead.investmentBudget,
        label: `${lead.investmentBudget} (Customer Budget)`
      });
    }
    return opts;
  }, [budgets, lead]);

  const handleShareProducts = () => {
    const shareClient = buildShareClient(lead);
    onClose();
    navigate('/products', { state: { shareClient } });
  };

  // Read-only reference fields shown in customer info grid
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

  if (!isOpen || !lead) return null;

  const statusOptions = VISITOR_STATUS_OPTIONS.map(s => ({ value: s, label: s }));
  const isNotInterested = formData.status === 'Not Interested' || formData.status?.toLowerCase().includes('not interested');
  const isNoContact = NO_CONTACT_STATUSES.includes(formData.status);
  const isActivityVisible = !isNotInterested && !isNoContact;
  const isRealEstateLead = isRealEstate;
  const isDealSectionVisible = formData.status === 'Deal Lock';
  const needsNextDate = NEXT_DATE_STATUSES.includes(formData.status);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.status) {
      toast.error('Please select a visit outcome status');
      return;
    }

    if (!isNoContact && !formData.whatHappened.trim()) {
      toast.error('Customer Feedback / What Happened is required');
      return;
    }

    if (needsNextDate && !formData.nextVisitDate) {
      toast.error('Next Visit / Follow-up Date is required');
      return;
    }

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

    let finalInsuranceSubType = formData.insuranceSubType;
    if (isInsurance && isOtherValue(formData.insuranceSubType)) {
      if (!formData.customInsuranceSubType?.trim()) {
        toast.error('Please enter the new sub product type');
        return;
      }
      finalInsuranceSubType = formData.customInsuranceSubType.trim();
    }

    let finalRequirement = formData.requirement;
    if (isRealEstate && isOtherValue(formData.requirementOption)) {
      if (!formData.customRequirement?.trim()) {
        toast.error('Please enter the new requirement');
        return;
      }
      finalRequirement = formData.customRequirement.trim();
    }

    setLoading(true);
    try {
      // 1. Update lead details (Product Type, Requirement, Budget, When to Buy Plan)
      const updates = {};
      if (formData.investmentBudget && formData.investmentBudget !== (lead.investmentBudget || '')) {
        updates.investmentBudget = formData.investmentBudget;
      }
      if (formData.whenToBuyPlan && formData.whenToBuyPlan !== (lead.whenToBuyPlan || '')) {
        updates.whenToBuyPlan = formData.whenToBuyPlan;
      }

      if (isRealEstate) {
        const prodToSave = isOtherValue(formData.productType) ? finalProductType : formData.productType;
        const reqToSave = isOtherValue(formData.requirementOption) ? finalRequirement : formData.requirement;
        if (prodToSave && prodToSave !== (lead.productType || '')) updates.productType = prodToSave;
        if (reqToSave && reqToSave !== (lead.requirement || '')) updates.requirement = reqToSave;
      } else if (isMutualFund) {
        const prodToSave = isOtherValue(formData.productType) ? finalProductType : formData.productType;
        if (prodToSave && prodToSave !== (lead.productType || '')) updates.productType = prodToSave;
      } else if (isInsurance) {
        const insTypeToSave = isOtherValue(formData.insuranceType) ? finalInsuranceType : formData.insuranceType;
        const subToSave = isOtherValue(formData.insuranceSubType) ? finalInsuranceSubType : formData.insuranceSubType;
        if (insTypeToSave && insTypeToSave !== (lead.insuranceType || '')) updates.insuranceType = insTypeToSave;
        if (subToSave && subToSave !== (lead.insuranceSubType || '')) updates.insuranceSubType = subToSave;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await leadApi.updateLead(lead.leadId || lead.id || lead.leadNo, updates);
        } catch (leadUpdateErr) {
          console.warn('Could not update lead product details:', leadUpdateErr);
        }
      }

      // 2. Save visitor follow-up
      const followUpCount = (lead.followUps?.length || 0) + 1;
      const isCloseDeal = isDealSectionVisible;
      const previousFollowUp = lead.latestFollowUp || (lead.followUps?.length > 0 ? lead.followUps[lead.followUps.length - 1] : null);
      const parentId = (previousFollowUp?.id && siteVisitMeetingApi.isUuid(previousFollowUp.id)) ? previousFollowUp.id : null;
      const finalVisitMeet = (isNotInterested || isNoContact) ? { 'site-visit': false, meeting: false } : visitMeet;

      const entry = {
        leadId: lead.leadId || lead.id,
        leadNo: lead.leadNo,
        parentId,
        parent_id: parentId,
        assignedVisitorId: lead.assignedVisitorId || null,
        visitorName: lead.assignedVisitor || '',
        visitorId: lead.visitorId || null,
        visitDate: lead.visitDate || formatInputDate(new Date()),
        visitMeet: finalVisitMeet,
        visit_meet: finalVisitMeet,
        status: formData.status,
        customerStatus: formData.customerStatus || 'Warm',
        customer_status: formData.customerStatus || 'Warm',
        interestLevel: formData.customerStatus || 'Warm',
        whatHappened: formData.whatHappened.trim(),
        nextVisitDate: needsNextDate ? formData.nextVisitDate : null,
        dealOutcome: formData.status === 'Not Interested'
          ? 'Rejected (Lost)'
          : (isCloseDeal ? 'Closed (Won)' : null),
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
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100/80 ring-1 ring-black/5 w-full max-w-2xl max-h-[90dvh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {lead.leadNo && (
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/20 font-mono">
                {lead.leadNo}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${getLeadTypeBadgeClass(lead.leadType)}`}>
              {lead.leadType || 'Real Estate'}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white truncate">
              Log Visit Follow-Up - {lead.customerName || lead.personName || 'Lead'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 text-xs">
          {/* Share Products Button */}
          <div className="flex justify-end -mt-1 mb-1">
            <button
              type="button"
              onClick={handleShareProducts}
              title={`Share ${lead.leadType || ''} products with ${lead.customerName || lead.personName || 'this client'}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition active:scale-95 cursor-pointer"
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
                <p className={`font-semibold truncate text-[11px] md:text-[12px] ${f.key === 'leadType' ? getLeadTypeTextClass(lead[f.key]) : 'text-gray-900'}`} title={getLeadFieldVal(lead, f.key)}>
                  {getLeadFieldVal(lead, f.key)}
                </p>
              </div>
            ))}
          </div>

          {/* Editable Product & Requirement Fields */}
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:gap-x-3 sm:gap-y-2.5 md:gap-3.5">
            {/* REAL ESTATE: Product Type & Requirement */}
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

            {/* MUTUAL FUND: Product Type */}
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
                      value={formData.customProductType}
                      onChange={(e) => handleChange('customProductType', e.target.value)}
                      placeholder="Enter new product type"
                      className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* INSURANCE: Product Type & Sub Product Type */}
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

            {/* Investment Budget */}
            <div className="space-y-1 col-span-1">
              <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Investment Budget</label>
              <SearchableDropdown
                options={investmentBudgetOptions}
                value={formData.investmentBudget}
                onChange={(val) => handleChange('investmentBudget', val)}
                placeholder="Select investment budget"
              />
            </div>

            {/* When to Buy Plan */}
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
          </div>

          {/* Activity Type: Site Visited & Meeting Radio Buttons */}
          {isActivityVisible && (
            <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 border border-slate-200 rounded-lg p-2 sm:p-2.5 animate-in fade-in duration-150">
              <span className="font-semibold text-gray-700 text-[11px] sm:text-xs">Activity:</span>
              {isRealEstateLead ? (
                <>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
                    <input
                      type="radio"
                      name="followUpActivityType"
                      checked={Boolean(visitMeet['site-visit'])}
                      onChange={() => setVisitMeet({ 'site-visit': true, meeting: false })}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                    />
                    <span>Site Visited</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
                    <input
                      type="radio"
                      name="followUpActivityType"
                      checked={Boolean(visitMeet.meeting) || (!visitMeet['site-visit'] && !visitMeet.meeting)}
                      onChange={() => setVisitMeet({ 'site-visit': false, meeting: true })}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                    />
                    <span>Meeting</span>
                  </label>
                </>
              ) : (
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 select-none">
                  <input
                    type="radio"
                    name="followUpActivityType"
                    checked={Boolean(visitMeet.meeting) || (!visitMeet['site-visit'] && !visitMeet.meeting)}
                    onChange={() => setVisitMeet({ 'site-visit': false, meeting: true })}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                  />
                  <span>Meeting</span>
                </label>
              )}
            </div>
          )}

          {/* Outcome Status & Customer Status */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
            <div>
              <label className="block font-semibold text-gray-700 mb-1 text-[11px] sm:text-xs">
                Visit Outcome Status <span className="text-red-500">*</span>
              </label>
              <SearchableDropdown
                options={statusOptions}
                value={formData.status}
                onChange={(val) => handleChange('status', val)}
                placeholder="Select status"
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

          {/* Next Visit Schedule (Future Plan / Did Not Show / Under Negotiation) */}
          {needsNextDate && (
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-2">
              <h4 className="font-bold text-purple-800 text-xs flex items-center gap-1.5">
                <Clock size={14} /> {isNoContact ? 'Next Call / Follow-up Date' : 'Next Visit / Follow-up Schedule'}
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

          {/* Deal Details (Deal Lock only) */}
          {isDealSectionVisible && (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/90 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                  <CheckCircle size={15} className="text-emerald-600" />
                  Deal Details
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* 1. Closing Amount (₹) / Budget in Range */}
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

                {/* 2. Sales Executive */}
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

                {/* 3. Reference / Unit No */}
                <div className="col-span-2 sm:col-span-1">
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

          {/* What Happened / Feedback (Always Required) */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1 text-[11px] sm:text-xs">
              What Happened / Customer Feedback {isNoContact ? <span className="text-gray-400 font-normal">(optional)</span> : <span className="text-red-500">*</span>}
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
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
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
