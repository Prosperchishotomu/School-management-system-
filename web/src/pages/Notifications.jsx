import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  Bell, CheckCircle2, AlertTriangle, MessageSquare, BookOpen,
  DollarSign, Loader2, CheckCheck, Inbox, ShieldAlert, Sparkles,
  Send, Reply, X, User, Mail, Plus, ArrowRight
} from 'lucide-react';

const Notifications = () => {
  const { user, activeSchoolId } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'direct' | 'broadcast' | 'lecture' | 'fees'
  const [markingAll, setMarkingAll] = useState(false);

  // Selected Notification Modal state
  const [selectedItem, setSelectedItem] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState('');
  const [replyError, setReplyError] = useState('');

  // New Direct Message Modal state
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [composeForm, setComposeForm] = useState({
    target_type: 'user', // 'user' | 'role'
    target_user_id: '',
    target_role: 'teacher',
    title: '',
    message: ''
  });
  const [sendingMsg, setSendingMsg] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [composeSuccess, setComposeSuccess] = useState('');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [notifRes, annRes, msgRes] = await Promise.all([
        api.get('/notifications').catch(() => ({ data: [] })),
        activeSchoolId ? api.get(`/schools/${activeSchoolId}/announcements`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        activeSchoolId ? api.get(`/schools/${activeSchoolId}/teacher-messages`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);

      const notifList = (notifRes.data || []).map(n => ({
        id: n.id,
        rawId: n.id,
        title: n.title,
        message: n.message,
        type: n.type || 'direct_message',
        is_read: Boolean(n.is_read),
        created_at: n.created_at,
        sender_id: n.sender_id,
        sender_name: n.resolved_sender_name || n.sender_name || 'System Administrator',
        sender_role: n.sender_role || 'admin',
        source: 'System Notification',
        canReply: Boolean(n.sender_id && n.sender_id !== user?.id)
      }));

      const annList = (annRes.data || []).map(a => ({
        id: `ann_${a.id}`,
        rawId: a.id,
        title: a.title,
        message: a.content || a.body,
        type: 'broadcast',
        is_read: false,
        created_at: a.date || a.created_at,
        sender_name: a.created_by || 'School Administration',
        source: 'Announcement Broadcast',
        canReply: false
      }));

      const msgList = (msgRes.data || []).map(m => ({
        id: `msg_${m.id}`,
        rawId: m.id,
        title: m.subject || 'Direct Communication',
        message: m.body || m.message,
        type: m.subject?.includes('LECTURE') ? 'lecture' : 'direct_message',
        is_read: Boolean(m.is_read),
        created_at: m.sent_at || m.created_at,
        sender_id: m.sender_id,
        sender_name: m.sender_name || 'Staff Member',
        source: m.sender_name ? `From ${m.sender_name}` : 'Staff Communication',
        canReply: Boolean(m.sender_id && m.sender_id !== user?.id)
      }));

      // Merge, deduplicate by ID, and sort newest first
      const dedupeMap = new Map();
      [...notifList, ...annList, ...msgList].forEach(item => {
        if (item.id) dedupeMap.set(item.id, item);
      });
      const merged = Array.from(dedupeMap.values()).sort((a, b) =>
        new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now())
      );

      setNotifications(merged);

    } catch (err) {
      setError('Could not retrieve notifications feed.');
    } finally {
      setLoading(false);
    }
  }, [user, activeSchoolId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (item) => {
    const id = item.id;
    if (String(id).startsWith('ann_') || String(id).startsWith('msg_')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      return;
    }
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setReplyText('');
    setReplySuccess('');
    setReplyError('');
    if (!item.is_read) {
      handleMarkRead(item);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedItem || !replyText.trim()) return;

    setSendingReply(true);
    setReplySuccess('');
    setReplyError('');

    try {
      await api.post('/notifications/reply', {
        original_notification_id: String(selectedItem.id).startsWith('ann_') || String(selectedItem.id).startsWith('msg_') ? null : selectedItem.id,
        recipient_id: selectedItem.sender_id,
        reply_title: `Re: ${selectedItem.title}`,
        reply_message: replyText.trim()
      });

      setReplySuccess(`Reply sent to ${selectedItem.sender_name} successfully!`);
      setReplyText('');
      // Refresh list after brief delay
      setTimeout(() => {
        fetchNotifications();
      }, 1000);
    } catch (err) {
      setReplyError(err.response?.data?.error?.message || err.message || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleOpenCompose = async () => {
    setShowComposeModal(true);
    setComposeError('');
    setComposeSuccess('');
    if (recipients.length === 0) {
      setLoadingRecipients(true);
      try {
        const res = await api.get('/notifications/recipients');
        const list = res.data || [];
        setRecipients(list);
        if (list.length > 0) {
          setComposeForm(prev => ({ ...prev, target_user_id: list[0].id }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingRecipients(false);
      }
    }
  };

  const handleSendCompose = async (e) => {
    e.preventDefault();
    if (!composeForm.title.trim() || !composeForm.message.trim()) {
      setComposeError('Please provide a subject title and message body.');
      return;
    }

    setSendingMsg(true);
    setComposeError('');
    setComposeSuccess('');

    try {
      const payload = {
        title: composeForm.title.trim(),
        message: composeForm.message.trim(),
        type: 'direct_message'
      };

      if (composeForm.target_type === 'user') {
        if (!composeForm.target_user_id) throw new Error('Please select a recipient.');
        payload.target_user_id = composeForm.target_user_id;
      } else {
        payload.target_role = composeForm.target_role;
      }

      await api.post('/notifications', payload);
      setComposeSuccess('Message delivered to target user(s) successfully!');
      setComposeForm(prev => ({ ...prev, title: '', message: '' }));
      setTimeout(() => {
        setShowComposeModal(false);
        fetchNotifications();
      }, 1200);
    } catch (err) {
      setComposeError(err.response?.data?.error?.message || err.message || 'Failed to send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/notifications/read-all').catch(() => {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
    finally {
      setMarkingAll(false);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'direct') return n.type === 'direct_message';
    if (filter === 'broadcast') return n.type === 'broadcast' || n.type === 'announcement';
    if (filter === 'lecture') return n.type === 'lecture' || n.title?.includes('LECTURE');
    if (filter === 'fees') return n.type === 'fee' || n.title?.toLowerCase().includes('fee') || n.message?.toLowerCase().includes('fee');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type, title = '') => {
    if (type === 'broadcast' || type === 'announcement') return <Bell className="w-4 h-4 text-teal-primary" />;
    if (type === 'lecture' || title.includes('LECTURE')) return <BookOpen className="w-4 h-4 text-amber-warning" />;
    if (type === 'fee' || title.toLowerCase().includes('fee')) return <DollarSign className="w-4 h-4 text-teal-dark" />;
    if (type === 'discipline' || title.toLowerCase().includes('incident')) return <ShieldAlert className="w-4 h-4 text-brick-critical" />;
    return <MessageSquare className="w-4 h-4 text-teal-primary" />;
  };

  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBatch, setDeletingBatch] = useState(false);

  const toggleSelect = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filteredIds = filtered.map(item => item.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected notification(s)?`)) return;
    setDeletingBatch(true);
    try {
      await api.post('/notifications/delete-batch', { ids: selectedIds });
      setNotifications(prev => prev.filter(item => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to delete selected notifications.');
    } finally {
      setDeletingBatch(false);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm('Are you sure you want to clear ALL notifications? This action cannot be undone.')) return;
    setDeletingBatch(true);
    try {
      await api.post('/notifications/clear-all');
      setNotifications([]);
      setSelectedIds([]);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to clear all notifications.');
    } finally {
      setDeletingBatch(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-line-border/30 pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-3xl font-display font-bold text-ink">Notifications & Messages</h2>
            {unreadCount > 0 && (
              <span className="bg-brick-critical text-paper text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {unreadCount} New
              </span>
            )}
          </div>
          <p className="text-sm font-sans text-ink/60 mt-1">
            Targeted institutional alerts, teacher communications, and direct in-system messaging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingBatch}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-brick-critical hover:bg-red-700 text-paper font-sans font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              {deletingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={deletingBatch}
              className="flex items-center space-x-1.5 px-3 py-2 bg-paper hover:bg-brick-critical/10 text-brick-critical border border-brick-critical/20 font-sans font-semibold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All</span>
            </button>
          )}

          <button
            onClick={handleOpenCompose}
            className="flex items-center space-x-1.5 px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Send Direct Message</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-paper hover:bg-sage/10 text-ink border border-line-border/30 font-sans font-semibold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
            >
              {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 text-teal-primary" />}
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Bulk Selection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-border/20 pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Messages', count: notifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'direct', label: 'Direct Messages', count: notifications.filter(n => n.type === 'direct_message').length },
            { id: 'broadcast', label: 'Broadcasts', count: notifications.filter(n => n.type === 'broadcast' || n.type === 'announcement').length },
            { id: 'lecture', label: 'Lecture Reports', count: notifications.filter(n => n.type === 'lecture' || n.title?.includes('LECTURE')).length },
            { id: 'fees', label: 'Fees & Finance', count: notifications.filter(n => n.type === 'fee' || n.title?.toLowerCase().includes('fee')).length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer flex items-center space-x-1.5 ${
                filter === tab.id
                  ? 'bg-teal-primary text-paper shadow-sm'
                  : 'bg-paper text-ink/60 hover:text-ink hover:bg-sage/10 border border-line-border/20'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${filter === tab.id ? 'bg-white/20 text-paper' : 'bg-sage/30 text-teal-dark'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length > 0 && (
          <label className="flex items-center space-x-2 text-xs font-bold font-sans text-ink/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every(item => selectedIds.includes(item.id))}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded text-teal-primary focus:ring-teal-primary cursor-pointer"
            />
            <span>Select All ({filtered.length})</span>
          </label>
        )}
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs font-sans">{error}</div>}

      {/* Feed List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary mb-2" />
          <p className="text-xs text-ink/50 font-sans">Retrieving notification feed...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3 border border-line-border/30">
          <div className="w-12 h-12 rounded-2xl bg-teal-primary/10 flex items-center justify-center mx-auto text-teal-primary">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-sans font-bold text-ink">No Messages in this View</h3>
          <p className="text-xs text-ink/50 max-w-sm mx-auto">You're all caught up! Direct messages, system announcements, and targeted alerts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`glass-card rounded-2xl p-5 border transition-all cursor-pointer flex items-start justify-between gap-4 group ${
                selectedIds.includes(item.id)
                  ? 'bg-teal-primary/10 border-teal-primary shadow-md'
                  : !item.is_read 
                    ? 'bg-gradient-to-r from-teal-primary/10 to-transparent border-teal-primary/40 shadow-sm' 
                    : 'bg-white/60 border-line-border/25 opacity-85 hover:opacity-100 hover:border-teal-primary/30'
              }`}
            >
              <div className="flex items-start space-x-4">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={(e) => toggleSelect(item.id, e)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 rounded text-teal-primary focus:ring-teal-primary cursor-pointer flex-shrink-0"
                />

                <div className="w-10 h-10 rounded-xl bg-paper border border-line-border/30 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:border-teal-primary/40 transition-colors">
                  {getIcon(item.type, item.title)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-sans font-bold text-ink group-hover:text-teal-primary transition-colors">{item.title || 'Notification'}</h4>
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-teal-primary inline-block"></span>
                    )}
                  </div>
                  <p className="text-xs font-sans text-ink/75 line-clamp-2 leading-relaxed">{item.message}</p>
                  
                  <div className="flex items-center space-x-3 pt-1 text-[10px] text-ink/50 font-sans font-medium">
                    <span className="font-semibold text-teal-dark">{item.sender_name}</span>
                    <span>•</span>
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-teal-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to View Data →
                </span>
                {item.canReply && (
                  <span className="p-1.5 bg-teal-primary/10 text-teal-primary rounded-lg text-[10px] font-bold flex items-center space-x-1">
                    <Reply className="w-3 h-3" />
                    <span>Reply</span>
                  </span>
                )}
                {!item.is_read && (
                  <span className="px-2.5 py-1 bg-sage/30 text-teal-dark rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    New
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}


      {/* ─────────────────────────────────────────────────────────────────────────────
          1. FULL NOTIFICATION DETAIL & IN-SYSTEM REPLY MODAL
         ───────────────────────────────────────────────────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedItem(null)}>
          <div
            className="bg-paper rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-line-border/30 space-y-5 animate-scaleUp"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-line-border/20 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center text-teal-primary border border-teal-primary/20">
                  {getIcon(selectedItem.type, selectedItem.title)}
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-ink">{selectedItem.title}</h3>
                  <span className="text-[10px] font-bold text-teal-primary uppercase tracking-wider">{selectedItem.source}</span>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 hover:bg-sage/10 text-ink/50 hover:text-ink rounded-lg cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sender Info Card */}
            <div className="p-3 bg-sage/10 rounded-xl border border-line-border/25 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-primary text-paper flex items-center justify-center font-bold text-xs">
                  {selectedItem.sender_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <span className="font-bold text-ink block">{selectedItem.sender_name}</span>
                  <span className="text-[10px] text-ink/50 capitalize block">{selectedItem.sender_role || 'Staff / System'}</span>
                </div>
              </div>
              <span className="text-[10px] text-ink/40 font-mono">
                {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString() : ''}
              </span>
            </div>

            {/* Message Body */}
            <div className="p-4 bg-paper border border-line-border/30 rounded-xl text-xs font-sans text-ink leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
              {selectedItem.message}
            </div>

            {/* Reply Success / Error feedback */}
            {replyError && <div className="p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs font-sans">{replyError}</div>}
            {replySuccess && <div className="p-3 rounded-lg bg-sage/35 border border-teal-primary/20 text-teal-dark font-semibold text-xs font-sans">{replySuccess}</div>}

            {/* In-System Reply Form */}
            {selectedItem.canReply ? (
              <form onSubmit={handleSendReply} className="space-y-3 pt-2 border-t border-line-border/20">
                <label className="block text-xs font-bold text-ink/70 flex items-center space-x-1.5">
                  <Reply className="w-3.5 h-3.5 text-teal-primary" />
                  <span>Send Direct In-System Reply to {selectedItem.sender_name}</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={`Write your response back to ${selectedItem.sender_name}...`}
                  className="w-full p-3 bg-sage/5 border border-line-border rounded-xl text-xs font-sans focus:outline-none focus:border-teal-primary"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                />
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/70 hover:bg-sage/10 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Reply</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2 bg-teal-primary text-paper rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-teal-dark transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. COMPOSE TARGETED DIRECT MESSAGE MODAL
         ───────────────────────────────────────────────────────────────────────────── */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowComposeModal(false)}>
          <div
            className="bg-paper rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-line-border/30 space-y-5 animate-scaleUp"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-line-border/20 pb-3">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-teal-primary" />
                <h3 className="text-lg font-display font-bold text-ink">Compose Direct Message</h3>
              </div>
              <button onClick={() => setShowComposeModal(false)} className="p-1.5 hover:bg-sage/10 text-ink/50 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {composeError && <div className="p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs font-sans">{composeError}</div>}
            {composeSuccess && <div className="p-3 rounded-lg bg-sage/35 border border-teal-primary/20 text-teal-dark font-semibold text-xs font-sans">{composeSuccess}</div>}

            <form onSubmit={handleSendCompose} className="space-y-4 text-xs font-sans">
              {/* Target Type Selector */}
              <div className="flex space-x-3 bg-sage/10 p-1 rounded-xl border border-line-border/20">
                <button
                  type="button"
                  onClick={() => setComposeForm(p => ({ ...p, target_type: 'user' }))}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    composeForm.target_type === 'user' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  Direct to Individual User
                </button>
                <button
                  type="button"
                  onClick={() => setComposeForm(p => ({ ...p, target_type: 'role' }))}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    composeForm.target_type === 'role' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  Broadcast to User Group
                </button>
              </div>

              {/* Target Selector */}
              {composeForm.target_type === 'user' ? (
                <div>
                  <label className="block font-bold text-ink/70 mb-1">Select Recipient *</label>
                  {loadingRecipients ? (
                    <div className="flex items-center space-x-2 py-2 text-ink/40"><Loader2 className="w-4 h-4 animate-spin" /><span>Loading contacts roster...</span></div>
                  ) : (
                    <select
                      value={composeForm.target_user_id}
                      onChange={e => setComposeForm(p => ({ ...p, target_user_id: e.target.value }))}
                      className="w-full p-2.5 bg-paper border border-line-border rounded-xl font-semibold text-ink focus:outline-none focus:border-teal-primary"
                    >
                      {recipients.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.display_name} ({r.role_title || r.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-ink/70 mb-1">Select Target User Group *</label>
                  <select
                    value={composeForm.target_role}
                    onChange={e => setComposeForm(p => ({ ...p, target_role: e.target.value }))}
                    className="w-full p-2.5 bg-paper border border-line-border rounded-xl font-semibold text-ink focus:outline-none focus:border-teal-primary"
                  >
                    <option value="teacher">All Teaching Staff & Faculty</option>
                    <option value="parent">All Guardians & Parents</option>
                    <option value="school_admin">School Administration Team</option>
                    <option value="all">Entire School Community (Global Broadcast)</option>
                  </select>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block font-bold text-ink/70 mb-1">Subject Header *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End of Term Progress Update"
                  className="w-full p-2.5 border border-line-border rounded-xl font-semibold text-ink focus:outline-none focus:border-teal-primary"
                  value={composeForm.title}
                  onChange={e => setComposeForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>

              {/* Message Content */}
              <div>
                <label className="block font-bold text-ink/70 mb-1">Message Body *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write your message details here..."
                  className="w-full p-2.5 border border-line-border rounded-xl text-ink focus:outline-none focus:border-teal-primary"
                  value={composeForm.message}
                  onChange={e => setComposeForm(p => ({ ...p, message: e.target.value }))}
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 border border-line-border rounded-xl font-semibold text-ink/70 hover:bg-sage/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingMsg}
                  className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl font-bold shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  {sendingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Direct Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;