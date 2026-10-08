let refreshCallback = null;

/**
 * Register the store refresh function.
 * Avoids circular dependencies between API modules and Zustand badgeCountStore.
 */
export const registerBadgeRefresh = (fn) => {
  refreshCallback = fn;
};

/**
 * Trigger badge counts refresh across all components and sidebar badges.
 */
export const refreshBadgeCounts = () => {
  if (typeof refreshCallback === 'function') {
    try {
      refreshCallback();
    } catch (e) {
      console.warn('Error executing badge refresh:', e);
    }
  }
};
