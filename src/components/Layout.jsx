import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { useAuthStore } from '../store/authStore';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const user = useAuthStore(state => state.user);

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">

      {/* Sidebar - Fixed on desktop, sliding on mobile */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 h-full overflow-hidden ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-56 2xl:ml-60'}`}>

        {/* Header - Sticky */}
        <Header
          sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(prev => !prev)}
          user={user}
        />

        <main className="flex-1 flex flex-col p-1 sm:p-2 lg:p-3 overflow-hidden relative z-0 min-h-0">
          <div className="w-full max-w-[1800px] mx-auto flex-1 flex flex-col animate-in fade-in duration-500 min-h-0">
            <Outlet />
          </div>
        </main>

        <Footer />

      </div>
    </div>
  );
};

export default Layout;