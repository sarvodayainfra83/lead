import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Building2,
  Shield,
  TrendingUp,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  Tag,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Mail
} from 'lucide-react';
import { WhatsAppIcon, GmailIcon, shareOnWhatsApp, shareViaGmail, shareViaEmail } from '../../utils/productShare';

export default function ProductDetailModal({ isOpen, onClose, product, category }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!isOpen || !product) return null;

  const images = product.imagesList && product.imagesList.length > 0
    ? product.imagesList
    : (product.cover_image ? [product.cover_image] : []);

  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    const strVal = String(val).trim();
    const num = Number(strVal.replace(/,/g, ''));
    if (!isNaN(num) && strVal !== '' && !strVal.toLowerCase().includes('lakh') && !strVal.toLowerCase().includes('cr')) {
      return `₹ ${num.toLocaleString('en-IN')}`;
    }
    return strVal.startsWith('₹') ? strVal : `₹ ${strVal}`;
  };

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 my-auto">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${category === 'real-estate' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
              category === 'insurance' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' :
                'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}>
              {category === 'real-estate' && <Building2 size={20} />}
              {category === 'insurance' && <Shield size={20} />}
              {category === 'mutual-funds' && <TrendingUp size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {product.product_type || 'General'}
                </span>
                {product.is_featured && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Sparkles size={10} /> Featured
                  </span>
                )}
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${product.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {product.title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shareOnWhatsApp(product, category)}
              title="Share on WhatsApp (Web/App)"
              className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
            >
              <WhatsAppIcon size={16} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={() => shareViaGmail(product, category)}
              title="Share via Gmail (Web/App)"
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
            >
              <GmailIcon size={16} />
              <span className="hidden sm:inline">Gmail</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">

          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className="space-y-3">
              <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full rounded-xl overflow-hidden bg-slate-100 border border-gray-200">
                <img
                  src={images[activeImageIndex]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800'; }}
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <div className="absolute bottom-2.5 right-3 bg-black/60 text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                      {activeImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${activeImageIndex === idx ? 'border-indigo-600 scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'
                        }`}
                    >
                      <img src={img} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2">
              <ImageIcon size={32} />
              <span className="text-xs font-medium">No images uploaded for this product</span>
            </div>
          )}

          {/* Real Estate Specifications */}
          {category === 'real-estate' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Price</span>
                  <span className="text-base font-extrabold text-indigo-600">{formatCurrency(product.price)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Configuration</span>
                  <span className="text-sm font-bold text-gray-800">{product.bhk || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Super Area</span>
                  <span className="text-sm font-bold text-gray-800">{product.area ? `${product.area} ${product.area_unit || 'sqft'}` : '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Status</span>
                  <span className="text-sm font-bold text-gray-800">{product.construction_status || '—'}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Property Details</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-gray-400 block">Project Name</span>
                    <span className="font-semibold text-gray-800">{product.project_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Builder</span>
                    <span className="font-semibold text-gray-800">{product.builder_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">RERA Number</span>
                    <span className="font-semibold text-gray-800">{product.rera_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Carpet Area</span>
                    <span className="font-semibold text-gray-800">{product.carpet_area ? `${product.carpet_area} ${product.area_unit || 'sqft'}` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Floor / Total</span>
                    <span className="font-semibold text-gray-800">{product.floor_number ?? '—'} / {product.total_floors ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Facing</span>
                    <span className="font-semibold text-gray-800">{product.facing || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Bedrooms / Baths</span>
                    <span className="font-semibold text-gray-800">{product.bedrooms ?? '—'} Beds · {product.bathrooms ?? '—'} Baths</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Balconies / Parking</span>
                    <span className="font-semibold text-gray-800">{product.balconies ?? '—'} Balc. · {product.parking || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Possession Date</span>
                    <span className="font-semibold text-gray-800">{product.possession_date || '—'}</span>
                  </div>
                </div>
              </div>

              {product.address && (
                <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-gray-100 text-xs text-gray-700">
                  <MapPin size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>{product.address}</span>
                </div>
              )}

              {product.amenities && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Amenities</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(product.amenitiesList && product.amenitiesList.length > 0 ? product.amenitiesList : product.amenities.split(',')).map((am, i) => (
                      <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-medium">
                        ✓ {am.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Insurance Specifications */}
          {category === 'insurance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Coverage Amount</span>
                  <span className="text-base font-extrabold text-indigo-600">{formatCurrency(product.coverage_amount)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Premium</span>
                  <span className="text-sm font-bold text-gray-800">{formatCurrency(product.premium_amount)} <span className="text-[10px] text-gray-400">/{product.premium_frequency || 'yr'}</span></span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Insurer</span>
                  <span className="text-sm font-bold text-gray-800">{product.insurer_name}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Claim Settlement</span>
                  <span className="text-sm font-bold text-emerald-600">{product.claim_settlement_ratio ? `${product.claim_settlement_ratio}%` : '—'}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Plan Specifics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-gray-400 block">Sub Type</span>
                    <span className="font-semibold text-gray-800">{product.insurance_sub_type || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Plan Type</span>
                    <span className="font-semibold text-gray-800">{product.plan_type || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Policy Term</span>
                    <span className="font-semibold text-gray-800">{product.policy_term ? `${product.policy_term} ${product.policy_term_unit || 'Years'}` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Entry Age Range</span>
                    <span className="font-semibold text-gray-800">{product.entry_age_min ?? '—'} to {product.entry_age_max ?? '—'} Years</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Premium Frequency</span>
                    <span className="font-semibold text-gray-800">{product.premium_frequency || '—'}</span>
                  </div>
                </div>
              </div>

              {product.benefitsList && product.benefitsList.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Key Benefits</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {product.benefitsList.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs text-emerald-800">
                        <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.exclusionsList && product.exclusionsList.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Exclusions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {product.exclusionsList.map((ex, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg text-xs text-rose-800">
                        <XCircle size={15} className="text-rose-600 flex-shrink-0 mt-0.5" />
                        <span>{ex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mutual Fund Specifications */}
          {category === 'mutual-funds' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Fund House</span>
                  <span className="text-sm font-bold text-gray-800">{product.fund_house}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Min Investment / SIP</span>
                  <span className="text-sm font-bold text-indigo-600">{formatCurrency(product.min_investment)} / {formatCurrency(product.min_sip_amount)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Risk Level</span>
                  <span className="text-sm font-bold text-amber-600">{product.risk_level || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Expense Ratio</span>
                  <span className="text-sm font-bold text-gray-800">{product.expense_ratio ? `${product.expense_ratio}%` : '—'}</span>
                </div>
              </div>

              {/* Returns highlight card */}
              <div className="p-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-xl border border-indigo-100">
                <h4 className="text-xs font-bold uppercase text-indigo-900 tracking-wider mb-2.5">Historical Returns</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-indigo-100 shadow-sm">
                    <span className="text-[11px] text-gray-400 block font-medium">1 Year</span>
                    <span className="text-base font-extrabold text-emerald-600">{product.returns_1y !== null ? `${product.returns_1y}%` : '—'}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100 shadow-sm">
                    <span className="text-[11px] text-gray-400 block font-medium">3 Year</span>
                    <span className="text-base font-extrabold text-emerald-600">{product.returns_3y !== null ? `${product.returns_3y}%` : '—'}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-indigo-100 shadow-sm">
                    <span className="text-[11px] text-gray-400 block font-medium">5 Year</span>
                    <span className="text-base font-extrabold text-emerald-600">{product.returns_5y !== null ? `${product.returns_5y}%` : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Scheme Information</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-gray-400 block">Scheme Name</span>
                    <span className="font-semibold text-gray-800">{product.scheme_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Benchmark</span>
                    <span className="font-semibold text-gray-800">{product.benchmark || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Exit Load</span>
                    <span className="font-semibold text-gray-800">{product.exit_load || '—'}</span>
                  </div>
                </div>
              </div>

              {product.investment_objective && (
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 space-y-1">
                  <h4 className="text-xs font-bold text-gray-700">Investment Objective</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{product.investment_objective}</p>
                </div>
              )}
            </div>
          )}

          {/* Common Description */}
          {product.description && (
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Description</h4>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">Share:</span>
            <button
              onClick={() => shareOnWhatsApp(product, category)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <WhatsAppIcon size={14} />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => shareViaGmail(product, category)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <GmailIcon size={14} />
              <span>Gmail</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-gray-200 transition shadow-sm active:scale-95"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
