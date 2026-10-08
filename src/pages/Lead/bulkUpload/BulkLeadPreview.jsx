import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, Search, Filter, Edit3, Trash2,
  Phone, Mail, MapPin, ArrowLeft, DownloadCloud, RotateCcw, ChevronLeft, ChevronRight,
  ShieldAlert, User, Briefcase, Check, AlertCircle, FileSpreadsheet, Share2, Layers, SlidersHorizontal
} from 'lucide-react';
import SearchableDropdown from '../../../components/SearchableDropdown';

export default function BulkLeadPreview({
  validatedRows = [],
  fileName = '',
  // Global settings editable directly on preview
  leadType,
  onLeadTypeChange,
  leadTypeOptions = [],
  leadReceiver,
  onLeadReceiverChange,
  receiverOptions = [],
  leadSource,
  onLeadSourceChange,
  leadSourceOptions = [],
  customLeadSource,
  onCustomLeadSourceChange,
  // Caller assignment (Lead & Followup bulk upload only — hidden when callerOptions is not passed)
  callerAssigned,
  onCallerAssignedChange,
  callerOptions,
  hasAttemptedSubmit = false,
  // Actions
  onEditRow,
  onDeleteRow,
  onOpenColumnMapping,
  onBackToUpload,
  onCancel,
  onSubmit,
  isSubmitting = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VALID' | 'WARNING' | 'ERROR'
  const [issueFilter, setIssueFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Statistics
  const stats = useMemo(() => {
    let valid = 0;
    let warnings = 0;
    let errors = 0;
    validatedRows.forEach(r => {
      if (r.status === 'VALID') valid++;
      else if (r.status === 'WARNING') warnings++;
      else if (r.status === 'ERROR') errors++;
    });
    return {
      total: validatedRows.length,
      valid,
      warnings,
      errors,
      importable: valid + warnings
    };
  }, [validatedRows]);

  // Unique issues list for secondary filter dropdown
  const uniqueIssues = useMemo(() => {
    const issuesSet = new Set();
    validatedRows.forEach(r => {
      r.errors?.forEach(e => issuesSet.add(e));
      r.warnings?.forEach(w => issuesSet.add(w));
    });
    return Array.from(issuesSet);
  }, [validatedRows]);

  // Filtered rows calculation
  const filteredRows = useMemo(() => {
    let list = validatedRows;

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter(r => r.status === statusFilter);
    }

    // Issue specific filter
    if (issueFilter !== 'ALL') {
      list = list.filter(r =>
        r.errors?.includes(issueFilter) || r.warnings?.includes(issueFilter)
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.customerName && r.customerName.toLowerCase().includes(q)) ||
        (r.customerNumber && r.customerNumber.includes(q)) ||
        (r.customerEmail && r.customerEmail.toLowerCase().includes(q)) ||
        (r.customerAddress && r.customerAddress.toLowerCase().includes(q)) ||
        (r.productType && r.productType.toLowerCase().includes(q)) ||
        (r.requirement && r.requirement.toLowerCase().includes(q))
      );
    }

    return list;
  }, [validatedRows, statusFilter, issueFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage, itemsPerPage]);

  const isOtherValue = (val) => {
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    return lower === 'other' || lower === 'others' || lower === 'add new' || lower === 'add_new' || lower === '+ add new';
  };

  const isLeadSourceMissing = !leadSource || (isOtherValue(leadSource) && !customLeadSource?.trim());
  const showLeadSourceError = hasAttemptedSubmit && isLeadSourceMissing;
  const showCallerField = Array.isArray(callerOptions);
  const showCallerError = showCallerField && hasAttemptedSubmit && !callerAssigned;

  return (
    <div className="space-y-3">
      {/* Top Global Setup Toolbar (Lead Type, Receiver, Source) */}
      <div className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-indigo-100 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* File Name & Overview */}
          <div className="shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <FileSpreadsheet size={15} className="text-indigo-600" />
                <span>{fileName || 'Uploaded Leads File'}</span>
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-600 text-white shadow-2xs">
                {stats.total} Records
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Review and adjust batch settings below before saving.
            </p>
          </div>

          {/* Global Batch Controls */}
          <div className={`grid grid-cols-1 gap-2 flex-1 ${showCallerField ? 'sm:grid-cols-2 lg:grid-cols-4 max-w-4xl' : 'sm:grid-cols-3 max-w-2xl'}`}>
            {/* Lead Type */}
            <div className="space-y-0.5">
              <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-tight">
                Lead Type <span className="text-rose-500">*</span>
              </label>
              <SearchableDropdown
                options={leadTypeOptions}
                value={leadType}
                onChange={(val) => onLeadTypeChange?.(val)}
                placeholder="Select lead type"
                height="h-[32px]"
              />
            </div>

            {/* Team Member / Receiver */}
            <div className="space-y-0.5">
              <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-tight">
                Team Member Name
              </label>
              <SearchableDropdown
                options={receiverOptions}
                value={leadReceiver}
                onChange={(val) => onLeadReceiverChange?.(val)}
                placeholder="Select team member"
                height="h-[32px]"
              />
            </div>

            {/* Lead Source */}
            <div className="space-y-0.5">
              <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-tight flex items-center justify-between">
                <span>Lead Source <span className="text-rose-500">*</span></span>
                {showLeadSourceError && (
                  <span className="text-[10px] text-rose-600 font-bold animate-pulse">Required</span>
                )}
              </label>
              <div className={showLeadSourceError ? 'ring-2 ring-rose-500 rounded-lg' : ''}>
                <SearchableDropdown
                  options={leadSourceOptions}
                  value={leadSource}
                  onChange={(val) => {
                    onLeadSourceChange?.(val);
                    if (!isOtherValue(val)) onCustomLeadSourceChange?.('');
                  }}
                  onAdd={(term) => {
                    onLeadSourceChange?.('Add New');
                    if (term) onCustomLeadSourceChange?.(term);
                  }}
                  placeholder="Select lead source"
                  height="h-[32px]"
                  triggerClassName={showLeadSourceError ? '!border-rose-400 bg-rose-50/50 text-rose-900' : ''}
                />
              </div>
            </div>

            {/* Assign Caller */}
            {showCallerField && (
              <div className="space-y-0.5">
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-tight flex items-center justify-between">
                  <span>Assign Caller <span className="text-rose-500">*</span></span>
                  {showCallerError && (
                    <span className="text-[10px] text-rose-600 font-bold animate-pulse">Required</span>
                  )}
                </label>
                <div className={showCallerError ? 'ring-2 ring-rose-500 rounded-lg' : ''}>
                  <SearchableDropdown
                    options={callerOptions}
                    value={callerAssigned}
                    onChange={(val) => onCallerAssignedChange?.(val)}
                    placeholder="Select caller"
                    height="h-[32px]"
                    triggerClassName={showCallerError ? '!border-rose-400 bg-rose-50/50 text-rose-900' : ''}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Source Input if 'Add New' or 'Other' */}
        {isOtherValue(leadSource) && (
          <div className="mt-2.5 pt-2 border-t border-indigo-100/80 flex items-center gap-2 animate-in fade-in">
            <Share2 size={13} className="text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-gray-700 shrink-0">Custom Source:</span>
            <input
              type="text"
              autoFocus
              value={customLeadSource}
              onChange={(e) => onCustomLeadSourceChange?.(e.target.value)}
              placeholder="Enter new custom lead source name..."
              className={`flex-1 border rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[30px] ${
                showLeadSourceError && !customLeadSource?.trim()
                  ? 'border-rose-400 bg-rose-50/50 ring-1 ring-rose-400 text-rose-900'
                  : 'border-gray-300 bg-white text-gray-800'
              }`}
            />
          </div>
        )}
      </div>

      {/* Stats Counter Filter Badges & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Stat Badges */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {/* Total Badge */}
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-950 shadow-2xs'
                : 'bg-white text-slate-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>All Leads:</span>
            <span className="font-extrabold">{stats.total}</span>
          </button>

          {/* Valid Badge */}
          <button
            type="button"
            onClick={() => { setStatusFilter('VALID'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              statusFilter === 'VALID'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Valid:</span>
            <span className="font-extrabold">{stats.valid}</span>
          </button>

          {/* Warnings Badge */}
          <button
            type="button"
            onClick={() => { setStatusFilter('WARNING'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              statusFilter === 'WARNING'
                ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Warnings:</span>
            <span className="font-extrabold">{stats.warnings}</span>
          </button>

          {/* Errors Badge */}
          <button
            type="button"
            onClick={() => { setStatusFilter('ERROR'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              statusFilter === 'ERROR'
                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <XCircle size={13} />
            <span>Errors:</span>
            <span className="font-extrabold">{stats.errors}</span>
          </button>
        </div>

        {/* Search & Mapping Adjust */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search leads in preview..."
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs h-[32px]"
            />
          </div>

          <button
            type="button"
            onClick={onOpenColumnMapping}
            title="Adjust column mapping"
            className="text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition whitespace-nowrap active:scale-95 flex items-center gap-1.5 h-[32px] cursor-pointer"
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Columns</span>
          </button>
        </div>
      </div>

      {/* Main Designed Preview Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs max-h-[46vh] overflow-y-auto bg-white">
        {paginatedRows.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 space-y-2">
            <Filter size={24} className="mx-auto text-gray-300" />
            <p className="font-semibold text-gray-700">No records match your filter</p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setIssueFilter('ALL'); }}
              className="text-indigo-600 hover:underline font-bold text-[11px]"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] font-bold sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="px-2.5 py-2 text-center w-10">#</th>
                <th className="px-2.5 py-2 text-center w-20">Status</th>
                <th className="px-3 py-2 w-44">Customer Name</th>
                <th className="px-3 py-2 w-32">Phone</th>
                <th className="px-3 py-2 w-40">Email / Address</th>
                <th className="px-3 py-2 w-44">Product & Requirement</th>
                <th className="px-3 py-2">Validation Notes</th>
                <th className="px-2.5 py-2 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {paginatedRows.map((row) => {
                const isError = row.status === 'ERROR';
                const isWarning = row.status === 'WARNING';
                const hasNameError = !row.customerName?.trim();
                const hasPhoneError = !row.customerNumber || row.customerNumber.length !== 10;

                return (
                  <tr
                    key={row.rowIndex}
                    className={`transition-colors ${
                      isError
                        ? 'bg-rose-50/30 hover:bg-rose-50/60'
                        : isWarning
                        ? 'bg-amber-50/20 hover:bg-amber-50/50'
                        : 'hover:bg-indigo-50/20'
                    }`}
                  >
                    {/* Row Index */}
                    <td className="px-2.5 py-2 text-center font-mono text-[11px] text-gray-500">
                      {row.rowIndex}
                    </td>

                    {/* Status Badge */}
                    <td className="px-2.5 py-2 text-center whitespace-nowrap">
                      {row.status === 'VALID' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 size={10} className="text-emerald-600" />
                          Valid
                        </span>
                      )}
                      {row.status === 'WARNING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                          <AlertTriangle size={10} className="text-amber-600" />
                          Warning
                        </span>
                      )}
                      {row.status === 'ERROR' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                          <XCircle size={10} className="text-rose-600" />
                          Error
                        </span>
                      )}
                    </td>

                    {/* Customer Name */}
                    <td className="px-3 py-2 font-bold text-gray-900 truncate max-w-[170px]" title={row.customerName}>
                      {hasNameError ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                          <AlertCircle size={10} className="text-rose-600" />
                          Missing Name *
                        </span>
                      ) : (
                        <span>{row.customerName}</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">
                      {hasPhoneError ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                          <AlertCircle size={10} className="text-rose-600" />
                          {row.rawNumber ? `Invalid (${row.rawNumber})` : 'Missing Phone *'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                          <Phone size={10} className="text-gray-400" />
                          {row.customerNumber}
                        </span>
                      )}
                    </td>

                    {/* Email / Address */}
                    <td className="px-3 py-2 max-w-[160px] truncate" title={`${row.customerEmail || ''} ${row.customerAddress || ''}`}>
                      {row.customerEmail && (
                        <div className="text-[11px] text-gray-600 truncate flex items-center gap-1">
                          <Mail size={10} className="text-gray-400 shrink-0" />
                          <span className="truncate">{row.customerEmail}</span>
                        </div>
                      )}
                      {row.customerAddress && (
                        <div className="text-[10px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <MapPin size={9} className="text-gray-400 shrink-0" />
                          <span className="truncate">{row.customerAddress}</span>
                        </div>
                      )}
                      {!row.customerEmail && !row.customerAddress && (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Product & Requirement */}
                    <td className="px-3 py-2 max-w-[170px]">
                      {row.productType && (
                        <span className="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 truncate max-w-[160px]" title={row.productType}>
                          {row.productType}
                        </span>
                      )}
                      {row.requirement && (
                        <span className="inline-block text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.2 rounded ml-1 truncate max-w-[120px]" title={row.requirement}>
                          {row.requirement}
                        </span>
                      )}
                      {!row.productType && !row.requirement && (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>

                    {/* Validation Notes / Issues */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.errors?.map((err, eIdx) => (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300"
                            title={err}
                          >
                            <AlertCircle size={9} className="shrink-0 text-rose-600" />
                            <span className="truncate max-w-[200px]">{err}</span>
                          </span>
                        ))}
                        {row.warnings?.map((warn, wIdx) => (
                          <span
                            key={wIdx}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300"
                            title={warn}
                          >
                            <AlertTriangle size={9} className="shrink-0 text-amber-600" />
                            <span className="truncate max-w-[200px]">{warn}</span>
                          </span>
                        ))}
                        {row.status === 'VALID' && (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <Check size={11} className="stroke-[2.5]" /> Ready
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions: Edit & Remove */}
                    <td className="px-2.5 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditRow(row)}
                          title="Edit lead details to fix or update"
                          className="w-6 h-6 rounded flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-200 transition active:scale-95 cursor-pointer"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRow(row.rowIndex)}
                          title="Remove this row from import"
                          className="w-6 h-6 rounded flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200 transition active:scale-95 cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 pt-0.5">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong>{filteredRows.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredRows.length)}</strong> of <strong>{filteredRows.length}</strong> records
          </span>
          <div className="flex items-center gap-1 ml-2">
            <span>Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white text-gray-700 font-semibold focus:ring-1 focus:ring-indigo-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 font-semibold text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Import Summary & Final Action Footer with SUBMIT Button */}
      <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
        <div>
          <div className="text-xs font-bold text-gray-900">
            Ready to Save: <span className="text-emerald-700 font-extrabold">{stats.importable} of {stats.total} leads</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {stats.errors > 0 ? (
              <span className="text-rose-600 font-semibold">
                &bull; {stats.errors} record{stats.errors > 1 ? 's have' : ' has'} errors and will be skipped unless fixed.
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">
                &bull; All rows are ready to be saved into the database.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onBackToUpload}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition cursor-pointer"
          >
            Upload Different File
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>

          {/* Primary Submit Button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || stats.importable === 0}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white transition shadow-sm active:scale-95 cursor-pointer ${
              isSubmitting || stats.importable === 0
                ? 'bg-emerald-300 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <DownloadCloud size={15} />
            <span>
              {isSubmitting
                ? 'Saving Leads...'
                : `SUBMIT & SAVE ${stats.importable} LEADS`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
