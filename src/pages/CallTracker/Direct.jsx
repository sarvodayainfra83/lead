import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail, Calendar,
  Briefcase, Wallet, MapPin, Clock, MessageSquare, ClipboardList
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { callTrackerApi } from '../../api/callTrackerApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from '../Lead/leadConstants';
import { ENQUIRY_STATUSES, TERMINAL_STATUSES } from './callTrackerConstants';
import { useAuthStore } from '../../store/authStore';

/**
 * Direct
 * Pop-up modal opened by the Call Tracker's "Direct" button. Combines lead
 * creation with logging that call's outcome in one step — it creates the lead
 * (Process Type = Direct) AND its first Call Tracker entry together, so the
 * lead lands straight in Customer Master / History / Pending based on Status.
 *
 * Props:
 *   isOpen  – boolean
 *   onClose – fn()
 *   onSaved – fn() called after a successful save so the parent can refresh
 */
const initialFormData = {
  leadType: '',
  leadReceiver: '',
  leadSource: '',
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
  status: '',
  customerSaid: '',
  nextCallDate: ''
};

export default function Direct({ isOpen, onClose, onSaved }) {
  const user = useAuthStore(state => state.user);
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
  }, [isOpen]);

  const leadTypeOptions = leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }));
  const leadSourceOptions = leadSourcesMaster.map(s => ({ value: s.leadSource, label: s.leadSource }));
  const receiverOptions = leadReceiversMaster
    .filter(r => !formData.leadType || r.leadType === formData.leadType)
    .map(r => ({ value: r.personName, label: r.personName }));
  const callerOptions = callerNamesMaster
    .filter(c => !formData.leadType || c.leadType === formData.leadType)
    .map(c => ({ value: c.personName, label: c.personName }));

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Receiver/Caller lists are filtered by Lead Type — clear stale picks when it changes
      if (field === 'leadType') {
        updated.leadReceiver = '';
        updated.callerAssigned = '';
      }
      return updated;
    });
  };

  const handleClose = () => {
    setFormData({ ...initialFormData, callerAssigned: user?.name || '' });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.leadType) { toast.error('Lead Type is required'); return; }
    if (!formData.leadSource) { toast.error('Lead Source is required'); return; }
    if (!formData.personName.trim()) { toast.error('Person Name is required'); return; }
    if (!formData.number.trim()) { toast.error('Number is required'); return; }
    if (formData.number.length !== 10) { toast.error('Number must be exactly 10 digits'); return; }
    if (!formData.callerAssigned) { toast.error('Caller Assigned to is required'); return; }
    
    const isTerminal = TERMINAL_STATUSES.includes(formData.status);
    const showCustomerSaid = formData.status !== 'Call Not Received';

    if (!formData.status) { toast.error('Status is required'); return; }
    if (showCustomerSaid && !formData.customerSaid.trim()) { toast.error('What did Customer Said is required'); return; }
    if (!isTerminal && !formData.nextCallDate) { toast.error('Next Call Date is required'); return; }

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
      personName: formData.personName,
      number: formData.number,
      email: formData.email,
      dob: formData.dob,
      occupation: formData.occupation,
      investmentBudget: formData.investmentBudget,
      location: formData.location,
      whenToBuyPlan: formData.whenToBuyPlan,
      callerAssigned: formData.callerAssigned,
      requirement: formData.requirement,
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
      <div className="grid grid-cols-2 gap-2 md:gap-4">

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

        {/* Requirement */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Requirement</label>
          <div className="relative">
            <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.requirement}
              onChange={(e) => handleChange('requirement', e.target.value)}
              placeholder="e.g. 2BHK Apartment / SIP Plan"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>

        {/* Investment Range */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Investment Range</label>
          <div className="relative">
            <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={formData.investmentBudget}
              onChange={(e) => handleChange('investmentBudget', e.target.value)}
              placeholder="Enter investment range"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
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
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Next Call Date *</label>
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
