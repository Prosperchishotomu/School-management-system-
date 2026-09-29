import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Plus, Send, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export default function Messages() {
  const toast = useToast();
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState('');
  const [compose, setCompose] = useState({ subject: '', recipient: '', message: '' });
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try { setThreads((await api.get('/messages/conversations')).data || []); }
    catch (error) { toast.error(error.message || 'Could not load conversations.'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadThreads(); api.get('/notifications/recipients').then(res => setRecipients(res.data || [])).catch(() => {}); }, [loadThreads]);
  const openThread = async (item) => { setSelected(item); const response = await api.get(`/messages/conversations/${item.id}`); setThread(response.data); await api.post(`/messages/conversations/${item.id}/read`); };
  const sendMessage = async (event) => {
    event.preventDefault(); if (!selected || !body.trim()) return;
    setSending(true); try { await api.post(`/messages/conversations/${selected.id}/messages`, { body }); setBody(''); await openThread(selected); await loadThreads(); } catch (error) { toast.error(error.message || 'Message could not be sent.'); } finally { setSending(false); }
  };
  const createThread = async (event) => {
    event.preventDefault(); if (!compose.subject.trim() || !compose.recipient || !compose.message.trim()) return;
    setSending(true); try { const response = await api.post('/messages/conversations', { subject: compose.subject, participant_ids: [compose.recipient], initial_message: compose.message }); setCompose({ subject: '', recipient: '', message: '' }); await loadThreads(); const item = { id: response.data.id, subject: response.data.subject }; await openThread(item); } catch (error) { toast.error(error.message || 'Conversation could not be created.'); } finally { setSending(false); }
  };
  return <main className="space-y-5">
    <div className="flex items-center justify-between border-b border-line-border/40 pb-4">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-primary">Secure communication</p><h1 className="text-2xl font-display font-bold text-ink">Messages</h1><p className="text-sm text-ink/60 mt-1">Private, school-scoped conversations with the people you are permitted to reach.</p></div>
      <button onClick={loadThreads} className="icon-button" title="Refresh conversations" aria-label="Refresh conversations"><RefreshCw className="w-4 h-4" /></button>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5 min-h-[560px]">
      <section className="panel p-4 space-y-3"><div className="flex items-center justify-between"><h2 className="font-display font-bold text-ink">Inbox</h2><MessageSquare className="w-4 h-4 text-teal-primary" /></div>{loading ? <p className="text-sm text-ink/50">Loading conversations...</p> : threads.length === 0 ? <p className="text-sm text-ink/50 py-8 text-center">No conversations yet.</p> : threads.map(item => <button key={item.id} onClick={() => openThread(item)} className={`w-full text-left p-3 border rounded-lg transition-colors ${selected?.id === item.id ? 'border-teal-primary bg-teal-primary/10' : 'border-line-border/50 hover:border-teal-primary/50'}`}><p className="font-semibold text-sm text-ink truncate">{item.subject}</p><p className="text-xs text-ink/50 truncate mt-1">{item.last_message || 'No messages'}</p><p className="text-[10px] text-ink/40 mt-2">{item.message_count || 0} messages</p></button>)}</section>
      <section className="panel p-5 flex flex-col">{thread ? <><div className="border-b border-line-border/40 pb-4"><p className="text-xs uppercase tracking-wider text-teal-primary font-bold">Conversation</p><h2 className="text-xl font-display font-bold text-ink mt-1">{thread.subject}</h2></div><div className="flex-1 space-y-3 py-5 overflow-y-auto">{(thread.messages || []).map(message => <article key={message.id} className={`max-w-[78%] p-3 rounded-lg border ${message.sender_id === thread.created_by ? 'ml-auto bg-teal-primary/10 border-teal-primary/20' : 'bg-paper border-line-border/50'}`}><p className="text-[11px] font-semibold text-ink/60 mb-1">{message.sender_name}</p><p className="text-sm text-ink whitespace-pre-wrap">{message.body}</p><time className="block text-[10px] text-ink/40 mt-2">{new Date(message.sent_at).toLocaleString()}</time></article>)}</div><form onSubmit={sendMessage} className="flex gap-2 border-t border-line-border/40 pt-4"><input value={body} onChange={event => setBody(event.target.value)} className="input flex-1" placeholder="Write a secure reply..." /><button disabled={sending || !body.trim()} className="button-primary" title="Send message" aria-label="Send message"><Send className="w-4 h-4" /></button></form></> : <div className="m-auto w-full max-w-lg"><div className="mb-6"><p className="text-xs uppercase tracking-wider text-teal-primary font-bold">New conversation</p><h2 className="text-2xl font-display font-bold text-ink mt-1">Start a message thread</h2></div><form onSubmit={createThread} className="space-y-4"><input className="input w-full" placeholder="Subject" value={compose.subject} onChange={event => setCompose({ ...compose, subject: event.target.value })} /><select className="input w-full" value={compose.recipient} onChange={event => setCompose({ ...compose, recipient: event.target.value })}><option value="">Choose a permitted recipient</option>{recipients.map(item => <option key={item.id} value={item.id}>{item.display_name} ({item.role_title || item.role})</option>)}</select><textarea className="input w-full min-h-32" placeholder="Message" value={compose.message} onChange={event => setCompose({ ...compose, message: event.target.value })} /><button disabled={sending} className="button-primary w-full"><Plus className="w-4 h-4" /> Start conversation</button></form></div>}</section>
    </div>
  </main>;
}
