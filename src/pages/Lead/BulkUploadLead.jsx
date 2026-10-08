import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Download, Share2, UploadCloud, FileSpreadsheet, ArrowRight, Layers, FileUp } from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { masterApi } from '../../api/masterApi';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../store/authStore';
import { isUserAdmin } from '../../utils/authUtils';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import { generateLeadNo } from './leadConstants';

import { TEMPLATE_DOWNLOAD_HEADERS } from './bulkUpload/bulkLeadFields';
import { autoMapHeaders } from './bulkUpload/normalizeLeadHeader';
import { validateAllRows, validateSingleRow, cleanPhoneNumber } from './bulkUpload/validateBulkLead';
import BulkColumnMapping from './bulkUpload/BulkColumnMapping';
import BulkLeadPreview from './bulkUpload/BulkLeadPreview';
import BulkLeadEditModal from './bulkUpload/BulkLeadEditModal';

const STEP_UPLOAD = 'upload';
const STEP_MAPPING = 'mapping';
const STEP_PREVIEW = 'preview';

/**
 * assignCaller: used from Lead & Followup — every imported lead gets a caller (defaults to the
 * logged-in user) so it lands straight in that caller's follow-up queue instead of the Lead page's
 * pending "assign caller" list.
 */
export default function BulkUploadLead({ isOpen, onClose, onImported, defaultLeadType, assignCaller = false }) {
  const user = useAuthStore(state => state.user);
  const isAdmin = isUserAdmin(user);

  // Workflow step
  const [currentStep, setCurrentStep] = useState(STEP_UPLOAD);

  // Master Data
  const [leadTypesMaster, setLeadTypesMaster] = useState([]);
  const [leadSourcesMaster, setLeadSourcesMaster] = useState([]);
  const [leadReceiversMaster, setLeadReceiversMaster] = useState([]);
  const [callerNamesMaster, setCallerNamesMaster] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [realEstateProductsMaster, setRealEstateProductsMaster] = useState([]);
  const [realEstateRequirementsMaster, setRealEstateRequirementsMaster] = useState([]);
  const [mutualFundProductsMaster, setMutualFundProductsMaster] = useState([]);
  const [insuranceProductsMaster, setInsuranceProductsMaster] = useState([]);
  const [insuranceSubProductsMaster, setInsuranceSubProductsMaster] = useState([]);
  const [investmentBudgetsMaster, setInvestmentBudgetsMaster] = useState([]);

  // Existing database leads for duplicate checking & sequence generation
  const [existingDbLeads, setExistingDbLeads] = useState([]);

  const resolveUserLeadType = (typesList = leadTypesMaster) => {
    if (defaultLeadType) return defaultLeadType;
    if (user?.leadType) return user.leadType;
    if (user?.leadTypeId && typesList?.length > 0) {
      const found = typesList.find(lt => String(lt.id) === String(user.leadTypeId));
      if (found) return found.leadType;
    }
    return 'Real Estate';
  };

  // Form selections (apply to whole batch)
  const [leadType, setLeadType] = useState(() => defaultLeadType || user?.leadType || 'Real Estate');
  const [leadReceiver, setLeadReceiver] = useState('');
  const [callerAssigned, setCallerAssigned] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [customLeadSource, setCustomLeadSource] = useState('');
  const [file, setFile] = useState(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const fileInputRef = useRef(null);
  const wasOpenRef = useRef(false);

  // Parsed data state
  const [rawFileRows, setRawFileRows] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState([]);
  const [validatedRows, setValidatedRows] = useState([]);

  // Editing state for preview row
  const [editingRow, setEditingRow] = useState(null);

  // Loading states
  const [parsingLoading, setParsingLoading] = useState(false);
  const [importingLoading, setImportingLoading] = useState(false);

  // Load masters on modal open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setCurrentStep(STEP_UPLOAD);
      const defaultType = defaultLeadType || resolveUserLeadType();
      if (defaultType) setLeadType(defaultType);

      Promise.all([
        masterApi.getLeadTypes(),
        masterApi.getLeadSources(),
        masterApi.getLeadReceivers(),
        masterApi.getRealEstateProducts(),
        masterApi.getRealEstateRequirements(),
        masterApi.getMutualFundProducts(),
        masterApi.getInsuranceProducts(),
        masterApi.getInsuranceSubProducts(),
        masterApi.getInvestmentBudgets(),
        authApi.getUsers().catch(() => []),
        leadApi.getAllLeads().catch(() => []),
        assignCaller ? masterApi.getCallerNames().catch(() => []) : Promise.resolve([])
      ]).then(([
        types, sources, receivers, reProducts, reRequirements,
        mfProducts, insProducts, insSubProducts, budgets, usersData, existingLeads, callers
      ]) => {
        setCallerNamesMaster(callers || []);
        setLeadTypesMaster(types || []);
        setLeadSourcesMaster(sources || []);
        setLeadReceiversMaster(receivers || []);
        setUsersList(usersData || []);
        setRealEstateProductsMaster(reProducts || []);
        setRealEstateRequirementsMaster(reRequirements || []);
        setMutualFundProductsMaster(mfProducts || []);
        setInsuranceProductsMaster(insProducts || []);
        setInsuranceSubProductsMaster(insSubProducts || []);
        setInvestmentBudgetsMaster(budgets || []);
        setExistingDbLeads(existingLeads || []);

        const resolved = resolveUserLeadType(types || []);
        if (resolved) setLeadType(prev => prev || resolved);
      }).catch(console.error);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, defaultLeadType]);

  const isOtherValue = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    return lower === 'other' || lower === 'others' || lower === 'add new' || lower === 'add_new' || lower === '+ add new';
  };

  const leadTypeOptions = leadTypesMaster.map(t => ({ value: t.leadType, label: t.leadType }));
  const leadSourceOptions = useMemo(() => {
    return (leadSourcesMaster || [])
      .filter(s => !isOtherValue(s.leadSource))
      .map(s => ({ value: s.leadSource, label: s.leadSource }));
  }, [leadSourcesMaster]);

  const selectedLeadTypeObj = (leadTypesMaster || []).find(t =>
    t.leadType?.toLowerCase().trim() === leadType?.toLowerCase().trim()
  );
  const selectedLeadTypeId = selectedLeadTypeObj?.id;

  const receiverOptions = useMemo(() => {
    // 1. Gather all team members from leadReceiversMaster and usersList
    const allMembers = [...(leadReceiversMaster || [])];
    (usersList || []).forEach(u => {
      const name = u.name || u.personName;
      if (name && !allMembers.some(r => (r.personName || r.name) === name)) {
        allMembers.push({
          id: u.id || u.dbId,
          personName: name,
          name: name,
          leadTypeId: u.leadTypeId || u.lead_type_id,
          leadType: u.leadType || ''
        });
      }
    });

    // 2. Filter by lead type (UUID match, or exact/fuzzy string match)
    const filtered = allMembers.filter(r => {
      if (!leadType) return true;
      if (selectedLeadTypeId && (r.leadTypeId === selectedLeadTypeId || r.lead_type_id === selectedLeadTypeId)) {
        return true;
      }
      const rType = String(r.leadType || '').toLowerCase().trim();
      const targetType = String(leadType || '').toLowerCase().trim();
      if (rType && targetType && (rType === targetType || rType.includes(targetType) || targetType.includes(rType))) {
        return true;
      }
      return false;
    });

    // 3. If there are members specific to this lead type, use them; otherwise fallback to all members
    const pool = filtered.length > 0 ? filtered : allMembers;

    return Array.from(
      new Set(pool.map(r => r.personName || r.name).filter(Boolean))
    ).map(name => ({ value: name, label: name }));
  }, [leadReceiversMaster, usersList, leadType, selectedLeadTypeId]);

  // Callers for the selected lead type (same rules as the Direct lead form); you first when eligible
  const callerOptions = useMemo(() => {
    if (!assignCaller) return undefined;
    const target = String(leadType || '').toLowerCase().trim();
    const matching = (callerNamesMaster || []).filter(c => {
      if (!target) return true;
      const cType = String(c.leadType || '').toLowerCase().trim();
      const cTypeId = String(c.leadTypeId || c.lead_type_id || '').trim();
      if (selectedLeadTypeId && cTypeId && String(selectedLeadTypeId) === cTypeId) return true;
      return Boolean(cType && (cType === target || target.includes(cType) || cType.includes(target)));
    });
    const pool = matching.length > 0 ? matching : (callerNamesMaster || []);
    const opts = Array.from(new Set(pool.map(c => c.personName || c.name).filter(Boolean)))
      .map(name => ({ value: name, label: name }));

    if (user?.name && !opts.some(o => o.value === user.name)) {
      const userType = String(user.leadType || '').toLowerCase().trim();
      if (isAdmin || !userType || userType.includes(target) || target.includes(userType)) {
        opts.unshift({ value: user.name, label: `${user.name} (You)` });
      }
    }
    return opts;
  }, [assignCaller, callerNamesMaster, leadType, selectedLeadTypeId, user, isAdmin]);

  // Keep the chosen caller valid for the lead type — default to the logged-in user, else the first caller
  useEffect(() => {
    if (!callerOptions || callerOptions.length === 0) return;
    if (!callerOptions.some(o => o.value === callerAssigned)) {
      const self = callerOptions.find(o => o.value === user?.name);
      setCallerAssigned(self ? self.value : callerOptions[0].value);
    }
  }, [callerOptions, callerAssigned, user]);

  // Master Data lookup bundle for current lead type
  const currentMasterBundle = useMemo(() => {
    const normalized = (leadType || '').toLowerCase();
    let productMaster = [];
    if (normalized.includes('real') || normalized.includes('estate') || normalized.includes('state')) {
      productMaster = realEstateProductsMaster;
    } else if (normalized.includes('insurance')) {
      productMaster = insuranceProductsMaster;
    } else if (normalized.includes('mutual') || normalized.includes('fund')) {
      productMaster = mutualFundProductsMaster;
    }

    return {
      productMaster,
      requirementsMaster: realEstateRequirementsMaster,
      investmentBudgetsMaster,
      insuranceSubProductsMaster
    };
  }, [
    leadType,
    realEstateProductsMaster,
    insuranceProductsMaster,
    mutualFundProductsMaster,
    realEstateRequirementsMaster,
    investmentBudgetsMaster,
    insuranceSubProductsMaster
  ]);

  const resetState = () => {
    setCurrentStep(STEP_UPLOAD);
    setLeadType(resolveUserLeadType());
    setLeadReceiver('');
    setLeadSource('');
    setCustomLeadSource('');
    setFile(null);
    setRawFileRows([]);
    setRawHeaders([]);
    setColumnMapping([]);
    setValidatedRows([]);
    setEditingRow(null);
    setHasAttemptedSubmit(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_DOWNLOAD_HEADERS]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, 'Lead_Bulk_Upload_Template.xlsx');
  };

  // IMMEDIATE PARSING ON FILE SELECTION -> Auto-maps & jumps immediately to Designed Preview!
  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setParsingLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          toast.error('The selected file contains no sheets');
          setParsingLoading(false);
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

        if (!rows || rows.length === 0) {
          toast.error('The sheet is empty. Please upload a file with lead records.');
          setParsingLoading(false);
          return;
        }

        // Extract header row
        const headers = Object.keys(rows[0] || {});
        if (headers.length === 0) {
          toast.error('Could not detect header columns in the uploaded file');
          setParsingLoading(false);
          return;
        }

        // 1. Run smart auto-mapping
        const initialMapping = autoMapHeaders(headers, rows);

        // 2. Validate all rows immediately with current master data
        const validated = validateAllRows(
          rows,
          initialMapping,
          leadType,
          currentMasterBundle,
          existingDbLeads
        );

        setRawFileRows(rows);
        setRawHeaders(headers);
        setColumnMapping(initialMapping);
        setValidatedRows(validated);

        // Transition straight to designed preview!
        setCurrentStep(STEP_PREVIEW);

        const validCount = validated.filter(r => r.status === 'VALID').length;
        const errorCount = validated.filter(r => r.status === 'ERROR').length;
        toast.success(`Loaded ${rows.length} records (${validCount} valid, ${errorCount} errors)`);
      } catch (err) {
        console.error('File parse error:', err);
        toast.error('Failed to parse this file. Please ensure it is a valid .xlsx, .xls, or .csv file.');
      } finally {
        setParsingLoading(false);
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file from disk');
      setParsingLoading(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  // Re-run validation when Lead Type is changed on Preview
  const handleLeadTypeChange = (newLeadType) => {
    setLeadType(newLeadType);
    setLeadReceiver('');

    if (rawFileRows.length > 0 && columnMapping.length > 0) {
      const normalized = (newLeadType || '').toLowerCase();
      let productMaster = [];
      if (normalized.includes('real') || normalized.includes('estate') || normalized.includes('state')) {
        productMaster = realEstateProductsMaster;
      } else if (normalized.includes('insurance')) {
        productMaster = insuranceProductsMaster;
      } else if (normalized.includes('mutual') || normalized.includes('fund')) {
        productMaster = mutualFundProductsMaster;
      }

      const updatedMasterBundle = {
        productMaster,
        requirementsMaster: realEstateRequirementsMaster,
        investmentBudgetsMaster,
        insuranceSubProductsMaster
      };

      const revalidated = validateAllRows(
        rawFileRows,
        columnMapping,
        newLeadType,
        updatedMasterBundle,
        existingDbLeads
      );
      setValidatedRows(revalidated);
    }
  };

  // Re-run validation when Column Mapping is updated
  const handleUpdateMappingAndPreview = (updatedMapping) => {
    setColumnMapping(updatedMapping);
    const validated = validateAllRows(
      rawFileRows,
      updatedMapping,
      leadType,
      currentMasterBundle,
      existingDbLeads
    );
    setValidatedRows(validated);
    setCurrentStep(STEP_PREVIEW);
    toast.success('Column mapping updated and records re-validated!');
  };

  // Re-validate single edited row from preview edit modal
  const handleSaveEditedRow = (updatedRow) => {
    const filePhoneFirstSeen = {};
    validatedRows.forEach((r, idx) => {
      const num = cleanPhoneNumber(r.customerNumber);
      if (num.length === 10 && filePhoneFirstSeen[num] === undefined) {
        filePhoneFirstSeen[num] = idx + 1;
      }
    });

    const existingLeadsPhoneMap = {};
    (existingDbLeads || []).forEach(l => {
      const num = cleanPhoneNumber(l.customerNumber || l.number);
      if (num && num.length === 10) existingLeadsPhoneMap[num] = l;
    });

    const revalidated = validateSingleRow({
      row: updatedRow,
      rowIndex: updatedRow.rowIndex - 1,
      leadType,
      masterData: currentMasterBundle,
      filePhoneFirstSeen,
      existingLeadsPhoneMap
    });

    setValidatedRows(prev =>
      prev.map(r => (r.rowIndex === updatedRow.rowIndex ? revalidated : r))
    );

    if (revalidated.status === 'VALID') {
      toast.success(`Row #${updatedRow.rowIndex} updated and marked VALID!`);
    } else {
      toast.success(`Row #${updatedRow.rowIndex} updated`);
    }
  };

  // Delete/Skip single row from preview
  const handleDeleteRow = (rowIndex) => {
    setValidatedRows(prev => prev.filter(r => r.rowIndex !== rowIndex));
    toast.success(`Row #${rowIndex} removed from import batch`);
  };

  // FINAL SUBMIT BUTTON on Preview Screen
  const handleFinalSubmit = async () => {
    setHasAttemptedSubmit(true);

    if (!leadSource || (isOtherValue(leadSource) && !customLeadSource?.trim())) {
      toast.error('Please select Lead Source above before saving');
      return;
    }

    if (assignCaller && !callerAssigned) {
      toast.error('Please select a caller to assign these leads to');
      return;
    }

    const readyToImport = validatedRows.filter(r => r.status !== 'ERROR');
    if (readyToImport.length === 0) {
      toast.error('No valid records to save. Please fix the highlighted error inputs before saving.');
      return;
    }

    setImportingLoading(true);

    try {
      let finalLeadSource = leadSource;
      if (isOtherValue(leadSource) && customLeadSource?.trim()) {
        finalLeadSource = customLeadSource.trim();
        const exists = (leadSourcesMaster || []).some(
          s => s.leadSource?.toLowerCase().trim() === finalLeadSource.toLowerCase()
        );
        if (!exists) {
          try {
            await masterApi.saveLeadSource({ leadSource: finalLeadSource });
          } catch (err) {
            console.error('Failed to save custom lead source to master:', err);
          }
        }
      }

      const isInsurance = leadType.toLowerCase().includes('insurance');
      const latestDbLeads = await leadApi.getAllLeads();
      let runningLeads = [...latestDbLeads];
      const leadsToInsert = [];

      readyToImport.forEach(row => {
        const leadNo = generateLeadNo(leadType, runningLeads);
        const leadObj = {
          leadNo,
          timestamp: row.timestamp,
          leadType,
          leadReceiver,
          leadSource: finalLeadSource,
          referencerName: row.referencerName || '',
          personName: row.customerName,
          customerName: row.customerName,
          number: row.customerNumber,
          customerNumber: row.customerNumber,
          email: row.customerEmail || '',
          customerEmail: row.customerEmail || '',
          dob: row.dob || '',
          occupation: row.occupation || '',
          customerAddress: row.customerAddress || '',
          location: row.customerAddress || '',
          investmentBudget: row.investmentBudget || '',
          whenToBuyPlan: row.whenToBuyPlan || '',
          callerAssigned: assignCaller ? callerAssigned : '',
          remarks: row.remarks || '',
          processType: 'Lead'
        };

        if (isInsurance) {
          leadObj.insuranceType = row.productType || 'Insurance';
          leadObj.insuranceSubType = row.insuranceSubType || '';
          leadObj.anyDesease = row.anyDesease || '';
        } else {
          leadObj.productType = row.productType || '';
          leadObj.requirement = row.requirement || '';
        }

        leadsToInsert.push(leadObj);
        runningLeads.push(leadObj);
      });

      // Save via bulk lead API
      await leadApi.bulkSaveLeads(leadsToInsert);

      toast.success(assignCaller
        ? `🎉 Saved ${leadsToInsert.length} lead${leadsToInsert.length === 1 ? '' : 's'} into ${leadType}, assigned to ${callerAssigned}!`
        : `🎉 Successfully saved ${leadsToInsert.length} lead${leadsToInsert.length === 1 ? '' : 's'} into ${leadType}!`);
      onImported?.();
      handleClose();
    } catch (err) {
      console.error('Final bulk import error:', err);
      toast.error('Failed to save leads. Please check database connection and try again.');
    } finally {
      setImportingLoading(false);
    }
  };

  // Determine modal title and size based on step
  const modalConfig = useMemo(() => {
    switch (currentStep) {
      case STEP_MAPPING:
        return {
          title: 'Bulk Lead Import — Column Mapping',
          maxWidth: 'max-w-3xl'
        };
      case STEP_PREVIEW:
        return {
          title: 'Bulk Lead Import — Preview & Validate',
          maxWidth: 'max-w-6xl'
        };
      case STEP_UPLOAD:
      default:
        return {
          title: 'Bulk Upload Leads',
          maxWidth: 'max-w-xl'
        };
    }
  }, [currentStep]);

  return (
    <>
      <ModalForm
        isOpen={isOpen}
        onClose={handleClose}
        title={modalConfig.title}
        onSubmit={() => {}}
        loading={parsingLoading || importingLoading}
        maxWidth={modalConfig.maxWidth}
        showButtons={false}
      >
        {/* Step 1: Upload Dropzone & Initial Setup */}
        {currentStep === STEP_UPLOAD && (
          <div className="space-y-3.5">
            <p className="text-[11px] md:text-[12px] text-gray-500 leading-relaxed">
              Select or drop an Excel/CSV file below. Your leads will be <strong>automatically parsed and previewed immediately</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
              {/* Lead Type */}
              <div className="space-y-1">
                <label className="block text-[10.5px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">
                  Lead Type
                </label>
                <SearchableDropdown
                  options={leadTypeOptions}
                  value={leadType}
                  onChange={(val) => { setLeadType(val); setLeadReceiver(''); }}
                  placeholder="Select lead type"
                />
              </div>

              {/* Team Member / Lead Receiver */}
              <div className="space-y-1">
                <label className="block text-[10.5px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">
                  Team Member Name
                </label>
                <SearchableDropdown
                  options={receiverOptions}
                  value={leadReceiver}
                  onChange={setLeadReceiver}
                  placeholder="Select team member (optional)"
                />
              </div>

              {/* Assign Caller (Lead & Followup only) */}
              {assignCaller && (
                <div className="space-y-1 col-span-1 sm:col-span-2">
                  <label className="block text-[10.5px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">
                    Assign Caller <span className="text-rose-500">*</span>
                  </label>
                  <SearchableDropdown
                    options={callerOptions || []}
                    value={callerAssigned}
                    onChange={setCallerAssigned}
                    placeholder="Select caller"
                  />
                </div>
              )}

              {/* Lead Source */}
              <div className="space-y-1 col-span-1 sm:col-span-2">
                <label className="block text-[10.5px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">
                  Lead Source <span className="text-gray-400 font-normal">(can also be chosen in preview)</span>
                </label>
                <SearchableDropdown
                  options={leadSourceOptions}
                  value={leadSource}
                  onChange={(val) => {
                    setLeadSource(val);
                    if (!isOtherValue(val)) setCustomLeadSource('');
                  }}
                  onAdd={(term) => {
                    setLeadSource('Add New');
                    if (term) setCustomLeadSource(term);
                  }}
                  placeholder="Select lead source"
                />
                {isOtherValue(leadSource) && (
                  <div className="relative mt-1.5 animate-in fade-in duration-200">
                    <Share2 className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      autoFocus
                      value={customLeadSource}
                      onChange={(e) => setCustomLeadSource(e.target.value)}
                      placeholder="Enter new lead source"
                      className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[32px]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Template Download Button */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="w-full flex items-center justify-center gap-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg py-2 text-[11px] md:text-[12px] font-bold uppercase tracking-wide hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <Download size={14} /> Download Excel Template
            </button>

            {/* Instant Upload Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto text-indigo-600 shadow-sm border border-indigo-100 group-hover:scale-110 transition-transform">
                <FileUp size={22} />
              </div>
              <h4 className="font-bold text-sm text-gray-900 mt-2.5">
                {parsingLoading ? 'Reading & Parsing File...' : 'Click to Upload or Drag & Drop Excel / CSV'}
              </h4>
              <p className="text-[11px] text-gray-500 mt-1">
                Supports .xlsx, .xls, and .csv files. Automatically opens the designed preview!
              </p>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping (Accessible on demand) */}
        {currentStep === STEP_MAPPING && (
          <BulkColumnMapping
            mapping={columnMapping}
            onChangeMapping={setColumnMapping}
            onBack={() => setCurrentStep(STEP_PREVIEW)}
            onContinue={() => handleUpdateMappingAndPreview(columnMapping)}
            totalRowCount={rawFileRows.length}
          />
        )}

        {/* Step 3: Designed Preview & Validation Table with Final Submit */}
        {currentStep === STEP_PREVIEW && (
          <BulkLeadPreview
            validatedRows={validatedRows}
            fileName={file?.name || ''}
            leadType={leadType}
            onLeadTypeChange={handleLeadTypeChange}
            leadTypeOptions={leadTypeOptions}
            leadReceiver={leadReceiver}
            onLeadReceiverChange={setLeadReceiver}
            receiverOptions={receiverOptions}
            leadSource={leadSource}
            onLeadSourceChange={setLeadSource}
            leadSourceOptions={leadSourceOptions}
            customLeadSource={customLeadSource}
            onCustomLeadSourceChange={setCustomLeadSource}
            callerAssigned={callerAssigned}
            onCallerAssignedChange={setCallerAssigned}
            callerOptions={callerOptions}
            hasAttemptedSubmit={hasAttemptedSubmit}
            onEditRow={(row) => setEditingRow(row)}
            onDeleteRow={handleDeleteRow}
            onOpenColumnMapping={() => setCurrentStep(STEP_MAPPING)}
            onBackToUpload={() => setCurrentStep(STEP_UPLOAD)}
            onCancel={handleClose}
            onSubmit={handleFinalSubmit}
            isSubmitting={importingLoading}
          />
        )}
      </ModalForm>

      {/* Row Edit Modal */}
      {editingRow && (
        <BulkLeadEditModal
          isOpen={Boolean(editingRow)}
          onClose={() => setEditingRow(null)}
          row={editingRow}
          leadType={leadType}
          masterData={currentMasterBundle}
          onSave={handleSaveEditedRow}
        />
      )}
    </>
  );
}
