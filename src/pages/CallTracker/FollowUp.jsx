import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, ShieldCheck, TrendingUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { leadApi } from '../../api/leadApi';
import { callTrackerApi } from '../../api/callTrackerApi';
import { masterApi } from '../../api/masterApi';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin, matchesUserAssignment, hasFullAccess, getUserLeadTypeScope } from '../../utils/authUtils';
import CallTrackerCategoryView from './CallTrackerCategoryView';
import Direct from './Direct';

/**
 * FollowUp (Call Tracker)
 * Neat and clean single-row UI with tabs (Real Estate, Insurance, Mutual Fund)
 * and all action/filter buttons in a single row.
 * Accurate live record counts on tabs matching lead category definitions.
 */
export default function FollowUp() {
  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'callTracker');
  // Tab / filter handed over from a Dashboard card, e.g. { tab: 'Insurance', statusFilter: 'Interested' }
  const navState = useLocation().state || {};

  // Determine initial tab from the Dashboard card, else the user's assigned lead type
  const initialTab = useMemo(() => {
    if (navState.tab) return navState.tab;
    if (user?.leadType) {
      const norm = user.leadType.toLowerCase();
      if (norm.includes('insurance')) return 'Insurance';
      if (norm.includes('mutual')) return 'Mutual Fund';
      if (norm.includes('real') || norm.includes('estate')) return 'Real Estate';
    }
    return 'Real Estate';
  }, [user]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // Opened again while already on this page (e.g. a navbar notification) — follow its tab
  useEffect(() => {
    if (navState.tab) setActiveTab(navState.tab);
  }, [navState.tab, navState.openRemarkNonce]);

  const [allLeads, setAllLeads] = useState([]);
  const [allTrackers, setAllTrackers] = useState([]);
  const [allVisitorFollowUps, setAllVisitorFollowUps] = useState([]);
  const [callersMaster, setCallersMaster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDirectForm, setShowDirectForm] = useState(false);

  // Load all leads, call trackers, visitor follow-ups, and caller master data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leads, trackers, callers, visitorFollowUps] = await Promise.all([
        leadApi.getLeads(),
        callTrackerApi.getCallTrackers(),
        masterApi.getCallerNames(),
        siteVisitMeetingApi.getVisitorFollowUps().catch(() => [])
      ]);
      setAllLeads(leads || []);
      setAllTrackers(trackers || []);
      setCallersMaster(callers || []);
      setAllVisitorFollowUps(visitorFollowUps || []);
    } catch (err) {
      console.error('Error loading Call Tracker data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  // Filter leads matching current user assignment permissions
  const accessibleLeads = useMemo(() => {
    const isAdmin = isUserAdmin(user);
    return allLeads.filter(lead => {
      if (!isAdmin && !matchesUserAssignment(lead, user)) {
        return false;
      }
      return true;
    });
  }, [allLeads, user]);

  // Categorize leads accurately using the standard leadType & leadNo prefixes
  const realEstateLeads = useMemo(() => {
    return accessibleLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('real') || type.includes('estate') || (l.leadNo && String(l.leadNo).startsWith('LR'));
    });
  }, [accessibleLeads]);

  const insuranceLeads = useMemo(() => {
    return accessibleLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('insurance') || (l.leadNo && String(l.leadNo).startsWith('LI'));
    });
  }, [accessibleLeads]);

  const mutualFundLeads = useMemo(() => {
    return accessibleLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('mutual') || type.includes('fund') || (l.leadNo && String(l.leadNo).startsWith('LM'));
    });
  }, [accessibleLeads]);

  // Tab configurations
  const allTabs = [
    { key: 'Real Estate', label: 'Real Estate', icon: Building2 },
    { key: 'Insurance', label: 'Insurance', icon: ShieldCheck },
    { key: 'Mutual Fund', label: 'Mutual Fund', icon: TrendingUp }
  ];
  // Role USER only gets the tab of their own lead type
  const userLeadCategory = getUserLeadTypeScope(user)?.category;
  const tabs = userLeadCategory ? allTabs.filter(t => t.key === userLeadCategory) : allTabs;

  // Live accurate counts matching the exact number of leads in each tab
  const categoryCounts = useMemo(() => ({
    'Real Estate': realEstateLeads.length,
    'Insurance': insuranceLeads.length,
    'Mutual Fund': mutualFundLeads.length
  }), [realEstateLeads.length, insuranceLeads.length, mutualFundLeads.length]);

  // Leads for the active category tab
  const currentCategoryLeads = useMemo(() => {
    if (activeTab === 'Insurance') return insuranceLeads;
    if (activeTab === 'Mutual Fund') return mutualFundLeads;
    return realEstateLeads;
  }, [activeTab, realEstateLeads, insuranceLeads, mutualFundLeads]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category View Panel containing the Single Row Toolbar + Data Table */}
      <CallTrackerCategoryView
        category={activeTab}
        tabs={tabs}
        activeTab={activeTab}
        initialStatusFilter={navState.statusFilter}
        openRemarkLeadId={navState.openRemarkLeadId}
        openRemarkNonce={navState.openRemarkNonce}
        onTabChange={setActiveTab}
        categoryCounts={categoryCounts}
        leads={currentCategoryLeads}
        trackers={allTrackers}
        visitorFollowUps={allVisitorFollowUps}
        loading={loading}
        callersMaster={callersMaster}
        canEdit={canEdit}
        onRefresh={loadData}
        onOpenDirect={(tab) => {
          if (tab) setActiveTab(tab);
          setShowDirectForm(true);
        }}
      />

      {/* Direct Lead Entry Modal */}
      <Direct
        isOpen={showDirectForm}
        onClose={() => setShowDirectForm(false)}
        onSaved={loadData}
        defaultLeadType={activeTab}
      />
    </div>
  );
}
