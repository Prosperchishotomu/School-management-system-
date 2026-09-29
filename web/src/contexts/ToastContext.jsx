import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES = {
  success: 'bg-surface border-teal-primary/40 text-teal-dark',
  error:   'bg-surface border-brick-critical/40 text-brick-critical',
  warning: 'bg-surface border-amber-warning/40 text-amber-warning',
  info:    'bg-surface border-sky-info/40 text-ink',
};

const ICON_STYLES = {
  success: 'text-teal-primary',
  error:   'text-brick-critical',
  warning: 'text-amber-warning',
  info:    'text-sky-info',
};

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    if (typeof window !== 'undefined') window.__schoolbase_last_toast_at = Date.now();
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  useEffect(() => {
    const schedule = (event, type) => {
      const detail = event.detail || {};
      window.setTimeout(() => {
        // Page-level messages are more specific; do not stack a generic global toast.
        if (Date.now() - Number(window.__schoolbase_last_toast_at || 0) < 300) return;
        toast(detail.message || (type === 'error' ? 'Request failed.' : 'Request completed.'), type);
      }, 180);
    };
    const onSuccess = (event) => schedule(event, 'success');
    const onError = (event) => schedule(event, 'error');
    window.addEventListener('schoolbase:request-success', onSuccess);
    window.addEventListener('schoolbase:request-error', onError);
    return () => {
      window.removeEventListener('schoolbase:request-success', onSuccess);
      window.removeEventListener('schoolbase:request-error', onError);
    };
  }, [toast]);

  const notify = {
    success: (msg, dur) => toast(msg, 'success', dur),
    error:   (msg, dur) => toast(msg, 'error', dur || 6000),
    warning: (msg, dur) => toast(msg, 'warning', dur),
    info:    (msg, dur) => toast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={notify}>
      {children}

      {/* Toast Renderer — bottom-right corner */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: '380px', width: 'calc(100vw - 3rem)' }}
      >
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={[
                'pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl',
                'border shadow-xl backdrop-blur-sm font-sans text-sm',
                'transition-all duration-300 ease-out',
                STYLES[t.type],
                t.exiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100',
              ].join(' ')}
              style={{ animation: t.exiting ? undefined : 'slideInRight 0.25s ease-out' }}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_STYLES[t.type]}`} />
              <span className="flex-1 leading-snug font-medium text-[13px]">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss message"
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity cursor-pointer mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
};
