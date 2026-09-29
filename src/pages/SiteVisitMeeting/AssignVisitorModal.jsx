import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { MapPin, UserCheck, Calendar, X } from 'lucide-react';
import { siteVisitMeetingApi } from '../../api/siteVisitMeetingApi';
import { masterApi } from '../../api/masterApi';
import SearchableDropdown from '../../components/SearchableDropdown';
import { formatInputDate } from './siteVisitMeetingConstants';
import { getLeadTypeBadgeClass } from '../../utils/leadTypeColors';

export default function AssignVisitorModal({ isOpen, onClose, lead, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [visitorsMaster, setVisitorsMaster] = useState([]);
  const [formData, setFormData] = useState({
    visitorName: '',
    visitorId: '',
    visitDate: '',
    location: '',
    remarks: ''
  });

  useEffect(() => {
    if (isOpen) {
      masterApi.getVisitors().then(visitors => {
        setVisitorsMaster(visitors || []);
      }).catch(console.error);
    }
  }, [isOpen]);

  // Filter visitors based on the lead's leadType
  const leadTypeClean = String(lead?.leadType || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const filteredVisitors = (visitorsMaster || []).filter(v => {
    if (!leadTypeClean) return true;
    const vTypeClean = String(v.leadType || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return vTypeClean === leadTypeClean;
  });

  const seen = new Set();
  const visitorOptions = [];
  (filteredVisitors.length > 0 ? filteredVisitors : (visitorsMaster || [])).forEach(v => {
    const raw = v?.personName;
    if (!raw) return;
    const clean = String(raw).replace(/\s+/g, ' ').trim();
    const lower = clean.toLowerCase();
    if (clean && !seen.has(lower)) {
      seen.add(lower);
      visitorOptions.push({ value: clean, label: clean });
    }
  });

  useEffect(() => {
    if (lead && isOpen) {
      setFormData({
        visitorName: lead.assignedVisitor || '',
        visitorId: lead.visitorId || '',
        visitDate: formatInputDate(lead.visitDate || lead.nextDate || new Date()),
        location: lead.location || lead.customerAddress || '',
        remarks: lead.visitorRemarks || ''
      });
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVisitorSelect = (name) => {
    const matched = (visitorsMaster || []).find(
      v => String(v.personName).trim().toLowerCase() === String(name).trim().toLowerCase()
    );
    setFormData(prev => ({
      ...prev,
      visitorName: name,
      visitorId: matched?.id || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.visitorName) {
      toast.error('Please select a visitor');
      return;
    }

    if (!formData.visitDate) {
      toast.error('Please specify a visit date');
      return;
    }

    setLoading(true);
    try {
      const entry = {
        leadId: lead.leadId || lead.id,
        leadNo: lead.leadNo,
        callTrackerId: lead.callTrackerId,
        visitorName: formData.visitorName,
        visitorId: formData.visitorId || null,
        visitDate: formData.visitDate,
        location: formData.location || '',
        remarks: formData.remarks || '',
        status: 'Assigned'
      };

      if (lead.assignedVisitorId) {
        await siteVisitMeetingApi.updateAssignedVisitor(lead.assignedVisitorId, entry);
        toast.success(`Visitor updated for ${lead.leadNo || 'lead'}`);
      } else {
        await siteVisitMeetingApi.saveAssignedVisitor(entry);
        toast.success(`Visitor assigned to ${lead.leadNo || 'lead'}`);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving assigned visitor:', err);
      toast.error('Failed to assign visitor: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold tracking-tight text-white bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/20 font-mono">
              {lead.leadNo || 'Lead'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getLeadTypeBadgeClass(lead.leadType)}`}>
              {lead.leadType || 'Real Estate'}
            </span>
            <span className="text-sm font-bold text-white">
              {lead.assignedVisitorId ? 'Reassign Visitor' : 'Assign Visitor'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lead Context Summary */}
        <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-b border-gray-200 text-xs flex flex-wrap gap-x-5 gap-y-1.5 text-gray-600">
          <div>
            <span className="text-gray-400 font-medium">Customer:</span>{' '}
            <span className="font-bold text-gray-900">{lead.customerName || lead.personName || '-'}</span>
          </div>
          <div>
            <span className="text-gray-400 font-medium">Contact:</span>{' '}
            <span className="font-semibold text-gray-800">{lead.customerNumber || lead.number || '-'}</span>
          </div>
          {lead.callTrackerRemarks && (
            <div className="w-full text-[11px] text-gray-500 italic mt-0.5 truncate">
              "{lead.callTrackerRemarks}"
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Visitor Select */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Select Visitor <span className="text-red-500">*</span>
            </label>
            <SearchableDropdown
              options={visitorOptions}
              value={formData.visitorName}
              onChange={handleVisitorSelect}
              placeholder="Search & select visitor..."
              emptyMessage={filteredVisitors.length === 0 && visitorsMaster.length > 0
                ? `No visitor for "${lead.leadType}". Showing all visitors.`
                : "No visitors available in Master"}
            />
          </div>

          {/* Visit Date & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Visit Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.visitDate}
                  onChange={(e) => handleChange('visitDate', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
                <Calendar size={14} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Site / Meeting Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g. Site address or Office"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <MapPin size={14} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Instructions / Remarks for Visitor
            </label>
            <textarea
              rows={3}
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Specific instructions, key preferences, directions..."
              className="w-full p-3 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <UserCheck size={14} />
              {loading ? 'Saving...' : (lead.assignedVisitorId ? 'Update Assignment' : 'Confirm Assignment')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
