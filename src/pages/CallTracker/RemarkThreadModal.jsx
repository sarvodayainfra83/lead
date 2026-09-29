import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X, ShieldCheck, User, Send, MessageSquare } from 'lucide-react';
import { leadApi, formatIST } from '../../api/leadApi';
import { useAuthStore } from '../../store/authStore';

/**
 * RemarkThreadModal — admin ↔ user conversation for one lead (lead_remarks table, by lead_id).
 * Every message is kept (nothing is overwritten); the newest message appears at the bottom.
 *
 * Props: isOpen, onClose, lead, isAdmin, onSaved(leadId, latestSummary)
 */
export default function RemarkThreadModal({ isOpen, onClose, lead, isAdmin, onSaved }) {
  const user = useAuthStore(state => state.user);
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !lead?.id) return;
    let cancelled = false;
    setDraft('');
    setLoadingThread(true);
    leadApi.getLeadRemarkThread(lead.id)
      .then(rows => {
        if (cancelled) return;
        // Older remarks saved before the conversation table existed: show the latest pair
        if (rows.length === 0 && (lead.adminRemark || lead.userRemark)) {
          const legacy = [
            lead.adminRemark && { id: 'legacy-admin', role: 'ADMIN', authorName: 'Admin', remark: lead.adminRemark, createdAt: lead.adminRemarkDate },
            lead.userRemark && { id: 'legacy-user', role: 'USER', authorName: lead.callerAssigned || 'User', remark: lead.userRemark, createdAt: lead.userRemarkDate }
          ].filter(Boolean).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          setThread(legacy);
        } else {
          setThread(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThread([]);
          toast.error('Could not load remarks. Please make sure the lead_remarks table is created.');
        }
      })
      .finally(() => { if (!cancelled) setLoadingThread(false); });
    return () => { cancelled = true; };
  }, [isOpen, lead]);

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread, isOpen]);

  if (!isOpen || !lead) return null;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) { toast.error('Please write a message'); return; }
    setSending(true);
    try {
      const { entry, summary } = await leadApi.addLeadRemark(lead.id, {
        role: isAdmin ? 'ADMIN' : 'USER',
        authorName: user?.name || (isAdmin ? 'Admin' : 'User'),
        remark: text
      });
      setThread(prev => [...prev, entry]);
      setDraft('');
      toast.success(isAdmin ? 'Remark sent' : 'Reply sent');
      onSaved?.(lead.id, summary);
    } catch (err) {
      console.error('Failed to send remark:', err);
      toast.error('Failed to send. Please make sure the lead_remarks table is created.');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
              <MessageSquare size={15} className="text-indigo-600" />
              {lead.personName || lead.customerName || 'Lead'}
            </h3>
            <p className="text-[11px] text-gray-400">
              {lead.leadNo}{lead.callerAssigned ? ` · Caller: ${lead.callerAssigned}` : ''} · {thread.length} message{thread.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Conversation (oldest → newest) */}
        <div className="flex-1 min-h-[140px] overflow-y-auto px-4 py-3 space-y-2.5 bg-slate-50/60">
          {loadingThread ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : thread.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-8">
              {isAdmin ? 'Start the conversation — write a remark for the caller below.' : 'No remarks yet.'}
            </p>
          ) : (
            thread.map((m, idx) => {
              const fromAdmin = m.role === 'ADMIN';
              // Sender (the person viewing) on the right, the other side on the left
              const isMine = isAdmin ? fromAdmin : !fromAdmin;
              return (
                <div key={m.id || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-2xs border ${
                    isMine
                      ? 'bg-indigo-600 border-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white border-gray-200 rounded-tl-sm'
                  }`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                      isMine ? 'text-indigo-100 justify-end' : (fromAdmin ? 'text-indigo-600' : 'text-emerald-700')
                    }`}>
                      {fromAdmin ? <ShieldCheck size={10} /> : <User size={10} />}
                      {isMine ? 'You' : `${fromAdmin ? 'Admin' : 'User'}${m.authorName ? ` · ${m.authorName}` : ''}`}
                    </p>
                    <p className={`text-[13px] whitespace-pre-wrap break-words mt-0.5 ${isMine ? 'text-white' : 'text-gray-800'}`}>{m.remark}</p>
                    {m.createdAt && (
                      <p className={`text-[10px] mt-1 text-right ${isMine ? 'text-indigo-200' : 'text-gray-400'}`}>{formatIST(m.createdAt)} IST</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="px-3 py-2.5 border-t border-gray-100 flex items-end gap-2 flex-shrink-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={2}
            autoFocus
            placeholder={isAdmin ? 'Write a remark for the caller...' : 'Write your reply to admin...'}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            title={isAdmin ? 'Send remark' : 'Send reply'}
            className="h-[38px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 flex-shrink-0"
          >
            <Send size={13} /> {sending ? '...' : (isAdmin ? 'Send' : 'Reply')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
