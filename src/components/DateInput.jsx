import React, { useState } from 'react';

/**
 * DateInput
 * A native date picker that still shows a DD-MM-YYYY hint while empty — mobile browsers (Android Chrome)
 * render an empty <input type="date"> as a blank box. The hint hides while the field is focused, so it
 * never overlaps the browser's own dd-mm-yyyy text on desktop.
 */
export default function DateInput({ value, onChange, className = '', placeholder = 'DD-MM-YYYY', onFocus, onBlur, ...rest }) {
  const [focused, setFocused] = useState(false);
  const showHint = !value && !focused;

  return (
    <div className="relative w-full">
      <input
        type="date"
        value={value || ''}
        onChange={onChange}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        className={`${className} appearance-none min-w-0 ${showHint ? 'text-transparent' : ''}`}
        {...rest}
      />
      {showHint && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[11px] md:text-[13px]">
          {placeholder}
        </span>
      )}
    </div>
  );
}
