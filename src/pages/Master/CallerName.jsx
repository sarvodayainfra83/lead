import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, User } from 'lucide-react';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import DataTable from '../../components/DataTable';

export default function CallerName({ setHeaderAction }) {
  const [rows, setRows] = useState([]);
  const [leadTypes, setLeadTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [leadType, setLeadType] = useState('');
  const [personName, setPersonName] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const load = async () => {
    const [callersData, typesData] = await Promise.all([
      masterApi.getCallerNames(),
      masterApi.getLeadTypes()
    ]);
    setRows(callersData);
    setLeadTypes(typesData);
  };
  useEffect(() => { load(); }, []);

  const openAdd = useCallback(() => { setEditRow(null); setLeadType(''); setPersonName(''); setShowForm(true); }, []);
  const openEdit = (row) => { setEditRow(row); setLeadType(row.leadType); setPersonName(row.personName); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditRow(null); setLeadType(''); setPersonName(''); };

  useEffect(() => {
    if (setHeaderAction) {
      setHeaderAction(
        <button
          onClick={openAdd}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 px-4 h-[32px] lg:h-[38px] text-sm font-semibold shadow-sm transition"
        >
          <Plus size={16} /> Add Caller Name
        </button>
      );
    }
    return () => setHeaderAction && setHeaderAction(null);
  }, [setHeaderAction, openAdd]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leadType) { toast.error('Lead Type is required'); return; }
    if (!personName.trim()) { toast.error('Person Name is required'); return; }

    await masterApi.saveCallerName({ id: editRow?.id, leadType, personName: personName.trim() });
    toast.success(editRow ? 'Caller Name updated' : 'Caller Name added');
    await load();
    closeForm();
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete caller name "${row.personName}"?`)) return;
    await masterApi.deleteCallerName(row.id);
    await load();
    toast.success('Caller Name deleted');
  };

  const sortedRows = [...rows].reverse();
  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);
  const paginatedRows = sortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = ["Serial No", "Lead Type", "Person Name", "Action"];

  const renderRow = (row) => (
    <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.serialNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{row.leadType}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{row.personName}</td>
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
    </tr>
  );

  const renderCard = (row) => (
    <div key={row.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">Serial No {row.serialNo} · {row.leadType}</span>
          <h4 className="text-sm text-gray-900 font-medium">{row.personName}</h4>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => openEdit(row)} className="flex-1 bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1">
          <Pencil size={11} /> Edit
        </button>
        <button onClick={() => handleDelete(row)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1">
          <Trash2 size={11} /> Del
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-3 flex flex-col h-full min-h-0">      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="700px"
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
        title={editRow ? 'Edit Caller Name' : 'Add Caller Name'}
        onSubmit={handleSubmit}
        submitText={editRow ? 'Update' : 'Save'}
        maxWidth="max-w-md"
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Type *</label>
            <SearchableDropdown
              options={leadTypes.map(t => ({ value: t.leadType, label: t.leadType }))}
              value={leadType}
              onChange={setLeadType}
              placeholder="Select lead type"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Person Name *</label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Enter person name"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
