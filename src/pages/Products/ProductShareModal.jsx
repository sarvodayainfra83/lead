import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Share2,
  Copy,
  Mail,
  Check,
  ChevronDown,
  ChevronUp,
  Building2,
  Shield,
  TrendingUp,
  Smartphone
} from 'lucide-react';
import {
  WhatsAppIcon,
  GmailIcon,
  shareOnWhatsApp,
  shareViaGmail,
  shareViaEmail,
  shareOnDevice,
  copyProductDetails,
  canNativeShare,
  formatProductShareData
} from '../../utils/productShare';

export default function ProductShareModal({ isOpen, onClose, product, category = 'real-estate' }) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !product) return null;

  const { subject, text } = formatProductShareData(product, category);
  const nativeAvailable = canNativeShare();

  const handleCopy = async () => {
    const success = await copyProductDetails(product, category);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getCategoryIcon = () => {
    if (category === 'real-estate') return <Building2 size={18} className="text-amber-600" />;
    if (category === 'insurance') return <Shield size={18} className="text-indigo-600" />;
    return <TrendingUp size={18} className="text-emerald-600" />;
  };

  const displayTitle = product.title?.trim() || product.project_name || product.insurer_name || product.scheme_name || 'Product Details';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">Share Product</h3>
              <p className="text-xs text-gray-500 line-clamp-1 max-w-xs">{displayTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* Product Snippet Banner */}
          <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-xs">
              {getCategoryIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                {product.product_type || category.replace('-', ' ')}
              </span>
              <h4 className="text-xs font-bold text-gray-900 truncate">{displayTitle}</h4>
              {product.price && (
                <span className="text-xs font-black text-indigo-600">
                  {String(product.price).startsWith('₹') ? product.price : `₹ ${product.price}`}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Choose where to share. You will be able to select the recipient contacts or groups:
          </p>

          {/* Share Channels */}
          <div className="space-y-2.5">

            {/* WhatsApp */}
            <button
              type="button"
              onClick={() => {
                shareOnWhatsApp(product, category);
              }}
              className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition flex items-center justify-between group text-left cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <WhatsAppIcon size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 group-hover:text-emerald-700 transition">
                    WhatsApp (Web / App)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Open WhatsApp to select contacts, groups, or status
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                Select Contacts →
              </span>
            </button>

            {/* Gmail */}
            <button
              type="button"
              onClick={() => {
                shareViaGmail(product, category);
              }}
              className="w-full p-3 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 transition flex items-center justify-between group text-left cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                  <GmailIcon size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 group-hover:text-rose-700 transition">
                    Gmail (Web / Mobile)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Open Gmail compose with prefilled details to choose recipients
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200 shadow-2xs">
                Select Recipients →
              </span>
            </button>

            {/* Native Device Share Sheet */}
            {nativeAvailable && (
              <button
                type="button"
                onClick={() => {
                  shareOnDevice(product, category);
                }}
                className="w-full p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 transition flex items-center justify-between group text-left cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Smartphone size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-indigo-700 transition">
                      Device Share Sheet
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Open phone or laptop native menu to pick any installed app
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                  Share App →
                </span>
              </button>
            )}

            {/* Default Email Client & Copy Text side-by-side */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  shareViaEmail(product, category);
                }}
                className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer shadow-2xs"
              >
                <Mail size={15} className="text-sky-600" />
                <span className="truncate">Default Email</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer shadow-2xs"
              >
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} className="text-gray-600" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>

          </div>

          {/* Collapsible Message Preview */}
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-500 hover:text-gray-800 transition py-1 cursor-pointer"
            >
              <span>Preview Message to be Shared</span>
              {showPreview ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showPreview && (
              <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed border border-slate-800">
                {text}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-gray-400">
            Works across laptop & phone (Web & App)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-gray-200 transition shadow-xs active:scale-95 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
