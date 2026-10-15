import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { User, Phone, Building2, Briefcase, MapPin, ClipboardList, Clock, ShieldCheck, CheckCircle2, Calendar, LogOut, X } from 'lucide-react';
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

const getTodayDateStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getCurrentTimeStr = () => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
};

export default function NewVisitorModal({ isOpen, onClose, onSaved }) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

  const getInitialFormState = () => ({
    visitorName: '',
    mobileNumber: '',
    companyName: '',
    visitorType: 'Client',
    visitPurpose: '',
    customPurpose: '',
    supplyItemName: '',
    visitLocation: 'Office',
    projectName: '',
    projectId: null,
    selectedEmployee: '',
    personToMeetName: '',
    adminName: '',
    personToMeetId: null,
    department: '',
    remarks: '',
    checkInDate: getTodayDateStr(),
    checkInTime: getCurrentTimeStr()
  });

  const [formData, setFormData] = useState(getInitialFormState);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [showOtherSites, setShowOtherSites] = useState(false);
  const [newProjectInput, setNewProjectInput] = useState('');
  const [customProjectsList, setCustomProjectsList] = useState([]);

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
      setFormData(getInitialFormState());
      setShowNewProjectInput(false);
      setShowOtherSites(false);
      setNewProjectInput('');
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

  // Projects dropdown options (for site visits / construction sites)
  const projectOptions = useMemo(() => {
    const MAIN_SITE = 'Crown Business Park';

    if (!showOtherSites) {
      return [
        { value: MAIN_SITE, label: MAIN_SITE, id: null },
        { value: '__SHOW_OTHER__', label: '📁 + Other Sites (Bhardwaj Sky, etc.)...', isAction: true }
      ];
    }

    const seen = new Set();
    const opts = [];

    // Always include Main site first
    seen.add(MAIN_SITE.toLowerCase());
    seen.add('crown business center');
    opts.push({ value: MAIN_SITE, label: MAIN_SITE, id: null });

    // Prepend custom entered projects
    customProjectsList.forEach(name => {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        opts.push({ value: name, label: `${name} (Custom)`, id: null });
      }
    });

    // Other active construction projects (Bhardwaj Sky, Vrindavan Garden, etc.)
    const OTHER_PROJECTS = [
      'Bhardwaj Sky',
      'Vrindavan Garden',
      'Bajaj sky heights',
      'Amaltas castle',
      'Shanti Kunj',
      'Wind chimes'
    ];
    OTHER_PROJECTS.forEach(name => {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        opts.push({ value: name, label: name, id: null });
      }
    });

    (projectsList || []).forEach(p => {
      const name = p.productType || p.product_type || p.project_name || p.title || p.name;
      if (name) {
        const cleanName = String(name).trim();
        const lower = cleanName.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          opts.push({
            value: cleanName,
            label: cleanName,
            id: p.id
          });
        }
      }
    });

    opts.push({ value: '__HIDE_OTHER__', label: '← Show Crown Business Park only', isAction: true });

    return opts;
  }, [projectsList, customProjectsList, showOtherSites]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // When selecting employee, auto-derive their department / position
  const handleEmployeeChange = (employeeName) => {
    const isNowAdmin = String(employeeName || '').trim().toLowerCase() === 'admin';
    const matched = (usersList || []).find(
      u => u.name?.trim().toLowerCase() === String(employeeName || '').trim().toLowerCase()
    );
    setFormData(prev => ({
      ...prev,
      selectedEmployee: employeeName,
      personToMeetName: employeeName,
      adminName: isNowAdmin ? prev.adminName : '',
      personToMeetId: matched?.dbId || matched?.id || null,
      department: matched?.position || (isNowAdmin ? (prev.department || 'Administration') : (prev.department || ''))
    }));
  };

  const isAdminSelected = String(formData.selectedEmployee || formData.personToMeetName || '').trim().toLowerCase() === 'admin' || String(formData.personToMeetName || '').startsWith('Admin (');

  const handleProjectChange = (projName) => {
    if (projName === '__SHOW_OTHER__') {
      setShowOtherSites(true);
      return;
    }
    if (projName === '__HIDE_OTHER__') {
      setShowOtherSites(false);
      return;
    }
    if (!projName) {
      setFormData(prev => ({ ...prev, projectName: '', projectId: null }));
      return;
    }
    const clean = String(projName).trim();
    const matched = (projectOptions || []).find(
      p => p.value.toLowerCase() === clean.toLowerCase()
    );
    setFormData(prev => ({
      ...prev,
      projectName: clean,
      projectId: matched?.id || null
    }));
  };

  const handleSaveNewProject = (name) => {
    const clean = String(name || newProjectInput).trim();
    if (!clean) {
      toast.error('Please enter a construction site / project name');
      return;
    }
    setCustomProjectsList(prev => prev.includes(clean) ? prev : [clean, ...prev]);
    handleProjectChange(clean);
    setShowNewProjectInput(false);
    setNewProjectInput('');
    toast.success(`Selected "${clean}"`);
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

    let finalPurpose = formData.visitPurpose;
    if (formData.visitPurpose === 'Other') {
      finalPurpose = formData.customPurpose.trim() || 'Other';
    } else if (formData.visitPurpose === 'Material Enquiry') {
      const cleanItem = formData.supplyItemName?.trim();
      finalPurpose = cleanItem ? `Material Enquiry (${cleanItem.replace(/^\(+|\)+$/g, '')})` : 'Material Enquiry';
    }

    if (!formData.personToMeetName.trim()) {
      toast.error('Please select the person to meet');
      return;
    }

    if (isAdminSelected) {
      const cleanAdmin = formData.adminName.trim().replace(/^\(+|\)+$/g, '');
      if (!cleanAdmin) {
        toast.error('Please enter the Admin name');
        return;
      }
    }

    const cleanAdmin = formData.adminName.trim().replace(/^\(+|\)+$/g, '');
    const finalPersonToMeetName = isAdminSelected
      ? `Admin (${cleanAdmin})`
      : formData.personToMeetName.trim();

    // Site visit requires project/site specification
    if (formData.visitLocation === 'Construction Site' && !formData.projectName.trim()) {
      toast.error('Please specify the construction project or site name');
      return;
    }

    // Construct checkInAt ISO timestamp from user selected date & time
    let checkInAtIso = new Date().toISOString();
    if (formData.checkInDate) {
      const [y, m, d] = formData.checkInDate.split('-').map(Number);
      let hours = 9;
      let mins = 0;
      if (formData.checkInTime && formData.checkInTime.includes(':')) {
        const [h, min] = formData.checkInTime.split(':').map(Number);
        hours = isNaN(h) ? 9 : h;
        mins = isNaN(min) ? 0 : min;
      }
      const inDateObj = new Date(y, m - 1, d, hours, mins, 0);
      if (!isNaN(inDateObj.getTime())) {
        checkInAtIso = inDateObj.toISOString();
      }
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        visitorName: trimmedName,
        mobileNumber: cleanedMobile.slice(-10),
        visitPurpose: finalPurpose,
        personToMeetName: finalPersonToMeetName,
        checkInAt: checkInAtIso,
      };

      await onSaved?.(payload);
      toast.success(`Visitor ${trimmedName} registered successfully!`);
      onClose();
    } catch (err) {
      console.error('Failed to register visitor:', err);
      toast.error(err.message || 'Failed to register visitor');
    } finally {
      setLoading(false);
    }
  };

  const isTodayEntry = formData.checkInDate === getTodayDateStr();

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Visitor"
      onSubmit={handleSubmit}
      submitText={loading ? 'Registering...' : 'Register Visitor'}
      loading={loading}
      maxWidth="max-w-2xl"
    >
      {/* Date & Time Settings (Supports Today or Previous Dates) */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 sm:p-3 text-xs space-y-2 mb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-indigo-600" />
            <span className="font-bold text-indigo-950">Visit Entry Date & Time</span>
          </div>
          <div className="flex items-center gap-2">
            {isTodayEntry ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Today's Live Entry
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Calendar size={10} />
                Previous Date Entry
              </span>
            )}
            <span className="text-[11px] text-indigo-700 hidden sm:inline">
              Staff: <strong>{user?.name || user?.username || 'Receptionist'}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Visit Date */}
          <div>
            <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
              Visit Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              max={getTodayDateStr()}
              value={formData.checkInDate}
              onChange={(e) => handleChange('checkInDate', e.target.value)}
              className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            />
            {!isTodayEntry && (
              <p className="text-[10px] text-amber-700 font-medium mt-1">
                Backdating visitor entry to {formData.checkInDate}
              </p>
            )}
          </div>

          {/* Visit Time */}
          <div>
            <label className="block text-[11px] font-semibold text-indigo-950 mb-1">
              Visit Time <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              required
              value={formData.checkInTime}
              onChange={(e) => handleChange('checkInTime', e.target.value)}
              className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            />
          </div>
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
          {formData.visitPurpose === 'Material Enquiry' && (
            <div className="mt-1.5 animate-in fade-in duration-150">
              <label className="block text-[10px] font-semibold text-indigo-900 mb-0.5">
                Exact Item / Material Name <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                autoFocus
                value={formData.supplyItemName}
                onChange={(e) => handleChange('supplyItemName', e.target.value)}
                placeholder="e.g. Cement, Steel, Electrical, Stationery, Files..."
                className="w-full border border-indigo-200 bg-indigo-50/20 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-800 placeholder-gray-400"
              />
            </div>
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

        {/* Project / Site (Relevant for Construction Site or Property Enquiry) */}
        {(formData.visitLocation === 'Construction Site' || formData.visitPurpose === 'Property Enquiry') && (
          <div className="sm:col-span-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="block text-[11px] font-semibold text-amber-900">
                Project / Construction Site Name <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowOtherSites(prev => !prev)}
                  className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded transition cursor-pointer border ${
                    showOtherSites
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-indigo-700 hover:text-indigo-900 border-indigo-200 hover:bg-indigo-50'
                  }`}
                  title={showOtherSites ? 'Collapse to Crown Business Park only' : 'View other construction sites (Bhardwaj Sky, etc.)'}
                >
                  <span>{showOtherSites ? 'Showing All Sites' : '+ Other Sites'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProjectInput(prev => !prev);
                    if (!showNewProjectInput) {
                      setNewProjectInput('');
                    }
                  }}
                  className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded transition cursor-pointer border ${
                    showNewProjectInput
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-indigo-700 hover:text-indigo-900 border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  <span>{showNewProjectInput ? 'Hide Input' : '+ Add New Construction'}</span>
                </button>
              </div>
            </div>
            <SearchableDropdown
              options={projectOptions}
              value={showNewProjectInput ? 'Add New' : formData.projectName}
              onChange={(val) => {
                handleProjectChange(val);
                setShowNewProjectInput(false);
              }}
              onAdd={(term) => {
                if (term && term.trim()) {
                  handleSaveNewProject(term.trim());
                } else {
                  setShowNewProjectInput(true);
                }
              }}
              promptOnAdd={false}
              placeholder="Select or enter project name (e.g. Villa Vrindavan)"
            />

            {/* Input box to add new construction below dropdown option button */}
            {showNewProjectInput && (
              <div className="mt-2 p-2.5 bg-white rounded-lg border border-amber-300 shadow-2xs flex flex-col gap-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                    <Building2 size={13} className="text-amber-600" />
                    Enter New Construction Site Name:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProjectInput(false);
                      setNewProjectInput('');
                    }}
                    className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                    title="Close"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={newProjectInput}
                    onChange={(e) => setNewProjectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNewProject();
                      }
                    }}
                    placeholder="Enter new construction site name (e.g. Villa Vrindavan)..."
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveNewProject()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
                  >
                    Add Site
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProjectInput(false);
                      setNewProjectInput('');
                    }}
                    className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Person to Meet */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Person to Meet <span className="text-rose-500">*</span>
          </label>
          <SearchableDropdown
            options={employeeOptions}
            value={formData.selectedEmployee || (formData.personToMeetName === 'Admin' || formData.personToMeetName?.startsWith('Admin (') ? 'Admin' : formData.personToMeetName)}
            onChange={handleEmployeeChange}
            placeholder="Select employee / host..."
          />

          {isAdminSelected && (
            <div className="mt-2 p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-200 animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-indigo-950">
                  Admin Name <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-indigo-600 font-medium">Specify Admin</span>
              </div>
              <input
                type="text"
                autoFocus
                value={formData.adminName}
                onChange={(e) => handleChange('adminName', e.target.value)}
                placeholder="Enter Admin Name (e.g. Manish, Kashyap)..."
                className="w-full border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs font-medium text-gray-800"
              />
              <p className="text-[10px] text-indigo-700/90 mt-1">
                Saved as: <span className="font-bold text-indigo-950">{formData.adminName.trim() ? `Admin (${formData.adminName.trim().replace(/^\(+|\)+$/g, '')})` : 'Admin (...) '}</span>
              </p>
            </div>
          )}
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
