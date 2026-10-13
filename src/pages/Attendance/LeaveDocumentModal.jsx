import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Download, FileText, User, Calendar, Tag } from 'lucide-react';

export default function LeaveDocumentModal({ isOpen, onClose, leave }) {
  if (!isOpen || !leave) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              <span>Leave Supporting Document</span>
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Applicant: <strong className="text-gray-800">{leave.userName}</strong> ({leave.userPosition || 'Staff'})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-gray-50/50">
          {/* Leave Meta Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-white p-3 rounded-xl border border-gray-200">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Leave Type</span>
              <span className="font-semibold text-gray-800">{leave.leaveType}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Category</span>
              <span className="font-semibold text-gray-800">{leave.leaveCategory}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Duration</span>
              <span className="font-semibold text-indigo-700">
                {leave.fromDate === leave.toDate ? leave.fromDate : `${leave.fromDate} to ${leave.toDate}`} ({leave.totalDays}d)
              </span>
            </div>
            <div className="col-span-2 sm:col-span-3 pt-1 border-t border-gray-100">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Reason</span>
              <p className="text-gray-700 italic mt-0.5">{leave.reason}</p>
            </div>
          </div>

          {/* Document Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-2 flex items-center justify-center min-h-[250px] overflow-hidden">
            {leave.documentUrl ? (
              <img
                src={leave.documentUrl}
                alt="Leave attachment"
                className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-2xs"
              />
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs">
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                <p>No document attached for this leave request.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between flex-shrink-0">
          {leave.documentUrl ? (
            <a
              href={leave.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <ExternalLink size={13} /> Open in New Tab
            </a>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
