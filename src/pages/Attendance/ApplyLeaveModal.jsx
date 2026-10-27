import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar,
  Clock,
  FileText,
  Upload,
  X,
  ImageIcon,
  AlertCircle,
  CalendarDays,
  Tag,
  CheckCircle2
} from 'lucide-react';
import ModalForm from '../../components/ModalForm';
import {
  leaveRequestApi,
  LEAVE_DURATION_TYPES,
  LEAVE_CATEGORY_TYPES
} from '../../api/leaveRequestApi';
import { useAuthStore } from '../../store/authStore';

export default function ApplyLeaveModal({ isOpen, onClose, onApplied }) {
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);

  const getInitialForm = () => {
    const today = new Date().toISOString().split('T')[0];
    return {
      leaveType: 'Full Day',
      leaveCategory: 'Casual Leave',
      isRange: false,
      fromDate: today,
      toDate: today,
      reason: '',
      documentUrl: ''
    };
  };

  const [formData, setFormData] = useState(getInitialForm());
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDocError, setShowDocError] = useState(false);

  const resetForm = () => {
    setFormData(getInitialForm());
    setImagePreview(null);
    setLoading(false);
    setShowDocError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Automatically reset all form fields whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  // Calculate day difference
  const calculateDays = () => {
    if (formData.leaveType.startsWith('Half Day')) return 0.5;
    if (!formData.isRange || !formData.toDate || formData.fromDate === formData.toDate) return 1;

    const start = new Date(formData.fromDate);
    const end = new Date(formData.toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 1;

    const diffMs = end.getTime() - start.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setFormData(prev => ({ ...prev, documentUrl: reader.result }));
      setShowDocError(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData(prev => ({ ...prev, documentUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.fromDate) {
      toast.error('Please select leave start date');
      return;
    }

    if (formData.isRange && formData.toDate && formData.toDate < formData.fromDate) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    if (!formData.reason.trim()) {
      toast.error('Please provide a reason for leave');
      return;
    }

    if (!formData.documentUrl) {
      setShowDocError(true);
      toast.error('Please upload an image / supporting document (Required)');
      return;
    }

    setLoading(true);
    try {
      let finalDocUrl = formData.documentUrl;
      // If we have an image, upload it
      if (finalDocUrl && finalDocUrl.startsWith('data:')) {
        finalDocUrl = await leaveRequestApi.uploadLeaveDocument(finalDocUrl, user?.name || user?.username);
      }

      const totalDays = calculateDays();
      const payload = {
        leaveType: formData.leaveType,
        leaveCategory: formData.leaveCategory,
        fromDate: formData.fromDate,
        toDate: formData.isRange ? (formData.toDate || formData.fromDate) : formData.fromDate,
        totalDays,
        reason: formData.reason.trim(),
        documentUrl: finalDocUrl || null
      };

      await leaveRequestApi.applyLeaveRequest(payload, user);
      toast.success('Leave application submitted successfully!');
      resetForm();
      onApplied?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to apply leave:', err);
      toast.error(err.message || 'Failed to apply leave');
    } finally {
      setLoading(false);
    }
  };

  const totalDays = calculateDays();

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title="Apply For Leave"
      onSubmit={handleSubmit}
      submitText={loading ? 'Submitting...' : 'Submit Leave Request'}
      loading={loading}
      maxWidth="max-w-xl"
    >
      {/* Employee Quick Info */}
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 mb-1">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-indigo-600" />
          <span>Applying for: <strong className="font-semibold">{user?.name || user?.username}</strong></span>
        </div>
        {user?.position && (
          <span className="text-[11px] px-2 py-0.5 bg-indigo-100 text-indigo-700 font-semibold rounded-full">
            {user.position}
          </span>
        )}
      </div>

      <div className="space-y-3 text-xs">
        {/* Option 1: Leave Duration Type (Full Day / Half Day) */}
        <div>
          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Clock size={12} className="text-indigo-600" />
            <span>1. Leave Duration Type *</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LEAVE_DURATION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleChange('leaveType', type)}
                className={`px-2.5 py-2 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                  formData.leaveType === type
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs ring-2 ring-indigo-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Option 2: Leave Category */}
        <div>
          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Tag size={12} className="text-indigo-600" />
            <span>2. Leave Category / Reason Type *</span>
          </label>
          <select
            value={formData.leaveCategory}
            onChange={(e) => handleChange('leaveCategory', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
          >
            {LEAVE_CATEGORY_TYPES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Date Selection */}
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={12} className="text-indigo-600" />
              <span>Leave Date(s) *</span>
            </label>
            {!formData.leaveType.startsWith('Half Day') && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isRange}
                  onChange={(e) => handleChange('isRange', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span className="font-semibold text-[11px]">Multiple Days Range</span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <span className="block text-[10px] text-gray-500 font-semibold mb-1">
                {formData.isRange ? 'From Date' : 'Leave Date'}
              </span>
              <input
                type="date"
                required
                value={formData.fromDate}
                onChange={(e) => handleChange('fromDate', e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              />
            </div>

            {formData.isRange && !formData.leaveType.startsWith('Half Day') && (
              <div>
                <span className="block text-[10px] text-gray-500 font-semibold mb-1">To Date</span>
                <input
                  type="date"
                  required
                  min={formData.fromDate}
                  value={formData.toDate}
                  onChange={(e) => handleChange('toDate', e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>
            )}
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Total Duration:</span>
            <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700">
              {totalDays} {totalDays === 1 ? 'Day' : totalDays === 0.5 ? 'Half Day' : 'Days'}
            </span>
          </div>
        </div>

        {/* Reason for Leave */}
        <div>
          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <FileText size={12} className="text-indigo-600" />
            <span>Reason for Leave *</span>
          </label>
          <textarea
            required
            rows={2}
            value={formData.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Explain why you need leave (e.g., severe migraine, urgent bank work, family function)..."
            className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
          />
        </div>

        {/* Image / Proof Upload Option */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <ImageIcon size={12} className="text-indigo-600" />
              <span>Attach Supporting Document / Image *</span>
            </label>
            <span className="text-[10px] text-rose-500 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              * Required
            </span>
          </div>

          {imagePreview ? (
            <div className="relative border border-emerald-300 rounded-xl p-2 bg-emerald-50/40 flex items-center gap-3">
              <img
                src={imagePreview}
                alt="Leave attachment"
                className="w-14 h-14 object-cover rounded-lg border border-gray-300 shadow-2xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">Image attached</p>
                <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={11} /> Ready to submit with leave request
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                title="Remove image"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
              showDocError
                ? 'border-rose-400 bg-rose-50/40 text-rose-600'
                : 'border-gray-200 hover:border-indigo-400 bg-gray-50/50 hover:bg-indigo-50/20 text-gray-600 hover:text-indigo-600'
            } group`}>
              <Upload size={18} className={showDocError ? 'text-rose-500' : 'text-gray-400 group-hover:text-indigo-600 transition'} />
              <span className="text-xs font-semibold">
                Upload Doctor Slip, Written Application or Photo *
              </span>
              <span className="text-[10px] text-gray-400">PNG, JPG up to 5MB (Mandatory)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          )}
          {showDocError && (
            <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> Please upload a photo or document proof before submitting.
            </p>
          )}
        </div>
      </div>
    </ModalForm>
  );
}
