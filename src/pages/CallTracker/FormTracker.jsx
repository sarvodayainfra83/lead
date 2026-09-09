import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Calendar, MessageSquare, Briefcase } from 'lucide-react';
import { callTrackerApi } from '../../api/callTrackerApi';
import { leadApi } from '../../api/leadApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { ENQUIRY_STATUSES, TERMINAL_STATUSES } from './callTrackerConstants';
import { REQUIREMENT_OPTIONS } from '../Lead/leadConstants';

/**
 * FormTracker
 * Pop-up "Call Now" modal opened from PendingTracker. Shows the lead's details for
 * reference, then logs the outcome of the call as a new Call Tracker history entry.
 *
 * Props:
 *   isOpen  – boolean
 *   onClose – fn()
 *   lead    – the lead being called
 *   onSaved – fn() called after a successful save so the parent can refresh
 */
const initialFormState = {
  status: '',
  customerSaid: '',
  nextDate: '',
  requirement: '',
  requirementOption: '',
  customRequirement: ''
};

// Read-only reference fields shown at the top of the form
const infoFields = [
  { key: 'personName', label: 'Person Name' },
  { key: 'number', label: 'Number' },
  { key: 'email', label: 'Email' },
  { key: 'dob', label: 'DOB' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'investmentBudget', label: 'Investment Range' },
  { key: 'location', label: 'Address' },
  { key: 'whenToBuyPlan', label: 'When to Buy Plan' }
];

export default function FormTracker({ isOpen, onClose, lead, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...initialFormState });

  // Reset the outcome fields whenever a new lead is opened for calling
  useEffect(() => {
    if (lead) {
      const req = (lead.requirement || '').trim();
      const isPreset = REQUIREMENT_OPTIONS.some(
        opt => opt.value !== 'Other' && opt.value.toLowerCase() === req.toLowerCase()
      );
      setFormData({
        status: '',
        customerSaid: '',
        nextDate: '',
        requirement: req,
        requirementOption: isPreset
          ? REQUIREMENT_OPTIONS.find(opt => opt.value.toLowerCase() === req.toLowerCase())?.value
          : (req ? 'Other' : ''),
        customRequirement: isPreset ? '' : req
      });
    }
  }, [lead]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'status' && value?.toLowerCase() === 'not interested') {
        updated.nextDate = '';
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

  const isRealEstate =
    (lead?.leadType || '').trim().toLowerCase() === 'real estate' ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LR');

  const handleClose = () => {
    setFormData({ ...initialFormState });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const showCustomerSaid = formData.status !== 'Call Not Received';
    const isNotInterested = formData.status?.toLowerCase() === 'not interested';

    if (!formData.status) { toast.error('Enquiry Received Status is required'); return; }
    if (showCustomerSaid && !formData.customerSaid.trim()) { toast.error('What did Customer said is required'); return; }

    setLoading(true);

    try {
      // 1. If requirement has been modified or provided for real estate leads, persist it to the lead
      if (isRealEstate && formData.requirement !== undefined && formData.requirement !== lead.requirement) {
        await leadApi.updateLead(lead.id || lead.leadNo, { requirement: formData.requirement });
      }

      // 2. Save the call tracker entry
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const entry = {
        leadId: lead.id,
        leadNo: lead.leadNo,
        status: formData.status,
        customerSaid: showCustomerSaid ? formData.customerSaid : '',
        nextDate: isNotInterested ? '' : formData.nextDate,
        timestamp,
        timestampMs: now.getTime()
      };

      await callTrackerApi.saveCallTracker(entry);

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
      title={`Call Now - ${lead.personName || lead.customerName || 'Lead'} (${lead.leadNo})`}
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Save Call Log'}
      maxWidth="max-w-2xl"
    >
      {/* Lead Details Read-Only Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded p-3 text-xs mb-2">
        {infoFields.map(f => (
          <div key={f.key} className="space-y-0.5">
            <span className="text-[10px] text-gray-700 uppercase tracking-tight font-medium">{f.label}</span>
            <p className="text-gray-900 font-semibold truncate text-[11px] md:text-[12px]">
              {lead[f.key] || '-'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">

        {/* Editable Requirement Field - Only shown for Real Estate leads */}
        {isRealEstate && (
          <div className="space-y-1 col-span-2 animate-in fade-in duration-200">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">
              Requirement
            </label>
            <SearchableDropdown
              options={REQUIREMENT_OPTIONS}
              value={formData.requirementOption}
              onChange={handleRequirementOptionChange}
              placeholder="Select requirement"
            />
            {formData.requirementOption === 'Other' && (
              <div className="relative mt-1.5 animate-in fade-in duration-200">
                <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
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
        )}

        {/* Enquiry Received Status */}
        <div className="space-y-1 col-span-2">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Enquiry Received Status *</label>
          <SearchableDropdown
            options={ENQUIRY_STATUSES.map(v => ({ value: v, label: v }))}
            value={formData.status}
            onChange={(val) => handleChange('status', val)}
            placeholder="Select status"
          />
        </div>

        {formData.status && (
          <>
            {/* What did Customer said — not applicable when the call wasn't received */}
            {formData.status !== 'Call Not Received' && (
              <div className="space-y-1 col-span-2">
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">What did Customer said *</label>
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

            {/* Date / Next Date — not applicable when Not Interested */}
            {formData.status?.toLowerCase() !== 'not interested' && (
              <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">
                  {formData.status === 'Received' ? 'Date' : 'Next Date'}
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                  <input
                    type="date"
                    value={formData.nextDate}
                    onChange={(e) => handleChange('nextDate', e.target.value)}
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
