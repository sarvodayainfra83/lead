import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail, Calendar,
  Briefcase, Wallet, MapPin, Clock, MessageSquare, ClipboardList, Shield, Activity, UserCheck
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { callTrackerApi } from '../../api/callTrackerApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo, INVESTMENT_BUDGET_OPTIONS, REQUIREMENT_OPTIONS } from '../Lead/leadConstants';
import { ENQUIRY_STATUSES, TERMINAL_STATUSES } from './callTrackerConstants';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';

const INSURANCE_TYPE_OPTIONS = [
  { value: 'Life Insurance', label: 'Life Insurance' },
  { value: 'Health Insurance', label: 'Health Insurance' },
  { value: 'Vehicle Insurance', label: 'Vehicle Insurance' },
  { value: 'Property Insurance', label: 'Property Insurance' },
  { value: 'Accident Insurance', label: 'Accident Insurance' },
  { value: 'Travel Insurance', label: 'Travel Insurance' },
  { value: 'Other', label: 'Other' }
];

const INSURANCE_SUB_TYPES = {
  'Life Insurance': [
    { value: 'KeyMan Insurance', label: 'KeyMan Insurance' },
    { value: 'Business Insurance', label: 'Business Insurance' },
    { value: 'Whole Life Insurance', label: 'Whole Life Insurance' },
    { value: 'ULIP Investment Plan', label: 'ULIP Investment Plan' },
    { value: 'Child Insurance', label: 'Child Insurance' },
    { value: 'Saving Plan', label: 'Saving Plan' },
    { value: 'Retirement Plan', label: 'Retirement Plan' },
    { value: 'Other', label: 'Other' }
  ],
  'Health Insurance': [
    { value: 'Individual Health Insurance', label: 'Individual Health Insurance' },
    { value: 'Family Health Insurance', label: 'Family Health Insurance' },
    { value: 'Senior Citizen Insurance', label: 'Senior Citizen Insurance' },
    { value: 'Group Insurance', label: 'Group Insurance' },
    { value: 'Critical Illness', label: 'Critical Illness' },
    { value: 'Other', label: 'Other' }
  ]
};

const initialFormData = {
  leadType: '',
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
  requirement: '',
  requirementOption: '',
  customRequirement: '',
  siteLocation: '',
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

  useEffect(() => {
    if (isOpen) {
      if (!isAdmin) {
        setFormData(prev => ({ ...prev, callerAssigned: user?.name || user?.id || '' }));
      }
      Promise.all([
        masterApi.getLeadTypes(),
        masterApi.getLeadSources(),
        masterApi.getLeadReceivers(),
        masterApi.getCallerNames()
      ]).then(([types, sources, receivers, callers]) => {
        setLeadTypesMaster(types);
        setLeadSourcesMaster(sources);
        setLeadReceiversMaster(receivers);
        setCallerNamesMaster(callers);
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
  const isReferenceSource = formData.leadSource?.toLowerCase() === 'reference';

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Receiver/Caller lists are filtered by Lead Type — clear stale picks when it changes
      if (field === 'leadType') {
        updated.leadReceiver = '';
        updated.callerAssigned = '';
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
      if (field === 'status' && (value?.toLowerCase() === 'not interested' || value === 'Received')) {
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

    if (!formData.leadType) { toast.error('Lead Type is required'); return; }
    if (!formData.leadSource) { toast.error('Lead Source is required'); return; }
    if (isReferenceSource && !formData.referencerName.trim()) { toast.error('Referencer Name is required'); return; }
    if (!formData.personName.trim()) { toast.error('Person Name is required'); return; }
    if (!formData.number.trim()) { toast.error('Number is required'); return; }
    if (formData.number.length !== 10) { toast.error('Number must be exactly 10 digits'); return; }
    if (!formData.callerAssigned) { toast.error('Caller Assigned to is required'); return; }
    
    const isTerminal = TERMINAL_STATUSES.includes(formData.status);
    const showCustomerSaid = formData.status !== 'Call Not Received';

    if (!formData.status) { toast.error('Status is required'); return; }
    if (showCustomerSaid && !formData.customerSaid.trim()) { toast.error('What did Customer Said is required'); return; }

    setLoading(true);

    const existingLeads = await leadApi.getLeads();
    const leadNo = generateLeadNo(formData.leadType, existingLeads);
    const now = new Date();
    const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const createdLead = await leadApi.saveLead({
      leadNo,
      timestamp,
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
      siteLocation: formData.siteLocation,
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
      customerSaid: showCustomerSaid ? formData.customerSaid : '',
      nextDate: !isTerminal ? formData.nextCallDate : '',
      timestamp,
      timestampMs: now.getTime()
    });

    if (formData.status === 'Received') {
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
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Receiver Name</label>
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

        {/* INSURANCE SPECIFIC: Insurance Type & Sub-Type */}
        {isInsurance && (
          <>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Insurance Type *</label>
              <SearchableDropdown
                options={INSURANCE_TYPE_OPTIONS}
                value={formData.insuranceType}
                onChange={(val) => handleChange('insuranceType', val)}
                placeholder="Select insurance type"
              />
            </div>

            {/* Insurance Sub Type - Only shown when Life Insurance or Health Insurance is selected */}
            {INSURANCE_SUB_TYPES[formData.insuranceType] && (
              <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Insurance Sub Type</label>
                <SearchableDropdown
                  options={INSURANCE_SUB_TYPES[formData.insuranceType]}
                  value={formData.insuranceSubType}
                  onChange={(val) => handleChange('insuranceSubType', val)}
                  placeholder={`Select ${formData.insuranceType} sub type`}
                />
              </div>
            )}
          </>
        )}

        {/* Person Name */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Person Name</label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.personName}
              onChange={(e) => handleChange('personName', e.target.value)}
              placeholder="Enter person name"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Number */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Number *</label>
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

        {/* Email */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Email</label>
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

        {/* DOB */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">DOB</label>
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

        {/* Occupation */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Occupation</label>
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

        {/* REAL ESTATE SPECIFIC: Requirement & Site Location */}
        {isRealEstate && (
          <>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Requirement</label>
              <SearchableDropdown
                options={REQUIREMENT_OPTIONS}
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

            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Site Location</label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={formData.siteLocation}
                onChange={(e) => handleChange('siteLocation', e.target.value)}
                placeholder="e.g. Near SG Highway, Sector 5"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        </>
      )}

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

        {/* Investment Range */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Investment Range</label>
          <SearchableDropdown
            options={INVESTMENT_BUDGET_OPTIONS}
            value={formData.investmentBudget}
            onChange={(val) => handleChange('investmentBudget', val)}
            placeholder="Select investment range"
          />
        </div>

        {/* Address */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Address</label>
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

        {/* Caller Assigned to */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Caller Assigned to *</label>
          <SearchableDropdown
            options={callerOptions}
            value={formData.callerAssigned}
            onChange={(val) => handleChange('callerAssigned', val)}
            placeholder="Select caller"
          />
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
            {/* What did Customer Said — not applicable when the call wasn't received */}
            {formData.status !== 'Call Not Received' && (
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
            )}

            {/* Next Call Date — any status still awaiting a follow-up */}
            {!TERMINAL_STATUSES.includes(formData.status) && (
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Next Call Date</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                  <input
                    type="date"
                    value={formData.nextCallDate}
                    onChange={(e) => handleChange('nextCallDate', e.target.value)}
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalForm>
  );
}
