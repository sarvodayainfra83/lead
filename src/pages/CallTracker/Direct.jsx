import React, { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail,
  Briefcase, Wallet, MapPin, Clock, MessageSquare, ClipboardList, Shield, Activity, UserCheck, Share2
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { callTrackerApi } from '../../api/callTrackerApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from '../Lead/leadConstants';
import { ENQUIRY_STATUSES, DATE_STATUSES, CUSTOMER_STATUSES } from './callTrackerConstants';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';

const initialFormData = {
  leadType: 'Real Estate',
  leadReceiver: '',
  leadSource: '',
  customLeadSource: '',
  referencerName: '',
  personName: '',
  number: '',
  email: '',
  dob: '',
  occupation: '',
  investmentBudget: '',
  location: '',
  whenToBuyPlan: '',
  callerAssigned: '',
  productType: '',
  customProductType: '',
  requirement: '',
  requirementOption: '',
  customRequirement: '',
  insuranceType: 'Life Insurance',
  customInsuranceType: '',
  insuranceSubType: '',
  customInsuranceSubType: '',
  anyDesease: '',
  status: '',
  customerStatus: '',
  customerSaid: '',
  nextCallDate: ''
};

export default function Direct({ isOpen, onClose, onSaved, defaultLeadType }) {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);
  const [loading, setLoading] = useState(false);

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

  const resolveUserLeadType = (typesList = leadTypesMaster) => {
    if (defaultLeadType) return defaultLeadType;
    if (user?.leadType) return user.leadType;
    if (user?.leadTypeId && typesList?.length > 0) {
      const found = typesList.find(lt => String(lt.id) === String(user.leadTypeId));
      if (found) return found.leadType;
    }
    return 'Real Estate';
  };

  const wasOpenRef = useRef(false);

  const [formData, setFormData] = useState(() => ({
    ...initialFormData,
    leadType: defaultLeadType || user?.leadType || 'Real Estate',
    callerAssigned: user?.name || ''
  }));

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const targetType = defaultLeadType || resolveUserLeadType();
      setFormData({
        ...initialFormData,
        leadType: targetType,
        callerAssigned: user?.name || user?.id || ''
      });

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
        setLeadTypesMaster(types || []);
        setLeadSourcesMaster(sources || []);
        setLeadReceiversMaster(receivers || []);
        setCallerNamesMaster(callers || []);
        setRealEstateProductsMaster(reProducts || []);
        setRealEstateRequirementsMaster(reRequirements || []);
        setMutualFundProductsMaster(mfProducts || []);
        setInsuranceProductsMaster(insProducts || []);
        setInsuranceSubProductsMaster(insSubProducts || []);
        setInvestmentBudgetsMaster(budgets || []);

        const finalType = defaultLeadType || resolveUserLeadType(types || []);
        setFormData(prev => ({
          ...prev,
          leadType: prev.leadType || finalType
        }));
      }).catch(console.error);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, defaultLeadType]);

  const leadTypeOptions = useMemo(() => {
    if (defaultLeadType) {
      return [{ value: defaultLeadType, label: defaultLeadType }];
    }
    return leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }));
  }, [defaultLeadType, leadTypesMaster]);

  const leadSourceOptions = useMemo(() => {
    const opts = (leadSourcesMaster || []).map(s => ({ value: s.leadSource, label: s.leadSource }));
    if (!opts.some(o => o.value === 'Other')) {
      opts.push({ value: 'Other', label: 'Other' });
    }
    return opts;
  }, [leadSourcesMaster]);

  const selectedLeadTypeObj = useMemo(() => {
    return leadTypesMaster.find(t =>
      t.leadType?.toLowerCase().trim() === formData.leadType?.toLowerCase().trim()
    );
  }, [leadTypesMaster, formData.leadType]);

  const selectedLeadTypeId = selectedLeadTypeObj?.id;
  const currentLeadTypeStr = (formData.leadType || '').toLowerCase().trim();

  const receiverOptions = useMemo(() => {
    return Array.from(
      new Set(
        leadReceiversMaster
          .filter(r => {
            if (!currentLeadTypeStr) return true;
            const rType = String(r.leadType || '').toLowerCase().trim();
            const rTypeId = String(r.leadTypeId || '').trim();
            if (selectedLeadTypeId && rTypeId && String(selectedLeadTypeId) === rTypeId) return true;
            if (rType && (rType === currentLeadTypeStr || currentLeadTypeStr.includes(rType) || rType.includes(currentLeadTypeStr))) return true;
            return false;
          })
          .map(r => r.personName)
          .filter(Boolean)
      )
    ).map(name => ({ value: name, label: name }));
  }, [leadReceiversMaster, currentLeadTypeStr, selectedLeadTypeId]);

  const callerOptions = useMemo(() => {
    // Filter callers matching the selected lead type
    const matching = (callerNamesMaster || []).filter(c => {
      if (!currentLeadTypeStr) return true;
      const cLeadType = String(c.leadType || '').toLowerCase().trim();
      const cLeadTypeId = String(c.leadTypeId || c.lead_type_id || '').trim();

      // Check ID match
      if (selectedLeadTypeId && cLeadTypeId && String(selectedLeadTypeId) === cLeadTypeId) {
        return true;
      }
      // Check Name match
      if (cLeadType && (cLeadType === currentLeadTypeStr || currentLeadTypeStr.includes(cLeadType) || cLeadType.includes(currentLeadTypeStr))) {
        return true;
      }
      return false;
    });

    const pool = matching.length > 0 ? matching : (callerNamesMaster || []);
    const opts = Array.from(new Set(pool.map(c => c.personName || c.name).filter(Boolean)))
      .map(name => ({ value: name, label: name }));

    // Prepend logged in user if not in list and matches lead type or admin
    if (user?.name && !opts.some(o => o.value === user.name)) {
      const userType = String(user.leadType || '').toLowerCase().trim();
      const userMatches = !userType || userType.includes(currentLeadTypeStr) || currentLeadTypeStr.includes(userType) || isAdmin;
      if (userMatches) {
        opts.unshift({ value: user.name, label: `${user.name} (You)` });
      }
    }

    return opts;
  }, [callerNamesMaster, formData.leadType, selectedLeadTypeId, currentLeadTypeStr, user, isAdmin]);

  // Keep callerAssigned valid when lead type or callerOptions change
  useEffect(() => {
    if (callerOptions.length > 0) {
      const isValid = callerOptions.some(o => o.value === formData.callerAssigned);
      if (!isValid) {
        const userOpt = callerOptions.find(o => o.value === user?.name || o.value === `${user?.name} (You)`);
        setFormData(prev => ({
          ...prev,
          callerAssigned: userOpt ? user.name : callerOptions[0].value
        }));
      }
    }
  }, [callerOptions, user]);

  const isOtherValue = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    return lower === 'other' || lower === 'others';
  };

  const isRealEstate = formData.leadType === 'Real Estate';
  const isInsurance = formData.leadType === 'Insurance' || formData.leadType?.toLowerCase().includes('insurance');
  const isMutualFund = formData.leadType === 'Mutual Fund';
  const isReferenceSource = formData.leadSource?.toLowerCase() === 'reference';

  const realEstateProductOptions = useMemo(() => {
    const opts = (realEstateProductsMaster || []).map(t => ({ value: t.productType, label: t.productType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [realEstateProductsMaster]);

  const realEstateRequirementOptions = useMemo(() => {
    const opts = (realEstateRequirementsMaster || []).map(t => ({ value: t.requirement, label: t.requirement }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [realEstateRequirementsMaster]);

  const mutualFundProductOptions = useMemo(() => {
    const opts = (mutualFundProductsMaster || []).map(t => ({ value: t.productType, label: t.productType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [mutualFundProductsMaster]);

  const insuranceProductOptions = useMemo(() => {
    const opts = (insuranceProductsMaster || []).map(t => ({ value: t.productType, label: t.productType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [insuranceProductsMaster]);

  const insuranceSubProductOptions = useMemo(() => {
    const currentInsType = isOtherValue(formData.insuranceType)
      ? (formData.customInsuranceType || '')
      : formData.insuranceType;
    const opts = (insuranceSubProductsMaster || [])
      .filter(s => s.productType?.toLowerCase().trim() === currentInsType?.toLowerCase().trim())
      .map(s => ({ value: s.subProductType, label: s.subProductType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [insuranceSubProductsMaster, formData.insuranceType, formData.customInsuranceType]);

  const investmentBudgetOptions = investmentBudgetsMaster.map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Receiver/Caller lists are filtered by Lead Type — clear stale picks when it changes
      if (field === 'leadType') {
        updated.leadReceiver = '';
        updated.callerAssigned = user?.name || user?.id || '';
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
      if (field === 'status' && !DATE_STATUSES.includes(value)) {
        updated.nextCallDate = '';
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

  const handleClose = () => {
    setFormData({ ...initialFormData, leadType: defaultLeadType || resolveUserLeadType(), callerAssigned: user?.name || '' });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.leadType) { toast.error('Lead Type is required'); return; }
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

    if (isReferenceSource && !formData.referencerName.trim()) { toast.error('Referencer Name is required'); return; }
    if (!formData.personName.trim()) { toast.error('Customer Name is required'); return; }
    if (!formData.number.trim()) { toast.error('Customer Number is required'); return; }
    if (formData.number.length !== 10) { toast.error('Number must be exactly 10 digits'); return; }
    if (!formData.callerAssigned) { toast.error('Caller Assigned to is required'); return; }

    if (!formData.status) { toast.error('Status is required'); return; }
    if (!formData.customerStatus) { toast.error('Customer Status is required'); return; }
    if (!formData.customerSaid.trim()) { toast.error('What did Customer Said is required'); return; }

    setLoading(true);

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

    const existingLeads = await leadApi.getAllLeads();
    const leadNo = generateLeadNo(formData.leadType, existingLeads);
    const now = new Date();
    const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const createdLead = await leadApi.saveLead({
      leadNo,
      timestamp,
      processType: 'Direct',
      leadType: formData.leadType,
      leadReceiver: formData.leadReceiver,
      leadSource: finalLeadSource,
      referencerName: formData.referencerName,
      customerName: formData.personName,
      personName: formData.personName,
      customerNumber: formData.number,
      number: formData.number,
      customerEmail: formData.email,
      email: formData.email,
      dob: formData.dob,
      occupation: formData.occupation,
      investmentBudget: formData.investmentBudget,
      customerAddress: formData.location,
      location: formData.location,
      whenToBuyPlan: formData.whenToBuyPlan,
      callerAssigned: formData.callerAssigned,
      productType: isInsurance ? finalInsuranceType : finalProductType,
      requirement: isRealEstate ? finalRequirement : formData.requirement,
      insuranceType: isInsurance ? finalInsuranceType : formData.insuranceType,
      insuranceSubType: isInsurance ? finalInsuranceSubType : formData.insuranceSubType,
      anyDesease: formData.anyDesease,
      remarks: ''
    });

    await callTrackerApi.saveCallTracker({
      leadId: createdLead.id,
      leadNo: createdLead.leadNo,
      status: formData.status,
      customerStatus: formData.customerStatus,
      customerSaid: formData.customerSaid,
      nextDate: DATE_STATUSES.includes(formData.status) ? formData.nextCallDate : '',
      timestamp,
      timestampMs: now.getTime()
    });

    if (formData.status === 'Interested' || formData.status === 'Deal Closed') {
      toast.success(`Lead ${leadNo} added and moved to Customer Master.`);
    } else if (formData.status === 'Site Visit/Meeting') {
      toast.success(`Lead ${leadNo} added and moved to Assign Visitor.`);
    } else if (formData.status === 'Not Interested') {
      toast.success(`Lead ${leadNo} added and logged to History.`);
    } else {
      toast.success(`Lead ${leadNo} added (${formData.status}) — it's in Pending.`);
    }

    setFormData({ ...initialFormData, leadType: defaultLeadType || resolveUserLeadType(), callerAssigned: user?.name || '' });
    setLoading(false);
    onSaved?.();
    onClose();
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title={defaultLeadType ? `Add Direct Lead (${defaultLeadType})` : "Add Direct Lead"}
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Save'}
      loading={loading}
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">

        {/* Lead Type */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Type *</label>
          <SearchableDropdown
            options={leadTypeOptions}
            value={formData.leadType}
            onChange={(val) => handleChange('leadType', val)}
            placeholder="Select lead type"
          />
        </div>

        {/* Caller Assigned to */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Caller Name *</label>
          <SearchableDropdown
            options={callerOptions}
            value={formData.callerAssigned}
            onChange={(val) => handleChange('callerAssigned', val)}
            placeholder="Select caller"
          />
        </div>

        {/* Lead Source */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Source *</label>
          <SearchableDropdown
            options={leadSourceOptions}
            value={formData.leadSource}
            onChange={(val) => handleChange('leadSource', val)}
            placeholder="Select lead source"
          />
          {isOtherValue(formData.leadSource) && (
            <div className="relative mt-1.5 animate-in fade-in duration-200">
              <Share2 className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={formData.customLeadSource}
                onChange={(e) => handleChange('customLeadSource', e.target.value)}
                placeholder="Enter new lead source"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          )}
        </div>

        {/* Referencer Name - ONLY visible when Lead Source is Reference */}
        {isReferenceSource && (
          <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Referencer Name *</label>
            <div className="relative">
              <UserCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={formData.referencerName}
                onChange={(e) => handleChange('referencerName', e.target.value)}
                placeholder="Enter referencer name"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        )}

        {/* REAL ESTATE SPECIFIC: Product Type & Requirement */}
        {isRealEstate && (
          <>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Product Type</label>
              <SearchableDropdown
                options={realEstateProductOptions}
                value={formData.productType}
                onChange={(val) => handleChange('productType', val)}
                placeholder="Select product type"
              />
              {isOtherValue(formData.productType) && (
                <div className="relative mt-1.5 animate-in fade-in duration-200">
                  <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={formData.customProductType}
                    onChange={(e) => handleChange('customProductType', e.target.value)}
                    placeholder="Enter new product type"
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Requirement</label>
              <SearchableDropdown
                options={realEstateRequirementOptions}
                value={formData.requirementOption}
                onChange={handleRequirementOptionChange}
                placeholder="Select requirement"
              />
              {isOtherValue(formData.requirementOption) && (
                <div className="relative mt-1.5 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={formData.customRequirement}
                    onChange={(e) => handleCustomRequirementChange(e.target.value)}
                    placeholder="Specify other requirement (e.g. Duplex, Farmhouse)"
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* MUTUAL FUND SPECIFIC: Product Type */}
        {isMutualFund && (
          <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Product Type</label>
            <SearchableDropdown
              options={mutualFundProductOptions}
              value={formData.productType}
              onChange={(val) => handleChange('productType', val)}
              placeholder="Select product type"
            />
            {isOtherValue(formData.productType) && (
              <div className="relative mt-1.5 animate-in fade-in duration-200">
                <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={formData.customProductType}
                  onChange={(e) => handleChange('customProductType', e.target.value)}
                  placeholder="Enter new product type"
                  className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                />
              </div>
            )}
          </div>
        )}

        {/* INSURANCE SPECIFIC: Product Type & Sub Product Type */}
        {isInsurance && (
          <>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Product Type *</label>
              <SearchableDropdown
                options={insuranceProductOptions}
                value={formData.insuranceType}
                onChange={(val) => handleChange('insuranceType', val)}
                placeholder="Select product type"
              />
              {isOtherValue(formData.insuranceType) && (
                <div className="relative mt-1.5 animate-in fade-in duration-200">
                  <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={formData.customInsuranceType}
                    onChange={(e) => handleChange('customInsuranceType', e.target.value)}
                    placeholder="Enter new product type"
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Sub Product Type</label>
              <SearchableDropdown
                options={insuranceSubProductOptions}
                value={formData.insuranceSubType}
                onChange={(val) => handleChange('insuranceSubType', val)}
                placeholder={`Select ${isOtherValue(formData.insuranceType) ? (formData.customInsuranceType || 'product') : formData.insuranceType} sub type`}
              />
              {isOtherValue(formData.insuranceSubType) && (
                <div className="relative mt-1.5 animate-in fade-in duration-200">
                  <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={formData.customInsuranceSubType}
                    onChange={(e) => handleChange('customInsuranceSubType', e.target.value)}
                    placeholder="Enter new sub product type"
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Customer Name */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Name *</label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.personName}
              onChange={(e) => handleChange('personName', e.target.value)}
              placeholder="Enter customer name"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Customer Number */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Number *</label>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={formData.number}
              onChange={(e) => handleChange('number', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter 10-digit number"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Customer Status (Hot / Warm / Cold) */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Status *</label>
          <SearchableDropdown
            options={CUSTOMER_STATUSES.map(v => ({ value: v, label: v }))}
            value={formData.customerStatus}
            onChange={(val) => handleChange('customerStatus', val)}
            placeholder="Select Hot / Warm / Cold"
          />
        </div>

        {/* Customer Email */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Email</label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Enter email address"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* DOB — no custom left icon: native date pickers paint their own opaque content over
            the full input box, so an overlaid icon there gets hidden instead of showing. The
            browser's own calendar affordance on the right is left as the only indicator. */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer DOB</label>
          <input
            type="date"
            value={formData.dob}
            onChange={(e) => handleChange('dob', e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] [color-scheme:light]"
          />
        </div>

        {/* Occupation */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Occupation</label>
          <div className="relative">
            <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.occupation}
              onChange={(e) => handleChange('occupation', e.target.value)}
              placeholder="Enter occupation"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* INSURANCE SPECIFIC: Any Disease */}
        {isInsurance && (
          <div className="space-y-1 col-span-2 animate-in fade-in duration-200">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Any Disease / Pre-existing Medical Condition</label>
            <div className="relative">
              <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={formData.anyDesease}
                onChange={(e) => handleChange('anyDesease', e.target.value)}
                placeholder="Mention any existing disease or None"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        )}

        {/* Investment Budget */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Investment Budget</label>
          <SearchableDropdown
            options={investmentBudgetOptions}
            value={formData.investmentBudget}
            onChange={(val) => handleChange('investmentBudget', val)}
            placeholder="Select investment budget"
          />
        </div>

        {/* Customer Address */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Address</label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Enter address"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* When to Buy Plan */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">When to Buy Plan</label>
          <div className="relative">
            <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.whenToBuyPlan}
              onChange={(e) => handleChange('whenToBuyPlan', e.target.value)}
              placeholder="e.g. Immediate / 3 Months"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Status *</label>
          <SearchableDropdown
            options={ENQUIRY_STATUSES.map(v => ({ value: v, label: v }))}
            value={formData.status}
            onChange={(val) => handleChange('status', val)}
            placeholder="Select status"
          />
        </div>



        {formData.status && (
          <>
            {/* Date — Future Plan Date's next-call date, or the Site Visit/Meeting date — shown
                above What did Customer Said whenever this status collects one */}
            {DATE_STATUSES.includes(formData.status) && (
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">
                  {formData.status === 'Future Plan Date' ? 'Future Plan Date' : 'Site Visit/Meeting Date'}
                </label>
                <input
                  type="date"
                  value={formData.nextCallDate}
                  onChange={(e) => handleChange('nextCallDate', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] [color-scheme:light]"
                />
              </div>
            )}

            {/* What did Customer Said — asked for every status */}
            <div className="space-y-1 col-span-2">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">What did Customer Said *</label>
              <div className="relative">
                <MessageSquare className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                <textarea
                  value={formData.customerSaid}
                  onChange={(e) => handleChange('customerSaid', e.target.value)}
                  placeholder="Enter what the customer said"
                  rows={3}
                  className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] resize-none"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </ModalForm>
  );
}
