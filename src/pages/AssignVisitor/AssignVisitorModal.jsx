import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { MapPin, MessageSquare, UserCheck, Calendar } from 'lucide-react';
import { siteVisitApi } from '../../api/siteVisitApi';
import { masterApi } from '../../api/masterApi';
import { settingApi } from '../../api/settingApi';
import SearchableDropdown from '../../components/SearchableDropdown';
import { formatInputDate } from './assignVisitorConstants';
import { getLeadTypeTextClass } from '../../utils/leadTypeColors';

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
      // Load visitors from Visitor Master (master_visitor_names)
      masterApi.getVisitors().then(visitors => {
        setVisitorsMaster(visitors || []);
      }).catch(console.error);
    }
  }, [isOpen]);

  // Filter visitors based on the lead's leadType
  const leadTypeClean = String(lead?.leadType || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const matchingVisitors = (visitorsMaster || []).filter(v => {
    if (!leadTypeClean) return true;
    const vTypeClean = String(v.leadType || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return !vTypeClean || vTypeClean === leadTypeClean || vTypeClean.includes(leadTypeClean) || leadTypeClean.includes(vTypeClean);
  });

  const pool = matchingVisitors.length > 0 ? matchingVisitors : (visitorsMaster || []);

  const seen = new Set();
  const visitorOptions = [];
  pool.forEach(v => {
    const raw = v?.personName || v?.name || v?.visitorName || v?.visitor_name;
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
        remarks: ''
      });
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVisitorChange = (val) => {
    const matched = (visitorsMaster || []).find(
      v => String(v.personName || v.name || v.visitorName || '').trim().toLowerCase() === String(val).trim().toLowerCase()
    );
    setFormData(prev => ({
      ...prev,
      visitorName: val,
      visitorId: matched?.id || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.visitorName.trim()) {
      toast.error('Please select a visitor / sales rep');
      return;
    }

    if (!formData.visitDate) {
      toast.error('Visit Date is required');
      return;
    }

    setLoading(true);

    try {
      const entry = {
        leadId: lead.id,
        leadNo: lead.leadNo,
        callTrackerId: lead.callTrackerId || null,
        visitorName: formData.visitorName.trim(),
        visitorId: formData.visitorId || null,
        visitDate: formData.visitDate,
        location: formData.location.trim(),
        remarks: formData.remarks.trim(),
        status: 'Assigned'
      };

      await siteVisitApi.saveAssignedVisitor(entry);
      toast.success(`Visitor assigned successfully for Lead ${lead.leadNo}`);
      setLoading(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to assign visitor:', err);
      toast.error('Failed to assign visitor. Please try again.');
      setLoading(false);
    }
  };

  const isRealEstate =
    (lead?.leadType || '').trim().toLowerCase() === 'real estate' ||
    (lead?.leadNo || '').trim().toUpperCase().startsWith('LR');
  const isMutualFund = (lead?.leadType || '').trim().toLowerCase() === 'mutual fund';
  const isInsurance = (lead?.leadType || '').trim().toLowerCase().includes('insurance');

  // Comprehensive lead information fields shown in top card
  const leadInfoFields = [
    { key: 'leadType', label: 'Lead Type', value: lead.leadType, highlight: true, highlightClass: getLeadTypeTextClass(lead.leadType) },
    { key: 'caller', label: 'Caller Name', value: lead.callerAssigned || lead.caller || lead.callerName || '-' },
    { key: 'leadReceiver', label: 'Team Member Name', value: lead.relationshipManager || lead.leadReceiver || '-' },
    { key: 'leadSource', label: 'Lead Source', value: lead.leadSource || '-' },
    { key: 'referencerName', label: 'Reference Name', value: lead.referencerName || lead.referenceName || '-' },
    { key: 'customerName', label: 'Customer Name', value: lead.customerName || lead.personName || '-' },
    { key: 'customerNumber', label: 'Customer Number', value: lead.customerNumber || lead.number || '-' },
    { key: 'customerEmail', label: 'Customer Email', value: lead.customerEmail || lead.email || '-' },
    { key: 'dob', label: 'DOB', value: lead.dob || '-' },
    { key: 'occupation', label: 'Occupation', value: lead.occupation || '-' },
    { key: 'customerAddress', label: 'Customer Address', value: lead.customerAddress || lead.location || '-' },
    { key: 'investmentBudget', label: 'Investment Budget', value: lead.investmentBudget || '-' },
    { key: 'whenToBuyPlan', label: 'When To Buy Plan', value: lead.whenToBuyPlan || '-' },
    ...(isRealEstate || isMutualFund || lead.productType ? [{ key: 'productType', label: 'Product Type', value: lead.productType || '-' }] : []),
    ...(isRealEstate || lead.requirement ? [{ key: 'requirement', label: 'Requirement', value: lead.customRequirement || lead.requirement || '-' }] : []),
    ...(isInsurance || lead.insuranceType ? [{ key: 'insuranceType', label: 'Insurance Type', value: lead.insuranceType || '-' }] : []),
    ...(isInsurance || lead.insuranceSubType ? [{ key: 'insuranceSubType', label: 'Sub Product Type', value: lead.insuranceSubType || '-' }] : []),
    ...(isInsurance || lead.anyDesease ? [{ key: 'anyDesease', label: 'Medical Condition', value: lead.anyDesease || lead.anyDisease || '-' }] : []),
    ...(lead.remarks ? [{ key: 'remarks', label: 'Remarks', value: lead.remarks }] : [])
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-5 md:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88dvh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-gray-100/80 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xs sm:text-base font-bold text-gray-800 tracking-wide uppercase truncate">
            ASSIGN VISITOR — {lead.customerName || lead.personName || 'Lead'} ({lead.leadNo})
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
          
          {/* Top Read-Only Summary Card matching Call Tracker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 sm:p-3 text-xs mb-2 text-left">
            {leadInfoFields.map(f => (
              <div key={f.key || f.label} className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] text-gray-600 uppercase tracking-tight font-medium leading-none block">{f.label}</span>
                <p className={`font-semibold truncate text-[11px] sm:text-[12px] mt-0.5 ${f.highlight ? f.highlightClass : 'text-gray-900'}`} title={f.value || '-'}>
                  {f.value || '-'}
                </p>
              </div>
            ))}
          </div>

          {/* Form Fields */}
          <div className="space-y-3 sm:space-y-4">
            
            {/* Assign Visitor Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] sm:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                ASSIGN VISITOR *
              </label>
              <SearchableDropdown
                options={visitorOptions}
                value={formData.visitorName}
                onChange={handleVisitorChange}
                placeholder="Select visitor / sales rep"
                height="h-[34px] sm:h-[38px]"
              />
            </div>

            {/* Visit Date & Location (2-column on mobile) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] sm:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                  VISIT DATE *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.visitDate}
                    onChange={(e) => handleChange('visitDate', e.target.value)}
                    className="w-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 h-[34px] sm:h-[38px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] sm:text-[13px] font-medium text-gray-700 uppercase tracking-tight truncate">
                  LOCATION
                </label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Site address"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    className="w-full pl-8 sm:pl-9 pr-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 h-[34px] sm:h-[38px]"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1">
              <label className="block text-[11px] sm:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                REMARKS
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                <textarea
                  rows={2.5}
                  placeholder="Notes for the visitor"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 uppercase transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm uppercase transition-colors disabled:opacity-50"
            >
              {loading ? 'SAVING...' : 'SAVE'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
