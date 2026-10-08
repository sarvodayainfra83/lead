import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail,
  Briefcase, MapPin, Clock, MessageSquare, ClipboardList, Shield, Activity, UserCheck, Share2
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import { useAuthStore } from '../../store/authStore';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { isDirectSiteVisitLead, getInvestmentBudgetsForLeadType } from './leadConstants';

export default function LeadEdit({ isOpen, onClose, lead, onUpdated }) {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    leadType: '',
    leadReceiver: '',
    leadSource: '',
    customLeadSource: '',
    referencerName: '',
    customerName: '',
    customerNumber: '',
    customerEmail: '',
    dob: '',
    occupation: '',
    investmentBudget: '',
    customInvestmentBudget: '',
    customerAddress: '',
    whenToBuyPlan: '',
    callerAssigned: '',
    // Real Estate / Mutual Fund field — Product Type master, filtered by Lead Type
    productType: '',
    customProductType: '',
    // Real Estate fields
    requirement: '',
    requirementOption: '',
    customRequirement: '',
    // Insurance fields
    insuranceType: 'Life Insurance',
    customInsuranceType: '',
    insuranceSubType: '',
    customInsuranceSubType: '',
    anyDesease: '',
    remarks: ''
  });

  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [leadSourcesMaster, setLeadSourcesMaster] = useState([]);
  const [leadReceiversMaster, setLeadReceiversMaster] = useState([]);
  const [callerNamesMaster, setCallerNamesMaster] = useState([]);
  const [realEstateProductsMaster, setRealEstateProductsMaster] = useState([]);
  const [realEstateRequirementsMaster, setRealEstateRequirementsMaster] = useState([]);
  const [mutualFundProductsMaster, setMutualFundProductsMaster] = useState([]);
  const [insuranceProductsMaster, setInsuranceProductsMaster] = useState([]);
  const [insuranceSubProductsMaster, setInsuranceSubProductsMaster] = useState([]);
  const [investmentBudgetsMaster, setInvestmentBudgetsMaster] = useState([]);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        masterApi.getLeadTypes(),
        masterApi.getLeadSources(),
        masterApi.getLeadReceivers(),
        masterApi.getCallerNames(),
        masterApi.getRealEstateProducts(),
        masterApi.getRealEstateRequirements(),
        masterApi.getMutualFundProducts(),
        masterApi.getInsuranceProducts(),
        masterApi.getInsuranceSubProducts(),
        masterApi.getInvestmentBudgets()
      ]).then(([types, sources, receivers, callers, reProducts, reRequirements, mfProducts, insProducts, insSubProducts, budgets]) => {
        setLeadTypesMaster(types);
        setLeadSourcesMaster(sources);
        setLeadReceiversMaster(receivers);
        setCallerNamesMaster(callers);
        setRealEstateProductsMaster(reProducts);
        setRealEstateRequirementsMaster(reRequirements);
        setMutualFundProductsMaster(mfProducts);
        setInsuranceProductsMaster(insProducts);
        setInsuranceSubProductsMaster(insSubProducts);
        setInvestmentBudgetsMaster(budgets);
      });
    }
  }, [isOpen]);

  const isOtherValue = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    return lower === 'other' || lower === 'others' || lower === 'add new' || lower === 'add_new' || lower === '+ add new';
  };

  const leadTypeOptions = leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }));
  const leadSourceOptions = useMemo(() => {
    return (leadSourcesMaster || [])
      .filter(s => !isOtherValue(s.leadSource))
      .map(s => ({ value: s.leadSource, label: s.leadSource }));
  }, [leadSourcesMaster]);

  const selectedLeadTypeObj = leadTypesMaster.find(t => 
    t.leadType?.toLowerCase().trim() === formData.leadType?.toLowerCase().trim()
  );
  const selectedLeadTypeId = selectedLeadTypeObj?.id;

  const receiverOptions = useMemo(() => {
    const allMembers = leadReceiversMaster || [];
    const filtered = allMembers.filter(r => {
      if (!formData.leadType) return true;
      if (selectedLeadTypeId && (r.leadTypeId === selectedLeadTypeId || r.lead_type_id === selectedLeadTypeId)) return true;
      const rType = String(r.leadType || '').toLowerCase().trim();
      const targetType = String(formData.leadType || '').toLowerCase().trim();
      if (rType && targetType && (rType === targetType || rType.includes(targetType) || targetType.includes(rType))) return true;
      return false;
    });
    const pool = filtered.length > 0 ? filtered : allMembers;
    return Array.from(
      new Set(pool.map(r => r.personName || r.name).filter(Boolean))
    ).map(name => ({ value: name, label: name }));
  }, [leadReceiversMaster, formData.leadType, selectedLeadTypeId]);

  const callerOptions = useMemo(() => {
    const allCallers = callerNamesMaster || [];
    const filtered = allCallers.filter(c => {
      if (!formData.leadType) return true;
      if (selectedLeadTypeId && (c.leadTypeId === selectedLeadTypeId || c.lead_type_id === selectedLeadTypeId)) return true;
      const cType = String(c.leadType || '').toLowerCase().trim();
      const targetType = String(formData.leadType || '').toLowerCase().trim();
      if (cType && targetType && (cType === targetType || cType.includes(targetType) || targetType.includes(cType))) return true;
      return false;
    });
    const pool = filtered.length > 0 ? filtered : allCallers;
    return Array.from(
      new Set(pool.map(c => c.personName || c.name).filter(Boolean))
    ).map(name => ({ value: name, label: name }));
  }, [callerNamesMaster, formData.leadType, selectedLeadTypeId]);

  const isRealEstate = formData.leadType === 'Real Estate';
  const isInsurance = formData.leadType === 'Insurance' || formData.leadType?.toLowerCase().includes('insurance');
  const isMutualFund = formData.leadType === 'Mutual Fund';
  const isReferenceSource = formData.leadSource?.toLowerCase() === 'reference';

  const realEstateProductOptions = useMemo(() => {
    return (realEstateProductsMaster || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType }));
  }, [realEstateProductsMaster]);

  const realEstateRequirementOptions = useMemo(() => {
    return (realEstateRequirementsMaster || [])
      .filter(t => !isOtherValue(t.requirement))
      .map(t => ({ value: t.requirement, label: t.requirement }));
  }, [realEstateRequirementsMaster]);

  const mutualFundProductOptions = useMemo(() => {
    return (mutualFundProductsMaster || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType }));
  }, [mutualFundProductsMaster]);

  const insuranceProductOptions = useMemo(() => {
    return (insuranceProductsMaster || [])
      .filter(t => !isOtherValue(t.productType))
      .map(t => ({ value: t.productType, label: t.productType }));
  }, [insuranceProductsMaster]);

  const insuranceSubProductOptions = useMemo(() => {
    const currentInsType = isOtherValue(formData.insuranceType)
      ? (formData.customInsuranceType || '')
      : formData.insuranceType;
    return (insuranceSubProductsMaster || [])
      .filter(s => !isOtherValue(s.subProductType) && s.productType?.toLowerCase().trim() === currentInsType?.toLowerCase().trim())
      .map(s => ({ value: s.subProductType, label: s.subProductType }));
  }, [insuranceSubProductsMaster, formData.insuranceType, formData.customInsuranceType]);

  const investmentBudgetOptions = useMemo(() => {
    const options = getInvestmentBudgetsForLeadType(investmentBudgetsMaster, formData.leadType)
      .filter(t => !isOtherValue(t.investmentBudget))
      .map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));
    // Keep the lead's saved budget selectable even if it isn't tagged for this lead type
    if (formData.investmentBudget && !isOtherValue(formData.investmentBudget) && !options.some(o => o.value === formData.investmentBudget)) {
      options.push({ value: formData.investmentBudget, label: formData.investmentBudget });
    }
    return options;
  }, [investmentBudgetsMaster, formData.leadType, formData.investmentBudget]);

  const wasOpenRef = useRef(false);
  const lastLeadIdRef = useRef(null);

  // Populate form only when the modal opens with a new lead
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

      const rawSource = (lead.leadSource || '').trim();
      const isSourcePreset = rawSource && leadSourcesMaster.some(
        opt => opt.leadSource.toLowerCase() === rawSource.toLowerCase()
      );

      const targetLeadType = lead.leadType || user?.leadType || '';
      const isLeadRealEstate = targetLeadType === 'Real Estate';
      const isLeadMutualFund = targetLeadType === 'Mutual Fund';
      const isLeadInsurance = targetLeadType === 'Insurance' || targetLeadType?.toLowerCase().includes('insurance');

      const rawProduct = (lead.productType || '').trim();
      const masterProductList = isLeadRealEstate ? realEstateProductsMaster : (isLeadMutualFund ? mutualFundProductsMaster : []);
      const isProductPreset = rawProduct && masterProductList.some(
        opt => !isOtherValue(opt.productType) && opt.productType.toLowerCase() === rawProduct.toLowerCase()
      );

      const rawIns = (lead.insuranceType || lead.productType || '').trim();
      const isInsPreset = rawIns && insuranceProductsMaster.some(
        opt => !isOtherValue(opt.productType) && opt.productType.toLowerCase() === rawIns.toLowerCase()
      );

      const rawSub = (lead.insuranceSubType || '').trim();
      const isSubPreset = rawSub && insuranceSubProductsMaster.some(
        opt => !isOtherValue(opt.subProductType) && opt.subProductType.toLowerCase() === rawSub.toLowerCase()
      );

      const req = (lead.requirement || '').trim();
      const isReqPreset = req && realEstateRequirementsMaster.some(
        opt => !isOtherValue(opt.requirement) && opt.requirement.toLowerCase() === req.toLowerCase()
      );

      const rawBudget = (lead.investmentBudget || '').trim();
      const isBudgetPreset = rawBudget && investmentBudgetsMaster.some(
        opt => !isOtherValue(opt.investmentBudget) && opt.investmentBudget.toLowerCase() === rawBudget.toLowerCase()
      );

      setFormData({
        leadType: targetLeadType,
        leadReceiver: lead.leadReceiver || '',
        leadSource: isSourcePreset ? rawSource : (rawSource ? 'Add New' : ''),
        customLeadSource: isSourcePreset ? '' : rawSource,
        referencerName: lead.referencerName || '',
        customerName: lead.customerName || lead.personName || '',
        customerNumber: lead.customerNumber || lead.number || '',
        customerEmail: lead.customerEmail || lead.email || '',
        dob: lead.dob || '',
        occupation: lead.occupation || '',
        investmentBudget: isBudgetPreset ? rawBudget : (rawBudget ? 'Add New' : ''),
        customInvestmentBudget: isBudgetPreset ? '' : rawBudget,
        customerAddress: lead.customerAddress || lead.location || '',
        whenToBuyPlan: lead.whenToBuyPlan || '',
        callerAssigned: lead.callerAssigned || '',
        productType: isProductPreset ? rawProduct : (rawProduct ? 'Add New' : ''),
        customProductType: isProductPreset ? '' : rawProduct,
        requirement: req,
        requirementOption: isReqPreset
          ? realEstateRequirementsMaster.find(opt => opt.requirement.toLowerCase() === req.toLowerCase())?.requirement
          : (req ? 'Add New' : ''),
        customRequirement: isReqPreset ? '' : req,
        insuranceType: isInsPreset ? rawIns : (rawIns ? 'Add New' : 'Life Insurance'),
        customInsuranceType: isInsPreset ? '' : rawIns,
        insuranceSubType: isSubPreset ? rawSub : (rawSub ? 'Add New' : ''),
        customInsuranceSubType: isSubPreset ? '' : rawSub,
        anyDesease: lead.anyDesease || '',
        remarks: lead.remarks || ''
      });
    }
  }, [isOpen, lead, realEstateRequirementsMaster, leadSourcesMaster, realEstateProductsMaster, mutualFundProductsMaster, insuranceProductsMaster, insuranceSubProductsMaster, investmentBudgetsMaster]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'leadType') {
        updated.leadReceiver = '';
        updated.callerAssigned = '';
        updated.investmentBudget = '';
        updated.customInvestmentBudget = '';
        updated.productType = '';
        updated.customProductType = '';
        updated.customInsuranceType = '';
        updated.customInsuranceSubType = '';
        if ((value === 'Insurance' || value?.toLowerCase().includes('insurance')) && !updated.insuranceType) {
          updated.insuranceType = 'Life Insurance';
        }
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
      if (field === 'leadSource') {
        if (value?.toLowerCase() !== 'reference') {
          updated.referencerName = '';
        }
        if (!isOtherValue(value)) {
          updated.customLeadSource = '';
        }
      }
      if (field === 'investmentBudget' && !isOtherValue(value)) {
        updated.customInvestmentBudget = '';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.leadType) { toast.error('Lead Type is required'); return; }
    if (!formData.leadReceiver) { toast.error('Lead Receiver Name is required'); return; }
    if (!formData.leadSource) { toast.error('Lead Source is required'); return; }

    let finalLeadSource = formData.leadSource;
    if (isOtherValue(formData.leadSource)) {
      if (!formData.customLeadSource?.trim()) {
        toast.error('Please enter the new lead source');
        return;
      }
      finalLeadSource = formData.customLeadSource.trim();
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

    let finalInvestmentBudget = formData.investmentBudget;
    if (isOtherValue(formData.investmentBudget)) {
      if (!formData.customInvestmentBudget?.trim()) {
        toast.error('Please enter the new investment budget');
        return;
      }
      finalInvestmentBudget = formData.customInvestmentBudget.trim();
    }

    if (isReferenceSource && !formData.referencerName.trim()) { toast.error('Referencer Name is required'); return; }
    if (!formData.customerName.trim()) { toast.error('Customer Name is required'); return; }
    if (!formData.customerNumber.trim()) { toast.error('Customer Number is required'); return; }
    if (formData.customerNumber.length !== 10) { toast.error('Number must be exactly 10 digits'); return; }

    setLoading(true);

    try {
      if (isOtherValue(formData.leadSource) && finalLeadSource) {
        const exists = (leadSourcesMaster || []).some(
          s => s.leadSource?.toLowerCase().trim() === finalLeadSource.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveLeadSource({ leadSource: finalLeadSource });
          } catch (err) {
            console.error('Failed to save new lead source to master:', err);
          }
        }
      }

      if (isRealEstate && isOtherValue(formData.productType) && finalProductType) {
        const exists = (realEstateProductsMaster || []).some(
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
        const exists = (mutualFundProductsMaster || []).some(
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
        const exists = (insuranceProductsMaster || []).some(
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
        const exists = (realEstateRequirementsMaster || []).some(
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
        const exists = (insuranceSubProductsMaster || []).some(
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

      if (isOtherValue(formData.investmentBudget) && finalInvestmentBudget) {
        const exists = (investmentBudgetsMaster || []).some(
          b => b.investmentBudget?.toLowerCase().trim() === finalInvestmentBudget.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveInvestmentBudget({ investmentBudget: finalInvestmentBudget });
          } catch (err) {
            console.error('Failed to save new investment budget to master:', err);
          }
        }
      }

      await leadApi.updateLead(lead.id, {
        ...formData,
        leadSource: finalLeadSource,
        investmentBudget: finalInvestmentBudget,
        productType: isInsurance ? finalInsuranceType : finalProductType,
        requirement: isRealEstate ? finalRequirement : formData.requirement,
        insuranceType: isInsurance ? finalInsuranceType : formData.insuranceType,
        insuranceSubType: isInsurance ? finalInsuranceSubType : formData.insuranceSubType,
        personName: formData.customerName,
        number: formData.customerNumber,
        email: formData.customerEmail,
        location: formData.customerAddress
      });
      toast.success(`Lead ${lead.leadNo} updated successfully`);
      setLoading(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error('Failed to update lead:', err);
      toast.error('Failed to update lead');
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Lead (${lead.leadNo})`}
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Save Changes'}
      loading={loading}
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 sm:gap-x-3 sm:gap-y-2.5 md:gap-3.5">

        {/* Lead Type */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Lead Type *</label>
          <SearchableDropdown
            options={leadTypeOptions}
            value={formData.leadType}
            onChange={(val) => handleChange('leadType', val)}
            placeholder="Select lead type"
          />
        </div>

        {/* Lead Receiver Name */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Lead Receiver Name *</label>
          <SearchableDropdown
            options={receiverOptions}
            value={formData.leadReceiver}
            onChange={(val) => handleChange('leadReceiver', val)}
            placeholder="Select lead receiver"
          />
        </div>

        {/* Lead Source */}
        <div className={`space-y-1 ${isOtherValue(formData.leadSource) ? 'col-span-2 sm:col-span-1' : 'col-span-1'}`}>
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Lead Source *</label>
          <SearchableDropdown
            options={leadSourceOptions}
            value={formData.leadSource}
            onChange={(val) => handleChange('leadSource', val)}
            onAdd={(term) => {
              handleChange('leadSource', 'Add New');
              if (term) handleChange('customLeadSource', term);
            }}
            placeholder="Select lead source"
          />
          {isOtherValue(formData.leadSource) && (
            <div className="relative mt-1 animate-in fade-in duration-200">
              <Share2 className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                autoFocus
                value={formData.customLeadSource}
                onChange={(e) => handleChange('customLeadSource', e.target.value)}
                placeholder="Enter new lead source"
                className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          )}
        </div>

        {/* Referencer Name - ONLY visible when Lead Source is Reference */}
        {isReferenceSource && (
          <div className="space-y-1 col-span-1 animate-in fade-in duration-200">
            <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Referencer Name *</label>
            <div className="relative">
              <UserCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                value={formData.referencerName}
                onChange={(e) => handleChange('referencerName', e.target.value)}
                placeholder="Enter referencer name"
                className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        )}

        {/* REAL ESTATE SPECIFIC: Product Type & Requirement */}
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
                  <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
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
                options={realEstateRequirementOptions}
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

        {/* MUTUAL FUND SPECIFIC: Product Type */}
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
                <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
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

        {/* INSURANCE SPECIFIC: Product Type & Sub Product Type */}
        {isInsurance && (
          <>
            <div className={`space-y-1 ${isOtherValue(formData.insuranceType) ? 'col-span-2 sm:col-span-1' : 'col-span-1'} animate-in fade-in duration-200`}>
              <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Product Type *</label>
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
                  <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
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
                  <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
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

        {/* Customer Name */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Customer Name *</label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => handleChange('customerName', e.target.value)}
              placeholder="Enter customer name"
              className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Customer Number */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Customer Number *</label>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={formData.customerNumber}
              onChange={(e) => handleChange('customerNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter 10-digit number"
              className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Customer Email */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Customer Email</label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => handleChange('customerEmail', e.target.value)}
              placeholder="Enter email address"
              className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* DOB */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">DOB</label>
          <input
            type="date"
            value={formData.dob}
            onChange={(e) => handleChange('dob', e.target.value)}
            className="w-full border border-gray-300 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] [color-scheme:light]"
          />
        </div>

        {/* Customer Address */}
        <div className="space-y-1 col-span-2">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Customer Address</label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              value={formData.customerAddress}
              onChange={(e) => handleChange('customerAddress', e.target.value)}
              placeholder="Enter address"
              className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Occupation */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Occupation</label>
          <div className="relative">
            <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              value={formData.occupation}
              onChange={(e) => handleChange('occupation', e.target.value)}
              placeholder="Enter occupation"
              className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Investment Range */}
        <div className={`space-y-1 ${isOtherValue(formData.investmentBudget) ? 'col-span-2 sm:col-span-1' : 'col-span-1'}`}>
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Investment Budget</label>
          <SearchableDropdown
            options={investmentBudgetOptions}
            value={formData.investmentBudget}
            onChange={(val) => handleChange('investmentBudget', val)}
            onAdd={(term) => {
              handleChange('investmentBudget', 'Add New');
              if (term) handleChange('customInvestmentBudget', term);
            }}
            placeholder="Select investment budget"
          />
          {isOtherValue(formData.investmentBudget) && (
            <div className="relative mt-1 animate-in fade-in duration-200">
              <input
                type="text"
                autoFocus
                value={formData.customInvestmentBudget}
                onChange={(e) => handleChange('customInvestmentBudget', e.target.value)}
                placeholder="Enter new budget range (e.g. 1 Cr - 2 Cr)"
                className="w-full border border-gray-300 rounded pl-3 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          )}
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

        {/* Caller Assigned to */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Caller Assigned to</label>
          {isDirectSiteVisitLead(lead) ? (
            <div className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 font-semibold flex items-center gap-1.5 h-[30px] md:h-[34px]">
              <MapPin size={13} className="text-blue-600" />
              <span className="truncate">Direct Site Visit ({lead.assignedVisitor || 'Assigned'})</span>
            </div>
          ) : (
            <SearchableDropdown
              options={callerOptions}
              value={formData.callerAssigned}
              onChange={(val) => handleChange('callerAssigned', val)}
              placeholder="Select caller"
            />
          )}
        </div>

        {/* INSURANCE SPECIFIC: Any Disease */}
        {isInsurance && (
          <div className="space-y-1 col-span-2 animate-in fade-in duration-200">
            <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Any Disease / Pre-existing Medical Condition</label>
            <div className="relative">
              <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                value={formData.anyDesease}
                onChange={(e) => handleChange('anyDesease', e.target.value)}
                placeholder="Mention any existing disease, medical history, or None"
                className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        )}

        {/* Remarks */}
        <div className="space-y-1 col-span-2">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Remarks</label>
          <div className="relative">
            <MessageSquare className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Enter remarks"
              rows={2}
              className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] resize-none"
            />
          </div>
        </div>

      </div>
    </ModalForm>
  );
}
