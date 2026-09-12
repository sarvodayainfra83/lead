import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, User, Phone, Mail, IdCard, Lock, Info, ShieldCheck, Search } from 'lucide-react';
import { settingApi } from '../../api/settingApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import DataTable from '../../components/DataTable';
import InfoPopover from '../../components/InfoPopover';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess } from '../../utils/authUtils';

// Every page an access level can be granted for — Admins bypass this and always get full access.
const APP_PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'lead', label: 'Lead' },
  { key: 'callTracker', label: 'Call Tracker' },
  { key: 'customerMaster', label: 'Customer Master' },
  { key: 'master', label: 'Master' },
  { key: 'callerReport', label: 'Caller Report' },
  { key: 'setting', label: 'Setting' }
];

const ACCESS_LEVELS = [
  { value: 'none', label: 'No Access' },
  { value: 'view', label: 'View' },
  { value: 'full', label: 'Full Access' }
];

const emptyAccessPages = () => Object.fromEntries(APP_PAGES.map(p => [p.key, 'none']));

const initialFormData = {
  name: '',
  number: '',
  gmail: '',
  id: '',
  password: '',
  role: 'USER',
  accessPages: emptyAccessPages()
};

export default function Setting() {
  const { user } = useAuthStore();
  const canEdit = hasFullAccess(user, 'setting');

  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const load = async () => {
    const users = await settingApi.getUsers();
    setRows(users);
  };
  useEffect(() => { load(); }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAccessChange = (pageKey, level) => {
    setFormData(prev => ({ ...prev, accessPages: { ...prev.accessPages, [pageKey]: level } }));
  };

  const openAdd = () => {
    setEditRow(null);
    setFormData({ ...initialFormData });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setFormData({
      name: row.name || '',
      number: row.number || '',
      gmail: row.gmail || '',
      id: row.id || '',
      password: row.password || '',
      role: row.role || 'USER',
      accessPages: { ...emptyAccessPages(), ...(row.accessPages || {}) }
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditRow(null);
    setFormData({ ...initialFormData });
  };

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

      const payload = {
        name: formData.name.trim(),
        number: formData.number.trim(),
        gmail: formData.gmail.trim(),
        id: formData.id.trim(),
        password: formData.password,
        role: formData.role,
        accessPages: formData.role === 'ADMIN' ? {} : formData.accessPages
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
      const levelVal = row.accessPages?.[p.key] || 'none';
      const levelLabel = ACCESS_LEVELS.find(l => l.value === levelVal)?.label || 'No Access';
      return { page: p.label, level: levelLabel, val: levelVal };
    });
  };

  const filteredRows = rows.filter(row => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (row.name || '').toLowerCase().includes(q) ||
      (row.number || '').toLowerCase().includes(q) ||
      (row.gmail || '').toLowerCase().includes(q) ||
      (row.id || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = ["Serial No", "Name", "Number", "Gmail", "ID", "Pass", "Page Access"];
  if (canEdit) tableHeaders.unshift("Action");

  const renderRow = (row) => (
    <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      {canEdit && (
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => openEdit(row)} title="Edit" className="inline-flex items-center justify-center p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(row)} title="Delete" className="inline-flex items-center justify-center p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      )}
      <td className="px-4 py-2.5 text-center text-[13px] text-indigo-600 font-bold whitespace-nowrap">{serialLabel(row)}</td>
      <td className="px-4 py-2.5 text-center text-[13px] font-medium text-gray-900 whitespace-nowrap">{row.name}</td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.number || '-'}</td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.gmail || '-'}</td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-700 whitespace-nowrap">{row.id}</td>
      <td className="px-4 py-2.5 text-center text-[13px] text-gray-600 whitespace-nowrap font-mono">{row.password}</td>
      <td className="px-4 py-2.5 min-w-[250px]">
        {row.role === 'ADMIN' ? (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
              <ShieldCheck size={11} /> Full Access
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
        {row.role === 'ADMIN' ? (
          <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold uppercase flex items-center gap-1">
            <ShieldCheck size={10} /> Admin
          </span>
        ) : (
          <span className="text-[9px] bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full font-semibold uppercase">
            User
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
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
          <button onClick={() => openEdit(row)} className="flex-1 bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1">
            <Pencil size={11} /> Edit
          </button>
          <button onClick={() => handleDelete(row)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1">
            <Trash2 size={11} /> Del
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-[11px] text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-indigo-500 text-sm h-[36px]"
          />
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 px-4 h-[36px] text-sm font-semibold shadow-sm transition flex-shrink-0"
          >
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="800px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredRows.length}
        />
      </div>

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
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
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
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
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
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
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
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
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
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
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
