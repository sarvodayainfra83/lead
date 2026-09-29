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
import PageTabs from '../../components/PageTabs';

/**
 * Master & Settings Unified Hub
 * Manages Users & Permissions (Setting) alongside all Master Data categories.
 * Large screens: side menu + content. Phones / tablets: scrollable tab strip on top.
 */
export default function Master() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('users');
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

  const active = tabs.find(t => t.key === activeTab) || tabs[0];
  const ActiveComponent = active.Component;
  const ActiveIcon = active.icon;

  const selectTab = (key) => {
    setActiveTab(key);
    setHeaderAction(null);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 gap-2">
      {/* Side menu (large screens) */}
      <aside className="hidden lg:flex flex-col w-[220px] xl:w-[240px] flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Master & Settings</h2>
        </div>
        <nav className="px-2 pb-3 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
          {tabs.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className={`flex items-center gap-2.5 px-3 h-[36px] rounded-lg text-[13px] transition-colors w-full text-left ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-gray-400'} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Tab strip (phones / tablets) */}
      <div className="lg:hidden flex-shrink-0">
        <PageTabs tabs={tabs} activeKey={activeTab} onChange={selectTab} />
      </div>

      {/* Content */}
      <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <ActiveIcon size={15} className="text-indigo-600" />
            </span>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">{active.label}</h1>
              <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">Master Data & Settings</p>
            </div>
          </div>
          <div className="flex-shrink-0">{headerAction}</div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50/40">
          {ActiveComponent && <ActiveComponent setHeaderAction={setHeaderAction} />}
        </div>
      </section>
    </div>
  );
}
