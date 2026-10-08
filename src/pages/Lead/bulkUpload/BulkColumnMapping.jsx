import React, { useMemo } from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, HelpCircle, ArrowLeft, Check } from 'lucide-react';
import { BULK_LEAD_FIELDS } from './bulkLeadFields';

export default function BulkColumnMapping({
  mapping = [],
  onChangeMapping,
  onBack,
  onContinue,
  totalRowCount = 0
}) {
  // Available fields formatted for dropdown
  const fieldOptions = useMemo(() => {
    return Object.values(BULK_LEAD_FIELDS).map(f => ({
      key: f.key,
      label: f.label,
      required: f.required
    }));
  }, []);

  // Set of mapped target field keys
  const mappedTargetKeys = useMemo(() => {
    return new Set(mapping.map(m => m.targetFieldKey).filter(Boolean));
  }, [mapping]);

  // Check if required fields are mapped
  const missingRequiredFields = useMemo(() => {
    const required = Object.values(BULK_LEAD_FIELDS).filter(f => f.required);
    return required.filter(f => !mappedTargetKeys.has(f.key));
  }, [mappedTargetKeys]);

  const handleFieldSelect = (sourceHeader, newTargetKey) => {
    const updated = mapping.map(item => {
      if (item.sourceHeader === sourceHeader) {
        return {
          ...item,
          targetFieldKey: newTargetKey || null,
          confidence: newTargetKey ? 'manual' : 'none'
        };
      }
      // If another column had this target, prevent conflict by clearing it
      if (newTargetKey && item.targetFieldKey === newTargetKey) {
        return {
          ...item,
          targetFieldKey: null,
          confidence: 'none'
        };
      }
      return item;
    });
    onChangeMapping(updated);
  };

  const isContinueDisabled = missingRequiredFields.length > 0;

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>Column Mapping</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {mapping.length} Columns Detected
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Match columns from your uploaded file to the corresponding application fields.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-semibold text-gray-600">
            Total Records: <strong className="text-gray-900">{totalRowCount}</strong>
          </span>
        </div>
      </div>

      {/* Missing Required Fields Alert */}
      {missingRequiredFields.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-800 text-xs animate-in fade-in">
          <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Required Fields Missing Mapping:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {missingRequiredFields.map(f => (
                <li key={f.key} className="font-semibold">
                  {f.label} <span className="text-rose-600 font-normal">(Required)</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-rose-700">
              Please map columns to the required fields above before proceeding to preview.
            </p>
          </div>
        </div>
      )}

      {/* Column Mapping Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs max-h-[50vh] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] font-bold sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 w-[35%]">File Header & Samples</th>
              <th className="px-2 py-2.5 text-center w-[6%]"></th>
              <th className="px-3 py-2.5 w-[39%]">Target Application Field</th>
              <th className="px-3 py-2.5 text-center w-[20%]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {mapping.map((item, idx) => {
              const matchedField = BULK_LEAD_FIELDS[item.targetFieldKey];
              const isRequired = matchedField?.required;

              return (
                <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                  {/* Source Column Header & Samples */}
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-bold text-gray-900 truncate max-w-[220px]" title={item.sourceHeader}>
                      {item.sourceHeader}
                    </div>
                    {item.sampleValues && item.sampleValues.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.sampleValues.slice(0, 2).map((val, sIdx) => (
                          <span
                            key={sIdx}
                            className="inline-block text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded max-w-[150px] truncate"
                            title={val}
                          >
                            {val}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Arrow Indicator */}
                  <td className="px-2 py-2.5 text-center align-middle text-gray-400">
                    <ArrowRight size={14} className="mx-auto" />
                  </td>

                  {/* Target Field Dropdown */}
                  <td className="px-3 py-2.5 align-middle">
                    <select
                      value={item.targetFieldKey || ''}
                      onChange={(e) => handleFieldSelect(item.sourceHeader, e.target.value)}
                      className={`w-full text-xs rounded-lg border py-1.5 px-2 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        item.targetFieldKey
                          ? 'border-indigo-300 bg-indigo-50/30 text-indigo-950 font-semibold'
                          : 'border-gray-300 bg-white text-gray-500'
                      }`}
                    >
                      <option value="">— Don't Import (Skip) —</option>
                      {fieldOptions.map(f => {
                        const isAlreadyMapped = mappedTargetKeys.has(f.key) && item.targetFieldKey !== f.key;
                        return (
                          <option key={f.key} value={f.key} disabled={isAlreadyMapped}>
                            {f.label} {f.required ? ' * (Required)' : ''} {isAlreadyMapped ? ' (Mapped)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </td>

                  {/* Mapping Status Badge */}
                  <td className="px-3 py-2.5 text-center align-middle whitespace-nowrap">
                    {item.targetFieldKey ? (
                      item.confidence === 'high' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Auto Mapped
                        </span>
                      ) : item.confidence === 'medium' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle size={11} className="text-amber-600" />
                          Suggested
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Check size={11} className="text-indigo-600" />
                          Mapped
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                        Skipped
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition active:scale-95"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={isContinueDisabled}
          className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white transition shadow-sm active:scale-95 ${
            isContinueDisabled
              ? 'bg-indigo-300 cursor-not-allowed opacity-60'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <span>Continue to Preview</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
