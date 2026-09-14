import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { MapPin, MessageSquare, UserCheck, Calendar } from 'lucide-react';
import { visitorApi } from '../../api/visitorApi';
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
        remarks: ''
      });
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVisitorChange = (val) => {
    setFormData(prev => ({
      ...prev,
      visitorName: val
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

      await visitorApi.saveAssignedVisitor(entry);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 tracking-wide uppercase">
            ASSIGN VISITOR — {lead.customerName || lead.personName || 'Lead'} ({lead.leadNo})
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Top Read-Only Summary Card matching Call Tracker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded p-3 text-xs mb-2 text-left">
            {leadInfoFields.map(f => (
              <div key={f.key || f.label} className="space-y-0.5">
                <span className="text-[10px] text-gray-700 uppercase tracking-tight font-medium leading-none block">{f.label}</span>
                <p className={`font-semibold truncate text-[11px] md:text-[12px] mt-0.5 ${f.highlight ? f.highlightClass : 'text-gray-900'}`} title={f.value || '-'}>
                  {f.value || '-'}
                </p>
              </div>
            ))}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            
            {/* Assign Visitor Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                ASSIGN VISITOR *
              </label>
              <SearchableDropdown
                options={visitorOptions}
                value={formData.visitorName}
                onChange={handleVisitorChange}
                placeholder="Select visitor / sales rep"
                height="h-[38px]"
              />
            </div>

            {/* Visit Date & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                  VISIT DATE *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.visitDate}
                    onChange={(e) => handleChange('visitDate', e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 h-[38px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                  LOCATION
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Site / meeting address"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 h-[38px]"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1">
              <label className="block text-[11px] md:text-[13px] font-medium text-gray-700 uppercase tracking-tight">
                REMARKS
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 text-gray-400" size={16} />
                <textarea
                  rows={3}
                  placeholder="Notes for the visitor"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2 text-xs md:text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 uppercase transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-xs md:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm uppercase transition-colors disabled:opacity-50"
            >
              {loading ? 'SAVING...' : 'SAVE'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
