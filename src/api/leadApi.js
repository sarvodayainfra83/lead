import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getLeads as getLocalLeads,
  saveLead as saveLocalLead,
  updateLead as updateLocalLead,
  deleteLead as deleteLocalLead
} from '../utils/storageManager';
import { refreshBadgeCounts } from '../utils/badgeNotifier';
import { useAuthStore } from '../store/authStore';
import { getUserLeadTypeScope, matchesUserLeadType, matchesUserAssignment, matchesUserReceiver } from '../utils/authUtils';

// Current time as an ISO timestamp in Indian Standard Time, e.g. 2026-09-28T15:42:10+05:30
export const nowIST = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().replace(/\.\d{3}Z$/, '+05:30');
};

// Display any timestamp as DD/MM/YYYY, hh:mm AM/PM in IST
export const formatIST = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d).replace(/\bam\b/, 'AM').replace(/\bpm\b/, 'PM');
};

// Tell the navbar notification bell that remarks changed (sent / opened)
export const REMARKS_CHANGED_EVENT = 'remarks-changed';
const notifyRemarksChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMARKS_CHANGED_EVENT));
};

// Day marks the user ticks in a Today's Followup list; each only counts on the day it was set:
//  - call:  leads.call_marked_at / call_marked_by   — "called today" (Lead & Followup)
//  - visit: leads.visit_marked_at / visit_marked_by — "site visit done today" (Site Visit / Meeting)
const DAY_MARKS = {
  call: { atColumn: 'call_marked_at', byColumn: 'call_marked_by', atField: 'callMarkedAt', byField: 'callMarkedBy' },
  visit: { atColumn: 'visit_marked_at', byColumn: 'visit_marked_by', atField: 'visitMarkedAt', byField: 'visitMarkedBy' }
};

// Latest admin / user remark + seen markers kept on the leads row
const REMARK_COLUMNS = 'admin_remark, admin_remark_date, user_remark, user_remark_date, admin_remark_seen_at, user_remark_seen_at';

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
      callerAssigned: row.caller_assigned || row.callerAssigned || row.master_caller_names?.person_name || '',
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
      // 'Lead' (Add Lead form) or 'Direct' (Call Tracker's Direct form) or 'Direct Site Visit'
      processType: row.process_type || row.processType || 'Lead',
      assignedVisitor: row.assigned_visitor || row.assignedVisitor || '',
      isSiteVisit: Boolean(row.is_site_visit ?? row.isSiteVisit ?? (row.process_type === 'Direct Site Visit' || row.processType === 'Direct Site Visit')),
      directSiteVisit: Boolean(row.direct_site_visit ?? row.directSiteVisit ?? (row.process_type === 'Direct Site Visit' || row.processType === 'Direct Site Visit')),
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

  // Helper to sanitize and validate UUID strings to avoid PostgreSQL invalid input syntax errors
  cleanUuid(val) {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed;
    }
    return null;
  },

  // Helper to format any date/timestamp into ISO-8601 string for DB TIMESTAMPTZ columns
  formatTimestampForDb(val) {
    if (!val) return new Date().toISOString();
    if (val instanceof Date) {
      return !isNaN(val.getTime()) ? val.toISOString() : new Date().toISOString();
    }
    const str = String(val).trim();
    if (!str) return new Date().toISOString();

    // Check if formatted as DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
    if (str.includes('/')) {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        const [d, m, y] = dateParts.map(Number);
        const fullYear = y < 100 ? 2000 + y : y;
        let hh = 0, mm = 0, ss = 0;
        if (parts[1]) {
          const timeParts = parts[1].split(':').map(Number);
          hh = Number(timeParts[0]) || 0;
          mm = Number(timeParts[1]) || 0;
          ss = Number(timeParts[2]) || 0;
        }
        const dObj = new Date(fullYear, m - 1, d, hh, mm, ss);
        if (!isNaN(dObj.getTime())) return dObj.toISOString();
      }
    }

    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      return dObj.toISOString();
    }

    return new Date().toISOString();
  },

  // Helper to format DOB into YYYY-MM-DD string or null for DB DATE columns
  formatDobForDb(val) {
    if (!val) return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    }
    const str = String(val).trim();
    if (!str) return null;

    // DD/MM/YYYY format
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        const fullYear = y < 100 ? 2000 + y : y;
        return `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // YYYY-MM-DD format
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(Number);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      return `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
    }

    return null;
  },

  // Helper to resolve string names to Master FK UUIDs reliably
  async resolveLeadFkIds(lead) {
    let lead_type_id = this.cleanUuid(lead.leadTypeId);
    let lead_receiver_id = this.cleanUuid(lead.leadReceiverId);
    let lead_source_id = this.cleanUuid(lead.leadSourceId);
    let caller_assigned_id = this.cleanUuid(lead.callerAssignedId);
    let investment_budget_id = this.cleanUuid(lead.investmentBudgetId);

    // 1. Resolve lead_type_id first
    if (!lead_type_id && lead.leadType) {
      const { data } = await supabase
        .from('master_lead_types')
        .select('id')
        .eq('lead_type', lead.leadType)
        .limit(1);
      if (data && data[0]) lead_type_id = data[0].id;
    }

    // 2. Resolve lead_receiver_id from users table
    if (!lead_receiver_id && lead.leadReceiver) {
      const receiverName = String(lead.leadReceiver).trim();
      const { data } = await supabase
        .from('users')
        .select('id')
        .or(`name.eq."${receiverName}",username.eq."${receiverName}"`)
        .limit(1);
      if (data && data[0]) lead_receiver_id = data[0].id;
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

    // 4. Resolve caller_assigned_id from users table
    if (!caller_assigned_id && lead.callerAssigned) {
      const callerName = String(lead.callerAssigned).trim();
      const { data } = await supabase
        .from('users')
        .select('id')
        .or(`name.eq."${callerName}",username.eq."${callerName}"`)
        .limit(1);
      if (data && data[0]) caller_assigned_id = data[0].id;
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

    const result = {
      lead_receiver_id: lead_receiver_id || null,
      lead_source_id: lead_source_id || null,
      caller_assigned_id: caller_assigned_id || null,
      investment_budget_id: investment_budget_id || null,
      lead_type_id: lead_type_id || null,
      product_type_id: this.cleanUuid(lead.productTypeId),
      requirement_id: this.cleanUuid(lead.requirementId),
      sub_product_type_id: this.cleanUuid(lead.subProductTypeId)
    };

    // Lead type specific FK lookups
    const typeClean = String(lead.leadType || '').trim().toLowerCase();
    if (typeClean === 'real estate' || (!lead.leadType && lead.leadNo && lead.leadNo.startsWith('LR'))) {
      if (!result.product_type_id && lead.productType) {
        const { data } = await supabase.from('master_real_estate_products').select('id').eq('product_type', lead.productType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
      if (!result.requirement_id && lead.requirement) {
        const { data } = await supabase.from('master_real_estate_requirements').select('id').eq('requirement', lead.requirement).limit(1);
        if (data && data[0]) result.requirement_id = data[0].id;
      }
    } else if (typeClean === 'mutual fund' || (!lead.leadType && lead.leadNo && lead.leadNo.startsWith('LM'))) {
      if (!result.product_type_id && lead.productType) {
        const { data } = await supabase.from('master_mutual_fund_products').select('id').eq('product_type', lead.productType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
    } else if (typeClean.includes('insurance') || (!lead.leadType && lead.leadNo && lead.leadNo.startsWith('LI'))) {
      if (!result.product_type_id && lead.insuranceType) {
        const { data } = await supabase.from('master_insurance_products').select('id').eq('product_type', lead.insuranceType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
      if (!result.sub_product_type_id && lead.insuranceSubType) {
        const { data } = await supabase.from('master_insurance_sub_products').select('id').eq('sub_product_type', lead.insuranceSubType).limit(1);
        if (data && data[0]) result.sub_product_type_id = data[0].id;
      }
    }

    return result;
  },

  // Resolve Product Type / Requirement / Sub Product Type names to the FK ids the detail
  // tables actually store (real_state.product_type_id/requirement_id, mutual_fund.product_type_id,
  // insurance.product_type_id/sub_product_type_id) — these tables have no plain-text
  // product_type column, only the _id FK.
  async resolveProductFkIds(lead, tableName) {
    const result = {
      product_type_id: this.cleanUuid(lead.productTypeId),
      requirement_id: this.cleanUuid(lead.requirementId),
      sub_product_type_id: this.cleanUuid(lead.subProductTypeId)
    };

    if (tableName === 'real_state') {
      if (!result.product_type_id && lead.productType) {
        const { data } = await supabase.from('master_real_estate_products').select('id').eq('product_type', lead.productType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
      if (!result.requirement_id && lead.requirement) {
        const { data } = await supabase.from('master_real_estate_requirements').select('id').eq('requirement', lead.requirement).limit(1);
        if (data && data[0]) result.requirement_id = data[0].id;
      }
    } else if (tableName === 'mutual_fund') {
      if (!result.product_type_id && lead.productType) {
        const { data } = await supabase.from('master_mutual_fund_products').select('id').eq('product_type', lead.productType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
    } else if (tableName === 'insurance') {
      if (!result.product_type_id && lead.insuranceType) {
        const { data } = await supabase.from('master_insurance_products').select('id').eq('product_type', lead.insuranceType).limit(1);
        if (data && data[0]) result.product_type_id = data[0].id;
      }
      if (!result.sub_product_type_id && lead.insuranceSubType) {
        const { data } = await supabase.from('master_insurance_sub_products').select('id').eq('sub_product_type', lead.insuranceSubType).limit(1);
        if (data && data[0]) result.sub_product_type_id = data[0].id;
      }
    }

    return result;
  },

  // Leads visible to the logged-in user: role USER only sees their own lead type
  // (admins, and users without a lead type, see every lead). Every page reads leads through here.
  async getLeads() {
    const leads = await this.getAllLeads();
    const user = useAuthStore.getState().user;
    if (!getUserLeadTypeScope(user)) return leads;
    return leads.filter(l => matchesUserLeadType(l, user));
  },

  // True when the logged-in user only sees one lead type — records (trackers, visits, follow-ups)
  // whose lead isn't in getLeads() must then be hidden instead of shown with blank lead details.
  isLeadTypeRestricted() {
    return Boolean(getUserLeadTypeScope(useAuthStore.getState().user));
  },

  // Fetch ALL leads across all 3 tables with unified structure, ignoring the user's lead type.
  // Only for system logic that must see every lead (e.g. generating the next unique Lead No).
  async getAllLeads() {
    const fetched = await this.fetchLeadRows();
    if (!isSupabaseConfigured || fetched.length === 0) return fetched;

    // Admin / user remark thread and day marks live on the leads table (same id as call_trackers.lead_id)
    const dayMarkColumns = Object.values(DAY_MARKS).map(cfg => `${cfg.atColumn}, ${cfg.byColumn}`).join(', ');
    const { data: extraRows, error } = await supabase
      .from('leads')
      .select(`id, ${REMARK_COLUMNS}, ${dayMarkColumns}`);
    if (error) {
      console.error('Error loading lead remarks / day marks:', error);
      throw error;
    }

    const extrasById = Object.fromEntries((extraRows || []).map(r => [String(r.id), r]));
    return fetched.map(l => {
      const r = extrasById[String(l.id)];
      if (!r) return l;
      let lead = { ...l, ...this.mapRemarksFromDb(r) };
      Object.values(DAY_MARKS).forEach(cfg => {
        // A real tick always records who made it; a time without a name (e.g. a column default filling it on
        // insert) isn't a tick, so new leads don't show up as already called / visited
        if (r[cfg.atColumn] && r[cfg.byColumn]) lead = { ...lead, [cfg.atField]: r[cfg.atColumn], [cfg.byField]: r[cfg.byColumn] };
      });
      return lead;
    });
  },

  // Tick / untick a day mark on a lead ('call' or 'visit'). marked=false clears it.
  async setDayMark(kind, leadId, marked, userName) {
    const cfg = DAY_MARKS[kind];
    const mark = marked ? { at: nowIST(), by: userName || 'User' } : null;
    if (!isSupabaseConfigured) {
      const existing = getLocalLeads().find(l => String(l.id) === String(leadId));
      if (existing) updateLocalLead({ ...existing, [cfg.atField]: mark?.at || null, [cfg.byField]: mark?.by || '' });
    } else {
      const { error } = await supabase
        .from('leads')
        .update({ [cfg.atColumn]: mark?.at || null, [cfg.byColumn]: mark?.by || null })
        .eq('id', leadId);
      if (error) {
        console.error(`Error saving ${kind} mark:`, error);
        throw error;
      }
    }
    return { markedAt: mark?.at || null, markedBy: mark?.by || '', savedInDb: true };
  },

  // "Called today" (Lead & Followup)
  setCallMark(leadId, marked, userName) {
    return this.setDayMark('call', leadId, marked, userName)
      .then(r => ({ callMarkedAt: r.markedAt, callMarkedBy: r.markedBy, savedInDb: r.savedInDb }));
  },

  // "Site visit done today" (Site Visit / Meeting)
  setVisitMark(leadId, marked, userName) {
    return this.setDayMark('visit', leadId, marked, userName);
  },

  mapRemarksFromDb(row) {
    return {
      adminRemark: row.admin_remark || '',
      adminRemarkDate: row.admin_remark_date || null,
      userRemark: row.user_remark || '',
      userRemarkDate: row.user_remark_date || null,
      // When the user last opened the admin's remark / the admin last opened the user's reply
      adminRemarkSeenAt: row.admin_remark_seen_at || null,
      userRemarkSeenAt: row.user_remark_seen_at || null
    };
  },

  // Mark the other side's latest message as seen (stops the blink). viewerIsAdmin=true means the
  // admin opened the conversation (marks the user's reply seen), false = the user opened it.
  async markRemarksSeen(leadId, viewerIsAdmin) {
    const field = viewerIsAdmin ? 'userRemarkSeenAt' : 'adminRemarkSeenAt';
    const column = viewerIsAdmin ? 'user_remark_seen_at' : 'admin_remark_seen_at';
    const seenAt = nowIST();
    if (!isSupabaseConfigured) {
      const existing = getLocalLeads().find(l => String(l.id) === String(leadId));
      if (existing) updateLocalLead({ ...existing, [field]: seenAt });
    } else {
      const { error } = await supabase.from('leads').update({ [column]: seenAt }).eq('id', leadId);
      if (error) {
        console.error('Error saving remark seen time:', error);
        throw error;
      }
    }
    notifyRemarksChanged();
    return { [field]: seenAt };
  },

  // Navbar notifications: latest incoming remark per lead for the logged-in person.
  //  - USER: admin remarks on the user's own leads (assigned to them / received by them)
  //  - ADMIN: user replies on any lead
  // "unread" = arrived after my own last message and after I last opened the conversation.
  async getRemarkNotifications(user) {
    if (!user) return [];
    const isAdmin = String(user.role || '').toUpperCase() === 'ADMIN';
    const leads = await this.getLeads();
    const mine = isAdmin ? leads : leads.filter(l => matchesUserAssignment(l, user) || matchesUserReceiver(l, user));
    const ms = (v) => (v ? new Date(v).getTime() || 0 : 0);

    return mine
      .map(l => {
        const text = isAdmin ? l.userRemark : l.adminRemark;
        const date = isAdmin ? l.userRemarkDate : l.adminRemarkDate;
        if (!text || !date) return null;
        const myLast = ms(isAdmin ? l.adminRemarkDate : l.userRemarkDate);
        const seen = ms(isAdmin ? l.userRemarkSeenAt : l.adminRemarkSeenAt);
        return {
          leadId: l.id,
          leadNo: l.leadNo,
          personName: l.personName || l.customerName || 'Lead',
          leadType: l.leadType || '',
          callerAssigned: l.callerAssigned || '',
          from: isAdmin ? (l.callerAssigned || 'User') : 'Admin',
          text,
          date,
          unread: ms(date) > Math.max(myLast, seen)
        };
      })
      .filter(Boolean)
      .sort((a, b) => ms(b.date) - ms(a.date))
      .slice(0, 30);
  },

  // Admin writes / updates the remark on a lead (stamps admin_remark_date in IST)
  async saveAdminRemark(leadId, remark) {
    return this.saveLeadRemark(leadId, { admin_remark: String(remark || '').trim() || null, admin_remark_date: nowIST() });
  },

  // User replies to the admin remark on a lead (stamps user_remark_date in IST)
  async saveUserRemark(leadId, remark) {
    return this.saveLeadRemark(leadId, { user_remark: String(remark || '').trim() || null, user_remark_date: nowIST() });
  },

  async saveLeadRemark(leadId, payload) {
    const local = {
      ...(payload.admin_remark !== undefined ? { adminRemark: payload.admin_remark || '', adminRemarkDate: payload.admin_remark_date } : {}),
      ...(payload.user_remark !== undefined ? { userRemark: payload.user_remark || '', userRemarkDate: payload.user_remark_date } : {})
    };
    if (!isSupabaseConfigured) {
      const existing = getLocalLeads().find(l => String(l.id) === String(leadId));
      if (existing) updateLocalLead({ ...existing, ...local });
      return local;
    }
    const { data, error } = await supabase
      .from('leads')
      .update({ ...payload, updated_at: nowIST() })
      .eq('id', leadId)
      .select(`id, ${REMARK_COLUMNS}`)
      .single();
    if (error) {
      console.error('Error saving lead remark:', error);
      throw error;
    }
    return this.mapRemarksFromDb(data);
  },

  // ---------------- Remark conversation (lead_remarks table, one row per message) ----------------

  // Whole conversation of a lead, oldest first
  async getLeadRemarkThread(leadId) {
    if (!isSupabaseConfigured) {
      const lead = getLocalLeads().find(l => String(l.id) === String(leadId));
      return lead?.remarkThread || [];
    }
    const { data, error } = await supabase
      .from('lead_remarks')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading remark conversation (is the lead_remarks table created?):', error);
      throw error;
    }
    return (data || []).map(r => ({
      id: r.id,
      leadId: r.lead_id,
      role: r.author_role,
      authorName: r.author_name || '',
      remark: r.remark,
      createdAt: r.created_at
    }));
  },

  // Add a new message to the conversation (never overwrites earlier ones) and keep the
  // latest admin / user remark + IST date on the leads row for the list view & blinking.
  async addLeadRemark(leadId, { role, authorName, remark }) {
    const text = String(remark || '').trim();
    const createdAt = nowIST();
    const entry = { leadId, role, authorName: authorName || '', remark: text, createdAt };
    const summary = role === 'ADMIN'
      ? { admin_remark: text, admin_remark_date: createdAt }
      : { user_remark: text, user_remark_date: createdAt };

    if (!isSupabaseConfigured) {
      const existing = getLocalLeads().find(l => String(l.id) === String(leadId));
      if (existing) {
        const thread = [...(existing.remarkThread || []), { ...entry, id: `local-${Date.now()}` }];
        const latestLocal = role === 'ADMIN'
          ? { adminRemark: text, adminRemarkDate: createdAt }
          : { userRemark: text, userRemarkDate: createdAt };
        updateLocalLead({ ...existing, remarkThread: thread, ...latestLocal });
      }
      return {
        entry,
        summary: role === 'ADMIN' ? { adminRemark: text, adminRemarkDate: createdAt } : { userRemark: text, userRemarkDate: createdAt }
      };
    }

    const { data, error } = await supabase
      .from('lead_remarks')
      .insert({ lead_id: leadId, author_role: role, author_name: authorName || null, remark: text, created_at: createdAt })
      .select()
      .single();
    if (error) {
      console.error('Error adding remark:', error);
      throw error;
    }
    const latest = await this.saveLeadRemark(leadId, summary);
    notifyRemarksChanged();
    return {
      entry: { ...entry, id: data.id, createdAt: data.created_at || createdAt },
      summary: latest
    };
  },

  // Raw lead rows from the unified view (falls back to the leads table join)
  async fetchLeadRows() {
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
        real_state!real_estate_id (*),
        insurance!insurance_id (*),
        mutual_fund!mutual_fund_id (*)
      `)
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('Error loading leads:', viewError, leadsError);
      throw leadsError;
    }

    return (leadsData || []).map(l => {
      const detail = l.real_state || l.insurance || l.mutual_fund || {};
      return this.mapFromDb({
        ...detail,
        id: l.id,
        detail_id: detail.id,
        lead_no: l.lead_no,
        lead_type_id: l.lead_type_id,
        lead_type: l.master_lead_types?.lead_type,
        lead_receiver: detail.lead_receiver,
        lead_source: detail.lead_source,
        caller_assigned: detail.caller_assigned,
        product_type: detail.product_type
      });
    });
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
      referencer_name: leadData.referencerName ? String(leadData.referencerName).trim() : null,
      customer_name: leadData.customerName || leadData.personName || '',
      customer_number: leadData.customerNumber || leadData.number || '',
      customer_email: (leadData.customerEmail || leadData.email) ? String(leadData.customerEmail || leadData.email).trim() : null,
      dob: this.formatDobForDb(leadData.dob),
      customer_address: (leadData.customerAddress || leadData.location) ? String(leadData.customerAddress || leadData.location).trim() : null,
      occupation: leadData.occupation ? String(leadData.occupation).trim() : null,
      investment_budget: leadData.investmentBudget ? String(leadData.investmentBudget).trim() : null,
      investment_budget_id: fkIds.investment_budget_id,
      when_to_buy_plan: leadData.whenToBuyPlan ? String(leadData.whenToBuyPlan).trim() : null,
      remarks: leadData.remarks ? String(leadData.remarks).trim() : null,
      process_type: leadData.processType || 'Lead',
      timestamp: this.formatTimestampForDb(leadData.timestamp)
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
    const { data: parentData, error: parentError } = isUuid
      ? await parentQuery.eq('id', idOrLeadNo).limit(1)
      : await parentQuery.eq('lead_no', idOrLeadNo).limit(1);
    if (parentError) {
      console.error('Error loading lead for update:', parentError);
      throw parentError;
    }

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
    if (updatedFields.referencerName !== undefined) detailPayload.referencer_name = updatedFields.referencerName ? String(updatedFields.referencerName).trim() : null;
    if (updatedFields.customerName !== undefined || updatedFields.personName !== undefined) {
      detailPayload.customer_name = updatedFields.customerName || updatedFields.personName;
    }
    if (updatedFields.customerNumber !== undefined || updatedFields.number !== undefined) {
      detailPayload.customer_number = updatedFields.customerNumber || updatedFields.number;
    }
    if (updatedFields.customerEmail !== undefined || updatedFields.email !== undefined) {
      detailPayload.customer_email = (updatedFields.customerEmail || updatedFields.email) ? String(updatedFields.customerEmail || updatedFields.email).trim() : null;
    }
    if (updatedFields.dob !== undefined) detailPayload.dob = this.formatDobForDb(updatedFields.dob);
    if (updatedFields.occupation !== undefined) detailPayload.occupation = updatedFields.occupation ? String(updatedFields.occupation).trim() : null;
    if (updatedFields.investmentBudget !== undefined) {
      detailPayload.investment_budget = updatedFields.investmentBudget ? String(updatedFields.investmentBudget).trim() : null;
      detailPayload.investment_budget_id = resolvedFks.investment_budget_id;
    }
    if (updatedFields.customerAddress !== undefined || updatedFields.location !== undefined) {
      detailPayload.customer_address = (updatedFields.customerAddress || updatedFields.location) ? String(updatedFields.customerAddress || updatedFields.location).trim() : null;
    }
    if (updatedFields.whenToBuyPlan !== undefined) detailPayload.when_to_buy_plan = updatedFields.whenToBuyPlan ? String(updatedFields.whenToBuyPlan).trim() : null;
    if (updatedFields.remarks !== undefined) detailPayload.remarks = updatedFields.remarks ? String(updatedFields.remarks).trim() : null;
    if (updatedFields.timestamp !== undefined) detailPayload.timestamp = this.formatTimestampForDb(updatedFields.timestamp);

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
        throw error;
      }
    }

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
    const { data: parentData, error: parentError } = isUuid
      ? await parentQuery.eq('id', idOrLeadNo).limit(1)
      : await parentQuery.eq('lead_no', idOrLeadNo).limit(1);
    if (parentError) {
      console.error('Error loading lead for delete:', parentError);
      throw parentError;
    }

    const parentLead = parentData && parentData[0] ? parentData[0] : null;

    if (parentLead) {
      const deletes = [
        ['real_state', parentLead.real_estate_id],
        ['insurance', parentLead.insurance_id],
        ['mutual_fund', parentLead.mutual_fund_id],
        ['leads', parentLead.id]
      ].filter(([, id]) => id);
      for (const [table, id] of deletes) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
          console.error(`Error deleting lead from ${table}:`, error);
          throw error;
        }
      }
    }

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
