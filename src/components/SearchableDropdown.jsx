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
const SearchableDropdown = ({
  options,
  value,
  onChange,
  onAdd,
  onMainClick,
  placeholder = "Select option...",
  className = "",
  triggerClassName = "",
  height = "h-[30px] md:h-[34px]",
  searchable = true,
  icon: Icon = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, bottom: 'auto', left: 0, width: 0 });
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = searchable && searchTerm
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

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
      {searchable && (
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
      )}

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

      {/* Always visible Add New at the bottom */}
      {onAdd && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd(searchTerm);
            setIsOpen(false);
            setSearchTerm("");
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd(searchTerm);
            setIsOpen(false);
            setSearchTerm("");
          }}
          className="w-full border-t border-gray-100 px-3 py-2 text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-1.5 bg-white active:bg-indigo-100 cursor-pointer select-none"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span className="text-[11px] md:text-[12px] font-bold uppercase tracking-wider">
            {searchTerm ? `Add "${searchTerm}"` : 'Add New'}
          </span>
        </button>
      )}
    </div>,
    document.body
  ) : null;

  const displayLabel = selectedOption
    ? selectedOption.label
    : (value === 'Other' || value === 'Others' ? 'Add New' : (value || placeholder));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selection Trigger */}
      {onMainClick ? (
        <div
          className={`w-full rounded-lg flex items-stretch overflow-hidden select-none border transition-all ${height} shadow-xs group ${
            triggerClassName
              ? triggerClassName
              : 'bg-white border-gray-300 hover:border-indigo-500'
          }`}
        >
          {/* Main Button Click: Triggers onMainClick (e.g. All Dates) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
              onMainClick(e);
            }}
            title={displayLabel}
            className="flex-1 flex items-center gap-1.5 min-w-0 h-full px-2.5 py-1 text-left cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all outline-none"
          >
            {Icon && (
              <Icon
                size={13}
                className={`${triggerClassName ? 'text-white' : 'text-gray-400 group-hover:text-indigo-500'} shrink-0`}
              />
            )}
            <span
              className={`text-[11px] md:text-[13px] truncate ${
                triggerClassName
                  ? 'text-white font-bold'
                  : (selectedOption || value ? 'text-gray-900 font-semibold' : 'text-gray-400')
              }`}
            >
              {displayLabel}
            </span>
          </button>

          {/* Dropdown Toggle Icon Button: Opens the options menu */}
          <button
            type="button"
            onClick={handleToggle}
            title="Open dropdown options"
            className={`h-full px-2 flex items-center justify-center cursor-pointer transition-colors outline-none shrink-0 ${
              triggerClassName
                ? 'border-l border-white/25 text-white hover:bg-white/15 active:bg-white/25'
                : 'border-l border-gray-200 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          className={
            triggerClassName
              ? `${triggerClassName} ${height}`
              : `w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 flex justify-between items-center cursor-pointer hover:border-indigo-500 transition-all ${height} shadow-xs group outline-none focus:ring-1 focus:ring-indigo-500/30 active:scale-[0.98]`
          }
        >
          <span className="flex items-center gap-1.5 min-w-0">
            {Icon && (
              <Icon
                size={13}
                className={`${triggerClassName ? 'text-white' : 'text-gray-400 group-hover:text-indigo-500'} shrink-0`}
              />
            )}
            <span
              className={`text-[11px] md:text-[13px] truncate ${
                triggerClassName
                  ? 'text-white font-bold'
                  : (selectedOption || value ? 'text-gray-900' : 'text-gray-400')
              }`}
            >
              {displayLabel}
            </span>
          </span>
          <ChevronDown
            size={14}
            className={`${
              triggerClassName ? 'text-white' : 'text-gray-400 group-hover:text-indigo-500'
            } transition-transform duration-200 shrink-0 ml-1.5 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {menu}
    </div>
  );
};

export default SearchableDropdown;

