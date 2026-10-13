import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { User, Phone, Building2, Briefcase, MapPin, ClipboardList } from 'lucide-react';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import {
  VISIT_PURPOSE_OPTIONS,
  VISITOR_TYPE_OPTIONS,
  VISIT_LOCATION_OPTIONS
} from './receptionConstants';
import { authApi } from '../../api/authApi';
import { masterApi } from '../../api/masterApi';

export default function EditVisitorModal({ isOpen, onClose, visitor, onSave }) {
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

  const [formData, setFormData] = useState({
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

    const isStandardPurpose = VISIT_PURPOSE_OPTIONS.some(p => p.value === visitor.visitPurpose);

    setFormData({
      visitorName: visitor.visitorName || '',
      mobileNumber: visitor.mobileNumber || '',
      companyName: visitor.companyName || '',
      visitorType: visitor.visitorType || 'Client',
      visitPurpose: isStandardPurpose ? visitor.visitPurpose : 'Other',
      customPurpose: isStandardPurpose ? '' : (visitor.visitPurpose || ''),
      visitLocation: visitor.visitLocation || 'Office',
      projectName: visitor.projectName || '',
      projectId: visitor.projectId || null,
      personToMeetName: visitor.personToMeetName || '',
      personToMeetId: visitor.personToMeetId || null,
      department: visitor.department || '',
      remarks: visitor.remarks || ''
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
    const seen = new Set();
    const opts = [];
    (projectsList || []).forEach(p => {
      const name = p.project_name || p.title || p.product_type;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        opts.push({ value: name, label: name, id: p.id });
      }
    });
    return opts;
  }, [projectsList]);

  if (!isOpen || !visitor) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEmployeeChange = (empName) => {
    const matched = employeeOptions.find(o => o.value.toLowerCase() === String(empName || '').toLowerCase());
    setFormData(prev => ({
      ...prev,
      personToMeetName: empName,
      personToMeetId: matched?.id || null,
      department: matched?.dept || prev.department || ''
    }));
  };

  const handleProjectChange = (projName) => {
    const matched = projectOptions.find(o => o.value.toLowerCase() === String(projName || '').toLowerCase());
    setFormData(prev => ({
      ...prev,
      projectName: projName,
      projectId: matched?.id || null
    }));
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

    const finalPurpose = formData.visitPurpose === 'Other'
      ? (formData.customPurpose.trim() || 'Other')
      : formData.visitPurpose;

    setLoading(true);
    try {
      const updates = {
        ...formData,
        visitorName: trimmedName,
        mobileNumber: cleanDigits.slice(-10),
        visitPurpose: finalPurpose
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

        {(formData.visitLocation === 'Construction Site' || formData.visitPurpose === 'Site Visit') && (
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Project / Site Name
            </label>
            <SearchableDropdown
              options={projectOptions}
              value={formData.projectName}
              onChange={handleProjectChange}
              onAdd={handleProjectChange}
              placeholder="Select project..."
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Person to Meet <span className="text-rose-500">*</span>
          </label>
          <SearchableDropdown
            options={employeeOptions}
            value={formData.personToMeetName}
            onChange={handleEmployeeChange}
          />
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
      </div>
    </ModalForm>
  );
}
