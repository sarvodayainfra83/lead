import React from 'react';
import { FormActionButtons } from './StandardButtons';

/**
 * ModalForm Component - Ultra Compact Edition
 * 
 * Final Refinements:
 * - Removed Cross (X) icon as requested.
 * - Reduced vertical gaps (space-y-2) for maximum density.
 * - Compacted padding in Header and Body.
 * - Maintains fixed dimensions and invisible scrollbar.
 */
const ModalForm = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  maxWidth = 'max-w-2xl',
  zIndex = 'z-[100]',
  extraFooterAction = null,
  loading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center ${zIndex} p-2 sm:p-4 animate-in fade-in duration-200`}>
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200`}
      >
        {/* Compact Header */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 flex items-center justify-center bg-white flex-shrink-0 z-20">
          <h2 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-widest text-center truncate">{title}</h2>
        </div>

        {/* Scrollable Body */}
        <div
          className="flex-1 overflow-y-auto bg-white min-h-0 z-10"
          style={{
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Webkit scrollbar hiding */}
          <style dangerouslySetInnerHTML={{
            __html: `
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}} />

          <div className="p-3 sm:p-4 no-scrollbar">
            <form id="ultra-compact-form" onSubmit={onSubmit} className="space-y-2 md:space-y-3 text-left">
              {children}
            </form>
          </div>
        </div>

        {/* Standardized Footer Buttons */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-t border-gray-100 bg-white flex-shrink-0 z-20">
          <FormActionButtons
            onCancel={onClose}
            cancelText={cancelText}
            submitText={submitText}
            loading={loading}
            className="w-full"
            formId="ultra-compact-form"
          />
        </div>
      </div>
    </div>
  );
};

export default ModalForm;
