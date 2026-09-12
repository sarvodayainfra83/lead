import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Calendar, MessageSquare, ClipboardList, Clock } from 'lucide-react';
import { callTrackerApi } from '../../api/callTrackerApi';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { ENQUIRY_STATUSES, TERMINAL_STATUSES, DATE_STATUSES } from './callTrackerConstants';
import { getLeadTypeTextClass } from '../../utils/leadTypeColors';

/**
 * FormTracker
 * Pop-up "Call Now" modal opened from PendingTracker. Shows the lead's details for
 * reference, lets Product Type / Requirement / Sub Product Type / Investment Budget /
 * When to Buy Plan be updated on the spot (pre-filled from the lead's saved data), then logs
 * the outcome of the call as a new Call Tracker history entry.
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
  customRequirement: '',
  productType: '',
  insuranceType: '',
  insuranceSubType: '',
  investmentBudget: '',
  whenToBuyPlan: ''
};

export default function FormTracker({ isOpen, onClose, lead, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...initialFormState });
  const [requirementsList, setRequirementsList] = useState([]);
  const [realEstateProductsList, setRealEstateProductsList] = useState([]);
  const [mutualFundProductsList, setMutualFundProductsList] = useState([]);
  const [insuranceProductsList, setInsuranceProductsList] = useState([]);
  const [insuranceSubProductsList, setInsuranceSubProductsList] = useState([]);
  const [investmentBudgetsList, setInvestmentBudgetsList] = useState([]);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        masterApi.getRealEstateRequirements(),
        masterApi.getRealEstateProducts(),
        masterApi.getMutualFundProducts(),
        masterApi.getInsuranceProducts(),
        masterApi.getInsuranceSubProducts(),
        masterApi.getInvestmentBudgets()
      ]).then(([requirements, reProducts, mfProducts, insProducts, insSubProducts, budgets]) => {
        setRequirementsList(requirements);
        setRealEstateProductsList(reProducts);
        setMutualFundProductsList(mfProducts);
        setInsuranceProductsList(insProducts);
        setInsuranceSubProductsList(insSubProducts);
        setInvestmentBudgetsList(budgets);
      }).catch(console.error);
    }
  }, [isOpen]);

  // Reset the outcome fields whenever a new lead is opened for calling
  useEffect(() => {
    if (lead) {
      const req = (lead.requirement || '').trim();
      const isPreset = requirementsList.some(
        r => r.requirement !== 'Other' && r.requirement.toLowerCase() === req.toLowerCase()
      );
      setFormData({
        status: '',
        customerSaid: '',
        nextDate: '',
        requirement: req,
        requirementOption: isPreset
          ? requirementsList.find(r => r.requirement.toLowerCase() === req.toLowerCase())?.requirement
          : (req ? 'Other' : ''),
        customRequirement: isPreset ? '' : req,
        productType: lead.productType || '',
        insuranceType: lead.insuranceType || '',
        insuranceSubType: lead.insuranceSubType || '',
        investmentBudget: lead.investmentBudget || '',
        whenToBuyPlan: lead.whenToBuyPlan || ''
      });
    }
  }, [lead, requirementsList]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'status' && !DATE_STATUSES.includes(value)) {
        updated.nextDate = '';
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

  const requirementOptions = requirementsList.map(r => ({ value: r.requirement, label: r.requirement }));
  const realEstateProductOptions = realEstateProductsList.map(t => ({ value: t.productType, label: t.productType }));
  const mutualFundProductOptions = mutualFundProductsList.map(t => ({ value: t.productType, label: t.productType }));
  const insuranceProductOptions = insuranceProductsList.map(t => ({ value: t.productType, label: t.productType }));
  const insuranceSubProductOptions = insuranceSubProductsList
    .filter(s => s.productType === formData.insuranceType)
    .map(s => ({ value: s.subProductType, label: s.subProductType }));
  const investmentBudgetOptions = investmentBudgetsList.map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));

  const isRealEstate =
    (lead?.leadType || '').trim().toLowerCase() === 'real estate' ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LR');
  const isMutualFund = (lead?.leadType || '').trim().toLowerCase() === 'mutual fund';
  const isInsurance = (lead?.leadType || '').trim().toLowerCase().includes('insurance');

  // Read-only reference fields shown at the top of the form — everything NOT editable below
  // (Product Type / Requirement / Sub Product Type / Investment Budget / When to Buy Plan are
  // all editable further down instead).
  const infoFields = [
    { key: 'leadType', label: 'Lead Type' },
    // Direct-created leads never collect a Team Member Name (Direct.jsx captures Caller Name
    // instead) — show whichever one this lead actually has instead of a permanently blank field.
    lead?.processType === 'Direct'
      ? { key: 'callerAssigned', label: 'Caller Name' }
      : { key: 'leadReceiver', label: 'Team Member Name' },
    { key: 'leadSource', label: 'Lead Source' },
    { key: 'referencerName', label: 'Reference Name' },
    { key: 'personName', label: 'Customer Name' },
    { key: 'number', label: 'Customer Number' },
    { key: 'email', label: 'Customer Email' },
    { key: 'dob', label: 'DOB' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'location', label: 'Customer Address' },
    ...(isInsurance ? [{ key: 'anyDesease', label: 'Medical Condition' }] : [])
  ];

  const handleClose = () => {
    setFormData({ ...initialFormState });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.status) { toast.error('Enquiry Received Status is required'); return; }
    if (!formData.customerSaid.trim()) { toast.error('What did Customer said is required'); return; }

    setLoading(true);

    try {
      // 1. Persist any editable-field changes back to the lead itself
      const updates = {};
      if (formData.investmentBudget !== (lead.investmentBudget || '')) updates.investmentBudget = formData.investmentBudget;
      if (formData.whenToBuyPlan !== (lead.whenToBuyPlan || '')) updates.whenToBuyPlan = formData.whenToBuyPlan;

      if (isRealEstate) {
        if (formData.requirement !== (lead.requirement || '')) updates.requirement = formData.requirement;
        if (formData.productType !== (lead.productType || '')) updates.productType = formData.productType;
      } else if (isMutualFund) {
        if (formData.productType !== (lead.productType || '')) updates.productType = formData.productType;
      } else if (isInsurance) {
        if (formData.insuranceType !== (lead.insuranceType || '')) updates.insuranceType = formData.insuranceType;
        if (formData.insuranceSubType !== (lead.insuranceSubType || '')) updates.insuranceSubType = formData.insuranceSubType;
      }

      if (Object.keys(updates).length > 0) {
        await leadApi.updateLead(lead.id || lead.leadNo, updates);
      }

      // 2. Save the call tracker entry
      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const entry = {
        leadId: lead.id,
        leadNo: lead.leadNo,
        status: formData.status,
        customerSaid: formData.customerSaid,
        nextDate: DATE_STATUSES.includes(formData.status) ? formData.nextDate : '',
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
      loading={loading}
      maxWidth="max-w-2xl"
    >
      {/* Lead Details Read-Only Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded p-3 text-xs mb-2">
        {infoFields.map(f => (
          <div key={f.key} className="space-y-0.5">
            <span className="text-[10px] text-gray-700 uppercase tracking-tight font-medium">{f.label}</span>
            <p className={`font-semibold truncate text-[11px] md:text-[12px] ${f.key === 'leadType' ? getLeadTypeTextClass(lead[f.key]) : 'text-gray-900'}`}>
              {lead[f.key] || '-'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">

        {/* REAL ESTATE: Product Type & Requirement — editable, pre-filled from the lead */}
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
                options={requirementOptions}
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

        {/* MUTUAL FUND: Product Type — editable, pre-filled from the lead */}
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

        {/* INSURANCE: Product Type & Sub Product Type — editable, pre-filled from the lead */}
        {isInsurance && (
          <>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Product Type</label>
              <SearchableDropdown
                options={insuranceProductOptions}
                value={formData.insuranceType}
                onChange={(val) => handleChange('insuranceType', val)}
                placeholder="Select product type"
              />
            </div>
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

        {/* Investment Budget — editable, pre-filled from the lead, every lead type */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Investment Budget</label>
          <SearchableDropdown
            options={investmentBudgetOptions}
            value={formData.investmentBudget}
            onChange={(val) => handleChange('investmentBudget', val)}
            placeholder="Select investment budget"
          />
        </div>

        {/* When to Buy Plan — editable, pre-filled from the lead, every lead type */}
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

        {/* Enquiry Received Status — shares a row with the Date field below it (when shown)
            instead of forcing it onto its own full-width row alone */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
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
            {/* Date — Future Plan Date's next-call date, or the Site Visit/Meeting date — shown
                above What did Customer said whenever this status collects one */}
            {DATE_STATUSES.includes(formData.status) && (
              <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
                <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">
                  {formData.status === 'Future Plan Date' ? 'Future Plan Date' : 'Site Visit/Meeting Date'}
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

            {/* What did Customer said — asked for every status */}
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
          </>
        )}
      </div>
    </ModalForm>
  );
}
