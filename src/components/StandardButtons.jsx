import React from 'react';
import { XCircle, Save, Check } from 'lucide-react';

/**
 * TabSwitcher Component - Standardized Tabs for Pending/History
 */
export const TabSwitcher = ({ activeTab, onTabChange, tabs }) => {
  return (
    <div className="flex gap-2 w-full lg:w-auto flex-shrink-0 border-b lg:border-none border-gray-100 pb-2 lg:pb-0 mb-1 lg:mb-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-1.5 px-4 transition text-[11px] md:text-sm rounded-md whitespace-nowrap capitalize flex items-center justify-center gap-2 ${
            activeTab === tab.id 
              ? 'bg-indigo-50 text-indigo-700 font-bold' 
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {tab.icon && <tab.icon size={14} className={activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'} />}
          {tab.label} ({tab.count || 0})
        </button>
      ))}
    </div>
  );
};

/**
 * FormActionButtons Component - Standardized Save/Cancel Buttons
 */
export const FormActionButtons = ({ 
  onCancel, 
  onSubmit, 
  cancelText = 'Cancel', 
  submitText = 'Save Changes',
  loading = false,
  className = "",
  formId = null,
  extraButton = null
}) => {
  return (
    <div className={`flex gap-3 items-center ${className}`}>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 px-3 sm:px-4 py-2 border border-gray-200 rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-all active:scale-95 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
      >
        <XCircle size={15} />
        <span>{cancelText}</span>
      </button>

      {extraButton && (
        <div className="flex-1 flex w-full justify-center">
          {extraButton}
        </div>
      )}

      <button
        type={onSubmit ? "button" : "submit"}
        form={formId}
        onClick={onSubmit}
        disabled={loading}
        className="flex-[1.5] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-all active:scale-95 shadow-md text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Save size={15} />
            <span>{submitText}</span>
          </>
        )}
      </button>
    </div>
  );
};
