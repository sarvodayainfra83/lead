import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail,
  Briefcase, Wallet, MapPin, Clock, MessageSquare, ClipboardList, Shield, Activity, UserCheck
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { callTrackerApi } from '../../api/callTrackerApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from '../Lead/leadConstants';
import { ENQUIRY_STATUSES, DATE_STATUSES } from './callTrackerConstants';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';

const initialFormData = {
  leadType: 'Real Estate',
  leadReceiver: '',
  leadSource: '',
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
  requirement: '',
  requirementOption: '',
  customRequirement: '',
  insuranceType: 'Life Insurance',
  insuranceSubType: '',
  anyDesease: '',
  status: '',
  customerSaid: '',
  nextCallDate: ''
};

export default function Direct({ isOpen, onClose, onSaved }) {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    ...initialFormData,
    callerAssigned: user?.name || ''
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
      setFormData(prev => ({ ...prev, callerAssigned: user?.name || user?.id || '' }));
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
  }, [isOpen, isAdmin, user]);

  const leadTypeOptions = leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }));
  const leadSourceOptions = leadSourcesMaster.map(s => ({ value: s.leadSource, label: s.leadSource }));
  const receiverOptions = Array.from(
    new Set(
      leadReceiversMaster
        .filter(r => !formData.leadType || r.leadType === formData.leadType)
        .map(r => r.personName)
        .filter(Boolean)
    )
  ).map(name => ({ value: name, label: name }));

  const callerOptions = isAdmin
    ? Array.from(
        new Set(
          callerNamesMaster
            .filter(c => !formData.leadType || c.leadType === formData.leadType)
            .map(c => c.personName)
            .filter(Boolean)
        )
      ).map(name => ({ value: name, label: name }))
    : [{ value: user?.name || user?.id || 'Assigned', label: user?.name || user?.id || 'Assigned' }];

  const isRealEstate = formData.leadType === 'Real Estate';
  const isInsurance = formData.leadType === 'Insurance' || formData.leadType?.toLowerCase().includes('insurance');
  const isMutualFund = formData.leadType === 'Mutual Fund';
  const isReferenceSource = formData.leadSource?.toLowerCase() === 'reference';

  const realEstateProductOptions = realEstateProductsMaster.map(t => ({ value: t.productType, label: t.productType }));
  const realEstateRequirementOptions = realEstateRequirementsMaster.map(t => ({ value: t.requirement, label: t.requirement }));
  const mutualFundProductOptions = mutualFundProductsMaster.map(t => ({ value: t.productType, label: t.productType }));
  const insuranceProductOptions = insuranceProductsMaster.map(t => ({ value: t.productType, label: t.productType }));
  const insuranceSubProductOptions = insuranceSubProductsMaster
    .filter(s => s.productType === formData.insuranceType)
    .map(s => ({ value: s.subProductType, label: s.subProductType }));
  const investmentBudgetOptions = investmentBudgetsMaster.map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Receiver/Caller lists are filtered by Lead Type — clear stale picks when it changes
      if (field === 'leadType') {
        updated.leadReceiver = '';
        updated.callerAssigned = user?.name || user?.id || '';
        updated.productType = '';
        if ((value === 'Insurance' || value?.toLowerCase().includes('insurance')) && !updated.insuranceType) {
          updated.insuranceType = 'Life Insurance';
        }
      }
      if (field === 'leadSource' && value?.toLowerCase() !== 'reference') {
        updated.referencerName = '';
      }
      if (field === 'insuranceType') {
        updated.insuranceSubType = '';
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
      requirement: val === 'Other' ? (prev.customRequirement || '') : val
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
    setFormData({ ...initialFormData, callerAssigned: user?.name || '' });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.leadType) { toast.error('Lead Type is required'); return; }
    if (!formData.leadSource) { toast.error('Lead Source is required'); return; }
    if (isReferenceSource && !formData.referencerName.trim()) { toast.error('Referencer Name is required'); return; }
    if (!formData.personName.trim()) { toast.error('Customer Name is required'); return; }
    if (!formData.number.trim()) { toast.error('Customer Number is required'); return; }
    if (formData.number.length !== 10) { toast.error('Number must be exactly 10 digits'); return; }
    if (!formData.callerAssigned) { toast.error('Caller Assigned to is required'); return; }
    
    if (!formData.status) { toast.error('Status is required'); return; }
    if (!formData.customerSaid.trim()) { toast.error('What did Customer Said is required'); return; }

    setLoading(true);

    const existingLeads = await leadApi.getLeads();
    const leadNo = generateLeadNo(formData.leadType, existingLeads);
    const now = new Date();
    const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const createdLead = await leadApi.saveLead({
      leadNo,
      timestamp,
      processType: 'Direct',
      leadType: formData.leadType,
      leadReceiver: formData.leadReceiver,
      leadSource: formData.leadSource,
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
      productType: formData.productType,
      requirement: formData.requirement,
      insuranceType: formData.insuranceType,
      insuranceSubType: formData.insuranceSubType,
      anyDesease: formData.anyDesease,
      remarks: ''
    });

    await callTrackerApi.saveCallTracker({
      leadId: createdLead.id,
      leadNo: createdLead.leadNo,
      status: formData.status,
      customerSaid: formData.customerSaid,
      nextDate: DATE_STATUSES.includes(formData.status) ? formData.nextCallDate : '',
      timestamp,
      timestampMs: now.getTime()
    });

    if (formData.status === 'Interested' || formData.status === 'Site Visit/Meeting') {
      toast.success(`Lead ${leadNo} added and moved to Customer Master.`);
    } else if (formData.status === 'Not Interested') {
      toast.success(`Lead ${leadNo} added and logged to History.`);
    } else {
      toast.success(`Lead ${leadNo} added (${formData.status}) — it's in Pending.`);
    }

    setFormData({ ...initialFormData, callerAssigned: user?.name || '' });
    setLoading(false);
    onSaved?.();
    onClose();
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Direct Lead"
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
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Requirement</label>
              <SearchableDropdown
                options={realEstateRequirementOptions}
                value={formData.requirementOption}
                onChange={handleRequirementOptionChange}
                placeholder="Select requirement"
              />
              {formData.requirementOption === 'Other' && (
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
            </div>

            {/* Sub Product Type - Only shown when the chosen Product Type has sub types defined */}
            {insuranceSubProductOptions.length > 0 && (
              <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Sub Product Type</label>
                <SearchableDropdown
                  options={insuranceSubProductOptions}
                  value={formData.insuranceSubType}
                  onChange={(val) => handleChange('insuranceSubType', val)}
                  placeholder={`Select ${formData.insuranceType} sub type`}
                />
              </div>
            )}
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
