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
  success: 'bg-slate-900/95 border-emerald-500/50 text-emerald-100 shadow-lg shadow-black/40',
  error:   'bg-slate-900/95 border-rose-500/50 text-rose-100 shadow-lg shadow-black/40',
  warning: 'bg-slate-900/95 border-amber-500/50 text-amber-100 shadow-lg shadow-black/40',
  info:    'bg-slate-900/95 border-cyan-500/50 text-slate-100 shadow-lg shadow-black/40',
};

const ICON_STYLES = {
  success: 'text-emerald-400',
  error:   'text-rose-400',
  warning: 'text-amber-400',
  info:    'text-cyan-400',
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

      {/* Toast Renderer — Top Right-Hand Corner */}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        style={{ maxWidth: '400px', width: 'calc(100vw - 2.5rem)' }}
      >
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={[
                'pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl',
                'border shadow-2xl backdrop-blur-xl font-sans text-xs',
                'transition-all duration-300 ease-out',
                STYLES[t.type],
                t.exiting ? 'opacity-0 -translate-y-2 translate-x-4 scale-95' : 'opacity-100 translate-y-0 translate-x-0 scale-100',
              ].join(' ')}
              style={{ animation: t.exiting ? undefined : 'slideInTopRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_STYLES[t.type]}`} />
              <span className="flex-1 leading-relaxed font-medium text-xs">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss message"
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideInTopRight {
          from { opacity: 0; transform: translateY(-16px) translateX(24px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) translateX(0) scale(1); }
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
