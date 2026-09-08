import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getLeads as getLocalLeads,
  saveLead as saveLocalLead,
  updateLead as updateLocalLead,
  deleteLead as deleteLocalLead
} from '../utils/storageManager';

const LEAD_SELECT_QUERY = `
  *,
  master_lead_types!lead_type_id(id, lead_type),
  master_lead_receivers!lead_receiver_id(id, person_name),
  master_lead_sources!lead_source_id(id, lead_source),
  master_caller_names!caller_assigned_id(id, person_name)
`;

export const leadApi = {
  // Helper to map DB row -> Frontend Lead model
  mapFromDb(row) {
    return {
      id: row.id,
      leadNo: row.lead_no,
      leadTypeId: row.lead_type_id,
      leadType: row.master_lead_types?.lead_type || row.lead_type || '',
      leadReceiverId: row.lead_receiver_id,
      leadReceiver: row.master_lead_receivers?.person_name || row.lead_receiver || '',
      leadSourceId: row.lead_source_id,
      leadSource: row.master_lead_sources?.lead_source || row.lead_source || '',
      callerAssignedId: row.caller_assigned_id,
      callerAssigned: row.master_caller_names?.person_name || row.caller_assigned || '',
      personName: row.person_name,
      number: row.number,
      email: row.email || '',
      dob: row.dob || '',
      occupation: row.occupation || '',
      investmentBudget: row.investment_budget || '',
      location: row.location || '',
      whenToBuyPlan: row.when_to_buy_plan || '',
      requirement: row.requirement || '',
      remarks: row.remarks || '',
      timestamp: row.timestamp || new Date().toISOString()
    };
  },

  // Helper to resolve string names to Master FK UUIDs reliably
  async resolveLeadFkIds(lead) {
    let lead_type_id = lead.leadTypeId || null;
    let lead_receiver_id = lead.leadReceiverId || null;
    let lead_source_id = lead.leadSourceId || null;
    let caller_assigned_id = lead.callerAssignedId || null;

    // 1. Resolve lead_type_id first
    if (!lead_type_id && lead.leadType) {
      const { data } = await supabase
        .from('master_lead_types')
        .select('id')
        .eq('lead_type', lead.leadType)
        .limit(1);
      if (data && data[0]) lead_type_id = data[0].id;
    }

    // 2. Resolve lead_receiver_id (matching person_name AND lead_type_id if available)
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

    // 4. Resolve caller_assigned_id (matching person_name AND lead_type_id if available)
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

    return { lead_type_id, lead_receiver_id, lead_source_id, caller_assigned_id };
  },

  // Helper to map Frontend Lead model -> DB row (Only Foreign Keys, no duplicate text!)
  mapToDb(lead, fkIds = {}) {
    return {
      lead_no: lead.leadNo,
      lead_type_id: fkIds.lead_type_id !== undefined ? fkIds.lead_type_id : (lead.leadTypeId || null),
      lead_receiver_id: fkIds.lead_receiver_id !== undefined ? fkIds.lead_receiver_id : (lead.leadReceiverId || null),
      lead_source_id: fkIds.lead_source_id !== undefined ? fkIds.lead_source_id : (lead.leadSourceId || null),
      caller_assigned_id: fkIds.caller_assigned_id !== undefined ? fkIds.caller_assigned_id : (lead.callerAssignedId || null),
      person_name: lead.personName,
      number: lead.number,
      email: lead.email || null,
      dob: lead.dob || null,
      occupation: lead.occupation || null,
      investment_budget: lead.investmentBudget || null,
      location: lead.location || null,
      when_to_buy_plan: lead.whenToBuyPlan || null,
      requirement: lead.requirement || null,
      remarks: lead.remarks || null,
      timestamp: lead.timestamp || new Date().toISOString()
    };
  },

  // Fetch all leads with expanded Master join details
  async getLeads() {
    if (!isSupabaseConfigured) {
      return getLocalLeads();
    }

    const { data, error } = await supabase
      .from('leads')
      .select(LEAD_SELECT_QUERY)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leads from Supabase:', error);
      return getLocalLeads();
    }

    return data.map(row => this.mapFromDb(row));
  },

  // Save single new lead
  async saveLead(leadData) {
    if (!isSupabaseConfigured) {
      return saveLocalLead(leadData);
    }

    const fkIds = await this.resolveLeadFkIds(leadData);
    const payload = this.mapToDb(leadData, fkIds);
    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select(LEAD_SELECT_QUERY)
      .single();

    if (error) {
      console.error('Error saving lead to Supabase:', error);
      saveLocalLead(leadData);
      throw error;
    }

    const created = this.mapFromDb(data);
    saveLocalLead(created);
    return created;
  },

  // Update existing lead by ID or Lead No
  async updateLead(idOrLeadNo, updatedFields) {
    if (!isSupabaseConfigured) {
      return updateLocalLead(idOrLeadNo, updatedFields);
    }

    const resolvedFks = await this.resolveLeadFkIds(updatedFields);

    const payload = {};
    if (updatedFields.leadTypeId !== undefined || updatedFields.leadType !== undefined) {
      payload.lead_type_id = resolvedFks.lead_type_id;
    }
    if (updatedFields.leadReceiverId !== undefined || updatedFields.leadReceiver !== undefined) {
      payload.lead_receiver_id = resolvedFks.lead_receiver_id;
    }
    if (updatedFields.leadSourceId !== undefined || updatedFields.leadSource !== undefined) {
      payload.lead_source_id = resolvedFks.lead_source_id;
    }
    if (updatedFields.callerAssignedId !== undefined || updatedFields.callerAssigned !== undefined) {
      payload.caller_assigned_id = resolvedFks.caller_assigned_id;
    }

    if (updatedFields.personName !== undefined) payload.person_name = updatedFields.personName;
    if (updatedFields.number !== undefined) payload.number = updatedFields.number;
    if (updatedFields.email !== undefined) payload.email = updatedFields.email;
    if (updatedFields.dob !== undefined) payload.dob = updatedFields.dob;
    if (updatedFields.occupation !== undefined) payload.occupation = updatedFields.occupation;
    if (updatedFields.investmentBudget !== undefined) payload.investment_budget = updatedFields.investmentBudget;
    if (updatedFields.location !== undefined) payload.location = updatedFields.location;
    if (updatedFields.whenToBuyPlan !== undefined) payload.when_to_buy_plan = updatedFields.whenToBuyPlan;
    if (updatedFields.requirement !== undefined) payload.requirement = updatedFields.requirement;
    if (updatedFields.remarks !== undefined) payload.remarks = updatedFields.remarks;
    payload.updated_at = new Date().toISOString();

    const isUuid = idOrLeadNo.includes('-');
    const query = supabase.from('leads').update(payload);
    const { data, error } = isUuid
      ? await query.eq('id', idOrLeadNo).select(LEAD_SELECT_QUERY)
      : await query.eq('lead_no', idOrLeadNo).select(LEAD_SELECT_QUERY);

    if (error) {
      console.error('Error updating lead in Supabase:', error);
      updateLocalLead(idOrLeadNo, updatedFields);
      throw error;
    }

    updateLocalLead(idOrLeadNo, updatedFields);
    return data && data[0] ? this.mapFromDb(data[0]) : null;
  },

  // Delete lead
  async deleteLead(idOrLeadNo) {
    if (!isSupabaseConfigured) {
      return deleteLocalLead(idOrLeadNo);
    }

    const isUuid = idOrLeadNo.includes('-');
    const query = supabase.from('leads').delete();
    const { error } = isUuid
      ? await query.eq('id', idOrLeadNo)
      : await query.eq('lead_no', idOrLeadNo);

    if (error) {
      console.error('Error deleting lead from Supabase:', error);
      throw error;
    }

    deleteLocalLead(idOrLeadNo);
  },

  // Bulk add leads
  async bulkSaveLeads(leadsArray) {
    if (!isSupabaseConfigured) {
      leadsArray.forEach(l => saveLocalLead(l));
      return;
    }

    // Pre-fetch master tables to efficiently map string names to FK IDs
    const [types, receivers, sources, callers] = await Promise.all([
      supabase.from('master_lead_types').select('id, lead_type'),
      supabase.from('master_lead_receivers').select('id, person_name, lead_type_id'),
      supabase.from('master_lead_sources').select('id, lead_source'),
      supabase.from('master_caller_names').select('id, person_name, lead_type_id')
    ]);

    const typeMap = new Map((types.data || []).map(t => [t.lead_type, t.id]));
    const sourceMap = new Map((sources.data || []).map(s => [s.lead_source, s.id]));

    const payloads = leadsArray.map(l => {
      const typeId = l.leadTypeId || typeMap.get(l.leadType) || null;

      const receiverRow = (receivers.data || []).find(r => r.person_name === l.leadReceiver && (!typeId || r.lead_type_id === typeId))
        || (receivers.data || []).find(r => r.person_name === l.leadReceiver);

      const callerRow = (callers.data || []).find(c => c.person_name === l.callerAssigned && (!typeId || c.lead_type_id === typeId))
        || (callers.data || []).find(c => c.person_name === l.callerAssigned);

      const fkIds = {
        lead_type_id: typeId,
        lead_receiver_id: l.leadReceiverId || (receiverRow ? receiverRow.id : null),
        lead_source_id: l.leadSourceId || sourceMap.get(l.leadSource) || null,
        caller_assigned_id: l.callerAssignedId || (callerRow ? callerRow.id : null)
      };
      return this.mapToDb(l, fkIds);
    });

    const { data, error } = await supabase
      .from('leads')
      .insert(payloads)
      .select(LEAD_SELECT_QUERY);

    if (error) {
      console.error('Error bulk inserting leads into Supabase:', error);
      leadsArray.forEach(l => saveLocalLead(l));
      throw error;
    }

    leadsArray.forEach(l => saveLocalLead(l));
    return data.map(row => this.mapFromDb(row));
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

    return Promise.all(promises);
  }
};
