import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  User, Phone, Mail, Calendar,
  Briefcase, Wallet, MapPin, Clock, MessageSquare, ClipboardList
} from 'lucide-react';
import {
  updateLead,
  getLeadTypesMaster, getLeadSourcesMaster, getLeadReceiversMaster, getCallerNamesMaster
} from '../../utils/storageManager';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';

/**
 * LeadEdit
 * Pop-up modal that pre-fills all lead fields for editing.
 *
 * Props:
 *   isOpen    – boolean
 *   onClose   – fn()
 *   lead      – the lead object to edit
 *   onUpdated – fn() called after a successful save so parent can refresh
 */
export default function LeadEdit({ isOpen, onClose, lead, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
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
    remarks: ''
  });

  const leadTypeOptions = getLeadTypesMaster().map(t => ({ value: t.leadType, label: t.leadType }));
  const leadSourceOptions = getLeadSourcesMaster().map(s => ({ value: s.leadSource, label: s.leadSource }));
  const receiverOptions = getLeadReceiversMaster()
    .filter(r => !formData.leadType || r.leadType === formData.leadType)
    .map(r => ({ value: r.personName, label: r.personName }));
  const callerOptions = getCallerNamesMaster()
    .filter(c => !formData.leadType || c.leadType === formData.leadType)
    .map(c => ({ value: c.personName, label: c.personName }));

  // Populate form whenever the modal opens with a new lead
  useEffect(() => {
    if (lead) {
      setFormData({
        leadType: lead.leadType || '',
        leadReceiver: lead.leadReceiver || '',
        leadSource: lead.leadSource || '',
        personName: lead.personName || '',
        number: lead.number || '',
        email: lead.email || '',
        dob: lead.dob || '',
        occupation: lead.occupation || '',
        investmentBudget: lead.investmentBudget || '',
        location: lead.location || '',
        whenToBuyPlan: lead.whenToBuyPlan || '',
        callerAssigned: lead.callerAssigned || '',
        requirement: lead.requirement || '',
        remarks: lead.remarks || ''
      });
    }
  }, [lead]);

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

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.leadType) { toast.error('Lead Type is required'); return; }
    if (!formData.leadReceiver) { toast.error('Lead Receiver Name is required'); return; }
    if (!formData.leadSource) { toast.error('Lead Source is required'); return; }
    if (!formData.personName.trim()) { toast.error('Person Name is required'); return; }
    if (!formData.number.trim()) { toast.error('Number is required'); return; }
    if (formData.number.length !== 10) { toast.error('Number must be exactly 10 digits'); return; }
    if (!formData.callerAssigned) { toast.error('Caller Assigned to is required'); return; }

    setLoading(true);

    const updated = {
      ...lead,
      ...formData,
      updatedAt: new Date().toISOString()
    };

    updateLead(updated);
    toast.success(`Lead ${lead.leadNo} updated successfully`);
    setLoading(false);
    onUpdated?.();
    onClose();
  };

  if (!isOpen || !lead) return null;

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Lead — ${lead.leadNo}`}
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Update'}
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
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Receiver Name *</label>
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
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Person Name *</label>
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
