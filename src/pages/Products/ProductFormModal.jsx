import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  Building2,
  Shield,
  TrendingUp,
  Trash2,
  Sparkles,
  Check,
  AlertCircle
} from 'lucide-react';
import { productApi } from '../../api/productApi';
import toast from 'react-hot-toast';

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  category,
  initialData = null
}) {
  const isEdit = Boolean(initialData?.id);
  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({});
  const [existingImages, setExistingImages] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...initialData,
          isFeatured: initialData.is_featured ?? false,
          isActive: initialData.is_active ?? true,
          projectName: initialData.project_name ?? initialData.projectName ?? '',
          productType: initialData.product_type ?? initialData.productType ?? '',
          price: initialData.price != null ? String(initialData.price) : '',
          carpetArea: initialData.carpet_area ?? '',
          builtUpArea: initialData.built_up_area ?? '',
          floorNumber: initialData.floor_number ?? '',
          totalFloors: initialData.total_floors ?? '',
          possessionDate: initialData.possession_date ?? '',
          constructionStatus: initialData.construction_status ?? initialData.constructionStatus ?? '',
          reraNumber: initialData.rera_number || '',
          builderName: initialData.builder_name || '',
          areaUnit: initialData.area_unit ?? initialData.areaUnit ?? 'sqft',
          facing: initialData.facing ?? initialData.facing ?? '',
          insuranceSubType: initialData.insurance_sub_type || '',
          insurerName: initialData.insurer_name || '',
          planType: initialData.plan_type || '',
          coverageAmount: initialData.coverage_amount ?? '',
          premiumAmount: initialData.premium_amount ?? '',
          premiumFrequency: initialData.premium_frequency || 'Annual',
          policyTerm: initialData.policy_term ?? '',
          policyTermUnit: initialData.policy_term_unit || 'Years',
          entryAgeMin: initialData.entry_age_min ?? '',
          entryAgeMax: initialData.entry_age_max ?? '',
          claimSettlementRatio: initialData.claim_settlement_ratio ?? '',
          benefits: Array.isArray(initialData.benefits) ? initialData.benefits.join(', ') : (initialData.benefits || ''),
          features: Array.isArray(initialData.features) ? initialData.features.join(', ') : (initialData.features || ''),
          exclusions: Array.isArray(initialData.exclusions) ? initialData.exclusions.join(', ') : (initialData.exclusions || ''),
          fundHouse: initialData.fund_house || '',
          schemeName: initialData.scheme_name || '',
          riskLevel: initialData.risk_level ?? initialData.riskLevel ?? '',
          investmentObjective: initialData.investment_objective || '',
          minInvestment: initialData.min_investment ?? '',
          minSipAmount: initialData.min_sip_amount ?? '',
          expenseRatio: initialData.expense_ratio ?? '',
          exitLoad: initialData.exit_load || '',
          benchmark: initialData.benchmark || '',
          returns1y: initialData.returns_1y ?? '',
          returns3y: initialData.returns_3y ?? '',
          returns5y: initialData.returns_5y ?? '',
          amenities: Array.isArray(initialData.amenities) ? initialData.amenities.join(', ') : (initialData.amenities || '')
        });

        const imgs = initialData.imagesList && initialData.imagesList.length > 0
          ? initialData.imagesList
          : (initialData.cover_image ? [initialData.cover_image] : []);
        setExistingImages(imgs);
      } else {
        // Defaults for fresh creation
        setFormData({
          title: '',
          productType: '',
          isFeatured: false,
          isActive: true,
          areaUnit: 'sqft',
          constructionStatus: '',
          premiumFrequency: 'Annual',
          policyTermUnit: 'Years',
          riskLevel: ''
        });
        setExistingImages([]);
      }
      setNewImageFiles([]);
      setNewImagePreviews([]);
      setErrorMsg('');
    }
  }, [isOpen, initialData, category]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Image handling
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const previews = files.map((f) => URL.createObjectURL(f));
    setNewImageFiles((prev) => [...prev, ...files]);
    setNewImagePreviews((prev) => [...prev, ...previews]);
  };

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      setErrorMsg('Product title is required.');
      return;
    }

    if (category === 'insurance' && (!formData.insurerName?.trim() || !formData.insuranceSubType?.trim())) {
      setErrorMsg('Insurer Name and Insurance Sub-Type are required.');
      return;
    }

    if (category === 'mutual-funds' && !formData.fundHouse?.trim()) {
      setErrorMsg('Fund House (AMC) name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Upload new image files to Supabase 'products' bucket
      let uploadedUrls = [];
      if (newImageFiles.length > 0) {
        toast.loading('Uploading images to storage...', { id: 'upload-toast' });
        uploadedUrls = await productApi.uploadProductImages(newImageFiles, category);
        toast.dismiss('upload-toast');
      }

      // Combine remaining existing URLs and new uploaded URLs
      const finalImages = [...existingImages, ...uploadedUrls];

      const payload = {
        ...formData,
        images: finalImages,
        coverImage: finalImages[0] || null
      };

      if (category === 'real-estate') {
        if (isEdit) {
          await productApi.updateRealEstateProduct(initialData.id, payload);
          toast.success('Real Estate product updated successfully');
        } else {
          await productApi.createRealEstateProduct(payload);
          toast.success('Real Estate product created successfully');
        }
      } else if (category === 'insurance') {
        if (isEdit) {
          await productApi.updateInsuranceProduct(initialData.id, payload);
          toast.success('Insurance plan updated successfully');
        } else {
          await productApi.createInsuranceProduct(payload);
          toast.success('Insurance plan created successfully');
        }
      } else if (category === 'mutual-funds') {
        if (isEdit) {
          await productApi.updateMutualFundProduct(initialData.id, payload);
          toast.success('Mutual Fund scheme updated successfully');
        } else {
          await productApi.createMutualFundProduct(payload);
          toast.success('Mutual Fund scheme created successfully');
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Save product error:', err);
      setErrorMsg(err.message || 'Failed to save product. Please check column values.');
      toast.error(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              category === 'real-estate' ? 'bg-amber-50 text-amber-600' :
              category === 'insurance' ? 'bg-indigo-50 text-indigo-600' :
              'bg-emerald-50 text-emerald-600'
            }`}>
              {category === 'real-estate' && <Building2 size={18} />}
              {category === 'insurance' && <Shield size={18} />}
              {category === 'mutual-funds' && <TrendingUp size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">
                {isEdit ? 'Edit' : 'Add New'} {category === 'real-estate' ? 'Real Estate Product' : category === 'insurance' ? 'Insurance Product' : 'Mutual Fund Scheme'}
              </h3>
              <p className="text-[11px] text-gray-400">
                Fill in the product specifications and upload multiple photos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="product-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section: Multiple Images Uploader */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Product Images (Multiple Uploads to 'products' bucket)
            </label>
            
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/20 bg-slate-50/50 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UploadCloud size={20} />
              </div>
              <span className="text-xs font-bold text-indigo-700">Click to Browse Images</span>
              <span className="text-[11px] text-gray-400">Upload multiple JPG, PNG, WEBP files (stored directly in Supabase)</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Previews */}
            {(existingImages.length > 0 || newImagePreviews.length > 0) && (
              <div className="flex gap-2.5 overflow-x-auto p-2 bg-slate-50 rounded-xl border border-gray-100 scrollbar-hide">
                {existingImages.map((url, i) => (
                  <div key={`existing-${i}`} className="relative w-20 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 group">
                    <img src={url} alt="existing" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center font-bold">Saved</span>
                    <button
                      type="button"
                      onClick={() => removeExistingImage(i)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-90 hover:opacity-100 shadow transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {newImagePreviews.map((preview, i) => (
                  <div key={`new-${i}`} className="relative w-20 h-16 rounded-lg overflow-hidden border border-indigo-300 flex-shrink-0 group ring-2 ring-indigo-400/30">
                    <img src={preview} alt="new upload" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 left-0 right-0 bg-indigo-600 text-white text-[9px] text-center font-bold">New</span>
                    <button
                      type="button"
                      onClick={() => removeNewImage(i)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-90 hover:opacity-100 shadow transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Basic Information (Common) */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">General Information</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Product Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title || ''}
                  onChange={handleChange}
                  placeholder={
                    category === 'real-estate' ? 'e.g. Luxurious 3 BHK Villa in Green Acres' :
                    category === 'insurance' ? 'e.g. HDFC Life Click 2 Protect Super' :
                    'e.g. SBI Bluechip Equity Growth Scheme'
                  }
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {category === 'real-estate' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Project Name</label>
                    <input
                      type="text"
                      name="projectName"
                      value={formData.projectName || ''}
                      onChange={handleChange}
                      placeholder="e.g. Sarvodaya Greens"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Property Type</label>
                    <input
                      type="text"
                      name="productType"
                      value={formData.productType ?? ''}
                      onChange={handleChange}
                      placeholder="e.g. Apartment, Villa, Plot, Commercial Space"
                      list="real-estate-types"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <datalist id="real-estate-types">
                      {['Apartment', 'Villa', 'Plot', 'Commercial Space', 'Row House', 'Penthouse', 'Office', 'Studio'].map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                </>
              )}

              {category === 'insurance' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Product Type / Category</label>
                    <input
                      type="text"
                      name="productType"
                      value={formData.productType ?? ''}
                      onChange={handleChange}
                      placeholder="e.g. Life Insurance, Health Insurance, General Insurance"
                      list="insurance-types"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <datalist id="insurance-types">
                      {['Life Insurance', 'Health Insurance', 'Motor Insurance', 'General Insurance', 'Travel Insurance', 'Home Insurance'].map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Insurer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="insurerName"
                      value={formData.insurerName || ''}
                      onChange={handleChange}
                      placeholder="e.g. HDFC Life / LIC / Star Health"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Insurance Sub-Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="insuranceSubType"
                      value={formData.insuranceSubType || ''}
                      onChange={handleChange}
                      placeholder="e.g. Term Plan, Critical Illness, Whole Life"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {category === 'mutual-funds' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Fund House (AMC) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fundHouse"
                      value={formData.fundHouse || ''}
                      onChange={handleChange}
                      placeholder="e.g. SBI Mutual Fund, HDFC Mutual Fund"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Scheme Category / Product Type</label>
                    <input
                      type="text"
                      name="productType"
                      value={formData.productType ?? ''}
                      onChange={handleChange}
                      placeholder="e.g. Equity, Debt, Hybrid, Index Fund, ELSS"
                      list="mf-category-types"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <datalist id="mf-category-types">
                      {['Equity', 'Debt', 'Hybrid', 'Solution Oriented', 'Index Fund', 'ELSS', 'Liquid'].map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section: Category Specific Specifications */}
          {category === 'real-estate' && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property Specifications</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Configuration (BHK)</label>
                  <input
                    type="text"
                    name="bhk"
                    value={formData.bhk || ''}
                    onChange={handleChange}
                    placeholder="e.g. 2 BHK, 3 BHK, Plot"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Price (₹ or Range)</label>
                  <input
                    type="text"
                    name="price"
                    value={formData.price ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 45 Lakhs - 65 Lakhs or 75,00,000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Area</label>
                  <input
                    type="text"
                    name="area"
                    value={formData.area || ''}
                    onChange={handleChange}
                    placeholder="e.g. 1450"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Area Unit</label>
                  <select
                    name="areaUnit"
                    value={formData.areaUnit || 'sqft'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {['sqft', 'sqyd', 'sqmt', 'acre', 'bigha'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Carpet Area</label>
                  <input
                    type="number"
                    step="0.01"
                    name="carpetArea"
                    value={formData.carpetArea ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 1100"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Built-up Area</label>
                  <input
                    type="number"
                    step="0.01"
                    name="builtUpArea"
                    value={formData.builtUpArea ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 1350"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Floor No.</label>
                  <input
                    type="number"
                    name="floorNumber"
                    value={formData.floorNumber ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 4"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Total Floors</label>
                  <input
                    type="number"
                    name="totalFloors"
                    value={formData.totalFloors ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 14"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Facing</label>
                  <input
                    type="text"
                    name="facing"
                    value={formData.facing ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. East, North, North-East, West"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Bedrooms</label>
                  <input
                    type="number"
                    name="bedrooms"
                    value={formData.bedrooms ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Bathrooms</label>
                  <input
                    type="number"
                    name="bathrooms"
                    value={formData.bathrooms ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Balconies</label>
                  <input
                    type="number"
                    name="balconies"
                    value={formData.balconies ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Parking</label>
                  <input
                    type="text"
                    name="parking"
                    value={formData.parking || ''}
                    onChange={handleChange}
                    placeholder="e.g. 1 Covered, 2 Open"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Status</label>
                  <input
                    type="text"
                    name="constructionStatus"
                    value={formData.constructionStatus ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. Ready to Move, Under Construction"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Possession Date</label>
                  <input
                    type="date"
                    name="possessionDate"
                    value={formData.possessionDate || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">RERA Number</label>
                  <input
                    type="text"
                    name="reraNumber"
                    value={formData.reraNumber || ''}
                    onChange={handleChange}
                    placeholder="e.g. PRM/KA/RERA/..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Builder Name</label>
                  <input
                    type="text"
                    name="builderName"
                    value={formData.builderName || ''}
                    onChange={handleChange}
                    placeholder="e.g. Sarvodaya Infracon Pvt Ltd"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Amenities (comma separated)</label>
                  <input
                    type="text"
                    name="amenities"
                    value={formData.amenities || ''}
                    onChange={handleChange}
                    placeholder="Swimming Pool, Gym, Club House, 24/7 Security"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Property Address</label>
                  <textarea
                    rows={2}
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange}
                    placeholder="Full physical address, landmark, pin code..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {category === 'insurance' && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Policy & Premium Details</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Coverage Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="coverageAmount"
                    value={formData.coverageAmount ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 10000000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Premium Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="premiumAmount"
                    value={formData.premiumAmount ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Premium Frequency</label>
                  <select
                    name="premiumFrequency"
                    value={formData.premiumFrequency || 'Annual'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {['Annual', 'Half-Yearly', 'Quarterly', 'Monthly'].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Policy Term</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      name="policyTerm"
                      value={formData.policyTerm ?? ''}
                      onChange={handleChange}
                      placeholder="e.g. 30"
                      className="w-2/3 px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      name="policyTermUnit"
                      value={formData.policyTermUnit || 'Years'}
                      onChange={handleChange}
                      className="w-1/3 px-1 py-2 text-xs rounded-xl border border-gray-200 bg-white"
                    >
                      <option value="Years">Yrs</option>
                      <option value="Months">Mos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Min Entry Age</label>
                  <input
                    type="number"
                    name="entryAgeMin"
                    value={formData.entryAgeMin ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 18"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Max Entry Age</label>
                  <input
                    type="number"
                    name="entryAgeMax"
                    value={formData.entryAgeMax ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 65"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Claim Ratio (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="claimSettlementRatio"
                    value={formData.claimSettlementRatio ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 99.1"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Plan Type</label>
                  <input
                    type="text"
                    name="planType"
                    value={formData.planType || ''}
                    onChange={handleChange}
                    placeholder="e.g. Comprehensive, Basic"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Benefits (comma separated)</label>
                  <textarea
                    rows={2}
                    name="benefits"
                    value={formData.benefits || ''}
                    onChange={handleChange}
                    placeholder="Accidental Death Cover, Critical Illness Rider, Tax Benefits 80C"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Exclusions (comma separated)</label>
                  <textarea
                    rows={2}
                    name="exclusions"
                    value={formData.exclusions || ''}
                    onChange={handleChange}
                    placeholder="Pre-existing conditions within 2 years, Self-inflicted injury"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {category === 'mutual-funds' && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fund Financials & Returns</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Scheme Name</label>
                  <input
                    type="text"
                    name="schemeName"
                    value={formData.schemeName || ''}
                    onChange={handleChange}
                    placeholder="e.g. Regular Growth"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Risk Level</label>
                  <input
                    type="text"
                    name="riskLevel"
                    value={formData.riskLevel ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. Moderate, High, Low"
                    list="risk-levels-list"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="risk-levels-list">
                    {['Very High', 'High', 'Moderately High', 'Moderate', 'Moderately Low', 'Low'].map(r => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Min Investment (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="minInvestment"
                    value={formData.minInvestment ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Min SIP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="minSipAmount"
                    value={formData.minSipAmount ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Expense Ratio (%)</label>
                  <input
                    type="number"
                    step="0.001"
                    name="expenseRatio"
                    value={formData.expenseRatio ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 0.85"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Exit Load</label>
                  <input
                    type="text"
                    name="exitLoad"
                    value={formData.exitLoad || ''}
                    onChange={handleChange}
                    placeholder="e.g. 1% within 1 year"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Benchmark Index</label>
                  <input
                    type="text"
                    name="benchmark"
                    value={formData.benchmark || ''}
                    onChange={handleChange}
                    placeholder="e.g. NIFTY 50 TRI, S&P BSE Sensex"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Returns */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">1Y Return (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="returns1y"
                    value={formData.returns1y ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 21.4"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">3Y Return (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="returns3y"
                    value={formData.returns3y ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 18.2"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">5Y Return (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="returns5y"
                    value={formData.returns5y ?? ''}
                    onChange={handleChange}
                    placeholder="e.g. 16.5"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Investment Objective</label>
                <textarea
                  rows={2}
                  name="investmentObjective"
                  value={formData.investmentObjective || ''}
                  onChange={handleChange}
                  placeholder="Primary objective is to generate long-term capital appreciation..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Section: Description & Badges (Common) */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Full Description</label>
              <textarea
                rows={3}
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                placeholder="Comprehensive description of the product or plan..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 p-3 bg-slate-50 rounded-xl border border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={Boolean(formData.isFeatured)}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  <Sparkles size={14} className="text-amber-500" /> Featured on Catalog
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={Boolean(formData.isActive)}
                  onChange={handleChange}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  <Check size={14} className="text-emerald-500" /> Active Product
                </span>
              </label>
            </div>
          </div>

        </form>

        {/* Footer Buttons */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-indigo-200 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEdit ? 'Update Product' : 'Create Product'}</span>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
