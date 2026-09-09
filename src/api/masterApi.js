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
  deleteCallerNameMaster as deleteLocalCaller
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
  }
};
