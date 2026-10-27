import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, ShieldCheck, TrendingUp, CalendarClock } from 'lucide-react';
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
    { key: 'Real Estate', label: 'Real Estate', icon: Building2 },
    { key: 'Insurance', label: 'Insurance', icon: ShieldCheck },
    { key: 'Mutual Fund', label: 'Mutual Fund', icon: TrendingUp }
  ];
  // Role USER gets tabs of all their assigned lead types (both/all tabs if multiple)
  const scope = getUserLeadTypeScope(user);
  const tabs = scope?.categories?.length > 0
    ? allTabs.filter(t => scope.categories.includes(t.key))
    : (scope?.category ? allTabs.filter(t => t.key === scope.category) : allTabs);

  // Live accurate counts matching the exact number of follow-up queue leads in each tab
  const categoryCounts = useMemo(() => {
    const callCount = (list) => list.filter(l => l.inCallList).length;
    return {
      'Real Estate': callCount(realEstateLeads),
      'Insurance': callCount(insuranceLeads),
      'Mutual Fund': callCount(mutualFundLeads)
    };
  }, [realEstateLeads, insuranceLeads, mutualFundLeads]);

  // Leads for the active category tab
  const currentCategoryLeads = useMemo(() => {
    if (activeTab === 'Insurance') return insuranceLeads;
    if (activeTab === 'Mutual Fund') return mutualFundLeads;
    return realEstateLeads;
  }, [activeTab, realEstateLeads, insuranceLeads, mutualFundLeads]);

  // While viewing Today's Followups with a known breakdown, show each tab's count for TODAY instead of
  // its all-time total — otherwise a tab reading "Real Estate 278" next to "Today's Followup 10/10" looks
  // like the whole 278 is today's, when only a fraction of today's leads are even in this category.
  const displayedCategoryCounts = useMemo(() => {
    if (activeDateFilter === 'today' && todayLeadsBreakdown) {
      return {
        'Real Estate': todayLeadsBreakdown['Real Estate'] ?? 0,
        'Insurance': todayLeadsBreakdown['Insurance'] ?? 0,
        'Mutual Fund': todayLeadsBreakdown['Mutual Fund'] ?? 0
      };
    }
    return categoryCounts;
  }, [activeDateFilter, todayLeadsBreakdown, categoryCounts]);

  // Explains the split only when today's leads actually span more than one category — otherwise there's
  // nothing to clarify and the banner would just be noise.
  const todayBreakdownBanner = useMemo(() => {
    if (activeDateFilter !== 'today' || !todayLeadsBreakdown) return null;
    const entries = tabs.map(t => ({ key: t.key, label: t.label, count: todayLeadsBreakdown[t.key] ?? 0 }));
    if (entries.filter(e => e.count > 0).length <= 1) return null;
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    const current = entries.find(e => e.key === activeTab);
    const others = entries.filter(e => e.key !== activeTab && e.count > 0);
    return { total, current, others };
  }, [activeDateFilter, todayLeadsBreakdown, tabs, activeTab]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Explains a combined "Today's Leads" total that spans multiple categories, since only the active tab's slice is ever shown below */}
      {todayBreakdownBanner && (
        <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs sm:text-sm text-sky-800">
          <CalendarClock size={15} className="mt-0.5 shrink-0 text-sky-500" />
          <span>
            <strong>{todayBreakdownBanner.total}</strong> leads are due today across Real Estate, Insurance &amp; Mutual Fund — this tab shows{' '}
            <strong>{activeTab}</strong>'s {todayBreakdownBanner.current?.count ?? 0}.
            {todayBreakdownBanner.others.length > 0 && (
              <> Switch tabs for {todayBreakdownBanner.others.map(o => `${o.label} (${o.count})`).join(' · ')}.</>
            )}
          </span>
        </div>
      )}

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
