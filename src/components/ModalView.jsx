import React from 'react';

const ModalView = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
  zIndex = 'z-[100]'
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center ${zIndex} p-3.5 sm:p-5 md:p-6 animate-in fade-in duration-200 overflow-hidden`}>
      <div
        className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[88dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100/80 ring-1 ring-black/5`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="px-4 py-2.5 sm:py-3 border-b border-gray-100 flex items-center justify-center flex-shrink-0">
          <h2 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-widest text-center truncate">{title}</h2>
        </div>

        {/* Scrollable Body - Hidden scrollbar */}
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-3 no-scrollbar"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}} />
          {children}
        </div>

        {/* Footer Action */}
        <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition font-bold uppercase tracking-wider active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalView;