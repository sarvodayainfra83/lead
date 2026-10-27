import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  UserCheck,
  UserSearch,
  MapPin,
  Fingerprint,
  ClipboardCheck,
  Layers,
  FileBarChart,
  UserX,
  Handshake,
  Contact,
  CalendarClock,
  Flame,
  Briefcase
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useBadgeCountStore } from '../store/badgeCountStore';
import { canViewPage, getUserLeadTypeScope, isAdminOnlyAttendanceUser, isUserAdmin, isUserReceptionist } from '../utils/authUtils';
import companyLogo from '../Assets/Logo.jpeg';
import sidebarLogo from '../Assets/SidebarLogo.png';
import companyIcon from '../Assets/TikarihaIcon.png';

const Sidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const { pendingLeadCount, siteVisitMeetingCount, callTrackerCount, customerCount, nonInterestedCount, dealClosedCount, pendingLeaveCount, refresh } = useBadgeCountStore();

  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(refresh, 10000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [refresh]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Insurance / Mutual Fund users have meetings only (no site visits), so the page is just 'Meeting'
  const leadCategories = getUserLeadTypeScope(user)?.categories || [];
  const isMeetingOnlyUser = leadCategories.length > 0 && !leadCategories.includes('Real Estate');

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', pageKey: 'dashboard' },
    { path: '/lead', icon: UserPlus, label: 'Lead', pageKey: 'lead', badgeCount: pendingLeadCount },
    { path: '/call-tracker', icon: PhoneCall, label: 'Lead & Followup', pageKey: 'callTracker', badgeCount: callTrackerCount },
    { path: '/site-visit-meeting', icon: MapPin, label: isMeetingOnlyUser ? 'Meeting' : 'Site Visit / Meeting', pageKey: 'siteVisitMeeting', badgeCount: siteVisitMeetingCount },
    { path: '/customer-master', icon: Flame, label: 'Hot Customers', pageKey: 'customerMaster', badgeCount: customerCount, hot: true },
    { path: '/non-interested', icon: UserX, label: 'Non-interested', pageKey: 'nonInterested', badgeCount: nonInterestedCount },
    { path: '/deal-closed', icon: Handshake, label: 'Deal Closed', pageKey: 'dealClosed', badgeCount: dealClosedCount },
    { path: '/broker', icon: Briefcase, label: 'Brokers', pageKey: 'broker' },
    // { path: '/caller-report', icon: BarChart3, label: 'Caller Report', pageKey: 'callerReport' },
    { path: '/mis-report', icon: FileBarChart, label: 'MIS Report', pageKey: 'misReport' },
    { path: '/attendance', icon: Fingerprint, label: 'Attendance', pageKey: 'attendance' },
    { path: '/leave-requests', icon: CalendarClock, label: 'Leave Requests', pageKey: 'leaveRequests', badgeCount: pendingLeaveCount },
    { path: '/attendance-report', icon: ClipboardCheck, label: 'Attendance Report', pageKey: 'attendanceReport' },
    { path: '/reception-dashboard', icon: UserCheck, label: 'Reception Dashboard', pageKey: 'receptionDashboard' },
    { path: '/reception', icon: Contact, label: 'Reception', pageKey: 'reception' },
    { path: '/products', icon: Layers, label: 'Products', pageKey: 'products' },
    { path: '/master', icon: Database, label: 'Master / Setting', pageKey: 'master' },
  ];

  // Admins see everything; Users only see pages their access level isn't 'none' for
  // Admins mark and view attendance from the Attendance Report page only
  // For Admin role: Site Visit / Meeting is merged into Lead & Followup, so hide it from the sidebar
  // For Admin role: Lead page is hidden for now
  // For Receptionist role: regular Dashboard is hidden, Reception Dashboard is kept at the top
  let menuItems = allMenuItems.filter((item) =>
    canViewPage(user, item.pageKey) &&
    !(item.pageKey === 'dashboard' && isUserReceptionist(user)) &&
    !(item.pageKey === 'lead' && isUserAdmin(user)) &&
    !(item.pageKey === 'siteVisitMeeting' && isUserAdmin(user)) &&
    !(item.pageKey === 'attendanceReport' && isUserAdmin(user)) &&
    !(item.adminOnly && !isUserAdmin(user))
  );

  // For Receptionist users, keep Reception Dashboard at the top and Reception above Attendance
  if (isUserReceptionist(user)) {
    const receptionDashIndex = menuItems.findIndex(i => i.pageKey === 'receptionDashboard');
    if (receptionDashIndex >= 0) {
      const [receptionDashItem] = menuItems.splice(receptionDashIndex, 1);
      menuItems.unshift(receptionDashItem);
    }
    const receptionIndex = menuItems.findIndex(i => i.pageKey === 'reception');
    if (receptionIndex >= 0) {
      const [receptionItem] = menuItems.splice(receptionIndex, 1);
      const dashIndex = menuItems.findIndex(i => i.pageKey === 'receptionDashboard');
      if (dashIndex >= 0) {
        menuItems.splice(dashIndex + 1, 0, receptionItem);
      } else {
        menuItems.unshift(receptionItem);
      }
    }
  } else if (isUserAdmin(user)) {
    // For Admin role: keep Reception Dashboard beneath Dashboard
    const receptionDashIndex = menuItems.findIndex(i => i.pageKey === 'receptionDashboard');
    if (receptionDashIndex >= 0) {
      const [receptionDashItem] = menuItems.splice(receptionDashIndex, 1);
      const dashIndex = menuItems.findIndex(i => i.pageKey === 'dashboard');
      if (dashIndex >= 0) {
        menuItems.splice(dashIndex + 1, 0, receptionDashItem);
      } else {
        menuItems.unshift(receptionDashItem);
      }
    }
  }

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

          {/* Logo Section - Spreads across complete rectangle formed by sidebar and aligns with h-16 header line */}
          <div className="h-16 border-b border-indigo-200 flex items-center justify-between overflow-hidden bg-[#2e333a] relative flex-shrink-0 select-none">
            {collapsed ? (
              <div className="w-full h-full flex items-center justify-center p-2.5" title="Tikariha Advisors">
                <img
                  src={companyIcon}
                  alt="Tikariha Advisors"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center relative">
                <img
                  src={sidebarLogo}
                  alt="Tikariha Advisors"
                  className="w-full h-full object-cover"
                />
                {/* Mobile close button */}
                <button
                  onClick={onClose}
                  className="lg:hidden absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/80 hover:text-white hover:bg-black/30 rounded-lg flex-shrink-0"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide">
            {menuItems.map((item) => (
              <div key={item.path} className="relative group">
                <NavLink
                  to={item.path}
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('app:clear-filters', {
                      detail: { path: item.path }
                    }));
                  }}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group overflow-hidden
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-indigo-100/50 text-indigo-600 border-l-4 border-indigo-600'
                      : 'text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 border-l-4 border-transparent'}
                  `}
                >
                  <div className="relative flex items-center justify-center flex-shrink-0">
                    {item.hot && (
                      <span className="absolute -inset-1.5 rounded-full bg-orange-400/20 animate-pulse pointer-events-none" />
                    )}
                    <item.icon size={20} className={`group-hover:scale-110 transition-transform ${item.hot ? 'text-orange-500 drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]' : ''}`} />
                    {collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600 rounded-full shadow-sm border border-white">
                        {item.badgeCount > 99 ? '99+' : item.badgeCount}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="font-bold text-[13px] leading-tight whitespace-nowrap truncate flex-1">
                        {item.label}
                      </span>
                      {item.badgeCount !== undefined && (
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold rounded-full transition-all flex-shrink-0 tabular-nums ${item.badgeCount > 0
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 group-hover:bg-indigo-200'
                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                            }`}
                        >
                          {item.badgeCount > 999 ? '999+' : item.badgeCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg
                    opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[60] shadow-lg
                    hidden lg:flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.badgeCount !== undefined && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-500 text-white">
                        {item.badgeCount}
                      </span>
                    )}
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
