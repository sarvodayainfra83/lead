/**
 * Utility functions for Role-Based Access Control and user assignment filtering.
 */

/**
 * Check if the given user has an ADMIN or TESTER role (case-insensitive).
 */
export const isUserAdmin = (user) => {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  return role === 'ADMIN' || role === 'TESTER';
};

/**
 * Check if the given user has a TESTER role (case-insensitive).
 */
export const isUserTester = (user) => {
  if (!user) return false;
  return (user.role || '').toUpperCase() === 'TESTER';
};

/**
 * Check if the given user has an HR role or position (case-insensitive).
 */
export const isUserHR = (user) => {
  if (!user) return false;
  return (user.role || '').toUpperCase() === 'HR' || (user.position || '').toUpperCase() === 'HR';
};

/**
 * Check if an item (lead, call tracker, customer record, or caller string)
 * is assigned to the current user.
 * 
 * Rules:
 * - If user is ADMIN: always returns true (can see all data).
 * - If user is regular USER: checks if callerAssigned, caller, or leadReceiver
 *   matches user.name or user.id (username), case-insensitively.
 */
export const matchesUserAssignment = (itemOrCaller, user) => {
  if (!user) return false;
  if (isUserAdmin(user)) return true;

  const caller = typeof itemOrCaller === 'string'
    ? itemOrCaller
    : (itemOrCaller?.callerAssigned || itemOrCaller?.caller || '');

  const callerNorm = (caller || '').trim().toLowerCase();
  const userNameNorm = (user.name || '').trim().toLowerCase();
  const userIdNorm = (user.id || '').trim().toLowerCase();

  return Boolean(
    callerNorm && (callerNorm === userNameNorm || callerNorm === userIdNorm)
  );
};

/**
 * Specifically checks if an unassigned pending lead was created/received by this user.
 */
export const matchesUserReceiver = (lead, user) => {
  if (!user) return false;
  if (isUserAdmin(user)) return true;

  const receiver = (lead?.leadReceiver || '').trim().toLowerCase();
  const userNameNorm = (user.name || '').trim().toLowerCase();
  const userIdNorm = (user.id || '').trim().toLowerCase();

  return Boolean(
    receiver && (receiver === userNameNorm || receiver === userIdNorm)
  );
};

/**
 * Normalize a lead type name to one of 'Real Estate' | 'Insurance' | 'Mutual Fund' ('' if unknown).
 * Falls back to the Lead No prefix (LR / LI / LM) when no type name is available.
 */
export const getLeadCategory = (leadTypeName, leadNo = '') => {
  const type = String(leadTypeName || '').toLowerCase();
  const no = String(leadNo || '').trim().toUpperCase();
  if (type.includes('insurance')) return 'Insurance';
  if (type.includes('mutual') || type.includes('fund')) return 'Mutual Fund';
  if (type.includes('real') || type.includes('estate')) return 'Real Estate';
  if (no.startsWith('LI')) return 'Insurance';
  if (no.startsWith('LM')) return 'Mutual Fund';
  if (no.startsWith('LR')) return 'Real Estate';
  return '';
};

/**
 * Parse a comma-separated lead type string into an array of normalized categories:
 * e.g. "Real Estate, Insurance" -> ['Real Estate', 'Insurance']
 */
export const getUserLeadCategories = (leadTypeStr) => {
  if (!leadTypeStr) return [];
  const parts = String(leadTypeStr)
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const categories = [];
  for (const part of parts) {
    const cat = getLeadCategory(part);
    if (cat && !categories.includes(cat)) {
      categories.push(cat);
    }
  }
  return categories;
};

/**
 * The lead type a regular USER is restricted to, or null when they can see every type
 * (admins, and users who have no lead type set on their account).
 * Returns { categories: string[], category: string | null, leadTypeId: string | null } or null.
 */
export const getUserLeadTypeScope = (user) => {
  if (!user || isUserAdmin(user)) return null;
  const categories = getUserLeadCategories(user.leadType);
  if (categories.length > 0) {
    return {
      categories,
      category: categories.length === 1 ? categories[0] : null,
      leadTypeId: user.leadTypeId || null
    };
  }

  const category = getLeadCategory(user.leadType);
  if (category) {
    return {
      categories: [category],
      category,
      leadTypeId: user.leadTypeId || null
    };
  }

  if (user.leadTypeId) {
    return { categories: [], category: null, leadTypeId: user.leadTypeId };
  }

  return null;
};

/**
 * Check if a lead (or any record carrying leadType / leadTypeId / leadNo) belongs to the
 * lead type the user is allowed to see. Admins and users without a lead type see everything.
 */
export const matchesUserLeadType = (lead, user) => {
  const scope = getUserLeadTypeScope(user);
  if (!scope) return true;
  const leadCat = getLeadCategory(lead?.leadType, lead?.leadNo);
  if (scope.categories && scope.categories.length > 0) {
    return scope.categories.includes(leadCat);
  }
  if (scope.leadTypeId && lead?.leadTypeId) {
    return String(lead.leadTypeId) === String(scope.leadTypeId);
  }
  return Boolean(scope.category) && leadCat === scope.category;
};

/**
 * Check if the user has Full Access permission for a specific page.
 * Admins always have full access.
 */
export const hasFullAccess = (user, pageKey) => getPageAccess(user, pageKey) === 'full';

/**
 * The access level ('none' | 'view' | 'full') a user has on a page. Deny by default:
 * - Admins: always 'full'.
 * - Users: ONLY what the admin explicitly granted in Setting → Page Access. A page that isn't
 *   listed for the user (e.g. a page added later) is 'none' — never a built-in default.
 * - Each page is checked on its own key (Assign Visitor and Visitor Follow Up no longer grant
 *   each other); 'master' and 'setting' are the same page. Legacy 'edit' is treated as 'full'.
 */
export const getPageAccess = (user, pageKey) => {
  if (!user) return 'none';
  if (isUserAdmin(user)) return 'full';
  const pages = (user.accessPages && typeof user.accessPages === 'object' && !Array.isArray(user.accessPages))
    ? user.accessPages
    : {};

  let level;
  if (pageKey === 'master' || pageKey === 'setting') {
    level = pages.master ?? pages.setting;
  } else if (pageKey === 'assignVisitor' || pageKey === 'visitorFollowUp') {
    // Old accounts stored one shared 'siteVisitMeeting' level for both visitor pages
    level = pages[pageKey] ?? pages.siteVisitMeeting;
  } else {
    level = pages[pageKey];
  }

  if (level === 'edit') return 'full';
  if (level === 'full' || level === 'view') return level;

  // HR users default to full access for Attendance & Attendance Report unless explicitly set to 'none'
  if (isUserHR(user) && (pageKey === 'attendance' || pageKey === 'attendanceReport')) {
    return level === 'none' ? 'none' : 'full';
  }

  return 'none';
};

/** Can the user open the page at all (view or full)? */
export const canViewPage = (user, pageKey) => getPageAccess(user, pageKey) !== 'none';
