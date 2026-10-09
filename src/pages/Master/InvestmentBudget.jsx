import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Wallet, Check } from 'lucide-react';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess } from '../../utils/authUtils';

/**
 * InvestmentBudget
 * Investment Budget master (10k - 20k, 20k - 50k, ... Above 5 Lakh), each tagged with one or more
 * Lead Types (stored as master_lead_types ids) — untagged budgets are shared across all Lead Types. Feeds the Lead form's Investment Budget dropdown.
 */
export default function InvestmentBudget({ setHeaderAction, searchQuery = '' }) {
  const [rows, setRows] = useState([]);
  const [leadTypes, setLeadTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [selectedLeadTypeIds, setSelectedLeadTypeIds] = useState([]);
  const [investmentBudget, setInvestmentBudget] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'master');

  const load = async () => {
    const [budgetsData, typesData] = await Promise.all([
      masterApi.getInvestmentBudgets(),
      masterApi.getLeadTypes()
    ]);
    setRows(budgetsData || []);
    setLeadTypes(typesData || []);
  };
  useEffect(() => {
    load().catch(err => {
      console.error('Failed to load from the database:', err);
      toast.error('Could not load data from the database');
    });
  }, []);

  const openAdd = useCallback(() => { setEditRow(null); setSelectedLeadTypeIds([]); setInvestmentBudget(''); setShowForm(true); }, []);
  const openEdit = (row) => { setEditRow(row); setSelectedLeadTypeIds(row.leadTypeIds || []); setInvestmentBudget(row.investmentBudget || ''); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditRow(null); setSelectedLeadTypeIds([]); setInvestmentBudget(''); };

  const toggleLeadType = (id) => {
    setSelectedLeadTypeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const leadTypesLabel = (row) => (row.leadTypes?.length > 0 ? row.leadTypes.join(', ') : 'All');

  useEffect(() => {
    if (setHeaderAction) {
      setHeaderAction(
        canEdit ? (
          <button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 px-3 h-[34px] text-xs sm:text-sm font-semibold whitespace-nowrap shadow-sm transition"
          >
            <Plus size={16} /> Add Investment Budget
          </button>
        ) : null
      );
    }
    return () => setHeaderAction && setHeaderAction(null);
  }, [setHeaderAction, openAdd, canEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!investmentBudget.trim()) { toast.error('Investment Budget is required'); return; }

    setLoading(true);
    try {
      // Keep master order so the stored ids are stable regardless of click order
      const leadTypeIds = leadTypes.map(t => t.id).filter(id => selectedLeadTypeIds.includes(id));
      await masterApi.saveInvestmentBudget({
        id: editRow?.id,
        investmentBudget: investmentBudget.trim(),
        leadTypeIds,
        leadTypes: leadTypes.filter(t => leadTypeIds.includes(t.id)).map(t => t.leadType)
      });
      toast.success(editRow ? 'Investment Budget updated' : 'Investment Budget added');
      await load();
      closeForm();
    } catch (err) {
      toast.error(err?.message || 'Failed to save Investment Budget');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.investmentBudget}"?`)) return;
    await masterApi.deleteInvestmentBudget(row.id);
    await load();
    toast.success('Investment Budget deleted');
  };

  const filteredRows = rows.filter(r =>
    !searchQuery ||
    [r.investmentBudget, leadTypesLabel(r)].some(val => String(val || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = ["Serial No", "Lead Type", "Investment Budget"];
  if (canEdit) tableHeaders.push("Action");

  const renderRow = (row, idx) => {
    const srNo = (currentPage - 1) * itemsPerPage + idx + 1;
    return (
      <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{srNo}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{leadTypesLabel(row)}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{row.investmentBudget}</td>
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
          <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">Serial No {srNo} · {leadTypesLabel(row)}</span>
          <h4 className="text-sm text-gray-900 font-medium">{row.investmentBudget}</h4>
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
    <div className="p-2 sm:p-3 space-y-2 flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <DataTable
          headers={tableHeaders}
          data={paginatedRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="600px"
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
        title={editRow ? 'Edit Investment Budget' : 'Add Investment Budget'}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : (editRow ? 'Update' : 'Save')}
        loading={loading}
        maxWidth="max-w-md"
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Type</label>
            <div className="flex flex-wrap gap-1.5">
              {leadTypes.map(t => {
                const selected = selectedLeadTypeIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleLeadType(t.id)}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1 px-2.5 h-[30px] rounded-lg border text-[11px] md:text-[13px] font-medium transition-colors ${selected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {selected && <Check size={12} />}
                    {t.leadType}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] md:text-[11px] text-gray-500">Select one or more. Leave all unselected to apply to every lead type.</p>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Investment Budget *</label>
            <div className="relative">
              <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={investmentBudget}
                onChange={(e) => setInvestmentBudget(e.target.value)}
                placeholder="Enter investment budget (e.g. 10k - 20k)"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px]"
              />
            </div>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
