import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getLeadTypesMaster as getLocalTypes,
  createLeadTypeMaster as saveLocalType,
  deleteLeadTypeMaster as deleteLocalType,
  getLeadSourcesMaster as getLocalSources,
  createLeadSourceMaster as saveLocalSource,
  deleteLeadSourceMaster as deleteLocalSource,
  getLeadReceiversMaster as getLocalReceivers,
  createLeadReceiverMaster as saveLocalReceiver,
  deleteLeadReceiverMaster as deleteLocalReceiver,
  getCallerNamesMaster as getLocalCallers,
  createCallerNameMaster as saveLocalCaller,
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
    if (!isSupabaseConfigured) return saveLocalType(leadTypeObj);
    const { data, error } = await supabase.from('master_lead_types').insert({ lead_type: leadTypeObj.leadType }).select().single();
    if (error) { console.error('Error saving lead type:', error); saveLocalType(leadTypeObj); throw error; }
    const result = { id: data.id, leadType: data.lead_type };
    saveLocalType(result);
    return result;
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
    if (!isSupabaseConfigured) return saveLocalSource(leadSourceObj);
    const { data, error } = await supabase.from('master_lead_sources').insert({ lead_source: leadSourceObj.leadSource }).select().single();
    if (error) { console.error('Error saving lead source:', error); saveLocalSource(leadSourceObj); throw error; }
    const result = { id: data.id, leadSource: data.lead_source };
    saveLocalSource(result);
    return result;
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
    const { data, error } = await supabase.from('master_lead_receivers').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching lead receivers:', error); return getLocalReceivers(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, leadType: d.lead_type, personName: d.person_name }));
  },

  async saveLeadReceiver(receiverObj) {
    if (!isSupabaseConfigured) return saveLocalReceiver(receiverObj);
    const { data, error } = await supabase.from('master_lead_receivers').insert({ lead_type: receiverObj.leadType, person_name: receiverObj.personName }).select().single();
    if (error) { console.error('Error saving lead receiver:', error); saveLocalReceiver(receiverObj); throw error; }
    const result = { id: data.id, leadType: data.lead_type, personName: data.person_name };
    saveLocalReceiver(result);
    return result;
  },

  async deleteLeadReceiver(id) {
    if (!isSupabaseConfigured) return deleteLocalReceiver(id);
    const { error } = await supabase.from('master_lead_receivers').delete().eq('id', id);
    if (error) throw error;
    deleteLeadReceiver(id);
  },

  // --- CALLER NAMES ---
  async getCallerNames() {
    if (!isSupabaseConfigured) return getLocalCallers();
    const { data, error } = await supabase.from('master_caller_names').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching caller names:', error); return getLocalCallers(); }
    return data.map((d, idx) => ({ id: d.id, serialNo: idx + 1, leadType: d.lead_type, personName: d.person_name }));
  },

  async saveCallerName(callerObj) {
    if (!isSupabaseConfigured) return saveLocalCaller(callerObj);
    const { data, error } = await supabase.from('master_caller_names').insert({ lead_type: callerObj.leadType, person_name: callerObj.personName }).select().single();
    if (error) { console.error('Error saving caller name:', error); saveLocalCaller(callerObj); throw error; }
    const result = { id: data.id, leadType: data.lead_type, personName: data.person_name };
    saveLocalCaller(result);
    return result;
  },

  async deleteCallerName(id) {
    if (!isSupabaseConfigured) return deleteLocalCaller(id);
    const { error } = await supabase.from('master_caller_names').delete().eq('id', id);
    if (error) throw error;
    deleteLocalCaller(id);
  }
};
