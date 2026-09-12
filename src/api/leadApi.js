import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getLeads as getLocalLeads,
  saveLead as saveLocalLead,
  updateLead as updateLocalLead,
  deleteLead as deleteLocalLead
} from '../utils/storageManager';
import { refreshBadgeCounts } from '../store/badgeCountStore';

export const leadApi = {
  // Helper to map DB row -> Frontend Lead model
  mapFromDb(row) {
    return {
      id: row.id || row.lead_id,
      leadNo: row.lead_no || '',
      leadTypeId: row.lead_type_id || null,
      leadType: row.lead_type || row.master_lead_types?.lead_type || '',
      detailId: row.detail_id || row.real_estate_id || row.insurance_id || row.mutual_fund_id || row.id,
      leadReceiverId: row.lead_receiver_id || null,
      leadReceiver: row.lead_receiver || row.master_lead_receivers?.person_name || '',
      leadSourceId: row.lead_source_id || null,
      leadSource: row.lead_source || row.master_lead_sources?.lead_source || '',
      callerAssignedId: row.caller_assigned_id || null,
      callerAssigned: row.caller_assigned || row.master_caller_names?.person_name || '',
      referencerName: row.referencer_name || '',
      // Customer details with aliases for backward compatibility
      customerName: row.customer_name || row.person_name || '',
      personName: row.customer_name || row.person_name || '',
      customerNumber: row.customer_number || row.number || '',
      number: row.customer_number || row.number || '',
      customerEmail: row.customer_email || row.email || '',
      email: row.customer_email || row.email || '',
      customerAddress: row.customer_address || row.location || '',
      location: row.customer_address || row.location || '',
      dob: row.dob || '',
      occupation: row.occupation || '',
      investmentBudgetId: row.investment_budget_id || null,
      investmentBudget: row.investment_budget || '',
      whenToBuyPlan: row.when_to_buy_plan || '',
      remarks: row.remarks || '',
      // Real Estate specific fields
      siteLocation: row.site_location || '',
      requirement: row.requirement || '',
      // Insurance specific fields
      insuranceType: row.insurance_type || '',
      insuranceSubType: row.insurance_sub_type || '',
      anyDesease: row.any_desease || '',
      // Product Type — Real Estate/Mutual Fund's own column, or Insurance's product type reused
      productType: row.product_type || row.insurance_type || '',
      // 'Lead' (Add Lead form) or 'Direct' (Call Tracker's Direct form) — defaults to 'Lead'
      // for leads saved before this field existed.
      processType: row.process_type || 'Lead',
      timestamp: row.timestamp || row.created_at || new Date().toISOString()
    };
  },

  // Helper to get corresponding table name for lead type
  getTableNameForLeadType(leadType) {
    if (!leadType) return 'real_state';
    const normalized = leadType.toLowerCase().trim();
    if (normalized.includes('real') || normalized.includes('estate') || normalized.includes('state')) {
      return 'real_state';
    }
    if (normalized.includes('insurance')) {
      return 'insurance';
    }
    if (normalized.includes('mutual') || normalized.includes('fund')) {
      return 'mutual_fund';
    }
    return 'real_state';
  },

  // Helper to resolve string names to Master FK UUIDs reliably
  async resolveLeadFkIds(lead) {
    let lead_type_id = lead.leadTypeId || null;
    let lead_receiver_id = lead.leadReceiverId || null;
    let lead_source_id = lead.leadSourceId || null;
    let caller_assigned_id = lead.callerAssignedId || null;
    let investment_budget_id = lead.investmentBudgetId || null;

    // 1. Resolve lead_type_id first
    if (!lead_type_id && lead.leadType) {
      const { data } = await supabase
        .from('master_lead_types')
        .select('id')
        .eq('lead_type', lead.leadType)
        .limit(1);
      if (data && data[0]) lead_type_id = data[0].id;
    }

    // 2. Resolve lead_receiver_id
    if (!lead_receiver_id && lead.leadReceiver) {
      let query = supabase.from('master_lead_receivers').select('id').eq('person_name', lead.leadReceiver);
      if (lead_type_id) {
        query = query.eq('lead_type_id', lead_type_id);
      }
      const { data } = await query.limit(1);
      if (data && data[0]) {
        lead_receiver_id = data[0].id;
      } else {
        const { data: fallback } = await supabase.from('master_lead_receivers').select('id').eq('person_name', lead.leadReceiver).limit(1);
        if (fallback && fallback[0]) lead_receiver_id = fallback[0].id;
      }
    }

    // 3. Resolve lead_source_id
    if (!lead_source_id && lead.leadSource) {
      const { data } = await supabase
        .from('master_lead_sources')
        .select('id')
        .eq('lead_source', lead.leadSource)
        .limit(1);
      if (data && data[0]) lead_source_id = data[0].id;
    }

    // 4. Resolve caller_assigned_id
    if (!caller_assigned_id && lead.callerAssigned) {
      let query = supabase.from('master_caller_names').select('id').eq('person_name', lead.callerAssigned);
      if (lead_type_id) {
        query = query.eq('lead_type_id', lead_type_id);
      }
      const { data } = await query.limit(1);
      if (data && data[0]) {
        caller_assigned_id = data[0].id;
      } else {
        const { data: fallback } = await supabase.from('master_caller_names').select('id').eq('person_name', lead.callerAssigned).limit(1);
        if (fallback && fallback[0]) caller_assigned_id = fallback[0].id;
      }
    }

    // 5. Resolve investment_budget_id
    if (!investment_budget_id && lead.investmentBudget) {
      const { data } = await supabase
        .from('master_investment_budgets')
        .select('id')
        .eq('investment_budget', lead.investmentBudget)
        .limit(1);
      if (data && data[0]) investment_budget_id = data[0].id;
    }

    return { lead_type_id, lead_receiver_id, lead_source_id, caller_assigned_id, investment_budget_id };
  },

  // Resolve Product Type / Requirement / Sub Product Type names to the FK ids the detail
  // tables actually store (real_state.product_type_id/requirement_id, mutual_fund.product_type_id,
  // insurance.product_type_id/sub_product_type_id) — these tables have no plain-text
  // product_type column, only the _id FK.
  async resolveProductFkIds(lead, tableName) {
    const result = { product_type_id: null, requirement_id: null, sub_product_type_id: null };

    if (tableName === 'real_state') {
      if (lead.productType) {
        const { data } = await supabase.from('master_real_estate_products').select('id').eq('product_type', lead.productType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
      if (lead.requirement) {
        const { data } = await supabase.from('master_real_estate_requirements').select('id').eq('requirement', lead.requirement).limit(1);
        if (data && data[0]) result.requirement_id = data[0].id;
      }
    } else if (tableName === 'mutual_fund') {
      if (lead.productType) {
        const { data } = await supabase.from('master_mutual_fund_products').select('id').eq('product_type', lead.productType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
    } else if (tableName === 'insurance') {
      if (lead.insuranceType) {
        const { data } = await supabase.from('master_insurance_products').select('id').eq('product_type', lead.insuranceType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
      if (lead.insuranceSubType) {
        const { data } = await supabase.from('master_insurance_sub_products').select('id').eq('sub_product_type', lead.insuranceSubType).limit(1);
        if (data && data[0]) result.sub_product_type_id = data[0].id;
      }
    }

    return result;
  },

  // Fetch all leads across all 3 tables with unified structure
  async getLeads() {
    if (!isSupabaseConfigured) {
      return getLocalLeads();
    }

    // Try reading from unified view first
    const { data: viewData, error: viewError } = await supabase
      .from('all_leads_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (!viewError && viewData) {
      return viewData.map(row => this.mapFromDb(row));
    }

    // Fallback: Fetch directly from central leads table and join
    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          lead_no,
          lead_type_id,
          created_at,
          updated_at,
          real_estate_id,
          insurance_id,
          mutual_fund_id,
          master_lead_types!lead_type_id (id, lead_type),
          real_state!real_estate_id (*, master_lead_receivers(person_name), master_lead_sources(lead_source), master_caller_names(person_name), master_real_estate_products(product_type)),
          insurance!insurance_id (*, master_lead_receivers(person_name), master_lead_sources(lead_source), master_caller_names(person_name)),
          mutual_fund!mutual_fund_id (*, master_lead_receivers(person_name), master_lead_sources(lead_source), master_caller_names(person_name), master_mutual_fund_products(product_type))
        `)
        .order('created_at', { ascending: false });

      if (!leadsError && leadsData) {
        return leadsData.map(l => {
          const detail = l.real_state || l.insurance || l.mutual_fund || {};
          return this.mapFromDb({
            ...detail,
            id: l.id,
            detail_id: detail.id,
            lead_no: l.lead_no,
            lead_type_id: l.lead_type_id,
            lead_type: l.master_lead_types?.lead_type,
            lead_receiver: detail.master_lead_receivers?.person_name,
            lead_source: detail.master_lead_sources?.lead_source,
            caller_assigned: detail.master_caller_names?.person_name,
            product_type: detail.master_real_estate_products?.product_type || detail.master_mutual_fund_products?.product_type
          });
        });
      }
    } catch (err) {
      console.warn('Fallback leads fetch error:', err);
    }

    return getLocalLeads();
  },

  // Save single new lead: writes record to type table first, then registers in leads table via FK
  async saveLead(leadData) {
    if (!isSupabaseConfigured) {
      const res = saveLocalLead(leadData);
      refreshBadgeCounts();
      return res;
    }

    const fkIds = await this.resolveLeadFkIds(leadData);
    const tableName = this.getTableNameForLeadType(leadData.leadType);
    const productFks = await this.resolveProductFkIds(leadData, tableName);

    // 1. Prepare detail payload for the specific table (NO lead_id column!)
    const detailPayload = {
      lead_receiver_id: fkIds.lead_receiver_id,
      lead_source_id: fkIds.lead_source_id,
      caller_assigned_id: fkIds.caller_assigned_id,
      referencer_name: leadData.referencerName || null,
      customer_name: leadData.customerName || leadData.personName || '',
      customer_number: leadData.customerNumber || leadData.number || '',
      customer_email: leadData.customerEmail || leadData.email || null,
      dob: leadData.dob || null,
      customer_address: leadData.customerAddress || leadData.location || null,
      occupation: leadData.occupation || null,
      investment_budget: leadData.investmentBudget || null,
      investment_budget_id: fkIds.investment_budget_id,
      when_to_buy_plan: leadData.whenToBuyPlan || null,
      remarks: leadData.remarks || null,
      process_type: leadData.processType || 'Lead',
      timestamp: leadData.timestamp || new Date().toISOString()
    };

    if (tableName === 'real_state') {
      detailPayload.site_location = leadData.siteLocation || null;
      detailPayload.product_type_id = productFks.product_type_id;
      detailPayload.requirement = leadData.requirement || null;
      detailPayload.requirement_id = productFks.requirement_id;
    } else if (tableName === 'insurance') {
      detailPayload.insurance_type = leadData.insuranceType || 'Insurance';
      detailPayload.insurance_sub_type = leadData.insuranceSubType || null;
      detailPayload.any_desease = leadData.anyDesease || null;
      detailPayload.product_type_id = productFks.product_type_id;
      detailPayload.sub_product_type_id = productFks.sub_product_type_id;
    } else if (tableName === 'mutual_fund') {
      detailPayload.product_type_id = productFks.product_type_id;
    }

    const { data: detailData, error: detailError } = await supabase
      .from(tableName)
      .insert(detailPayload)
      .select()
      .single();

    if (detailError) {
      console.error(`Error inserting into ${tableName}:`, detailError);
      saveLocalLead(leadData);
      refreshBadgeCounts();
      throw detailError;
    }

    // 2. Register into central leads table via Foreign Key
    const parentPayload = {
      lead_no: leadData.leadNo,
      lead_type_id: fkIds.lead_type_id,
      real_estate_id: tableName === 'real_state' ? detailData.id : null,
      insurance_id: tableName === 'insurance' ? detailData.id : null,
      mutual_fund_id: tableName === 'mutual_fund' ? detailData.id : null
    };

    const { data: parentLead, error: parentError } = await supabase
      .from('leads')
      .insert(parentPayload)
      .select()
      .single();

    if (parentError) {
      console.error('Error inserting into central leads table:', parentError);
      // Clean up child record
      await supabase.from(tableName).delete().eq('id', detailData.id);
      saveLocalLead(leadData);
      refreshBadgeCounts();
      throw parentError;
    }

    const createdLead = this.mapFromDb({
      ...detailData,
      id: parentLead.id,
      detail_id: detailData.id,
      lead_no: parentLead.lead_no,
      lead_type_id: parentLead.lead_type_id,
      lead_type: leadData.leadType,
      lead_receiver: leadData.leadReceiver,
      lead_source: leadData.leadSource,
      caller_assigned: leadData.callerAssigned
    });

    saveLocalLead(createdLead);
    refreshBadgeCounts();
    return createdLead;
  },

  // Update existing lead by ID or Lead No
  async updateLead(idOrLeadNo, updatedFields) {
    if (!isSupabaseConfigured) {
      const res = updateLocalLead(idOrLeadNo, updatedFields);
      refreshBadgeCounts();
      return res;
    }

    const isUuid = idOrLeadNo.includes('-');
    // Find parent lead first to know which FK is populated
    const parentQuery = supabase.from('leads').select('id, lead_no, lead_type_id, real_estate_id, insurance_id, mutual_fund_id, master_lead_types(lead_type)');
    const { data: parentData } = isUuid
      ? await parentQuery.eq('id', idOrLeadNo).limit(1)
      : await parentQuery.eq('lead_no', idOrLeadNo).limit(1);

    const parentLead = parentData && parentData[0] ? parentData[0] : null;
    const leadId = parentLead ? parentLead.id : (isUuid ? idOrLeadNo : null);

    const leadType = updatedFields.leadType || parentLead?.master_lead_types?.lead_type;
    const tableName = this.getTableNameForLeadType(leadType);
    const resolvedFks = await this.resolveLeadFkIds(updatedFields);
    const resolvedProductFks = await this.resolveProductFkIds(updatedFields, tableName);

    const detailId = parentLead
      ? (parentLead.real_estate_id || parentLead.insurance_id || parentLead.mutual_fund_id)
      : null;

    const detailPayload = {};
    if (updatedFields.leadReceiverId !== undefined || updatedFields.leadReceiver !== undefined) {
      detailPayload.lead_receiver_id = resolvedFks.lead_receiver_id;
    }
    if (updatedFields.leadSourceId !== undefined || updatedFields.leadSource !== undefined) {
      detailPayload.lead_source_id = resolvedFks.lead_source_id;
    }
    if (updatedFields.callerAssignedId !== undefined || updatedFields.callerAssigned !== undefined) {
      detailPayload.caller_assigned_id = resolvedFks.caller_assigned_id;
    }
    if (updatedFields.referencerName !== undefined) detailPayload.referencer_name = updatedFields.referencerName;
    if (updatedFields.customerName !== undefined || updatedFields.personName !== undefined) {
      detailPayload.customer_name = updatedFields.customerName || updatedFields.personName;
    }
    if (updatedFields.customerNumber !== undefined || updatedFields.number !== undefined) {
      detailPayload.customer_number = updatedFields.customerNumber || updatedFields.number;
    }
    if (updatedFields.customerEmail !== undefined || updatedFields.email !== undefined) {
      detailPayload.customer_email = updatedFields.customerEmail || updatedFields.email;
    }
    if (updatedFields.dob !== undefined) detailPayload.dob = updatedFields.dob || null;
    if (updatedFields.occupation !== undefined) detailPayload.occupation = updatedFields.occupation;
    if (updatedFields.investmentBudget !== undefined) {
      detailPayload.investment_budget = updatedFields.investmentBudget;
      detailPayload.investment_budget_id = resolvedFks.investment_budget_id;
    }
    if (updatedFields.customerAddress !== undefined || updatedFields.location !== undefined) {
      detailPayload.customer_address = updatedFields.customerAddress || updatedFields.location;
    }
    if (updatedFields.whenToBuyPlan !== undefined) detailPayload.when_to_buy_plan = updatedFields.whenToBuyPlan;
    if (updatedFields.remarks !== undefined) detailPayload.remarks = updatedFields.remarks;

    // Type-specific field updates. Product Type's _id columns are only written when a value
    // was actually provided (rather than on any `!== undefined`) — the form pre-fills this
    // field from a joined view column that can lag behind a schema change, and we'd rather
    // leave an existing product_type_id alone than null it out from a blank we can't tell
    // apart from an intentional clear.
    if (tableName === 'real_state') {
      if (updatedFields.siteLocation !== undefined) detailPayload.site_location = updatedFields.siteLocation;
      if (updatedFields.productType) detailPayload.product_type_id = resolvedProductFks.product_type_id;
      if (updatedFields.requirement !== undefined) {
        detailPayload.requirement = updatedFields.requirement;
        detailPayload.requirement_id = resolvedProductFks.requirement_id;
      }
    } else if (tableName === 'insurance') {
      if (updatedFields.insuranceType !== undefined) {
        detailPayload.insurance_type = updatedFields.insuranceType;
        if (updatedFields.insuranceType) detailPayload.product_type_id = resolvedProductFks.product_type_id;
      }
      if (updatedFields.insuranceSubType !== undefined) {
        detailPayload.insurance_sub_type = updatedFields.insuranceSubType;
        if (updatedFields.insuranceSubType) detailPayload.sub_product_type_id = resolvedProductFks.sub_product_type_id;
      }
      if (updatedFields.anyDesease !== undefined) detailPayload.any_desease = updatedFields.anyDesease;
    } else if (tableName === 'mutual_fund') {
      if (updatedFields.productType) detailPayload.product_type_id = resolvedProductFks.product_type_id;
    }

    detailPayload.updated_at = new Date().toISOString();

    if (detailId) {
      const { error } = await supabase
        .from(tableName)
        .update(detailPayload)
        .eq('id', detailId);

      if (error) {
        console.error(`Error updating lead in ${tableName}:`, error);
        updateLocalLead(idOrLeadNo, updatedFields);
        refreshBadgeCounts();
        throw error;
      }
    }

    updateLocalLead(idOrLeadNo, updatedFields);
    refreshBadgeCounts();
    return { id: leadId, ...updatedFields };
  },

  // Delete lead: Deleting from leads table cascades, or deletes corresponding child record
  async deleteLead(idOrLeadNo) {
    if (!isSupabaseConfigured) {
      const res = deleteLocalLead(idOrLeadNo);
      refreshBadgeCounts();
      return res;
    }

    const isUuid = idOrLeadNo.includes('-');
    const parentQuery = supabase.from('leads').select('id, lead_no, real_estate_id, insurance_id, mutual_fund_id');
    const { data: parentData } = isUuid
      ? await parentQuery.eq('id', idOrLeadNo).limit(1)
      : await parentQuery.eq('lead_no', idOrLeadNo).limit(1);

    const parentLead = parentData && parentData[0] ? parentData[0] : null;

    if (parentLead) {
      if (parentLead.real_estate_id) {
        await supabase.from('real_state').delete().eq('id', parentLead.real_estate_id);
      }
      if (parentLead.insurance_id) {
        await supabase.from('insurance').delete().eq('id', parentLead.insurance_id);
      }
      if (parentLead.mutual_fund_id) {
        await supabase.from('mutual_fund').delete().eq('id', parentLead.mutual_fund_id);
      }
      await supabase.from('leads').delete().eq('id', parentLead.id);
    }

    deleteLocalLead(idOrLeadNo);
    refreshBadgeCounts();
  },

  // Bulk add leads
  async bulkSaveLeads(leadsArray) {
    const results = [];
    for (const lead of leadsArray) {
      const saved = await this.saveLead(lead);
      results.push(saved);
    }
    refreshBadgeCounts();
    return results;
  },

  // Batch assign caller to multiple leads
  async assignCallerToLeads(leadAssignments) {
    const leads = await this.getLeads();
    const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));

    const promises = Object.entries(leadAssignments).map(([leadId, callerName]) => {
      const lead = leadsById[leadId];
      return this.updateLead(leadId, {
        callerAssigned: callerName,
        leadType: lead?.leadType,
        leadTypeId: lead?.leadTypeId
      });
    });

    const results = await Promise.all(promises);
    refreshBadgeCounts();
    return results;
  }
};
