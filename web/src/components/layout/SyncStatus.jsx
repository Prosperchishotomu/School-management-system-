import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { pendingWrites } from '../../utils/offlineQueue';
import { syncOfflineWrites } from '../../utils/api';

export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const refresh = async () => { try { setPending((await pendingWrites()).length); } catch (_) {} };
  useEffect(() => {
    const onOnline = async () => { setOnline(true); await syncOfflineWrites(); await refresh(); };
    const onOffline = () => setOnline(false);
    const onQueued = refresh;
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('schoolbase:offline-queued', onQueued); refresh();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('schoolbase:offline-queued', onQueued); };
  }, []);
  if (online && pending === 0) return null;
  return <div className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${online ? 'border-amber-500/30 bg-amber-500/10 text-amber-700' : 'border-brick-critical/30 bg-brick-critical/10 text-brick-critical'}`}><span>{online ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudOff className="w-3.5 h-3.5" />}</span><span>{online ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : 'Offline mode'}</span>{online ? <Wifi className="w-3.5 h-3.5" /> : null}</div>;
}
