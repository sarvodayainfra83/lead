import { authApi } from './authApi';
import { masterApi } from './masterApi';
import { leadApi } from './leadApi';
import { callTrackerApi } from './callTrackerApi';

export const settingApi = {
  // Get users for settings table
  async getUsers() {
    return authApi.getUsers();
  },

  // Update user role or page permissions
  async updateUserAccess(userIdCode, accessPages, role = null) {
    const users = await authApi.getUsers();
    const existing = users.find(u => u.id === userIdCode);
    if (!existing) throw new Error('User not found');

    const updatedUser = {
      ...existing,
      accessPages: accessPages !== null ? accessPages : existing.accessPages,
      role: role || existing.role
    };

    return authApi.saveUser(updatedUser);
  },

  // Save new user
  async saveUser(userData) {
    return authApi.saveUser(userData);
  },

  // Delete user
  async deleteUser(userIdCode) {
    return authApi.deleteUser(userIdCode);
  },

  // Export full system backup JSON
  async exportFullBackup() {
    const [users, leadTypes, leadSources, leadReceivers, callerNames, leads, callTrackers] = await Promise.all([
      authApi.getUsers(),
      masterApi.getLeadTypes(),
      masterApi.getLeadSources(),
      masterApi.getLeadReceivers(),
      masterApi.getCallerNames(),
      leadApi.getLeads(),
      callTrackerApi.getCallTrackers()
    ]);

    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        users,
        masterData: {
          leadTypes,
          leadSources,
          leadReceivers,
          callerNames
        },
        leads,
        callTrackers
      }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sarvodaya_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
};
