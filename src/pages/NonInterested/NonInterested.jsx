import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, ShieldCheck, TrendingUp } from 'lucide-react';
import { nonInterestedApi } from '../../api/nonInterestedApi';
import { masterApi } from '../../api/masterApi';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, getUserLeadTypeScope, isUserAdmin, matchesUserAssignment, matchesUserReceiver } from '../../utils/authUtils';
import NonInterestedCategoryView from './NonInterestedCategoryView';
import AssignVisitorModal from '../SiteVisitMeeting/AssignVisitorModal';
import VisitorFollowUpModal from '../SiteVisitMeeting/VisitorFollowUpModal';
import VisitHistoryModal from '../SiteVisitMeeting/VisitHistoryModal';
import { useLocation } from 'react-router-dom';

/**
 * NonInterested
 * Dedicated sidebar section displaying all Non-interested customers across
 * Real Estate, Insurance, and Mutual Fund.
 * Tables and columns match the Site Visit / Meeting module.
 */
export default function NonInterested() {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);
  const canEdit = hasFullAccess(user, 'nonInterested') || hasFullAccess(user, 'siteVisitMeeting');
  const navState = useLocation().state || {};

  // Determine initial tab from nav state or user's assigned lead type
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
  const [allLeads, setAllLeads] = useState([]);
  const [visitorsMaster, setVisitorsMaster] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [assignModalLead, setAssignModalLead] = useState(null);
  const [followUpModalLead, setFollowUpModalLead] = useState(null);
  const [historyModalLead, setHistoryModalLead] = useState(null);

  // Load all non-interested leads and visitors
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leads, visitors] = await Promise.all([
        nonInterestedApi.getNonInterestedLeads(),
        masterApi.getVisitors()
      ]);
      setAllLeads(leads || []);
      setVisitorsMaster(visitors || []);
    } catch (err) {
      console.error('Failed to load non-interested leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  // For USER role (non-admin): show assigned records matching user as caller, visitor, or receiver
  const displayLeads = useMemo(() => {
    if (isAdmin || canEdit) return allLeads;
    return allLeads.filter(l => {
      if (matchesUserAssignment(l, user)) return true;
      if (matchesUserReceiver(l, user)) return true;
      const visitorNorm = (l.assignedVisitor || l.visitorName || l.visitorId || '').trim().toLowerCase();
      const userNameNorm = (user?.name || '').trim().toLowerCase();
      const userIdNorm = (user?.id || '').trim().toLowerCase();
      if (visitorNorm && (visitorNorm === userNameNorm || visitorNorm === userIdNorm)) return true;
      return false;
    });
  }, [allLeads, isAdmin, canEdit, user]);

  // Partition leads by the 3 category tables
  const realEstateLeads = useMemo(() => {
    return displayLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('real') || type.includes('estate') || (l.leadNo && l.leadNo.startsWith('LR'));
    });
  }, [displayLeads]);

  const insuranceLeads = useMemo(() => {
    return displayLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('insurance') || (l.leadNo && l.leadNo.startsWith('LI'));
    });
  }, [displayLeads]);

  const mutualFundLeads = useMemo(() => {
    return displayLeads.filter(l => {
      const type = (l.leadType || '').toLowerCase();
      return type.includes('mutual') || type.includes('fund') || (l.leadNo && l.leadNo.startsWith('LM'));
    });
  }, [displayLeads]);

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

  // Role USER gets tabs of all their assigned lead types
  const scope = getUserLeadTypeScope(user);
  const visibleTabs = scope?.categories?.length > 0
    ? tabs.filter(t => scope.categories.includes(t.key))
    : (scope?.category ? tabs.filter(t => t.key === scope.category) : tabs);

  const currentTabObj = visibleTabs.find(t => t.key === activeTab) || visibleTabs[0];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category View Panel */}
      <NonInterestedCategoryView
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
