import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, ShieldCheck, TrendingUp } from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, getUserLeadTypeScope } from '../../utils/authUtils';
import LeadCategoryView from './LeadCategoryView';
import LeadForm from './LeadForm';
import LeadEdit from './LeadEdit';
import BulkUploadLead from './BulkUploadLead';
import LeadDetailsModal from './LeadDetailsModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildShareClient } from '../../utils/productShare';

/**
 * Lead
 * Multi-category Lead management interface with 3 dedicated category tabs:
 * - Real Estate (real_state table)
 * - Insurance (insurance table)
 * - Mutual Fund (mutual_fund table)
 * 
 * Replaces old Pending/History split with a single unified list per category
 * where latest added leads are shown at the top. Pure mobile responsive with
 * card/table views and batch caller assignment.
 */
export default function Lead() {
  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'lead');
  const navigate = useNavigate();
  // Tab / filter handed over from a Dashboard card, e.g. { tab: 'Insurance', dateFilter: 'today' }
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
  const [allLeads, setAllLeads] = useState([]);
  const [callersMaster, setCallersMaster] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [modalCategory, setModalCategory] = useState(initialTab);
  const [editLead, setEditLead] = useState(null);
  const [detailsLead, setDetailsLead] = useState(null);

  // Load all leads, callers, and visitor follow-ups
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leads, callers, visitorFollowUps] = await Promise.all([
        leadApi.getLeads(),
        masterApi.getCallerNames(),
        siteVisitMeetingApi.getVisitorFollowUps().catch(() => [])
      ]);

      const followUpsByLead = {};
      (visitorFollowUps || []).forEach(f => {
        const keyId = String(f.leadId || f.lead_id || '').trim();
        const keyNo = String(f.leadNo || f.lead_no || '').trim().toLowerCase();
        if (keyId) {
          if (!followUpsByLead[keyId]) followUpsByLead[keyId] = [];
          followUpsByLead[keyId].push(f);
        }
        if (keyNo) {
          if (!followUpsByLead[keyNo]) followUpsByLead[keyNo] = [];
          followUpsByLead[keyNo].push(f);
        }
      });

      const enriched = (leads || []).map(lead => {
        const lKeyId = String(lead.id || '').trim();
        const lKeyNo = String(lead.leadNo || '').trim().toLowerCase();
        const rawFollowUps = [
          ...(lKeyId && followUpsByLead[lKeyId] ? followUpsByLead[lKeyId] : []),
          ...(lKeyNo && followUpsByLead[lKeyNo] ? followUpsByLead[lKeyNo] : [])
        ];
        const followUps = rawFollowUps
          .filter((v, idx, arr) => arr.findIndex(x => x.id === v.id) === idx)
          .sort((a, b) => (Number(a.timestampMs || a.timestamp_ms || 0)) - (Number(b.timestampMs || b.timestamp_ms || 0)));
        const latestFollowUp = followUps[followUps.length - 1] || null;

        return {
          ...lead,
          visitorFollowUps: followUps,
          latestVisitorFollowUp: latestFollowUp,
          visitorFollowUpCount: followUps.length,
          siteVisitStatus: latestFollowUp?.status || '',
          siteVisitDate: latestFollowUp?.visitDate || latestFollowUp?.visit_date || '',
          nextVisitDate: latestFollowUp?.nextVisitDate || latestFollowUp?.next_visit_date || '',
          siteVisitVisitor: latestFollowUp?.visitorName || latestFollowUp?.visitor_name || '',
          dealOutcome: latestFollowUp?.dealOutcome || latestFollowUp?.deal_outcome || '',
          closingAmount: latestFollowUp?.closingAmount || latestFollowUp?.closing_amount || '',
          salesExecutive: latestFollowUp?.salesExecutive || latestFollowUp?.sales_executive || ''
        };
      });

      setAllLeads(enriched);
      setCallersMaster(callers || []);
    } catch (err) {
      console.error('Failed to load lead data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  // Show all leads of the same lead type without restricting by caller name, username, or role
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

  const handleOpenAdd = (cat) => {
    setModalCategory(cat || activeTab);
    setShowAddModal(true);
  };

  const handleOpenBulk = (cat) => {
    setModalCategory(cat || activeTab);
    setShowBulkUploadModal(true);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category View Panel containing the Single Row Toolbar (Tabs + Actions) + Data Table */}
      <div className="flex-1 min-h-0">
        <LeadCategoryView
          key={currentTabObj.key}
          category={currentTabObj.key}
          tabs={visibleTabs}
          activeTab={currentTabObj.key}
          initialDateFilter={navState.tab === currentTabObj.key ? navState.dateFilter : undefined}
          onTabChange={setActiveTab}
          leads={currentTabObj.data}
          loading={loading}
          callersMaster={callersMaster}
          canEdit={canEdit}
          onRefresh={loadData}
          onAddLead={handleOpenAdd}
          onBulkUpload={handleOpenBulk}
          onEditLead={(lead) => setEditLead(lead)}
          onViewDetails={(lead) => setDetailsLead(lead)}
        />
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <LeadForm
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          defaultLeadType={modalCategory}
          onSaved={loadData}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <BulkUploadLead
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          defaultLeadType={modalCategory}
          onImported={loadData}
        />
      )}

      {/* Edit Lead Modal */}
      {editLead && (
        <LeadEdit
          isOpen={Boolean(editLead)}
          onClose={() => setEditLead(null)}
          lead={editLead}
          onUpdated={loadData}
        />
      )}

      {/* Full Lead Details Modal */}
      {detailsLead && (
        <LeadDetailsModal
          isOpen={Boolean(detailsLead)}
          onClose={() => setDetailsLead(null)}
          lead={detailsLead}
          onShareProducts={(lead) => {
            setDetailsLead(null);
            navigate('/products', { state: { shareClient: buildShareClient(lead) } });
          }}
          onEdit={(lead) => {
            setDetailsLead(null);
            setEditLead(lead);
          }}
        />
      )}
    </div>
  );
}
