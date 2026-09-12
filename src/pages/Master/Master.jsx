import React, { useState } from 'react';
import { Tag, User, Share2, Phone, Building2, ClipboardList, TrendingUp, ShieldCheck, Layers, Wallet } from 'lucide-react';
import LeadType from './LeadType';
import LeadReceiver from './LeadReceiver';
import Leadsource from './Leadsource';
import CallerName from './CallerName';
import RealEstateProduct from './RealEstateProduct';
import RealEstateRequirement from './RealEstateRequirement';
import MutualFundProduct from './MutualFundProduct';
import InsuranceProduct from './InsuranceProduct';
import InsuranceSubProduct from './InsuranceSubProduct';
import InvestmentBudget from './InvestmentBudget';

/**
 * Master
 * Manages every Master Data list as tabs on a single page — Lead Type, Lead Receiver,
 * Lead Source, Caller Name, plus the per-Lead-Type Product Type / Requirement / Sub
 * Product Type lists. These feed the dropdowns on the Lead and Direct Lead forms.
 */
export default function Master() {
  const [activeTab, setActiveTab] = useState('leadType');
  const [headerAction, setHeaderAction] = useState(null);

  const tabs = [
    { key: 'leadType', label: 'Lead Type', icon: Tag, Component: LeadType },
    { key: 'leadReceiver', label: 'Lead Receiver', icon: User, Component: LeadReceiver },
    { key: 'leadSource', label: 'Lead Source', icon: Share2, Component: Leadsource },
    { key: 'callerName', label: 'Caller Name', icon: Phone, Component: CallerName },
    { key: 'realEstateProduct', label: 'RE Product', icon: Building2, Component: RealEstateProduct },
    { key: 'realEstateRequirement', label: 'RE Requirement', icon: ClipboardList, Component: RealEstateRequirement },
    { key: 'mutualFundProduct', label: 'MF Product', icon: TrendingUp, Component: MutualFundProduct },
    { key: 'insuranceProduct', label: 'Insurance Product', icon: ShieldCheck, Component: InsuranceProduct },
    { key: 'insuranceSubProduct', label: 'Insurance Sub Product', icon: Layers, Component: InsuranceSubProduct },
    { key: 'investmentBudget', label: 'Investment Budget', icon: Wallet, Component: InvestmentBudget }
  ];

  const ActiveComponent = tabs.find(t => t.key === activeTab)?.Component;

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 bg-white md:bg-gray-50/30">
      {/* Sidebar for Master Data */}
      <div className="w-full md:w-[260px] flex-shrink-0 border-r border-gray-200 overflow-y-auto no-scrollbar hidden md:flex flex-col bg-white">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Master Data</h2>
        </div>
        <div className="px-3 pb-6 flex flex-col gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors w-full text-left ${activeTab === key
                ? 'bg-[#f0f7ff] text-[#0f172a]'
                : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon size={18} className={activeTab === key ? "text-indigo-600" : "text-gray-400"} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Mobile Tab Bar */}
      <div className="md:hidden flex flex-col justify-between px-2 pt-2 flex-shrink-0 gap-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 max-w-full">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors border h-[30px] whitespace-nowrap flex-shrink-0 ${activeTab === key
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header area containing Search and Header Action */}
        <div className="px-4 sm:px-6 pt-4 pb-2 md:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
          <div className="relative w-full sm:w-[350px]">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search details..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" 
            />
          </div>
          <div className="flex-shrink-0">
            {headerAction}
          </div>
        </div>

        {/* Dynamic Component */}
        <div className="flex-1 min-h-0">
          {ActiveComponent && <ActiveComponent setHeaderAction={setHeaderAction} />}
        </div>
      </div>
    </div>
  );
}
