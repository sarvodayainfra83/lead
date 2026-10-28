import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, ShieldCheck, TrendingUp, Layers } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { leadApi } from '../../api/leadApi';
import { callTrackerApi } from '../../api/callTrackerApi';
import { masterApi } from '../../api/masterApi';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { useAuthStore } from '../../store/authStore';
import { refreshBadgeCounts } from '../../store/badgeCountStore';
import { isUserAdmin, isUserReceptionist, matchesUserConnection, hasFullAccess, getUserLeadTypeScope } from '../../utils/authUtils';
import { isDirectSiteVisitLead, buildCalledLeadKeys, isInFollowUpQueue } from './callTrackerConstants';
import CallTrackerCategoryView from './CallTrackerCategoryView';
import Direct from './Direct';
import BulkUploadLead from '../Lead/BulkUploadLead';

/**
 * FollowUp (Call Tracker)
 * Neat and clean single-row UI with tabs (All, Real Estate, Insurance, Mutual Fund)
 * and all action/filter buttons in a single row.
 * Accurate live record counts on tabs matching lead category definitions.
 */
export default function FollowUp() {
  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'callTracker');
  // Tab / filter handed over from a Dashboard card, e.g. { tab: 'All', dateFilter: 'today' }
  const navState = useLocation().state || {};

  // Only include 'All' tab when explicitly requested from Dashboard (e.g. Today's Leads KPI)
  // Direct navigation from Sidebar should not show 'All'.
  const allowAllTab = Boolean(navState.showAllTab || navState.tab === 'All');

  // Determine initial tab: 'All' if coming from Dashboard Today's Leads, else standard category
  const initialTab = useMemo(() => {
    if (navState.tab && (navState.tab !== 'All' || allowAllTab)) return navState.tab;
    if (allowAllTab) return 'All';
    const scope = getUserLeadTypeScope(user);
    if (scope?.categories?.length === 1) return scope.categories[0];
    if (scope?.category) return scope.category;
    if (user?.leadType) {
      const norm = user.leadType.toLowerCase();
      if (norm.includes('insurance')) return 'Insurance';
      if (norm.includes('mutual')) return 'Mutual Fund';
      if (norm.includes('real') || norm.includes('estate')) return 'Real Estate';
    }
    return 'Real Estate';
  }, [user, navState.tab, allowAllTab]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // Opened again while already on this page (e.g. a navbar notification, sidebar link, or dashboard click)
  useEffect(() => {
    if (navState.tab && (navState.tab !== 'All' || allowAllTab)) {
      setActiveTab(navState.tab);
    } else if (allowAllTab) {
      setActiveTab('All');
    } else {
      const scope = getUserLeadTypeScope(user);
      if (scope?.categories?.length === 1) setActiveTab(scope.categories[0]);
      else if (scope?.category) setActiveTab(scope.category);
      else setActiveTab('Real Estate');
    }
  }, [navState.tab, navState.showAllTab, navState.openRemarkNonce, user, allowAllTab]);

  // Per-category split of the Dashboard's combined "Today's Leads" count, e.g. { 'Real Estate': 10, 'Insurance': 20, 'Mutual Fund': 6 }
  // — handed over only when arriving from that KPI card, so a single category tab can explain where the rest of the total went.
  const todayLeadsBreakdown = navState.todayLeadsBreakdown;
  // Mirrors CallTrackerCategoryView's own dateFilter state, reported back up via onDateFilterChange
  const [activeDateFilter, setActiveDateFilter] = useState(navState.dateFilter || 'today');

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

  // Every lead, tagged with the list(s) it belongs to:
  //  - inCallList: the Lead & Followup queue — assigned/direct leads (or any with call history), never
  //    Direct Site Visit leads (those are handled exclusively in Site Visit / Meeting)
  //  - inSiteVisitList: leads the Site Visit / Meeting page lists
  // All Dates shows every lead (same total as the Dashboard); the other date filters show the call list only.
  const taggedLeads = useMemo(() => {
    const isAdmin = isUserAdmin(user);
    const isReceptionist = isUserReceptionist(user);
    const isGlobal = isAdmin || isReceptionist;
    const calledLeadKeys = buildCalledLeadKeys(allTrackers);
    const siteVisitIds = new Set(
      siteVisitMeetingApi.buildSiteVisitMeetingLeads(allLeads, allTrackers, allAssignedVisitors, allVisitorFollowUps)
        .map(l => String(l.leadId ?? l.id))
    );
    return allLeads.map(lead => ({
      ...lead,
      inCallList: isGlobal
        ? true
        : (!isDirectSiteVisitLead(lead) &&
            isInFollowUpQueue(lead, calledLeadKeys) &&
            matchesUserConnection(lead, user)),
      inSiteVisitList: isDirectSiteVisitLead(lead) || siteVisitIds.has(String(lead.id))
    }));
  }, [allLeads, allTrackers, allAssignedVisitors, allVisitorFollowUps, user]);

  // Categorize leads accurately using the standard leadType & leadNo prefixes
  const realEstateLeads = useMemo(() => {
    return taggedLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('real') || type.includes('estate') || (l.leadNo && String(l.leadNo).startsWith('LR'));
    });
  }, [taggedLeads]);

  const insuranceLeads = useMemo(() => {
    return taggedLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('insurance') || (l.leadNo && String(l.leadNo).startsWith('LI'));
    });
  }, [taggedLeads]);

  const mutualFundLeads = useMemo(() => {
    return taggedLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('mutual') || type.includes('fund') || (l.leadNo && String(l.leadNo).startsWith('LM'));
    });
  }, [taggedLeads]);

  // Tab configurations
  const allTabs = [
    { key: 'All', label: 'All', icon: Layers },
    { key: 'Real Estate', label: 'Real Estate', icon: Building2 },
    { key: 'Insurance', label: 'Insurance', icon: ShieldCheck },
    { key: 'Mutual Fund', label: 'Mutual Fund', icon: TrendingUp }
  ];
  // Role USER gets tabs of all their assigned lead types (both/all tabs if multiple)
  const scope = getUserLeadTypeScope(user);
  const showAllTab = allowAllTab && (isUserAdmin(user) || isUserReceptionist(user) || (scope?.categories?.length > 1));
  const categoryTabs = scope?.categories?.length > 0
    ? allTabs.filter(t => t.key !== 'All' && scope.categories.includes(t.key))
    : (scope?.category ? allTabs.filter(t => t.key === scope.category) : allTabs.filter(t => t.key !== 'All'));
  const tabs = showAllTab ? [{ key: 'All', label: 'All', icon: Layers }, ...categoryTabs] : categoryTabs;

  // Live accurate counts matching the exact number of follow-up queue leads in each tab
  const categoryCounts = useMemo(() => {
    const callCount = (list) => list.filter(l => l.inCallList).length;
    const re = callCount(realEstateLeads);
    const ins = callCount(insuranceLeads);
    const mf = callCount(mutualFundLeads);
    return {
      'All': re + ins + mf,
      'Real Estate': re,
      'Insurance': ins,
      'Mutual Fund': mf
    };
  }, [realEstateLeads, insuranceLeads, mutualFundLeads]);

  // Leads for the active category tab (All shows all tagged leads across types)
  const currentCategoryLeads = useMemo(() => {
    if (activeTab === 'Insurance') return insuranceLeads;
    if (activeTab === 'Mutual Fund') return mutualFundLeads;
    if (activeTab === 'Real Estate') return realEstateLeads;
    return taggedLeads;
  }, [activeTab, realEstateLeads, insuranceLeads, mutualFundLeads, taggedLeads]);

  // While viewing Today's Followups with a known breakdown, show each tab's count for TODAY instead of
  // its all-time total — otherwise a tab reading "Real Estate 278" next to "Today's Followup 10/10" looks
  // like the whole 278 is today's, when only a fraction of today's leads are even in this category.
  const displayedCategoryCounts = useMemo(() => {
    if (activeDateFilter === 'today' && todayLeadsBreakdown) {
      const re = todayLeadsBreakdown['Real Estate'] ?? 0;
      const ins = todayLeadsBreakdown['Insurance'] ?? 0;
      const mf = todayLeadsBreakdown['Mutual Fund'] ?? 0;
      return {
        'All': re + ins + mf,
        'Real Estate': re,
        'Insurance': ins,
        'Mutual Fund': mf
      };
    }
    return categoryCounts;
  }, [activeDateFilter, todayLeadsBreakdown, categoryCounts]);

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Category View Panel containing the Single Row Toolbar + Data Table */}
      <CallTrackerCategoryView
        category={activeTab}
        tabs={tabs}
        activeTab={activeTab}
        initialStatusFilter={navState.statusFilter}
        initialDateFilter={navState.dateFilter || (navState.statusFilter ? 'all' : 'today')}
        initialStageFilter={navState.stageFilter}
        initialCalledOnly={Boolean(navState.calledOnly)}
        openRemarkLeadId={navState.openRemarkLeadId}
        openRemarkNonce={navState.openRemarkNonce}
        onTabChange={setActiveTab}
        onDateFilterChange={setActiveDateFilter}
        categoryCounts={displayedCategoryCounts}
        leads={taggedLeads}
        trackers={allTrackers}
        visitorFollowUps={allVisitorFollowUps}
        assignedVisitors={allAssignedVisitors}
        loading={loading}
        callersMaster={callersMaster}
        canEdit={canEdit}
        onRefresh={loadData}
        onOpenDirect={(tab) => {
          if (tab && tab !== 'All') setActiveTab(tab);
          setShowDirectForm(true);
        }}
        onBulkUpload={(tab) => {
          if (tab && tab !== 'All') setActiveTab(tab);
          setShowBulkUpload(true);
        }}
      />

      {/* Direct Lead Entry Modal */}
      <Direct
        isOpen={showDirectForm}
        onClose={() => setShowDirectForm(false)}
        onSaved={loadData}
        defaultLeadType={activeTab === 'All' ? 'Real Estate' : activeTab}
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
          defaultLeadType={activeTab === 'All' ? 'Real Estate' : activeTab}
          assignCaller
        />
      )}
    </div>
  );
}
