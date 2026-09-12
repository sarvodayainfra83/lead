import React, { useState } from 'react';
import { Clock, History as HistoryIcon, Plus } from 'lucide-react';
import PendingTracker from './PendingTracker';
import HistoryTracker from './HistoryTracker';
import Direct from './Direct';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess } from '../../utils/authUtils';

/**
 * FollowUp
 * Manages the Call Tracker module's two sections — Pending and History —
 * as tabs on a single page, plus a "Direct" shortcut that logs a walk-in/direct
 * call straight into the Lead system (reusing LeadForm) tagged Process Type = Direct.
 */
export default function FollowUp() {
  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'callTracker');

  const [activeTab, setActiveTab] = useState('pending');
  const [showDirectForm, setShowDirectForm] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const tabs = [
    { key: 'pending', label: 'Pending', icon: Clock },
    { key: 'history', label: 'History', icon: HistoryIcon }
  ];

  const tabBar = (
    <div className="flex items-center gap-2 w-full lg:w-auto">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border h-[32px] lg:h-[38px] ${
            activeTab === key
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
      {canEdit && (
        <button
          onClick={() => setShowDirectForm(true)}
          className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 h-[32px] lg:h-[38px]"
        >
          <Plus size={14} />
          Direct
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {activeTab === 'pending'
        ? <PendingTracker key={`pending-${refreshTick}`} tabBar={tabBar} />
        : <HistoryTracker key={`history-${refreshTick}`} tabBar={tabBar} />}

      {/* Direct Lead Entry — creates the lead and logs its call outcome in one step */}
      <Direct
        isOpen={showDirectForm}
        onClose={() => setShowDirectForm(false)}
        onSaved={() => setRefreshTick(t => t + 1)}
      />
    </div>
  );
}
