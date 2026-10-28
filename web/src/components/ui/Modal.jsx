import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Modal — Accessible dialog with focus trap and Esc key dismissal.
 */
export default function Modal({
  isOpen,
  open,
  onClose,
  title = null,
  subtitle = null,
  children,
  footer = null,
  maxWidth = 'max-w-lg',
  className = ''
}) {
  const modalRef = useRef(null);
  const isModalOpen = Boolean(isOpen ?? open);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isModalOpen, onClose]);

  if (!isModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-surface text-ink border border-line rounded-2xl shadow-2xl flex flex-col my-auto max-h-[90vh] animate-slideUp overflow-hidden ${className}`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0 bg-surface">
          <div>
            {title && (
              <h3 id="modal-title" className="font-display font-bold text-lg text-ink tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-muted mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="btn-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-line bg-canvas/40 shrink-0 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
