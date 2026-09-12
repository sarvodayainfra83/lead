import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Tags } from 'lucide-react';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { hasFullAccess } from '../../utils/authUtils';

/**
 * InsuranceSubProduct
 * Sub Product Type master for Insurance leads — each row is tied to a parent Insurance
 * Product Type (e.g. Life Insurance → KeyMan Insurance / ULIP Investment Plan / ...,
 * Health Insurance → Family Health Insurance / Critical Illness / ...). Feeds the Lead
 * form's Sub Product Type dropdown, which is filtered by the Product Type chosen there.
 */
export default function InsuranceSubProduct({ setHeaderAction, searchQuery = '' }) {
  const [rows, setRows] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [productType, setProductType] = useState('');
  const [subProductType, setSubProductType] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const user = useAuthStore(state => state.user);
  const canEdit = hasFullAccess(user, 'master');

  const load = async () => {
    const [subProducts, products] = await Promise.all([
      masterApi.getInsuranceSubProducts(),
      masterApi.getInsuranceProducts()
    ]);
    setRows(subProducts);
    setProductTypes(products);
  };
  useEffect(() => { load(); }, []);

  const openAdd = useCallback(() => { setEditRow(null); setProductType(''); setSubProductType(''); setShowForm(true); }, []);
  const openEdit = (row) => { setEditRow(row); setProductType(row.productType); setSubProductType(row.subProductType); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditRow(null); setProductType(''); setSubProductType(''); };

  useEffect(() => {
    if (setHeaderAction) {
      setHeaderAction(
        canEdit ? (
          <button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 px-4 h-[32px] lg:h-[38px] text-sm font-semibold shadow-sm transition"
          >
            <Plus size={16} /> Add Sub Product
          </button>
        ) : null
      );
    }
    return () => setHeaderAction && setHeaderAction(null);
  }, [setHeaderAction, openAdd, canEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!productType) { toast.error('Product Type is required'); return; }
    if (!subProductType.trim()) { toast.error('Sub Product Type is required'); return; }

    setLoading(true);
    try {
      await masterApi.saveInsuranceSubProduct({ id: editRow?.id, productType, subProductType: subProductType.trim() });
      toast.success(editRow ? 'Sub Product Type updated' : 'Sub Product Type added');
      await load();
      closeForm();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete sub product type "${row.subProductType}"?`)) return;
    await masterApi.deleteInsuranceSubProduct(row.id);
    await load();
    toast.success('Sub Product Type deleted');
  };

  const filteredRows = rows.filter(r =>
    !searchQuery ||
    Object.values(r).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const sortedRows = [...filteredRows].reverse();
  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);
  const paginatedRows = sortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = ["Serial No", "Product Type", "Sub Product Type"];
  if (canEdit) tableHeaders.push("Action");

  const renderRow = (row) => (
    <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{row.serialNo}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{row.productType}</td>
      <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{row.subProductType}</td>
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
    <div key={row.id} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
        <div>
          <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">Serial No {row.serialNo} · {row.productType}</span>
          <h4 className="text-sm text-gray-900 font-medium">{row.subProductType}</h4>
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1.5 mt-2">
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
        title={editRow ? 'Edit Sub Product Type' : 'Add Sub Product Type'}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : (editRow ? 'Update' : 'Save')}
        loading={loading}
        maxWidth="max-w-md"
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Product Type *</label>
            <SearchableDropdown
              options={productTypes.map(t => ({ value: t.productType, label: t.productType }))}
              value={productType}
              onChange={setProductType}
              placeholder="Select product type"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Sub Product Type *</label>
            <div className="relative">
              <Tags className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={subProductType}
                onChange={(e) => setSubProductType(e.target.value)}
                placeholder="Enter sub product type"
                className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
