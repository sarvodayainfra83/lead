import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { getLeads, saveLead, getLeadTypesMaster, getLeadSourcesMaster, getLeadReceiversMaster } from '../../utils/storageManager';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from './leadConstants';

/**
 * BulkUploadLead
 * Pop-up for importing many leads at once from an Excel file. Lead Type, Lead
 * Receiver Name and Lead Source are picked once here and applied to every row —
 * the file itself only carries the per-lead details.
 */
const TEMPLATE_HEADERS = [
  'Created Date', 'Requirement', 'Investment Range', 'When to Buy Plan',
  'Person Name', 'Person Number', 'Address', 'Remarks'
];

const COLUMN_MAP = {
  'created date': 'timestamp',
  'requirement': 'requirement',
  'investment range': 'investmentBudget',
  'when to buy plan': 'whenToBuyPlan',
  'person name': 'personName',
  'person number': 'number',
  'address': 'location',
  'remarks': 'remarks'
};

const pad2 = (n) => String(n).padStart(2, '0');

const toTimestamp = (date) =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

// Accepts an Excel date object, an Excel serial number, a "DD/MM/YYYY" string, or
// any other parseable date string — falls back to now when the cell is empty/unreadable.
const parseCreatedDate = (value) => {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const fromSerial = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(fromSerial.getTime())) return fromSerial;
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const fromDMY = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(fromDMY.getTime())) return fromDMY;
    }
    const generic = new Date(trimmed);
    if (!isNaN(generic.getTime())) return generic;
  }
  return new Date();
};

export default function BulkUploadLead({ isOpen, onClose, onImported }) {
  const [leadType, setLeadType] = useState('');
  const [leadReceiver, setLeadReceiver] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const leadTypeOptions = getLeadTypesMaster().map(t => ({ value: t.leadType, label: t.leadType }));
  const leadSourceOptions = getLeadSourcesMaster().map(s => ({ value: s.leadSource, label: s.leadSource }));
  const receiverOptions = getLeadReceiversMaster()
    .filter(r => !leadType || r.leadType === leadType)
    .map(r => ({ value: r.personName, label: r.personName }));

  const resetState = () => {
    setLeadType('');
    setLeadReceiver('');
    setLeadSource('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, 'Lead_Bulk_Upload_Template.xlsx');
  };

  const handleImport = (e) => {
    e.preventDefault();

    if (!leadType) { toast.error('Lead Type is required'); return; }
    if (!leadSource) { toast.error('Lead Source is required'); return; }
    if (!file) { toast.error('Please choose an Excel file to import'); return; }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        let imported = 0;
        let skipped = 0;

        rows.forEach((row) => {
          const mapped = {};
          Object.entries(row).forEach(([key, value]) => {
            const field = COLUMN_MAP[key.trim().toLowerCase()];
            if (field) mapped[field] = value;
          });

          const numberValue = String(mapped.number ?? '').replace(/\D/g, '').slice(0, 10);
          if (numberValue.length !== 10) {
            skipped += 1;
            return;
          }

          const existingLeads = getLeads();
          const leadNo = generateLeadNo(leadType, existingLeads);
          const timestamp = toTimestamp(parseCreatedDate(mapped.timestamp));

          saveLead({
            id: leadNo,
            leadNo,
            timestamp,
            processType: 'Import',
            leadType,
            leadReceiver,
            leadSource,
            personName: String(mapped.personName ?? '').trim(),
            number: numberValue,
            email: '',
            dob: '',
            occupation: '',
            requirement: String(mapped.requirement ?? '').trim(),
            investmentBudget: String(mapped.investmentBudget ?? '').trim(),
            location: String(mapped.location ?? '').trim(),
            whenToBuyPlan: String(mapped.whenToBuyPlan ?? '').trim(),
            remarks: String(mapped.remarks ?? '').trim()
          });
          imported += 1;
        });

        if (imported === 0) {
          toast.error('No valid rows found — every row needs a 10-digit Person Number.');
        } else {
          toast.success(
            `${imported} lead${imported > 1 ? 's' : ''} imported` +
            (skipped > 0 ? `, ${skipped} row${skipped > 1 ? 's' : ''} skipped (missing/invalid Person Number).` : '.')
          );
          onImported?.();
          handleClose();
        }
      } catch (err) {
        toast.error('Could not read this file. Please use the downloaded template format.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Upload Leads"
      onSubmit={handleImport}
      submitText={loading ? 'Importing...' : 'Import'}
      maxWidth="max-w-xl"
    >
      <div className="space-y-3">
        <p className="text-[10px] md:text-[12px] text-gray-500 leading-relaxed">
          Lead Type, Lead Receiver Name and Lead Source below apply to every row in the file —
          the Excel file itself only needs each lead's own details.
        </p>

        <div className="grid grid-cols-2 gap-2 md:gap-4">
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Type *</label>
            <SearchableDropdown
              options={leadTypeOptions}
              value={leadType}
              onChange={(val) => { setLeadType(val); setLeadReceiver(''); }}
              placeholder="Select lead type"
            />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Receiver Name</label>
            <SearchableDropdown
              options={receiverOptions}
              value={leadReceiver}
              onChange={setLeadReceiver}
              placeholder="Select lead receiver"
            />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Lead Source *</label>
            <SearchableDropdown
              options={leadSourceOptions}
              value={leadSource}
              onChange={setLeadSource}
              placeholder="Select lead source"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="w-full flex items-center justify-center gap-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg py-2 text-[11px] md:text-[13px] font-semibold uppercase tracking-wide hover:bg-indigo-100 transition-colors"
        >
          <Download size={14} /> Download Excel Template
        </button>

        <div className="space-y-1">
          <label className="block text-[11px] md:text-[13px] text-gray-700 uppercase tracking-tight">Excel File *</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border border-gray-300 rounded pl-2 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-indigo-600 file:text-white file:text-[11px] file:font-semibold hover:file:bg-indigo-700"
          />
          {file && <p className="text-[10px] text-gray-500 truncate">Selected: {file.name}</p>}
        </div>
      </div>
    </ModalForm>
  );
}
