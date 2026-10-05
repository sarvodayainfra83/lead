import React, { useState } from 'react';
import NotificationBell from './NotificationBell';
import ProfileModal from './ProfileModal';
import { User, Menu, X } from 'lucide-react';

const Header = ({ sidebarOpen, onMenuClick, user }) => {
  const [showProfile, setShowProfile] = useState(false);

  const avatarSrc = user?.avatarUrl || user?.avatar_url;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-indigo-200">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">

        {/* Left Section: Mobile Menu */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            title={sidebarOpen ? 'Hide menu' : 'Show menu'}
            className="lg:hidden p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-4">

          {/* Remark notifications (admin remarks for users / user replies for admin) */}
          <NotificationBell user={user} />

          <div className="h-8 w-px bg-indigo-200 mx-1 hidden sm:block"></div>

          {/* User Profile Summary (Desktop) — click to view and edit your own account details */}
          <button
            onClick={() => setShowProfile(true)}
            title="My Profile & Settings"
            className="flex items-center gap-3 pl-2 group cursor-pointer focus:outline-none"
          >
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-[150px]">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                {user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'TESTER' ? 'Tester' : user?.role === 'HR' ? 'HR Manager' : 'Employee'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center group-hover:ring-2 group-hover:ring-indigo-400 group-hover:scale-105 transition-all overflow-hidden shadow-sm border border-indigo-300 flex-shrink-0">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <User size={20} className="text-indigo-600" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Comprehensive My Profile Modal (View & Edit Profile, Photo, Email, Phone, Password) */}
      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        user={user}
      />
    </header>
  );
};

export default Header;
