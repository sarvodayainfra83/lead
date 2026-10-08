import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, User, Phone, Mail, MapPin, Calendar, Briefcase, Wallet, Clock, FileText, Activity } from 'lucide-react';
import SearchableDropdown from '../../../components/SearchableDropdown';
import { getInvestmentBudgetsForLeadType } from '../leadConstants';

export default function BulkLeadEditModal({
  isOpen,
  onClose,
  row,
  leadType,
  masterData = {},
  onSave
}) {
  if (!isOpen || !row) return null;

  const {
    productMaster = [],
    requirementsMaster = [],
    investmentBudgetsMaster = [],
    insuranceSubProductsMaster = []
  } = masterData;

  const isRealEstate = (leadType || '').toLowerCase().includes('real') || (leadType || '').toLowerCase().includes('estate');
  const isInsurance = (leadType || '').toLowerCase().includes('insurance');
  const isMutualFund = (leadType || '').toLowerCase().includes('mutual') || (leadType || '').toLowerCase().includes('fund');

  const [formData, setFormData] = useState({
    customerName: row.customerName || '',
    customerNumber: row.customerNumber || '',
    customerEmail: row.customerEmail || '',
    dob: row.dob || '',
    occupation: row.occupation || '',
    customerAddress: row.customerAddress || '',
    investmentBudget: row.investmentBudget || '',
    whenToBuyPlan: row.whenToBuyPlan || '',
    productType: row.productType || '',
    requirement: row.requirement || '',
    insuranceSubType: row.insuranceSubType || '',
    anyDesease: row.anyDesease || '',
    referencerName: row.referencerName || '',
    remarks: row.remarks || ''
  });

  const productOptions = useMemo(() => {
    return (productMaster || []).map(p => ({
      value: p.productType,
      label: p.productType
    }));
  }, [productMaster]);

  const requirementOptions = useMemo(() => {
    return (requirementsMaster || []).map(r => ({
      value: r.requirement,
      label: r.requirement
    }));
  }, [requirementsMaster]);

  const budgetOptions = useMemo(() => {
    return getInvestmentBudgetsForLeadType(investmentBudgetsMaster, leadType).map(b => ({
      value: b.investmentBudget,
      label: b.investmentBudget
    }));
  }, [investmentBudgetsMaster, leadType]);

  const subProductOptions = useMemo(() => {
    return (insuranceSubProductsMaster || []).map(s => ({
      value: s.subProductType,
      label: s.subProductType
    }));
  }, [insuranceSubProductsMaster]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...row,
      ...formData
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3.5 sm:p-5 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-200 bg-white/10 px-2 py-0.5 rounded-lg border border-white/20">
              Row #{row.rowIndex}
            </span>
            <span className="text-sm font-bold text-white">
              Edit Imported Lead Record
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              {leadType}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing Issues Banner (if any) */}
        {(row.errors?.length > 0 || row.warnings?.length > 0) && (
          <div className="px-4 py-2 bg-slate-50 border-b border-gray-200 text-xs space-y-1">
            {row.errors?.map((err, i) => (
              <div key={i} className="text-rose-600 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>{err}</span>
              </div>
            ))}
            {row.warnings?.map((warn, i) => (
              <div key={i} className="text-amber-600 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Name */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => handleChange('customerName', e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Customer Number */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Customer Number (10 Digits) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  maxLength={10}
                  value={formData.customerNumber}
                  onChange={(e) => handleChange('customerNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Customer Email */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Customer Email
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleChange('customerEmail', e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* DOB */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Occupation */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Occupation / Profession
              </label>
              <div className="relative">
                <Briefcase size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => handleChange('occupation', e.target.value)}
                  placeholder="Job / Business"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Address / Location */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Customer Address / Location
              </label>
              <div className="relative">
                <MapPin size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={formData.customerAddress}
                  onChange={(e) => handleChange('customerAddress', e.target.value)}
                  placeholder="Address or City"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Product Type (Master selection) */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Product Type / Scheme
              </label>
              <SearchableDropdown
                options={productOptions}
                value={formData.productType}
                onChange={(val) => handleChange('productType', val)}
                placeholder="Select master product..."
              />
            </div>

            {/* Real Estate Requirement */}
            {isRealEstate && (
              <div className="space-y-1">
                <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                  Requirement
                </label>
                <SearchableDropdown
                  options={requirementOptions}
                  value={formData.requirement}
                  onChange={(val) => handleChange('requirement', val)}
                  placeholder="Select requirement..."
                />
              </div>
            )}

            {/* Insurance Sub Product */}
            {isInsurance && (
              <div className="space-y-1">
                <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                  Sub Product Type
                </label>
                <SearchableDropdown
                  options={subProductOptions}
                  value={formData.insuranceSubType}
                  onChange={(val) => handleChange('insuranceSubType', val)}
                  placeholder="Select sub product..."
                />
              </div>
            )}

            {/* Investment Budget */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Investment Budget
              </label>
              <SearchableDropdown
                options={budgetOptions}
                value={formData.investmentBudget}
                onChange={(val) => handleChange('investmentBudget', val)}
                placeholder="Select budget..."
              />
            </div>

            {/* When to Buy Plan */}
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                When to Buy Plan
              </label>
              <div className="relative">
                <Clock size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={formData.whenToBuyPlan}
                  onChange={(e) => handleChange('whenToBuyPlan', e.target.value)}
                  placeholder="e.g. Immediate, 3 Months, 1 Year"
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Referencer Name */}
            <div className="space-y-1 col-span-1 sm:col-span-2">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Referencer Name
              </label>
              <input
                type="text"
                value={formData.referencerName}
                onChange={(e) => handleChange('referencerName', e.target.value)}
                placeholder="Name of referencer (if any)"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1 col-span-1 sm:col-span-2">
              <label className="block font-semibold text-gray-700 uppercase tracking-tight text-[11px]">
                Remarks / Comments
              </label>
              <textarea
                rows={2}
                value={formData.remarks}
                onChange={(e) => handleChange('remarks', e.target.value)}
                placeholder="Additional remarks..."
                className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs active:scale-95"
            >
              <Save size={13} />
              <span>Save & Re-validate</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
