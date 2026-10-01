import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, ClipboardList, Clock, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildShareClient } from '../../utils/productShare';
import { callTrackerApi } from '../../api/callTrackerApi';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { ENQUIRY_STATUSES, TERMINAL_STATUSES, DATE_STATUSES, CUSTOMER_STATUSES } from './callTrackerConstants';
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
  customerStatus: '',
  customerSaid: '',
  nextDate: '',
  requirement: '',
  requirementOption: '',
  customRequirement: '',
  customProductType: '',
  insuranceType: '',
  customInsuranceType: '',
  insuranceSubType: '',
  customInsuranceSubType: '',
  investmentBudget: '',
  whenToBuyPlan: ''
};

export default function FormTracker({ isOpen, onClose, lead, onSaved }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...initialFormState });
  const [requirementsList, setRequirementsList] = useState([]);
  const [realEstateProductsList, setRealEstateProductsList] = useState([]);
  const [mutualFundProductsList, setMutualFundProductsList] = useState([]);
  const [insuranceProductsList, setInsuranceProductsList] = useState([]);
  const [insuranceSubProductsList, setInsuranceSubProductsList] = useState([]);
  const [investmentBudgetsList, setInvestmentBudgetsList] = useState([]);

  const wasOpenRef = useRef(false);
  const lastLeadIdRef = useRef(null);

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

  const isOtherValue = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    return lower === 'other' || lower === 'others';
  };

  const isRealEstate =
    (lead?.leadType || '').trim().toLowerCase() === 'real estate' ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LR');
  const isMutualFund = (lead?.leadType || '').trim().toLowerCase() === 'mutual fund';
  const isInsurance = (lead?.leadType || '').trim().toLowerCase().includes('insurance');

  // Only reset the outcome fields when the modal first opens or a different lead is opened
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const currentLeadId = lead?.id || lead?.leadNo;
    const isFirstOpen = !wasOpenRef.current;
    const isNewLead = currentLeadId && currentLeadId !== lastLeadIdRef.current;

    if (lead && (isFirstOpen || isNewLead)) {
      wasOpenRef.current = true;
      lastLeadIdRef.current = currentLeadId;

      const rawProduct = (lead.productType || '').trim();
      const masterProductList = isRealEstate ? realEstateProductsList : (isMutualFund ? mutualFundProductsList : []);
      const isProductPreset = rawProduct && masterProductList.some(
        opt => !isOtherValue(opt.productType) && opt.productType.toLowerCase() === rawProduct.toLowerCase()
      );

      const rawIns = (lead.insuranceType || lead.productType || '').trim();
      const isInsPreset = rawIns && insuranceProductsList.some(
        opt => !isOtherValue(opt.productType) && opt.productType.toLowerCase() === rawIns.toLowerCase()
      );

      const rawSub = (lead.insuranceSubType || '').trim();
      const isSubPreset = rawSub && insuranceSubProductsList.some(
        opt => !isOtherValue(opt.subProductType) && opt.subProductType.toLowerCase() === rawSub.toLowerCase()
      );

      const req = (lead.requirement || '').trim();
      const isReqPreset = req && requirementsList.some(
        r => !isOtherValue(r.requirement) && r.requirement.toLowerCase() === req.toLowerCase()
      );

      setFormData({
        status: '',
        customerStatus: lead.customerStatus || '',
        customerSaid: '',
        nextDate: '',
        requirement: req,
        requirementOption: isReqPreset
          ? requirementsList.find(r => r.requirement.toLowerCase() === req.toLowerCase())?.requirement
          : (req ? 'Others' : ''),
        customRequirement: isReqPreset ? '' : req,
        productType: isProductPreset ? rawProduct : (rawProduct ? 'Others' : ''),
        customProductType: isProductPreset ? '' : rawProduct,
        insuranceType: isInsPreset ? rawIns : (rawIns ? 'Others' : ''),
        customInsuranceType: isInsPreset ? '' : rawIns,
        insuranceSubType: isSubPreset ? rawSub : (rawSub ? 'Others' : ''),
        customInsuranceSubType: isSubPreset ? '' : rawSub,
        investmentBudget: lead.investmentBudget || '',
        whenToBuyPlan: lead.whenToBuyPlan || ''
      });
    }
  }, [isOpen, lead, requirementsList, realEstateProductsList, mutualFundProductsList, insuranceProductsList, insuranceSubProductsList]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'status' && !DATE_STATUSES.includes(value)) {
        updated.nextDate = '';
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

  const requirementOptions = useMemo(() => {
    const opts = (requirementsList || []).map(r => ({ value: r.requirement, label: r.requirement }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [requirementsList]);

  const realEstateProductOptions = useMemo(() => {
    const opts = (realEstateProductsList || []).map(t => ({ value: t.productType, label: t.productType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [realEstateProductsList]);

  const mutualFundProductOptions = useMemo(() => {
    const opts = (mutualFundProductsList || []).map(t => ({ value: t.productType, label: t.productType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [mutualFundProductsList]);

  const insuranceProductOptions = useMemo(() => {
    const opts = (insuranceProductsList || []).map(t => ({ value: t.productType, label: t.productType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [insuranceProductsList]);

  const insuranceSubProductOptions = useMemo(() => {
    const currentInsType = isOtherValue(formData.insuranceType)
      ? (formData.customInsuranceType || '')
      : formData.insuranceType;
    const opts = (insuranceSubProductsList || [])
      .filter(s => s.productType?.toLowerCase().trim() === currentInsType?.toLowerCase().trim())
      .map(s => ({ value: s.subProductType, label: s.subProductType }));
    if (!opts.some(o => isOtherValue(o.value))) {
      opts.push({ value: 'Others', label: 'Others' });
    }
    return opts;
  }, [insuranceSubProductsList, formData.insuranceType, formData.customInsuranceType]);

  const investmentBudgetOptions = investmentBudgetsList.map(t => ({ value: t.investmentBudget, label: t.investmentBudget }));

  // Read-only reference fields shown at the top of the form — everything NOT editable below
  const infoFields = [
    { key: 'leadType', label: 'Lead Type' },
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

  const handleShareProducts = () => {
    const shareClient = buildShareClient(lead);
    handleClose();
    navigate('/products', { state: { shareClient } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.status) { toast.error('Enquiry Received Status is required'); return; }
    if (!formData.customerStatus) { toast.error('Customer Status is required'); return; }
    if (!formData.customerSaid.trim()) { toast.error('What did Customer said is required'); return; }

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

    setLoading(true);

    try {
      if (isRealEstate && isOtherValue(formData.productType) && finalProductType) {
        const exists = (realEstateProductsList || []).some(
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
        const exists = (mutualFundProductsList || []).some(
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
        const exists = (insuranceProductsList || []).some(
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
        const exists = (requirementsList || []).some(
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
        const exists = (insuranceSubProductsList || []).some(
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

      // 1. Persist any editable-field changes back to the lead itself
      const updates = {};
      if (formData.investmentBudget !== (lead.investmentBudget || '')) updates.investmentBudget = formData.investmentBudget;
      if (formData.whenToBuyPlan !== (lead.whenToBuyPlan || '')) updates.whenToBuyPlan = formData.whenToBuyPlan;

      if (isRealEstate) {
        const reqToSave = isOtherValue(formData.requirementOption || formData.requirement) ? finalRequirement : formData.requirement;
        const prodToSave = isOtherValue(formData.productType) ? finalProductType : formData.productType;
        if (reqToSave !== (lead.requirement || '')) updates.requirement = reqToSave;
        if (prodToSave !== (lead.productType || '')) updates.productType = prodToSave;
      } else if (isMutualFund) {
        const prodToSave = isOtherValue(formData.productType) ? finalProductType : formData.productType;
        if (prodToSave !== (lead.productType || '')) updates.productType = prodToSave;
      } else if (isInsurance) {
        const insTypeToSave = isOtherValue(formData.insuranceType) ? finalInsuranceType : formData.insuranceType;
        const subToSave = isOtherValue(formData.insuranceSubType) ? finalInsuranceSubType : formData.insuranceSubType;
        if (insTypeToSave !== (lead.insuranceType || '')) updates.insuranceType = insTypeToSave;
        if (subToSave !== (lead.insuranceSubType || '')) updates.insuranceSubType = subToSave;
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
        customerStatus: formData.customerStatus,
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
      title={`Followup Call - ${lead.personName || lead.customerName || 'Lead'}${lead.leadNo ? ` (${lead.leadNo})` : ''}`}
      onSubmit={handleSubmit}
      submitText={loading ? 'Saving...' : 'Save Followup'}
      loading={loading}
      maxWidth="max-w-2xl"
    >
      {/* Share Products — opens the Products page filtered to this client's lead type */}
      <div className="flex justify-end -mt-1 mb-1">
        <button
          type="button"
          onClick={handleShareProducts}
          title={`Share ${lead.leadType || ''} products with ${lead.personName || lead.customerName || 'this client'}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition active:scale-95"
        >
          <Share2 size={13} />
          <span>Share Products</span>
        </button>
      </div>

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
              {isOtherValue(formData.productType) && (
                <div className="relative mt-1.5 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={formData.customProductType}
                    onChange={(e) => handleChange('customProductType', e.target.value)}
                    placeholder="Enter new product type"
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Requirement</label>
              <SearchableDropdown
                options={requirementOptions}
                value={formData.requirementOption}
                onChange={handleRequirementOptionChange}
                placeholder="Select requirement"
              />
              {isOtherValue(formData.requirementOption) && (
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
            {isOtherValue(formData.productType) && (
              <div className="relative mt-1.5 animate-in fade-in duration-200">
                <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={formData.customProductType}
                  onChange={(e) => handleChange('customProductType', e.target.value)}
                  placeholder="Enter new product type"
                  className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                />
              </div>
            )}
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
              {isOtherValue(formData.insuranceType) && (
                <div className="relative mt-1.5 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={formData.customInsuranceType}
                    onChange={(e) => handleChange('customInsuranceType', e.target.value)}
                    placeholder="Enter new product type"
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1 animate-in fade-in duration-200">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Sub Product Type</label>
              <SearchableDropdown
                options={insuranceSubProductOptions}
                value={formData.insuranceSubType}
                onChange={(val) => handleChange('insuranceSubType', val)}
                placeholder={`Select ${isOtherValue(formData.insuranceType) ? (formData.customInsuranceType || 'product') : formData.insuranceType} sub type`}
              />
              {isOtherValue(formData.insuranceSubType) && (
                <div className="relative mt-1.5 animate-in fade-in duration-200">
                  <ClipboardList className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={formData.customInsuranceSubType}
                    onChange={(e) => handleChange('customInsuranceSubType', e.target.value)}
                    placeholder="Enter new sub product type"
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
                  />
                </div>
              )}
            </div>
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

        {/* Customer Status (Hot / Warm / Cold) */}
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Customer Status *</label>
          <SearchableDropdown
            options={CUSTOMER_STATUSES.map(v => ({ value: v, label: v }))}
            value={formData.customerStatus}
            onChange={(val) => handleChange('customerStatus', val)}
            placeholder="Select Hot / Warm / Cold"
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
                <input
                  type="date"
                  value={formData.nextDate}
                  onChange={(e) => handleChange('nextDate', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] [color-scheme:light]"
                />
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
