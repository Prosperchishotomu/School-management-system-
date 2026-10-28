import React from 'react';
import Modal from './Modal';
import { AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed? This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  loading = false
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary btn-md"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn btn-md shadow-md ${
              isDestructive
                ? 'btn-danger hover:shadow-rose-500/30'
                : 'btn-primary hover:shadow-brand-500/30'
            }`}
          >
            {loading ? (
              'Processing…'
            ) : (
              <span className="flex items-center gap-1.5">
                {isDestructive && <Trash2 className="w-4 h-4" />}
                <span>{confirmLabel}</span>
              </span>
            )}
          </button>
        </div>
      }
    >
      <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
        isDestructive
          ? 'bg-rose-500/10 border-rose-500/25 text-rose-950 dark:text-rose-100'
          : 'bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-100'
      }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
          isDestructive
            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30'
            : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
        }`}>
          {isDestructive ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="flex-1 text-xs leading-relaxed pt-1 font-medium">
          {message}
        </div>
      </div>
    </Modal>
  );
}
