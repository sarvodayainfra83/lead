/**
 * Utility functions for Role-Based Access Control and user assignment filtering.
 */

/**
 * Check if the given user has an ADMIN role (case-insensitive).
 */
export const isUserAdmin = (user) => {
  if (!user) return false;
  return (user.role || '').toUpperCase() === 'ADMIN';
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
 * Check if the user has Full Access permission for a specific page.
 * Admins always have full access.
 */
export const hasFullAccess = (user, pageKey) => {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  return user.accessPages?.[pageKey] === 'full';
};
