import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import ModalForm from '../../components/ModalForm';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess } from '../../utils/authUtils';

/**
 * SimpleTextMaster
 * Generic single-text-field master list (Add / Edit / Delete) reused by every master that is
 * just "a list of names" — Mutual Fund Product Type, Real Estate Product Type, Real Estate
 * Requirement, Insurance Product Type, ... — so each of those only has to describe its field
 * name, label, icon and storage CRUD functions instead of re-implementing this screen.
 */
export default function SimpleTextMaster({
  setHeaderAction,
  searchQuery = '',
  fieldName,
  entityLabel,
  icon: Icon,
  getAll,
  save,
  remove,
  placeholder
}) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'master');

  const load = async () => {
    const data = await getAll();
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const openAdd = useCallback(() => { setEditRow(null); setValue(''); setShowForm(true); }, []);
  const openEdit = (row) => { setEditRow(row); setValue(row[fieldName] || ''); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditRow(null); setValue(''); };

  useEffect(() => {
    if (setHeaderAction) {
      setHeaderAction(
        canEdit ? (
          <button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 px-4 h-[32px] lg:h-[38px] text-sm font-semibold shadow-sm transition"
          >
            <Plus size={16} /> Add {entityLabel}
          </button>
        ) : null
      );
    }
    return () => setHeaderAction && setHeaderAction(null);
  }, [setHeaderAction, openAdd, entityLabel, canEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!value.trim()) { toast.error(`${entityLabel} is required`); return; }

    setLoading(true);
    try {
      await save({ id: editRow?.id, [fieldName]: value.trim() });
      toast.success(editRow ? `${entityLabel} updated` : `${entityLabel} added`);
      await load();
      closeForm();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row[fieldName]}"?`)) return;
    await remove(row.id);
    await load();
    toast.success(`${entityLabel} deleted`);
  };

  const filteredRows = rows.filter(r =>
    !searchQuery ||
    Object.values(r).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const sortedRows = [...filteredRows].reverse();
  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);
  const paginatedRows = sortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = ["Serial No", entityLabel];
  if (canEdit) tableHeaders.push("Action");

  const renderRow = (row) => (
    <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.serialNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{row[fieldName]}</td>
      {canEdit && (
        <td className="px-4 py-3 text-center whitespace-nowrap">
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
    </tr>
  );

  const renderCard = (row) => (
    <div key={row.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 flex items-center justify-between">
      <div>
        <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">Serial No {row.serialNo}</span>
        <h4 className="text-sm text-gray-900 font-medium">{row[fieldName]}</h4>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1.5">
          <button onClick={() => openEdit(row)} className="p-1.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
            <Pencil size={13} />
          </button>
          <button onClick={() => handleDelete(row)} className="p-1.5 rounded bg-red-50 text-red-600 border border-red-200">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="500px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={sortedRows.length}
        />
      </div>

      <ModalForm
        isOpen={showForm}
        onClose={closeForm}
        title={editRow ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : (editRow ? 'Update' : 'Save')}
        loading={loading}
        maxWidth="max-w-md"
      >
        <div className="space-y-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">{entityLabel} *</label>
          <div className="relative">
            {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />}
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className={`w-full border border-gray-300 rounded ${Icon ? 'pl-8' : 'pl-3'} pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]`}
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
