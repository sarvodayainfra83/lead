import { supabase, isSupabaseConfigured } from './supabaseClient';

// Helper to convert comma-separated string or array into normalized array
export const parseArrayField = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // split by comma or newline
      return val.split(/,|\n/).map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
};

// Helper to safely parse images field into array of URLs
export const parseImagesField = (imagesVal, coverImage = null) => {
  let list = [];
  if (Array.isArray(imagesVal)) {
    list = imagesVal;
  } else if (typeof imagesVal === 'string' && imagesVal.trim()) {
    try {
      const parsed = JSON.parse(imagesVal);
      if (Array.isArray(parsed)) list = parsed;
      else if (typeof parsed === 'string') list = [parsed];
    } catch {
      list = imagesVal.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (coverImage && !list.includes(coverImage)) {
    list.unshift(coverImage);
  }
  return list.filter(Boolean);
};

// Safe number conversions
const toFloatOrNull = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : parseFloat(v));
const toIntOrNull = (v) => (v === '' || v === null || v === undefined || isNaN(parseInt(v, 10)) ? null : parseInt(v, 10));

// Local Storage Fallbacks
const LOCAL_STORAGE_KEYS = {
  REAL_ESTATE: 'pcb_catalog_real_estate_v1',
  INSURANCE: 'pcb_catalog_insurance_v1',
  MUTUAL_FUNDS: 'pcb_catalog_mutual_funds_v1'
};

const getLocalItems = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const items = raw ? JSON.parse(raw) : [];
    return items.sort((a, b) => {
      const tA = new Date(a.updated_at || a.created_at || 0).getTime();
      const tB = new Date(b.updated_at || b.created_at || 0).getTime();
      return tB - tA;
    });
  } catch {
    return [];
  }
};

const saveLocalItems = (key, items) => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }
};

export const productApi = {
  // ---------------------------------------------------------------------------
  // 1. SUPABASE STORAGE MULTI-IMAGE UPLOAD ('products' bucket)
  // ---------------------------------------------------------------------------
  async uploadProductImages(files, category = 'real-estate') {
    if (!files || files.length === 0) return [];
    if (!isSupabaseConfigured) {
      // Local demo mode: convert files to local data URLs or object URLs
      const results = [];
      for (const file of files) {
        if (typeof file === 'string') {
          results.push(file);
          continue;
        }
        if (file instanceof File || file instanceof Blob) {
          const base64 = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(file);
          });
          results.push(base64);
        }
      }
      return results;
    }

    const uploadedUrls = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // If already a hosted URL, don't re-upload
      if (typeof file === 'string' && (file.startsWith('http://') || file.startsWith('https://'))) {
        uploadedUrls.push(file);
        continue;
      }

      try {
        let fileBlob = file;
        let fileExt = 'jpg';
        let contentType = file.type || 'image/jpeg';

        if (typeof file === 'string' && file.startsWith('data:')) {
          const arr = file.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          fileBlob = new Blob([u8arr], { type: mime });
          contentType = mime;
          fileExt = mime.split('/')[1] || 'jpg';
        } else if (file.name) {
          const parts = file.name.split('.');
          if (parts.length > 1) fileExt = parts.pop().toLowerCase();
        }

        const safeCat = category.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const randId = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
        const filePath = `${safeCat}/${year}/${month}/${randId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, fileBlob, {
            contentType,
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.warn('Image upload to products bucket failed, saving inline base64 fallback:', uploadError);
          if (typeof file === 'string') {
            uploadedUrls.push(file);
          } else if (file instanceof File || file instanceof Blob) {
            const base64 = await new Promise((res) => {
              const reader = new FileReader();
              reader.onloadend = () => res(reader.result);
              reader.readAsDataURL(file);
            });
            uploadedUrls.push(base64);
          }
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      } catch (err) {
        console.error('Error uploading product image:', err);
        if (typeof file === 'string') {
          uploadedUrls.push(file);
        } else if (file instanceof File || file instanceof Blob) {
          try {
            const base64 = await new Promise((res) => {
              const reader = new FileReader();
              reader.onloadend = () => res(reader.result);
              reader.readAsDataURL(file);
            });
            uploadedUrls.push(base64);
          } catch { /* ignore */ }
        }
      }
    }

    return uploadedUrls;
  },

  // ---------------------------------------------------------------------------
  // 2. REAL ESTATE PRODUCTS CRUD
  // ---------------------------------------------------------------------------
  async getRealEstateProducts() {
    if (!isSupabaseConfigured) return getLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE);
    const { data, error } = await supabase
      .from('master_real_estate_products')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching real estate products:', error);
      return getLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE);
    }

    return data.map(d => ({
      ...d,
      imagesList: parseImagesField(d.images),
      amenitiesList: parseArrayField(d.amenities)
    }));
  },

  async createRealEstateProduct(item) {
    const payload = {
      title: item.title?.trim() || 'Untitled Property',
      project_name: item.projectName?.trim() || null,
      product_type: item.productType?.trim() || null,
      bhk: item.bhk?.trim() || null,
      price: item.price ? String(item.price).trim() : null,
      area: item.area ? String(item.area).trim() : null,
      area_unit: item.areaUnit?.trim() || 'sqft',
      carpet_area: toFloatOrNull(item.carpetArea),
      built_up_area: toFloatOrNull(item.builtUpArea),
      floor_number: toIntOrNull(item.floorNumber),
      total_floors: toIntOrNull(item.totalFloors),
      facing: item.facing?.trim() || null,
      bedrooms: toIntOrNull(item.bedrooms),
      bathrooms: toIntOrNull(item.bathrooms),
      balconies: toIntOrNull(item.balconies),
      parking: item.parking ? String(item.parking).trim() : null,
      possession_date: item.possessionDate || null,
      construction_status: item.constructionStatus?.trim() || null,
      rera_number: item.reraNumber?.trim() || null,
      builder_name: item.builderName?.trim() || null,
      address: item.address?.trim() || null,
      amenities: Array.isArray(item.amenities) ? item.amenities.join(', ') : (item.amenities || ''),
      images: Array.isArray(item.images) ? JSON.stringify(item.images) : (item.images || '[]'),
      description: item.description?.trim() || null,
      is_featured: Boolean(item.isFeatured),
      is_active: item.isActive !== undefined ? Boolean(item.isActive) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const newItem = { id: `local_re_${Date.now()}`, ...payload, created_at: new Date().toISOString() };
      const current = getLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE);
      saveLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE, [newItem, ...current]);
      return { ...newItem, imagesList: parseImagesField(newItem.images), amenitiesList: parseArrayField(newItem.amenities) };
    }

    const { data, error } = await supabase
      .from('master_real_estate_products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating real estate product:', error);
      throw error;
    }

    return { ...data, imagesList: parseImagesField(data.images), amenitiesList: parseArrayField(data.amenities) };
  },

  async updateRealEstateProduct(id, item) {
    const payload = {
      title: item.title?.trim() || 'Untitled Property',
      project_name: item.projectName?.trim() || null,
      product_type: item.productType?.trim() || null,
      bhk: item.bhk?.trim() || null,
      price: item.price ? String(item.price).trim() : null,
      area: item.area ? String(item.area).trim() : null,
      area_unit: item.areaUnit?.trim() || 'sqft',
      carpet_area: toFloatOrNull(item.carpetArea),
      built_up_area: toFloatOrNull(item.builtUpArea),
      floor_number: toIntOrNull(item.floorNumber),
      total_floors: toIntOrNull(item.totalFloors),
      facing: item.facing?.trim() || null,
      bedrooms: toIntOrNull(item.bedrooms),
      bathrooms: toIntOrNull(item.bathrooms),
      balconies: toIntOrNull(item.balconies),
      parking: item.parking ? String(item.parking).trim() : null,
      possession_date: item.possessionDate || null,
      construction_status: item.constructionStatus?.trim() || null,
      rera_number: item.reraNumber?.trim() || null,
      builder_name: item.builderName?.trim() || null,
      address: item.address?.trim() || null,
      amenities: Array.isArray(item.amenities) ? item.amenities.join(', ') : (item.amenities || ''),
      images: Array.isArray(item.images) ? JSON.stringify(item.images) : (item.images || '[]'),
      description: item.description?.trim() || null,
      is_featured: Boolean(item.isFeatured),
      is_active: item.isActive !== undefined ? Boolean(item.isActive) : true,
      updated_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const current = getLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE);
      const updated = current.map(c => c.id === id ? { ...c, ...payload } : c);
      saveLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE, updated);
      const res = updated.find(c => c.id === id);
      return { ...res, imagesList: parseImagesField(res.images), amenitiesList: parseArrayField(res.amenities) };
    }

    const { data, error } = await supabase
      .from('master_real_estate_products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating real estate product:', error);
      throw error;
    }

    return { ...data, imagesList: parseImagesField(data.images), amenitiesList: parseArrayField(data.amenities) };
  },

  async deleteRealEstateProduct(id) {
    if (!isSupabaseConfigured) {
      const current = getLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE);
      saveLocalItems(LOCAL_STORAGE_KEYS.REAL_ESTATE, current.filter(c => c.id !== id));
      return true;
    }
    const { error } = await supabase.from('master_real_estate_products').delete().eq('id', id);
    if (error) {
      console.error('Error deleting real estate product:', error);
      throw error;
    }
    return true;
  },

  // ---------------------------------------------------------------------------
  // 3. INSURANCE PRODUCTS CRUD
  // ---------------------------------------------------------------------------
  async getInsuranceProducts() {
    if (!isSupabaseConfigured) return getLocalItems(LOCAL_STORAGE_KEYS.INSURANCE);
    const { data, error } = await supabase
      .from('master_insurance_products')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching insurance products:', error);
      return getLocalItems(LOCAL_STORAGE_KEYS.INSURANCE);
    }

    return data.map(d => ({
      ...d,
      imagesList: parseImagesField(d.images, d.cover_image),
      benefitsList: parseArrayField(d.benefits),
      featuresList: parseArrayField(d.features),
      exclusionsList: parseArrayField(d.exclusions)
    }));
  },

  async createInsuranceProduct(item) {
    const imagesArr = Array.isArray(item.images) ? item.images : parseArrayField(item.images);
    const coverImage = item.coverImage || imagesArr[0] || null;

    const payload = {
      title: item.title?.trim() || 'Untitled Plan',
      description: item.description?.trim() || null,
      product_type: item.productType?.trim() || null,
      insurance_sub_type: item.insuranceSubType?.trim() || null,
      insurer_name: item.insurerName?.trim() || null,
      plan_type: item.planType?.trim() || null,
      coverage_amount: toFloatOrNull(item.coverageAmount),
      premium_amount: toFloatOrNull(item.premiumAmount),
      premium_frequency: item.premiumFrequency?.trim() || 'Annual',
      policy_term: toIntOrNull(item.policyTerm),
      policy_term_unit: item.policyTermUnit?.trim() || 'Years',
      entry_age_min: toIntOrNull(item.entryAgeMin),
      entry_age_max: toIntOrNull(item.entryAgeMax),
      claim_settlement_ratio: toFloatOrNull(item.claimSettlementRatio),
      benefits: Array.isArray(item.benefits) ? item.benefits : parseArrayField(item.benefits),
      features: Array.isArray(item.features) ? item.features : parseArrayField(item.features),
      exclusions: Array.isArray(item.exclusions) ? item.exclusions : parseArrayField(item.exclusions),
      documents: Array.isArray(item.documents) ? item.documents : parseArrayField(item.documents),
      cover_image: coverImage,
      images: imagesArr,
      is_featured: Boolean(item.isFeatured),
      is_active: item.isActive !== undefined ? Boolean(item.isActive) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const newItem = { id: `local_ins_${Date.now()}`, ...payload, created_at: new Date().toISOString() };
      const current = getLocalItems(LOCAL_STORAGE_KEYS.INSURANCE);
      saveLocalItems(LOCAL_STORAGE_KEYS.INSURANCE, [newItem, ...current]);
      return {
        ...newItem,
        imagesList: parseImagesField(newItem.images, newItem.cover_image),
        benefitsList: parseArrayField(newItem.benefits),
        featuresList: parseArrayField(newItem.features)
      };
    }

    const { data, error } = await supabase
      .from('master_insurance_products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating insurance product:', error);
      throw error;
    }

    return {
      ...data,
      imagesList: parseImagesField(data.images, data.cover_image),
      benefitsList: parseArrayField(data.benefits),
      featuresList: parseArrayField(data.features)
    };
  },

  async updateInsuranceProduct(id, item) {
    const imagesArr = Array.isArray(item.images) ? item.images : parseArrayField(item.images);
    const coverImage = item.coverImage || imagesArr[0] || null;

    const payload = {
      title: item.title?.trim() || 'Untitled Plan',
      description: item.description?.trim() || null,
      product_type: item.productType?.trim() || null,
      insurance_sub_type: item.insuranceSubType?.trim() || null,
      insurer_name: item.insurerName?.trim() || null,
      plan_type: item.planType?.trim() || null,
      coverage_amount: toFloatOrNull(item.coverageAmount),
      premium_amount: toFloatOrNull(item.premiumAmount),
      premium_frequency: item.premiumFrequency?.trim() || 'Annual',
      policy_term: toIntOrNull(item.policyTerm),
      policy_term_unit: item.policyTermUnit?.trim() || 'Years',
      entry_age_min: toIntOrNull(item.entryAgeMin),
      entry_age_max: toIntOrNull(item.entryAgeMax),
      claim_settlement_ratio: toFloatOrNull(item.claimSettlementRatio),
      benefits: Array.isArray(item.benefits) ? item.benefits : parseArrayField(item.benefits),
      features: Array.isArray(item.features) ? item.features : parseArrayField(item.features),
      exclusions: Array.isArray(item.exclusions) ? item.exclusions : parseArrayField(item.exclusions),
      documents: Array.isArray(item.documents) ? item.documents : parseArrayField(item.documents),
      cover_image: coverImage,
      images: imagesArr,
      is_featured: Boolean(item.isFeatured),
      is_active: item.isActive !== undefined ? Boolean(item.isActive) : true,
      updated_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const current = getLocalItems(LOCAL_STORAGE_KEYS.INSURANCE);
      const updated = current.map(c => c.id === id ? { ...c, ...payload } : c);
      saveLocalItems(LOCAL_STORAGE_KEYS.INSURANCE, updated);
      const res = updated.find(c => c.id === id);
      return {
        ...res,
        imagesList: parseImagesField(res.images, res.cover_image),
        benefitsList: parseArrayField(res.benefits),
        featuresList: parseArrayField(res.features)
      };
    }

    const { data, error } = await supabase
      .from('master_insurance_products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating insurance product:', error);
      throw error;
    }

    return {
      ...data,
      imagesList: parseImagesField(data.images, data.cover_image),
      benefitsList: parseArrayField(data.benefits),
      featuresList: parseArrayField(data.features)
    };
  },

  async deleteInsuranceProduct(id) {
    if (!isSupabaseConfigured) {
      const current = getLocalItems(LOCAL_STORAGE_KEYS.INSURANCE);
      saveLocalItems(LOCAL_STORAGE_KEYS.INSURANCE, current.filter(c => c.id !== id));
      return true;
    }
    const { error } = await supabase.from('master_insurance_products').delete().eq('id', id);
    if (error) {
      console.error('Error deleting insurance product:', error);
      throw error;
    }
    return true;
  },

  // ---------------------------------------------------------------------------
  // 4. MUTUAL FUND PRODUCTS CRUD
  // ---------------------------------------------------------------------------
  async getMutualFundProducts() {
    if (!isSupabaseConfigured) return getLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS);
    const { data, error } = await supabase
      .from('master_mutual_fund_products')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching mutual fund products:', error);
      return getLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS);
    }

    return data.map(d => ({
      ...d,
      imagesList: parseImagesField(d.images, d.cover_image),
      benefitsList: parseArrayField(d.benefits),
      featuresList: parseArrayField(d.features)
    }));
  },

  async createMutualFundProduct(item) {
    const imagesArr = Array.isArray(item.images) ? item.images : parseArrayField(item.images);
    const coverImage = item.coverImage || imagesArr[0] || null;

    const payload = {
      title: item.title?.trim() || 'Untitled Scheme',
      description: item.description?.trim() || null,
      product_type: item.productType?.trim() || null,
      fund_house: item.fundHouse?.trim() || null,
      scheme_name: item.schemeName?.trim() || null,
      risk_level: item.riskLevel?.trim() || null,
      investment_objective: item.investmentObjective?.trim() || null,
      min_investment: toFloatOrNull(item.minInvestment),
      min_sip_amount: toFloatOrNull(item.minSipAmount),
      expense_ratio: toFloatOrNull(item.expenseRatio),
      exit_load: item.exitLoad?.trim() || null,
      benchmark: item.benchmark?.trim() || null,
      returns_1y: toFloatOrNull(item.returns1y),
      returns_3y: toFloatOrNull(item.returns3y),
      returns_5y: toFloatOrNull(item.returns5y),
      benefits: Array.isArray(item.benefits) ? item.benefits : parseArrayField(item.benefits),
      features: Array.isArray(item.features) ? item.features : parseArrayField(item.features),
      cover_image: coverImage,
      images: imagesArr,
      is_featured: Boolean(item.isFeatured),
      is_active: item.isActive !== undefined ? Boolean(item.isActive) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const newItem = { id: `local_mf_${Date.now()}`, ...payload, created_at: new Date().toISOString() };
      const current = getLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS);
      saveLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS, [newItem, ...current]);
      return {
        ...newItem,
        imagesList: parseImagesField(newItem.images, newItem.cover_image),
        benefitsList: parseArrayField(newItem.benefits),
        featuresList: parseArrayField(newItem.features)
      };
    }

    const { data, error } = await supabase
      .from('master_mutual_fund_products')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating mutual fund product:', error);
      throw error;
    }

    return {
      ...data,
      imagesList: parseImagesField(data.images, data.cover_image),
      benefitsList: parseArrayField(data.benefits),
      featuresList: parseArrayField(data.features)
    };
  },

  async updateMutualFundProduct(id, item) {
    const imagesArr = Array.isArray(item.images) ? item.images : parseArrayField(item.images);
    const coverImage = item.coverImage || imagesArr[0] || null;

    const payload = {
      title: item.title?.trim() || 'Untitled Scheme',
      description: item.description?.trim() || null,
      product_type: item.productType?.trim() || null,
      fund_house: item.fundHouse?.trim() || null,
      scheme_name: item.schemeName?.trim() || null,
      risk_level: item.riskLevel?.trim() || null,
      investment_objective: item.investmentObjective?.trim() || null,
      min_investment: toFloatOrNull(item.minInvestment),
      min_sip_amount: toFloatOrNull(item.minSipAmount),
      expense_ratio: toFloatOrNull(item.expenseRatio),
      exit_load: item.exitLoad?.trim() || null,
      benchmark: item.benchmark?.trim() || null,
      returns_1y: toFloatOrNull(item.returns1y),
      returns_3y: toFloatOrNull(item.returns3y),
      returns_5y: toFloatOrNull(item.returns5y),
      benefits: Array.isArray(item.benefits) ? item.benefits : parseArrayField(item.benefits),
      features: Array.isArray(item.features) ? item.features : parseArrayField(item.features),
      cover_image: coverImage,
      images: imagesArr,
      is_featured: Boolean(item.isFeatured),
      is_active: item.isActive !== undefined ? Boolean(item.isActive) : true,
      updated_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured) {
      const current = getLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS);
      const updated = current.map(c => c.id === id ? { ...c, ...payload } : c);
      saveLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS, updated);
      const res = updated.find(c => c.id === id);
      return {
        ...res,
        imagesList: parseImagesField(res.images, res.cover_image),
        benefitsList: parseArrayField(res.benefits),
        featuresList: parseArrayField(res.features)
      };
    }

    const { data, error } = await supabase
      .from('master_mutual_fund_products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating mutual fund product:', error);
      throw error;
    }

    return {
      ...data,
      imagesList: parseImagesField(data.images, data.cover_image),
      benefitsList: parseArrayField(data.benefits),
      featuresList: parseArrayField(data.features)
    };
  },

  async deleteMutualFundProduct(id) {
    if (!isSupabaseConfigured) {
      const current = getLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS);
      saveLocalItems(LOCAL_STORAGE_KEYS.MUTUAL_FUNDS, current.filter(c => c.id !== id));
      return true;
    }
    const { error } = await supabase.from('master_mutual_fund_products').delete().eq('id', id);
    if (error) {
      console.error('Error deleting mutual fund product:', error);
      throw error;
    }
    return true;
  }
};
