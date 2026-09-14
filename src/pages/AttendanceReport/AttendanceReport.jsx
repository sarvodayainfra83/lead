import React, { useState } from 'react';
import { FileText, BarChart2 } from 'lucide-react';
import AllAttendanceTab from './AllAttendanceTab';
import MonthlyReportTab from './MonthlyReportTab';

export default function AttendanceReport() {
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { key: 'all', label: 'ALL ATTENDANCE', icon: FileText },
    { key: 'monthly', label: 'MONTHLY REPORT', icon: BarChart2 }
  ];

  const tabBar = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border h-[38px] ${
            activeTab === key
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 flex flex-col h-full min-h-0">
      {activeTab === 'all' ? (
        <AllAttendanceTab tabBar={tabBar} />
      ) : (
        <MonthlyReportTab tabBar={tabBar} />
      )}
    </div>
  );
}
