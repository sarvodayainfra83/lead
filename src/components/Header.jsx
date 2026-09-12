import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, User, Menu, Settings, X, Phone, Mail, IdCard, ShieldCheck } from 'lucide-react';

const Header = ({ onMenuClick, user }) => {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  // The Settings gear is the admin user-management screen — only show it to someone who
  // can actually open it, same rule Sidebar/AccessGuard use, so it doesn't dead-end into
  // "Access Restricted" for every other employee.
  const canOpenSettings = user?.role === 'ADMIN' || (user?.accessPages?.setting && user.accessPages.setting !== 'none');

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-indigo-200">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">

        {/* Left Section: Mobile Menu & Search */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-4">

          {canOpenSettings && (
            <button
              onClick={() => navigate('/setting')}
              title="Setting"
              className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
            >
              <Settings size={20} />
            </button>
          )}

          <div className="h-8 w-px bg-indigo-200 mx-1 hidden sm:block"></div>

          {/* User Profile Summary (Desktop) — click to view your own account details */}
          <button
            onClick={() => setShowProfile(true)}
            title="My Profile"
            className="flex items-center gap-3 pl-2 group cursor-pointer"
          >
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                {user?.role === 'ADMIN' ? 'Administrator' : 'Employee'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-all overflow-hidden shadow-sm border border-indigo-300">
              <User size={20} className="text-indigo-600" />
            </div>
          </button>
        </div>
      </div>

      {/* My Profile — every logged-in user's own read-only account summary, regardless of
          their Setting page access (that page is for managing *other* users, not this). */}
      {showProfile && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">My Profile</h3>
              <button
                onClick={() => setShowProfile(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 border border-indigo-200">
                  <User size={26} className="text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate">{user?.name || '-'}</p>
                  <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <ShieldCheck size={11} /> {user?.role === 'ADMIN' ? 'Administrator' : 'Employee'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <IdCard size={15} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-gray-400 uppercase tracking-tighter">Login ID</p>
                    <p className="text-[13px] text-gray-800 font-medium truncate">{user?.id || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={15} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-gray-400 uppercase tracking-tighter">Number</p>
                    <p className="text-[13px] text-gray-800 font-medium truncate">{user?.number || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={15} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-gray-400 uppercase tracking-tighter">Gmail</p>
                    <p className="text-[13px] text-gray-800 font-medium truncate">{user?.gmail || '-'}</p>
                  </div>
                </div>
              </div>

              {user?.role !== 'ADMIN' && (
                <div className="pt-1">
                  <p className="text-[9px] text-gray-400 uppercase tracking-tighter mb-1.5">Page Access</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(user?.accessPages || {})
                      .filter(([, level]) => level && level !== 'none')
                      .map(([page, level]) => (
                        <span key={page} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-sky-50 text-sky-700 border-sky-200 capitalize">
                          {page.replace(/([A-Z])/g, ' $1').trim()}: {level}
                        </span>
                      ))}
                    {Object.values(user?.accessPages || {}).every(level => !level || level === 'none') && (
                      <span className="text-[11px] text-gray-400 italic">No pages granted yet — contact your administrator.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
