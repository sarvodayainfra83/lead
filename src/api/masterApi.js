import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getLeadTypesMaster as getLocalTypes,
  createLeadTypeMaster as saveLocalType,
  updateLeadTypeMaster as updateLocalType,
  deleteLeadTypeMaster as deleteLocalType,
  getLeadSourcesMaster as getLocalSources,
  createLeadSourceMaster as saveLocalSource,
  updateLeadSourceMaster as updateLocalSource,
  deleteLeadSourceMaster as deleteLocalSource,
  getLeadReceiversMaster as getLocalReceivers,
  createLeadReceiverMaster as saveLocalReceiver,
  updateLeadReceiverMaster as updateLocalReceiver,
  deleteLeadReceiverMaster as deleteLocalReceiver,
  getCallerNamesMaster as getLocalCallers,
  createCallerNameMaster as saveLocalCaller,
  updateCallerNameMaster as updateLocalCaller,
  deleteCallerNameMaster as deleteLocalCaller,
  getMutualFundProductsMaster as getLocalMutualFundProducts,
  createMutualFundProductMaster as saveLocalMutualFundProduct,
  updateMutualFundProductMaster as updateLocalMutualFundProduct,
  deleteMutualFundProductMaster as deleteLocalMutualFundProduct,
  getRealEstateProductsMaster as getLocalRealEstateProducts,
  createRealEstateProductMaster as saveLocalRealEstateProduct,
  updateRealEstateProductMaster as updateLocalRealEstateProduct,
  deleteRealEstateProductMaster as deleteLocalRealEstateProduct,
  getRealEstateRequirementsMaster as getLocalRealEstateRequirements,
  createRealEstateRequirementMaster as saveLocalRealEstateRequirement,
  updateRealEstateRequirementMaster as updateLocalRealEstateRequirement,
  deleteRealEstateRequirementMaster as deleteLocalRealEstateRequirement,
  getInsuranceProductsMaster as getLocalInsuranceProducts,
  createInsuranceProductMaster as saveLocalInsuranceProduct,
  updateInsuranceProductMaster as updateLocalInsuranceProduct,
  deleteInsuranceProductMaster as deleteLocalInsuranceProduct,
  getInsuranceSubProductsMaster as getLocalInsuranceSubProducts,
  createInsuranceSubProductMaster as saveLocalInsuranceSubProduct,
  updateInsuranceSubProductMaster as updateLocalInsuranceSubProduct,
  deleteInsuranceSubProductMaster as deleteLocalInsuranceSubProduct,
  getInvestmentBudgetsMaster as getLocalInvestmentBudgets,
  createInvestmentBudgetMaster as saveLocalInvestmentBudget,
  updateInvestmentBudgetMaster as updateLocalInvestmentBudget,
  deleteInvestmentBudgetMaster as deleteLocalInvestmentBudget
} from '../utils/storageManager';

export const masterApi = {
  // --- LEAD TYPES ---
  async getLeadTypes() {
    if (!isSupabaseConfigured) return getLocalTypes();
    const { data, error } = await supabase.from('master_lead_types').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching lead types:', error); return getLocalTypes(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, leadType: d.lead_type }));
  },

  async saveLeadType(leadTypeObj) {
    if (!isSupabaseConfigured) {
      if (leadTypeObj.id) {
        return updateLocalType(leadTypeObj.id, leadTypeObj);
      }
      return saveLocalType(leadTypeObj);
    }

    if (leadTypeObj.id) {
      const { data, error } = await supabase
        .from('master_lead_types')
        .update({ lead_type: leadTypeObj.leadType })
        .eq('id', leadTypeObj.id)
        .select()
        .single();
      if (error) {
        console.error('Error updating lead type:', error);
        updateLocalType(leadTypeObj.id, leadTypeObj);
        throw error;
      }
      const result = { id: data.id, leadType: data.lead_type };
      updateLocalType(leadTypeObj.id, result);
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_lead_types')
        .insert({ lead_type: leadTypeObj.leadType })
        .select()
        .single();
      if (error) {
        console.error('Error saving lead type:', error);
        saveLocalType(leadTypeObj);
        throw error;
      }
      const result = { id: data.id, leadType: data.lead_type };
      saveLocalType(result);
      return result;
    }
  },

  async deleteLeadType(idOrName) {
    if (!isSupabaseConfigured) return deleteLocalType(idOrName);
    const isUuid = idOrName.includes('-');
    const query = supabase.from('master_lead_types').delete();
    const { error } = isUuid ? await query.eq('id', idOrName) : await query.eq('lead_type', idOrName);
    if (error) throw error;
    deleteLocalType(idOrName);
  },

  // --- LEAD SOURCES ---
  async getLeadSources() {
    if (!isSupabaseConfigured) return getLocalSources();
    const { data, error } = await supabase.from('master_lead_sources').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching lead sources:', error); return getLocalSources(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, leadSource: d.lead_source }));
  },

  async saveLeadSource(leadSourceObj) {
    if (!isSupabaseConfigured) {
      if (leadSourceObj.id) {
        return updateLocalSource(leadSourceObj.id, leadSourceObj);
      }
      return saveLocalSource(leadSourceObj);
    }

    if (leadSourceObj.id) {
      const { data, error } = await supabase
        .from('master_lead_sources')
        .update({ lead_source: leadSourceObj.leadSource })
        .eq('id', leadSourceObj.id)
        .select()
        .single();
      if (error) {
        console.error('Error updating lead source:', error);
        updateLocalSource(leadSourceObj.id, leadSourceObj);
        throw error;
      }
      const result = { id: data.id, leadSource: data.lead_source };
      updateLocalSource(leadSourceObj.id, result);
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_lead_sources')
        .insert({ lead_source: leadSourceObj.leadSource })
        .select()
        .single();
      if (error) {
        console.error('Error saving lead source:', error);
        saveLocalSource(leadSourceObj);
        throw error;
      }
      const result = { id: data.id, leadSource: data.lead_source };
      saveLocalSource(result);
      return result;
    }
  },

  async deleteLeadSource(idOrName) {
    if (!isSupabaseConfigured) return deleteLocalSource(idOrName);
    const isUuid = idOrName.includes('-');
    const query = supabase.from('master_lead_sources').delete();
    const { error } = isUuid ? await query.eq('id', idOrName) : await query.eq('lead_source', idOrName);
    if (error) throw error;
    deleteLocalSource(idOrName);
  },

  // --- LEAD RECEIVERS ---
  async getLeadReceivers() {
    if (!isSupabaseConfigured) return getLocalReceivers();
    const { data, error } = await supabase
      .from('master_lead_receivers')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .order('created_at', { ascending: true });
    if (error) { console.error('Error fetching lead receivers:', error); return getLocalReceivers(); }
    return data.map((d, idx) => ({
      id: d.id,
      serialNo: idx + 1,
      leadTypeId: d.lead_type_id,
      leadType: d.master_lead_types?.lead_type || '',
      personName: d.person_name
    }));
  },

  async saveLeadReceiver(receiverObj) {
    let leadTypeId = receiverObj.leadTypeId;
    if (!leadTypeId && receiverObj.leadType && isSupabaseConfigured) {
      const { data: typeRow } = await supabase.from('master_lead_types').select('id').eq('lead_type', receiverObj.leadType).maybeSingle();
      if (typeRow) leadTypeId = typeRow.id;
    }

    if (!isSupabaseConfigured) {
      if (receiverObj.id) {
        return updateLocalReceiver(receiverObj.id, receiverObj);
      }
      return saveLocalReceiver(receiverObj);
    }

    if (receiverObj.id) {
      const { data, error } = await supabase
        .from('master_lead_receivers')
        .update({ lead_type_id: leadTypeId, person_name: receiverObj.personName })
        .eq('id', receiverObj.id)
        .select('*, master_lead_types!lead_type_id(id, lead_type)')
        .single();
      if (error) {
        console.error('Error updating lead receiver:', error);
        updateLocalReceiver(receiverObj.id, receiverObj);
        throw error;
      }
      const result = {
        id: data.id,
        leadTypeId: data.lead_type_id,
        leadType: data.master_lead_types?.lead_type || receiverObj.leadType,
        personName: data.person_name
      };
      updateLocalReceiver(receiverObj.id, result);
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_lead_receivers')
        .insert({ lead_type_id: leadTypeId, person_name: receiverObj.personName })
        .select('*, master_lead_types!lead_type_id(id, lead_type)')
        .single();
      if (error) {
        console.error('Error saving lead receiver:', error);
        saveLocalReceiver(receiverObj);
        throw error;
      }
      const result = {
        id: data.id,
        leadTypeId: data.lead_type_id,
        leadType: data.master_lead_types?.lead_type || receiverObj.leadType,
        personName: data.person_name
      };
      saveLocalReceiver(result);
      return result;
    }
  },

  async deleteLeadReceiver(id) {
    if (!isSupabaseConfigured) return deleteLocalReceiver(id);
    const { error } = await supabase.from('master_lead_receivers').delete().eq('id', id);
    if (error) throw error;
    deleteLocalReceiver(id);
  },

  // --- CALLER NAMES ---
  async getCallerNames() {
    if (!isSupabaseConfigured) return getLocalCallers();
    const { data, error } = await supabase
      .from('master_caller_names')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .order('created_at', { ascending: true });
    if (error) { console.error('Error fetching caller names:', error); return getLocalCallers(); }
    return data.map((d, idx) => ({
      id: d.id,
      serialNo: idx + 1,
      leadTypeId: d.lead_type_id,
      leadType: d.master_lead_types?.lead_type || '',
      personName: d.person_name
    }));
  },

  async saveCallerName(callerObj) {
    let leadTypeId = callerObj.leadTypeId;
    if (!leadTypeId && callerObj.leadType && isSupabaseConfigured) {
      const { data: typeRow } = await supabase.from('master_lead_types').select('id').eq('lead_type', callerObj.leadType).maybeSingle();
      if (typeRow) leadTypeId = typeRow.id;
    }

    if (!isSupabaseConfigured) {
      if (callerObj.id) {
        return updateLocalCaller(callerObj.id, callerObj);
      }
      return saveLocalCaller(callerObj);
    }

    if (callerObj.id) {
      const { data, error } = await supabase
        .from('master_caller_names')
        .update({ lead_type_id: leadTypeId, person_name: callerObj.personName })
        .eq('id', callerObj.id)
        .select('*, master_lead_types!lead_type_id(id, lead_type)')
        .single();
      if (error) {
        console.error('Error updating caller name:', error);
        updateLocalCaller(callerObj.id, callerObj);
        throw error;
      }
      const result = {
        id: data.id,
        leadTypeId: data.lead_type_id,
        leadType: data.master_lead_types?.lead_type || callerObj.leadType,
        personName: data.person_name
      };
      updateLocalCaller(callerObj.id, result);
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_caller_names')
        .insert({ lead_type_id: leadTypeId, person_name: callerObj.personName })
        .select('*, master_lead_types!lead_type_id(id, lead_type)')
        .single();
      if (error) {
        console.error('Error saving caller name:', error);
        saveLocalCaller(callerObj);
        throw error;
      }
      const result = {
        id: data.id,
        leadTypeId: data.lead_type_id,
        leadType: data.master_lead_types?.lead_type || callerObj.leadType,
        personName: data.person_name
      };
      saveLocalCaller(result);
      return result;
    }
  },

  async deleteCallerName(id) {
    if (!isSupabaseConfigured) return deleteLocalCaller(id);
    const { error } = await supabase.from('master_caller_names').delete().eq('id', id);
    if (error) throw error;
    deleteLocalCaller(id);
  },

  // --- MUTUAL FUND PRODUCT TYPES ---
  async getMutualFundProducts() {
    if (!isSupabaseConfigured) return getLocalMutualFundProducts();
    const { data, error } = await supabase.from('master_mutual_fund_products').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching mutual fund products:', error); return getLocalMutualFundProducts(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, productType: d.product_type }));
  },

  async saveMutualFundProduct(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalMutualFundProduct(obj) : saveLocalMutualFundProduct(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_mutual_fund_products').update({ product_type: obj.productType }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating mutual fund product:', error); updateLocalMutualFundProduct(obj); throw error; }
      const result = { id: data.id, productType: data.product_type };
      updateLocalMutualFundProduct(result);
      return result;
    } else {
      const { data, error } = await supabase.from('master_mutual_fund_products').insert({ product_type: obj.productType }).select().single();
      if (error) { console.error('Error saving mutual fund product:', error); saveLocalMutualFundProduct(obj); throw error; }
      const result = { id: data.id, productType: data.product_type };
      saveLocalMutualFundProduct(result);
      return result;
    }
  },

  async deleteMutualFundProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalMutualFundProduct(id);
    const { error } = await supabase.from('master_mutual_fund_products').delete().eq('id', id);
    if (error) throw error;
    deleteLocalMutualFundProduct(id);
  },

  // --- REAL ESTATE PRODUCT TYPES ---
  async getRealEstateProducts() {
    if (!isSupabaseConfigured) return getLocalRealEstateProducts();
    const { data, error } = await supabase.from('master_real_estate_products').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching real estate products:', error); return getLocalRealEstateProducts(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, productType: d.product_type }));
  },

  async saveRealEstateProduct(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalRealEstateProduct(obj) : saveLocalRealEstateProduct(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_real_estate_products').update({ product_type: obj.productType }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating real estate product:', error); updateLocalRealEstateProduct(obj); throw error; }
      const result = { id: data.id, productType: data.product_type };
      updateLocalRealEstateProduct(result);
      return result;
    } else {
      const { data, error } = await supabase.from('master_real_estate_products').insert({ product_type: obj.productType }).select().single();
      if (error) { console.error('Error saving real estate product:', error); saveLocalRealEstateProduct(obj); throw error; }
      const result = { id: data.id, productType: data.product_type };
      saveLocalRealEstateProduct(result);
      return result;
    }
  },

  async deleteRealEstateProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalRealEstateProduct(id);
    const { error } = await supabase.from('master_real_estate_products').delete().eq('id', id);
    if (error) throw error;
    deleteLocalRealEstateProduct(id);
  },

  // --- REAL ESTATE REQUIREMENTS ---
  async getRealEstateRequirements() {
    if (!isSupabaseConfigured) return getLocalRealEstateRequirements();
    const { data, error } = await supabase.from('master_real_estate_requirements').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching real estate requirements:', error); return getLocalRealEstateRequirements(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, requirement: d.requirement }));
  },

  async saveRealEstateRequirement(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalRealEstateRequirement(obj) : saveLocalRealEstateRequirement(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_real_estate_requirements').update({ requirement: obj.requirement }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating real estate requirement:', error); updateLocalRealEstateRequirement(obj); throw error; }
      const result = { id: data.id, requirement: data.requirement };
      updateLocalRealEstateRequirement(result);
      return result;
    } else {
      const { data, error } = await supabase.from('master_real_estate_requirements').insert({ requirement: obj.requirement }).select().single();
      if (error) { console.error('Error saving real estate requirement:', error); saveLocalRealEstateRequirement(obj); throw error; }
      const result = { id: data.id, requirement: data.requirement };
      saveLocalRealEstateRequirement(result);
      return result;
    }
  },

  async deleteRealEstateRequirement(id) {
    if (!isSupabaseConfigured) return deleteLocalRealEstateRequirement(id);
    const { error } = await supabase.from('master_real_estate_requirements').delete().eq('id', id);
    if (error) throw error;
    deleteLocalRealEstateRequirement(id);
  },

  // --- INSURANCE PRODUCT TYPES ---
  async getInsuranceProducts() {
    if (!isSupabaseConfigured) return getLocalInsuranceProducts();
    const { data, error } = await supabase.from('master_insurance_products').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching insurance products:', error); return getLocalInsuranceProducts(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, productType: d.product_type }));
  },

  async saveInsuranceProduct(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalInsuranceProduct(obj) : saveLocalInsuranceProduct(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_insurance_products').update({ product_type: obj.productType }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating insurance product:', error); updateLocalInsuranceProduct(obj); throw error; }
      const result = { id: data.id, productType: data.product_type };
      updateLocalInsuranceProduct(result);
      return result;
    } else {
      const { data, error } = await supabase.from('master_insurance_products').insert({ product_type: obj.productType }).select().single();
      if (error) { console.error('Error saving insurance product:', error); saveLocalInsuranceProduct(obj); throw error; }
      const result = { id: data.id, productType: data.product_type };
      saveLocalInsuranceProduct(result);
      return result;
    }
  },

  async deleteInsuranceProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalInsuranceProduct(id);
    const { error } = await supabase.from('master_insurance_products').delete().eq('id', id);
    if (error) throw error;
    deleteLocalInsuranceProduct(id);
  },

  // --- INSURANCE SUB PRODUCT TYPES (each tied to a parent Insurance Product Type) ---
  async getInsuranceSubProducts() {
    if (!isSupabaseConfigured) return getLocalInsuranceSubProducts();
    const { data, error } = await supabase
      .from('master_insurance_sub_products')
      .select('*, master_insurance_products!product_type_id(id, product_type)')
      .order('created_at', { ascending: true });
    if (error) { console.error('Error fetching insurance sub products:', error); return getLocalInsuranceSubProducts(); }
    return data.map((d, idx) => ({
      id: d.id,
      serialNo: idx + 1,
      productTypeId: d.product_type_id,
      productType: d.master_insurance_products?.product_type || '',
      subProductType: d.sub_product_type
    }));
  },

  async saveInsuranceSubProduct(obj) {
    let productTypeId = obj.productTypeId;
    if (!productTypeId && obj.productType && isSupabaseConfigured) {
      const { data: typeRow } = await supabase.from('master_insurance_products').select('id').eq('product_type', obj.productType).maybeSingle();
      if (typeRow) productTypeId = typeRow.id;
    }

    if (!isSupabaseConfigured) return obj.id ? updateLocalInsuranceSubProduct(obj) : saveLocalInsuranceSubProduct(obj);

    if (obj.id) {
      const { data, error } = await supabase
        .from('master_insurance_sub_products')
        .update({ product_type_id: productTypeId, sub_product_type: obj.subProductType })
        .eq('id', obj.id)
        .select('*, master_insurance_products!product_type_id(id, product_type)')
        .single();
      if (error) { console.error('Error updating insurance sub product:', error); updateLocalInsuranceSubProduct(obj); throw error; }
      const result = {
        id: data.id,
        productTypeId: data.product_type_id,
        productType: data.master_insurance_products?.product_type || obj.productType,
        subProductType: data.sub_product_type
      };
      updateLocalInsuranceSubProduct(result);
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_insurance_sub_products')
        .insert({ product_type_id: productTypeId, sub_product_type: obj.subProductType })
        .select('*, master_insurance_products!product_type_id(id, product_type)')
        .single();
      if (error) { console.error('Error saving insurance sub product:', error); saveLocalInsuranceSubProduct(obj); throw error; }
      const result = {
        id: data.id,
        productTypeId: data.product_type_id,
        productType: data.master_insurance_products?.product_type || obj.productType,
        subProductType: data.sub_product_type
      };
      saveLocalInsuranceSubProduct(result);
      return result;
    }
  },

  async deleteInsuranceSubProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalInsuranceSubProduct(id);
    const { error } = await supabase.from('master_insurance_sub_products').delete().eq('id', id);
    if (error) throw error;
    deleteLocalInsuranceSubProduct(id);
  },

  // --- INVESTMENT BUDGETS (shared across Real Estate / Mutual Fund / Insurance) ---
  async getInvestmentBudgets() {
    if (!isSupabaseConfigured) return getLocalInvestmentBudgets();
    const { data, error } = await supabase.from('master_investment_budgets').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching investment budgets:', error); return getLocalInvestmentBudgets(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, investmentBudget: d.investment_budget }));
  },

  async saveInvestmentBudget(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalInvestmentBudget(obj) : saveLocalInvestmentBudget(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_investment_budgets').update({ investment_budget: obj.investmentBudget }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating investment budget:', error); updateLocalInvestmentBudget(obj); throw error; }
      const result = { id: data.id, investmentBudget: data.investment_budget };
      updateLocalInvestmentBudget(result);
      return result;
    } else {
      const { data, error } = await supabase.from('master_investment_budgets').insert({ investment_budget: obj.investmentBudget }).select().single();
      if (error) { console.error('Error saving investment budget:', error); saveLocalInvestmentBudget(obj); throw error; }
      const result = { id: data.id, investmentBudget: data.investment_budget };
      saveLocalInvestmentBudget(result);
      return result;
    }
  },

  async deleteInvestmentBudget(id) {
    if (!isSupabaseConfigured) return deleteLocalInvestmentBudget(id);
    const { error } = await supabase.from('master_investment_budgets').delete().eq('id', id);
    if (error) throw error;
    deleteLocalInvestmentBudget(id);
  }
};
