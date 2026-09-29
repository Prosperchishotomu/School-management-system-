import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  AlertCircle,
  GraduationCap,
  CreditCard,
  Calendar,
  X,
  Menu
} from 'lucide-react';

/* ── Route → page title mapping ─────────────────────────────────────────────── */
const PAGE_TITLES = {
  '/dashboard':                  'Dashboard',
  '/students':                   'Students',
  '/staff':                      'Staff',
  '/attendance':                 'Attendance',
  '/leave-requests':             'Leave & Absence',
  '/health-records':             'Health Records',
  '/discipline':                 'Discipline',
  '/timetable':                  'Timetable',
  '/announcements':              'Announcements',
  '/classes':                    'Classes & Subjects',
  '/tasks':                      'Lesson Planner',
  '/grades':                     'Grades',
  '/results':                    'Results',
  '/exams':                      'Examinations',
  '/fees':                       'Fees & Finance',
  '/expenses':                   'Expenses',
  '/hostels':                    'Hostels',
  '/assets':                     'Assets',
  '/library':                    'Library',
  '/reporting':                  'Reporting & KPIs',
  '/notifications':              'Notifications',
  '/messages':                   'Messages',
  '/calendar':                   'Calendar',
  '/settings/security':          'Security Settings',
  '/admin/approvals':            'Approval Queue',
  '/user-management':            'User Management',
  '/audit-log':                  'Audit Log',
  '/admin/command-center':       'Command Center',
  '/admin/system-administration':'System Administration',
  '/admin/licenses':             'License Desk',
  '/school-admin/license':       'License Status',
  '/parent-portal':              'Parent Portal',
  '/parent/dashboard':           'Parent Dashboard',
  '/teacher/dashboard':          'Teacher Dashboard',
  '/school-admin/dashboard':     'School Dashboard',
};

/* ── Notification icon resolver ─────────────────────────────────────────────── */
const NotifIcon = ({ type }) => {
  if (type === 'fee' || type === 'payment')
    return <CreditCard className="w-3.5 h-3.5 text-amber-warning" />;
  if (type === 'exam' || type === 'grade')
    return <GraduationCap className="w-3.5 h-3.5 text-teal-primary" />;
  if (type === 'attendance')
    return <Calendar className="w-3.5 h-3.5 text-sky-info" />;
  return <AlertCircle className="w-3.5 h-3.5 text-brick-critical" />;
};

/* ── Relative time helper ────────────────────────────────────────────────────── */
const relTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return d.toLocaleDateString();
};

/* ── Greeting helper ─────────────────────────────────────────────────────────── */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ── Date string helper ──────────────────────────────────────────────────────── */
const getDateString = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
};

/* ── TopBar Component ────────────────────────────────────────────────────────── */
const TopBar = ({ onMenuClick }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif]         = useState(false);
  const themeKey = user?.id || user?.uuid
    ? `schoolbase_theme_${user.id || user.uuid}`
    : 'schoolbase_theme_guest';
  const [darkMode, setDarkMode]           = useState(() => localStorage.getItem('schoolbase_theme_guest') === 'dark');
  const [searchVal, setSearchVal]         = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch]       = useState(false);
  const themeInitialized = useRef(false);

  const notifRef  = useRef(null);
  const searchRef = useRef(null);

  /* fetch notifications */
  const fetchNotifs = () => {
    if (!user) return;
    api.get('/notifications')
      .then(res => { if (res.data) setNotifications(res.data); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 20000);
    return () => clearInterval(t);
  }, [user]);

  /* close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current  && !notifRef.current.contains(e.target))  setShowNotif(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* close search on route change */
  useEffect(() => { setShowSearch(false); setSearchVal(''); }, [location.pathname]);

  /* mark notification read */
  const markRead = (id) => {
    api.post(`/notifications/${id}/read`)
      .then(() => fetchNotifs())
      .catch(() => {});
  };

  const markAllRead = () => {
    api.post('/notifications/read-all')
      .then(() => fetchNotifs())
      .catch(() => {});
  };

  /* live search quicklinks */
  const QUICK_LINKS = [
    { label: 'Students Directory',   path: '/students' },
    { label: 'Staff Roster',         path: '/staff' },
    { label: 'Examinations',         path: '/exams' },
    { label: 'Fees & Finance',       path: '/fees' },
    { label: 'Timetable',            path: '/timetable' },
    { label: 'Attendance Register',  path: '/attendance' },
    { label: 'Reporting & KPIs',     path: '/reporting' },
    { label: 'Library',              path: '/library' },
    { label: 'Grades Sheets',        path: '/grades' },
    { label: 'Results Ledger',       path: '/results' },
  ];

  useEffect(() => {
    if (!searchVal.trim()) { setSearchResults([]); return; }
    const q = searchVal.toLowerCase();
    setSearchResults(
      QUICK_LINKS.filter(l => l.label.toLowerCase().includes(q)).slice(0, 5)
    );
  }, [searchVal]);

  const pane = new URLSearchParams(location.search).get('tab');
  const paneTitle = pane ? pane.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
  const pageTitle  = PAGE_TITLES[location.pathname] || location.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'SchoolBase';
  const displayedTitle = paneTitle ? `${pageTitle} / ${paneTitle}` : pageTitle;
  const breadcrumbItems = location.pathname.split('/').filter(Boolean).map((segment, index, segments) => ({
    label: segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    path: `/${segments.slice(0, index + 1).join('/')}`
  }));
  const unreadCnt  = notifications.filter(n => !n.is_read).length;
  const userName   = user?.name || user?.username || 'User';
  const userRole   = user?.role?.replace(/_/g, ' ') || '';
  const schoolName = user?.school_name || 'SchoolBase';

  useEffect(() => {
    themeInitialized.current = false;
    const savedTheme = localStorage.getItem(themeKey);
    setDarkMode(savedTheme === 'dark');
    document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
  }, [themeKey]);

  useEffect(() => {
    if (!themeInitialized.current) {
      themeInitialized.current = true;
      return;
    }
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem(themeKey, darkMode ? 'dark' : 'light');
  }, [darkMode, themeKey]);

  useEffect(() => {
    document.title = `${displayedTitle} | SchoolBase`;
  }, [displayedTitle]);

  /* user initials for avatar */
  const initials = userName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

  return (
    <header className="topbar h-16 px-4 md:px-6 flex items-center justify-between z-20 sticky top-0">

      {/* ── LEFT: Mobile hamburger + Page title ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg hover:bg-surface text-ink/60 hover:text-ink transition-colors cursor-pointer flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="hidden lg:flex items-center gap-1 text-[10px] text-ink/45 font-sans mb-0.5">
            <Link to="/dashboard" className="hover:text-teal-primary transition-colors">Workspace</Link>
            {breadcrumbItems.map((item, index) => (
              <React.Fragment key={item.path}>
                <ChevronRight className="w-3 h-3 text-ink/25" />
                <Link
                  to={item.path}
                  className={index === breadcrumbItems.length - 1 ? 'text-ink/70 font-semibold' : 'hover:text-teal-primary transition-colors'}
                >
                  {item.label}
                </Link>
              </React.Fragment>
            ))}
          </div>
          <h1 className="text-base font-display font-semibold text-ink truncate">{displayedTitle}</h1>
          <p className="text-[10px] text-ink/45 font-sans hidden sm:block truncate">
            {schoolName}
            {user?.role !== 'super_admin' && ' · '}
            <span className="text-ink/30">{getDateString()}</span>
          </p>
        </div>
      </div>

      {/* ── CENTER: Global Search ── */}
      <div className="flex-1 max-w-md mx-4 md:mx-8 relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students, staff, invoices..."
            value={searchVal}
            onChange={e => { setSearchVal(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-line-border rounded-lg bg-surface text-ink placeholder-ink/35
                       focus:outline-none focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/10 focus:bg-white transition-all"
          />
          {searchVal && (
            <button
              onClick={() => { setSearchVal(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Dropdown */}
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 notif-dropdown overflow-hidden animate-slideDown z-50">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => { navigate(r.path); setShowSearch(false); setSearchVal(''); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-surface transition-colors text-left cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-ink/40 flex-shrink-0" />
                <span className="font-medium">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Controls ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink/50 hover:text-ink hover:bg-surface transition-all cursor-pointer"
          title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={darkMode}
        >
          {darkMode ? <Sun className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /> : <Moon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />}
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-ink/50 hover:text-ink hover:bg-surface transition-all cursor-pointer"
            title="Notifications"
          >
            <Bell style={{ width: 18, height: 18 }} />
            {unreadCnt > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brick-critical rounded-full flex items-center justify-center text-[9px] text-white font-bold px-1 animate-pulse">
                {unreadCnt > 9 ? '9+' : unreadCnt}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 notif-dropdown animate-slideDown z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-line-border">
                <span className="text-sm font-bold text-ink flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-teal-primary" />
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  {unreadCnt > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-teal-primary hover:text-teal-dark font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotif(false)}
                    className="text-ink/40 hover:text-ink cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-line-border/50">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-8 h-8 text-ink/20 mx-auto mb-2" />
                    <p className="text-xs text-ink/40 font-sans">No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.is_read) markRead(n.id); }}
                      className={`px-4 py-3 cursor-pointer transition-colors hover:bg-surface
                        ${!n.is_read ? 'bg-teal-muted/20' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                          ${!n.is_read ? 'bg-teal-muted' : 'bg-surface'}`}>
                          <NotifIcon type={n.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug ${!n.is_read ? 'font-semibold text-ink' : 'text-ink/70'}`}>
                            {n.title || n.message}
                          </p>
                          {n.title && n.message && (
                            <p className="text-[10px] text-ink/50 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-2.5 h-2.5 text-ink/30" />
                            <span className="text-[9px] text-ink/35 font-mono">{relTime(n.created_at)}</span>
                            {!n.is_read && (
                              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-teal-primary inline-block" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-line-border bg-surface/50">
                  <button
                    onClick={() => { setShowNotif(false); navigate('/notifications'); }}
                    className="text-xs text-teal-primary hover:text-teal-dark font-semibold cursor-pointer transition-colors w-full text-center"
                  >
                    View all notifications →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Avatar Pill */}
        <div className="flex items-center gap-2 ml-1 pl-2 border-l border-line-border">
          {/* Avatar circle */}
          <div className="w-8 h-8 rounded-full bg-teal-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
            {initials || 'U'}
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-xs font-semibold text-ink truncate max-w-[100px]">{userName}</p>
            <p className="text-[9px] text-ink/45 capitalize truncate max-w-[100px]">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
