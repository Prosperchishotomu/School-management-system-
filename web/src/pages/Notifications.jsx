import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  Bell, CheckCircle2, AlertTriangle, MessageSquare, BookOpen,
  DollarSign, Loader2, CheckCheck, Inbox, ShieldAlert, Sparkles
} from 'lucide-react';

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [teacherMessages, setTeacherMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'broadcast' | 'lecture' | 'fees'
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [notifRes, annRes, msgRes] = await Promise.all([
        api.get('/notifications').catch(() => ({ data: [] })),
        user?.school_id ? api.get(`/schools/${user.school_id}/announcements`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        user?.school_id ? api.get(`/schools/${user.school_id}/teacher-messages`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);

      const notifList = notifRes.data || [];
      const annList = (annRes.data || []).map(a => ({
        id: `ann_${a.id}`,
        title: a.title,
        message: a.content || a.body,
        type: 'broadcast',
        is_read: false,
        created_at: a.date || a.created_at,
        source: 'Announcement'
      }));

      const msgList = (msgRes.data || []).map(m => ({
        id: `msg_${m.id}`,
        title: m.subject,
        message: m.body,
        type: m.subject?.includes('LECTURE_REPORT') ? 'lecture' : 'direct_message',
        is_read: false,
        created_at: m.sent_at || m.created_at,
        source: m.sender_name ? `From ${m.sender_name}` : 'Staff Communication'
      }));

      // Merge all alerts chronologically
      const merged = [...notifList, ...annList, ...msgList].sort((a, b) => 
        new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now())
      );

      setNotifications(merged);
      setAnnouncements(annRes.data || []);
      setTeacherMessages(msgRes.data || []);
    } catch (err) {
      setError('Could not retrieve notifications feed.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-line-border/30 pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-3xl font-display font-bold text-ink">Notifications & Alert Center</h2>
            {unreadCount > 0 && (
              <span className="bg-brick-critical text-paper text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {unreadCount} New
              </span>
            )}
          </div>
          <p className="text-sm font-sans text-ink/60 mt-1">Real-time announcements, lecture completion reports, and institutional alerts.</p>
        </div>

        <div className="flex items-center space-x-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-paper hover:bg-sage/10 text-ink border border-line-border/30 font-sans font-semibold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
            >
              {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 text-teal-primary" />}
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line-border/20 pb-3">
        {[
          { id: 'all', label: 'All Alerts', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
          { id: 'broadcast', label: 'Broadcasts', count: notifications.filter(n => n.type === 'broadcast' || n.type === 'announcement').length },
          { id: 'lecture', label: 'Lecture Reports', count: notifications.filter(n => n.type === 'lecture' || n.title?.includes('LECTURE')).length },
          { id: 'fees', label: 'Fees & Finance', count: notifications.filter(n => n.type === 'fee' || n.title?.toLowerCase().includes('fee')).length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer flex items-center space-x-1.5 ${
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
          <h3 className="text-base font-sans font-bold text-ink">No Notifications in this View</h3>
          <p className="text-xs text-ink/50 max-w-sm mx-auto">You're all caught up! System broadcasts, lecture completion reports, and payment alerts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => !item.is_read && handleMarkRead(item.id)}
              className={`glass-card rounded-2xl p-5 border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                !item.is_read 
                  ? 'bg-gradient-to-r from-teal-primary/5 to-transparent border-teal-primary/30 shadow-sm' 
                  : 'bg-white/60 border-line-border/25 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-paper border border-line-border/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {getIcon(item.type, item.title)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-sans font-bold text-ink">{item.title || item.subject || 'System Notification'}</h4>
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-teal-primary inline-block"></span>
                    )}
                  </div>
                  <p className="text-xs font-sans text-ink/75 whitespace-pre-line leading-relaxed">{item.message || item.body || item.content}</p>
                  <div className="flex items-center space-x-3 pt-1 text-[10px] text-ink/45 font-sans font-medium">
                    {item.source && <span>{item.source}</span>}
                    <span>•</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>
                </div>
              </div>

              {!item.is_read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkRead(item.id);
                  }}
                  className="px-2.5 py-1 bg-sage/20 hover:bg-sage/40 text-teal-dark rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex-shrink-0"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;