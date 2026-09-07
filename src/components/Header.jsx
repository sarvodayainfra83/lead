import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, User, Menu, Settings } from 'lucide-react';

const Header = ({ onMenuClick, user }) => {
  const navigate = useNavigate();

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

          <button
            onClick={() => navigate('/setting')}
            title="Setting"
            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
          >
            <Settings size={20} />
          </button>

          <div className="h-8 w-px bg-indigo-200 mx-1 hidden sm:block"></div>

          {/* User Profile Summary (Desktop) */}
          <div className="flex items-center gap-3 pl-2 group cursor-pointer">
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;