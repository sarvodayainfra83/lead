import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Share2 } from 'lucide-react';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess } from '../../utils/authUtils';

export default function Leadsource({ setHeaderAction }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [leadSource, setLeadSource] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'master');

  const load = async () => {
    const data = await masterApi.getLeadSources();
    setRows(data);
  };
  useEffect(() => { load(); }, []);

  const openAdd = useCallback(() => { setEditRow(null); setLeadSource(''); setShowForm(true); }, []);
  const openEdit = (row) => { setEditRow(row); setLeadSource(row.leadSource); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditRow(null); setLeadSource(''); };

  useEffect(() => {
    if (setHeaderAction) {
      setHeaderAction(
        canEdit ? (
          <button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 px-4 h-[32px] lg:h-[38px] text-sm font-semibold shadow-sm transition"
          >
            <Plus size={16} /> Add Lead Source
          </button>
        ) : null
      );
    }
    return () => setHeaderAction && setHeaderAction(null);
  }, [setHeaderAction, openAdd, canEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!leadSource.trim()) { toast.error('Lead Source is required'); return; }

    setLoading(true);
    try {
      await masterApi.saveLeadSource({ id: editRow?.id, leadSource: leadSource.trim() });
      toast.success(editRow ? 'Lead Source updated' : 'Lead Source added');
      await load();
      closeForm();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete lead source "${row.leadSource}"?`)) return;
    await masterApi.deleteLeadSource(row.id);
    await load();
    toast.success('Lead Source deleted');
  };

  const sortedRows = [...rows].reverse();
  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);
  const paginatedRows = sortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = ["Serial No", "Lead Source"];
  if (canEdit) tableHeaders.push("Action");

  const renderRow = (row, idx) => {
    const srNo = (currentPage - 1) * itemsPerPage + idx + 1;
    return (
      <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{srNo}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{row.leadSource}</td>
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
  };

  const renderCard = (row, idx) => {
    const srNo = (currentPage - 1) * itemsPerPage + idx + 1;
    return (
      <div key={row.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 flex items-center justify-between">
        <div>
          <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">Serial No {srNo}</span>
          <h4 className="text-sm text-gray-900 font-medium">{row.leadSource}</h4>
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
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
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
        title={editRow ? 'Edit Lead Source' : 'Add Lead Source'}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : (editRow ? 'Update' : 'Save')}
        loading={loading}
        maxWidth="max-w-md"
      >
        <div className="space-y-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Source *</label>
          <div className="relative">
            <Share2 className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              placeholder="Enter lead source"
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
            />
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
