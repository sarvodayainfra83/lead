import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShieldCheck, User, CheckCheck, MessageSquare } from 'lucide-react';
import { leadApi, formatIST, REMARKS_CHANGED_EVENT } from '../api/leadApi';
import { isUserAdmin, getLeadCategory, canViewPage } from '../utils/authUtils';

/**
 * NotificationBell — navbar notifications for the admin ↔ user remark conversation.
 *  - User: new remarks the admin wrote on their leads
 *  - Admin: new replies users sent
 * Clicking one opens that lead's conversation on the Call Followup page.
 */
export default function NotificationBell({ user }) {
  const navigate = useNavigate();
  const isAdmin = isUserAdmin(user);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setItems(await leadApi.getRemarkNotifications(user));
    } catch (err) {
      console.warn('Could not load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load, every 30s, on window focus, and right after a remark is sent / opened
  useEffect(() => {
    load();
    const timer = setInterval(load, 30 * 1000);
    window.addEventListener('focus', load);
    window.addEventListener(REMARKS_CHANGED_EVENT, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener(REMARKS_CHANGED_EVENT, load);
    };
  }, [load]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unreadCount = items.filter(i => i.unread).length;

  const openItem = async (item) => {
    setOpen(false);
    setItems(prev => prev.map(i => (i.leadId === item.leadId ? { ...i, unread: false } : i)));
    if (item.unread) leadApi.markRemarksSeen(item.leadId, isAdmin).catch(() => {});
    if (canViewPage(user, 'callTracker')) {
      navigate('/call-tracker', {
        state: { tab: getLeadCategory(item.leadType, item.leadNo) || undefined, openRemarkLeadId: item.leadId, openRemarkNonce: Date.now() }
      });
    }
  };

  const markAllRead = async () => {
    const unread = items.filter(i => i.unread);
    setItems(prev => prev.map(i => ({ ...i, unread: false })));
    await Promise.all(unread.map(i => leadApi.markRemarksSeen(i.leadId, isAdmin).catch(() => {})));
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Notifications"
        className="relative p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
      >
        <Bell size={20} className={unreadCount > 0 ? 'animate-pulse' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-bold text-gray-900">Notifications</p>
              <p className="text-[11px] text-gray-400">
                {isAdmin ? 'Replies from users on remarks' : 'Remarks from admin on your leads'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center px-6">
                <div className="w-11 h-11 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-2">
                  <MessageSquare size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">No notifications yet.</p>
              </div>
            ) : (
              items.map(item => (
                <button
                  key={item.leadId}
                  onClick={() => openItem(item)}
                  className={`w-full text-left flex gap-3 px-4 py-2.5 border-b border-gray-50 transition ${item.unread ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isAdmin ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {isAdmin ? <User size={16} /> : <ShieldCheck size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] truncate ${item.unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {isAdmin ? `${item.from} replied` : 'Admin remark'}
                      </span>
                      {item.unread && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                    </span>
                    <span className="block text-[11px] text-indigo-600 font-medium truncate">
                      {item.personName} · {item.leadNo}
                    </span>
                    <span className="block text-xs text-gray-600 line-clamp-2 mt-0.5">"{item.text}"</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">{formatIST(item.date)} IST</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
