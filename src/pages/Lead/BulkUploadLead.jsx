import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from './leadConstants';

const TEMPLATE_HEADERS = [
  'Created Date', 'Product Type', 'Requirement', 'Investment Range', 'When to Buy Plan',
  'Person Name', 'Person Number', 'Customer Email', 'Customer DOB', 'Customer Occupation',
  'Address', 'Remarks'
];

const COLUMN_MAP = {
  'created date': 'timestamp',
  'product type': 'productType',
  'requirement': 'requirement',
  'investment range': 'investmentBudget',
  'when to buy plan': 'whenToBuyPlan',
  'person name': 'personName',
  'person number': 'number',
  'customer email': 'email',
  'customer dob': 'dob',
  'customer occupation': 'occupation',
  'address': 'location',
  'remarks': 'remarks'
};

const pad2 = (n) => String(n).padStart(2, '0');

const toTimestamp = (date) =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

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

// Parses a Customer DOB cell (Date object, Excel serial number, or DD/MM/YYYY / YYYY-MM-DD
// string) into the YYYY-MM-DD string the dob DATE column expects. Returns '' — never a
// malformed string — when the cell is empty or unparseable, so an unrecognized DOB never
// crashes the row's insert.
const parseDobForDb = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value === 'number') {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
    const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
      const [, y, m, d] = ymd;
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
    const generic = new Date(trimmed);
    if (!isNaN(generic.getTime())) return `${generic.getFullYear()}-${pad2(generic.getMonth() + 1)}-${pad2(generic.getDate())}`;
  }
  return '';
};

export default function BulkUploadLead({ isOpen, onClose, onImported }) {
  const [leadType, setLeadType] = useState('');
  const [leadReceiver, setLeadReceiver] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [leadSourcesMaster, setLeadSourcesMaster] = useState([]);
  const [leadReceiversMaster, setLeadReceiversMaster] = useState([]);
  const [realEstateProductsMaster, setRealEstateProductsMaster] = useState([]);
  const [mutualFundProductsMaster, setMutualFundProductsMaster] = useState([]);
  const [insuranceProductsMaster, setInsuranceProductsMaster] = useState([]);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        masterApi.getLeadTypes(),
        masterApi.getLeadSources(),
        masterApi.getLeadReceivers(),
        masterApi.getRealEstateProducts(),
        masterApi.getMutualFundProducts(),
        masterApi.getInsuranceProducts()
      ]).then(([types, sources, receivers, reProducts, mfProducts, insProducts]) => {
        setLeadTypesMaster(types);
        setLeadSourcesMaster(sources);
        setLeadReceiversMaster(receivers);
        setRealEstateProductsMaster(reProducts);
        setMutualFundProductsMaster(mfProducts);
        setInsuranceProductsMaster(insProducts);
      });
    }
  }, [isOpen]);

  const leadTypeOptions = leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }));
  const leadSourceOptions = leadSourcesMaster.map(s => ({ value: s.leadSource, label: s.leadSource }));
  const receiverOptions = leadReceiversMaster
    .filter(r => !leadType || r.leadType === leadType)
    .map(r => ({ value: r.personName, label: r.personName }));

  // Whichever Product Type master applies to the Lead Type picked for this whole file —
  // used to match each row's free-text "Product Type" cell to its canonical value.
  const productMasterFor = (type) => {
    const normalized = (type || '').toLowerCase();
    if (normalized.includes('real') || normalized.includes('estate') || normalized.includes('state')) {
      return realEstateProductsMaster;
    }
    if (normalized.includes('insurance')) return insuranceProductsMaster;
    if (normalized.includes('mutual') || normalized.includes('fund')) return mutualFundProductsMaster;
    return [];
  };

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

  const handleImport = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!leadType) { toast.error('Lead Type is required'); return; }
    if (!leadSource) { toast.error('Lead Source is required'); return; }
    if (!file) { toast.error('Please choose an Excel file to import'); return; }

    setLoading(true);

    const isInsurance = leadType.toLowerCase().includes('insurance');
    const productMaster = productMasterFor(leadType);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        let skipped = 0;
        let unmatchedProductType = 0;
        const newLeadsToInsert = [];
        const existingLeads = await leadApi.getLeads();
        let runningLeads = [...existingLeads];

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

          const leadNo = generateLeadNo(leadType, runningLeads);
          const timestamp = toTimestamp(parseCreatedDate(mapped.timestamp));

          // Match the cell's free-text Product Type against the live master list for this
          // Lead Type (case-insensitive) — an unmatched value is dropped rather than sent as
          // a fake match, since Real Estate/Mutual Fund only store this as an FK id.
          const rawProductType = String(mapped.productType ?? '').trim();
          let matchedProductType = '';
          if (rawProductType) {
            const match = productMaster.find(
              p => p.productType.toLowerCase() === rawProductType.toLowerCase()
            );
            if (match) {
              matchedProductType = match.productType;
            } else {
              unmatchedProductType += 1;
            }
          }

          const leadObj = {
            leadNo,
            timestamp,
            leadType,
            leadReceiver,
            leadSource,
            personName: String(mapped.personName ?? '').trim(),
            number: numberValue,
            email: String(mapped.email ?? '').trim(),
            dob: parseDobForDb(mapped.dob),
            occupation: String(mapped.occupation ?? '').trim(),
            investmentBudget: String(mapped.investmentBudget ?? '').trim(),
            location: String(mapped.location ?? '').trim(),
            whenToBuyPlan: String(mapped.whenToBuyPlan ?? '').trim(),
            callerAssigned: '',
            requirement: String(mapped.requirement ?? '').trim(),
            remarks: String(mapped.remarks ?? '').trim(),
            processType: 'Lead'
          };

          if (isInsurance) {
            leadObj.insuranceType = matchedProductType || 'Insurance';
          } else {
            leadObj.productType = matchedProductType;
          }

          newLeadsToInsert.push(leadObj);
          runningLeads.push(leadObj);
        });

        const imported = newLeadsToInsert.length;
        if (imported === 0) {
          toast.error('No valid rows found — every row needs a 10-digit Person Number.');
        } else {
          await leadApi.bulkSaveLeads(newLeadsToInsert);
          const notes = [];
          if (skipped > 0) notes.push(`${skipped} row${skipped > 1 ? 's' : ''} skipped (missing/invalid Person Number)`);
          if (unmatchedProductType > 0) notes.push(`${unmatchedProductType} row${unmatchedProductType > 1 ? 's' : ''} had a Product Type not found in the master list, imported without one`);
          toast.success(
            `${imported} lead${imported > 1 ? 's' : ''} imported` + (notes.length ? `, ${notes.join('; ')}.` : '.')
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
      loading={loading}
      maxWidth="max-w-xl"
    >
      <div className="space-y-3">
        <p className="text-[10px] md:text-[12px] text-gray-500 leading-relaxed">
          Lead Type, Lead Receiver Name and Lead Source below apply to every row in the file —
          the Excel file itself only needs each lead's own details. Product Type must match a
          value already in that Lead Type's Product Type master exactly (case-insensitive) or
          it's imported without one.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
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
