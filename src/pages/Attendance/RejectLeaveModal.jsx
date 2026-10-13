import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import ModalForm from '../../components/ModalForm';

export default function RejectLeaveModal({ isOpen, onClose, leave, onConfirm, loading }) {
  const [adminNotes, setAdminNotes] = useState('');

  if (!isOpen || !leave) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(leave.id, adminNotes);
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Leave Request"
      onSubmit={handleSubmit}
      submitText={loading ? 'Rejecting...' : 'Confirm Rejection'}
      cancelText="Back"
      loading={loading}
      maxWidth="max-w-md"
    >
      <div className="space-y-3 text-xs">
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-950">
              Reject leave for {leave.userName}?
            </p>
            <p className="text-[11px] text-rose-800 mt-0.5">
              Dates: {leave.fromDate === leave.toDate ? leave.fromDate : `${leave.fromDate} to ${leave.toDate}`} ({leave.totalDays}d)
            </p>
            <p className="text-[11px] text-gray-600 italic mt-1 bg-white/70 p-1.5 rounded border border-rose-100">
              "{leave.reason}"
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1">
            Rejection Reason / Notes (Optional)
          </label>
          <textarea
            rows={3}
            autoFocus
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="e.g. Critical meeting scheduled on this date, high project load, please reschedule..."
            className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
          />
        </div>
      </div>
    </ModalForm>
  );
}
