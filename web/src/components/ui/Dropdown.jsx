import React, { useState, useRef, useEffect } from 'react';

/**
 * Dropdown — Accessible action or selection menu.
 */
export default function Dropdown({
  trigger,
  items = [], // [{ label, icon, onClick, danger, disabled }]
  align = 'right',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${alignClass} mt-2 w-48 rounded-xl bg-surface border border-line shadow-lg py-1.5 z-40 animate-fadeIn`}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={idx} className="my-1 border-t border-line" />;
            }
            const Icon = item.icon;
            return (
              <button
                key={idx}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  if (item.onClick) item.onClick();
                }}
                className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                  item.danger
                    ? 'text-danger hover:bg-red-50 dark:hover:bg-red-950/20'
                    : 'text-ink hover:bg-brand-50/70 hover:text-brand-700 dark:hover:bg-brand-950/30 dark:hover:text-brand-400'
                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
