import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { User, Phone, Building2, Briefcase, MapPin, ClipboardList, X, ShieldCheck } from 'lucide-react';
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
import { isUserAdmin, hasFullAccess } from '../../utils/authUtils';

export default function EditVisitorModal({ isOpen, onClose, visitor, onSave }) {
  const { user } = useAuthStore();
  const isAdmin = isUserAdmin(user);
  const canManageAdminRemark = isAdmin || hasFullAccess(user, 'reception') || hasFullAccess(user, 'receptionDashboard');

  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [showOtherSites, setShowOtherSites] = useState(false);
  const [newProjectInput, setNewProjectInput] = useState('');
  const [customProjectsList, setCustomProjectsList] = useState([]);

  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNumber: '',
    companyName: '',
    visitorType: 'Client',
    visitPurpose: '',
    customPurpose: '',
    visitLocation: 'Office',
    projectName: '',
    projectId: null,
    personToMeetName: '',
    personToMeetId: null,
    department: '',
    remarks: '',
    adminRemark: ''
  });

  useEffect(() => {
    if (!isOpen || !visitor) return;

    let isMounted = true;
    Promise.all([
      authApi.getUsers().catch(() => []),
      masterApi.getRealEstateProducts().catch(() => [])
    ]).then(([users, projects]) => {
      if (!isMounted) return;
      setUsersList(users || []);
      setProjectsList(projects || []);
    });

    let vPurpose = visitor.visitPurpose || '';
    let customPurp = '';
    let supplyItem = '';

    if (vPurpose.startsWith('Material Enquiry')) {
      const match = vPurpose.match(/^Material Enquiry\s*\(([^)]+)\)/i);
      supplyItem = match ? match[1].trim() : (visitor.supplyItemName || '');
      vPurpose = 'Material Enquiry';
    } else if (VISIT_PURPOSE_OPTIONS.some(p => p.value === vPurpose)) {
      // standard purpose
    } else {
      customPurp = vPurpose;
      vPurpose = 'Other';
    }

    let cDate = '';
    let cTime = '';
    if (visitor.checkInAt) {
      const d = new Date(visitor.checkInAt);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        cDate = `${y}-${m}-${day}`;
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        cTime = `${h}:${min}`;
      }
    }

    const rawPerson = visitor.personToMeetName || '';
    const isAdmin = rawPerson.toLowerCase().startsWith('admin');
    let adminName = '';
    let selectedEmp = rawPerson;
    if (isAdmin) {
      selectedEmp = 'Admin';
      const match = rawPerson.match(/Admin\s*\(([^)]+)\)/i);
      adminName = match ? match[1].trim() : (rawPerson.toLowerCase() === 'admin' ? '' : rawPerson.replace(/^admin\s*/i, '').trim());
    }

    const isCrown = visitor.projectName && (visitor.projectName.toLowerCase() === 'crown business park' || visitor.projectName.toLowerCase() === 'crown business center');
    setShowOtherSites(Boolean(visitor.projectName && !isCrown));

    setFormData({
      visitorName: visitor.visitorName || '',
      mobileNumber: visitor.mobileNumber || '',
      companyName: visitor.companyName || '',
      visitorType: visitor.visitorType || 'Client',
      visitPurpose: vPurpose,
      customPurpose: customPurp,
      supplyItemName: supplyItem,
      visitLocation: visitor.visitLocation || 'Office',
      projectName: visitor.projectName || '',
      projectId: visitor.projectId || null,
      selectedEmployee: selectedEmp,
      personToMeetName: rawPerson,
      adminName: adminName,
      personToMeetId: visitor.personToMeetId || null,
      department: visitor.department || '',
      remarks: visitor.remarks || '',
      adminRemark: visitor.adminRemark || '',
      checkInDate: cDate,
      checkInTime: cTime
    });

    return () => { isMounted = false; };
  }, [isOpen, visitor]);

  const employeeOptions = useMemo(() => {
    return (usersList || [])
      .filter(u => u && u.name)
      .map(u => ({
        value: u.name,
        label: u.position ? `${u.name} (${u.position})` : u.name,
        id: u.dbId || u.id,
        dept: u.position
      }));
  }, [usersList]);

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

    // Prepend custom projects
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
          opts.push({ value: cleanName, label: cleanName, id: p.id });
        }
      }
    });

    opts.push({ value: '__HIDE_OTHER__', label: '← Show Crown Business Park only', isAction: true });

    return opts;
  }, [projectsList, customProjectsList, showOtherSites]);

  if (!isOpen || !visitor) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEmployeeChange = (empName) => {
    const isNowAdmin = String(empName || '').trim().toLowerCase() === 'admin';
    const matched = employeeOptions.find(o => o.value.toLowerCase() === String(empName || '').toLowerCase());
    setFormData(prev => ({
      ...prev,
      selectedEmployee: empName,
      personToMeetName: empName,
      adminName: isNowAdmin ? prev.adminName : '',
      personToMeetId: matched?.id || null,
      department: matched?.dept || (isNowAdmin ? (prev.department || 'Administration') : (prev.department || ''))
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
    const matched = projectOptions.find(o => o.value.toLowerCase() === clean.toLowerCase());
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const trimmedName = formData.visitorName.trim();
    if (!trimmedName) {
      toast.error('Visitor Full Name is required');
      return;
    }

    const cleanDigits = String(formData.mobileNumber).replace(/[^0-9]/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
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

    // Calculate checkInAt ISO if date and time provided
    let checkInAtIso = visitor.checkInAt;
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
      const cleanAdminRemark = formData.adminRemark ? formData.adminRemark.trim() : null;
      const adminRemarkDate = cleanAdminRemark
        ? (cleanAdminRemark !== (visitor.adminRemark || '') ? new Date().toISOString() : visitor.adminRemarkDate || new Date().toISOString())
        : null;

      const updates = {
        ...formData,
        visitorName: trimmedName,
        mobileNumber: cleanDigits.slice(-10),
        visitPurpose: finalPurpose,
        personToMeetName: finalPersonToMeetName,
        checkInAt: checkInAtIso,
        adminRemark: cleanAdminRemark,
        adminRemarkDate: adminRemarkDate
      };

      await onSave?.(visitor.id, updates);
      toast.success('Visitor details updated successfully');
      onClose();
    } catch (err) {
      console.error('Failed to update visitor:', err);
      toast.error(err.message || 'Failed to update visitor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Visitor Details"
      onSubmit={handleSubmit}
      submitText={loading ? 'Updating...' : 'Save Changes'}
      loading={loading}
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
        {/* Visit Date */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visit Date
          </label>
          <input
            type="date"
            value={formData.checkInDate}
            onChange={(e) => handleChange('checkInDate', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Visit Time */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visit Time
          </label>
          <input
            type="time"
            value={formData.checkInTime}
            onChange={(e) => handleChange('checkInTime', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visitor Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.visitorName}
            onChange={(e) => handleChange('visitorName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Mobile Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            required
            maxLength={10}
            value={formData.mobileNumber}
            onChange={(e) => handleChange('mobileNumber', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Company / Organization
          </label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visitor Type
          </label>
          <SearchableDropdown
            options={VISITOR_TYPE_OPTIONS}
            value={formData.visitorType}
            onChange={(val) => handleChange('visitorType', val)}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visit Purpose <span className="text-rose-500">*</span>
          </label>
          <SearchableDropdown
            options={VISIT_PURPOSE_OPTIONS}
            value={formData.visitPurpose}
            onChange={(val) => handleChange('visitPurpose', val)}
          />
          {formData.visitPurpose === 'Other' && (
            <input
              type="text"
              value={formData.customPurpose}
              onChange={(e) => handleChange('customPurpose', e.target.value)}
              placeholder="Specify purpose..."
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-2.5 py-1 text-xs"
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

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Visit Location <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {VISIT_LOCATION_OPTIONS.map(loc => (
              <label
                key={loc.value}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                  formData.visitLocation === loc.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="editLocationRadio"
                  value={loc.value}
                  checked={formData.visitLocation === loc.value}
                  onChange={() => handleChange('visitLocation', loc.value)}
                  className="sr-only"
                />
                <span>{loc.label}</span>
              </label>
            ))}
          </div>
        </div>

        {(formData.visitLocation === 'Construction Site' || formData.visitPurpose === 'Property Enquiry') && (
          <div className="sm:col-span-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="block text-[11px] font-semibold text-amber-900">
                Project / Construction Site Name
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
              placeholder="Select or enter site (e.g. Crown Business Center)"
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

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Person to Meet <span className="text-rose-500">*</span>
          </label>
          <SearchableDropdown
            options={employeeOptions}
            value={formData.selectedEmployee || (formData.personToMeetName === 'Admin' || formData.personToMeetName?.startsWith('Admin (') ? 'Admin' : formData.personToMeetName)}
            onChange={handleEmployeeChange}
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

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Department / Position
          </label>
          <input
            type="text"
            value={formData.department}
            onChange={(e) => handleChange('department', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Remarks
          </label>
          <textarea
            rows={2}
            value={formData.remarks}
            onChange={(e) => handleChange('remarks', e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
          />
        </div>

        {canManageAdminRemark && (
          <div className="sm:col-span-2 p-2.5 bg-violet-50/70 rounded-xl border border-violet-200 space-y-1">
            <label className="block text-[11px] font-bold text-violet-950 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-violet-600" />
              <span>Admin Remark</span>
            </label>
            <textarea
              rows={2}
              value={formData.adminRemark || ''}
              onChange={(e) => handleChange('adminRemark', e.target.value)}
              placeholder="Enter admin remarks, instructions, or notes for this visitor..."
              className="w-full border border-violet-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none bg-white text-gray-800"
            />
          </div>
        )}
      </div>
    </ModalForm>
  );
}
