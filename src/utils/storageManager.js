// Storage Manager - Handle all localStorage operations

const STORAGE_KEYS = {
  USERS: 'pcb_users',
  CREDITS: 'pcb_credits',
  EXPENSES: 'pcb_expenses',
  LEDGER: 'pcb_ledger',
  SETTINGS: 'pcb_settings',
  AUTH_USER: 'pcb_authUser',
  VENDORS: 'pcb_vendors_v3',
  COMPANIES: 'pcb_companies_v3',
  ITEMS: 'pcb_items_v3',
  GROUP_HEADS: 'pcb_group_heads_v3',
  UOMS: 'pcb_uoms_v3',
  DEPARTMENTS: 'pcb_departments_v3',
  INDENTS: 'pcb_indents_v3',
  POS: 'pcb_pos_v4',
  TERMS_CONDITIONS: 'pcb_terms_conditions_v1',
  LIFTING: 'pcb_lifting_v1',
  STORE_IN: 'pcb_store_in_v1',
  DIRECT_STORE_IN: 'pcb_direct_store_in_v1',
  PAYMENTS: 'pcb_payments_v1',
  REJECT_GRN: 'pcb_reject_grn_v1',
  DEBIT_NOTES: 'pcb_debit_notes_v1',
  TALLY_ENTRIES: 'pcb_tally_entries_v1',
  BILL_NOT_RECEIVED: 'pcb_bill_not_received_v1',
  STORE_ISSUES: 'pcb_store_issues_v1',
  STORE_RETURNS: 'pcb_store_issue_returns_v1',
  INVENTORY: 'pcb_inventory_v1',
  QUOTATION_HISTORY: 'pcb_quotation_history_v1',
  PROJECTS: 'pcb_projects_v1',
  LEADS: 'pcb_leads_v1',
  CALL_TRACKERS: 'pcb_call_trackers_v1',
  MASTER_LEAD_TYPES: 'pcb_master_lead_types_v1',
  MASTER_LEAD_SOURCES: 'pcb_master_lead_sources_v1',
  MASTER_LEAD_RECEIVERS: 'pcb_master_lead_receivers_v1',
  MASTER_CALLER_NAMES: 'pcb_master_caller_names_v1',
  MASTER_MUTUAL_FUND_PRODUCTS: 'pcb_master_mutual_fund_products_v1',
  MASTER_REAL_ESTATE_PRODUCTS: 'pcb_master_real_estate_products_v1',
  MASTER_REAL_ESTATE_REQUIREMENTS: 'pcb_master_real_estate_requirements_v1',
  MASTER_INSURANCE_PRODUCTS: 'pcb_master_insurance_products_v1',
  MASTER_INSURANCE_SUB_PRODUCTS: 'pcb_master_insurance_sub_products_v1',
  MASTER_INVESTMENT_BUDGETS: 'pcb_master_investment_budgets_v1',
  DESIGNS: 'pcb_designs_v1',
  MATERIAL_REQUIREMENTS: 'pcb_material_requirements_v1',
  EXECUTIONS: 'pcb_executions_v1',
  ACTUALS: 'pcb_actuals_v1'
};

// Initialize default data
// accessPages is a { [pageKey]: 'none' | 'view' | 'edit' | 'full' } map, ignored for ADMIN (always full access)
const DEFAULT_USER_ACCESS = { dashboard: 'view', lead: 'edit', callTracker: 'edit', customerMaster: 'view', master: 'none', callerReport: 'none', setting: 'none' };

const DEFAULT_USERS = [
  { id: 'admin', serialNo: 1, name: 'Rajesh Sharma', number: '9876500001', gmail: 'rajesh.sharma@sarvodayainfracon.com', password: 'admin123', role: 'ADMIN', accessPages: {} },
  { id: 'user', serialNo: 2, name: 'Amit Patel', number: '9876500002', gmail: 'amit.patel@sarvodayainfracon.com', password: 'user123', role: 'USER', accessPages: { ...DEFAULT_USER_ACCESS } },
  { id: 'user2', serialNo: 3, name: 'Priya Iyer', number: '9876500003', gmail: 'priya.iyer@sarvodayainfracon.com', password: 'user123', role: 'USER', accessPages: { ...DEFAULT_USER_ACCESS } }
];

// Users created before a given field/page existed carry the legacy generic name so we can
// recognize and backfill them even though they were never actually named that on purpose.
const LEGACY_USER_NAMES = ['Admin User', 'Employee 1', 'Employee 2'];
const LEGACY_USER_INFO = {
  admin: { name: 'Rajesh Sharma', number: '9876500001', gmail: 'rajesh.sharma@sarvodayainfracon.com' },
  user: { name: 'Amit Patel', number: '9876500002', gmail: 'amit.patel@sarvodayainfracon.com' },
  user2: { name: 'Priya Iyer', number: '9876500003', gmail: 'priya.iyer@sarvodayainfracon.com' }
};

const DEFAULT_SETTINGS = {
  groupHeads: ['IT', 'HR', 'Finance', 'Operations', 'Marketing'],
  paymentModes: ['Cash', 'Cheque', 'Bank Transfer', 'Online Payment'],
  lastSerialNumber: 0
};

const DEFAULT_CREDITS = [];
const DEFAULT_EXPENSES = [];
const DEFAULT_LEDGER = [];
const DEFAULT_VENDORS = [];
const DEFAULT_COMPANIES = [];

// Master Data dummy seed — keeps the Lead / Direct Lead form dropdowns populated out of the box
const DEFAULT_MASTER_LEAD_TYPES = [
  { id: 'mlt-1', serialNo: 1, leadType: 'Real Estate' },
  { id: 'mlt-2', serialNo: 2, leadType: 'Mutual Fund' },
  { id: 'mlt-3', serialNo: 3, leadType: 'Insurance' }
];

const DEFAULT_MASTER_LEAD_SOURCES = [
  'Website', 'Reference', 'Walk-in', 'Cold Call', 'Social Media', 'Newspaper Ad', 'Advertisement', 'Other'
].map((leadSource, i) => ({ id: `mls-${i + 1}`, serialNo: i + 1, leadSource }));

const DEFAULT_MASTER_LEAD_RECEIVERS = (() => {
  const types = ['Real Estate', 'Mutual Fund', 'Insurance'];
  const names = ['Rajesh Sharma', 'Amit Patel', 'Priya Iyer'];
  let sn = 0;
  return types.flatMap(leadType => names.map(personName => {
    sn += 1;
    return { id: `mlr-${sn}`, serialNo: sn, leadType, personName };
  }));
})();

const DEFAULT_MASTER_CALLER_NAMES = (() => {
  const types = ['Real Estate', 'Mutual Fund', 'Insurance'];
  const names = ['Rajesh Sharma', 'Amit Patel', 'Priya Iyer'];
  let sn = 0;
  return types.flatMap(leadType => names.map(personName => {
    sn += 1;
    return { id: `mcn-${sn}`, serialNo: sn, leadType, personName };
  }));
})();

// Product Type / Requirement masters that feed the Lead form's per-Lead-Type dropdowns
const DEFAULT_MASTER_MUTUAL_FUND_PRODUCTS = [
  'Equity Fund', 'Debit Fund', 'Hybrid Fund', 'Money Market Fund', 'Growth Fund', 'Other'
].map((productType, i) => ({ id: `mfp-${i + 1}`, serialNo: i + 1, productType }));

const DEFAULT_MASTER_REAL_ESTATE_PRODUCTS = [
  'Vrindavan Garden', 'Bhardwaj Sky', 'Shri Ram Lotus Valley', 'Evarraa By Dee Vee', 'Other'
].map((productType, i) => ({ id: `rep-${i + 1}`, serialNo: i + 1, productType }));

const DEFAULT_MASTER_REAL_ESTATE_REQUIREMENTS = [
  '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK', 'Flat', 'Bungalow', 'Villa', 'Penthouse',
  'Row House', 'Commercial Shop', 'Commercial Office', 'Plot / Land', 'Farmhouse',
  'Industrial / Warehouse', 'Other'
].map((requirement, i) => ({ id: `rer-${i + 1}`, serialNo: i + 1, requirement }));

const DEFAULT_MASTER_INSURANCE_PRODUCTS = [
  'Life Insurance', 'Health Insurance', 'Vehicle Insurance', 'Property Insurance',
  'Accident Insurance', 'Travel Insurance', 'Other'
].map((productType, i) => ({ id: `inp-${i + 1}`, serialNo: i + 1, productType }));

const DEFAULT_MASTER_INSURANCE_SUB_PRODUCTS = (() => {
  const byProduct = {
    'Life Insurance': [
      'KeyMan Insurance', 'Business Insurance', 'Whole Life Insurance', 'ULIP Investment Plan',
      'Child Insurance', 'Saving Plan', 'Retirement Plan', 'Other'
    ],
    'Health Insurance': [
      'Individual Health Insurance', 'Family Health Insurance', 'Senior Citizen Insurance',
      'Group Insurance', 'Critical Illness', 'Other'
    ]
  };
  let sn = 0;
  return Object.entries(byProduct).flatMap(([productType, subTypes]) => subTypes.map(subProductType => {
    sn += 1;
    return { id: `insp-${sn}`, serialNo: sn, productType, subProductType };
  }));
})();

const DEFAULT_MASTER_INVESTMENT_BUDGETS = [
  '10k - 20k', '20k - 50k', '50k - 70k', '70k - 1 Lakh', '1 Lakh - 1.5 Lakh',
  '1.5 Lakh - 2 Lakh', '2 Lakh - 3 Lakh', '3 Lakh - 5 Lakh', 'Above 5 Lakh'
].map((investmentBudget, i) => ({ id: `ivb-${i + 1}`, serialNo: i + 1, investmentBudget }));

// Initialize storage with defaults
export const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_LEAD_TYPES)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_LEAD_TYPES, JSON.stringify(DEFAULT_MASTER_LEAD_TYPES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_LEAD_SOURCES)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_LEAD_SOURCES, JSON.stringify(DEFAULT_MASTER_LEAD_SOURCES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_LEAD_RECEIVERS)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_LEAD_RECEIVERS, JSON.stringify(DEFAULT_MASTER_LEAD_RECEIVERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_CALLER_NAMES)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_CALLER_NAMES, JSON.stringify(DEFAULT_MASTER_CALLER_NAMES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_MUTUAL_FUND_PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_MUTUAL_FUND_PRODUCTS, JSON.stringify(DEFAULT_MASTER_MUTUAL_FUND_PRODUCTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_REAL_ESTATE_PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_REAL_ESTATE_PRODUCTS, JSON.stringify(DEFAULT_MASTER_REAL_ESTATE_PRODUCTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_REAL_ESTATE_REQUIREMENTS)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_REAL_ESTATE_REQUIREMENTS, JSON.stringify(DEFAULT_MASTER_REAL_ESTATE_REQUIREMENTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_INSURANCE_PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_INSURANCE_PRODUCTS, JSON.stringify(DEFAULT_MASTER_INSURANCE_PRODUCTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_INSURANCE_SUB_PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_INSURANCE_SUB_PRODUCTS, JSON.stringify(DEFAULT_MASTER_INSURANCE_SUB_PRODUCTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MASTER_INVESTMENT_BUDGETS)) {
    localStorage.setItem(STORAGE_KEYS.MASTER_INVESTMENT_BUDGETS, JSON.stringify(DEFAULT_MASTER_INVESTMENT_BUDGETS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CREDITS)) {
    localStorage.setItem(STORAGE_KEYS.CREDITS, JSON.stringify(DEFAULT_CREDITS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(DEFAULT_EXPENSES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LEDGER)) {
    localStorage.setItem(STORAGE_KEYS.LEDGER, JSON.stringify(DEFAULT_LEDGER));
  }
  if (!localStorage.getItem(STORAGE_KEYS.VENDORS)) {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(DEFAULT_VENDORS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.COMPANIES)) {
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(DEFAULT_COMPANIES));
  }

  // --- DATA MIGRATION: Backfill legacy dummy users (Admin User/Employee 1/Employee 2) with
  // proper names, contact info, serial numbers, and a real accessPages map (older records
  // carried accessPages as an empty array, or were missing newer page keys entirely). ---
  const existingUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  let usersChanged = false;
  const migratedUsers = existingUsers.map((u, idx) => {
    const updated = { ...u };
    const legacy = LEGACY_USER_INFO[u.id];

    if (legacy && LEGACY_USER_NAMES.includes(u.name)) {
      updated.name = legacy.name;
      usersChanged = true;
    }
    if (!updated.number && legacy) { updated.number = legacy.number; usersChanged = true; }
    if (!updated.gmail && legacy) { updated.gmail = legacy.gmail; usersChanged = true; }
    if (updated.serialNo == null) { updated.serialNo = idx + 1; usersChanged = true; }

    if (updated.role !== 'ADMIN') {
      if (!updated.accessPages || Array.isArray(updated.accessPages)) {
        updated.accessPages = { ...DEFAULT_USER_ACCESS };
        usersChanged = true;
      } else {
        const missingKeys = Object.keys(DEFAULT_USER_ACCESS).filter(k => updated.accessPages[k] === undefined);
        if (missingKeys.length > 0) {
          updated.accessPages = { ...updated.accessPages };
          missingKeys.forEach(k => { updated.accessPages[k] = 'none'; });
          usersChanged = true;
        }
      }
    }
    return updated;
  });

  if (usersChanged) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(migratedUsers));
    // Keep the active session's cached profile (used for the header/sidebar) in sync too
    const activeUserRaw = localStorage.getItem('user');
    if (activeUserRaw) {
      try {
        const activeUser = JSON.parse(activeUserRaw);
        const refreshed = migratedUsers.find(u => u.id === activeUser.id);
        if (refreshed) localStorage.setItem('user', JSON.stringify(refreshed));
      } catch (e) { /* ignore malformed cached session */ }
    }
  }

  // --- DATA MIGRATION: Leads previously stored the prospect's name as personaName; renamed to personName ---
  const existingLeadsForRename = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]');
  let leadsRenamed = false;
  const renamedLeads = existingLeadsForRename.map(l => {
    if (l.personaName !== undefined && l.personName === undefined) {
      leadsRenamed = true;
      const { personaName, ...rest } = l;
      return { ...rest, personName: personaName };
    }
    return l;
  });
  if (leadsRenamed) {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(renamedLeads));
  }

  // --- DATA MIGRATION: Repair leads that ended up sharing the same Lead No/id. This happened
  // because generateLeadNo used to derive the next number from the current lead count, which
  // reissues an already-used number once any lead of that type is deleted. Renumber every extra
  // occurrence to a free number under the same prefix — no lead data is touched otherwise.
  const leadsForDedup = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]');
  const seenLeadNos = new Set();
  const maxSeqByPrefix = {};
  leadsForDedup.forEach(l => {
    const match = /^([A-Za-z]+)-(\d+)$/.exec(l.leadNo || '');
    if (match) {
      const prefix = match[1];
      const seq = parseInt(match[2], 10);
      maxSeqByPrefix[prefix] = Math.max(maxSeqByPrefix[prefix] || 0, seq);
    }
  });
  let leadsDeduped = false;
  const dedupedLeads = leadsForDedup.map(l => {
    const leadNo = l.leadNo || '';
    if (!seenLeadNos.has(leadNo)) {
      seenLeadNos.add(leadNo);
      return l;
    }
    const match = /^([A-Za-z]+)-(\d+)$/.exec(leadNo);
    const prefix = match ? match[1] : 'L';
    maxSeqByPrefix[prefix] = (maxSeqByPrefix[prefix] || 0) + 1;
    const newLeadNo = `${prefix}-${String(maxSeqByPrefix[prefix]).padStart(3, '0')}`;
    seenLeadNos.add(newLeadNo);
    leadsDeduped = true;
    return { ...l, leadNo: newLeadNo, id: newLeadNo };
  });
  if (leadsDeduped) {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(dedupedLeads));
  }

  // --- DATA MIGRATION: Update legacy JJSPL PO Numbers ---
  const existingPOs = JSON.parse(localStorage.getItem(STORAGE_KEYS.POS) || '[]');
  const existingIndents = JSON.parse(localStorage.getItem(STORAGE_KEYS.INDENTS) || '[]');
  
  let needsMigration = false;

  const migratedPOs = existingPOs.map(po => {
    if (po.poNumber && po.poNumber.includes('JJSPL/STORES/')) {
      needsMigration = true;
      return { ...po, poNumber: po.poNumber.replace('JJSPL/STORES/', 'Botivate/Store/') };
    }
    return po;
  });

  const migratedIndents = existingIndents.map(indent => {
    let indentChanged = false;
    const updatedItems = indent.items.map(item => {
      if (item.poNumber && item.poNumber.includes('JJSPL/STORES/')) {
        indentChanged = true;
        needsMigration = true;
        return { ...item, poNumber: item.poNumber.replace('JJSPL/STORES/', 'Botivate/Store/') };
      }
      return item;
    });
    if (indentChanged) return { ...indent, items: updatedItems };
    return indent;
  });

  if (needsMigration) {
    localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(migratedPOs));
    localStorage.setItem(STORAGE_KEYS.INDENTS, JSON.stringify(migratedIndents));
    console.log('Migration Complete: JJSPL updated to Botivate');
  }

  // Pre-seed new modules on startup
  getBillNotReceived();
  getStoreIssues();
  getStoreReturns();
  getInventory();
};

// Get data from storage
export const getFromStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

// Save data to storage
export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// User operations
export const getUsers = () => {
  const users = getFromStorage(STORAGE_KEYS.USERS);
  if (!users || !users.some(u => u.id === 'admin')) {
    saveToStorage(STORAGE_KEYS.USERS, DEFAULT_USERS);
    return DEFAULT_USERS;
  }
  return users;
};
export const saveUsers = (users) => saveToStorage(STORAGE_KEYS.USERS, users);

export const createUser = (user) => {
  const users = getUsers();
  const nextSerialNo = users.length > 0 ? Math.max(...users.map(u => u.serialNo || 0)) + 1 : 1;
  const record = { serialNo: nextSerialNo, ...user };
  users.push(record);
  saveUsers(users);
  return record;
};

export const updateUser = (updated) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === updated.id);
  if (index !== -1) {
    users[index] = updated;
    saveUsers(users);
  }
};

export const deleteUser = (id) => {
  const users = getUsers();
  saveUsers(users.filter(u => u.id !== id));
};

export const saveUser = (user) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index !== -1) {
    users[index] = user;
    saveUsers(users);
    return user;
  }
  return createUser(user);
};

// Credits operations
export const getCredits = () => {
  const credits = getFromStorage(STORAGE_KEYS.CREDITS) || [];

  // Seed dummy data if needed (less than 50 rows)
  if (credits.length < 50) {
    const recordsToCreate = 50 - credits.length;
    let currentSnCount = credits.length > 0 ? parseInt(credits[credits.length - 1].sn.split('-')[1]) || 1000 : 1000;
    const dummyCredits = [...credits];
    const dummyLedger = getFromStorage(STORAGE_KEYS.LEDGER) || [];

    // Seed backwards based on today's date
    const baseDate = new Date();

    for (let i = 0; i < recordsToCreate; i++) {
      currentSnCount++;
      const pName = ['John Doe', 'Jane Smith', 'Acme Corp', 'Admin User', 'Employee 1'][(i % 5)];
      const mode = ['Cash', 'Cheque', 'Bank Transfer', 'Online'][(i % 4)];

      const dateObj = new Date(baseDate.getTime() - ((recordsToCreate - i) * 86400000));
      const dateStr = dateObj.toISOString().split('T')[0];

      const creditId = `CRD-${Date.now()}-${currentSnCount}`;
      const amount = (Math.floor(Math.random() * 50) + 1) * 100; // 100 to 5000

      const newCredit = {
        id: creditId,
        sn: `SN-${currentSnCount}`,
        personName: pName,
        date: dateStr,
        amount: amount,
        paymentMode: mode,
        image: '',
        remarks: `Dummy seed record ${i + 1}`,
        status: 'APPROVED',
        timestamp: dateObj.toISOString()
      };

      dummyCredits.push(newCredit);

      // Calculate current active balance for this person
      let currentBalance = 0;
      dummyLedger.filter(l => l.personName === pName).forEach(l => {
        if (l.type === 'CREDIT') currentBalance += l.amount;
        if (l.type === 'DEBIT') currentBalance -= l.amount;
      });
      currentBalance += amount;

      dummyLedger.push({
        id: `LDG-${Date.now()}-${currentSnCount}`,
        personName: pName,
        type: 'CREDIT',
        amount: amount,
        date: dateStr,
        referenceId: creditId,
        balance: currentBalance,
        timestamp: dateObj.toISOString()
      });
    }

    saveToStorage(STORAGE_KEYS.CREDITS, dummyCredits);
    saveToStorage(STORAGE_KEYS.LEDGER, dummyLedger);

    // Attempt to quickly refresh the page silently to grab the new changes
    if (typeof window !== 'undefined' && dummyCredits.length >= 50 && credits.length < 50) {
      setTimeout(() => window.location.reload(), 200);
    }
    return dummyCredits;
  }

  return credits;
};
export const saveCredits = (credits) => saveToStorage(STORAGE_KEYS.CREDITS, credits);
export const saveCredit = (credit) => {
  const credits = getCredits();
  credits.push(credit);
  saveCredits(credits);
};
export const getCreditById = (id) => {
  const credits = getCredits();
  return credits.find(c => c.id === id);
};
export const updateCredit = (updated) => {
  const credits = getCredits();
  const index = credits.findIndex(c => c.id === updated.id);
  if (index !== -1) {
    credits[index] = updated;
    saveCredits(credits);
  }
};

// Expenses operations
export const getExpenses = () => {
  const expenses = getFromStorage(STORAGE_KEYS.EXPENSES) || [];

  // Seed dummy data if needed (less than 25 rows)
  if (expenses.length < 25) {
    const recordsToCreate = 25 - expenses.length;
    let currentSnCount = expenses.length > 0 ? parseInt(expenses[expenses.length - 1].sn.split('-')[1]) || 2000 : 2000;
    const dummyExpenses = [...expenses];
    const dummyLedger = getFromStorage(STORAGE_KEYS.LEDGER) || [];

    // Seed backwards based on today's date
    const baseDate = new Date();

    for (let i = 0; i < recordsToCreate; i++) {
      currentSnCount++;
      const pName = ['John Doe', 'Jane Smith', 'Acme Corp', 'Admin User', 'Employee 1'][(i % 5)];
      const mode = ['Cash', 'Cheque', 'Bank Transfer', 'Online'][(i % 4)];
      const group = ['IT', 'HR', 'Finance', 'Operations', 'Marketing'][(i % 5)];
      // Mix of statuses
      const status = i % 5 === 0 ? 'REJECTED' : (i % 2 === 0 ? 'APPROVED' : 'PENDING');

      const dateObj = new Date(baseDate.getTime() - ((recordsToCreate - i) * 86400000));
      const dateStr = dateObj.toISOString().split('T')[0];

      const expenseId = `EXP-${Date.now()}-${currentSnCount}`;
      const amount = (Math.floor(Math.random() * 15) + 1) * 100; // 100 to 1500

      const newExpense = {
        id: expenseId,
        sn: `EXP-${currentSnCount}`,
        personName: pName,
        date: dateStr,
        amount: amount,
        paymentMode: mode,
        groupHead: group,
        image: '',
        remarks: `Dummy expense record ${i + 1}`,
        status: status,
        timestamp: dateObj.toISOString()
      };

      dummyExpenses.push(newExpense);

      // Calculate current active balance for this person if APPROVED
      if (status === 'APPROVED') {
        let currentBalance = 0;
        dummyLedger.filter(l => l.personName === pName).forEach(l => {
          if (l.type === 'CREDIT') currentBalance += l.amount;
          if (l.type === 'EXPENSE') currentBalance -= l.amount;
          if (l.type === 'DEBIT') currentBalance -= l.amount; // Just in case
        });
        currentBalance -= amount;

        dummyLedger.push({
          id: `LDG-${Date.now()}-${currentSnCount}`,
          personName: pName,
          type: 'EXPENSE', // Used in standard ledger additions
          amount: amount,
          date: dateStr,
          referenceId: expenseId,
          balance: currentBalance,
          timestamp: dateObj.toISOString()
        });
      }
    }

    saveToStorage(STORAGE_KEYS.EXPENSES, dummyExpenses);
    saveToStorage(STORAGE_KEYS.LEDGER, dummyLedger);

    // Attempt to quickly refresh the page silently to grab the new changes
    if (typeof window !== 'undefined' && dummyExpenses.length >= 25 && expenses.length < 25) {
      setTimeout(() => window.location.reload(), 200);
    }
    return dummyExpenses;
  }

  return expenses;
};
export const saveExpenses = (expenses) => saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
export const saveExpense = (expense) => {
  const expenses = getExpenses();
  expenses.push(expense);
  saveExpenses(expenses);
};
export const getExpenseById = (id) => {
  const expenses = getExpenses();
  return expenses.find(e => e.id === id);
};
export const updateExpense = (updated) => {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === updated.id);
  if (index !== -1) {
    expenses[index] = updated;
    saveExpenses(expenses);
  }
};

// Ledger operations
export const getLedger = () => getFromStorage(STORAGE_KEYS.LEDGER) || [];
export const saveLedgers = (ledger) => saveToStorage(STORAGE_KEYS.LEDGER, ledger);
export const saveLedger = (entry) => {
  const ledger = getLedger();
  ledger.push(entry);
  saveLedgers(ledger);
};

// Settings operations
export const getSettings = () => getFromStorage(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
export const saveSettings = (settings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings);

// Auth operations
export const getAuthUser = () => getFromStorage(STORAGE_KEYS.AUTH_USER);
export const saveAuthUser = (user) => saveToStorage(STORAGE_KEYS.AUTH_USER, user);
export const clearAuthUser = () => localStorage.removeItem(STORAGE_KEYS.AUTH_USER);

// Vendor operations
export const getVendors = () => {
  const vendors = getFromStorage(STORAGE_KEYS.VENDORS) || [];
  if (vendors.length < 50) {
    const indianVendors = [
      'Botivate', 'Reliance Industries', 'Infosys Tech', 'HDFC Services', 'ICICI Solutions',
      'Wipro Limited', 'Bharti Airtel', 'Kotak Mahindra', 'Larsen & Toubro', 'Axis Bank',
      'ITC Limited', 'State Bank of India', 'Hindustan Unilever', 'Maruti Suzuki', 'Asian Paints',
      'Bajaj Finance', 'Sun Pharma', 'Titan Company', 'Mahindra & Mahindra', 'HCL Tech',
      'Adani Ports', 'Ultratech Cement', 'Power Grid Corp', 'JSW Steel', 'NTPC Limited',
      'ONGC India', 'Nestle India', 'Hindalco Industries', 'Bharat Petroleum', 'Grasim Industries',
      'Tech Mahindra', 'IndusInd Bank', 'Britannia Industries', 'Coal India', 'Dr. Reddy Labs',
      'Bajaj Auto', 'Botivate Steel', 'Hero MotoCorp', 'Eicher Motors', 'Gail India',
      'Cipla Limited', 'Divis Labs', 'Shree Cement', 'UPL Limited', 'Apollo Hospitals',
      'Godrej Consumer', 'Marico Limited', 'Bajaj Finserv', 'Pidilite Industries', 'Dabur India'
    ];
    const indianNames = [
      'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Gupta', 'Vikram Singh',
      'Anjali Verma', 'Suresh Iyer', 'Kavita Reddy', 'Manoj Bajpai', 'Rahul Dravid',
      'Sachin Tendulkar', 'Sunil Gavaskar', 'Anil Kumble', 'Rohit Sharma', 'Virat Kohli',
      'MS Dhoni', 'Ravindra Jadeja', 'Jasprit Bumrah', 'Hardik Pandya', 'KL Rahul',
      'Rishabh Pant', 'Shikhar Dhawan', 'Cheteshwar Pujara', 'Ajinkya Rahane', 'R Ashwin',
      'Mohammed Shami', 'Ishant Sharma', 'Umesh Yadav', 'Bhuvneshwar Kumar', 'Kuldeep Yadav',
      'Yuzvendra Chahal', 'Shreyas Iyer', 'Ishan Kishan', 'Sanju Samson', 'Prithvi Shaw',
      'Shubman Gill', 'Hanuma Vihari', 'Mayank Agarwal', 'Axar Patel', 'W Sundar',
      'Shardul Thakur', 'Mohammed Siraj', 'T Natarajan', 'Deepak Chahar', 'Varun Chakravarthy',
      'Prasidh Krishna', 'Arshdeep Singh', 'Umran Malik', 'Ravi Bishnoi', 'Avesh Khan'
    ];

    const recordsToCreate = 50 - vendors.length;
    const dummyVendors = [...vendors];
    const baseDate = new Date();
    for (let i = 0; i < recordsToCreate; i++) {
      const dateObj = new Date(baseDate.getTime() - ((recordsToCreate - i) * 3600000));
      const sn = `VN-${String(dummyVendors.length + 1).padStart(3, '0')}`;
      dummyVendors.push({
        id: `VND-${Date.now()}-${i}`,
        timestamp: dateObj.toISOString(),
        vnNo: sn,
        name: indianVendors[i % indianVendors.length],
        gst: `${Math.floor(10 + Math.random() * 80)}AAAAA${Math.floor(1000 + Math.random() * 8000)}A1Z${Math.floor(Math.random() * 9)}`,
        email: `contact@${indianVendors[i % indianVendors.length].toLowerCase().replace(/\s+/g, '')}.in`,
        phone: `${9800000000 + Math.floor(Math.random() * 100000000)}`,
        address: `${100 + i}, MG Road, Mumbai, Maharashtra`,
        locationLink: `https://maps.google.com/?q=${19.0760 + (Math.random() - 0.5)},${72.8777 + (Math.random() - 0.5)}`,
        responsiblePerson: indianNames[i % indianNames.length],
        paymentTerms: [
          `${15 + (i % 4) * 15} Days Credit`,
          i % 3 === 0 ? '10% Advance' : 'Net 30',
          i % 5 === 0 ? 'Special Discount 2%' : 'Standard terms',
          i % 2 === 0 ? 'Partial Advance' : 'Credit Limit 50k'
        ].slice(0, 2 + (i % 3))
      });
    }
    saveToStorage(STORAGE_KEYS.VENDORS, dummyVendors);
    return dummyVendors;
  }

  // DATA REPAIR: Ensure 2-4 terms for every vendor as requested
  let needsSave = false;
  const repairedVendors = vendors.map((v, i) => {
    if (!v.paymentTerms || v.paymentTerms.length < 3) {
      needsSave = true;
      const additional = [
        'Net 30',
        '10% Advance',
        'Partial Advance',
        'Special Discount 2%'
      ].filter(term => !v.paymentTerms?.includes(term));

      const current = v.paymentTerms || ['30 Days Credit'];
      const updated = [...current, ...additional].slice(0, 2 + (i % 3));
      return { ...v, paymentTerms: updated };
    }
    return v;
  });

  if (needsSave) {
    saveToStorage(STORAGE_KEYS.VENDORS, repairedVendors);
    return repairedVendors;
  }

  // Migration: Ensure no legacy Tata vendors
  let needsMigration = false;
  const migrated = vendors.map(v => {
    if (v.name.includes('Tata')) {
      needsMigration = true;
      return { ...v, name: v.name.replace('Tata', 'Botivate') };
    }
    return v;
  });
  if (needsMigration) {
    saveToStorage(STORAGE_KEYS.VENDORS, migrated);
    return migrated;
  }

  return vendors;
};
export const saveVendors = (vendors) => saveToStorage(STORAGE_KEYS.VENDORS, vendors);
export const saveVendor = (vendor) => {
  const vendors = getVendors();
  vendors.push(vendor);
  saveVendors(vendors);
};

// Company operations
export const getCompanies = () => {
  const companies = getFromStorage(STORAGE_KEYS.COMPANIES) || [];
  if (companies.length < 1) {
    const indianCompanies = ['Botivate Services'];
    const indianNames = ['Rajesh Kumar'];

    const dummyCompanies = [];
    const dateObj = new Date();
    const sn = `CN-001`;
    dummyCompanies.push({
      id: `CMP-${Date.now()}-0`,
      timestamp: dateObj.toISOString(),
      vnNo: sn,
      name: indianCompanies[0],
      gst: `27ABCDE1234A1Z5`,
      pan: `ABCDE1234A`,
      email: `info@tcs.com`,
      phone: `9820012345`,
      responsiblePerson: indianNames[0],
      address: `Gateway Park, Mumbai, Maharashtra`,
      billingAddress: `Gateway Park, HQ, Mumbai`,
      destinationAddress: `Warehouse 1, Mumbai`
    });
    saveToStorage(STORAGE_KEYS.COMPANIES, dummyCompanies);
    return dummyCompanies;
  }
  // Migration: Ensure no legacy Tata companies
  let needsMigration = false;
  const migrated = companies.map(c => {
    if (c.name.includes('Tata') || c.name.includes('TCS')) {
      needsMigration = true;
      return { 
        ...c, 
        name: 'Botivate',
        email: c.email.includes('tcs') ? 'info@botivate.com' : c.email
      };
    }
    return c;
  });
  if (needsMigration) {
    saveToStorage(STORAGE_KEYS.COMPANIES, migrated);
    return migrated;
  }

  return companies;
};
export const saveCompanies = (companies) => saveToStorage(STORAGE_KEYS.COMPANIES, companies);
export const saveCompany = (company) => {
  const companies = getCompanies();
  companies.push(company);
  saveCompanies(companies);
};

// Export keys
export { STORAGE_KEYS };

// Item Functions
export const getMasterItems = () => {
  const items = getFromStorage(STORAGE_KEYS.ITEMS) || [];
  if (items.length < 1) {
    const groupHeads = getGroupHeads();
    const uoms = getUOMs();
    const dummyItems = Array.from({ length: 50 }, (_, i) => ({
      id: `ITM-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - i * 1800000).toISOString(),
      inNo: `IN-${String(i + 1).padStart(3, '0')}`,
      name: `Electronic Component ${i + 1}`,
      groupHead: groupHeads[i % groupHeads.length]?.name || 'Electronics',
      uom: uoms[i % uoms.length]?.name || 'PCS'
    }));
    saveToStorage(STORAGE_KEYS.ITEMS, dummyItems);
    return dummyItems;
  }
  return items;
};
export const saveMasterItems = (items) => saveToStorage(STORAGE_KEYS.ITEMS, items);
export const saveMasterItem = (item) => {
  const items = getMasterItems();
  items.push(item);
  saveMasterItems(items);
};

// Group Head Functions
export const getGroupHeads = () => {
  const heads = getFromStorage(STORAGE_KEYS.GROUP_HEADS) || [];
  if (heads.length < 1) {
    const defaultHeads = ['Raw Materials', 'Packaging', 'Electronics', 'Chemicals', 'Stationery', 'Maintenance', 'Consumables', 'Services', 'Logistics', 'Marketing'];
    const dummyHeads = defaultHeads.map((name, i) => ({
      id: `GH-${Date.now()}-${i}`,
      timestamp: new Date().toISOString(),
      ghNo: `GH-${String(i + 1).padStart(3, '0')}`,
      name
    }));
    saveToStorage(STORAGE_KEYS.GROUP_HEADS, dummyHeads);
    return dummyHeads;
  }
  return heads;
};
export const saveGroupHeads = (data) => saveToStorage(STORAGE_KEYS.GROUP_HEADS, data);
export const saveGroupHead = (item) => {
  const data = getGroupHeads();
  data.push(item);
  saveGroupHeads(data);
};

// UOM Functions
export const getUOMs = () => {
  const uoms = getFromStorage(STORAGE_KEYS.UOMS) || [];
  if (uoms.length < 1) {
    const defaultUoms = ['PCS', 'KG', 'LTR', 'MTR', 'BOX'];
    const dummyUoms = defaultUoms.map((name, i) => ({
      id: `UOM-${Date.now()}-${i}`,
      timestamp: new Date().toISOString(),
      uomNo: `UOM-${String(i + 1).padStart(3, '0')}`,
      name
    }));
    saveToStorage(STORAGE_KEYS.UOMS, dummyUoms);
    return dummyUoms;
  }
  return uoms;
};
export const saveUOMs = (data) => saveToStorage(STORAGE_KEYS.UOMS, data);
export const saveUOM = (item) => {
  const data = getUOMs();
  data.push(item);
  saveUOMs(data);
};

// Department Functions
export const getDepartments = () => {
  const depts = getFromStorage(STORAGE_KEYS.DEPARTMENTS) || [];
  if (depts.length < 1) {
    const defaultDepts = ["Production", "Quality Assurance", "Human Resources", "Logistics", "Finance"];
    const dummyDepts = defaultDepts.map((name, i) => ({
      id: `DP-${Date.now()}-${i}`,
      timestamp: new Date().toISOString(),
      dpNo: `DP-${String(i + 1).padStart(3, '0')}`,
      name: name
    }));
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, dummyDepts);
    return dummyDepts;
  }
  return depts;
};
export const saveDepartments = (data) => saveToStorage(STORAGE_KEYS.DEPARTMENTS, data);
export const saveDepartment = (item) => {
  const data = getDepartments();
  data.push(item);
  saveDepartments(data);
};

// Indent Functions
export const getIndents = () => {
  let indents = getFromStorage(STORAGE_KEYS.INDENTS) || [];
  const DATA_VERSION = 'v8_ma_split'; // Increment this to force re-migration
  const currentVersion = getFromStorage('indents_version');
  
  // Data Migration: Ensure Botivate branding and Approval Status on existing data
  let needsMigration = false;
  if (currentVersion !== DATA_VERSION) needsMigration = true;

  let totalPendingFound = 0;
  let vrPendingCount = 0;   // Indent Approved without vendorRateInfo → Vendor Rate Pending
  let vrHistoryCount = 0;   // Indent Approved with vendorRateInfo  → Vendor Rate History
  let taPendingCount = 0;   // Indent Approved with VR info but NO TA info → Technical Pending
  let maPendingCount = 0;   // Indent Approved with TA info but NO MA info → Management Pending
  const histVendors = ['Reliance Industries', 'Infosys Tech', 'Wipro Limited'];

  const migrated = indents.map(indent => {
    let updatedIndent = { ...indent };
    let changed = false;

    const updatedItems = indent.items.map(item => {
      let status = item.approvalStatus;
      let remarks = item.approvalRemarks || '';

      if (needsMigration || !status) {
        if (totalPendingFound < 15) {
          status = 'PENDING';
          remarks = '';
          totalPendingFound++;
        } else {
          const isRejected = Math.random() > 0.85;
          status = isRejected ? 'REJECTED' : 'APPROVED';
          remarks = isRejected ? 'Insufficient stock in warehouse' : 'System Approved';
          updatedIndent.items[indent.items.indexOf(item)].approvedAt = new Date().toISOString();
        }
        changed = true;
      } else if (status === 'PENDING') {
        totalPendingFound++;
      }

      const itemQty = item.itemQty && item.itemQty !== 1 ? item.itemQty : Math.floor(Math.random() * 95) + 5;
      if (!item.itemQty || item.itemQty === 1) changed = true;

      // 1. Assign vendorRateInfo (VR Split)
      let vendorRateInfo = (needsMigration) ? undefined : item.vendorRateInfo;
      if (needsMigration && status === 'APPROVED') {
        if (vrPendingCount < 10) {
          vrPendingCount++;
          vendorRateInfo = undefined;
        } else {
          vrHistoryCount++;
          const isThree = vrHistoryCount % 4 === 0;
          const vCount = isThree ? 3 : 1;
          vendorRateInfo = {
            vendorType: isThree ? 'Three Party' : 'Regular',
            vendorDetails: Array.from({ length: vCount }, (_, vi) => ({
              name: histVendors[vi % histVendors.length],
              quotationNo: `QT-${2000 + vrHistoryCount * 10 + vi}`,
              quotationDate: new Date(Date.now() - vrHistoryCount * 86400000).toISOString().split('T')[0],
              basicRate: String(Math.floor(Math.random() * 900 + 100)) + '.00',
              paymentTerms: ['30 Days Credit', 'Net 30', '15 Days Credit'][vi % 3],
              deliveryTime: String(7 + vi * 2),
              make: ['Samsung', 'LG', 'Bosch'][vi % 3],
              remarks: '', image: ''
            })),
            updatedAt: new Date(Date.now() - vrHistoryCount * 3600000).toISOString()
          };
        }
      }

      // 2. Assign technicalApproval (TA Split)
      let technicalApproval = (needsMigration) ? undefined : item.technicalApproval;
      if (needsMigration && vendorRateInfo) {
        if (taPendingCount < 5) {
          taPendingCount++;
          technicalApproval = undefined;
        } else {
          const vd = vendorRateInfo.vendorDetails || [];
          technicalApproval = {
            t1: vd[0] ? { ...vd[0] } : null,
            t2: vd[1] ? { ...vd[1] } : null,
            t3: vd[2] ? { ...vd[2] } : null,
            rankedAt: new Date(Date.now() - taPendingCount * 7200000).toISOString()
          };
        }
      }

      // 3. Assign managementApproval (MA Split: 5 Pending, rest History)
      let managementApproval = (needsMigration) ? undefined : item.managementApproval;
      if (needsMigration && technicalApproval) {
        if (maPendingCount < 5) {
          maPendingCount++;
          managementApproval = undefined;
        } else {
          managementApproval = {
            approvedVendor: technicalApproval.t1,
            remarks: 'Management Approved for Purchase',
            approvedAt: new Date(Date.now() - maPendingCount * 3600000).toISOString()
          };
        }
      }

      return { 
        ...item, 
        approvalStatus: status, 
        approvalRemarks: remarks, 
        approvedAt: item.approvedAt,
        itemQty,
        vendorRateInfo,
        technicalApproval,
        managementApproval
      };
    });

    if (changed || needsMigration) {
      updatedIndent.items = updatedItems;
      needsMigration = true;
    }

    return updatedIndent;
  });

  if (needsMigration) {
    saveToStorage(STORAGE_KEYS.INDENTS, migrated);
    saveToStorage('indents_version', DATA_VERSION);
    indents = migrated;
  }
  
  if (indents.length < 50) {
    const companies = getCompanies();
    const depts = getDepartments();
    const groupHeads = getGroupHeads();
    const masterItems = getMasterItems();
    const dummyIndents = [...indents];
    const baseDate = new Date();

    // Calculate how many pending we still need to reach 15
    let currentPendingCount = dummyIndents.reduce((acc, ind) => 
      acc + ind.items.filter(it => it.approvalStatus === 'PENDING').length, 0);

    const recordsToCreate = 50 - indents.length;
    let seedVrPendingCount = 0;
    let seedVrHistoryCount = 0;
    let seedTaPendingCount = 0;
    let seedMaPendingCount = 0;
    let seedPoPendingCount = 0;
    let seedPoHistoryCount = 0;
    const seedVendors = ['Reliance Industries', 'Infosys Tech', 'Wipro Limited'];

    for (let i = 0; i < recordsToCreate; i++) {
      const sn = `IN-${String(dummyIndents.length + 1).padStart(3, '0')}`;
      const daysBack = Math.floor(i / (recordsToCreate / 30));
      const dateObj = new Date(baseDate.getTime() - (daysBack * 86400000) - (Math.random() * 3600000)); 
      const timestamp = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

      const itemCount = (i % 3) + 1;
      const items = Array.from({ length: itemCount }, (_, idx) => {
        const gh = groupHeads[idx % groupHeads.length]?.name || 'Electronics';
        const filteredItems = masterItems.filter(m => m.groupHead === gh);
        const item = filteredItems[idx % filteredItems.length] || masterItems[0];

        let status = 'APPROVED';
        let remarks = 'System Approved';
        let approvedAt = null;
        
        if (currentPendingCount < 15) {
          status = 'PENDING';
          remarks = '';
          currentPendingCount++;
        } else {
          if (Math.random() > 0.8) {
            status = 'REJECTED';
            remarks = 'Budget exceeded for this quarter';
          }
          const approvedDate = new Date(dateObj.getTime() + (Math.random() * 3600000 * 24));
          approvedAt = approvedDate.toISOString();
        }

        // 1. VR
        let seedVendorRateInfo = undefined;
        if (status === 'APPROVED') {
          if (seedVrPendingCount < 10) {
            seedVrPendingCount++;
          } else {
            seedVrHistoryCount++;
            const isThree = seedVrHistoryCount % 4 === 0;
            const vCount = isThree ? 3 : 1;
            seedVendorRateInfo = {
              vendorType: isThree ? 'Three Party' : 'Regular',
              vendorDetails: Array.from({ length: vCount }, (_, vi) => ({
                name: seedVendors[vi % seedVendors.length],
                quotationNo: `QT-${3000 + seedVrHistoryCount * 10 + vi}`,
                quotationDate: new Date(Date.now() - seedVrHistoryCount * 86400000).toISOString().split('T')[0],
                basicRate: String(Math.floor(Math.random() * 900 + 100)) + '.00',
                paymentTerms: ['30 Days Credit', 'Net 30', '15 Days Credit'][vi % 3],
                deliveryTime: String(7 + vi * 2),
                make: ['Samsung', 'LG', 'Bosch'][vi % 3],
                remarks: '', image: ''
              })),
              updatedAt: new Date(Date.now() - seedVrHistoryCount * 3600000).toISOString()
            };
          }
        }

        // 2. TA
        let seedTechnicalApproval = undefined;
        if (seedVendorRateInfo) {
          if (seedTaPendingCount < 5) {
            seedTaPendingCount++;
          } else {
            const vd = seedVendorRateInfo.vendorDetails;
            seedTechnicalApproval = {
              t1: vd[0] ? { ...vd[0] } : null,
              t2: vd[1] ? { ...vd[1] } : null,
              t3: vd[2] ? { ...vd[2] } : null,
              rankedAt: new Date().toISOString()
            };
          }
        }

        // 3. MA
        let seedManagementApproval = undefined;
        if (seedTechnicalApproval) {
          if (seedMaPendingCount < 5) {
            seedMaPendingCount++;
          } else {
            seedManagementApproval = {
              approvedVendor: seedTechnicalApproval.t1,
              remarks: 'Bulk Seed Approval',
              approvedAt: new Date().toISOString()
            };
          }
        }

        // 4. PO Stage
        let poGenerated = false;
        let poNumber = null;
        if (seedManagementApproval) {
          if (seedPoPendingCount < 4) {
            seedPoPendingCount++;
            poGenerated = false;
          } else {
            poGenerated = true;
            poNumber = `Botivate/Store/26-27/${seedPoHistoryCount + 1}`;
            seedPoHistoryCount++;
          }
        }

        return {
          department: depts[idx % depts.length]?.name || 'Production',
          groupHead: gh,
          itemName: item?.name || 'Standard Item',
          uom: item?.uom || 'PCS',
          itemQty: Math.floor(Math.random() * 50) + 1,
          areaOfUse: ['Production Line A', 'Warehouse B', 'Admin Block', 'Maintenance Shed'][idx % 4],
          attachment: '',
          specification: `Spec details for ${item?.name}`,
          itemCount: idx + 1,
          approvalStatus: status,
          approvalRemarks: remarks,
          approvedAt,
          vendorRateInfo: seedVendorRateInfo,
          technicalApproval: seedTechnicalApproval,
          managementApproval: seedManagementApproval,
          poGenerated,
          poNumber
        };
      });

      dummyIndents.push({
        id: `IND-${Date.now()}-${i}`,
        serialNo: sn,
        timestamp,
        firmName: companies[0]?.name || 'Botivate',
        indenterName: ['Rajesh Kumar', 'Amit Patel', 'Sneha Gupta'][i % 3],
        indentStatus: i % 4 === 0 ? 'Critical' : 'Non-Critical',
        items
      });
    }
    saveToStorage(STORAGE_KEYS.INDENTS, dummyIndents);
    return dummyIndents;
  }

  return indents;
};

export const saveIndents = (data) => saveToStorage(STORAGE_KEYS.INDENTS, data);

export const saveIndent = (indent) => {
  const data = getIndents();
  data.push(indent);
  saveIndents(data);
};
// PO Functions
export const getPOs = () => {
  const pos = getFromStorage(STORAGE_KEYS.POS) || [];
  if (pos.length < 1) {
    const companies = getCompanies();
    const vendors = getVendors();
    const dummyPOs = Array.from({ length: 20 }, (_, i) => {
      const vendor = vendors[i % vendors.length];
      const items = Array.from({ length: 2 }, (_, idx) => ({
        id: `ITM-${Date.now()}-${i}-${idx}`,
        productName: `Electronic Component ${Math.floor(Math.random() * 50) + 1}`,
        specifications: 'Standard industrial grade',
        quantity: Math.floor(Math.random() * 100) + 10,
        rate: Math.floor(Math.random() * 500) + 100,
        gst: 18,
        discount: 0,
        paymentTerm: '30 Days Credit',
        unit: 'PCS'
      }));

      const subtotal = items.reduce((acc, it) => acc + (it.rate * it.quantity), 0);
      const gst = subtotal * 0.18;

      return {
        id: `PO-${Date.now()}-${i}`,
        poNumber: `Botivate/Store/26-27/${i + 1}`,
        indentNo: `IN-${String(i + 1).padStart(3, '0')}`,
        poDate: new Date(Date.now() - (20 - i) * 86400000).toISOString(),
        supplierName: vendor.name,
        supplierAddress: vendor.address,
        gstin: vendor.gst,
        companyEmail: vendor.email,
        items,
        subtotal,
        totalGst: gst,
        totalAmount: subtotal + gst,
        preparedBy: 'System Admin',
        approvedBy: 'Management',
        companyName: companies[0]?.name || 'Botivate',
        timestamp: new Date(Date.now() - (20 - i) * 86400000).toISOString()
      };
    });
    saveToStorage(STORAGE_KEYS.POS, dummyPOs);
    saveToStorage('pos_version', 'v2_indent_fix');
    return dummyPOs;
  }
  return pos;
};

export const savePOs = (pos) => {
  saveToStorage(STORAGE_KEYS.POS, pos);
};

export const savePO = (po) => {
  const pos = getPOs();
  pos.push(po);
  savePOs(pos);
};

// Terms & Conditions Functions
export const getTermsConditions = () => {
  let terms = getFromStorage(STORAGE_KEYS.TERMS_CONDITIONS) || [];
  if (terms.length < 1) {
    const companies = getCompanies();
    const botivate = companies.find(c => c.name === 'Botivate' || c.name === 'Botivate Services') || companies[0];
    const companyName = botivate?.name || 'Botivate Services';
    
    const dummyTerms = [
      "Payment within 30 days of invoice date.",
      "Delivery within 2 weeks of purchase order.",
      "Goods once sold will not be taken back.",
      "All disputes subject to Mumbai jurisdiction.",
      "Warranty for 1 year against manufacturing defects.",
      "Prices are inclusive of all taxes unless specified.",
      "Inspection to be done at our warehouse before dispatch.",
      "Order cancellation subject to 10% restocking fee.",
      "Interest at 18% p.a. for delayed payments.",
      "Quantity tolerance of +/- 5% allowed.",
      "Standard packaging included in price.",
      "Quotations valid for 15 days only."
    ];

    const seeded = dummyTerms.map((text, i) => ({
      id: `TC-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      tcNo: `TC-001`,
      termsNo: i + 1,
      companyName: companyName,
      content: text
    }));

    saveToStorage(STORAGE_KEYS.TERMS_CONDITIONS, seeded);
    return seeded;
  }

  // FORCE REPAIR: Ensure all terms for the same company have the same TC number
  let needsFix = false;
  const companyMap = {};
  const fixedTerms = terms.map(t => {
    if (!companyMap[t.companyName]) {
      companyMap[t.companyName] = t.tcNo;
      return t;
    }
    if (t.tcNo !== companyMap[t.companyName]) {
      needsFix = true;
      return { ...t, tcNo: companyMap[t.companyName] };
    }
    return t;
  });

  if (needsFix) {
    saveToStorage(STORAGE_KEYS.TERMS_CONDITIONS, fixedTerms);
    return fixedTerms;
  }

  return terms;
};

export const saveTermsConditions = (data) => saveToStorage(STORAGE_KEYS.TERMS_CONDITIONS, data);
export const saveTermsCondition = (item) => {
  const data = getTermsConditions();
  data.push(item);
  saveTermsConditions(data);
};
// Lifting operations
export const getLiftingRecords = () => {
  const records = getFromStorage(STORAGE_KEYS.LIFTING) || [];
  const DATA_VERSION = 'v5_botivate_services';
  const currentVersion = getFromStorage('lifting_version');
  
  // Seed 17 dummy records for History if empty or version mismatch
  if (records.length < 1 || currentVersion !== DATA_VERSION) {
    const pos = getPOs();
    const vendors = getVendors();
    const dummyRecords = [];
    
    for (let i = 0; i < 17; i++) {
      const po = pos[i % pos.length];
      const item = po.items[0];
      const dateObj = new Date(Date.now() - (17 - i) * 86400000);
      
      dummyRecords.push({
        id: `LIFT-DUMMY-${i}`,
        timestamp: dateObj.toISOString(),
        poNumber: po.poNumber,
        indentNo: po.indentNo || `IN-${String(i + 1).padStart(3, '0')}`,
        firmName: 'Botivate Services',
        projectName: 'PROJECT-' + (i + 1),
        vendorName: po.supplierName,
        billStatus: i % 2 === 0 ? 'Received' : 'Not Received',
        billNumber: `BILL-${1000 + i}`,
        billAmount: (item.rate * item.quantity * 1.18).toFixed(3),
        billRemarks: 'Automatic dummy seed record',
        challanNumber: `CHL-${500 + i}`,
        transportation: 'Yes',
        transporterName: 'Express Logistics',
        vehicleNo: `MH-${12 + i}-AB-${1000 + i}`,
        driverName: 'Rajesh Driver ' + (i + 1),
        driverMobile: '98000123' + String(i).padStart(2, '0'),
        frightAmount: '1500.00',
        freightPaymentStatus: i >= 10 ? 'Paid' : 'Pending',
        freightPaidAt: i >= 10 ? new Date(dateObj.getTime() + 86400000).toISOString() : null,
        freightData: i >= 10 ? {
            vehicleNumber: `MH-${12 + i}-AB-${1000 + i}`,
            biltyNumber: `BLT-${7000 + i}`,
            fromLocation: 'Warehouse A',
            toLocation: 'Project Site ' + (i + 1),
            rateType: 'Fixed',
            freightAmount: '1500.00',
            materialLoadDetails: 'Bulk construction material load'
        } : null,
        items: [
          {
            productName: item.productName,
            rate: item.rate,
            gst: item.gst,
            effRate: item.rate * 1.18,
            pendingQty: 0,
            liftQty: item.quantity,
            cancelQty: 0,
            amount: item.rate * item.quantity * 1.18
          }
        ],
        totalAmount: item.rate * item.quantity * 1.18
      });
    }
    saveToStorage(STORAGE_KEYS.LIFTING, dummyRecords);
    saveToStorage('lifting_version', DATA_VERSION);
    return dummyRecords;
  }
  
  return records;
};
export const saveLiftingRecords = (records) => saveToStorage(STORAGE_KEYS.LIFTING, records);
export const saveLiftingRecord = (record) => {
  const records = getLiftingRecords();
  records.push({
    ...record,
    id: record.id || `LIFT-${Date.now()}`
  });
  saveLiftingRecords(records);
};

// Store In operations
export const getStoreInRecords = () => {
  const records = getFromStorage(STORAGE_KEYS.STORE_IN) || [];
  const DATA_VERSION = 'v5_botivate_services';
  const currentVersion = getFromStorage('store_in_version');
  
  // Seed more records if empty or if version mismatch (to force the 2-pending split)
  if (records.length < 5 || currentVersion !== DATA_VERSION) {
    const lifting = getLiftingRecords();
    const dummy = lifting.map((lift, i) => {
      // First 2 are pending, rest are history as requested
      const isHistory = i >= 2;
      return {
        ...lift,
        id: `STR-DUMMY-${i}`,
        recQty: lift.items[0].liftQty,
        physicalCheck: 'Pass',
        qtyMatch: 'Yes',
        priceMatch: 'Yes',
        location: 'Main Warehouse Row ' + (i + 1),
        timestamp: new Date(new Date(lift.timestamp).getTime() + 86400000).toISOString(),
        // HOD fields
        hodStatus: isHistory ? (i % 4 === 0 ? 'Rejected' : 'Approved') : 'Pending',
        hodRemark: isHistory ? (i % 4 === 0 ? 'Quantity discrepancy in bill' : 'All items verified physically') : '',
        hodApprovedAt: isHistory ? new Date(new Date(lift.timestamp).getTime() + 172800000).toISOString() : null
      };
    });
    saveToStorage(STORAGE_KEYS.STORE_IN, dummy);
    saveToStorage('store_in_version', DATA_VERSION);
    return dummy;
  }
  return records;
};
export const saveStoreInRecords = (records) => saveToStorage(STORAGE_KEYS.STORE_IN, records);
export const saveStoreInRecord = (record) => {
  const records = getStoreInRecords();
  records.push({ ...record, id: `STR-${Date.now()}` });
  saveStoreInRecords(records);
};

// Direct Store In operations
export const getDirectStoreInRecords = () => {
  const records = getFromStorage(STORAGE_KEYS.DIRECT_STORE_IN) || [];
  const DATA_VERSION = 'v2_firm_name';
  const currentVersion = getFromStorage('direct_store_in_version');
  
  if (records.length < 1 || currentVersion !== DATA_VERSION) {
    const vendors = getVendors();
    const dummy = Array.from({ length: 12 }, (_, i) => ({
      id: `DIR-DUMMY-${i}`,
      firmName: 'Botivate Services',
      projectName: 'GOAT MARKET',
      receiverName: 'Receiver ' + (i + 1),
      vendorName: vendors[i % vendors.length].name,
      productName: 'Direct Item ' + (i + 1),
      billStatus: i % 3 === 0 ? 'Not Received' : 'Received',
      billNo: `DIR-BILL-${2000 + i}`,
      billAmount: (500 + i * 100).toFixed(3),
      receivingQty: (10 + i),
      transportingType: 'Yes',
      freightAmount: '500.00',
      transporterName: 'Local Transport',
      vehicleNo: `MH-15-TR-${3000 + i}`,
      timestamp: new Date(Date.now() - i * 86400000).toISOString()
    }));
    saveToStorage(STORAGE_KEYS.DIRECT_STORE_IN, dummy);
    saveToStorage('direct_store_in_version', DATA_VERSION);
    return dummy;
  }
  return records;
};
export const saveDirectStoreInRecords = (records) => saveToStorage(STORAGE_KEYS.DIRECT_STORE_IN, records);
export const saveDirectStoreInRecord = (record) => {
  const records = getDirectStoreInRecords();
  records.push({ ...record, id: `DIR-${Date.now()}` });
  saveDirectStoreInRecords(records);
};

// Payment operations
export const getPayments = () => {
  const payments = getFromStorage(STORAGE_KEYS.PAYMENTS) || [];
  const DATA_VERSION = 'v1_payments';
  const currentVersion = getFromStorage('payments_version');

  if (payments.length < 1 || currentVersion !== DATA_VERSION) {
    const storeIn = getStoreInRecords().filter(r => r.hodStatus === 'Approved');
    const direct = getDirectStoreInRecords();
    
    const dummy = [];
    let paymentCount = 0;

    // Seed some payments for Store In
    storeIn.slice(0, 5).forEach((record, i) => {
      paymentCount++;
      dummy.push({
        id: `PAY-${Date.now()}-${paymentCount}`,
        referenceId: record.id,
        referenceType: 'STORE_IN',
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        paymentNo: `PAY-2026-${String(paymentCount).padStart(3, '0')}`,
        paymentCount: 1,
        paidAmount: record.totalAmount || record.billAmount || 1500,
        pendingAmount: 0,
        paymentStatus: 'Paid',
        attachment: '',
        remarks: 'Dummy seeded payment for Store In'
      });
    });

    // Seed some payments for Direct Store In
    direct.slice(0, 3).forEach((record, i) => {
      paymentCount++;
      dummy.push({
        id: `PAY-${Date.now()}-${paymentCount}`,
        referenceId: record.id,
        referenceType: 'DIRECT_STORE_IN',
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        paymentNo: `PAY-2026-${String(paymentCount).padStart(3, '0')}`,
        paymentCount: 1,
        paidAmount: record.billAmount || 500,
        pendingAmount: 0,
        paymentStatus: 'Paid',
        attachment: '',
        remarks: 'Dummy seeded payment for Direct Store In'
      });
    });

    saveToStorage(STORAGE_KEYS.PAYMENTS, dummy);
    saveToStorage('payments_version', DATA_VERSION);
    return dummy;
  }
  return payments;
};
export const savePayments = (records) => saveToStorage(STORAGE_KEYS.PAYMENTS, records);
export const savePayment = (record) => {
  const records = getPayments();
  records.push({ ...record, id: `PAY-${Date.now()}` });
  savePayments(records);
};

// Reject GRN Operations
export const getRejectGRNRecords = () => {
  const records = getFromStorage(STORAGE_KEYS.REJECT_GRN) || [];
  const DATA_VERSION = 'v1_reject_grn';
  const currentVersion = getFromStorage('reject_grn_version');

  if (records.length < 1 || currentVersion !== DATA_VERSION) {
    const storeIn = getStoreInRecords().filter(r => r.hodStatus === 'Rejected');
    const dummy = [];

    // Seed some history records
    storeIn.slice(0, 2).forEach((record, i) => {
      dummy.push({
        id: `RGRN-${Date.now()}-${i}`,
        referenceId: record.id,
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        grnStatus: 'Reject',
        reason: 'Quantity mismatch is severe',
        debitNoteSent: 'Yes',
        attachment: ''
      });
    });

    saveToStorage(STORAGE_KEYS.REJECT_GRN, dummy);
    saveToStorage('reject_grn_version', DATA_VERSION);
    return dummy;
  }
  return records;
};

export const saveRejectGRNRecords = (records) => saveToStorage(STORAGE_KEYS.REJECT_GRN, records);
export const saveRejectGRNRecord = (record) => {
  const records = getRejectGRNRecords();
  records.push({ ...record, id: `RGRN-${Date.now()}` });
  saveRejectGRNRecords(records);
};

// Debit Note Operations
export const getDebitNotes = () => {
  const records = getFromStorage(STORAGE_KEYS.DEBIT_NOTES) || [];
  const DATA_VERSION = 'v1_debit_notes';
  const currentVersion = getFromStorage('debit_notes_version');

  if (records.length < 1 || currentVersion !== DATA_VERSION) {
    const lifting = getLiftingRecords();
    const dummy = [];

    lifting.slice(0, 5).forEach((record, i) => {
      dummy.push({
        id: `DN-${Date.now()}-${i}`,
        liftNumber: record.id || `LIFT-DUMMY-${i}`,
        indentNo: record.indentNo || `IN-${String(i + 1).padStart(3, '0')}`,
        projectName: record.projectName || record.firmName || 'Botivate',
        firmName: record.firmName || 'Botivate Services',
        billNo: record.billNumber || `BILL-${1000 + i}`,
        vendorName: record.vendorName,
        productName: record.items?.[0]?.productName || 'Electronic Component',
        qty: record.items?.[0]?.liftQty || 50,
        typeOfBill: 'Tax Invoice',
        billAmount: record.billAmount || '1500.00',
        paymentType: '30 Days Credit',
        advanceAmount: '₹0.00',
        photoOfBill: '',
        transportation: 'Yes',
        transporterName: record.transporterName || 'Express Logistics',
        amount: record.totalAmount || record.billAmount || '1500.00',
        reason: 'Material rejected due to physical check failure',
        plannedDate: '22/05/2026',
        debitNoteNo: `DN-2026-${String(i + 1).padStart(3, '0')}`,
        debitNoteCopy: 'debit_note_copy.pdf',
        status: 'Sent',
        statusPurchaser: 'Approved',
        billCopy: 'bill_copy.pdf',
        returnCopy: 'return_challan.pdf',
        timestamp: new Date(Date.now() - (i + 1) * 86400000).toISOString()
      });
    });

    saveToStorage(STORAGE_KEYS.DEBIT_NOTES, dummy);
    saveToStorage('debit_notes_version', DATA_VERSION);
    return dummy;
  }
  return records;
};

export const saveDebitNotes = (records) => saveToStorage(STORAGE_KEYS.DEBIT_NOTES, records);
export const saveDebitNote = (record) => {
  const records = getDebitNotes();
  records.push({
    ...record,
    id: record.id || `DN-${Date.now()}`,
    timestamp: new Date().toISOString()
  });
  saveDebitNotes(records);
};

// Tally & Audit Data Operations
export const getTallyEntries = () => {
  const records = getFromStorage(STORAGE_KEYS.TALLY_ENTRIES) || [];
  const DATA_VERSION = 'v1_tally_entries';
  const currentVersion = getFromStorage('tally_entries_version');

  if (records.length < 1 || currentVersion !== DATA_VERSION) {
    const dummy = [
      {
        id: 'TALLY-101',
        indentNumber: 'IN-001',
        indentDate: '2026-05-01T09:00:00Z',
        purchaseDate: '2026-05-02T10:00:00Z',
        materialInDate: '2026-05-04T12:00:00Z',
        plannedDate: '2026-05-15T09:00:00Z',
        productName: 'Cement OPC 53 Grade',
        firmNameMatch: 'Pratap Engineering Site A',
        billNo: 'BILL-9982',
        qty: 150,
        partyName: 'UltraTech Cement Ltd',
        billAmt: 67500.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Main Warehouse A',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Foundations Block 1',
        indentedFor: 'Slab reinforcement',
        approvedPartyName: 'UltraTech Cement Ltd',
        rate: 450.00,
        indentQty: 150,
        totalRate: 67500.00,
        liftNumber: 'LIFT-8821',
        poNumber: 'PO-2026-101',
        currentStage: 'AUDIT',
        isCompleted: false,
        planned1: '2026-05-15T09:00:00Z',
        actual1: '',
        status1: '',
        remarks1: '',
        planned2: '',
        actual2: '',
        status2: '',
        remarks2: '',
        planned3: '',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '',
        actual4: '',
        status4: '',
        remarks4: '',
        planned5: '',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-04T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Audit looks clean.',
        receivingStatus: 'Received',
        receivedQuantity: 150
      },
      {
        id: 'TALLY-102',
        indentNumber: 'IN-002',
        indentDate: '2026-05-02T09:00:00Z',
        purchaseDate: '2026-05-03T10:00:00Z',
        materialInDate: '2026-05-05T12:00:00Z',
        plannedDate: '2026-05-16T10:00:00Z',
        productName: 'Reinforcement Steel 12mm',
        firmNameMatch: 'Botivate Products Site B',
        billNo: 'BILL-4451',
        qty: 500,
        partyName: 'Tata Steel Ltd',
        billAmt: 275000.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Central Yard B',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Block 2 Columns',
        indentedFor: 'Core columns',
        approvedPartyName: 'Tata Steel Ltd',
        rate: 550.00,
        indentQty: 500,
        totalRate: 275000.00,
        liftNumber: 'LIFT-2291',
        poNumber: 'PO-2026-102',
        currentStage: 'AUDIT',
        isCompleted: false,
        planned1: '2026-05-16T10:00:00Z',
        actual1: '',
        status1: '',
        remarks1: '',
        planned2: '',
        actual2: '',
        status2: '',
        remarks2: '',
        planned3: '',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '',
        actual4: '',
        status4: '',
        remarks4: '',
        planned5: '',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-05T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Matches PO values.',
        receivingStatus: 'Received',
        receivedQuantity: 500
      },
      {
        id: 'TALLY-103',
        indentNumber: 'IN-003',
        indentDate: '2026-05-03T09:00:00Z',
        purchaseDate: '2026-05-04T10:00:00Z',
        materialInDate: '2026-05-06T12:00:00Z',
        plannedDate: '2026-05-12T09:00:00Z',
        productName: 'Electrical Conduit Pipe 25mm',
        firmNameMatch: 'Pratap Engineering Site A',
        billNo: 'BILL-2231',
        qty: 120,
        partyName: 'Havells India Ltd',
        billAmt: 14400.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Main Warehouse A',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Block 1 Basements',
        indentedFor: 'Basement wiring',
        approvedPartyName: 'Havells India Ltd',
        rate: 120.00,
        indentQty: 120,
        totalRate: 14400.00,
        liftNumber: 'LIFT-8872',
        poNumber: 'PO-2026-103',
        currentStage: 'RECTIFY',
        isCompleted: false,
        planned1: '2026-05-10T09:00:00Z',
        actual1: '2026-05-11T11:00:00Z',
        status1: 'Not Done',
        remarks1: 'Price on invoice varies from PO rate. Requires supplier rectification.',
        planned2: '2026-05-12T09:00:00Z',
        actual2: '',
        status2: '',
        remarks2: '',
        planned3: '',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '',
        actual4: '',
        status4: '',
        remarks4: '',
        planned5: '',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-06T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'No',
        hodStatus: 'Pending',
        hodRemark: 'Needs rate adjustment.',
        receivingStatus: 'Received',
        receivedQuantity: 120
      },
      {
        id: 'TALLY-104',
        indentNumber: 'IN-004',
        indentDate: '2026-05-04T09:00:00Z',
        purchaseDate: '2026-05-05T10:00:00Z',
        materialInDate: '2026-05-07T12:00:00Z',
        plannedDate: '2026-05-13T09:00:00Z',
        productName: 'PVC Pipes 4-inch',
        firmNameMatch: 'BuildCon Solutions',
        billNo: 'BILL-1109',
        qty: 80,
        partyName: 'Supreme Industries',
        billAmt: 24000.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Plumbing Bay',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Drainage Phase 1',
        indentedFor: 'Main outlet drain',
        approvedPartyName: 'Supreme Industries',
        rate: 300.00,
        indentQty: 100,
        totalRate: 30000.00,
        liftNumber: 'LIFT-0091',
        poNumber: 'PO-2026-104',
        currentStage: 'RECTIFY',
        isCompleted: false,
        planned1: '2026-05-11T09:00:00Z',
        actual1: '2026-05-12T14:30:00Z',
        status1: 'Not Done',
        remarks1: 'Quantity is 20 short in bill. Need credit note or bill correction.',
        planned2: '2026-05-13T09:00:00Z',
        actual2: '',
        status2: '',
        remarks2: '',
        planned3: '',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '',
        actual4: '',
        status4: '',
        remarks4: '',
        planned5: '',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-07T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'No',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Bill count is short.',
        receivingStatus: 'Received',
        receivedQuantity: 80
      },
      {
        id: 'TALLY-105',
        indentNumber: 'IN-005',
        indentDate: '2026-05-05T09:00:00Z',
        purchaseDate: '2026-05-06T10:00:00Z',
        materialInDate: '2026-05-08T12:00:00Z',
        plannedDate: '2026-05-11T09:00:00Z',
        productName: 'Submersible Pump 5HP',
        firmNameMatch: 'Pratap Engineering Site A',
        billNo: 'BILL-8812',
        qty: 2,
        partyName: 'Kirloskar Brothers Ltd',
        billAmt: 90000.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Pump House 1',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Borewell 2',
        indentedFor: 'Site dewatering',
        approvedPartyName: 'Kirloskar Brothers Ltd',
        rate: 45000.00,
        indentQty: 2,
        totalRate: 90000.00,
        liftNumber: 'LIFT-4432',
        poNumber: 'PO-2026-105',
        currentStage: 'REAUDIT',
        isCompleted: false,
        planned1: '2026-05-08T09:00:00Z',
        actual1: '2026-05-09T10:00:00Z',
        status1: 'Not Done',
        remarks1: 'Missing manual warranty/challan copy in attachments.',
        planned2: '2026-05-09T12:00:00Z',
        actual2: '2026-05-10T11:30:00Z',
        status2: 'Done',
        remarks2: 'Supplier provided warranty certificate scan, uploaded to folder.',
        planned3: '2026-05-11T09:00:00Z',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '',
        actual4: '',
        status4: '',
        remarks4: '',
        planned5: '',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-08T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Warranty verified.',
        receivingStatus: 'Received',
        receivedQuantity: 2
      },
      {
        id: 'TALLY-106',
        indentNumber: 'IN-006',
        indentDate: '2026-05-06T09:00:00Z',
        purchaseDate: '2026-05-07T10:00:00Z',
        materialInDate: '2026-05-09T12:00:00Z',
        plannedDate: '2026-05-12T09:00:00Z',
        productName: 'Structural I-Beams',
        firmNameMatch: 'Botivate Products Site B',
        billNo: 'BILL-6609',
        qty: 12,
        partyName: 'Jindal Steel & Power',
        billAmt: 420000.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Heavy Storage Zone',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Roof Truss Block C',
        indentedFor: 'Structural columns Frame',
        approvedPartyName: 'Jindal Steel & Power',
        rate: 35000.00,
        indentQty: 12,
        totalRate: 420000.00,
        liftNumber: 'LIFT-9912',
        poNumber: 'PO-2026-106',
        currentStage: 'TALLY_ENTRY',
        isCompleted: false,
        planned1: '2026-05-10T09:00:00Z',
        actual1: '2026-05-11T12:00:00Z',
        status1: 'Done',
        remarks1: 'Dimensions and weight verified by technical team.',
        planned2: '',
        actual2: '',
        status2: '',
        remarks2: '',
        planned3: '',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '2026-05-12T09:00:00Z',
        actual4: '',
        status4: '',
        remarks4: '',
        planned5: '',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-09T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Excellent grade steel.',
        receivingStatus: 'Received',
        receivedQuantity: 12
      },
      {
        id: 'TALLY-107',
        indentNumber: 'IN-007',
        indentDate: '2026-05-07T09:00:00Z',
        purchaseDate: '2026-05-08T10:00:00Z',
        materialInDate: '2026-05-10T12:00:00Z',
        plannedDate: '2026-05-11T09:00:00Z',
        productName: 'Galvanized Cable Trays',
        firmNameMatch: 'Pratap Engineering Site A',
        billNo: 'BILL-3312',
        qty: 60,
        partyName: 'Legrand India',
        billAmt: 48000.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Main Warehouse A',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Block 2 Electrical Rooms',
        indentedFor: 'HVAC power cables support',
        approvedPartyName: 'Legrand India',
        rate: 800.00,
        indentQty: 60,
        totalRate: 48000.00,
        liftNumber: 'LIFT-0028',
        poNumber: 'PO-2026-107',
        currentStage: 'TALLY_ENTRY',
        isCompleted: false,
        planned1: '2026-05-05T09:00:00Z',
        actual1: '2026-05-06T10:00:00Z',
        status1: 'Not Done',
        remarks1: 'Requires project manager dual signature on physical copy.',
        planned2: '2026-05-07T09:00:00Z',
        actual2: '2026-05-08T15:00:00Z',
        status2: 'Done',
        remarks2: 'Signature obtained and verified.',
        planned3: '2026-05-09T09:00:00Z',
        actual3: '2026-05-10T11:00:00Z',
        status3: 'Done',
        remarks3: 'Re-audit passed successfully.',
        planned4: '2026-05-11T09:00:00Z',
        actual4: '',
        status4: '',
        remarks4: '',
        planned5: '',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-10T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Signed physical copy received.',
        receivingStatus: 'Received',
        receivedQuantity: 60
      },
      {
        id: 'TALLY-108',
        indentNumber: 'IN-008',
        indentDate: '2026-05-08T09:00:00Z',
        purchaseDate: '2026-05-09T10:00:00Z',
        materialInDate: '2026-05-11T12:00:00Z',
        plannedDate: '2026-05-10T09:00:00Z',
        productName: 'Led Tube Lights 20W',
        firmNameMatch: 'Botivate Products Site B',
        billNo: 'BILL-4491',
        qty: 300,
        partyName: 'Philips Lighting',
        billAmt: 60000.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Electrical Bay B',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Office building internal',
        indentedFor: 'Main ceiling lights',
        approvedPartyName: 'Philips Lighting',
        rate: 200.00,
        indentQty: 300,
        totalRate: 60000.00,
        liftNumber: 'LIFT-3819',
        poNumber: 'PO-2026-108',
        currentStage: 'AGAIN_AUDIT',
        isCompleted: false,
        planned1: '2026-05-06T09:00:00Z',
        actual1: '2026-05-07T10:00:00Z',
        status1: 'Done',
        remarks1: 'Audit clear. Lighting specs checked.',
        planned2: '',
        actual2: '',
        status2: '',
        remarks2: '',
        planned3: '',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '2026-05-08T09:00:00Z',
        actual4: '2026-05-09T13:00:00Z',
        status4: 'Done',
        remarks4: 'ERP logged. Voucher #T-5591.',
        planned5: '2026-05-10T09:00:00Z',
        actual5: '',
        status5: '',
        remarks5: '',
        timestamp: '2026-05-11T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Voucher verified.',
        receivingStatus: 'Received',
        receivedQuantity: 300
      },
      {
        id: 'TALLY-109',
        indentNumber: 'IN-009',
        indentDate: '2026-05-01T09:00:00Z',
        purchaseDate: '2026-05-02T10:00:00Z',
        materialInDate: '2026-05-03T12:00:00Z',
        plannedDate: '2026-05-05T09:00:00Z',
        productName: 'Ready Mix Concrete M25',
        firmNameMatch: 'BuildCon Solutions',
        billNo: 'BILL-0992',
        qty: 50,
        partyName: 'Lafarge Holcim',
        billAmt: 195000.00,
        billImage: '',
        billReceivedLater: 'No',
        location: 'Foundation Block C',
        typeOfBills: 'Tax Invoice',
        productImage: '',
        area: 'Ground slab foundations',
        indentedFor: 'Main structural floor',
        approvedPartyName: 'Lafarge Holcim',
        rate: 3900.00,
        indentQty: 50,
        totalRate: 195000.00,
        liftNumber: 'LIFT-1102',
        poNumber: 'PO-2026-109',
        currentStage: 'COMPLETED',
        isCompleted: true,
        planned1: '2026-05-01T09:00:00Z',
        actual1: '2026-05-02T10:00:00Z',
        status1: 'Done',
        remarks1: 'Slab casting successful. Cube test results attached.',
        planned2: '',
        actual2: '',
        status2: '',
        remarks2: '',
        planned3: '',
        actual3: '',
        status3: '',
        remarks3: '',
        planned4: '2026-05-03T09:00:00Z',
        actual4: '2026-05-04T12:00:00Z',
        status4: 'Done',
        remarks4: 'Tally Entry complete under voucher #V-11883.',
        planned5: '2026-05-05T09:00:00Z',
        actual5: '2026-05-06T15:00:00Z',
        status5: 'okay',
        remarks5: 'Final audit check passed. Perfect matching.',
        timestamp: '2026-05-03T12:00:00Z',
        damageOrder: 'Yes',
        quantityAsPerBill: 'Yes',
        priceAsPerPoCheck: 'Yes',
        hodStatus: 'Approved',
        hodRemark: 'Cube test verified.',
        receivingStatus: 'Received',
        receivedQuantity: 50
      }
    ];

    saveToStorage(STORAGE_KEYS.TALLY_ENTRIES, dummy);
    saveToStorage('tally_entries_version', DATA_VERSION);
    return dummy;
  }
  return records;
};

export const saveTallyEntries = (records) => saveToStorage(STORAGE_KEYS.TALLY_ENTRIES, records);

export const updateTallyEntry = (id, updates) => {
  const records = getTallyEntries();
  const index = records.findIndex(r => r.id === id || String(r.id) === String(id));
  if (index !== -1) {
    const item = { ...records[index], ...updates };

    // Dynamically transition stages
    const hasValue = (val) => val !== undefined && val !== null && val !== '' && String(val).trim() !== '';
    const isAuditDone = String(item.status1 || '').toLowerCase() === 'done';

    if (hasValue(item.actual5)) {
      item.currentStage = 'COMPLETED';
      item.isCompleted = true;
    } else if (hasValue(item.actual4)) {
      item.currentStage = 'AGAIN_AUDIT';
      if (!hasValue(item.planned5)) {
        item.planned5 = new Date().toISOString();
      }
    } else if (hasValue(item.actual3)) {
      item.currentStage = 'TALLY_ENTRY';
      if (!hasValue(item.planned4)) {
        item.planned4 = new Date().toISOString();
      }
    } else if (hasValue(item.actual2)) {
      item.currentStage = 'REAUDIT';
      if (!hasValue(item.planned3)) {
        item.planned3 = new Date().toISOString();
      }
    } else if (hasValue(item.actual1)) {
      if (isAuditDone) {
        item.currentStage = 'TALLY_ENTRY';
        if (!hasValue(item.planned4)) {
          item.planned4 = new Date().toISOString();
        }
      } else {
        item.currentStage = 'RECTIFY';
        if (!hasValue(item.planned2)) {
          item.planned2 = new Date().toISOString();
        }
      }
    } else {
      item.currentStage = 'AUDIT';
    }

    records[index] = item;
    saveTallyEntries(records);
    return item;
  }
  return null;
};

// --- Bill Not Received Operations ---
export const getBillNotReceived = () => {
  const data = getFromStorage(STORAGE_KEYS.BILL_NOT_RECEIVED);
  if (!data) {
    const dummy = [
      {
        id: "LIFT-2911",
        indentNumber: "IND-9912",
        poNumber: "PO-2026-0911",
        vendorName: "Prism Johnson Cement",
        projectName: "Pratap Site A",
        productName: "OPC 53 Cement",
        billStatus: "Pending",
        plannedDate: "2026-05-18",
        billNo: "",
        qty: 250,
        leadTime: "3 Days",
        typeOfBill: "GST Tax Invoice",
        billAmount: 112500,
        discountAmount: 2500,
        paymentType: "Credit - 30 Days",
        advanceAmount: 10000,
        photoOfBill: "",
        transportationInclude: "Yes",
        transporterName: "Lucknow Cargo Express",
        amount: 7500,
        challanNo: "CH-98122",
        challanImage: "",
        statusOfBill: "",
        billImage: "",
        timestamp: "2026-05-15T09:00:00.000Z"
      },
      {
        id: "LIFT-3012",
        indentNumber: "IND-8821",
        poNumber: "PO-2026-0812",
        vendorName: "TATA Steel Ltd",
        projectName: "Gomti Nagar Extension",
        productName: "TMT Fe 550 Rebars 12mm",
        billStatus: "Pending",
        plannedDate: "2026-05-19",
        billNo: "",
        qty: 15,
        leadTime: "5 Days",
        typeOfBill: "GST Tax Invoice",
        billAmount: 780000,
        discountAmount: 15000,
        paymentType: "Advance Payment",
        advanceAmount: 200000,
        photoOfBill: "",
        transportationInclude: "No",
        transporterName: "TATA Logistics Ltd",
        amount: 0,
        challanNo: "CH-88192",
        challanImage: "",
        statusOfBill: "",
        billImage: "",
        timestamp: "2026-05-16T10:00:00.000Z"
      },
      {
        id: "LIFT-3104",
        indentNumber: "IND-7711",
        poNumber: "PO-2026-0701",
        vendorName: "Berger Paints India",
        projectName: "Vrindavan Yojna Site",
        productName: "Easy Clean Emulsion White",
        billStatus: "Pending",
        plannedDate: "2026-05-20",
        billNo: "",
        qty: 80,
        leadTime: "2 Days",
        typeOfBill: "GST Tax Invoice",
        billAmount: 48000,
        discountAmount: 1200,
        paymentType: "Part Payment",
        advanceAmount: 0,
        photoOfBill: "",
        transportationInclude: "Yes",
        transporterName: "Delhivery Surface",
        amount: 1800,
        challanNo: "CH-77821",
        challanImage: "",
        statusOfBill: "",
        billImage: "",
        timestamp: "2026-05-17T11:00:00.000Z"
      },
      {
        id: "LIFT-4091",
        indentNumber: "IND-6602",
        poNumber: "PO-2026-0610",
        vendorName: "Polycab Wires Ltd",
        projectName: "Chinar Heights B",
        productName: "3-Core Copper Flexible Cable",
        billStatus: "Received",
        plannedDate: "2026-05-21",
        billNo: "BILL-2283",
        qty: 450,
        leadTime: "4 Days",
        typeOfBill: "GST Tax Invoice",
        billAmount: 185000,
        discountAmount: 5000,
        paymentType: "Immediate RTGS",
        advanceAmount: 50000,
        photoOfBill: "",
        transportationInclude: "Yes",
        transporterName: "Speed Safe Carriers",
        amount: 12000,
        challanNo: "CH-66029",
        challanImage: "",
        statusOfBill: "Ok",
        billImage: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500",
        timestamp: "2026-05-17T12:00:00.000Z"
      },
      {
        id: "LIFT-5120",
        indentNumber: "IND-5509",
        poNumber: "PO-2026-0504",
        vendorName: "Kirloskar Pumps",
        projectName: "Alambagh Metro Hub",
        productName: "10HP Submersible Pump",
        billStatus: "Pending",
        plannedDate: "2026-05-22",
        billNo: "",
        qty: 4,
        leadTime: "6 Days",
        typeOfBill: "GST Tax Invoice",
        billAmount: 142000,
        discountAmount: 3000,
        paymentType: "Credit - 30 Days",
        advanceAmount: 30000,
        photoOfBill: "",
        transportationInclude: "No",
        transporterName: "Self Picked",
        amount: 0,
        challanNo: "CH-55912",
        challanImage: "",
        statusOfBill: "",
        billImage: "",
        timestamp: "2026-05-17T13:00:00.000Z"
      },
      {
        id: "LIFT-6612",
        indentNumber: "IND-4481",
        poNumber: "PO-2026-0422",
        vendorName: "Havells India",
        projectName: "Sector-18 Corporate Tower",
        productName: "1200mm Premium Ceiling Fan",
        billStatus: "Received",
        plannedDate: "2026-05-23",
        billNo: "BILL-5502",
        qty: 35,
        leadTime: "1 Day",
        typeOfBill: "GST Tax Invoice",
        billAmount: 98000,
        discountAmount: 2000,
        paymentType: "Credit - 30 Days",
        advanceAmount: 0,
        photoOfBill: "",
        transportationInclude: "No",
        transporterName: "Professional Couriers",
        amount: 0,
        challanNo: "CH-44810",
        challanImage: "",
        statusOfBill: "Not Ok",
        billImage: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500",
        timestamp: "2026-05-17T14:00:00.000Z"
      }
    ];
    saveToStorage(STORAGE_KEYS.BILL_NOT_RECEIVED, dummy);
    return dummy;
  }
  return data;
};

export const saveBillNotReceived = (records) => saveToStorage(STORAGE_KEYS.BILL_NOT_RECEIVED, records);

export const updateBillNotReceived = (id, updates) => {
  const records = getBillNotReceived();
  const idx = records.findIndex(r => r.id === id || String(r.id) === String(id));
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...updates };
    saveBillNotReceived(records);
    return records[idx];
  }
  return null;
};

// --- Store Issues Operations ---
export const getStoreIssues = () => {
  const data = getFromStorage(STORAGE_KEYS.STORE_ISSUES);
  if (!data) {
    const dummy = [
      { id: "ISS-2026-901", date: "2026-05-10", issuedTo: "Ramesh Kumar (Supervisor)", department: "Civil Works", projectName: "Pratap Site A", itemName: "OPC 53 Cement", qty: 50, uom: "Bags", authorizedBy: "S. P. Singh (Project Manager)", remarks: "Issued for slab casting foundation" },
      { id: "ISS-2026-902", date: "2026-05-11", issuedTo: "Amit Singh (Foreman)", department: "Structure & Steel", projectName: "Gomti Nagar Extension", itemName: "TMT Fe 550 Rebars 12mm", qty: 4, uom: "MT", authorizedBy: "R. K. Verma (Technical Lead)", remarks: "Issued for column reinforcement" },
      { id: "ISS-2026-903", date: "2026-05-12", issuedTo: "Vinay Shukla (Site Engineer)", department: "Finishing & Paint", projectName: "Vrindavan Yojna Site", itemName: "Easy Clean Emulsion White", qty: 10, uom: "Liters", authorizedBy: "A. K. Mishra (HOD Works)", remarks: "Issued for lobby paint touchups" },
      { id: "ISS-2026-904", date: "2026-05-13", issuedTo: "Suresh Yadav (Electrical Head)", department: "Electrical", projectName: "Chinar Heights B", itemName: "3-Core Copper Flexible Cable", qty: 120, uom: "Meters", authorizedBy: "S. P. Singh (Project Manager)", remarks: "Issued for block-A wiring" },
      { id: "ISS-2026-905", date: "2026-05-14", issuedTo: "Kapil Dev (Plumbing Lead)", department: "Plumbing", projectName: "Alambagh Metro Hub", itemName: "10HP Submersible Pump", qty: 1, uom: "Nos", authorizedBy: "R. K. Verma (Technical Lead)", remarks: "Issued for main sump installation" },
      { id: "ISS-2026-906", date: "2026-05-15", issuedTo: "Mohit Sharma (Senior Mason)", department: "Masonry", projectName: "Charbagh Depot", itemName: "1200mm Premium Ceiling Fan", qty: 12, uom: "Nos", authorizedBy: "A. K. Mishra (HOD Works)", remarks: "Issued for labor quarters" }
    ];
    saveToStorage(STORAGE_KEYS.STORE_ISSUES, dummy);
    return dummy;
  }
  return data;
};

export const saveStoreIssues = (records) => saveToStorage(STORAGE_KEYS.STORE_ISSUES, records);

export const addStoreIssue = (record) => {
  const records = getStoreIssues();
  const newRecord = {
    ...record,
    id: `ISS-2026-${100 + records.length + 1}`
  };
  records.push(newRecord);
  saveStoreIssues(records);
  return newRecord;
};

// --- Store Returns Operations ---
export const getStoreReturns = () => {
  const data = getFromStorage(STORAGE_KEYS.STORE_RETURNS);
  if (!data) {
    const dummy = [
      { id: "RET-2026-401", date: "2026-05-13", originalSlipNo: "ISS-2026-901", returnedBy: "Ramesh Kumar (Supervisor)", itemName: "OPC 53 Cement", qty: 5, uom: "Bags", reason: "Unused excess material", condition: "Good - Resellable / Reissuable" },
      { id: "RET-2026-402", date: "2026-05-16", originalSlipNo: "ISS-2026-903", returnedBy: "Vinay Shukla (Site Engineer)", itemName: "Easy Clean Emulsion White", qty: 2, uom: "Liters", reason: "Leftover container seals intact", condition: "Perfect - Unopened" }
    ];
    saveToStorage(STORAGE_KEYS.STORE_RETURNS, dummy);
    return dummy;
  }
  return data;
};

export const saveStoreReturns = (records) => saveToStorage(STORAGE_KEYS.STORE_RETURNS, records);

export const addStoreReturn = (record) => {
  const records = getStoreReturns();
  const newRecord = {
    ...record,
    id: `RET-2026-${100 + records.length + 1}`
  };
  records.push(newRecord);
  saveStoreReturns(records);
  return newRecord;
};

// --- Perpetual Inventory Operations ---
export const getInventory = () => {
  const data = getFromStorage(STORAGE_KEYS.INVENTORY);
  if (!data) {
    const dummy = [
      { item: "OPC 53 Cement", firmName: "Pratap Engineering Site A", department: "Civil Works", groupHead: "Materials", uom: "Bags", status: "Active", indented: 500, approved: 500, purchaseReturn: 0, liftingQty: 450, inTransit: 50, issueReturn: 5, issued: 250, stTo: 20, stFrom: 10, quantity: 195, totalPrice: 74100 },
      { item: "TMT Fe 550 Rebars 12mm", firmName: "Gomti Nagar Extension", department: "Structure & Steel", groupHead: "Metals", uom: "MT", status: "Active", indented: 30, approved: 30, purchaseReturn: 0, liftingQty: 25, inTransit: 5, issueReturn: 0, issued: 18, stTo: 0, stFrom: 2, quantity: 9, totalPrice: 468000 },
      { item: "Easy Clean Emulsion White", firmName: "Vrindavan Yojna Site", department: "Finishing & Paint", groupHead: "Chemicals", uom: "Liters", status: "Active", indented: 200, approved: 200, purchaseReturn: 2, liftingQty: 180, inTransit: 0, issueReturn: 2, issued: 95, stTo: 10, stFrom: 0, quantity: 75, totalPrice: 26250 },
      { item: "3-Core Copper Flexible Cable", firmName: "Chinar Heights B", department: "Electrical", groupHead: "Cables", uom: "Meters", status: "Active", indented: 1000, approved: 1000, purchaseReturn: 0, liftingQty: 800, inTransit: 200, issueReturn: 10, issued: 450, stTo: 50, stFrom: 20, quantity: 330, totalPrice: 39600 },
      { item: "10HP Submersible Pump", firmName: "Alambagh Metro Hub", department: "Plumbing", groupHead: "Machinery", uom: "Nos", status: "Critical", indented: 5, approved: 5, purchaseReturn: 0, liftingQty: 4, inTransit: 1, issueReturn: 0, issued: 3, stTo: 0, stFrom: 0, quantity: 1, totalPrice: 85000 },
      { item: "1200mm Premium Ceiling Fan", firmName: "Sector-18 Corporate Tower", department: "Electrical", groupHead: "Appliances", uom: "Nos", status: "Active", indented: 120, approved: 120, purchaseReturn: 0, liftingQty: 100, inTransit: 20, issueReturn: 0, issued: 60, stTo: 10, stFrom: 5, quantity: 35, totalPrice: 98000 },
      { item: "3 Phase AC Contractor", firmName: "Hazratganj Plaza", department: "Electrical", groupHead: "Spares", uom: "Nos", status: "Active", indented: 25, approved: 25, purchaseReturn: 0, liftingQty: 20, inTransit: 5, issueReturn: 0, issued: 12, stTo: 2, stFrom: 0, quantity: 6, totalPrice: 27000 },
      { item: "Rapid Hardening Cement", firmName: "Charbagh Depot", department: "Civil Works", groupHead: "Materials", uom: "Bags", status: "Active", indented: 300, approved: 300, purchaseReturn: 0, liftingQty: 280, inTransit: 20, issueReturn: 0, issued: 210, stTo: 15, stFrom: 5, quantity: 60, totalPrice: 25200 }
    ];
    saveToStorage(STORAGE_KEYS.INVENTORY, dummy);
    return dummy;
  }
  return data;
};

export const saveInventory = (records) => saveToStorage(STORAGE_KEYS.INVENTORY, records);

// --- Quotation/Enquiry History Operations ---
export const getQuotationHistory = () => {
  const data = getFromStorage(STORAGE_KEYS.QUOTATION_HISTORY);
  if (!data) {
    const dummy = [
      {
        timestamp: "2026-05-12T10:30:00.000Z",
        quatationNo: "QT-001",
        supplierName: "Reliance Industries",
        adreess: "Reliance Corporate Park, Navi Mumbai",
        gst: "22AAAAR1234A1Z1",
        indentNo: "IND-2026-001",
        product: "OPC 53 Cement",
        description: "High early strength 53 grade OPC",
        qty: "500",
        unit: "Bags",
        pdfLink: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        firm: "Pratap Engineering Site A",
        firm_id: "FIRM-A",
        token: "session-uuid-1111",
        responded_at: "2026-05-13T12:00:00.000Z",
        vendor_rate: 420
      },
      {
        timestamp: "2026-05-12T10:30:00.000Z",
        quatationNo: "QT-001",
        supplierName: "Infosys Tech",
        adreess: "Infosys Tech HQ, Bangalore",
        gst: "29BBBBB5678B2Z2",
        indentNo: "IND-2026-001",
        product: "OPC 53 Cement",
        description: "High early strength 53 grade OPC",
        qty: "500",
        unit: "Bags",
        pdfLink: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        firm: "Pratap Engineering Site A",
        firm_id: "FIRM-A",
        token: "session-uuid-2222",
        responded_at: null,
        vendor_rate: null
      },
      {
        timestamp: "2026-05-15T14:45:00.000Z",
        quatationNo: "QT-002",
        supplierName: "Wipro Limited",
        adreess: "Wipro Campus, Doddakannelli, Bangalore",
        gst: "29CCCCC9012C3Z3",
        indentNo: "IND-2026-003",
        product: "TMT Fe 550 Rebars 12mm",
        description: "High tensile steel reinforcement",
        qty: "30",
        unit: "MT",
        pdfLink: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        firm: "Gomti Nagar Extension",
        firm_id: "FIRM-B",
        token: "session-uuid-3333",
        responded_at: "2026-05-16T16:00:00.000Z",
        vendor_rate: 52000
      }
    ];
    saveToStorage(STORAGE_KEYS.QUOTATION_HISTORY, dummy);
    return dummy;
  }
  return data;
};

export const saveQuotationHistory = (records) => saveToStorage(STORAGE_KEYS.QUOTATION_HISTORY, records);

export const insertQuotationHistory = (rows) => {
  const history = getQuotationHistory();
  history.push(...rows);
  saveQuotationHistory(history);
  return history;
};

// --- Project Operations ---
export const getProjects = () => {
  return getFromStorage(STORAGE_KEYS.PROJECTS) || [];
};

export const saveProjects = (projects) => saveToStorage(STORAGE_KEYS.PROJECTS, projects);

export const saveProject = (project) => {
  const projects = getProjects();
  projects.push(project);
  saveProjects(projects);
  return project;
};

// --- Project Design Operations ---
export const getDesigns = () => {
  return getFromStorage(STORAGE_KEYS.DESIGNS) || [];
};

export const saveDesigns = (designs) => saveToStorage(STORAGE_KEYS.DESIGNS, designs);

export const getDesignByProject = (projectNo) => {
  const designs = getDesigns();
  const found = designs.find(d => d.projectNo === projectNo);
  return found ? found.rows : [];
};

export const saveDesignForProject = (projectNo, rows) => {
  const designs = getDesigns();
  const idx = designs.findIndex(d => d.projectNo === projectNo);
  const record = { projectNo, rows, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    designs[idx] = record;
  } else {
    designs.push(record);
  }
  saveDesigns(designs);
  return record;
};

export const updateProject = (updated) => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === updated.id);
  if (index !== -1) {
    projects[index] = updated;
    saveProjects(projects);
  }
};

export const deleteProject = (id) => {
  const projects = getProjects();
  const filtered = projects.filter(p => p.id !== id);
  saveProjects(filtered);
};

// --- Lead Operations ---
export const getLeads = () => {
  return getFromStorage(STORAGE_KEYS.LEADS) || [];
};

export const saveLeads = (leads) => saveToStorage(STORAGE_KEYS.LEADS, leads);

export const saveLead = (lead) => {
  const leads = getLeads();
  leads.push(lead);
  saveLeads(leads);
  return lead;
};

export const updateLead = (updated) => {
  const leads = getLeads();
  const index = leads.findIndex(l => l.id === updated.id);
  if (index !== -1) {
    leads[index] = updated;
    saveLeads(leads);
  }
};

export const deleteLead = (id) => {
  const leads = getLeads();
  const filtered = leads.filter(l => l.id !== id);
  saveLeads(filtered);
};

// --- Call Tracker Operations ---
// Every FormTracker save appends one log entry here. A lead's current status is
// derived from its most recent entry (see getLatestTrackerForLead in callTrackerConstants.js).
export const getCallTrackers = () => {
  return getFromStorage(STORAGE_KEYS.CALL_TRACKERS) || [];
};

export const saveCallTrackers = (trackers) => saveToStorage(STORAGE_KEYS.CALL_TRACKERS, trackers);

export const saveCallTracker = (tracker) => {
  const trackers = getCallTrackers();
  trackers.push(tracker);
  saveCallTrackers(trackers);
  return tracker;
};

export const deleteCallTracker = (id) => {
  const trackers = getCallTrackers();
  saveCallTrackers(trackers.filter(t => t.id !== id));
};

// --- Master Data Operations ---
// Lead Type / Lead Source / Lead Receiver / Caller Name lists that feed the
// Lead and Direct Lead form dropdowns (Lead Receiver / Caller Name filtered by Lead Type).
const makeMasterCrud = (storageKey) => {
  const getAll = () => getFromStorage(storageKey) || [];
  const saveAll = (rows) => saveToStorage(storageKey, rows);
  const create = (row) => {
    const rows = getAll();
    const nextSerialNo = rows.length > 0 ? Math.max(...rows.map(r => r.serialNo)) + 1 : 1;
    const record = { id: `${storageKey}-${Date.now()}`, serialNo: nextSerialNo, ...row };
    rows.push(record);
    saveAll(rows);
    return record;
  };
  const update = (updated) => {
    const rows = getAll();
    const index = rows.findIndex(r => r.id === updated.id);
    if (index !== -1) {
      rows[index] = updated;
      saveAll(rows);
    }
  };
  const remove = (id) => {
    const rows = getAll();
    saveAll(rows.filter(r => r.id !== id));
  };
  return { getAll, saveAll, create, update, remove };
};

const leadTypeCrud = makeMasterCrud(STORAGE_KEYS.MASTER_LEAD_TYPES);
export const getLeadTypesMaster = leadTypeCrud.getAll;
export const createLeadTypeMaster = leadTypeCrud.create;
export const updateLeadTypeMaster = leadTypeCrud.update;
export const deleteLeadTypeMaster = leadTypeCrud.remove;

const leadSourceCrud = makeMasterCrud(STORAGE_KEYS.MASTER_LEAD_SOURCES);
export const getLeadSourcesMaster = leadSourceCrud.getAll;
export const createLeadSourceMaster = leadSourceCrud.create;
export const updateLeadSourceMaster = leadSourceCrud.update;
export const deleteLeadSourceMaster = leadSourceCrud.remove;

const leadReceiverCrud = makeMasterCrud(STORAGE_KEYS.MASTER_LEAD_RECEIVERS);
export const getLeadReceiversMaster = leadReceiverCrud.getAll;
export const createLeadReceiverMaster = leadReceiverCrud.create;
export const updateLeadReceiverMaster = leadReceiverCrud.update;
export const deleteLeadReceiverMaster = leadReceiverCrud.remove;

const callerNameCrud = makeMasterCrud(STORAGE_KEYS.MASTER_CALLER_NAMES);
export const getCallerNamesMaster = callerNameCrud.getAll;
export const createCallerNameMaster = callerNameCrud.create;
export const updateCallerNameMaster = callerNameCrud.update;
export const deleteCallerNameMaster = callerNameCrud.remove;

// Product Type (Mutual Fund / Real Estate / Insurance) and Requirement (Real Estate) masters —
// feed the Lead form's Product Type / Sub Product Type / Requirement dropdowns per Lead Type.
const mutualFundProductCrud = makeMasterCrud(STORAGE_KEYS.MASTER_MUTUAL_FUND_PRODUCTS);
export const getMutualFundProductsMaster = mutualFundProductCrud.getAll;
export const createMutualFundProductMaster = mutualFundProductCrud.create;
export const updateMutualFundProductMaster = mutualFundProductCrud.update;
export const deleteMutualFundProductMaster = mutualFundProductCrud.remove;

const realEstateProductCrud = makeMasterCrud(STORAGE_KEYS.MASTER_REAL_ESTATE_PRODUCTS);
export const getRealEstateProductsMaster = realEstateProductCrud.getAll;
export const createRealEstateProductMaster = realEstateProductCrud.create;
export const updateRealEstateProductMaster = realEstateProductCrud.update;
export const deleteRealEstateProductMaster = realEstateProductCrud.remove;

const realEstateRequirementCrud = makeMasterCrud(STORAGE_KEYS.MASTER_REAL_ESTATE_REQUIREMENTS);
export const getRealEstateRequirementsMaster = realEstateRequirementCrud.getAll;
export const createRealEstateRequirementMaster = realEstateRequirementCrud.create;
export const updateRealEstateRequirementMaster = realEstateRequirementCrud.update;
export const deleteRealEstateRequirementMaster = realEstateRequirementCrud.remove;

const insuranceProductCrud = makeMasterCrud(STORAGE_KEYS.MASTER_INSURANCE_PRODUCTS);
export const getInsuranceProductsMaster = insuranceProductCrud.getAll;
export const createInsuranceProductMaster = insuranceProductCrud.create;
export const updateInsuranceProductMaster = insuranceProductCrud.update;
export const deleteInsuranceProductMaster = insuranceProductCrud.remove;

const insuranceSubProductCrud = makeMasterCrud(STORAGE_KEYS.MASTER_INSURANCE_SUB_PRODUCTS);
export const getInsuranceSubProductsMaster = insuranceSubProductCrud.getAll;
export const createInsuranceSubProductMaster = insuranceSubProductCrud.create;
export const updateInsuranceSubProductMaster = insuranceSubProductCrud.update;
export const deleteInsuranceSubProductMaster = insuranceSubProductCrud.remove;

const investmentBudgetCrud = makeMasterCrud(STORAGE_KEYS.MASTER_INVESTMENT_BUDGETS);
export const getInvestmentBudgetsMaster = investmentBudgetCrud.getAll;
export const createInvestmentBudgetMaster = investmentBudgetCrud.create;
export const updateInvestmentBudgetMaster = investmentBudgetCrud.update;
export const deleteInvestmentBudgetMaster = investmentBudgetCrud.remove;

// --- Material Requirement Operations ---
export const getReqMaterials = () => {
  return getFromStorage(STORAGE_KEYS.MATERIAL_REQUIREMENTS) || [];
};

export const saveReqMaterials = (data) => saveToStorage(STORAGE_KEYS.MATERIAL_REQUIREMENTS, data);

export const saveReqMaterial = (indent) => {
  const data = getReqMaterials();
  data.push(indent);
  saveReqMaterials(data);
  return indent;
};

// --- Design Execution Entry Operations ---
export const getExecutions = () => {
  return getFromStorage(STORAGE_KEYS.EXECUTIONS) || [];
};

export const saveExecutions = (data) => saveToStorage(STORAGE_KEYS.EXECUTIONS, data);

export const saveExecution = (entry) => {
  const data = getExecutions();
  data.push(entry);
  saveExecutions(data);
  return entry;
};

// --- Design Actual Measurement Operations ---
export const getActuals = () => {
  return getFromStorage(STORAGE_KEYS.ACTUALS) || [];
};

export const saveActuals = (data) => saveToStorage(STORAGE_KEYS.ACTUALS, data);

export const saveActual = (entry) => {
  const data = getActuals();
  data.push(entry);
  saveActuals(data);
  return entry;
};

