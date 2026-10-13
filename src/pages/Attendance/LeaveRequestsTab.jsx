import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  Calendar,
  CalendarDays,
  Check,
  X,
  Clock,
  FileText,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  CalendarPlus,
  RotateCcw,
  Tag
} from 'lucide-react';
import {
  leaveRequestApi,
  LEAVE_STATUS_STYLES,
  LEAVE_CATEGORY_TYPES
} from '../../api/leaveRequestApi';
import LeaveDocumentModal from './LeaveDocumentModal';
import RejectLeaveModal from './RejectLeaveModal';

export default function LeaveRequestsTab({
  leaveRequests = [],
  loading = false,
  onRefresh,
  isAdmin = false,
  canManage = null,
  isTester = false,
  user = null,
  onOpenApply = null
}) {
  const isManagementView = isAdmin || canManage !== null;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(isManagementView ? 'PENDING' : 'ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedDocLeave, setSelectedDocLeave] = useState(null);
  const [rejectingLeave, setRejectingLeave] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);



  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Stats calculation
  const stats = useMemo(() => {
    const total = leaveRequests.length;
    const pending = leaveRequests.filter(l => l.status === 'PENDING').length;
    const approved = leaveRequests.filter(l => l.status === 'APPROVED').length;
    const rejected = leaveRequests.filter(l => l.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [leaveRequests]);

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    return leaveRequests.filter(item => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && item.leaveCategory !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (item.userName || '').toLowerCase().includes(q);
        const matchesReason = (item.reason || '').toLowerCase().includes(q);
        const matchesType = (item.leaveType || '').toLowerCase().includes(q);
        const matchesCategory = (item.leaveCategory || '').toLowerCase().includes(q);
        const matchesDates = (item.fromDate || '').includes(q) || (item.toDate || '').includes(q);
        if (!matchesName && !matchesReason && !matchesType && !matchesCategory && !matchesDates) {
          return false;
        }
      }
      return true;
    });
  }, [leaveRequests, statusFilter, categoryFilter, searchQuery]);

  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage) || 1;
  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeaves.slice(start, start + itemsPerPage);
  }, [filteredLeaves, currentPage, itemsPerPage]);

  const canPerformAdminActions = canManage !== null ? canManage : isAdmin;
  const showApplicantColumn = isManagementView;

  // Admin Actions
  const handleAccept = async (leave) => {
    if (!canPerformAdminActions) return;
    if (actionLoading) return;

    setActionLoading(true);
    try {
      await leaveRequestApi.updateLeaveStatus(leave.id, {
        status: 'APPROVED',
        reviewedBy: user?.name || user?.username || 'Admin',
        reviewedById: user?.id || null
      });
      toast.success(`Leave request approved for ${leave.userName}`);
      onRefresh?.();
    } catch (err) {
      console.error('Error approving leave:', err);
      toast.error('Failed to approve leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async (leaveId, adminNotes) => {
    if (!canPerformAdminActions) return;
    setActionLoading(true);
    try {
      await leaveRequestApi.updateLeaveStatus(leaveId, {
        status: 'REJECTED',
        adminNotes,
        reviewedBy: user?.name || user?.username || 'Admin',
        reviewedById: user?.id || null
      });
      toast.success('Leave request rejected');
      setRejectingLeave(null);
      onRefresh?.();
    } catch (err) {
      console.error('Error rejecting leave:', err);
      toast.error('Failed to reject leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateDisplay = (from, to) => {
    if (!from) return '-';
    if (!to || from === to) return from;
    return `${from} to ${to}`;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
      {/* Top Stat Pills & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">


        {/* Stat badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setStatusFilter('PENDING'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>Pending</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'PENDING' ? 'bg-white/20' : 'bg-amber-200/80 font-bold'}`}>
              {stats.pending}
            </span>
          </button>

          <button
            onClick={() => { setStatusFilter('APPROVED'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>Approved</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {stats.approved}
            </span>
          </button>

          <button
            onClick={() => { setStatusFilter('REJECTED'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>Rejected</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {stats.rejected}
            </span>
          </button>

          <button
            onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <span>All Requests</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {stats.total}
            </span>
          </button>
        </div>

      </div>

      {/* Search and Secondary Filter Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative flex-1 w-full max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={isManagementView ? "Search applicant name, reason, category..." : "Search your leave applications..."}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex-1 sm:flex-none"
          >
            <option value="ALL">All Categories</option>
            {LEAVE_CATEGORY_TYPES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition shadow-2xs cursor-pointer flex-shrink-0"
            title="Refresh leave requests"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Table / Cards Container */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-400 text-xs">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mr-2" />
            Loading leave requests...
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 text-xs">
            <Calendar size={36} className="mb-2 text-gray-300" />
            <p className="font-semibold text-gray-600 text-sm">No leave requests found</p>
            <p className="text-gray-400 mt-1 max-w-xs">
              {searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'Try adjusting your search query or filters.'
                : 'No employees have applied for leave yet.'}
            </p>
            {onOpenApply && (
              <button
                onClick={onOpenApply}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
              >
                <CalendarPlus size={14} /> Apply Now
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 sticky top-0 z-10 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5 text-center w-12">#</th>
                  {showApplicantColumn && <th className="px-3.5 py-2.5">Applicant</th>}
                  <th className="px-3.5 py-2.5">Leave Type</th>
                  <th className="px-3.5 py-2.5">Category</th>
                  <th className="px-3.5 py-2.5">Leave Dates & Days</th>
                  <th className="px-3.5 py-2.5 min-w-[180px]">Reason</th>
                  <th className="px-3.5 py-2.5 text-center">Attachment</th>
                  <th className="px-3.5 py-2.5 text-center">Applied On</th>
                  <th className="px-3.5 py-2.5 text-center min-w-[140px]">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedLeaves.map((leave, idx) => {
                  const serialNo = (currentPage - 1) * itemsPerPage + idx + 1;
                  const statusConfig = LEAVE_STATUS_STYLES[leave.status] || LEAVE_STATUS_STYLES.PENDING;

                  return (
                    <tr key={leave.id} className="hover:bg-indigo-50/30 transition-colors">
                      {/* Serial */}
                      <td className="px-3.5 py-2.5 text-center font-bold text-gray-500 text-[11px]">
                        {serialNo}
                      </td>

                      {/* Applicant (For Admin or All Requests view) */}
                      {showApplicantColumn && (
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                              {leave.userName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 leading-tight truncate">
                                {leave.userName}
                              </p>
                              {leave.userPosition && (
                                <p className="text-[10px] text-gray-500 leading-tight truncate">
                                  {leave.userPosition}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Duration Type */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          leave.leaveType === 'Full Day'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {leave.leaveType}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-gray-700">
                        {leave.leaveCategory}
                      </td>

                      {/* Dates & Duration */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800">
                          <Calendar size={12} className="text-gray-400" />
                          <span>{formatDateDisplay(leave.fromDate, leave.toDate)}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600">
                            {leave.totalDays} {leave.totalDays === 1 ? 'day' : leave.totalDays === 0.5 ? 'half-day' : 'days'}
                          </span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="px-3.5 py-2.5">
                        <p className="text-gray-700 line-clamp-2" title={leave.reason}>
                          {leave.reason}
                        </p>
                        {leave.adminNotes && leave.status === 'REJECTED' && (
                          <p className="text-[10px] text-rose-600 mt-0.5 italic">
                            Admin Note: {leave.adminNotes}
                          </p>
                        )}
                      </td>

                      {/* Attachment Proof */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        {leave.documentUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDocLeave(leave)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-[10px] font-bold transition shadow-2xs cursor-pointer"
                            title="View attachment proof"
                          >
                            <Eye size={12} />
                            <span>Proof Image</span>
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Applied On */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap text-[11px] text-gray-500 font-mono">
                        {leave.appliedAt ? new Date(leave.appliedAt).toLocaleDateString() : '-'}
                      </td>

                      {/* Status / Action — merged column */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        {canPerformAdminActions && leave.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleAccept(leave)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                              title="Accept / Approve Leave"
                            >
                              <Check size={12} />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => setRejectingLeave(leave)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                              title="Reject Leave"
                            >
                              <X size={12} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusConfig.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            <span>{statusConfig.label}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredLeaves.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
            <span>
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredLeaves.length)} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredLeaves.length)} of {filteredLeaves.length} requests
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Prev
                </button>
                <span className="px-2 text-xs font-semibold text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox / Document Preview Modal */}
      <LeaveDocumentModal
        isOpen={!!selectedDocLeave}
        onClose={() => setSelectedDocLeave(null)}
        leave={selectedDocLeave}
      />

      {/* Reject Confirmation / Notes Modal */}
      <RejectLeaveModal
        isOpen={!!rejectingLeave}
        onClose={() => setRejectingLeave(null)}
        leave={rejectingLeave}
        onConfirm={handleRejectConfirm}
        loading={actionLoading}
      />
    </div>
  );
}
