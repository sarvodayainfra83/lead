import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, Tag, Share2, Building2, ClipboardList, TrendingUp, ShieldCheck, Layers, Wallet } from 'lucide-react';
import Setting from '../Setting/Setting';
import LeadType from './LeadType';
import Leadsource from './Leadsource';
import RealEstateProduct from './RealEstateProduct';
import RealEstateRequirement from './RealEstateRequirement';
import MutualFundProduct from './MutualFundProduct';
import InsuranceProduct from './InsuranceProduct';
import InsuranceSubProduct from './InsuranceSubProduct';
import InvestmentBudget from './InvestmentBudget';

/**
 * Master & Settings Unified Hub
 * Manages Users & Permissions (Setting) alongside all Master Data categories
 * on a single unified page with smooth tabbed navigation.
 */
export default function Master() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return location.pathname.includes('setting') ? 'users' : 'users';
  });
  const [headerAction, setHeaderAction] = useState(null);

  useEffect(() => {
    if (location.pathname.includes('setting')) {
      setActiveTab('users');
    }
  }, [location.pathname]);

  const tabs = [
    { key: 'users', label: 'Users & Team', icon: Users, Component: Setting },
    { key: 'leadType', label: 'Lead Type', icon: Tag, Component: LeadType },
    { key: 'leadSource', label: 'Lead Source', icon: Share2, Component: Leadsource },
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
      {/* Sidebar for Master Data & Settings */}
      <div className="w-full md:w-[260px] flex-shrink-0 border-r border-gray-200 overflow-y-auto no-scrollbar hidden md:flex flex-col bg-white">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Master & Settings</h2>
        </div>
        <div className="px-3 pb-6 flex flex-col gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setHeaderAction(null); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors w-full text-left cursor-pointer ${activeTab === key
                ? 'bg-indigo-50 text-indigo-950 font-semibold'
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
              onClick={() => { setActiveTab(key); setHeaderAction(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors border h-[32px] whitespace-nowrap flex-shrink-0 cursor-pointer ${activeTab === key
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
        {/* Header area containing Tab Title and Header Action */}
        <div className="px-4 sm:px-6 py-3 md:py-4 flex items-center justify-between gap-4 flex-shrink-0 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              {tabs.find(t => t.key === activeTab)?.label}
            </h1>
            <span className="text-xs text-gray-400 font-normal hidden sm:inline">
              · Master Data & Settings
            </span>
          </div>
          <div className="flex-shrink-0">
            {headerAction}
          </div>
        </div>

        {/* Dynamic Component */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {ActiveComponent && <ActiveComponent setHeaderAction={setHeaderAction} />}
        </div>
      </div>
    </div>
  );
}

