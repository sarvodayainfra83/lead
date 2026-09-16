import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare } from 'lucide-react';
import { visitorFollowUpApi } from '../../api/visitorFollowUpApi';
import SearchableDropdown from '../../components/SearchableDropdown';
import {
  VISITOR_STATUS_OPTIONS,
  INTEREST_LEVEL_OPTIONS
} from './visitorFollowUpConstants';
import { getLeadTypeTextClass } from '../../utils/leadTypeColors';

export default function VisitorFollowUpModal({ isOpen, onClose, lead, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    interestLevel: '',
    whatHappened: '',
    nextVisitDate: ''
  });

  useEffect(() => {
    if (lead && isOpen) {
      setFormData({
        status: '',
        interestLevel: lead.interestLevel || '',
        whatHappened: '',
        nextVisitDate: ''
      });
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const statusOptions = VISITOR_STATUS_OPTIONS.map(s => ({ value: s, label: s }));
  const interestOptions = INTEREST_LEVEL_OPTIONS.map(i => ({ value: i, label: i }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.status) {
      toast.error('Please select a status');
      return;
    }

    if (!formData.whatHappened.trim()) {
      toast.error('What Happened / Customer Feedback is required');
      return;
    }

    if ((formData.status === 'Future Plan' || formData.status === 'Did Not Show') && !formData.nextVisitDate) {
      toast.error('Next Visit Date is required');
      return;
    }

    setLoading(true);

    try {
      const entry = {
        leadId: lead.id,
        leadNo: lead.leadNo,
        assignedVisitorId: lead.assignedVisitorId || null,
        visitorName: lead.assignedVisitor || lead.visitorName || '',
        visitorId: lead.visitorId || null,
        visitDate: lead.visitDate || null,
        status: formData.status,
        interestLevel: formData.interestLevel || null,
        whatHappened: formData.whatHappened.trim(),
        nextVisitDate: (formData.status === 'Future Plan' || formData.status === 'Did Not Show') ? formData.nextVisitDate : null,
        dealOutcome: formData.status === 'Not Interested' ? 'Rejected (Lost)' : null,
        rejectionReason: formData.status === 'Not Interested' ? 'Not Interested' : null,
        salesExecutive: null,
        closingAmount: null,
        referenceNo: null,
        dealRemarks: null,
        followUpNo: (lead.followUpNo || 0) + 1,
        timestampMs: Date.now()
      };

      await visitorFollowUpApi.saveVisitorFollowUp(entry);
      toast.success(`Follow-up saved successfully for Lead ${lead.leadNo}`);
      setLoading(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save visitor follow up:', err);
      toast.error('Failed to save follow-up. Please try again.');
      setLoading(false);
    }
  };

  const isRealEstate =
    (lead?.leadType || '').trim().toLowerCase() === 'real estate' ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LR');
  const isMutualFund = (lead?.leadType || '').trim().toLowerCase() === 'mutual fund';
  const isInsurance = (lead?.leadType || '').trim().toLowerCase().includes('insurance');

  // Comprehensive lead information fields shown in top card
  const leadInfoFields = [
    { key: 'leadType', label: 'Lead Type', value: lead.leadType, highlight: true, highlightClass: getLeadTypeTextClass(lead.leadType) },
    { key: 'caller', label: 'Caller Name', value: lead.callerAssigned || lead.caller || lead.callerName || '-' },
    { key: 'leadReceiver', label: 'Team Member Name', value: lead.relationshipManager || lead.leadReceiver || '-' },
    { key: 'leadSource', label: 'Lead Source', value: lead.leadSource || '-' },
    { key: 'referencerName', label: 'Reference Name', value: lead.referencerName || lead.referenceName || '-' },
    { key: 'customerName', label: 'Customer Name', value: lead.customerName || lead.personName || '-' },
    { key: 'customerNumber', label: 'Customer Number', value: lead.customerNumber || lead.number || '-' },
    { key: 'customerEmail', label: 'Customer Email', value: lead.customerEmail || lead.email || '-' },
    { key: 'dob', label: 'DOB', value: lead.dob || '-' },
    { key: 'occupation', label: 'Occupation', value: lead.occupation || '-' },
    { key: 'customerAddress', label: 'Customer Address', value: lead.customerAddress || lead.location || '-' },
    { key: 'investmentBudget', label: 'Investment Budget', value: lead.investmentBudget || '-' },
    { key: 'whenToBuyPlan', label: 'When To Buy Plan', value: lead.whenToBuyPlan || '-' },
    { key: 'assignedVisitor', label: 'Assigned Visitor', value: lead.assignedVisitor || lead.visitorName || '-' },
    { key: 'visitDate', label: 'Visit Date', value: lead.visitDate || lead.nextDate || '-' },
    ...(isRealEstate || isMutualFund || lead.productType ? [{ key: 'productType', label: 'Product Type', value: lead.productType || '-' }] : []),
    ...(isRealEstate || lead.requirement ? [{ key: 'requirement', label: 'Requirement', value: lead.customRequirement || lead.requirement || '-' }] : []),
    ...(isInsurance || lead.insuranceType ? [{ key: 'insuranceType', label: 'Insurance Type', value: lead.insuranceType || '-' }] : []),
    ...(isInsurance || lead.insuranceSubType ? [{ key: 'insuranceSubType', label: 'Sub Product Type', value: lead.insuranceSubType || '-' }] : []),
    ...(isInsurance || lead.anyDesease ? [{ key: 'anyDesease', label: 'Medical Condition', value: lead.anyDesease || lead.anyDisease || '-' }] : []),
    ...(lead.remarks ? [{ key: 'remarks', label: 'Remarks', value: lead.remarks }] : []),
    ...(lead.whatHappened ? [{ key: 'whatHappened', label: 'Last Conversation', value: lead.whatHappened }] : [])
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 tracking-wide uppercase">
            VISITOR FOLLOW UP — {lead.customerName || lead.personName || 'Lead'} ({lead.leadNo})
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Top Read-Only Summary Card matching Call Tracker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded p-3 text-xs mb-2 text-left">
            {leadInfoFields.map(f => (
              <div key={f.key || f.label} className="space-y-0.5">
                <span className="text-[10px] text-gray-700 uppercase tracking-tight font-medium leading-none block">{f.label}</span>
                <p className={`font-semibold truncate text-[11px] md:text-[12px] mt-0.5 ${f.highlight ? f.highlightClass : 'text-gray-900'}`} title={f.value || '-'}>
                  {f.value || '-'}
                </p>
              </div>
            ))}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">

            {/* 1. Status & Interest Level Dropdowns (Always shown side-by-side) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                  STATUS *
                </label>
                <SearchableDropdown
                  options={statusOptions}
                  value={formData.status}
                  onChange={(val) => handleChange('status', val)}
                  placeholder="Select status"
                  height="h-[38px]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                  INTEREST LEVEL
                </label>
                <SearchableDropdown
                  options={interestOptions}
                  value={formData.interestLevel}
                  onChange={(val) => handleChange('interestLevel', val)}
                  placeholder="Select interest level"
                  height="h-[38px]"
                />
              </div>
            </div>

            {/* 2. What Happened / Remarks (Shown when any status is selected) */}
            {formData.status && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                  WHAT HAPPENED / CUSTOMER FEEDBACK *
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 text-gray-400" size={16} />
                  <textarea
                    rows={3}
                    required
                    placeholder="Customer likes, objections, notes..."
                    value={formData.whatHappened}
                    onChange={(e) => handleChange('whatHappened', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* 3. Next Visit Date (Shown when status is Future Plan OR Did Not Show - Matches Screenshots 4 & 5) */}
            {(formData.status === 'Future Plan' || formData.status === 'Did Not Show') && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                  NEXT VISIT DATE *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.nextVisitDate}
                    onChange={(e) => handleChange('nextVisitDate', e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 h-[38px]"
                  />
                </div>
              </div>
            )}

            {/* 4. Not Interested Notice Box (Matches Screenshot 3) */}
            {formData.status === 'Not Interested' && (
              <div className="bg-gray-50 border border-gray-200 text-gray-600 rounded-lg p-3 text-xs animate-in fade-in duration-150">
                This will be recorded as a <span className="text-red-600 font-semibold">Rejected</span> deal (reason: Not Interested).
              </div>
            )}

          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-xs md:text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 uppercase transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 text-xs md:text-sm font-bold text-white bg-[#002b49] hover:bg-[#001f35] rounded-lg shadow-sm uppercase transition-colors disabled:opacity-50"
            >
              {loading ? 'SAVING...' : 'SAVE'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
