import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Calendar, MessageSquare } from 'lucide-react';
import { callTrackerApi } from '../../api/callTrackerApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { ENQUIRY_STATUSES, TERMINAL_STATUSES } from './callTrackerConstants';

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
const initialFormState = { status: '', customerSaid: '', nextDate: '' };

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
      setFormData({ ...initialFormState });
    }
  }, [lead]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setFormData({ ...initialFormState });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const showCustomerSaid = formData.status !== 'Call Not Received';

    if (!formData.status) { toast.error('Enquiry Received Status is required'); return; }
    if (showCustomerSaid && !formData.customerSaid.trim()) { toast.error('What did Customer said is required'); return; }
    if (!formData.nextDate) { toast.error(`${formData.status === 'Received' ? 'Date' : 'Next Date'} is required`); return; }

    setLoading(true);

    const now = new Date();
    const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const entry = {
      leadId: lead.id,
      leadNo: lead.leadNo,
      status: formData.status,
      customerSaid: showCustomerSaid ? formData.customerSaid : '',
      nextDate: formData.nextDate,
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
  };

  if (!isOpen || !lead) return null;

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title={`Call Tracker — ${lead.leadNo}`}
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Save'}
      maxWidth="max-w-2xl"
    >
      {/* Pre-filled lead reference info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-gray-200 rounded-lg p-3 mb-2">
        {infoFields.map(({ key, label }) => (
          <div key={key} className="min-w-0">
            <p className="text-[8px] text-gray-400 uppercase tracking-tighter">{label}</p>
            <p className="text-[11px] md:text-[12px] text-gray-800 font-medium truncate">{lead[key] || '-'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-4">

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

            {/* Date / Next Date */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">
                {formData.status === 'Received' ? 'Date' : 'Next Date'} *
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
          </>
        )}
      </div>
    </ModalForm>
  );
}
