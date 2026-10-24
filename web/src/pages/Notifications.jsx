import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import {
  Bell, CheckCircle2, AlertTriangle, MessageSquare, BookOpen,
  DollarSign, Loader2, CheckCheck, Inbox, ShieldAlert, Sparkles,
  Send, Reply, X, User, Mail, Plus, ArrowRight, Trash2, Search,
  Paperclip, Mic, MicOff, Volume2, Play, Pause, FileText, Check,
  Clock, ShieldCheck, RefreshCw, Megaphone
} from 'lucide-react';
import CollapsibleList from '../components/ui/CollapsibleList';

export default function Notifications() {
  const { user, activeSchoolId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  // Tab: 'chats' | 'announcements' | 'alerts'
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'chats';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL
  useEffect(() => {
    const tabParam = queryParams.get('tab');
    if (tabParam && ['chats', 'announcements', 'alerts'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    navigate(`/notifications?tab=${tab}`, { replace: true });
  };

  /* ───────────────────────────────────────────────────────────────────────────
   * TAB 1: SECURE CHATS / MESSAGES (WhatsApp / FB Messenger style)
   * ─────────────────────────────────────────────────────────────────────────── */
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Audio recording simulation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef(null);
  const [pendingAudio, setPendingAudio] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);

  // New Conversation Modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState('');
  const [newChatSubject, setNewChatSubject] = useState('');
  const [newChatFirstMsg, setNewChatFirstMsg] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations');
      const list = res.data?.data || res.data || [];
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Error fetching conversations:', err);
      return [];
    }
  }, []);

  // Open specific thread
  const openConversation = useCallback(async (conv) => {
    if (!conv?.id) return;
    setSelectedConversation(conv);
    setThreadLoading(true);
    try {
      const res = await api.get(`/messages/conversations/${conv.id}`);
      setActiveThread(res.data?.data || res.data);
      api.post(`/messages/conversations/${conv.id}/read`).catch(() => {});
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      toast.error('Failed to load conversation messages.');
    } finally {
      setThreadLoading(false);
    }
  }, [toast]);

  // Load permitted contacts for new chat
  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await api.get('/messages/contacts');
      setContacts(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleStartNewChat = async (e) => {
    e.preventDefault();
    if (!selectedContact || !newChatFirstMsg.trim()) {
      toast.warning('Please select a recipient and enter a message.');
      return;
    }
    setCreatingChat(true);
    try {
      const res = await api.post('/messages/conversations', {
        subject: newChatSubject.trim() || 'Parent-Teacher Communication',
        participant_ids: [selectedContact],
        initial_message: newChatFirstMsg.trim()
      });
      setShowNewChatModal(false);
      setSelectedContact('');
      setNewChatSubject('');
      setNewChatFirstMsg('');
      toast.success('Conversation started successfully.');
      const updatedList = await loadConversations();
      if (res.data?.data?.id) {
        const found = updatedList.find(c => c.id === res.data.data.id) || { id: res.data.data.id, subject: res.data.data.subject };
        openConversation(found);
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to start conversation.');
    } finally {
      setCreatingChat(false);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!selectedConversation?.id) return;
    if (!messageText.trim() && !pendingAudio && !pendingAttachment) return;

    setSendingMessage(true);
    try {
      const payload = {
        body: messageText.trim() || (pendingAudio ? 'Voice note' : 'Attached document'),
        audio_url: pendingAudio ? pendingAudio.url : null,
        audio_duration: pendingAudio ? pendingAudio.duration : null,
        attachment_url: pendingAttachment ? pendingAttachment.url : null,
        attachment_type: pendingAttachment ? pendingAttachment.type : null
      };

      await api.post(`/messages/conversations/${selectedConversation.id}/messages`, payload);
      setMessageText('');
      setPendingAudio(null);
      setPendingAttachment(null);

      // Refresh active thread immediately
      const refreshed = await api.get(`/messages/conversations/${selectedConversation.id}`);
      setActiveThread(refreshed.data?.data || refreshed.data);
      loadConversations();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      toast.error(err.message || 'Failed to deliver message.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Audio Voice Note recording simulator
  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      const duration = Math.max(1, recordingSeconds);
      setPendingAudio({
        url: `https://actions.google.com/sounds/v1/communication/radio_chime.ogg`,
        duration,
        name: `Voice Note (${duration}s)`
      });
      setRecordingSeconds(0);
    }
  };

  const handleSimulateAttachment = () => {
    const sampleFiles = [
      { name: 'Medical_Certificate_Doctor.pdf', type: 'application/pdf', url: '#' },
      { name: 'Term_Report_Assessment.pdf', type: 'application/pdf', url: '#' },
      { name: 'Homework_Photo_Submission.jpg', type: 'image/jpeg', url: '#' }
    ];
    const picked = sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
    setPendingAttachment(picked);
  };

  /* ───────────────────────────────────────────────────────────────────────────
   * TAB 2: ANNOUNCEMENTS
   * ─────────────────────────────────────────────────────────────────────────── */
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annFilter, setAnnFilter] = useState('all');
  const [showNewAnnModal, setShowNewAnnModal] = useState(false);
  const [annClasses, setAnnClasses] = useState([]);
  const [annForm, setAnnForm] = useState({
    title: '',
    body: '',
    target_audience: 'all',
    class_id: '',
    expires_at: ''
  });
  const [submittingAnn, setSubmittingAnn] = useState(false);

  const canPostAnnouncement = user?.role === 'school_admin' || user?.role === 'teacher' || user?.role === 'super_admin';

  useEffect(() => {
    if (activeSchoolId && canPostAnnouncement) {
      api.get(`/schools/${activeSchoolId}/classes`).then(res => {
        setAnnClasses(res.data?.data || res.data || []);
      }).catch(() => {});
    }
  }, [activeSchoolId, canPostAnnouncement]);

  const loadAnnouncements = useCallback(async () => {
    if (!activeSchoolId) return;
    setAnnLoading(true);
    try {
      const res = await api.get(`/schools/${activeSchoolId}/announcements`);
      setAnnouncements(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setAnnLoading(false);
    }
  }, [activeSchoolId]);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!annForm.title.trim() || !annForm.body.trim()) {
      toast.warning('Title and broadcast content are required.');
      return;
    }
    setSubmittingAnn(true);
    try {
      await api.post(`/schools/${activeSchoolId}/announcements`, {
        title: annForm.title.trim(),
        body: annForm.body.trim(),
        target_audience: annForm.target_audience,
        class_id: annForm.target_audience === 'students' ? (annForm.class_id || null) : null,
        expires_at: annForm.expires_at || null
      });
      toast.success('Broadcast published successfully.');
      setShowNewAnnModal(false);
      setAnnForm({ title: '', body: '', target_audience: 'all', class_id: '', expires_at: '' });
      loadAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to publish announcement.');
    } finally {
      setSubmittingAnn(false);
    }
  };

  /* ───────────────────────────────────────────────────────────────────────────
   * TAB 3: SYSTEM ALERTS & NOTIFICATIONS
   * ─────────────────────────────────────────────────────────────────────────── */
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState('all'); // all, unread, fees, attendance

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await api.get('/notifications');
      setAlerts(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const markAlertRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: 1 } : a));
    } catch (_) {}
  };

  const markAllAlertsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setAlerts(prev => prev.map(a => ({ ...a, is_read: 1 })));
      toast.success('All alerts marked as read.');
    } catch (_) {}
  };

  /* ───────────────────────────────────────────────────────────────────────────
   * REALTIME WEBSOCKET & REACTIVE POLLING (No manual refresh needed)
   * ─────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    loadConversations().then(list => {
      if (list && list.length > 0 && !selectedConversation) {
        openConversation(list[0]);
      }
    });
    loadAnnouncements();
    loadAlerts();

    // WebSocket Real-time Connection
    let ws = null;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:5000/ws?token=${token}`;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'conversation.message.created') {
              // Automatically refresh conversation list and active thread!
              loadConversations();
              if (selectedConversation && data.data?.conversation_id === selectedConversation.id) {
                api.get(`/messages/conversations/${selectedConversation.id}`).then(res => {
                  setActiveThread(res.data?.data || res.data);
                  setTimeout(scrollToBottom, 50);
                });
              }
            } else if (data.type === 'notification.created') {
              loadAlerts();
            }
          } catch (_) {}
        };
      } catch (wsErr) {
        console.warn('WebSocket init notice:', wsErr);
      }
    }

    // Reactive Poll Fallback (every 4 seconds for instant responsiveness)
    const interval = setInterval(() => {
      loadConversations();
      if (selectedConversation?.id) {
        api.get(`/messages/conversations/${selectedConversation.id}`).then(res => {
          const fresh = res.data?.data || res.data;
          if (fresh?.messages?.length !== activeThread?.messages?.length) {
            setActiveThread(fresh);
            setTimeout(scrollToBottom, 50);
          }
        }).catch(() => {});
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [loadConversations, loadAnnouncements, loadAlerts, selectedConversation?.id]);

  // Filter conversations by search
  const filteredConversations = conversations.filter(c => {
    if (!chatSearch.trim()) return true;
    const q = chatSearch.toLowerCase();
    return (c.subject || '').toLowerCase().includes(q) ||
           (c.last_message || '').toLowerCase().includes(q) ||
           (c.contact_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="module-page p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn font-sans">
      {/* Top Header & Integrated Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line-border/30 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-primary/10 text-teal-primary uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Unified Communication Hub</span>
            </span>
          </div>
          <h1 className="text-2xl font-display font-bold text-ink mt-1">Alerts, Chats &amp; Announcements</h1>
          <p className="text-xs text-ink/60 mt-0.5">
            Real-time secure parent-teacher consultations, official school broadcasts, and automated ledger notices.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex p-1 bg-paper border border-line-border/50 rounded-xl shadow-xs">
          <button
            onClick={() => switchTab('chats')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'chats'
                ? 'bg-teal-primary text-paper shadow-sm'
                : 'text-ink/65 hover:text-ink hover:bg-sage/10'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Secure Chats</span>
            {conversations.some(c => c.unread_count > 0) && (
              <span className="w-2 h-2 rounded-full bg-amber-warning animate-pulse" />
            )}
          </button>

          <button
            onClick={() => switchTab('announcements')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'announcements'
                ? 'bg-teal-primary text-paper shadow-sm'
                : 'text-ink/65 hover:text-ink hover:bg-sage/10'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Announcements</span>
            {announcements.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sage/30 text-teal-dark font-mono">
                {announcements.length}
              </span>
            )}
          </button>

          <button
            onClick={() => switchTab('alerts')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-teal-primary text-paper shadow-sm'
                : 'text-ink/65 hover:text-ink hover:bg-sage/10'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>System Alerts</span>
            {alerts.filter(a => !a.is_read).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-brick-critical/20 text-brick-critical font-mono font-bold">
                {alerts.filter(a => !a.is_read).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────
       * TAB 1 CONTENT: SECURE CHATS (WhatsApp / Messenger Style Two-Pane View)
       * ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-paper border border-line-border/40 rounded-2xl shadow-sm overflow-hidden h-[720px]">
          {/* Left Column: Chat Conversation List */}
          <div className="lg:col-span-4 border-r border-line-border/30 flex flex-col h-full bg-paper/60">
            {/* Chats Header & Search */}
            <div className="p-4 border-b border-line-border/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="font-display font-bold text-base text-ink">Conversations</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-primary/10 text-teal-primary">
                    {conversations.length}
                  </span>
                </div>
                <button
                  onClick={() => { setShowNewChatModal(true); loadContacts(); }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-teal-primary hover:bg-teal-dark text-paper rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink/40 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search chats, contacts, or messages..."
                  value={chatSearch}
                  onChange={e => setChatSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-paper border border-line-border/40 rounded-xl focus:outline-none focus:border-teal-primary"
                />
              </div>
            </div>

            {/* Conversation Threads Scroll Area */}
            <div className="flex-1 overflow-y-auto divide-y divide-line-border/20">
              {filteredConversations.length === 0 ? (
                <div className="py-16 text-center text-xs text-ink/40 px-6 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-ink/20" />
                  <p>No active chat conversations yet.</p>
                  <p className="text-[10px] text-ink/30">Click "+ New Chat" above to start a secure dialogue with permitted teachers or parents.</p>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = selectedConversation?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      className={`w-full text-left p-4 transition-colors flex items-start space-x-3 cursor-pointer ${
                        isSelected ? 'bg-teal-primary/10 border-l-4 border-l-teal-primary' : 'hover:bg-sage/10'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-teal-primary/15 text-teal-dark flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                          {(conv.subject || 'C').charAt(0)}
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-primary absolute bottom-0 right-0 border-2 border-paper" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-ink truncate">{conv.subject || 'Direct Chat'}</h4>
                          <span className="text-[10px] text-ink/40 shrink-0 font-mono">
                            {conv.updated_at ? new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-ink/60 truncate mt-1">
                          {conv.last_message || 'Start chatting...'}
                        </p>
                        <div className="flex items-center space-x-2 mt-1.5">
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-sage/20 text-teal-dark uppercase tracking-wider">
                            Secure Chat
                          </span>
                          <span className="text-[10px] text-ink/30 font-mono">
                            {conv.message_count || 1} msg{conv.message_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Chat Thread (WhatsApp Style Speech Bubbles) */}
          <div className="lg:col-span-8 flex flex-col h-full bg-paper/40">
            {selectedConversation ? (
              <>
                {/* Chat Top Bar */}
                <div className="p-4 border-b border-line-border/30 bg-paper/90 flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-teal-primary/15 text-teal-dark flex items-center justify-center font-bold text-sm shadow-xs uppercase">
                      {(selectedConversation.subject || 'C').charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-ink">{selectedConversation.subject}</h3>
                      <div className="flex items-center space-x-2 text-[10px] text-ink/50 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-primary animate-pulse" />
                        <span className="text-teal-dark font-medium">Encrypted &bull; Direct Consultation</span>
                        <span>&bull;</span>
                        <span>Private &amp; Audited</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openConversation(selectedConversation)}
                      className="p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-sage/10 transition-colors"
                      title="Sync conversation"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-paper/20">
                  {threadLoading ? (
                    <div className="flex items-center justify-center h-full text-xs text-ink/40 space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-primary" />
                      <span>Syncing messages...</span>
                    </div>
                  ) : activeThread?.messages?.length === 0 ? (
                    <div className="py-20 text-center text-xs text-ink/40">
                      No messages in this conversation thread yet. Say hello below!
                    </div>
                  ) : (
                    activeThread?.messages?.map((msg, idx) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full`}
                        >
                          <div
                            className={`rounded-2xl p-4 max-w-[80%] shadow-xs transition-all ${
                              isMe
                                ? 'bg-teal-primary text-paper rounded-br-xs'
                                : 'bg-paper text-ink border border-line-border/40 rounded-bl-xs'
                            }`}
                          >
                            {/* Sender Name */}
                            {!isMe && (
                              <p className="text-[10px] font-bold text-teal-primary uppercase tracking-wider mb-1">
                                {msg.sender_name || 'Staff Member'}
                              </p>
                            )}

                            {/* Voice Audio Note Player */}
                            {msg.audio_url && (
                              <div className={`flex items-center space-x-3 p-2.5 rounded-xl mb-2 ${
                                isMe ? 'bg-teal-dark/30' : 'bg-sage/15'
                              }`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (playingAudioId === msg.id) {
                                      setPlayingAudioId(null);
                                    } else {
                                      setPlayingAudioId(msg.id);
                                      const audio = new Audio(msg.audio_url);
                                      audio.play();
                                      audio.onended = () => setPlayingAudioId(null);
                                    }
                                  }}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                    isMe ? 'bg-paper text-teal-dark' : 'bg-teal-primary text-paper'
                                  }`}
                                >
                                  {playingAudioId === msg.id ? (
                                    <Pause className="w-3.5 h-3.5" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 ml-0.5" />
                                  )}
                                </button>
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1.5">
                                    <Volume2 className="w-3.5 h-3.5 opacity-70" />
                                    <span className="text-xs font-bold">Voice Note</span>
                                  </div>
                                  <span className="text-[10px] opacity-70 font-mono">
                                    {msg.audio_duration ? `${msg.audio_duration} seconds` : 'Audio clip'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Attachment Chip */}
                            {msg.attachment_url && (
                              <div className={`flex items-center space-x-2.5 p-2 rounded-xl mb-2 border ${
                                isMe ? 'bg-paper/10 border-paper/20' : 'bg-paper border-line-border/40'
                              }`}>
                                <FileText className="w-4 h-4 shrink-0 text-teal-primary" />
                                <div className="truncate text-xs">
                                  <p className="font-bold truncate">Attachment File</p>
                                  <span className="text-[9px] opacity-70 font-mono">Verified document</span>
                                </div>
                              </div>
                            )}

                            {/* Message Body */}
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.body}</p>

                            {/* Timestamp & Delivery Indicator */}
                            <div className={`flex items-center justify-end space-x-1.5 mt-2 text-[10px] ${
                              isMe ? 'text-paper/70' : 'text-ink/40'
                            }`}>
                              <span>
                                {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                              </span>
                              {isMe && <CheckCheck className="w-3.5 h-3.5 text-paper" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Pending Media Preview */}
                {(pendingAudio || pendingAttachment) && (
                  <div className="px-6 py-2 bg-sage/10 border-t border-line-border/30 flex items-center justify-between text-xs font-medium text-teal-dark">
                    <div className="flex items-center space-x-2">
                      {pendingAudio && (
                        <span className="inline-flex items-center space-x-1 bg-paper px-2 py-1 rounded-md border border-line-border/30">
                          <Volume2 className="w-3.5 h-3.5 text-teal-primary" />
                          <span>{pendingAudio.name}</span>
                        </span>
                      )}
                      {pendingAttachment && (
                        <span className="inline-flex items-center space-x-1 bg-paper px-2 py-1 rounded-md border border-line-border/30">
                          <FileText className="w-3.5 h-3.5 text-teal-primary" />
                          <span>{pendingAttachment.name}</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { setPendingAudio(null); setPendingAttachment(null); }}
                      className="text-xs text-brick-critical font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Chat Input Bar */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-line-border/30 bg-paper/80 flex items-center space-x-2">
                  {/* File Attachment Button */}
                  <button
                    type="button"
                    onClick={handleSimulateAttachment}
                    className="p-2.5 rounded-xl text-ink/60 hover:text-ink hover:bg-sage/10 transition-colors"
                    title="Attach document or medical note"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Audio Voice Note Recorder Button */}
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`p-2.5 rounded-xl transition-all ${
                      isRecording ? 'bg-brick-critical text-paper animate-pulse' : 'text-ink/60 hover:text-ink hover:bg-sage/10'
                    }`}
                    title={isRecording ? 'Click to finish recording voice note' : 'Record voice note'}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Input field */}
                  <div className="flex-1 relative">
                    {isRecording ? (
                      <div className="w-full py-2.5 px-4 bg-brick-critical/10 text-brick-critical rounded-xl text-xs font-bold flex items-center justify-between">
                        <span>Recording voice note... ({recordingSeconds}s)</span>
                        <span className="text-[10px] animate-pulse">Tap mic to save</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Type a secure message (Press Enter to send)..."
                        value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs bg-paper border border-line-border/40 rounded-xl focus:outline-none focus:border-teal-primary"
                      />
                    )}
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={sendingMessage || (!messageText.trim() && !pendingAudio && !pendingAttachment)}
                    className="p-2.5 rounded-xl bg-teal-primary hover:bg-teal-dark text-paper disabled:opacity-40 transition-all shadow-xs cursor-pointer"
                  >
                    {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-ink/40 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-teal-primary/10 flex items-center justify-center text-teal-primary">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-display font-bold text-ink">No Chat Selected</h3>
                <p className="text-xs max-w-sm">Choose an existing conversation from the list or start a new message thread.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
       * TAB 2 CONTENT: BUNDLED ANNOUNCEMENTS
       * ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-ink/50 uppercase tracking-wider">Filter:</span>
              {['all', 'academic', 'sports', 'general'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setAnnFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    annFilter === cat ? 'bg-teal-primary text-paper' : 'bg-paper text-ink/60 border border-line-border/30 hover:bg-sage/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-ink/40 font-mono hidden sm:inline">
                Showing {announcements.length} official broadcast{announcements.length !== 1 ? 's' : ''}
              </span>
              {canPostAnnouncement && (
                <button
                  onClick={() => setShowNewAnnModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-primary hover:bg-teal-dark text-paper rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post Broadcast</span>
                </button>
              )}
            </div>
          </div>

          {annLoading ? (
            <div className="py-20 text-center text-xs text-ink/40">Loading broadcasts...</div>
          ) : announcements.length === 0 ? (
            <div className="glass-card p-12 text-center text-xs text-ink/40 rounded-2xl border border-line-border/30 space-y-2">
              <Megaphone className="w-8 h-8 mx-auto text-ink/20" />
              <p>No active announcements broadcasted at this time.</p>
            </div>
          ) : (
            <CollapsibleList
              items={announcements}
              threshold={10}
              renderItem={(ann, index) => (
                <div
                  key={ann.id || index}
                  className="glass-card p-5 rounded-2xl border border-line-border/30 hover:border-teal-primary/30 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-teal-primary/10 text-teal-primary">
                          {ann.target_audience || 'All School'}
                        </span>
                        <h4 className="text-sm font-bold text-ink font-display">{ann.title}</h4>
                      </div>
                      <p className="text-xs text-ink/70 leading-relaxed mt-2">{ann.content || ann.message || ann.body}</p>
                    </div>
                    <span className="text-[10px] text-ink/40 font-mono shrink-0">
                      {ann.date || ann.created_at ? new Date(ann.date || ann.created_at).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 pt-2 border-t border-line-border/20 text-[10px] text-ink/40">
                    <span>Issued by: <strong className="text-ink/60">{ann.created_by || 'Administration'}</strong></span>
                  </div>
                </div>
              )}
            />
          )}

          {/* New Broadcast Modal */}
          {showNewAnnModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
              <div className="glass-panel w-full max-w-lg bg-paper p-6 rounded-3xl border border-line-border/40 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-line-border/30 pb-3">
                  <div className="flex items-center space-x-2">
                    <Megaphone className="w-5 h-5 text-teal-primary" />
                    <h3 className="font-display font-bold text-lg text-ink">New Broadcast Announcement</h3>
                  </div>
                  <button onClick={() => setShowNewAnnModal(false)} className="text-ink/40 hover:text-ink">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-ink/70">Headline / Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. End of Term Arrangements & Exeat Pickup"
                      value={annForm.title}
                      onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
                      className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink text-xs font-semibold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-ink/70">Target Audience *</label>
                      <select
                        value={annForm.target_audience}
                        onChange={e => setAnnForm({ ...annForm, target_audience: e.target.value })}
                        className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink text-xs"
                      >
                        <option value="all">All School Community</option>
                        <option value="teachers">Staff & Teachers Only</option>
                        <option value="parents">Parents / Guardians Only</option>
                        <option value="students">Students / Specific Class</option>
                      </select>
                    </div>

                    {annForm.target_audience === 'students' && (
                      <div className="space-y-1">
                        <label className="font-bold text-ink/70">Class (Optional)</label>
                        <select
                          value={annForm.class_id}
                          onChange={e => setAnnForm({ ...annForm, class_id: e.target.value })}
                          className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink text-xs"
                        >
                          <option value="">All Classes</option>
                          {annClasses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="font-bold text-ink/70">Expiry Date (Optional)</label>
                      <input
                        type="date"
                        value={annForm.expires_at}
                        onChange={e => setAnnForm({ ...annForm, expires_at: e.target.value })}
                        className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-ink/70">Broadcast Message *</label>
                    <textarea
                      rows={5}
                      placeholder="Write the full announcement message here..."
                      value={annForm.body}
                      onChange={e => setAnnForm({ ...annForm, body: e.target.value })}
                      className="w-full bg-paper border border-line-border rounded-xl p-3 text-ink text-xs"
                      required
                    />
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowNewAnnModal(false)}
                      className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAnn}
                      className="px-5 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold hover:bg-teal-dark cursor-pointer disabled:opacity-50"
                    >
                      {submittingAnn ? 'Publishing...' : 'Publish Broadcast'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
       * TAB 3 CONTENT: SYSTEM ALERTS & NOTIFICATIONS
       * ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              {['all', 'unread', 'fees', 'attendance'].map(f => (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    alertFilter === f ? 'bg-teal-primary text-paper' : 'bg-paper text-ink/60 border border-line-border/30 hover:bg-sage/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              onClick={markAllAlertsRead}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-paper hover:bg-sage/10 border border-line-border/30 text-teal-dark rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
            >
              <CheckCheck className="w-3.5 h-3.5 text-teal-primary" />
              <span>Mark All Read</span>
            </button>
          </div>

          {alertsLoading ? (
            <div className="py-20 text-center text-xs text-ink/40">Loading system alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="glass-card p-12 text-center text-xs text-ink/40 rounded-2xl border border-line-border/30 space-y-2">
              <Bell className="w-8 h-8 mx-auto text-ink/20" />
              <p>You have no notifications or automated alerts.</p>
            </div>
          ) : (
            <CollapsibleList
              items={alerts}
              threshold={10}
              renderItem={(alt, index) => (
                <div
                  key={alt.id || index}
                  onClick={() => !alt.is_read && markAlertRead(alt.id)}
                  className={`glass-card p-4 rounded-xl border transition-all flex items-start justify-between gap-4 cursor-pointer ${
                    !alt.is_read ? 'bg-sage/10 border-teal-primary/30' : 'border-line-border/30 bg-paper/70'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg shrink-0 ${!alt.is_read ? 'bg-teal-primary text-paper' : 'bg-ink/5 text-ink/50'}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ink">{alt.title}</h4>
                      <p className="text-xs text-ink/60 mt-0.5 leading-relaxed">{alt.message}</p>
                      <span className="text-[10px] text-ink/40 font-mono mt-1.5 block">
                        {alt.created_at ? new Date(alt.created_at).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                  {!alt.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-primary shrink-0 mt-1" />
                  )}
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6 relative">
            <button
              onClick={() => setShowNewChatModal(false)}
              className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-[10px] font-bold text-teal-primary uppercase tracking-wider">Secure Dialogue</span>
              <h3 className="text-lg font-display font-bold text-ink mt-0.5">Start New Conversation</h3>
              <p className="text-xs text-ink/50 mt-1">
                You can only message permitted teachers, administrators, or parents linked to your cohort.
              </p>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-ink/70">Select Contact</label>
                {loadingContacts ? (
                  <p className="py-2 text-ink/40 italic">Loading permitted contacts...</p>
                ) : (
                  <select
                    value={selectedContact}
                    onChange={e => setSelectedContact(e.target.value)}
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink font-semibold"
                    required
                  >
                    <option value="">-- Choose recipient --</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.display_name} ({c.role_title || c.role}) {c.context_info ? `— ${c.context_info}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink/70">Topic / Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Academic Progress, Exeat Notice, Consultation"
                  value={newChatSubject}
                  onChange={e => setNewChatSubject(e.target.value)}
                  className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink/70">Initial Message</label>
                <textarea
                  rows={4}
                  placeholder="Write your message..."
                  value={newChatFirstMsg}
                  onChange={e => setNewChatFirstMsg(e.target.value)}
                  className="w-full bg-paper border border-line-border rounded-xl p-3 text-ink"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingChat}
                  className="px-5 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold hover:bg-teal-dark cursor-pointer disabled:opacity-50"
                >
                  {creatingChat ? 'Creating...' : 'Start Conversation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
