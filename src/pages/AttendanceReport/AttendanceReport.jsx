import React, { useState, useEffect } from 'react';
import { FileText, BarChart2, CalendarCheck, CalendarDays } from 'lucide-react';
import AllAttendanceTab from './AllAttendanceTab';
import MonthlyReportTab from './MonthlyReportTab';
import LeaveRequestsTab from '../Attendance/LeaveRequestsTab';
import PageTabs from '../../components/PageTabs';
import { useAuthStore } from '../../store/authStore';
import { isAdminOnlyAttendanceUser } from '../../utils/authUtils';
import { leaveRequestApi } from '../../api/leaveRequestApi';

export default function AttendanceReport() {
  const { user } = useAuthStore();
  const isAdminView = isAdminOnlyAttendanceUser(user);
  const [activeTab, setActiveTab] = useState(isAdminView ? 'today' : 'all');

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);

  const loadLeaves = async () => {
    setLeavesLoading(true);
    try {
      const data = await leaveRequestApi.getLeaveRequests(user);
      setLeaveRequests(data);
    } catch (err) {
      console.error('Failed to load leave requests in report:', err);
    } finally {
      setLeavesLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [user]);

  const tabs = isAdminView
    ? [
      { key: 'today', label: "Today's", icon: CalendarCheck },
      { key: 'all', label: 'All', icon: FileText },
      { key: 'leaves', label: 'Leave Requests', icon: CalendarDays }
    ]
    : [
      { key: 'all', label: 'All Attendance', icon: FileText },
      { key: 'monthly', label: 'Monthly Report', icon: BarChart2 }
    ];

  const tabBar = (
    <PageTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} fill className="w-full lg:w-auto" />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {activeTab === 'monthly' ? (
        <MonthlyReportTab tabBar={tabBar} />
      ) : activeTab === 'leaves' ? (
        <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">
          <div className="flex-shrink-0">{tabBar}</div>
          <LeaveRequestsTab
            leaveRequests={leaveRequests}
            loading={leavesLoading}
            onRefresh={loadLeaves}
            isAdmin={isAdminView}
            user={user}
          />
        </div>
      ) : (
        <AllAttendanceTab tabBar={tabBar} scope={activeTab} showMarkButton={isAdminView} />
      )}
    </div>
  );
}
