import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, ShieldCheck, TrendingUp } from 'lucide-react';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { masterApi } from '../../api/masterApi';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, getUserLeadTypeScope } from '../../utils/authUtils';
import SiteVisitCategoryView from './SiteVisitCategoryView';
import AssignVisitorModal from './AssignVisitorModal';
import VisitorFollowUpModal from './VisitorFollowUpModal';
import VisitHistoryModal from './VisitHistoryModal';
import { useLocation } from 'react-router-dom';

/**
 * SiteVisitMeeting
 * Unified interface merging Assign Visitor and Visitor Follow Up into a single
 * dedicated module with 3 category tabs:
 * - Real Estate
 * - Insurance
 * - Mutual Fund
 *
 * Displays all site visit and meeting leads with their complete lifecycle status:
 * Pending Assignment -> Visitor Assigned -> Future Plan -> Closed Won / Lost.
 */
export default function SiteVisitMeeting() {
  const user = useAuthStore(state => state.user);
  // Full Access on Site Visit / Meeting = can assign visitors & log follow-ups; View = read-only
  const canEdit = hasFullAccess(user, 'siteVisitMeeting');
  const navState = useLocation().state || {};

  // Determine initial tab from nav state or user's assigned lead type
  const initialTab = useMemo(() => {
    if (navState.tab) return navState.tab;
    if (user?.leadType) {
      const norm = user.leadType.toLowerCase();
      if (norm.includes('insurance')) return 'Insurance';
      if (norm.includes('mutual')) return 'Mutual Fund';
      if (norm.includes('real') || norm.includes('estate')) return 'Real Estate';
    }
    return 'Real Estate';
  }, [user, navState.tab]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [allLeads, setAllLeads] = useState([]);
  const [visitorsMaster, setVisitorsMaster] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [assignModalLead, setAssignModalLead] = useState(null);
  const [followUpModalLead, setFollowUpModalLead] = useState(null);
  const [historyModalLead, setHistoryModalLead] = useState(null);

  // Load all site visit / meeting leads and visitors
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leads, visitors] = await Promise.all([
        siteVisitMeetingApi.getAllSiteVisitMeetingLeads(),
        masterApi.getVisitors()
      ]);
      setAllLeads(leads || []);
      setVisitorsMaster(visitors || []);
    } catch (err) {
      console.error('Failed to load site visit / meeting leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  // Partition leads by the 3 category tables without restricting by caller name, username, or role
  const realEstateLeads = useMemo(() => {
    return allLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('real') || type.includes('estate') || (l.leadNo && l.leadNo.startsWith('LR'));
    });
  }, [allLeads]);

  const insuranceLeads = useMemo(() => {
    return allLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('insurance') || (l.leadNo && l.leadNo.startsWith('LI'));
    });
  }, [allLeads]);

  const mutualFundLeads = useMemo(() => {
    return allLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('mutual') || type.includes('fund') || (l.leadNo && l.leadNo.startsWith('LM'));
    });
  }, [allLeads]);

  // Tab configurations with live badge counters
  const tabs = [
    {
      key: 'Real Estate',
      label: 'Real Estate',
      icon: Building2,
      count: realEstateLeads.length,
      data: realEstateLeads,
      accent: 'border-amber-500 text-amber-600',
      activeBg: 'bg-amber-600 text-white border-amber-600 shadow-sm'
    },
    {
      key: 'Insurance',
      label: 'Insurance',
      icon: ShieldCheck,
      count: insuranceLeads.length,
      data: insuranceLeads,
      accent: 'border-sky-500 text-sky-600',
      activeBg: 'bg-sky-600 text-white border-sky-600 shadow-sm'
    },
    {
      key: 'Mutual Fund',
      label: 'Mutual Fund',
      icon: TrendingUp,
      count: mutualFundLeads.length,
      data: mutualFundLeads,
      accent: 'border-emerald-500 text-emerald-600',
      activeBg: 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
    }
  ];

  // Role USER only gets the tab of their own lead type
  const userLeadCategory = getUserLeadTypeScope(user)?.category;
  const visibleTabs = userLeadCategory ? tabs.filter(t => t.key === userLeadCategory) : tabs;

  const currentTabObj = visibleTabs.find(t => t.key === activeTab) || visibleTabs[0];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category View Panel */}
      <SiteVisitCategoryView
        key={currentTabObj.key}
        category={currentTabObj.key}
        tabs={visibleTabs}
        activeTab={currentTabObj.key}
        onTabChange={setActiveTab}
        leads={currentTabObj.data}
        loading={loading}
        visitorsMaster={visitorsMaster}
        onRefresh={loadData}
        onAssignVisitor={canEdit ? (lead) => setAssignModalLead(lead) : undefined}
        onLogFollowUp={canEdit ? (lead) => setFollowUpModalLead(lead) : undefined}
        onViewHistory={(lead) => setHistoryModalLead(lead)}
      />

      {/* Assign / Reassign Visitor Modal */}
      {assignModalLead && (
        <AssignVisitorModal
          isOpen={Boolean(assignModalLead)}
          onClose={() => setAssignModalLead(null)}
          lead={assignModalLead}
          onSaved={loadData}
        />
      )}

      {/* Log Visit Follow-Up Modal */}
      {followUpModalLead && (
        <VisitorFollowUpModal
          isOpen={Boolean(followUpModalLead)}
          onClose={() => setFollowUpModalLead(null)}
          lead={followUpModalLead}
          onSaved={loadData}
        />
      )}

      {/* Full Visit Timeline / History Modal */}
      {historyModalLead && (
        <VisitHistoryModal
          isOpen={Boolean(historyModalLead)}
          onClose={() => setHistoryModalLead(null)}
          lead={historyModalLead}
          onAssignVisitor={(lead) => setAssignModalLead(lead)}
          onLogFollowUp={(lead) => setFollowUpModalLead(lead)}
        />
      )}
    </div>
  );
}
