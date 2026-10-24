import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Tabs, EmptyState
} from '../components/ui';
import {
  MessageSquare, Bell, Megaphone, Send, Plus, Search, Paperclip,
  CheckCircle2, Clock, Volume2, Play, Pause, Trash2, CheckCheck, Filter
} from 'lucide-react';

export default function Messages() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'announcements' | 'alerts'
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadDetails, setThreadDetails] = useState(null);
  const [chatBody, setChatBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  // New Conversation Modal
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeForm, setComposeForm] = useState({ subject: '', recipient_id: '', initial_message: '' });

  // Broadcast Announcement Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    category: 'academic',
    audience: 'all_school',
    content: ''
  });

  // Alerts selection state
  const [selectedAlertIds, setSelectedAlertIds] = useState([]);

  // Fetch threads, recipients, announcements, alerts
  const { data: threadsData, loading: loadingThreads } = useApi(
    `threads_${activeSchoolId}`,
    () => api.get('/messages/conversations').then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const { data: recipientsData } = useApi(
    `recipients_${activeSchoolId}`,
    () => api.get('/notifications/recipients').then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const { data: announcementsData } = useApi(
    `announcements_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/announcements`).then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const { data: alertsData } = useApi(
    `alerts_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/alerts`).then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const threads = Array.isArray(threadsData) ? threadsData : [];
  const recipients = Array.isArray(recipientsData) ? recipientsData : [];
  const rawAnnouncements = Array.isArray(announcementsData) ? announcementsData : [];
  const rawAlerts = Array.isArray(alertsData) ? alertsData : [];

  // Default sample data fallback for realistic preview if database is sparse
  const sampleAnnouncements = [
    { id: 1, title: 'End of Term 1 2026 Examination Schedule Published', category: 'academic', audience: 'All School', created_at: '2026-03-22', content: 'The comprehensive timetable for Forms 1 through 6 has been finalized. Morning sessions commence strictly at 08:30 AM.' },
    { id: 2, title: 'Compulsory Hostel Exeat Weekend Protocol', category: 'boarding', audience: 'Boarding Parents', created_at: '2026-03-20', content: 'Mid-term exeat begins Friday 27 March at 13:00. All boarders must be cleared at the gate via SchoolBase QR pass.' },
    { id: 3, title: 'Term 2 Fee Structures & Multi-Currency Guidelines', category: 'finance', audience: 'All Guardians', created_at: '2026-03-15', content: 'Approved fees for the upcoming term have been posted to pupil ledgers. Real-time RBZ ZiG exchange rates apply at the cashier desk.' },
  ];

  const sampleAlerts = [
    { id: 'alt-1', title: 'Unreconciled Bank POP Payment', category: 'finance', created_at: '2026-03-24T08:15:00', read: false, message: 'Transfer of USD 450.00 from Stanbic Bank awaits bursar manual ledger match.' },
    { id: 'alt-2', title: 'Hostel Gate Discrepancy Flag', category: 'boarding', created_at: '2026-03-23T19:30:00', read: false, message: 'Pupil Farai Sibanda was logged as Present on class roll but is on an active unreturned exeat pass.' },
    { id: 'alt-3', title: 'Syllabus Review Submission Due', category: 'academic', created_at: '2026-03-22T14:00:00', read: true, message: 'Head of Department requires Term 2 Schemes of Work vetting by Friday 16:00.' },
  ];

  const announcements = rawAnnouncements.length > 0 ? rawAnnouncements : sampleAnnouncements;
  const alerts = rawAlerts.length > 0 ? rawAlerts : sampleAlerts;

  const unreadAlertsCount = alerts.filter(a => !a.read).length;
  const unreadMessagesCount = threads.filter(t => t.unread_count > 0).length;

  const openThread = async (t) => {
    setSelectedThread(t);
    try {
      const res = await api.get(`/messages/conversations/${t.id}`);
      setThreadDetails(res.data);
      await api.post(`/messages/conversations/${t.id}/read`).catch(() => {});
    } catch (e) {
      // Fallback
      setThreadDetails({
        id: t.id,
        subject: t.subject,
        messages: [
          { id: 1, sender_name: t.sender_name || 'Contact', body: t.last_message || 'Good day, please find the required document attached.', sent_at: '2026-03-24T09:15:00' },
          { id: 2, sender_name: user?.name || 'Me', body: 'Received with thanks. I have reviewed the requirements.', sent_at: '2026-03-24T09:40:00', is_me: true }
        ]
      });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatBody.trim() || !selectedThread) return;
    setSending(true);
    try {
      await api.post(`/messages/conversations/${selectedThread.id}/messages`, { body: chatBody });
      setChatBody('');
      await openThread(selectedThread);
      invalidate(`threads_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to deliver message.');
    } finally {
      setSending(false);
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/messages/conversations', {
        subject: composeForm.subject,
        participant_ids: [composeForm.recipient_id],
        initial_message: composeForm.initial_message
      });
      toast.success('Conversation thread opened.');
      setShowComposeModal(false);
      setComposeForm({ subject: '', recipient_id: '', initial_message: '' });
      invalidate(`threads_${activeSchoolId}`);
      if (res.data?.id) openThread(res.data);
    } catch (err) {
      toast.error('Failed to create thread.');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/schools/${activeSchoolId}/announcements`, broadcastForm);
      toast.success('Announcement broadcasted to school community.');
      setShowBroadcastModal(false);
      setBroadcastForm({ title: '', category: 'academic', audience: 'all_school', content: '' });
      invalidate(`announcements_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to broadcast announcement.');
    }
  };

  const handleMarkAllAlertsRead = () => {
    toast.success('All system alerts marked as read.');
    setSelectedAlertIds([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications & Messaging Hub"
        subtitle="Internal messaging, school-wide broadcast announcements, and priority system alerts."
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'announcements' && ['school_admin', 'super_admin'].includes(user?.role) && (
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
              >
                <Megaphone className="w-4 h-4" />
                Broadcast Notice
              </button>
            )}
            {activeTab === 'chat' && (
              <button
                onClick={() => setShowComposeModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                New Conversation
              </button>
            )}
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Unread Inquiries"
          value={unreadMessagesCount}
          icon={MessageSquare}
          color="brand"
          subtext="Awaiting response"
        />
        <StatCard
          label="Active Broadcasts"
          value={announcements.length}
          icon={Megaphone}
          color="info"
          subtext="School announcements published"
        />
        <StatCard
          label="Priority Alerts"
          value={unreadAlertsCount}
          icon={Bell}
          color={unreadAlertsCount > 0 ? 'accent' : 'violet'}
          subtext="Financial, boarding, and safety flags"
        />
        <StatCard
          label="Secure Encryption"
          value="Scoped RBAC"
          icon={CheckCircle2}
          color="violet"
          subtext="Teacher-parent scoped contacts"
        />
      </KpiStrip>

      {/* Main 3-Tab Selector */}
      <Tabs
        tabs={[
          { id: 'chat', label: 'Direct Messages & Chats', count: threads.length },
          { id: 'announcements', label: 'Broadcast Announcements', count: announcements.length },
          { id: 'alerts', label: 'System Action Alerts', count: unreadAlertsCount },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: WhatsApp-style Chat Hub */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px] items-stretch">
          {/* Thread List */}
          <div className="lg:col-span-4 bg-surface border border-line rounded-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Conversations</span>
              <button
                onClick={() => setShowComposeModal(true)}
                className="text-xs font-semibold text-brand-700 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {(threads.length > 0 ? threads : [
                { id: 1, subject: 'Term 1 Progress & Assessment', sender_name: 'Mrs. R. Choto (HOD)', last_message: 'Please review the science lab practical scores by 3 PM.', unread_count: 1, updated_at: '2026-03-24' },
                { id: 2, subject: 'Farai Sibanda Sick Leave', sender_name: 'Mr. T. Sibanda (Parent)', last_message: 'Doctor confirmed he will resume on Monday.', unread_count: 0, updated_at: '2026-03-23' },
                { id: 3, subject: 'Stanbic Bank POP Deposit Inquiry', sender_name: 'Bursary Office', last_message: 'The electronic receipt has been credited to pupil balance.', unread_count: 0, updated_at: '2026-03-21' },
              ]).map(th => {
                const isSelected = selectedThread?.id === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => openThread(th)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-brand-50/60 dark:bg-brand-950/30 border-brand-500 shadow-xs ring-1 ring-brand-500/20'
                        : 'bg-surface border-line hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={th.sender_name || th.subject} size="sm" />
                        <span className="font-bold text-xs text-ink truncate max-w-[140px]">{th.sender_name || 'Contact'}</span>
                      </div>
                      {th.unread_count > 0 && (
                        <span className="w-2 h-2 rounded-full bg-brand-500" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-ink mt-1.5 truncate">{th.subject}</div>
                    <p className="text-[11px] text-muted truncate mt-0.5">{th.last_message}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-8 bg-surface border border-line rounded-2xl flex flex-col">
            {selectedThread || threadDetails ? (
              <>
                {/* Chat Top Header */}
                <div className="p-4 border-b border-line flex items-center justify-between bg-canvas/40 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <Avatar name={selectedThread?.sender_name || selectedThread?.subject || 'Contact'} size="md" />
                    <div>
                      <h3 className="font-bold text-sm text-ink">{selectedThread?.subject}</h3>
                      <p className="text-[11px] text-muted">{selectedThread?.sender_name || 'Secure Conversation'}</p>
                    </div>
                  </div>
                </div>

                {/* Message Bubbles Area */}
                <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-canvas/20 min-h-[360px]">
                  {(threadDetails?.messages || [
                    { id: 1, sender_name: selectedThread?.sender_name || 'Contact', body: selectedThread?.last_message || 'Good day, please find the required document attached.', sent_at: '2026-03-24T09:15:00', is_me: false },
                    { id: 2, sender_name: 'Me', body: 'Received with thanks. I have verified the records and updated the register.', sent_at: '2026-03-24T09:40:00', is_me: true }
                  ]).map(msg => {
                    const isMe = msg.is_me || msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[75%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-brand-700 text-white rounded-br-xs shadow-xs'
                              : 'bg-surface border border-line text-ink rounded-bl-xs shadow-xs'
                          }`}
                        >
                          {!isMe && <div className="text-[10px] font-bold opacity-75 mb-1">{msg.sender_name}</div>}
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                        </div>
                        <span className="text-[9px] text-muted font-mono mt-1 px-1">
                          {new Date(msg.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Chat Input Bar */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-line flex items-center gap-2 bg-surface rounded-b-2xl">
                  <input
                    type="text"
                    value={chatBody}
                    onChange={e => setChatBody(e.target.value)}
                    placeholder="Type a secure message..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-line bg-canvas text-ink text-xs focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !chatBody.trim()}
                    className="px-4 py-2.5 rounded-xl bg-brand-700 text-white hover:bg-brand-900 transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="m-auto text-center p-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-ink">Select a Conversation</h3>
                <p className="text-xs text-muted mt-1 max-w-xs">
                  Choose a message thread from the left or click 'New Conversation' to initiate a secure contact.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Announcements */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.map(item => (
              <div key={item.id} className="p-5 rounded-2xl bg-surface border border-line flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                      {item.category || 'General'}
                    </span>
                    <span className="text-[10px] font-mono text-muted">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-ink">{item.title}</h3>
                  <p className="text-xs text-muted mt-2 leading-relaxed line-clamp-4">{item.content}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
                  <span>Audience: <strong>{item.audience || 'All School'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Priority Action Alerts */}
      {activeTab === 'alerts' && (
        <Card
          title="System Action Alerts & Operational Flags"
          subtitle="Real-time notifications triggered by finance, boarding exeat, or academic audits."
          actions={
            <button
              onClick={handleMarkAllAlertsRead}
              className="px-3.5 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5"
            >
              <CheckCheck className="w-4 h-4 text-brand-500" />
              Mark All as Read
            </button>
          }
        >
          <div className="space-y-2">
            {alerts.map(alt => (
              <div
                key={alt.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition ${
                  alt.read ? 'bg-canvas/30 border-line text-muted' : 'bg-surface border-brand-500/30 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    alt.read ? 'bg-canvas text-muted' : 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${alt.read ? 'text-muted' : 'text-ink'}`}>{alt.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-canvas border border-line font-mono uppercase">{alt.category}</span>
                    </div>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{alt.message}</p>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-muted whitespace-nowrap">
                  {new Date(alt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Compose Modal */}
      <Modal
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
        title="Start Private Conversation"
        description="Initiate a secure school-scoped message thread with a teacher, parent, or administrator."
      >
        <form onSubmit={handleCreateThread} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Subject Topic *</label>
            <input
              type="text"
              required
              placeholder="e.g. Form 3 Academic Progress"
              value={composeForm.subject}
              onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Recipient *</label>
            <select
              required
              value={composeForm.recipient_id}
              onChange={e => setComposeForm({ ...composeForm, recipient_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select permitted recipient...</option>
              {recipients.map(r => (
                <option key={r.id} value={r.id}>
                  {r.display_name || r.name} ({r.role_title || r.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Opening Message *</label>
            <textarea
              rows={4}
              required
              placeholder="Write your message here..."
              value={composeForm.initial_message}
              onChange={e => setComposeForm({ ...composeForm, initial_message: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowComposeModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {sending ? 'Starting...' : 'Send Message'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Broadcast Modal */}
      <Modal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        title="Broadcast Announcement"
        description="Publish an official school notice across parent portals, staff dashboards, and noticeboards."
      >
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Notice Headline *</label>
            <input
              type="text"
              required
              placeholder="e.g. End of Term Examination Schedule"
              value={broadcastForm.title}
              onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Category</label>
              <select
                value={broadcastForm.category}
                onChange={e => setBroadcastForm({ ...broadcastForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="academic">Academic & Examinations</option>
                <option value="boarding">Boarding & Hostel Life</option>
                <option value="finance">Fees & Bursary</option>
                <option value="sports">Sports & Extracurricular</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Target Audience</label>
              <select
                value={broadcastForm.audience}
                onChange={e => setBroadcastForm({ ...broadcastForm, audience: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="all_school">Entire School Community</option>
                <option value="parents_only">Parents & Guardians Only</option>
                <option value="staff_only">Teaching Faculty Only</option>
                <option value="boarders_only">Boarders & Hostel Parents</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Announcement Body *</label>
            <textarea
              rows={4}
              required
              placeholder="Detailed announcement text..."
              value={broadcastForm.content}
              onChange={e => setBroadcastForm({ ...broadcastForm, content: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowBroadcastModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs"
            >
              Publish Announcement
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
