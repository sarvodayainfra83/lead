import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Lead from './pages/Lead/Lead';
import FollowUp from './pages/CallTracker/FollowUp';
import SiteVisitMeeting from './pages/SiteVisitMeeting/SiteVisitMeeting';
import Customermaster from './pages/CustomerMaster/Customermaster';
import Master from './pages/Master/Master';
import Setting from './pages/Setting/Setting';
import CallerReport from './pages/CallerReport/CallerReport';
import Attendance from './pages/Attendance/Attendance';
import LeaveRequestsPage from './pages/LeaveRequests/LeaveRequestsPage';
import AttendanceReport from './pages/AttendanceReport/AttendanceReport';
import Products from './pages/Products/Products';
import MISReport from './pages/MISReport/MISReport';
import NonInterested from './pages/NonInterested/NonInterested';
import DealClosed from './pages/DealClosed/DealClosed';
import Reception from './pages/Reception/Reception';
import ReceptionistDashboard from './pages/Reception/ReceptionistDashboard';

import ProtectedRoute from './components/ProtectedRoute';
import AccessGuard from './components/AccessGuard';
import { initializeStorage } from './utils/storageManager';
import { isSupabaseConfigured } from './api/supabaseClient';
import { useAuthStore } from './store/authStore';
import { isUserAdmin, isAdminOnlyAttendanceUser } from './utils/authUtils';

// On mobile, filling in the Login form scrolls the page up so the field stays visible above the
// on-screen keyboard. That scroll position is a browser-window property, not part of the Login
// page itself, so it survives the SPA navigation into the app after signing in — leaving the new
// page (and its header) rendered already scrolled down until the user manually scrolls back up.
// Resetting scroll on every route change (the standard React Router fix for this) keeps every
// page — including the very first one after login — starting at the top.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AttendanceRoute() {
  return <AccessGuard pageKey="attendance"><Attendance /></AccessGuard>;
}

function AttendanceReportRoute() {
  const { user } = useAuthStore();
  if (isUserAdmin(user)) return <Navigate to="/attendance" replace />;
  return <AccessGuard pageKey="attendanceReport"><AttendanceReport /></AccessGuard>;
}

// For Admins, Site Visit / Meeting is merged into Lead & Followup
function SiteVisitRoute() {
  const { user } = useAuthStore();
  if (isUserAdmin(user)) return <Navigate to="/call-tracker" state={{ dateFilter: 'all', stageFilter: 'Site Visit' }} replace />;
  return <AccessGuard pageKey="siteVisitMeeting"><SiteVisitMeeting /></AccessGuard>;
}

function VisitorRedirectRoute() {
  const { user } = useAuthStore();
  return <Navigate to={isUserAdmin(user) ? "/call-tracker" : "/site-visit-meeting"} state={isUserAdmin(user) ? { dateFilter: 'all', stageFilter: 'Site Visit' } : undefined} replace />;
}

function App() {
  useEffect(() => {
    // Demo data in the browser is only for running without a database — with Supabase everything lives in the DB
    if (!isSupabaseConfigured) initializeStorage();
  }, []);

  return (
    <div className="bg-white h-full w-full overflow-hidden">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<AccessGuard pageKey="dashboard"><Dashboard /></AccessGuard>} />
            <Route path="lead" element={<AccessGuard pageKey="lead"><Lead /></AccessGuard>} />
            <Route path="call-tracker" element={<AccessGuard pageKey="callTracker"><FollowUp /></AccessGuard>} />
            <Route path="site-visit-meeting" element={<SiteVisitRoute />} />
            <Route path="assign-visitor" element={<VisitorRedirectRoute />} />
            <Route path="visitor-follow-up" element={<VisitorRedirectRoute />} />
            <Route path="customer-master" element={<AccessGuard pageKey="customerMaster"><Customermaster /></AccessGuard>} />
            <Route path="non-interested" element={<AccessGuard pageKey="nonInterested"><NonInterested /></AccessGuard>} />
            <Route path="deal-closed" element={<AccessGuard pageKey="dealClosed"><DealClosed /></AccessGuard>} />
            <Route path="reception-dashboard" element={<AccessGuard pageKey="receptionDashboard"><ReceptionistDashboard /></AccessGuard>} />
            <Route path="reception" element={<AccessGuard pageKey="reception"><Reception /></AccessGuard>} />
            <Route path="products" element={<AccessGuard pageKey="products"><Products /></AccessGuard>} />
            <Route path="caller-report" element={<AccessGuard pageKey="callerReport"><CallerReport /></AccessGuard>} />
            <Route path="attendance" element={<AttendanceRoute />} />
            <Route path="leave-requests" element={<AccessGuard pageKey="leaveRequests"><LeaveRequestsPage /></AccessGuard>} />
            <Route path="mis-report" element={<AccessGuard pageKey="misReport"><MISReport /></AccessGuard>} />
            <Route path="attendance-report" element={<AttendanceReportRoute />} />
            <Route path="master" element={<AccessGuard pageKey="master"><Master /></AccessGuard>} />
            <Route path="setting" element={<AccessGuard pageKey="setting"><Master /></AccessGuard>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
