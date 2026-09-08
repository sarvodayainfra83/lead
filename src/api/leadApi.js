import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getLeads as getLocalLeads,
  saveLead as saveLocalLead,
  updateLead as updateLocalLead,
  deleteLead as deleteLocalLead
} from '../utils/storageManager';

export const leadApi = {
  // Helper to map DB row -> Frontend Lead model
  mapFromDb(row) {
    return {
      id: row.id,
      leadNo: row.lead_no,
      leadType: row.lead_type,
      leadReceiver: row.lead_receiver || '',
      leadSource: row.lead_source,
      personName: row.person_name,
      number: row.number,
      email: row.email || '',
      dob: row.dob || '',
      occupation: row.occupation || '',
      investmentBudget: row.investment_budget || '',
      location: row.location || '',
      whenToBuyPlan: row.when_to_buy_plan || '',
      callerAssigned: row.caller_assigned || '',
      remarks: row.remarks || '',
      processType: row.process_type || 'Lead',
      timestamp: row.timestamp || new Date().toISOString()
    };
  },

  // Helper to map Frontend Lead model -> DB row
  mapToDb(lead) {
    return {
      lead_no: lead.leadNo,
      lead_type: lead.leadType,
      lead_receiver: lead.leadReceiver || null,
      lead_source: lead.leadSource,
      person_name: lead.personName,
      number: lead.number,
      email: lead.email || null,
      dob: lead.dob || null,
      occupation: lead.occupation || null,
      investment_budget: lead.investmentBudget || null,
      location: lead.location || null,
      when_to_buy_plan: lead.whenToBuyPlan || null,
      caller_assigned: lead.callerAssigned || null,
      remarks: lead.remarks || null,
      process_type: lead.processType || 'Lead',
      timestamp: lead.timestamp || new Date().toISOString()
    };
  },

  // Fetch all leads
  async getLeads() {
    if (!isSupabaseConfigured) {
      return getLocalLeads();
    }

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leads from Supabase:', error);
      return getLocalLeads();
    }

    return data.map(this.mapFromDb);
  },

  // Save single new lead
  async saveLead(leadData) {
    if (!isSupabaseConfigured) {
      return saveLocalLead(leadData);
    }

    const payload = this.mapToDb(leadData);
    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select()
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

    const payload = {};
    if (updatedFields.leadType !== undefined) payload.lead_type = updatedFields.leadType;
    if (updatedFields.leadReceiver !== undefined) payload.lead_receiver = updatedFields.leadReceiver;
    if (updatedFields.leadSource !== undefined) payload.lead_source = updatedFields.leadSource;
    if (updatedFields.personName !== undefined) payload.person_name = updatedFields.personName;
    if (updatedFields.number !== undefined) payload.number = updatedFields.number;
    if (updatedFields.email !== undefined) payload.email = updatedFields.email;
    if (updatedFields.dob !== undefined) payload.dob = updatedFields.dob;
    if (updatedFields.occupation !== undefined) payload.occupation = updatedFields.occupation;
    if (updatedFields.investmentBudget !== undefined) payload.investment_budget = updatedFields.investmentBudget;
    if (updatedFields.location !== undefined) payload.location = updatedFields.location;
    if (updatedFields.whenToBuyPlan !== undefined) payload.when_to_buy_plan = updatedFields.whenToBuyPlan;
    if (updatedFields.callerAssigned !== undefined) payload.caller_assigned = updatedFields.callerAssigned;
    if (updatedFields.remarks !== undefined) payload.remarks = updatedFields.remarks;
    if (updatedFields.processType !== undefined) payload.process_type = updatedFields.processType;
    payload.updated_at = new Date().toISOString();

    const isUuid = idOrLeadNo.includes('-');
    const query = supabase.from('leads').update(payload);
    const { data, error } = isUuid
      ? await query.eq('id', idOrLeadNo).select()
      : await query.eq('lead_no', idOrLeadNo).select();

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

    const payloads = leadsArray.map(l => this.mapToDb(l));
    const { data, error } = await supabase
      .from('leads')
      .insert(payloads)
      .select();

    if (error) {
      console.error('Error bulk inserting leads into Supabase:', error);
      leadsArray.forEach(l => saveLocalLead(l));
      throw error;
    }

    leadsArray.forEach(l => saveLocalLead(l));
    return data.map(this.mapFromDb);
  },

  // Batch assign caller to multiple leads
  async assignCallerToLeads(leadAssignments) {
    // leadAssignments: { [leadId]: callerName }
    const promises = Object.entries(leadAssignments).map(([leadId, callerName]) =>
      this.updateLead(leadId, { callerAssigned: callerName })
    );

    return Promise.all(promises);
  }
};
