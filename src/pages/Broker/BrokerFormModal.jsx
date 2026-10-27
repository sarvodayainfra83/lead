import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  User,
  Phone,
  Mail,
  Building2,
  MapPin,
  ShieldCheck,
  Percent,
  Image as ImageIcon,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { masterApi } from '../../api/masterApi';
import { brokerApi } from '../../api/brokerApi';
import { useAuthStore } from '../../store/authStore';

function ComboInput({ value, onChange, options, placeholder, hasError }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value || '');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setText(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, []);

  const filtered = useMemo(() => {
    if (!text) return options;
    const q = text.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [text, options]);

  const select = (val) => {
    setText(val);
    onChange(val);
    setOpen(false);
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setText(v);
    onChange(v);
    if (!open) setOpen(true);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-center h-10 bg-gray-50/50 border rounded-xl overflow-hidden transition focus-within:bg-white focus-within:ring-2 ${
        hasError ? 'border-red-400 focus-within:ring-red-400' : 'border-gray-200 focus-within:ring-indigo-500'
      }`}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 h-full px-3 text-xs bg-transparent outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen(p => !p); inputRef.current?.focus(); }}
          className="px-2 h-full flex items-center text-gray-400 hover:text-indigo-500 transition"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => select(opt)}
                className={`w-full px-3 py-2 text-xs text-left flex justify-between items-center hover:bg-indigo-50 transition ${
                  value === opt ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'text-gray-700'
                }`}
              >
                <span className="truncate">{opt}</span>
                {value === opt && <Check size={13} className="text-indigo-600 shrink-0 ml-2" />}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-[11px] text-center text-gray-400 italic">No matching options</div>
          )}
          {text && !options.some(o => o.toLowerCase() === text.toLowerCase()) && (
            <button
              type="button"
              onClick={() => select(text.trim())}
              className="w-full border-t border-gray-100 px-3 py-2 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-1.5"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span className="text-[11px] font-bold">Add "{text.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_FORM_DATA = {
  name: '',
  phone: '',
  alternatePhone: '',
  email: '',
  businessName: '',
  dealPreferred: '',
  dealPreferredOption: '',
  customDealPreferred: '',
  pan: '',
  aadharNo: '',
  businessAddress: '',
  reraNo: '',
  photoUrl: '',
  businessPhotoUrl: '',
  projectType: '',
  projectTypeOption: '',
  customProjectType: '',
  commissionPercentage: '',
  status: 'ACTIVE'
};

export default function BrokerFormModal({ isOpen, onClose, onSaved, initialData }) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [requirementOptions, setRequirementOptions] = useState([]);
  const [productTypeOptions, setProductTypeOptions] = useState([]);

  const photoInputRef = useRef(null);
  const businessPhotoInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        masterApi.getRealEstateRequirements().catch(() => []),
        masterApi.getRealEstateProducts().catch(() => [])
      ]).then(([reqs, prods]) => {
        setRequirementOptions((reqs || []).map(r => r.requirement).filter(Boolean));
        setProductTypeOptions((prods || []).map(p => p.productType).filter(Boolean));
      });
    }
  }, [isOpen]);

  // Sync initialData for Edit mode
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...DEFAULT_FORM_DATA,
          ...initialData,
          dealPreferredOption: initialData.dealPreferred || '',
          projectTypeOption: initialData.projectType || '',
          commissionPercentage: initialData.commissionPercentage != null ? String(initialData.commissionPercentage) : ''
        });
      } else {
        setFormData(DEFAULT_FORM_DATA);
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle Photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      const dataUrl = await brokerApi.fileToDataUrl(file);
      setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
      toast.success('Broker photo selected');
    } catch {
      toast.error('Failed to process image');
    }
  };

  // Handle Business Photo upload
  const handleBusinessPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      const dataUrl = await brokerApi.fileToDataUrl(file);
      setFormData(prev => ({ ...prev, businessPhotoUrl: dataUrl }));
      toast.success('Business photo selected');
    } catch {
      toast.error('Failed to process business image');
    }
  };

  // Validation
  const validateForm = () => {
    const errs = {};

    if (!formData.name?.trim()) {
      errs.name = 'Broker Name is required';
    }

    if (!formData.phone?.trim()) {
      errs.phone = 'Phone number is required';
    } else if (!/^[0-9]{10}$/.test(formData.phone.trim().replace(/\D/g, ''))) {
      errs.phone = 'Please enter a valid 10-digit mobile number';
    }

    if (formData.alternatePhone?.trim()) {
      const cleanAlt = formData.alternatePhone.trim().replace(/\D/g, '');
      if (cleanAlt.length > 0 && cleanAlt.length < 10) {
        errs.alternatePhone = 'Alternate phone must be at least 10 digits';
      }
    }

    if (!formData.email?.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!formData.dealPreferred?.trim()) {
      errs.dealPreferred = 'Deal Preferred is required';
    }

    if (!formData.projectType?.trim()) {
      errs.projectType = 'Project Type is required';
    }

    // PAN
    if (!formData.pan?.trim()) {
      errs.pan = 'PAN number is required';
    } else if (formData.pan.trim().length < 8) {
      errs.pan = 'PAN number is invalid';
    }

    // Aadhar
    const aadharClean = formData.aadharNo?.trim().replace(/\s+/g, '');
    if (!aadharClean) {
      errs.aadharNo = 'Aadhar number is required';
    } else if (!/^\d{12}$/.test(aadharClean)) {
      errs.aadharNo = 'Aadhar number must be exactly 12 digits';
    }

    // Business Address
    if (!formData.businessAddress?.trim()) {
      errs.businessAddress = 'Business address is required';
    }

    // RERA No
    if (!formData.reraNo?.trim()) {
      errs.reraNo = 'RERA registration number is required';
    }

    // Commission Percentage
    if (formData.commissionPercentage === '' || formData.commissionPercentage === null || formData.commissionPercentage === undefined) {
      errs.commissionPercentage = 'Commission percentage is required';
    } else {
      const comm = parseFloat(formData.commissionPercentage);
      if (isNaN(comm) || comm < 0 || comm > 100) {
        errs.commissionPercentage = 'Enter valid percentage between 0 and 100';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the highlighted required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalDealPreferred = formData.dealPreferred.trim();
      const finalProjectType = formData.projectType.trim();

      const loggedInUserId = user?.dbId || user?.id || null;
      const loggedInUserName = user?.name || user?.username || 'User';

      const payload = {
        userId: initialData?.userId || loggedInUserId,
        createdByName: initialData?.createdByName || loggedInUserName,
        name: formData.name.trim(),
        phone: formData.phone.trim().replace(/\D/g, ''),
        alternatePhone: formData.alternatePhone?.trim().replace(/\D/g, '') || '',
        email: formData.email.trim().toLowerCase(),
        businessName: formData.businessName?.trim() || '',
        dealPreferred: finalDealPreferred,
        pan: formData.pan.trim().toUpperCase(),
        aadharNo: formData.aadharNo.trim().replace(/\s+/g, ''),
        businessAddress: formData.businessAddress.trim(),
        reraNo: formData.reraNo.trim().toUpperCase(),
        photoUrl: formData.photoUrl || '',
        businessPhotoUrl: formData.businessPhotoUrl || '',
        projectType: finalProjectType,
        commissionPercentage: parseFloat(formData.commissionPercentage) || 0,
        status: formData.status || 'ACTIVE'
      };

      if (initialData?.id) {
        await brokerApi.updateBroker(initialData.id, payload);
        toast.success('Broker updated successfully!');
      } else {
        await brokerApi.createBroker(payload);
        toast.success('New Broker added successfully!');
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save broker:', err);
      toast.error('Failed to save broker details: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 text-white flex items-center justify-between border-b border-indigo-600/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <User size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {initialData ? 'Edit Broker Details' : 'Add New Broker'}
              </h3>
              <p className="text-xs text-indigo-200">
                Enter broker credentials, compliance IDs, and commission terms
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

          {/* Section 1: Basic Broker Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-indigo-600" />
                1. Broker Information
              </h4>
              <span className="text-[11px] text-gray-400 font-medium">* Required fields</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Name of Broker <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Rajesh Varma"
                    className={`w-full h-10 px-3 text-xs bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                      errors.name ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                    }`}
                  />
                </div>
                {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Business Name <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  placeholder="e.g. Varma Realty Consultants"
                  className="w-full h-10 px-3 text-xs bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Phone No. <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-semibold">+91</span>
                  <input
                    type="tel"
                    name="phone"
                    maxLength={10}
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="9826112345"
                    className={`w-full h-10 pl-11 pr-3 text-xs bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                      errors.phone ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                    }`}
                  />
                </div>
                {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
              </div>

              {/* Alternate Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alternate No. <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-semibold">+91</span>
                  <input
                    type="tel"
                    name="alternatePhone"
                    maxLength={10}
                    value={formData.alternatePhone}
                    onChange={handleChange}
                    placeholder="9425098765"
                    className="w-full h-10 pl-11 pr-3 text-xs bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                {errors.alternatePhone && <p className="text-[11px] text-red-500 mt-1">{errors.alternatePhone}</p>}
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="broker@example.com"
                  className={`w-full h-10 px-3 text-xs bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                    errors.email ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                  }`}
                />
                {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Deal & Project Specialization */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={14} className="text-indigo-600" />
                2. Project & Deal Terms
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Project Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Project Type <span className="text-red-500">*</span>
                </label>
                <ComboInput
                  value={formData.projectType}
                  options={productTypeOptions}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, projectType: val, projectTypeOption: val }));
                    if (errors.projectType) setErrors(prev => ({ ...prev, projectType: null }));
                  }}
                  placeholder="Select or type Project Type..."
                  hasError={!!errors.projectType}
                />
                {errors.projectType && <p className="text-[11px] text-red-500 mt-1">{errors.projectType}</p>}
              </div>

              {/* Deal Preferred */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Deal Preferred <span className="text-red-500">*</span>
                </label>
                <ComboInput
                  value={formData.dealPreferred}
                  options={requirementOptions}
                  onChange={(val) => {
                    setFormData(prev => ({ ...prev, dealPreferred: val, dealPreferredOption: val }));
                    if (errors.dealPreferred) setErrors(prev => ({ ...prev, dealPreferred: null }));
                  }}
                  placeholder="Select or type Deal Preferred..."
                  hasError={!!errors.dealPreferred}
                />
                {errors.dealPreferred && <p className="text-[11px] text-red-500 mt-1">{errors.dealPreferred}</p>}
              </div>

              {/* Commission Percentage */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Commission Percentage (%) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="commissionPercentage"
                    value={formData.commissionPercentage}
                    onChange={handleChange}
                    placeholder="e.g. 2.5"
                    className={`w-full h-10 pl-3 pr-8 text-xs bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                      errors.commissionPercentage ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                    }`}
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">%</span>
                </div>
                {errors.commissionPercentage && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.commissionPercentage}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Broker Status <span className="text-gray-400 font-normal">(Default: Active)</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full h-10 px-3 text-xs bg-gray-50/50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Legal & Compliance IDs */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-600" />
                3. Compliance & Official IDs
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* PAN */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  PAN Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="pan"
                  maxLength={10}
                  value={formData.pan}
                  onChange={(e) => setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F"
                  className={`w-full h-10 px-3 text-xs font-mono uppercase bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                    errors.pan ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                  }`}
                />
                {errors.pan && <p className="text-[11px] text-red-500 mt-1">{errors.pan}</p>}
              </div>

              {/* Aadhar */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Aadhar Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="aadharNo"
                  maxLength={14}
                  value={formData.aadharNo}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                    setFormData(prev => ({ ...prev, aadharNo: raw }));
                  }}
                  placeholder="12-digit number"
                  className={`w-full h-10 px-3 text-xs font-mono bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                    errors.aadharNo ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                  }`}
                />
                {errors.aadharNo && <p className="text-[11px] text-red-500 mt-1">{errors.aadharNo}</p>}
              </div>

              {/* RERA No */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  RERA Registration No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="reraNo"
                  value={formData.reraNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, reraNo: e.target.value.toUpperCase() }))}
                  placeholder="CGRERA010222A..."
                  className={`w-full h-10 px-3 text-xs font-mono uppercase bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                    errors.reraNo ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                  }`}
                />
                {errors.reraNo && <p className="text-[11px] text-red-500 mt-1">{errors.reraNo}</p>}
              </div>
            </div>

            {/* Business Address */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Business Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                name="businessAddress"
                value={formData.businessAddress}
                onChange={handleChange}
                placeholder="Full office or agency address"
                className={`w-full p-3 text-xs bg-gray-50/50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition ${
                  errors.businessAddress ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-500'
                }`}
              />
              {errors.businessAddress && <p className="text-[11px] text-red-500 mt-1">{errors.businessAddress}</p>}
            </div>
          </div>

          {/* Section 4: Photos Upload */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={14} className="text-indigo-600" />
                4. Photos (Broker Photo & Business Photo)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Photo (Broker Personal Photo) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Broker Photo
                </label>

                {formData.photoUrl ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200 group bg-gray-50">
                    <img src={formData.photoUrl} alt="Broker Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow transition cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/20 bg-slate-50/60 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 h-32"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Upload size={16} />
                    </div>
                    <span className="text-xs font-bold text-indigo-700">Upload Broker Photo</span>
                    <span className="text-[10px] text-gray-400">PNG, JPG up to 5MB</span>
                  </div>
                )}

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Business Photo */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Business / Storefront Photo
                </label>

                {formData.businessPhotoUrl ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200 group bg-gray-50">
                    <img src={formData.businessPhotoUrl} alt="Business Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, businessPhotoUrl: '' }))}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow transition cursor-pointer"
                      title="Remove Business Photo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => businessPhotoInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/20 bg-slate-50/60 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 h-32"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Building2 size={16} />
                    </div>
                    <span className="text-xs font-bold text-indigo-700">Upload Business Photo</span>
                    <span className="text-[10px] text-gray-400">Office or board picture</span>
                  </div>
                )}

                <input
                  ref={businessPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBusinessPhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

        </form>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                {initialData ? 'Update Broker' : 'Add Broker'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
