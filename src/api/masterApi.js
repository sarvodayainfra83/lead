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
  getVisitorsMaster as getLocalVisitors,
  createVisitorMaster as saveLocalVisitor,
  updateVisitorMaster as updateLocalVisitor,
  deleteVisitorMaster as deleteLocalVisitor,
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
import { addPosition, removePosition } from '../utils/authUtils';

// Add or remove one position on a user, keeping their others (e.g. a "Manager, Caller" stays a Manager)
const updateUserPosition = async (userId, change, extra = {}) => {
  const { data, error: readError } = await supabase.from('users').select('position').eq('id', userId).maybeSingle();
  if (readError) { console.error('Error reading user position:', readError); throw readError; }
  const { error } = await supabase.from('users').update({ position: change(data?.position), ...extra }).eq('id', userId);
  if (error) { console.error('Error updating user position:', error); throw error; }
};

// Rupee value of an amount like "20k", "5 Lakh", "10L", "1.5 Lakh", "2Cr" (null if none found)
const BUDGET_UNITS = { k: 1e3, thousand: 1e3, l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };
const parseBudgetAmount = (text, fallbackUnit) => {
  const m = /([\d.]+)\s*(k|thousand|lakhs?|lacs?|l|crores?|cr)?\b/i.exec(text || '');
  if (!m) return null;
  const unit = (m[2] || fallbackUnit || '').toLowerCase();
  return parseFloat(m[1]) * (BUDGET_UNITS[unit] || 1);
};

// Sort budgets by their lower bound, then upper bound; every "Above X" budget goes last (in amount order
// among themselves), and unparseable values keep their order after the ranges. Serial numbers follow the sorted order.
const isAboveBudget = (text) => /^\s*above\b/i.test(String(text || ''));
const sortInvestmentBudgets = (rows) => {
  const keyOf = (text) => {
    const str = String(text || '').trim();
    const isAbove = /^(above|more than|over|\d[\d.]*\s*\w*\s*\+)/i.test(str) || /\+\s*$/.test(str);
    const parts = str.replace(/^(above|more than|over|below|under|upto|up to)\s*/i, '').split(/\s*(?:-|–|to)\s*/i);
    const upperUnit = (/(k|thousand|lakhs?|lacs?|l|crores?|cr)\b/i.exec(parts[1] || '') || [])[1];
    const low = parseBudgetAmount(parts[0], upperUnit); // "10 - 25 Lakh" → 10 Lakh
    if (low == null) return [Infinity, Infinity];
    if (/^(below|under|upto|up to)/i.test(str)) return [0, low];
    const high = isAbove ? Infinity : (parseBudgetAmount(parts[1]) ?? low);
    return [low, high];
  };
  return (rows || [])
    .map((row, idx) => ({ row, idx, above: isAboveBudget(row.investmentBudget) ? 1 : 0, key: keyOf(row.investmentBudget) }))
    .sort((a, b) => (a.above - b.above) || (a.key[0] - b.key[0]) || (a.key[1] - b.key[1]) || (a.idx - b.idx))
    .map(({ row }, idx) => ({ ...row, serialNo: idx + 1 }));
};

export const masterApi = {
  // --- LEAD TYPES ---
  async getLeadTypes() {
    if (!isSupabaseConfigured) return getLocalTypes();
    const { data, error } = await supabase.from('master_lead_types').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching lead types:', error); throw error; }
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
        throw error;
      }
      const result = { id: data.id, leadType: data.lead_type };
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_lead_types')
        .insert({ lead_type: leadTypeObj.leadType })
        .select()
        .single();
      if (error) {
        console.error('Error saving lead type:', error);
        throw error;
      }
      const result = { id: data.id, leadType: data.lead_type };
      return result;
    }
  },

  async deleteLeadType(idOrName) {
    if (!isSupabaseConfigured) return deleteLocalType(idOrName);
    const isUuid = idOrName.includes('-');
    const query = supabase.from('master_lead_types').delete();
    const { error } = isUuid ? await query.eq('id', idOrName) : await query.eq('lead_type', idOrName);
    if (error) throw error;
  },

  // --- LEAD SOURCES ---
  async getLeadSources() {
    if (!isSupabaseConfigured) return getLocalSources();
    const { data, error } = await supabase.from('master_lead_sources').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching lead sources:', error); throw error; }
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
        throw error;
      }
      const result = { id: data.id, leadSource: data.lead_source };
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_lead_sources')
        .insert({ lead_source: leadSourceObj.leadSource })
        .select()
        .single();
      if (error) {
        console.error('Error saving lead source:', error);
        throw error;
      }
      const result = { id: data.id, leadSource: data.lead_source };
      return result;
    }
  },

  async deleteLeadSource(idOrName) {
    if (!isSupabaseConfigured) return deleteLocalSource(idOrName);
    const isUuid = idOrName.includes('-');
    const query = supabase.from('master_lead_sources').delete();
    const { error } = isUuid ? await query.eq('id', idOrName) : await query.eq('lead_source', idOrName);
    if (error) throw error;
  },

  // --- LEAD RECEIVERS / TEAM MEMBERS (Queried from users table) ---
  async getLeadReceivers() {
    if (!isSupabaseConfigured) return getLocalReceivers();
    const { data, error } = await supabase
      .from('users')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error fetching team members with relation, trying fallback:', error.message);
      const { data: fallbackData, error: fallbackError } = await supabase.from('users').select('*').order('name', { ascending: true });
      if (fallbackError) { console.error('Error fetching team members:', fallbackError); throw fallbackError; }
      if (fallbackData) {
        let typeMap = {};
        try {
          const { data: ltData } = await supabase.from('master_lead_types').select('id, lead_type');
          if (ltData) ltData.forEach(t => { typeMap[t.id] = t.lead_type; });
        } catch (e) {}
        return fallbackData.map((d, idx) => ({
          id: d.id,
          userId: d.username,
          serialNo: idx + 1,
          leadTypeId: d.lead_type_id,
          leadType: (d.lead_type_id && typeMap[d.lead_type_id]) || '',
          personName: d.name,
          role: d.role,
          position: d.position
        }));
      }
      return [];
    }
    return data.map((d, idx) => ({
      id: d.id,
      userId: d.username,
      serialNo: idx + 1,
      leadTypeId: d.lead_type_id,
      leadType: d.master_lead_types?.lead_type || '',
      personName: d.name,
      role: d.role,
      position: d.position
    }));
  },

  async saveLeadReceiver(receiverObj) {
    let leadTypeId = receiverObj.leadTypeId;
    if (!leadTypeId && receiverObj.leadType && isSupabaseConfigured) {
      const { data: typeRow } = await supabase.from('master_lead_types').select('id').eq('lead_type', receiverObj.leadType).maybeSingle();
      if (typeRow) leadTypeId = typeRow.id;
    }

    if (!isSupabaseConfigured) {
      return receiverObj.id ? updateLocalReceiver(receiverObj.id, receiverObj) : saveLocalReceiver(receiverObj);
    }

    // Add Lead Receiver to the user's positions
    if (receiverObj.id) {
      await updateUserPosition(receiverObj.id, pos => addPosition(pos, 'Lead Receiver'), { lead_type_id: leadTypeId });
    }
    return { ...receiverObj, leadTypeId };
  },

  async deleteLeadReceiver(id) {
    if (!isSupabaseConfigured) return deleteLocalReceiver(id);
    await updateUserPosition(id, pos => removePosition(pos, 'Lead Receiver'));
  },

  // --- CALLER NAMES (Queried from users table with position = 'Caller') ---
  async getCallerNames() {
    if (!isSupabaseConfigured) return getLocalCallers();
    const { data, error } = await supabase
      .from('users')
      .select('*, master_lead_types!lead_type_id(id, lead_type)')
      .ilike('position', '%Caller%')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error fetching caller names with relation, trying fallback:', error.message);
      const { data: fallbackUsers, error: fallbackError } = await supabase
        .from('users')
        .select('*')
        .ilike('position', '%Caller%')
        .order('name', { ascending: true });
      if (fallbackError) { console.error('Error fetching caller names:', fallbackError); throw fallbackError; }

      if (fallbackUsers && fallbackUsers.length > 0) {
        let typeMap = {};
        try {
          const { data: ltData } = await supabase.from('master_lead_types').select('id, lead_type');
          if (ltData) ltData.forEach(t => { typeMap[t.id] = t.lead_type; });
        } catch (e) {}

        return fallbackUsers.map((d, idx) => ({
          id: d.id,
          userId: d.username,
          serialNo: idx + 1,
          leadTypeId: d.lead_type_id,
          leadType: (d.lead_type_id && typeMap[d.lead_type_id]) || '',
          personName: d.name
        }));
      }
      return [];
    }
    return data.map((d, idx) => ({
      id: d.id,
      userId: d.username,
      serialNo: idx + 1,
      leadTypeId: d.lead_type_id,
      leadType: d.master_lead_types?.lead_type || '',
      personName: d.name
    }));
  },

  async saveCallerName(callerObj) {
    let leadTypeId = callerObj.leadTypeId;
    if (!leadTypeId && callerObj.leadType && isSupabaseConfigured) {
      const { data: typeRow } = await supabase.from('master_lead_types').select('id').eq('lead_type', callerObj.leadType).maybeSingle();
      if (typeRow) leadTypeId = typeRow.id;
    }

    if (!isSupabaseConfigured) {
      return callerObj.id ? updateLocalCaller(callerObj.id, callerObj) : saveLocalCaller(callerObj);
    }

    // Add Caller to the user's positions
    if (callerObj.id) {
      await updateUserPosition(callerObj.id, pos => addPosition(pos, 'Caller'), { lead_type_id: leadTypeId });
    }
    return { ...callerObj, leadTypeId };
  },

  async deleteCallerName(id) {
    if (!isSupabaseConfigured) return deleteLocalCaller(id);
    await updateUserPosition(id, pos => removePosition(pos, 'Caller'));
  },

  // --- VISITOR NAMES (Queried from users table with position = 'Visitor' with multi-tier fallback) ---
  async getVisitors() {
    if (!isSupabaseConfigured) return getLocalVisitors();

    let leadTypeMap = {};
    try {
      const { data: ltData } = await supabase.from('master_lead_types').select('id, lead_type');
      if (ltData) ltData.forEach(t => { leadTypeMap[t.id] = t.lead_type; });
    } catch (e) {}

    let lastError = null;

    // 1. Try querying users table where position ILIKE '%Visitor%'
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('position', '%Visitor%')
        .order('name', { ascending: true });
      if (error) lastError = error;

      if (!error && data && data.length > 0) {
        return data.map((d, idx) => ({
          id: d.id,
          userId: d.username,
          serialNo: idx + 1,
          leadTypeId: d.lead_type_id,
          leadType: (d.lead_type_id && leadTypeMap[d.lead_type_id]) || d.lead_type || '',
          leadTypeText: d.lead_type || '', // may list several types, e.g. "Insurance, Mutual Fund"
          personName: d.name
        }));
      }
    } catch (err) {
      console.warn('Error querying users with position=Visitor:', err);
      lastError = err;
    }

    // 2. Fallback: Query all users from users table
    try {
      const { data: allUsers, error: usersErr } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });
      lastError = usersErr || null;

      if (!usersErr && allUsers && allUsers.length > 0) {
        return allUsers.map((d, idx) => ({
          id: d.id,
          userId: d.username,
          serialNo: idx + 1,
          leadTypeId: d.lead_type_id,
          leadType: (d.lead_type_id && leadTypeMap[d.lead_type_id]) || d.lead_type || '',
          leadTypeText: d.lead_type || '', // may list several types, e.g. "Insurance, Mutual Fund"
          personName: d.name
        }));
      }
    } catch (err) {
      console.warn('Error querying all users as visitor fallback:', err);
      lastError = err;
    }

    // 3. Fallback: Query distinct assigned visitors from assigned_visitors table
    try {
      const { data: avData, error: avErr } = await supabase
        .from('assigned_visitors')
        .select('visitor_name, visitor_id')
        .not('visitor_name', 'is', null);

      if (!avErr && avData && avData.length > 0) {
        const unique = [];
        const seen = new Set();
        avData.forEach(r => {
          const name = (r.visitor_name || '').trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            unique.push({
              id: r.visitor_id || `av-${unique.length + 1}`,
              serialNo: unique.length + 1,
              personName: name,
              leadType: ''
            });
          }
        });
        if (unique.length > 0) return unique;
      }
    } catch (err) {}

    // 4. Nothing in the database — surface the users-table error if there was one
    if (lastError) { console.error('Error fetching visitors:', lastError); throw lastError; }
    return [];
  },

  async saveVisitor(visitorObj) {
    let leadTypeId = visitorObj.leadTypeId;
    if (!leadTypeId && visitorObj.leadType && isSupabaseConfigured) {
      try {
        const { data: typeRow } = await supabase.from('master_lead_types').select('id').eq('lead_type', visitorObj.leadType).maybeSingle();
        if (typeRow) leadTypeId = typeRow.id;
      } catch (e) {}
    }

    if (!isSupabaseConfigured) {
      return visitorObj.id ? updateLocalVisitor(visitorObj.id, visitorObj) : saveLocalVisitor(visitorObj);
    }

    const cleanName = (visitorObj.personName || visitorObj.name || '').trim();

    // If ID exists, update the user in Supabase
    if (visitorObj.id) {
      try {
        await updateUserPosition(visitorObj.id, pos => addPosition(pos, 'Visitor'), { lead_type_id: leadTypeId });
      } catch (err) {
        console.error('Could not update user by id:', err);
        throw err;
      }
    } else {
      // New visitor: check if user exists with matching name
      try {
        const { data: existingUser, error: lookupError } = await supabase
          .from('users')
          .select('id')
          .ilike('name', cleanName)
          .maybeSingle();
        if (lookupError) throw lookupError;

        if (existingUser?.id) {
          await updateUserPosition(existingUser.id, pos => addPosition(pos, 'Visitor'), { lead_type_id: leadTypeId });
        } else {
          const username = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.floor(1000 + Math.random() * 9000);
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              username,
              name: cleanName,
              password: 'user123',
              role: 'USER',
              position: 'Visitor',
              lead_type_id: leadTypeId
            });
          if (insertError) throw insertError;
        }
      } catch (err) {
        console.error('Could not create/update user for visitor:', err);
        throw err;
      }
    }

    return { ...visitorObj, leadTypeId };
  },

  async deleteVisitor(id) {
    if (!isSupabaseConfigured) return deleteLocalVisitor(id);
    try {
      await updateUserPosition(id, pos => removePosition(pos, 'Visitor'));
    } catch (e) {
      console.error('Error removing visitor position:', e);
      throw e;
    }
  },

  // --- MUTUAL FUND PRODUCT TYPES ---
  async getMutualFundProducts() {
    if (!isSupabaseConfigured) return getLocalMutualFundProducts();
    const { data, error } = await supabase.from('master_mutual_fund_products').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching mutual fund products:', error); throw error; }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, productType: d.product_type }));
  },

  async saveMutualFundProduct(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalMutualFundProduct(obj) : saveLocalMutualFundProduct(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_mutual_fund_products').update({ product_type: obj.productType }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating mutual fund product:', error); throw error; }
      const result = { id: data.id, productType: data.product_type };
      return result;
    } else {
      const { data, error } = await supabase.from('master_mutual_fund_products').insert({ product_type: obj.productType }).select().single();
      if (error) { console.error('Error saving mutual fund product:', error); throw error; }
      const result = { id: data.id, productType: data.product_type };
      return result;
    }
  },

  async deleteMutualFundProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalMutualFundProduct(id);
    const { error } = await supabase.from('master_mutual_fund_products').delete().eq('id', id);
    if (error) throw error;
  },

  // --- REAL ESTATE PRODUCT TYPES ---
  async getRealEstateProducts() {
    if (!isSupabaseConfigured) return getLocalRealEstateProducts();
    const { data, error } = await supabase.from('master_real_estate_products').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching real estate products:', error); throw error; }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, productType: d.product_type }));
  },

  async saveRealEstateProduct(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalRealEstateProduct(obj) : saveLocalRealEstateProduct(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_real_estate_products').update({ product_type: obj.productType }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating real estate product:', error); throw error; }
      const result = { id: data.id, productType: data.product_type };
      return result;
    } else {
      const { data, error } = await supabase.from('master_real_estate_products').insert({ product_type: obj.productType }).select().single();
      if (error) { console.error('Error saving real estate product:', error); throw error; }
      const result = { id: data.id, productType: data.product_type };
      return result;
    }
  },

  async deleteRealEstateProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalRealEstateProduct(id);
    const { error } = await supabase.from('master_real_estate_products').delete().eq('id', id);
    if (error) throw error;
  },

  // --- REAL ESTATE REQUIREMENTS ---
  async getRealEstateRequirements() {
    if (!isSupabaseConfigured) return getLocalRealEstateRequirements();
    const { data, error } = await supabase.from('master_real_estate_requirements').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching real estate requirements:', error); throw error; }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, requirement: d.requirement }));
  },

  async saveRealEstateRequirement(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalRealEstateRequirement(obj) : saveLocalRealEstateRequirement(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_real_estate_requirements').update({ requirement: obj.requirement }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating real estate requirement:', error); throw error; }
      const result = { id: data.id, requirement: data.requirement };
      return result;
    } else {
      const { data, error } = await supabase.from('master_real_estate_requirements').insert({ requirement: obj.requirement }).select().single();
      if (error) { console.error('Error saving real estate requirement:', error); throw error; }
      const result = { id: data.id, requirement: data.requirement };
      return result;
    }
  },

  async deleteRealEstateRequirement(id) {
    if (!isSupabaseConfigured) return deleteLocalRealEstateRequirement(id);
    const { error } = await supabase.from('master_real_estate_requirements').delete().eq('id', id);
    if (error) throw error;
  },

  // --- INSURANCE PRODUCT TYPES ---
  async getInsuranceProducts() {
    if (!isSupabaseConfigured) return getLocalInsuranceProducts();
    const { data, error } = await supabase.from('master_insurance_products').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching insurance products:', error); throw error; }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, productType: d.product_type }));
  },

  async saveInsuranceProduct(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalInsuranceProduct(obj) : saveLocalInsuranceProduct(obj);

    if (obj.id) {
      const { data, error } = await supabase.from('master_insurance_products').update({ product_type: obj.productType }).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating insurance product:', error); throw error; }
      const result = { id: data.id, productType: data.product_type };
      return result;
    } else {
      const { data, error } = await supabase.from('master_insurance_products').insert({ product_type: obj.productType }).select().single();
      if (error) { console.error('Error saving insurance product:', error); throw error; }
      const result = { id: data.id, productType: data.product_type };
      return result;
    }
  },

  async deleteInsuranceProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalInsuranceProduct(id);
    const { error } = await supabase.from('master_insurance_products').delete().eq('id', id);
    if (error) throw error;
  },

  // --- INSURANCE SUB PRODUCT TYPES (each tied to a parent Insurance Product Type) ---
  async getInsuranceSubProducts() {
    if (!isSupabaseConfigured) return getLocalInsuranceSubProducts();
    const { data, error } = await supabase
      .from('master_insurance_sub_products')
      .select('*, master_insurance_products!product_type_id(id, product_type)')
      .order('created_at', { ascending: true });
    if (error) { console.error('Error fetching insurance sub products:', error); throw error; }
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
      if (error) { console.error('Error updating insurance sub product:', error); throw error; }
      const result = {
        id: data.id,
        productTypeId: data.product_type_id,
        productType: data.master_insurance_products?.product_type || obj.productType,
        subProductType: data.sub_product_type
      };
      return result;
    } else {
      const { data, error } = await supabase
        .from('master_insurance_sub_products')
        .insert({ product_type_id: productTypeId, sub_product_type: obj.subProductType })
        .select('*, master_insurance_products!product_type_id(id, product_type)')
        .single();
      if (error) { console.error('Error saving insurance sub product:', error); throw error; }
      const result = {
        id: data.id,
        productTypeId: data.product_type_id,
        productType: data.master_insurance_products?.product_type || obj.productType,
        subProductType: data.sub_product_type
      };
      return result;
    }
  },

  async deleteInsuranceSubProduct(id) {
    if (!isSupabaseConfigured) return deleteLocalInsuranceSubProduct(id);
    const { error } = await supabase.from('master_insurance_sub_products').delete().eq('id', id);
    if (error) throw error;
  },

  // --- INVESTMENT BUDGETS (each tagged with one or more Lead Types; none = shared across all) ---
  // Returned in ascending amount order (20k - 50k, 5 Lakh - 10 Lakh, ..., Above 5Cr)
  async getInvestmentBudgets() {
    if (!isSupabaseConfigured) return sortInvestmentBudgets(getLocalInvestmentBudgets());
    const [{ data, error }, { data: typeRows }] = await Promise.all([
      supabase.from('master_investment_budgets').select('*').order('created_at', { ascending: true }),
      supabase.from('master_lead_types').select('id, lead_type')
    ]);
    if (error) { console.error('Error fetching investment budgets:', error); throw error; }
    const typeMap = Object.fromEntries((typeRows || []).map(t => [t.id, t.lead_type]));
    return sortInvestmentBudgets(data.map(d => {
      const leadTypeIds = d.lead_type_ids || [];
      return {
        id: d.id,
        investmentBudget: d.investment_budget,
        leadTypeIds,
        leadTypes: leadTypeIds.map(id => typeMap[id]).filter(Boolean)
      };
    }));
  },

  // obj: { id?, investmentBudget, leadTypeIds: [master_lead_types.id], leadTypes: [names] }
  async saveInvestmentBudget(obj) {
    if (!isSupabaseConfigured) return obj.id ? updateLocalInvestmentBudget(obj) : saveLocalInvestmentBudget(obj);

    const payload = { investment_budget: obj.investmentBudget, lead_type_ids: obj.leadTypeIds || [] };
    // lead_type_ids missing in the database (PGRST204 / 42703) — surface the fix instead of the raw schema-cache error
    const explain = (error) => (
      (error?.code === 'PGRST204' || error?.code === '42703') && String(error.message || '').includes('lead_type_ids')
        ? new Error("Database is missing the 'lead_type_ids' column on master_investment_budgets — run the migration in supabase_schema.sql")
        : error
    );
    const toResult = (data) => ({
      id: data.id,
      investmentBudget: data.investment_budget,
      leadTypeIds: data.lead_type_ids || [],
      leadTypes: obj.leadTypes || []
    });

    if (obj.id) {
      const { data, error } = await supabase.from('master_investment_budgets').update(payload).eq('id', obj.id).select().single();
      if (error) { console.error('Error updating investment budget:', error); throw explain(error); }
      const result = toResult(data);
      return result;
    } else {
      const { data, error } = await supabase.from('master_investment_budgets').insert(payload).select().single();
      if (error) { console.error('Error saving investment budget:', error); throw explain(error); }
      const result = toResult(data);
      return result;
    }
  },

  async deleteInvestmentBudget(id) {
    if (!isSupabaseConfigured) return deleteLocalInvestmentBudget(id);
    const { error } = await supabase.from('master_investment_budgets').delete().eq('id', id);
    if (error) throw error;
  }
};
