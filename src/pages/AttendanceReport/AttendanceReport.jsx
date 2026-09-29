import React, { useState } from 'react';
import { FileText, BarChart2 } from 'lucide-react';
import AllAttendanceTab from './AllAttendanceTab';
import MonthlyReportTab from './MonthlyReportTab';
import PageTabs from '../../components/PageTabs';

export default function AttendanceReport() {
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { key: 'all', label: 'All Attendance', icon: FileText },
    { key: 'monthly', label: 'Monthly Report', icon: BarChart2 }
  ];

  const tabBar = (
    <PageTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} fill className="w-full lg:w-auto" />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {activeTab === 'all' ? (
        <AllAttendanceTab tabBar={tabBar} />
      ) : (
        <MonthlyReportTab tabBar={tabBar} />
      )}
    </div>
  );
}
