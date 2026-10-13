import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { LogOut, Clock, User, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { formatVisitorTime, getVisitDuration } from './receptionConstants';
import { authApi } from '../../api/authApi';

export default function CheckOutModal({ isOpen, onClose, visitor, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [samePersonMet, setSamePersonMet] = useState(true);
  const [personActuallyMetName, setPersonActuallyMetName] = useState('');
  const [personActuallyMetId, setPersonActuallyMetId] = useState(null);
  const [checkoutRemarks, setCheckoutRemarks] = useState('');

  useEffect(() => {
    if (!isOpen || !visitor) return;

    let isMounted = true;
    authApi.getUsers().then(users => {
      if (isMounted) setUsersList(users || []);
    }).catch(() => []);

    setSamePersonMet(true);
    setPersonActuallyMetName(visitor.personActuallyMetName || visitor.personToMeetName || '');
    setPersonActuallyMetId(visitor.personActuallyMetId || visitor.personToMeetId || null);
    setCheckoutRemarks('');
    setLoading(false);

    return () => { isMounted = false; };
  }, [isOpen, visitor]);

  const employeeOptions = useMemo(() => {
    return (usersList || [])
      .filter(u => u && u.name)
      .map(u => ({
        value: u.name,
        label: u.position ? `${u.name} (${u.position})` : u.name,
        id: u.dbId || u.id
      }));
  }, [usersList]);

  if (!isOpen || !visitor) return null;

  const currentDuration = getVisitDuration(visitor.checkInAt, null);
  const checkoutTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleActualPersonChange = (empName) => {
    const matched = employeeOptions.find(o => o.value.toLowerCase() === String(empName || '').toLowerCase());
    setPersonActuallyMetName(empName);
    setPersonActuallyMetId(matched?.id || null);
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const payload = {
        personActuallyMetName: samePersonMet ? visitor.personToMeetName : personActuallyMetName,
        personActuallyMetId: samePersonMet ? visitor.personToMeetId : personActuallyMetId,
        checkoutRemarks: checkoutRemarks.trim(),
        existingRemarks: visitor.remarks || ''
      };

      await onConfirm?.(visitor.id, payload);
      toast.success(`${visitor.visitorName} checked out successfully`);
      onClose();
    } catch (err) {
      console.error('Check-out failed:', err);
      toast.error(err.message || 'Failed to check out visitor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Visitor Check-Out Confirmation"
      onSubmit={handleConfirm}
      submitText={loading ? 'Processing...' : 'Confirm Check Out'}
      loading={loading}
      maxWidth="max-w-md"
    >
      <div className="space-y-3 text-xs">
        {/* Visitor Card Summary */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900">{visitor.visitorName}</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Inside ({currentDuration})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 pt-1">
            <div>
              <span className="text-gray-400">Mobile:</span>{' '}
              <span className="font-semibold text-gray-800">{visitor.mobileNumber}</span>
            </div>
            <div>
              <span className="text-gray-400">Purpose:</span>{' '}
              <span className="font-semibold text-indigo-700">{visitor.visitPurpose}</span>
            </div>
            <div>
              <span className="text-gray-400">Check-In:</span>{' '}
              <span className="font-medium text-gray-800">{formatVisitorTime(visitor.checkInAt)}</span>
            </div>
            <div>
              <span className="text-gray-400">Check-Out:</span>{' '}
              <span className="font-bold text-emerald-700">Now ({checkoutTimeStr})</span>
            </div>
          </div>
        </div>

        {/* Intended vs Actually Met Section */}
        <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">Intended Host:</span>
            <span className="font-bold text-indigo-950">{visitor.personToMeetName || '-'}</span>
          </div>

          <div className="pt-1 border-t border-indigo-100/80">
            <label className="block text-[11px] font-semibold text-indigo-900 mb-1.5">
              Did they meet <span className="underline">{visitor.personToMeetName || 'the intended host'}</span>?
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800 select-none">
                <input
                  type="radio"
                  name="sameHostRadio"
                  checked={samePersonMet}
                  onChange={() => setSamePersonMet(true)}
                  className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Yes, met {visitor.personToMeetName || 'intended person'}</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800 select-none">
                <input
                  type="radio"
                  name="sameHostRadio"
                  checked={!samePersonMet}
                  onChange={() => setSamePersonMet(false)}
                  className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Met someone else</span>
              </label>
            </div>

            {!samePersonMet && (
              <div className="mt-2.5 animate-in fade-in duration-150">
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-tight mb-1">
                  Select Person Actually Met <span className="text-rose-500">*</span>
                </label>
                <SearchableDropdown
                  options={employeeOptions}
                  value={personActuallyMetName}
                  onChange={handleActualPersonChange}
                  placeholder="Select actual employee met..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Departure Notes / Feedback */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Check-out Remarks / Meeting Outcome <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={checkoutRemarks}
            onChange={(e) => setCheckoutRemarks(e.target.value)}
            placeholder="e.g. Meeting concluded, sample approved, next appointment scheduled..."
            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
          />
        </div>
      </div>
    </ModalForm>
  );
}
