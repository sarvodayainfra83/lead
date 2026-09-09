import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Plus } from 'lucide-react';

/**
 * SearchableDropdown Component
 * A custom select component with built-in search functionality.
 * 
 * @param {Array} options - Array of { value, label } objects.
 * @param {any} value - Currently selected value.
 * @param {Function} onChange - Callback function when an option is selected.
 * @param {string} placeholder - Text to show when no value is selected.
 * @param {string} className - Additional CSS classes for the container.
 */
const SearchableDropdown = ({ options, value, onChange, onAdd, placeholder = "Select option...", className = "", height = "h-[30px] md:h-[34px]" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, bottom: 'auto', left: 0, width: 0 });
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find the label for the current value
  const selectedOption = options.find(opt => opt.value === value);

  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 240; // Estimated max height
      const screenWidth = window.innerWidth;
      
      let width = rect.width;
      let left = rect.left;

      // Ensure dropdown isn't too narrow or overflowing on mobile screens
      if (width < 220 && screenWidth < 640) {
        width = Math.min(screenWidth - 16, Math.max(width, 220));
      }
      if (left + width > screenWidth - 8) {
        left = Math.max(8, screenWidth - width - 8);
      }
      if (left < 8) {
        left = 8;
        width = Math.min(width, screenWidth - 16);
      }

      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        setOpenUp(true);
        setDropdownPos({
          bottom: window.innerHeight - rect.top + 4,
          top: 'auto',
          left,
          width
        });
      } else {
        setOpenUp(false);
        setDropdownPos({
          top: rect.bottom + 4,
          bottom: 'auto',
          left,
          width
        });
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition, true);
      document.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition, true);
        document.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  // Close dropdown when clicking/touching outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !event.target.closest('.searchable-dropdown-menu')
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, []);

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  const menu = isOpen ? createPortal(
    <div
      className="searchable-dropdown-menu fixed bg-white border border-gray-200 rounded shadow-2xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[180px]"
      style={{
        top: dropdownPos.top,
        bottom: dropdownPos.bottom,
        left: dropdownPos.left,
        width: dropdownPos.width
      }}
    >
      {/* Search Box */}
      <div className="p-1.5 border-b border-gray-100 bg-gray-50 flex gap-1.5 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-[7px] text-gray-400" size={10} />
          <input
            autoFocus
            type="text"
            placeholder="Filter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white border border-gray-200 rounded pl-7 pr-2 py-1 text-[12px] md:text-[13px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 shadow-inner"
          />
        </div>
      </div>

      {/* Options List */}
      <div className="max-h-52 overflow-y-auto py-1 scrollbar-hide">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt, idx) => (
            <div
              key={`${opt.value ?? ''}-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
                setSearchTerm("");
              }}
              className={`px-3 py-2 sm:py-1.5 text-[12px] md:text-[13px] cursor-pointer flex justify-between items-center hover:bg-indigo-50 transition-colors group ${value === opt.value
                ? 'bg-indigo-50/50 text-indigo-700 font-semibold'
                : 'text-gray-700'
                }`}
            >
              <span className="truncate">{opt.label}</span>
              {value === opt.value && (
                <Check size={14} className="text-indigo-600 flex-shrink-0 ml-2" />
              )}
            </div>
          ))
        ) : (
          <div className="px-3 py-4 text-[11px] text-center text-gray-400 italic font-medium uppercase tracking-tight">
            No matching results found
          </div>
        )}
      </div>

      {/* Always visible Add New at the bottom - Satisfies "every add button show in down" */}
      {onAdd && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
            setIsOpen(false);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
            setIsOpen(false);
          }}
          className="w-full border-t border-gray-100 px-3 py-2 text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 bg-white active:bg-indigo-100"
        >
          <Plus size={14} strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-widest">Add New</span>
        </button>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selection Trigger - Using a real button for iPhone compatibility */}
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full bg-white border border-gray-300 rounded px-2 py-1 flex justify-between items-center cursor-pointer hover:border-indigo-500 transition-all ${height} shadow-sm group outline-none focus:ring-1 focus:ring-indigo-500/30 active:scale-[0.98]`}
      >
        <span className={`text-[11px] md:text-[13px] truncate ${selectedOption || value ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.label : (value || placeholder)}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-200 group-hover:text-indigo-500 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {menu}
    </div>
  );
};

export default SearchableDropdown;

