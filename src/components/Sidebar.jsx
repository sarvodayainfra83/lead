import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LogOut as LogOutIcon,
  X,
  LayoutDashboard,
  UserPlus,
  PhoneCall,
  Users,
  Database,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import companyLogo from '../Assets/Logo.jpeg';

const Sidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', pageKey: 'dashboard' },
    { path: '/lead', icon: UserPlus, label: 'Lead', pageKey: 'lead' },
    { path: '/call-tracker', icon: PhoneCall, label: 'Call Tracker', pageKey: 'callTracker' },
    { path: '/customer-master', icon: Users, label: 'Customer Master', pageKey: 'customerMaster' },
    { path: '/master', icon: Database, label: 'Master', pageKey: 'master' },
    { path: '/caller-report', icon: BarChart3, label: 'Caller Report', pageKey: 'callerReport' },
    { path: '/setting', icon: Settings, label: 'Setting', pageKey: 'setting' },
  ];

  // Admins see everything; Users only see pages their access level isn't 'none' for
  const menuItems = allMenuItems.filter(
    (item) => user?.role === 'ADMIN' || (user?.accessPages?.[item.pageKey] && user.accessPages[item.pageKey] !== 'none')
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-indigo-100 z-50 transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-64 sm:w-72 lg:w-56 2xl:w-60'}
        `}
      >
        <div className="flex flex-col h-full relative">

          {/* Logo Section */}
          <div className="p-4 border-b border-indigo-100 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white border border-indigo-100">
                <img src={companyLogo} alt="Sarvodaya Infracon Logo" className="w-full h-full object-contain" />
              </div>
              {!collapsed && (
                <span className="text-xl font-bold text-indigo-600 tracking-tight truncate min-w-0">
                  Sarvodaya
                </span>
              )}
            </div>
            {/* Mobile close button */}
            <button onClick={onClose} className="lg:hidden p-2 hover:bg-indigo-100/50 rounded-lg flex-shrink-0">
              <X size={20} className="text-indigo-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide">
            {menuItems.map((item) => (
              <div key={item.path} className="relative group">
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group overflow-hidden
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-indigo-100/50 text-indigo-600 border-l-4 border-indigo-600'
                      : 'text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 border-l-4 border-transparent'}
                  `}
                >
                  <item.icon size={20} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
                  {!collapsed && (
                    <span className="font-black leading-tight whitespace-nowrap">{item.label}</span>
                  )}
                </NavLink>

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg
                    opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60] shadow-lg
                    hidden lg:block">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Sign Out */}
          <div className="p-3 border-t border-indigo-100 bg-indigo-50/50">
            {collapsed ? (
              <div className="relative group">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-full p-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                >
                  <LogOutIcon size={18} />
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60] shadow-lg hidden lg:block">
                  Sign Out
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white transition-all font-semibold shadow-sm"
              >
                <LogOutIcon size={18} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2
            w-7 h-7 bg-white border border-indigo-200 rounded-full
            items-center justify-center shadow-md
            hover:bg-indigo-600 hover:text-white hover:border-indigo-600
            text-indigo-600 transition-all duration-200 z-[60]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <ChevronLeft size={14} />
          }
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
