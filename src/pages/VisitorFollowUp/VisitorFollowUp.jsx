import React, { useState } from 'react';
import { Clock, History as HistoryIcon } from 'lucide-react';
import PendingVisitorFollowUp from './PendingVisitorFollowUp';
import HistoryVisitorFollowUp from './HistoryVisitorFollowUp';

/**
 * VisitorFollowUp
 * Manages the Visitor Follow Up module's two sections — Pending (leads assigned to a
 * visitor awaiting visit follow-up outcome) and History (all logged visit follow-ups)
 * — as tabs on a single page.
 */
export default function VisitorFollowUp() {
  const [activeTab, setActiveTab] = useState('pending');
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
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {activeTab === 'pending' ? (
        <PendingVisitorFollowUp
          key={`pending-${refreshTick}`}
          tabBar={tabBar}
          onRefresh={() => setRefreshTick(t => t + 1)}
        />
      ) : (
        <HistoryVisitorFollowUp
          key={`history-${refreshTick}`}
          tabBar={tabBar}
          onRefresh={() => setRefreshTick(t => t + 1)}
        />
      )}
    </div>
  );
}
