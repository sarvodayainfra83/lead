import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, User, Phone, Mail, IdCard, Lock, ShieldCheck, Search, Briefcase, Tag } from 'lucide-react';
import { settingApi } from '../../api/settingApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import DataTable from '../../components/DataTable';
import PageTabs from '../../components/PageTabs';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess, parsePositions, hasPosition, addPosition, removePosition } from '../../utils/authUtils';

// Every page an access level can be granted for — Admins bypass this and always get full access.
const APP_PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'lead', label: 'Lead' },
  { key: 'callTracker', label: 'Call Followup' },
  { key: 'siteVisitMeeting', label: 'Site Visit / Meeting' },
  { key: 'customerMaster', label: 'Customer Master' },
  { key: 'nonInterested', label: 'Non-interested' },
  { key: 'products', label: 'Products' },
  // { key: 'callerReport', label: 'Caller Report' },
  { key: 'misReport', label: 'MIS Report' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'attendanceReport', label: 'Attendance Report' },
  { key: 'master', label: 'Master / Setting' }
];

const ACCESS_LEVELS = [
  { value: 'none', label: 'No Access' },
  { value: 'view', label: 'View' },
  { value: 'full', label: 'Full Access' }
];

export const POSITION_OPTIONS = [
  { value: 'Caller', label: 'Caller' },
  { value: 'Visitor', label: 'Visitor' },
  { value: 'Receptionist', label: 'Receptionist' },
  { value: 'Lead Receiver', label: 'Lead Receiver' },
  { value: 'Manager', label: 'Manager' },
  { value: 'HR', label: 'HR' }
];

const emptyAccessPages = () => ({
  ...Object.fromEntries(APP_PAGES.map(p => [p.key, 'none'])),
  setting: 'none'
});

const initialFormData = {
  name: '',
  number: '',
  gmail: '',
  id: '',
  password: '',
  role: 'USER',
  position: '',
  customPosition: '',
  leadTypeId: '',
  leadType: '',
  accessPages: emptyAccessPages()
};

export default function Setting({ setHeaderAction }) {
  const { user } = useAuthStore();
  const canEdit = hasFullAccess(user, 'setting') || hasFullAccess(user, 'master');

  const [rows, setRows] = useState([]);
  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [positionFilter, setPositionFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const load = async () => {
    setListLoading(true);
    try {
      const [users, types] = await Promise.all([
        settingApi.getUsers(),
        masterApi.getLeadTypes()
      ]);
      setRows(users || []);
      setLeadTypesMaster(types || []);
    } catch (err) {
      console.error('Failed to load users from the database:', err);
      toast.error('Could not load users from the database');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Listen for sidebar click to reset filters
  useEffect(() => {
    const handleClear = (e) => {
      if (!e?.detail?.path || e.detail.path === '/master' || e.detail.path === '/setting') {
        setPositionFilter('All');
        setSearchQuery('');
        setCurrentPage(1);
      }
    };
    window.addEventListener('app:clear-filters', handleClear);
    return () => window.removeEventListener('app:clear-filters', handleClear);
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'role' && value === 'HR') {
        if (!next.position) next.position = 'HR';
        next.accessPages = {
          ...next.accessPages,
          attendance: 'full',
          attendanceReport: 'full',
          nonInterested: 'none'
        };
      }
      return next;
    });
  };

  const handleAccessChange = (pageKey, level) => {
    setFormData(prev => {
      const nextAccess = { ...prev.accessPages, [pageKey]: level };
      if (pageKey === 'master') {
        nextAccess.setting = level;
      }
      return { ...prev, accessPages: nextAccess };
    });
  };

  const openAdd = useCallback(() => {
    setEditRow(null);
    setFormData({ ...initialFormData });
    setShowForm(true);
  }, []);

  const openEdit = (row) => {
    setEditRow(row);
    const existingMasterSetting = row.accessPages?.master || row.accessPages?.setting || 'none';

    setFormData({
      name: row.name || '',
      number: row.number || '',
      gmail: row.gmail || '',
      id: row.id || '',
      password: row.password || '',
      role: row.role || 'USER',
      position: parsePositions(row.position).join(', '),
      customPosition: '',
      leadTypeId: row.leadTypeId || '',
      leadType: row.leadType || '',
      accessPages: {
        ...emptyAccessPages(),
        ...(row.accessPages || {}),
        master: existingMasterSetting,
        setting: existingMasterSetting
      }
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditRow(null);
    setFormData({ ...initialFormData });
  };

  // Optional integration with Master.jsx header action slot
  useEffect(() => {
    if (setHeaderAction) {
      setHeaderAction(
        canEdit ? (
          <button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 px-3 h-[34px] text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer whitespace-nowrap"
          >
            <Plus size={15} /> Add User
          </button>
        ) : null
      );
    }
    return () => setHeaderAction && setHeaderAction(null);
  }, [setHeaderAction, openAdd, canEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (!formData.number.trim()) { toast.error('Number is required'); return; }
    if (!formData.id.trim()) { toast.error('User Name is required'); return; }
    if (!formData.password.trim()) { toast.error('Password is required'); return; }
    // A custom position typed but not yet added with "Add" still counts
    const typedPosition = formData.customPosition?.trim();
    const resolvedPosition = (typedPosition ? addPosition(formData.position, typedPosition) : parsePositions(formData.position).join(', ')) || null;
    if (!resolvedPosition && formData.role !== 'ADMIN' && formData.role !== 'TESTER') {
      toast.error('Select at least one position');
      return;
    }

    setLoading(true);
    try {
      const existing = await settingApi.getUsers();
      const idTaken = existing.some(u => u.id === formData.id && (!editRow || u.id !== editRow.id));
      if (idTaken) { toast.error('This ID is already in use'); return; }

      const accessPagesPayload = (formData.role === 'ADMIN' || formData.role === 'TESTER') ? {} : { ...formData.accessPages };
      if (accessPagesPayload.master) {
        accessPagesPayload.setting = accessPagesPayload.master;
      }

      const payload = {
        name: formData.name.trim(),
        number: formData.number.trim(),
        gmail: formData.gmail.trim(),
        id: formData.id.trim(),
        password: formData.password,
        role: formData.role,
        position: resolvedPosition,
        leadTypeId: formData.leadTypeId || null,
        leadType: formData.leadType || '',
        accessPages: accessPagesPayload
      };

      await settingApi.saveUser(payload);
      toast.success(editRow ? 'User updated' : 'User added');
      await load();
      closeForm();
    } finally {
      setLoading(false);
    }
  };

  const selectedLeadTypes = (formData.leadType || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const availableLeadTypeNames = leadTypesMaster.length > 0
    ? leadTypesMaster.map(t => t.leadType)
    : ['Real Estate', 'Insurance', 'Mutual Fund'];

  const toggleLeadType = (typeName) => {
    const current = (formData.leadType || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    let updated;
    if (current.includes(typeName)) {
      updated = current.filter(t => t !== typeName);
    } else {
      updated = [...current, typeName];
    }

    const newLeadTypeStr = updated.join(', ');
    const firstMatch = leadTypesMaster.find(t => updated.includes(t.leadType));

    setFormData(prev => ({
      ...prev,
      leadType: newLeadTypeStr,
      leadTypeId: firstMatch ? firstMatch.id : null
    }));
  };

  // Positions: several allowed (e.g. Manager + Caller), stored comma-separated like lead types
  const selectedPositions = parsePositions(formData.position);
  const positionChoices = [
    ...POSITION_OPTIONS.map(o => o.value),
    ...selectedPositions.filter(p => !POSITION_OPTIONS.some(o => o.value.toLowerCase() === p.toLowerCase()))
  ];

  const togglePosition = (name) => {
    setFormData(prev => ({
      ...prev,
      position: (hasPosition(prev.position || '', name) ? removePosition(prev.position, name) : addPosition(prev.position, name)) || ''
    }));
  };

  const addCustomPosition = () => {
    const name = formData.customPosition?.trim();
    if (!name) return;
    setFormData(prev => ({ ...prev, position: addPosition(prev.position, name), customPosition: '' }));
  };

  const handleDelete = async (row) => {
    if (row.id === 'admin') { toast.error("The default admin account can't be deleted"); return; }
    if (!window.confirm(`Delete user "${row.name}"?`)) return;
    try {
      await settingApi.deleteUser(row.id);
      await load();
      toast.success('User deleted');
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(err?.message || 'Failed to delete user');
    }
  };

  const serialLabel = (row) => `SN-${String(row.serialNo || 0).padStart(3, '0')}`;

  const accessSummary = (row) => {
    if (row.role === 'ADMIN' || row.role === 'TESTER') return [];
    return APP_PAGES.map(p => {
      const levelVal = p.key === 'master'
        ? (row.accessPages?.master || row.accessPages?.setting || 'none')
        : (row.accessPages?.[p.key] || 'none');
      const levelLabel = ACCESS_LEVELS.find(l => l.value === levelVal)?.label || 'No Access';
      return { page: p.label, level: levelLabel, val: levelVal };
    });
  };

  const getPositionBadgeClass = (pos) => {
    const p = String(pos || '').toLowerCase();
    if (p.includes('caller')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (p.includes('visitor')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (p.includes('receiver')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (p.includes('manager')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (p.includes('hr')) return 'bg-teal-50 text-teal-700 border-teal-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const filteredRows = rows.filter(row => {
    if (positionFilter !== 'All') {
      if (positionFilter === 'Admins') {
        if (row.role !== 'ADMIN') return false;
      } else if (positionFilter === 'Testers') {
        if (row.role !== 'TESTER') return false;
      } else if (positionFilter === 'HR') {
        if (row.role !== 'HR' && !hasPosition(row.position || '', 'HR')) return false;
      } else {
        const rowPos = String(row.position || '').toLowerCase();
        if (!rowPos.includes(positionFilter.toLowerCase())) return false;
      }
    }

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (row.name || '').toLowerCase().includes(q) ||
      (row.number || '').toLowerCase().includes(q) ||
      (row.gmail || '').toLowerCase().includes(q) ||
      (row.id || '').toLowerCase().includes(q) ||
      (row.position || '').toLowerCase().includes(q) ||
      (row.leadType || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = ["Serial No", "Name", "Position", "Lead Type", "Number", "Gmail", "ID", "Pass", "Page Access"];
  if (canEdit) tableHeaders.unshift("Action");

  const leadTypeSelectOptions = leadTypesMaster.map(t => ({ value: t.id, label: t.leadType }));

  const filterTabs = [
    { key: 'All', label: 'All Users', count: rows.length },
    { key: 'Caller', label: 'Callers', count: rows.filter(r => String(r.position || '').toLowerCase().includes('caller')).length },
    { key: 'Visitor', label: 'Visitors', count: rows.filter(r => String(r.position || '').toLowerCase().includes('visitor')).length },
    { key: 'Lead Receiver', label: 'Lead Receivers', count: rows.filter(r => String(r.position || '').toLowerCase().includes('receiver')).length },
    { key: 'HR', label: 'HR', count: rows.filter(r => r.role === 'HR' || hasPosition(r.position || '', 'HR')).length },
    { key: 'Admins', label: 'Admins', count: rows.filter(r => r.role === 'ADMIN').length },
    { key: 'Testers', label: 'Testers', count: rows.filter(r => r.role === 'TESTER').length }
  ];

  const renderRow = (row) => (
    <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      {canEdit && (
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => openEdit(row)} title="Edit" className="inline-flex items-center justify-center p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer">
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(row)} title="Delete" className="inline-flex items-center justify-center p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      )}
      <td className="px-4 py-2.5 text-center text-[13px] text-indigo-600 font-bold whitespace-nowrap">{serialLabel(row)}</td>
      <td className="px-4 py-2.5 text-center text-[13px] font-medium text-gray-900 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          {row.avatarUrl || row.avatar_url ? (
            <img
              src={row.avatarUrl || row.avatar_url}
              alt={row.name}
              className="w-6 h-6 rounded-full object-cover border border-indigo-200 flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold border border-indigo-100 flex-shrink-0">
              {String(row.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <span>{row.name}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-center text-[13px] whitespace-nowrap">
        {row.position ? (
          <div className="flex flex-wrap gap-1 justify-center max-w-[220px] mx-auto">
            {parsePositions(row.position).map(pos => (
              <span key={pos} className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase border ${getPositionBadgeClass(pos)}`}>
                {pos}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center text-[13px] whitespace-nowrap">
        {row.leadType ? (
          <div className="flex flex-wrap gap-1 justify-center max-w-[220px] mx-auto">
            {row.leadType.split(',').map(s => s.trim()).filter(Boolean).map((lt, idx) => (
              <span key={idx} className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-200">
                {lt}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.number || '-'}</td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.gmail || '-'}</td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-700 whitespace-nowrap font-medium">{row.id}</td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-600 whitespace-nowrap font-mono">{row.password}</td>
      <td className="px-4 py-2.5 min-w-[250px]">
        {row.role === 'ADMIN' ? (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
              <ShieldCheck size={11} /> Full Access (Admin)
            </span>
          </div>
        ) : row.role === 'TESTER' ? (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
              <ShieldCheck size={11} /> Full Access (Tester)
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 justify-center">
            {accessSummary(row).map((item, idx) => (
              <span key={idx} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${item.val === 'full' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                item.val === 'edit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  item.val === 'view' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                    'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                {item.page}: {item.level}
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );

  const renderCard = (row) => (
    <div key={row.id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-3 space-y-2.5">
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {row.avatarUrl || row.avatar_url ? (
            <img
              src={row.avatarUrl || row.avatar_url}
              alt={row.name}
              className="w-9 h-9 rounded-full object-cover border border-indigo-200 flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
              {String(row.name || '?').trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{row.name}</h4>
            <p className="text-[11px] text-indigo-500 font-medium">{serialLabel(row)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {row.role === 'ADMIN' ? (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1">
              <ShieldCheck size={10} /> Admin
            </span>
          ) : row.role === 'TESTER' ? (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1">
              <ShieldCheck size={10} /> Tester
            </span>
          ) : row.role === 'HR' ? (
            <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1">
              <ShieldCheck size={10} /> HR
            </span>
          ) : (
            <span className="text-[10px] bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full font-semibold uppercase">User</span>
          )}
          {parsePositions(row.position).map(pos => (
            <span key={pos} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${getPositionBadgeClass(pos)}`}>
              {pos}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs bg-slate-50 rounded-lg p-2.5">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Number</p>
          <p className="text-gray-800 font-medium truncate">{row.number || '-'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Lead Type</p>
          <p className="text-gray-800 font-medium truncate">{row.leadType || '-'}</p>
        </div>
        <div className="min-w-0 col-span-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Gmail</p>
          <p className="text-gray-800 font-medium truncate">{row.gmail || '-'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Login ID</p>
          <p className="text-gray-800 font-medium truncate">{row.id}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Password</p>
          <p className="text-gray-800 font-mono truncate">{row.password}</p>
        </div>
      </div>

      {row.role !== 'ADMIN' && row.role !== 'TESTER' && (
        <div className="flex flex-wrap gap-1">
          {accessSummary(row).filter(item => item.val !== 'none').map((item, idx) => (
            <span key={idx} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${item.val === 'full' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : item.val === 'edit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
              {item.page}: {item.level}
            </span>
          ))}
          {accessSummary(row).every(item => item.val === 'none') && (
            <span className="text-[10px] text-gray-400 italic">No page access</span>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="flex-1 bg-indigo-50 text-indigo-600 border border-indigo-200 h-[32px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer hover:bg-indigo-100">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={() => handleDelete(row)} className="flex-1 bg-red-50 text-red-600 border border-red-200 h-[32px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer hover:bg-red-100">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-2 sm:p-3 space-y-2 flex flex-col h-full min-h-0">
      {/* Position filter tabs + search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 flex-shrink-0">
        <PageTabs
          tabs={filterTabs}
          activeKey={positionFilter}
          onChange={(key) => { setPositionFilter(key); setCurrentPage(1); }}
        />

        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2 focus:outline-none focus:border-indigo-500 text-xs h-[34px]"
            />
          </div>
          {canEdit && !setHeaderAction && (
            <button
              onClick={openAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1.5 px-3 h-[34px] text-xs sm:text-sm font-semibold shadow-sm transition flex-shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Plus size={15} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
        <DataTable
          loading={listLoading}
          loadingText="Loading users..."
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="950px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredRows.length}
        />
      </div>

      {/* Add / Edit User Modal */}
      <ModalForm
        isOpen={showForm}
        onClose={closeForm}
        title={editRow ? 'Edit User' : 'Add User'}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : (editRow ? 'Update' : 'Save')}
        loading={loading}
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Name *</label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter name"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px]"
              />
            </div>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Number *</label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={formData.number}
                onChange={(e) => handleChange('number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit number"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px]"
              />
            </div>
          </div>

          {/* Position Selection (Multi-Select, e.g. a Manager who also works as a Caller) */}
          <div className="space-y-1.5 col-span-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold flex items-center gap-1.5">
                <Briefcase size={13} className="text-indigo-600" />
                Position / Category * (Multiple Allowed)
              </label>
              {selectedPositions.length > 0 && (
                <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {selectedPositions.length} Selected
                </span>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 border border-gray-200 rounded-lg space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {positionChoices.map(name => {
                  const isSelected = hasPosition(formData.position || '', name);
                  return (
                    <label
                      key={name}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none text-xs font-semibold ${isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePosition(name)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.customPosition || ''}
                  onChange={(e) => handleChange('customPosition', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomPosition(); } }}
                  placeholder="Other position (optional)"
                  className="flex-1 min-w-0 border border-gray-300 bg-white rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[32px]"
                />
                <button
                  type="button"
                  onClick={addCustomPosition}
                  disabled={!formData.customPosition?.trim()}
                  className="px-3 h-[32px] rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-1 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>

            {formData.position && (
              <p className="text-[11px] text-gray-500 flex items-center gap-1 flex-wrap">
                <span className="text-gray-400">Saved as:</span>
                <span className="font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-200 font-mono">
                  {formData.position}
                </span>
              </p>
            )}
          </div>

          {/* Lead Type Selection (Multi-Select for multiple assigned lead types) */}
          <div className="space-y-1.5 col-span-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight font-semibold flex items-center gap-1.5">
                <Tag size={13} className="text-indigo-600" />
                Assigned Lead Type (Multiple Allowed)
              </label>
              {selectedLeadTypes.length > 0 && (
                <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {selectedLeadTypes.length} Selected
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-gray-200 rounded-lg">
              {availableLeadTypeNames.map(typeName => {
                const isSelected = selectedLeadTypes.includes(typeName);
                return (
                  <label
                    key={typeName}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none text-xs font-semibold ${isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleLeadType(typeName)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                    />
                    <span className="truncate">{typeName}</span>
                  </label>
                );
              })}
            </div>

            {formData.leadType ? (
              <p className="text-[11px] text-gray-500 flex items-center gap-1 flex-wrap">
                <span className="text-gray-400">Comma-separated value:</span>
                <span className="font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-200 font-mono">
                  {formData.leadType}
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-400 italic">
                None selected (User will have unrestricted access to all lead types).
              </p>
            )}
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Gmail</label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="email"
                value={formData.gmail}
                onChange={(e) => handleChange('gmail', e.target.value)}
                placeholder="Enter gmail address"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px]"
              />
            </div>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">User Name *</label>
            <div className="relative">
              <IdCard className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={formData.id}
                onChange={(e) => handleChange('id', e.target.value)}
                placeholder="Enter login ID"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px]"
              />
            </div>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Password *</label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Enter password"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px]"
              />
            </div>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Role *</label>
            <SearchableDropdown
              options={[{ value: 'ADMIN', label: 'Admin' }, { value: 'USER', label: 'User' }, { value: 'HR', label: 'HR' }, { value: 'TESTER', label: 'Tester' }]}
              value={formData.role}
              onChange={(val) => handleChange('role', val)}
              placeholder="Select role"
              height="h-[34px]"
            />
          </div>

          {/* Page Access — Admins and Testers always have full access, so this only applies to Users */}
          {formData.role !== 'ADMIN' && formData.role !== 'TESTER' && (
            <div className="space-y-1 col-span-2">
              <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Page Access</label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {APP_PAGES.map(page => (
                  <div key={page.key} className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 gap-1.5 sm:gap-2">
                    <span className="text-[11px] md:text-[13px] text-gray-700 font-medium">{page.label}</span>
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                      {ACCESS_LEVELS.map(level => (
                        <label key={level.value} className="flex items-center gap-1 text-[10px] md:text-[11px] text-gray-600 cursor-pointer">
                          <input
                            type="radio"
                            name={`access-${page.key}`}
                            checked={formData.accessPages[page.key] === level.value}
                            onChange={() => handleAccessChange(page.key, level.value)}
                            className="accent-indigo-600"
                          />
                          {level.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.role === 'ADMIN' && (
            <div className="col-span-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-[11px] md:text-[13px] text-indigo-700">
              <ShieldCheck size={14} /> Admins have full access to every page by default.
            </div>
          )}

          {formData.role === 'TESTER' && (
            <div className="col-span-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-[11px] md:text-[13px] text-emerald-700">
              <ShieldCheck size={14} /> Testers have full access to every page and all action controls.
            </div>
          )}

        </div>
      </ModalForm>
    </div>
  );
}

