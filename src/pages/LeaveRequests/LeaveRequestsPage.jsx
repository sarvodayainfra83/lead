import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";
import { isUserAdmin, canViewPage, getPageAccess } from "../../utils/authUtils";
import { leaveRequestApi } from "../../api/leaveRequestApi";
import LeaveRequestsTab from "../Attendance/LeaveRequestsTab";

/**
 * Dedicated page for viewing and managing employee leave requests.
 * Access is controlled by the 'leaveRequests' permission configured in Master / Setting.
 */
export default function LeaveRequestsPage() {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);
  const pageAccess = getPageAccess(user, 'leaveRequests');
  const canView = isAdmin || canViewPage(user, 'leaveRequests');
  const canManage = isAdmin || pageAccess === 'full';

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      // Reviewers/admins see all employee leave requests
      const data = await leaveRequestApi.getLeaveRequests({ role: 'ADMIN' });
      setLeaveRequests(data);
    } catch (err) {
      console.error("Failed to load leave requests:", err);
      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadLeaves();
  }, [user, canView]);

  // Guard: users without access should not see this page
  if (!canView) {
    return <Navigate to="/attendance" replace />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-2 sm:p-4 md:p-6">
      <LeaveRequestsTab
        leaveRequests={leaveRequests}
        loading={loading}
        onRefresh={loadLeaves}
        isAdmin={isAdmin}
        canManage={canManage}
        isTester={false}
        user={user}
        onOpenApply={null}
      />
    </div>
  );
}
