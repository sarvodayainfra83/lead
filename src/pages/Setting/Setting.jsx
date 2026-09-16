import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, User, Phone, Mail, IdCard, Lock, ShieldCheck, Search, Briefcase, Tag } from 'lucide-react';
import { settingApi } from '../../api/settingApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess } from '../../utils/authUtils';

// Every page an access level can be granted for — Admins bypass this and always get full access.
const APP_PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'lead', label: 'Lead' },
  { key: 'callTracker', label: 'Call Tracker' },
  { key: 'assignVisitor', label: 'Assign Visitor' },
  { key: 'visitorFollowUp', label: 'Visitor Follow Up' },
  { key: 'customerMaster', label: 'Customer Master' },
  { key: 'products', label: 'Products' },
  { key: 'callerReport', label: 'Caller Report' },
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
  { value: 'Lead Receiver', label: 'Lead Receiver' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Other', label: 'Other' }
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
  leadTypeId: '',
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

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const load = async () => {
    const [users, types] = await Promise.all([
      settingApi.getUsers(),
      masterApi.getLeadTypes()
    ]);
    setRows(users || []);
    setLeadTypesMaster(types || []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      position: row.position || '',
      leadTypeId: row.leadTypeId || '',
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 px-4 h-[32px] lg:h-[38px] text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus size={16} /> Add User
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
    if (!formData.id.trim()) { toast.error('ID is required'); return; }
    if (!formData.password.trim()) { toast.error('Password is required'); return; }

    setLoading(true);
    try {
      const existing = await settingApi.getUsers();
      const idTaken = existing.some(u => u.id === formData.id && (!editRow || u.id !== editRow.id));
      if (idTaken) { toast.error('This ID is already in use'); return; }

      const accessPagesPayload = formData.role === 'ADMIN' ? {} : { ...formData.accessPages };
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
        position: formData.position || null,
        leadTypeId: formData.leadTypeId || null,
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

  const handleDelete = async (row) => {
    if (row.id === 'admin') { toast.error("The default admin account can't be deleted"); return; }
    if (!window.confirm(`Delete user "${row.name}"?`)) return;
    await settingApi.deleteUser(row.id);
    await load();
    toast.success('User deleted');
  };

  const serialLabel = (row) => `SN-${String(row.serialNo || 0).padStart(3, '0')}`;

  const accessSummary = (row) => {
    if (row.role === 'ADMIN') return [];
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
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const filteredRows = rows.filter(row => {
    if (positionFilter !== 'All') {
      if (positionFilter === 'Admins') {
        if (row.role !== 'ADMIN') return false;
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
    { key: 'Admins', label: 'Admins', count: rows.filter(r => r.role === 'ADMIN').length }
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
      <td className="px-4 py-2.5 text-center text-[13px] font-medium text-gray-900 whitespace-nowrap">{row.name}</td>
      <td className="px-4 py-2.5 text-center text-[13px] whitespace-nowrap">
        {row.position ? (
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase border ${getPositionBadgeClass(row.position)}`}>
            {row.position}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center text-[13px] whitespace-nowrap">
        {row.leadType ? (
          <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-medium border border-gray-200">
            {row.leadType}
          </span>
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
    <div key={row.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">{serialLabel(row)}</span>
          <h4 className="text-sm text-gray-900 font-medium">{row.name}</h4>
        </div>
        <div className="flex flex-col items-end gap-1">
          {row.role === 'ADMIN' ? (
            <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1">
              <ShieldCheck size={10} /> Admin
            </span>
          ) : (
            <span className="text-[9px] bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full font-semibold uppercase">
              User
            </span>
          )}
          {row.position && (
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase border ${getPositionBadgeClass(row.position)}`}>
              {row.position}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Position / Role</p>
          <p className="text-gray-700 font-semibold truncate leading-tight">{row.position || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Lead Type</p>
          <p className="text-gray-700 truncate leading-tight">{row.leadType || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">ID</p>
          <p className="text-gray-700 truncate leading-tight">{row.id}</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px]">Password</p>
          <p className="text-gray-700 font-mono truncate leading-tight">{row.password}</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-1.5 pt-1">
          <button onClick={() => openEdit(row)} className="flex-1 bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer">
            <Pencil size={11} /> Edit
          </button>
          <button onClick={() => handleDelete(row)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1 cursor-pointer">
            <Trash2 size={11} /> Del
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">
      {/* Category Filter Pills & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setPositionFilter(tab.key); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border flex items-center gap-1.5 cursor-pointer ${positionFilter === tab.key
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${positionFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-[11px] text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-indigo-500 text-sm h-[36px]"
            />
          </div>
          {canEdit && !setHeaderAction && (
            <button
              onClick={openAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 px-4 h-[36px] text-sm font-semibold shadow-sm transition flex-shrink-0 cursor-pointer"
            >
              <Plus size={16} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
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

          {/* Position Selection (Categorize user as Caller, Visitor, Lead Receiver, etc.) */}
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">
              Position / Category
            </label>
            <SearchableDropdown
              options={POSITION_OPTIONS}
              value={formData.position}
              onChange={(val) => handleChange('position', val)}
              placeholder="Select position (Caller, Visitor, etc.)"
              height="h-[34px]"
            />
          </div>

          {/* Lead Type Selection (Links user to Lead Type) */}
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">
              Assigned Lead Type
            </label>
            <SearchableDropdown
              options={leadTypeSelectOptions}
              value={formData.leadTypeId}
              onChange={(val) => handleChange('leadTypeId', val)}
              placeholder="Select lead type"
              height="h-[34px]"
            />
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
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">ID *</label>
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
              options={[{ value: 'ADMIN', label: 'Admin' }, { value: 'USER', label: 'User' }]}
              value={formData.role}
              onChange={(val) => handleChange('role', val)}
              placeholder="Select role"
              height="h-[34px]"
            />
          </div>

          {/* Page Access — Admins always have full access, so this only applies to Users */}
          {formData.role !== 'ADMIN' && (
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

        </div>
      </ModalForm>
    </div>
  );
}

