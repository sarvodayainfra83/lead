import React, { useState } from 'react';
import { Tag, User, Share2, Phone } from 'lucide-react';
import LeadType from './LeadType';
import LeadReceiver from './LeadReceiver';
import Leadsource from './Leadsource';
import CallerName from './CallerName';

/**
 * Master
 * Manages the four Master Data lists — Lead Type, Lead Receiver, Lead Source,
 * Caller Name — as tabs on a single page. These lists feed the dropdowns on
 * the Lead and Direct Lead forms.
 */
export default function Master() {
  const [activeTab, setActiveTab] = useState('leadType');
  const [headerAction, setHeaderAction] = useState(null);

  const tabs = [
    { key: 'leadType', label: 'Lead Type', icon: Tag, Component: LeadType },
    { key: 'leadReceiver', label: 'Lead Receiver', icon: User, Component: LeadReceiver },
    { key: 'leadSource', label: 'Lead Source', icon: Share2, Component: Leadsource },
    { key: 'callerName', label: 'Caller Name', icon: Phone, Component: CallerName }
  ];

  const ActiveComponent = tabs.find(t => t.key === activeTab)?.Component;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 sm:px-4 md:px-6 pt-2 md:pt-4 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold uppercase tracking-wide transition-colors border h-[32px] lg:h-[38px] ${activeTab === key
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center self-end sm:self-auto">
          {headerAction}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {ActiveComponent && <ActiveComponent setHeaderAction={setHeaderAction} />}
      </div>
    </div>
  );
}
