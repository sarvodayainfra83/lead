import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, ShieldCheck, TrendingUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { leadApi } from '../../api/leadApi';
import { callTrackerApi } from '../../api/callTrackerApi';
import { masterApi } from '../../api/masterApi';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { useAuthStore } from '../../store/authStore';
import { refreshBadgeCounts } from '../../store/badgeCountStore';
import { isUserAdmin, matchesUserConnection, hasFullAccess, getUserLeadTypeScope } from '../../utils/authUtils';
import { isDirectSiteVisitLead, buildCalledLeadKeys, isInFollowUpQueue } from './callTrackerConstants';
import CallTrackerCategoryView from './CallTrackerCategoryView';
import Direct from './Direct';
import BulkUploadLead from '../Lead/BulkUploadLead';

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
    const scope = getUserLeadTypeScope(user);
    if (scope?.categories?.length > 0) return scope.categories[0];
    if (user?.leadType) {
      const norm = user.leadType.toLowerCase();
      if (norm.includes('insurance')) return 'Insurance';
      if (norm.includes('mutual')) return 'Mutual Fund';
      if (norm.includes('real') || norm.includes('estate')) return 'Real Estate';
    }
    return 'Real Estate';
  }, [user, navState.tab]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // Opened again while already on this page (e.g. a navbar notification) — follow its tab
  useEffect(() => {
    if (navState.tab) setActiveTab(navState.tab);
  }, [navState.tab, navState.openRemarkNonce]);

  const [allLeads, setAllLeads] = useState([]);
  const [allTrackers, setAllTrackers] = useState([]);
  const [allVisitorFollowUps, setAllVisitorFollowUps] = useState([]);
  const [allAssignedVisitors, setAllAssignedVisitors] = useState([]);
  const [callersMaster, setCallersMaster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDirectForm, setShowDirectForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Load all leads, call trackers, visitor follow-ups, assigned visitors, and caller master data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leads, trackers, callers, visitorFollowUps, assignedVisitors] = await Promise.all([
        leadApi.getLeads(),
        callTrackerApi.getCallTrackers(),
        masterApi.getCallerNames(),
        siteVisitMeetingApi.getVisitorFollowUps().catch(() => []),
        siteVisitMeetingApi.getAssignedVisitors().catch(() => [])
      ]);
      setAllLeads(leads || []);
      setAllTrackers(trackers || []);
      setCallersMaster(callers || []);
      setAllVisitorFollowUps(visitorFollowUps || []);
      setAllAssignedVisitors(assignedVisitors || []);
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
  // Direct site visit leads created through Add Lead are handled exclusively in Site Visit / Meeting
  const accessibleLeads = useMemo(() => {
    const isAdmin = isUserAdmin(user);
    const calledLeadKeys = buildCalledLeadKeys(allTrackers);
    return allLeads.filter(lead => {
      if (isDirectSiteVisitLead(lead)) {
        return false;
      }
      // Unassigned leads still wait on the Lead page for a caller — keep only assigned/direct leads
      // (and any lead that already has call history)
      if (!isInFollowUpQueue(lead, calledLeadKeys)) {
        return false;
      }
      if (!isAdmin && !matchesUserConnection(lead, user)) {
        return false;
      }
      return true;
    });
  }, [allLeads, allTrackers, user]);

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
  // Role USER gets tabs of all their assigned lead types (both/all tabs if multiple)
  const scope = getUserLeadTypeScope(user);
  const tabs = scope?.categories?.length > 0
    ? allTabs.filter(t => scope.categories.includes(t.key))
    : (scope?.category ? allTabs.filter(t => t.key === scope.category) : allTabs);

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
        initialDateFilter={navState.dateFilter || (navState.statusFilter ? 'all' : 'today')}
        openRemarkLeadId={navState.openRemarkLeadId}
        openRemarkNonce={navState.openRemarkNonce}
        onTabChange={setActiveTab}
        categoryCounts={categoryCounts}
        leads={currentCategoryLeads}
        trackers={allTrackers}
        visitorFollowUps={allVisitorFollowUps}
        assignedVisitors={allAssignedVisitors}
        loading={loading}
        callersMaster={callersMaster}
        canEdit={canEdit}
        onRefresh={loadData}
        onOpenDirect={(tab) => {
          if (tab) setActiveTab(tab);
          setShowDirectForm(true);
        }}
        onBulkUpload={(tab) => {
          if (tab) setActiveTab(tab);
          setShowBulkUpload(true);
        }}
      />

      {/* Direct Lead Entry Modal */}
      <Direct
        isOpen={showDirectForm}
        onClose={() => setShowDirectForm(false)}
        onSaved={loadData}
        defaultLeadType={activeTab}
      />

      {/* Bulk Upload — imported leads are assigned to a caller so they land in this follow-up queue */}
      {showBulkUpload && (
        <BulkUploadLead
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          onImported={() => {
            loadData();
            refreshBadgeCounts();
          }}
          defaultLeadType={activeTab}
          assignCaller
        />
      )}
    </div>
  );
}
