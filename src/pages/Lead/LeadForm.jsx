import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail, Calendar,
  Briefcase, Wallet, MapPin, Clock, MessageSquare, ClipboardList, Shield, Activity, UserCheck
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from './leadConstants';

const initialFormData = {
  leadType: 'Real Estate',
  leadReceiver: '',
  leadSource: '',
  referencerName: '',
  customerName: '',
  customerNumber: '',
  customerEmail: '',
  dob: '',
  occupation: '',
  investmentBudget: '',
  customerAddress: '',
  whenToBuyPlan: '',
  // Real Estate / Mutual Fund field — Product Type master, filtered by Lead Type
  productType: '',
  // Real Estate fields
  requirement: '',
  requirementOption: '',
  customRequirement: '',
  // Insurance fields
  insuranceType: 'Life Insurance',
  insuranceSubType: '',
  anyDesease: '',
  remarks: ''
};

export default function LeadForm({ isOpen, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...initialFormData });

  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [leadSourcesMaster, setLeadSourcesMaster] = useState([]);
  const [leadReceiversMaster, setLeadReceiversMaster] = useState([]);
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
        masterApi.getRealEstateProducts(),
        masterApi.getRealEstateRequirements(),
        masterApi.getMutualFundProducts(),
        masterApi.getInsuranceProducts(),
        masterApi.getInsuranceSubProducts(),
        masterApi.getInvestmentBudgets()
      ]).then(([types, sources, receivers, reProducts, reRequirements, mfProducts, insProducts, insSubProducts, budgets]) => {
        setLeadTypesMaster(types);
        setLeadSourcesMaster(sources);
        setLeadReceiversMaster(receivers);
        setRealEstateProductsMaster(reProducts);
        setRealEstateRequirementsMaster(reRequirements);
        setMutualFundProductsMaster(mfProducts);
        setInsuranceProductsMaster(insProducts);
        setInsuranceSubProductsMaster(insSubProducts);
        setInvestmentBudgetsMaster(budgets);
      });
    }
  }, [isOpen]);

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
      if (field === 'leadType') {
        updated.leadReceiver = '';
        updated.productType = '';
        if (value === 'Insurance' || value?.toLowerCase().includes('insurance')) {
          if (!updated.insuranceType) updated.insuranceType = 'Life Insurance';
        }
      }
      if (field === 'leadSource') {
        if (value?.toLowerCase() !== 'reference') {
          updated.referencerName = '';
        }
      }
      if (field === 'insuranceType') {
        updated.insuranceSubType = '';
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
    setFormData({ ...initialFormData });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.leadType) { toast.error('Lead Type is required'); return; }
    if (!formData.leadSource) { toast.error('Lead Source is required'); return; }
    if (isReferenceSource && !formData.referencerName.trim()) {
      toast.error('Referencer Name is required when source is Reference');
      return;
    }
    if (!formData.customerName.trim()) { toast.error('Customer Name is required'); return; }
    if (!formData.customerNumber.trim()) { toast.error('Customer Number is required'); return; }
    if (formData.customerNumber.length !== 10) { toast.error('Number must be exactly 10 digits'); return; }

    setLoading(true);

    try {
      const existingLeads = await leadApi.getLeads();
      const leadNo = generateLeadNo(formData.leadType, existingLeads);
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newLead = {
        leadNo,
        timestamp,
        ...formData,
        // Ensure legacy aliases are also present for components expecting them
        personName: formData.customerName,
        number: formData.customerNumber,
        email: formData.customerEmail,
        location: formData.customerAddress,
        processType: 'Lead'
      };

      await leadApi.saveLead(newLead);

      toast.success(`Lead ${leadNo} has been successfully created.`);
      setFormData({ ...initialFormData });
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

        {/* Lead Receiver Name */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Team Member Name</label>
          <SearchableDropdown
            options={receiverOptions}
            value={formData.leadReceiver}
            onChange={(val) => handleChange('leadReceiver', val)}
            placeholder="Select lead receiver"
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
              value={formData.customerName}
              onChange={(e) => handleChange('customerName', e.target.value)}
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
              value={formData.customerNumber}
              onChange={(e) => handleChange('customerNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
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
              value={formData.customerEmail}
              onChange={(e) => handleChange('customerEmail', e.target.value)}
              placeholder="Enter email address"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* DOB */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer DOB</label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <input
              type="date"
              value={formData.dob}
              onChange={(e) => handleChange('dob', e.target.value)}
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Customer Address */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Address</label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.customerAddress}
              onChange={(e) => handleChange('customerAddress', e.target.value)}
              placeholder="Enter address"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
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

        {/* Investment Range */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Investment Budget</label>
          <SearchableDropdown
            options={investmentBudgetOptions}
            value={formData.investmentBudget}
            onChange={(val) => handleChange('investmentBudget', val)}
            placeholder="Select investment budget"
          />
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
                placeholder="Mention any existing disease, medical history, or None"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        )}

        {/* Remarks */}
        <div className="space-y-1 col-span-2">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Remarks</label>
          <div className="relative">
            <MessageSquare className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Enter remarks"
              rows={3}
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] resize-none"
            />
          </div>
        </div>

      </div>
    </ModalForm>
  );
}
