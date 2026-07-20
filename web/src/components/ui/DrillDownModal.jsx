import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Generic DrillDownModal — slides up from bottom on mobile, centered panel on desktop.
 * Props:
 *   open (bool)
 *   onClose (fn)
 *   title (string)
 *   subtitle (string)
 *   children (ReactNode)
 *   wide (bool) — wider panel (max-w-4xl)
 */
const DrillDownModal = ({ open, onClose, title, subtitle, children, wide = false }) => {
  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(28,37,48,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full ${wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'} glass-panel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-line-border/30 flex flex-col`}
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-line-border/30 flex-shrink-0">
          <div>
            <h3 className="text-xl font-display font-bold text-ink leading-tight">{title}</h3>
            {subtitle && <p className="text-xs font-sans text-ink/55 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 w-8 h-8 rounded-lg hover:bg-ink/8 flex items-center justify-center text-ink/50 hover:text-ink transition-colors flex-shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Content — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
