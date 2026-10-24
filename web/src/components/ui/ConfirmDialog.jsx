import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmDialog — Modal dialog for confirming sensitive or destructive actions.
 */
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
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={isDestructive ? 'btn-primary bg-danger hover:bg-danger/90' : 'btn-primary'}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isDestructive ? 'bg-red-50 text-danger dark:bg-red-950/40' : 'bg-amber-50 text-accent dark:bg-amber-950/40'
        }`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm text-ink/80 leading-relaxed pt-1">
          {message}
        </p>
      </div>
    </Modal>
  );
}
