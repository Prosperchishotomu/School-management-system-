import React, { useEffect, useState } from 'react';
import { MonitorSmartphone, ShieldCheck, LogOut, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export default function SecuritySettings() {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setSessions((await api.get('/auth/sessions')).data || []); } catch (error) { toast.error(error.message || 'Unable to load sessions.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const revoke = async (id) => { try { await api.delete(`/auth/sessions/${id}`); await load(); toast.success('Session revoked.'); } catch (error) { toast.error(error.message || 'Could not revoke session.'); } };
  return <main className="space-y-5"><div className="border-b border-line-border/40 pb-4"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-primary">Account protection</p><h1 className="text-2xl font-display font-bold text-ink">Security settings</h1><p className="text-sm text-ink/60 mt-1">Review active sessions and account security controls.</p></div><section className="panel p-5"><div className="flex items-center justify-between border-b border-line-border/40 pb-4"><div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-teal-primary" /><div><h2 className="font-display font-bold text-ink">Active sessions</h2><p className="text-xs text-ink/50">Revoke devices you no longer recognize.</p></div></div><button className="icon-button" onClick={load} title="Refresh sessions" aria-label="Refresh sessions"><RefreshCw className="w-4 h-4" /></button></div>{loading ? <p className="text-sm text-ink/50 py-6">Loading sessions...</p> : <div className="divide-y divide-line-border/40">{sessions.map(session => <div key={session.id} className="flex items-center justify-between py-4"><div className="flex items-center gap-3"><MonitorSmartphone className="w-4 h-4 text-ink/50" /><div><p className="text-sm font-semibold text-ink">{session.user_agent || 'Browser session'}</p><p className="text-xs text-ink/50">{session.ip || 'Unknown network'} · Started {session.created_at ? new Date(session.created_at).toLocaleString() : 'recently'}</p></div></div><button onClick={() => revoke(session.id)} className="button-secondary"><LogOut className="w-3.5 h-3.5" /> Revoke</button></div>)}{sessions.length === 0 && <p className="text-sm text-ink/50 py-6">No active refresh sessions found.</p>}</div>}</section></main>;
}
