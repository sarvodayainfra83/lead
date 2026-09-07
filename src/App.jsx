import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Lead from './pages/Lead/Lead';
import FollowUp from './pages/CallTracker/FollowUp';
import Customermaster from './pages/CustomerMaster/Customermaster';
import Master from './pages/Master/Master';
import Setting from './pages/Setting/Setting';
import CallerReport from './pages/CallerReport/CallerReport';

import ProtectedRoute from './components/ProtectedRoute';
import AccessGuard from './components/AccessGuard';
import { initializeStorage } from './utils/storageManager';

function App() {
  useEffect(() => {
    initializeStorage();
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
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
            <Route path="customer-master" element={<AccessGuard pageKey="customerMaster"><Customermaster /></AccessGuard>} />
            <Route path="master" element={<AccessGuard pageKey="master"><Master /></AccessGuard>} />
            <Route path="setting" element={<AccessGuard pageKey="setting"><Setting /></AccessGuard>} />
            <Route path="caller-report" element={<AccessGuard pageKey="callerReport"><CallerReport /></AccessGuard>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
