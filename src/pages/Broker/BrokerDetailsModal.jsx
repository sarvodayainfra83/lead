import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Phone,
  Mail,
  Building2,
  MapPin,
  FileText,
  ShieldCheck,
  Percent,
  Check,
  Copy,
  ExternalLink,
  Pencil,
  MessageCircle,
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BrokerDetailsModal({ isOpen, broker, onClose, onEdit }) {
  const [copiedField, setCopiedField] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  if (!isOpen || !broker) return null;

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatAadhar = (val) => {
    if (!val) return '-';
    const clean = String(val).replace(/\s+/g, '');
    return clean.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">

        {/* Modal Header */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-2 border-b border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-0.5 overflow-hidden flex items-center justify-center flex-shrink-0">
              {broker.photoUrl ? (
                <img
                  src={broker.photoUrl}
                  alt={broker.name}
                  className="w-full h-full object-cover rounded-lg cursor-pointer"
                  onClick={() => setPreviewImage({ url: broker.photoUrl, title: `${broker.name} - Photo` })}
                />
              ) : (
                <User size={22} className="text-white/80" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <h3 className="text-sm sm:text-lg font-bold text-white tracking-tight truncate min-w-0">{broker.name}</h3>
                <span className={`inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${
                  broker.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {broker.status || 'ACTIVE'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-200/90 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                <Building2 size={13} className="text-indigo-300 flex-shrink-0" />
                <span className="truncate">{broker.businessName || 'Independent Broker'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(broker);
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 text-gray-700 text-sm">

          {/* Quick Contact & Commission Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Phone */}
            <div className="bg-slate-50 border border-gray-100 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Phone size={12} className="text-indigo-600" /> Primary Phone
              </span>
              <div className="mt-1 flex items-center justify-between">
                <a
                  href={`tel:${broker.phone}`}
                  className="font-bold text-gray-900 hover:text-indigo-600 tracking-tight"
                >
                  +91 {broker.phone}
                </a>
                <div className="flex items-center gap-1">
                  <a
                    href={`https://wa.me/91${broker.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                    title="WhatsApp"
                  >
                    <MessageCircle size={15} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(broker.phone, 'Phone')}
                    className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                    title="Copy Phone"
                  >
                    {copiedField === 'Phone' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              {broker.alternatePhone && (
                <div className="text-[11px] text-gray-500 mt-1">
                  Alt: <a href={`tel:${broker.alternatePhone}`} className="hover:underline font-medium">+91 {broker.alternatePhone}</a>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="bg-slate-50 border border-gray-100 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Mail size={12} className="text-indigo-600" /> Email Address
              </span>
              <div className="mt-1 flex items-center justify-between">
                <a
                  href={`mailto:${broker.email}`}
                  className="font-semibold text-gray-900 hover:text-indigo-600 truncate text-xs"
                  title={broker.email}
                >
                  {broker.email}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(broker.email, 'Email')}
                  className="p-1 text-gray-400 hover:text-indigo-600 rounded flex-shrink-0"
                  title="Copy Email"
                >
                  {copiedField === 'Email' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Commission */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                <Percent size={12} className="text-indigo-600" /> Commission
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-indigo-900">
                  {broker.commissionPercentage != null ? broker.commissionPercentage : '0'}%
                </span>
                <span className="text-[11px] text-indigo-600 font-semibold">per deal</span>
              </div>
            </div>
          </div>

          {/* Project & Deal Preferences */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
              <Building2 size={14} className="text-indigo-600" />
              Specialization & Preferences
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-tight block">
                  Project Type (Product Type)
                </span>
                <div className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {broker.projectType || 'General'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-tight block">
                  Deal Preferred (Requirement)
                </span>
                <div className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {broker.dealPreferred || 'All Deals'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compliance & IDs (RERA, PAN, Aadhar) */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
              <ShieldCheck size={14} className="text-emerald-600" />
              Govt IDs & Compliance
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {/* RERA */}
              <div className="p-3 bg-slate-50 border border-gray-100 rounded-lg">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  RERA Registration No.
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono font-bold text-gray-900 text-xs truncate" title={broker.reraNo}>
                    {broker.reraNo || '-'}
                  </span>
                  {broker.reraNo && (
                    <button
                      type="button"
                      onClick={() => handleCopy(broker.reraNo, 'RERA')}
                      className="p-1 text-gray-400 hover:text-indigo-600 rounded flex-shrink-0"
                    >
                      {copiedField === 'RERA' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* PAN */}
              <div className="p-3 bg-slate-50 border border-gray-100 rounded-lg">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  PAN Number
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono font-bold text-gray-900 text-xs">
                    {broker.pan || '-'}
                  </span>
                  {broker.pan && (
                    <button
                      type="button"
                      onClick={() => handleCopy(broker.pan, 'PAN')}
                      className="p-1 text-gray-400 hover:text-indigo-600 rounded flex-shrink-0"
                    >
                      {copiedField === 'PAN' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Aadhar */}
              <div className="p-3 bg-slate-50 border border-gray-100 rounded-lg">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Aadhar Number
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono font-bold text-gray-900 text-xs">
                    {formatAadhar(broker.aadharNo)}
                  </span>
                  {broker.aadharNo && (
                    <button
                      type="button"
                      onClick={() => handleCopy(broker.aadharNo, 'Aadhar')}
                      className="p-1 text-gray-400 hover:text-indigo-600 rounded flex-shrink-0"
                    >
                      {copiedField === 'Aadhar' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Business Address */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 sm:p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-tight flex items-center gap-1">
              <MapPin size={13} className="text-rose-500" /> Business / Office Address
            </span>
            <p className="mt-1.5 text-gray-800 text-xs font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-gray-100">
              {broker.businessAddress || 'No address provided'}
            </p>
          </div>

          {/* Photos (Broker Photo & Business Photo) */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
              <ImageIcon size={14} className="text-indigo-600" />
              Uploaded Photos
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Personal Photo */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-500">Broker Personal Photo</span>
                {broker.photoUrl ? (
                  <div
                    onClick={() => setPreviewImage({ url: broker.photoUrl, title: `${broker.name} - Personal Photo` })}
                    className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow transition"
                  >
                    <img src={broker.photoUrl} alt="Broker" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                      <ExternalLink size={14} /> View Full
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-36 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400 text-xs">
                    <User size={24} className="mb-1 text-gray-300" />
                    No Personal Photo
                  </div>
                )}
              </div>

              {/* Business Photo */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-500">Business / Storefront Photo</span>
                {broker.businessPhotoUrl ? (
                  <div
                    onClick={() => setPreviewImage({ url: broker.businessPhotoUrl, title: `${broker.name} - Business Photo` })}
                    className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow transition"
                  >
                    <img src={broker.businessPhotoUrl} alt="Business" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                      <ExternalLink size={14} /> View Full
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-36 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400 text-xs">
                    <Building2 size={24} className="mb-1 text-gray-300" />
                    No Business Photo
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="text-[11px] text-gray-400 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-1.5 sm:gap-2 pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1">
              <Calendar size={12} /> Registered: {new Date(broker.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            {broker.createdByName && (
              <span className="flex items-center gap-1 text-gray-500 font-medium">
                <User size={12} className="text-indigo-600" /> Added By: <span className="font-bold text-gray-700">{broker.createdByName}</span>
              </span>
            )}
            <span>ID: {broker.id}</span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-3.5 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-transparent flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between text-white pb-2 px-1">
              <span className="text-xs font-bold">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt="Enlarged"
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
