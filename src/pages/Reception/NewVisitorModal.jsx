import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { User, Phone, Building2, Briefcase, MapPin, ClipboardList, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import {
  VISIT_PURPOSE_OPTIONS,
  VISITOR_TYPE_OPTIONS,
  VISIT_LOCATION_OPTIONS
} from './receptionConstants';
import { authApi } from '../../api/authApi';
import { masterApi } from '../../api/masterApi';
import { useAuthStore } from '../../store/authStore';

export default function NewVisitorModal({ isOpen, onClose, onSaved }) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

  const initialFormState = {
    visitorName: '',
    mobileNumber: '',
    companyName: '',
    visitorType: 'Client',
    visitPurpose: 'Meeting',
    customPurpose: '',
    visitLocation: 'Office',
    projectName: '',
    projectId: null,
    personToMeetName: '',
    personToMeetId: null,
    department: '',
    remarks: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // Load active employees and real estate projects for selection
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    Promise.all([
      authApi.getUsers().catch(() => []),
      masterApi.getRealEstateProducts().catch(() => [])
    ]).then(([users, projects]) => {
      if (!isMounted) return;
      setUsersList(users || []);
      setProjectsList(projects || []);
    });

    return () => { isMounted = false; };
  }, [isOpen]);

  // Clean form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormState);
      setLoading(false);
    }
  }, [isOpen]);

  // Employees dropdown options
  const employeeOptions = useMemo(() => {
    return (usersList || [])
      .filter(u => u && u.name)
      .map(u => ({
        value: u.name,
        label: u.position ? `${u.name} (${u.position})` : u.name,
        userObj: u
      }));
  }, [usersList]);

  // Projects dropdown options (for site visits)
  const projectOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    (projectsList || []).forEach(p => {
      const name = p.project_name || p.title || p.product_type;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        opts.push({
          value: name,
          label: name,
          id: p.id
        });
      }
    });
    return opts;
  }, [projectsList]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // When selecting employee, auto-derive their department / position
  const handleEmployeeChange = (employeeName) => {
    const matched = (usersList || []).find(
      u => u.name?.trim().toLowerCase() === String(employeeName || '').trim().toLowerCase()
    );
    setFormData(prev => ({
      ...prev,
      personToMeetName: employeeName,
      personToMeetId: matched?.dbId || matched?.id || null,
      department: matched?.position || prev.department || ''
    }));
  };

  const handleProjectChange = (projName) => {
    const matched = (projectOptions || []).find(
      p => p.value.toLowerCase() === String(projName || '').toLowerCase()
    );
    setFormData(prev => ({
      ...prev,
      projectName: projName,
      projectId: matched?.id || null
    }));
  };

  const cleanPhone = (val) => String(val || '').replace(/[^0-9]/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = formData.visitorName.trim();
    if (!trimmedName) {
      toast.error('Visitor Full Name is required');
      return;
    }

    const cleanedMobile = cleanPhone(formData.mobileNumber);
    if (!cleanedMobile || cleanedMobile.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!formData.visitPurpose) {
      toast.error('Please select a visit purpose');
      return;
    }

    const finalPurpose = formData.visitPurpose === 'Other'
      ? (formData.customPurpose.trim() || 'Other')
      : formData.visitPurpose;

    if (!formData.personToMeetName.trim()) {
      toast.error('Please select the person to meet');
      return;
    }

    // Site visit requires project/site specification
    if (formData.visitLocation === 'Construction Site' && !formData.projectName.trim()) {
      toast.error('Please specify the construction project or site name');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        visitorName: trimmedName,
        mobileNumber: cleanedMobile.slice(-10),
        visitPurpose: finalPurpose
      };

      await onSaved?.(payload);
      toast.success(`Visitor ${trimmedName} checked in successfully!`);
      onClose();
    } catch (err) {
      console.error('Failed to register visitor:', err);
      toast.error(err.message || 'Failed to register visitor');
    } finally {
      setLoading(false);
    }
  };

  const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Visitor"
      onSubmit={handleSubmit}
      submitText={loading ? 'Checking In...' : 'Check In Visitor'}
      loading={loading}
      maxWidth="max-w-2xl"
    >
      {/* Real-time Check-in Stamp Banner */}
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 mb-1">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-indigo-600 animate-pulse" />
          <span>
            Check-in Time: <strong className="font-semibold text-indigo-950">Today, {currentTimeStr}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-indigo-700">
          <ShieldCheck size={13} className="text-indigo-500" />
          <span>Receptionist: <strong>{user?.name || user?.username || 'Staff'}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
        {/* Section 1: Visitor Information */}
        <div className="sm:col-span-2 pt-1 border-b border-gray-100 pb-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          <User size={13} className="text-gray-400" />
          <span>Visitor Information</span>
        </div>

        {/* Visitor Full Name */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visitor Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              required
              value={formData.visitorName}
              onChange={(e) => handleChange('visitorName', e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Mobile Number */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Mobile Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="tel"
              required
              maxLength={10}
              value={formData.mobileNumber}
              onChange={(e) => handleChange('mobileNumber', e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Company / Organization */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Company / Organization <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              placeholder="e.g. Apex Enterprises / Self"
              className="w-full border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Visitor Type */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visitor Category / Type
          </label>
          <SearchableDropdown
            options={VISITOR_TYPE_OPTIONS}
            value={formData.visitorType}
            onChange={(val) => handleChange('visitorType', val)}
            placeholder="Select visitor type"
          />
        </div>

        {/* Section 2: Visit Information */}
        <div className="sm:col-span-2 pt-2 border-b border-gray-100 pb-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          <Briefcase size={13} className="text-gray-400" />
          <span>Visit Information</span>
        </div>

        {/* Visit Purpose */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visit Purpose <span className="text-rose-500">*</span>
          </label>
          <SearchableDropdown
            options={VISIT_PURPOSE_OPTIONS}
            value={formData.visitPurpose}
            onChange={(val) => handleChange('visitPurpose', val)}
            placeholder="Select purpose"
          />
          {formData.visitPurpose === 'Other' && (
            <input
              type="text"
              autoFocus
              value={formData.customPurpose}
              onChange={(e) => handleChange('customPurpose', e.target.value)}
              placeholder="Specify visit purpose..."
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          )}
        </div>

        {/* Visit Location */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visit Location <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {VISIT_LOCATION_OPTIONS.map(loc => (
              <label
                key={loc.value}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition select-none ${
                  formData.visitLocation === loc.value
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <input
                  type="radio"
                  name="visitLocationRadio"
                  value={loc.value}
                  checked={formData.visitLocation === loc.value}
                  onChange={() => handleChange('visitLocation', loc.value)}
                  className="sr-only"
                />
                <MapPin size={12} />
                <span>{loc.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Project / Site (Relevant for Construction Site or Site Visit) */}
        {(formData.visitLocation === 'Construction Site' || formData.visitPurpose === 'Site Visit') && (
          <div className="sm:col-span-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200 animate-in fade-in duration-150">
            <label className="block text-[11px] font-semibold text-amber-900 mb-1">
              Project / Construction Site Name <span className="text-rose-500">*</span>
            </label>
            <SearchableDropdown
              options={projectOptions}
              value={formData.projectName}
              onChange={handleProjectChange}
              onAdd={(term) => handleProjectChange(term)}
              placeholder="Select or enter project name (e.g. Villa Vrindavan)"
            />
          </div>
        )}

        {/* Person to Meet */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Person to Meet <span className="text-rose-500">*</span>
          </label>
          <SearchableDropdown
            options={employeeOptions}
            value={formData.personToMeetName}
            onChange={handleEmployeeChange}
            placeholder="Select employee / host..."
          />
        </div>

        {/* Department / Role */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Department / Position
          </label>
          <input
            type="text"
            value={formData.department}
            onChange={(e) => handleChange('department', e.target.value)}
            placeholder="e.g. Sales, Site Engineer, HR"
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Remarks / Visit Description */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Remarks / Visit Notes <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={formData.remarks}
            onChange={(e) => handleChange('remarks', e.target.value)}
            placeholder="Additional notes, luggage/material brought, appointment details..."
            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
          />
        </div>
      </div>
    </ModalForm>
  );
}
