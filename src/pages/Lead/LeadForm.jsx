import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail,
  Briefcase, Wallet, MapPin, Clock, MessageSquare, ClipboardList, Shield, Activity, UserCheck, Share2, Calendar
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import { authApi } from '../../api/authApi';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { useAuthStore } from '../../store/authStore';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from './leadConstants';

const initialFormData = {
  leadType: 'Real Estate',
  leadReceiver: '',
  leadSource: '',
  customLeadSource: '',
  referencerName: '',
  // Site Visit fields (Real Estate + Walk-in only)
  isSiteVisit: true,
  assignedVisitor: '',
  customerName: '',
  customerNumber: '',
  customerEmail: '',
  dob: '',
  occupation: '',
  investmentBudget: '',
  customInvestmentBudget: '',
  customerAddress: '',
  whenToBuyPlan: '',
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
};

export default function LeadForm({ isOpen, onClose, onSaved, defaultLeadType }) {
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(false);

  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [leadSourcesMaster, setLeadSourcesMaster] = useState([]);
  const [leadReceiversMaster, setLeadReceiversMaster] = useState([]);
  const [realEstateProductsMaster, setRealEstateProductsMaster] = useState([]);
  const [realEstateRequirementsMaster, setRealEstateRequirementsMaster] = useState([]);
  const [mutualFundProductsMaster, setMutualFundProductsMaster] = useState([]);
  const [insuranceProductsMaster, setInsuranceProductsMaster] = useState([]);
  const [insuranceSubProductsMaster, setInsuranceSubProductsMaster] = useState([]);
  const [investmentBudgetsMaster, setInvestmentBudgetsMaster] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [visitorsList, setVisitorsList] = useState([]);

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
    assignedVisitor: user?.name || ''
  }));

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const initialDefaultType = defaultLeadType || resolveUserLeadType();
      setFormData({
        ...initialFormData,
        leadType: defaultLeadType || initialDefaultType,
        assignedVisitor: user?.name || ''
      });

      Promise.all([
        masterApi.getLeadTypes(),
        masterApi.getLeadSources(),
        masterApi.getLeadReceivers(),
        masterApi.getRealEstateProducts(),
        masterApi.getRealEstateRequirements(),
        masterApi.getMutualFundProducts(),
        masterApi.getInsuranceProducts(),
        masterApi.getInsuranceSubProducts(),
        masterApi.getInvestmentBudgets(),
        authApi.getUsers().catch(() => []),
        masterApi.getVisitors().catch(() => [])
      ]).then(([types, sources, receivers, reProducts, reRequirements, mfProducts, insProducts, insSubProducts, budgets, usersData, visitorsData]) => {
        setLeadTypesMaster(types || []);
        setLeadSourcesMaster(sources || []);
        setLeadReceiversMaster(receivers || []);
        setRealEstateProductsMaster(reProducts || []);
        setRealEstateRequirementsMaster(reRequirements || []);
        setMutualFundProductsMaster(mfProducts || []);
        setInsuranceProductsMaster(insProducts || []);
        setInsuranceSubProductsMaster(insSubProducts || []);
        setInvestmentBudgetsMaster(budgets || []);
        setUsersList(usersData || []);
        setVisitorsList(visitorsData || []);

        const resolvedType = resolveUserLeadType(types || []);
        if (resolvedType) {
          setFormData(prev => ({
            ...prev,
            leadType: prev.leadType || resolvedType,
            assignedVisitor: prev.assignedVisitor || user?.name || ''
          }));
        }
      }).catch(console.error);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, defaultLeadType]);

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
    const allMembers = [...(leadReceiversMaster || [])];
    (usersList || []).forEach(u => {
      const name = u.name || u.personName;
      if (name && !allMembers.some(r => (r.personName || r.name) === name)) {
        allMembers.push({
          id: u.id || u.dbId,
          personName: name,
          name: name,
          leadTypeId: u.leadTypeId || u.lead_type_id,
          leadType: u.leadType || ''
        });
      }
    });

    const filtered = allMembers.filter(r => {
      if (!formData.leadType) return true;
      if (selectedLeadTypeId && (r.leadTypeId === selectedLeadTypeId || r.lead_type_id === selectedLeadTypeId)) {
        return true;
      }
      const rType = String(r.leadType || '').toLowerCase().trim();
      const targetType = String(formData.leadType || '').toLowerCase().trim();
      if (rType && targetType && (rType === targetType || rType.includes(targetType) || targetType.includes(rType))) {
        return true;
      }
      return false;
    });

    const pool = filtered.length > 0 ? filtered : allMembers;
    return Array.from(
      new Set(pool.map(r => r.personName || r.name).filter(Boolean))
    ).map(name => ({ value: name, label: name }));
  }, [leadReceiversMaster, usersList, formData.leadType, selectedLeadTypeId]);

  const isRealEstate = formData.leadType === 'Real Estate' || formData.leadType?.toLowerCase().includes('real');
  const isInsurance = formData.leadType === 'Insurance' || formData.leadType?.toLowerCase().includes('insurance');
  const isMutualFund = formData.leadType === 'Mutual Fund';
  const isReferenceSource = formData.leadSource?.toLowerCase() === 'reference';

  const isWalkInSource = useMemo(() => {
    const src = String(formData.leadSource || '').toLowerCase().trim();
    if (src.includes('walk-in') || src.includes('walk in') || src.includes('walkin') || src === 'walk in' || src === 'walk-in' || src === 'walkin') {
      return true;
    }
    if (isOtherValue(formData.leadSource)) {
      const custom = String(formData.customLeadSource || '').toLowerCase().trim();
      if (custom.includes('walk-in') || custom.includes('walk in') || custom.includes('walkin')) {
        return true;
      }
    }
    return false;
  }, [formData.leadSource, formData.customLeadSource]);

  const showSiteVisitOption = isRealEstate && isWalkInSource;

  const visitorOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];

    // 1. Current logged-in user first
    if (user?.name) {
      const cleanName = String(user.name).trim();
      seen.add(cleanName.toLowerCase());
      opts.push({ value: cleanName, label: `${cleanName} (You)` });
    }

    // 2. Visitors from master
    (visitorsList || []).forEach(v => {
      const name = v?.personName || v?.name;
      if (!name) return;
      const clean = String(name).trim();
      const lower = clean.toLowerCase();
      if (clean && !seen.has(lower)) {
        seen.add(lower);
        opts.push({ value: clean, label: clean });
      }
    });

    // 3. Registered users
    (usersList || []).forEach(u => {
      const name = u?.name;
      if (!name) return;
      const clean = String(name).trim();
      const lower = clean.toLowerCase();
      if (clean && !seen.has(lower)) {
        seen.add(lower);
        opts.push({ value: clean, label: clean });
      }
    });

    return opts;
  }, [user, visitorsList, usersList]);

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
    return (investmentBudgetsMaster || [])
      .filter(t => !isOtherValue(t.investmentBudget))
      .map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));
  }, [investmentBudgetsMaster]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'leadType') {
        updated.leadReceiver = '';
        updated.productType = '';
        updated.customProductType = '';
        updated.customInsuranceType = '';
        updated.customInsuranceSubType = '';
        if (value === 'Insurance' || value?.toLowerCase().includes('insurance')) {
          if (!updated.insuranceType) updated.insuranceType = 'Life Insurance';
        }
        const isRE = value === 'Real Estate' || value?.toLowerCase().includes('real');
        if (!isRE) {
          updated.isSiteVisit = false;
        } else if (isWalkInSource) {
          updated.isSiteVisit = true;
          if (!updated.assignedVisitor) {
            updated.assignedVisitor = user?.name || '';
          }
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
        const clean = String(value || '').toLowerCase().trim();
        const isWalk = clean.includes('walk-in') || clean.includes('walk in') || clean.includes('walkin');
        if (isWalk && isRealEstate) {
          updated.isSiteVisit = true;
          if (!updated.assignedVisitor) {
            updated.assignedVisitor = user?.name || '';
          }
        }
      }
      if (field === 'leadSource' && !isOtherValue(value)) {
        updated.customLeadSource = '';
      }
      if (field === 'investmentBudget' && !isOtherValue(value)) {
        updated.customInvestmentBudget = '';
      }
      if (field === 'customLeadSource') {
        const clean = String(value || '').toLowerCase().trim();
        const isWalk = clean.includes('walk-in') || clean.includes('walk in') || clean.includes('walkin');
        if (isWalk && isRealEstate) {
          updated.isSiteVisit = true;
          if (!updated.assignedVisitor) {
            updated.assignedVisitor = user?.name || '';
          }
        }
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
    setFormData({ ...initialFormData, leadType: resolveUserLeadType() });
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

    let finalInvestmentBudget = formData.investmentBudget;
    if (isOtherValue(formData.investmentBudget)) {
      if (!formData.customInvestmentBudget?.trim()) {
        toast.error('Please enter the new investment budget');
        return;
      }
      finalInvestmentBudget = formData.customInvestmentBudget.trim();
    }

    if (isReferenceSource && !formData.referencerName.trim()) {
      toast.error('Referencer Name is required when source is Reference');
      return;
    }
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
            const savedBudget = await masterApi.saveInvestmentBudget({ investmentBudget: finalInvestmentBudget });
            if (savedBudget) {
              setInvestmentBudgetsMaster(prev => [...prev, savedBudget]);
            }
          } catch (err) {
            console.error('Failed to save new investment budget to master:', err);
          }
        }
      }

      const existingLeads = await leadApi.getAllLeads();
      const leadNo = generateLeadNo(formData.leadType, existingLeads);
      const timestamp = new Date().toISOString();

      const isDirectSiteVisit = Boolean(showSiteVisitOption && formData.isSiteVisit);
      const assignedVisitorName = isDirectSiteVisit ? (formData.assignedVisitor || user?.name || '').trim() : '';

      const newLead = {
        leadNo,
        timestamp,
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
        location: formData.customerAddress,
        processType: isDirectSiteVisit ? 'Direct Site Visit' : 'Lead',
        isSiteVisit: isDirectSiteVisit,
        directSiteVisit: isDirectSiteVisit,
        assignedVisitor: assignedVisitorName,
        callerAssigned: ''
      };

      const createdLead = await leadApi.saveLead(newLead);

      // Real Estate + Walk-in + Site Visit checked -> directly record in Site Visit / Meeting
      if (isDirectSiteVisit) {
        try {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const todayDateStr = `${yyyy}-${mm}-${dd}`;

          const matchedUser = (usersList || []).find(u => String(u.name || '').trim().toLowerCase() === assignedVisitorName.toLowerCase())
            || (visitorsList || []).find(v => String(v.personName || v.name || '').trim().toLowerCase() === assignedVisitorName.toLowerCase());
          const visitorId = matchedUser?.dbId || matchedUser?.id || (assignedVisitorName.toLowerCase() === (user?.name || '').trim().toLowerCase() ? (user?.dbId || user?.id) : null);

          const visitorEntry = {
            leadId: createdLead?.id || newLead.id,
            leadNo: createdLead?.leadNo || leadNo,
            visitorName: assignedVisitorName,
            visitorId: visitorId || null,
            visitDate: todayDateStr,
            location: formData.customerAddress || '',
            remarks: formData.remarks || 'Walk-in Site Visit',
            status: 'Assigned',
            assignedBy: user?.name || ''
          };

          await siteVisitMeetingApi.saveAssignedVisitor(visitorEntry);
        } catch (visitErr) {
          console.error('Failed to auto-assign site visit for walk-in lead:', visitErr);
        }
      }

      toast.success(`Lead ${leadNo} has been successfully created.`);
      setFormData({
        ...initialFormData,
        leadType: resolveUserLeadType(),
        assignedVisitor: user?.name || ''
      });
      setLoading(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to create lead:', err);
      toast.error('Failed to create lead. Please check database tables.');
      setLoading(false);
    }
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Lead"
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Save'}
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
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Team Member Name</label>
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
                ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
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

        {/* REAL ESTATE + WALK-IN ONLY: Site Visit & Assign Visitor */}
        {showSiteVisitOption && (
          <div className="col-span-2 p-2.5 sm:p-3 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-indigo-50/70 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in duration-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 shadow-2xs">
                  <MapPin size={15} />
                </div>
                <div>
                  <div className="text-[11.5px] md:text-[13px] font-bold text-gray-800 flex items-center gap-1.5">
                    <span>Site Visit</span>
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      Real Estate Walk-in
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-500">
                    Conduct or schedule a site visit / meeting for this walk-in lead?
                  </p>
                </div>
              </div>

              {/* Radio / Checkbox toggle buttons */}
              <div className="flex items-center gap-3 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 hover:text-indigo-600 transition">
                  <input
                    type="radio"
                    name="isSiteVisitOption"
                    checked={formData.isSiteVisit === true}
                    onChange={() => {
                      setFormData(prev => ({
                        ...prev,
                        isSiteVisit: true,
                        assignedVisitor: prev.assignedVisitor || user?.name || ''
                      }));
                    }}
                    className="text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>Yes (Site Visit)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 hover:text-indigo-600 transition">
                  <input
                    type="radio"
                    name="isSiteVisitOption"
                    checked={formData.isSiteVisit === false}
                    onChange={() => {
                      setFormData(prev => ({
                        ...prev,
                        isSiteVisit: false
                      }));
                    }}
                    className="text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            {formData.isSiteVisit && (
              <div className="pt-2 border-t border-amber-200/70 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-150">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="block text-[10.5px] sm:text-[11px] md:text-[12px] font-semibold text-gray-700 uppercase tracking-tight">
                    Assign Visitor *
                  </label>
                  <SearchableDropdown
                    options={visitorOptions}
                    value={formData.assignedVisitor || user?.name || ''}
                    onChange={(val) => handleChange('assignedVisitor', val)}
                    placeholder="Select assigned visitor"
                  />
                  <p className="text-[9.5px] text-gray-500">
                    Defaulted to logged-in user (<span className="font-semibold text-gray-700">{user?.name || 'Current User'}</span>). You can select any other team member.
                  </p>
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="block text-[10.5px] sm:text-[11px] md:text-[12px] font-semibold text-gray-700 uppercase tracking-tight">
                    Site Visit Date
                  </label>
                  <div className="flex items-center h-[30px] md:h-[34px] px-2.5 bg-white border border-gray-300 rounded text-[11px] md:text-[13px] text-gray-700 font-medium">
                    <Calendar size={13} className="mr-2 text-indigo-500" />
                    <span>{new Date().toLocaleDateString('en-GB')} (Today - Current Date)</span>
                  </div>
                  <p className="text-[9.5px] text-gray-500">
                    Directly updates the Site Visit / Meeting section with today's date.
                  </p>
                </div>
              </div>
            )}
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
                  <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
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
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Customer DOB</label>
          <input
            type="date"
            value={formData.dob}
            onChange={(e) => handleChange('dob', e.target.value)}
            className="w-full border border-gray-300 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] [color-scheme:light]"
          />
        </div>

        {/* Occupation */}
        <div className="space-y-1 col-span-1">
          <label className="block text-[10.5px] sm:text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold">Customer Occupation</label>
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

        {/* Investment Budget */}
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
              <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                autoFocus
                ref={(el) => { if (el) setTimeout(() => el.focus(), 10); }}
                value={formData.customInvestmentBudget}
                onChange={(e) => handleChange('customInvestmentBudget', e.target.value)}
                placeholder="Enter new budget range (e.g. 1 Cr - 2 Cr)"
                className="w-full border border-gray-300 rounded pl-7 pr-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
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
