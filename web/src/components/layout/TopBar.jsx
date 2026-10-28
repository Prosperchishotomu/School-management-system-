import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { subscribeWsStatus } from '../../data/apiHooks';
import Avatar from '../ui/Avatar';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  CheckCircle,
  Wifi,
  WifiOff,
  ChevronDown,
  LogOut,
  School,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Users,
  GraduationCap,
  CalendarCheck,
  Award,
  Layers,
  X
} from 'lucide-react';
import { getCurrentTerm } from '../../utils/dateTerms';

const PAGE_META = {
  '/dashboard':            { title: 'Dashboard', subtitle: 'Real-time school performance & operational pulse' },
  '/students':             { title: 'Student Directory', subtitle: 'Enrolled learners, admission registers & status' },
  '/staff':                { title: 'Staff Roster', subtitle: 'Academic faculty, departments & teaching loads' },
  '/classes':              { title: 'Classes & Subjects', subtitle: 'Stream capacities, subject matrices & allocations' },
  '/attendance':           { title: 'Attendance Register', subtitle: 'Daily class rolls, absence alerts & termly rates' },
  '/grades':               { title: 'Gradebook', subtitle: 'Continuous assessments, test scores & coursework weighting' },
  '/results':              { title: 'Results & Report Cards', subtitle: 'Examination broadsheets & printable official reports' },
  '/exams':                { title: 'Examinations', subtitle: 'Timetables, mock sessions & assessment schedules' },
  '/fees':                 { title: 'Fees & Cashier Desk', subtitle: 'Multi-currency invoicing, cashier desk & receipts' },
  '/expenses':             { title: 'Operating Expenses', subtitle: 'School expense tracking, budget variances & vouchers' },
  '/hostels':              { title: 'Hostels & Residences', subtitle: 'Boarding room allocations & hostel occupancy' },
  '/boarding/exeats':      { title: 'Exeat Gate Board', subtitle: 'Student gate passes, checkout status & reconciliation' },
  '/health-records':       { title: 'Health & Wellness', subtitle: 'Clinic visits, medical conditions & incident logs' },
  '/discipline':           { title: 'Conduct & Support', subtitle: 'Disciplinary incidents, merits & intervention logs' },
  '/leave-requests':       { title: 'Leave & Absence', subtitle: 'Staff leave applications & medical absence notices' },
  '/library':              { title: 'Library Catalog', subtitle: 'Book inventory, textbook loans & overdue tracking' },
  '/assets':               { title: 'Asset Registry', subtitle: 'School equipment, facility inventory & depreciation' },
  '/timetable':            { title: 'Master Timetable', subtitle: 'Weekly schedules, period allocations & room matrices' },
  '/notifications':        { title: 'Communication Hub', subtitle: 'Real-time messages, urgent alerts & announcements' },
  '/admin/command-center': { title: 'Command Center', subtitle: 'Multi-school governance, platform telemetry & health' },
  '/reports/emis':         { title: 'EMIS Statutory Returns', subtitle: 'Ministry statistical enumeration & SHA-256 snapshots' },
  '/school-admin/license': { title: 'License Status', subtitle: 'Subscription quota, student cap & renewal requests' },
  '/profile':              { title: 'My Profile & Account', subtitle: 'Personal credentials, avatar picture & account security' },
};

export default function TopBar({ onMenuClick }) {
  const { user, activeSchoolId, schoolName, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('schoolbase_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const [wsStatus, setWsStatus] = useState('connected');

  // Outside click for in-place search dropdown
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    if (isSearchOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isSearchOpen]);

  // Global search keyboard shortcuts: Ctrl+K / Cmd+K to focus in-place search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered in-place destinations
  const filteredSearchItems = useMemo(() => {
    const allDestinations = [
      { title: 'Dashboard', path: '/dashboard', category: 'Navigation', icon: Award, desc: 'Operational overview & pulse' },
      { title: 'Student Directory', path: '/students', category: 'Academics', icon: GraduationCap, desc: 'Learner roster & admission numbers' },
      { title: 'Staff Roster', path: '/staff', category: 'Human Resources', icon: Users, desc: 'Academic faculty & teachers' },
      { title: 'Classes & Subjects', path: '/classes', category: 'Academics', icon: Layers, desc: 'Grade streams, capacities & syllabus' },
      { title: 'Attendance Register', path: '/attendance', category: 'Academics', icon: CheckCircle, desc: 'Daily class rolls & alerts' },
      { title: 'Gradebook', path: '/grades', category: 'Academics', icon: BookOpen, desc: 'Continuous assessment & tests' },
      { title: 'Results & Broadsheets', path: '/results', category: 'Academics', icon: Award, desc: 'Terminal examination transcripts' },
      { title: 'Master Timetable', path: '/timetable', category: 'Academics', icon: CalendarCheck, desc: 'Weekly period allocations & room slots' },
      { title: 'Schemes of Work', path: '/schemes', category: 'Academics', icon: BookOpen, desc: 'Weekly curriculum coverage & HOD review' },
      { title: 'Examinations', path: '/exams', category: 'Academics', icon: BookOpen, desc: 'National ZIMSEC exam sessions & entries' },
      { title: 'Fees & Invoicing', path: '/fees', category: 'Finance', icon: School, desc: 'Multi-currency invoicing & cashier receipts' },
      { title: 'Operating Expenses', path: '/expenses', category: 'Finance', icon: School, desc: 'School expense tracking & vouchers' },
      { title: 'Hostels & Residences', path: '/hostels', category: 'Operations', icon: School, desc: 'Boarding room allocations & beds' },
      { title: 'Exeat Gate Board', path: '/boarding/exeats', category: 'Operations', icon: CheckCircle, desc: 'Student gate passes & checkout' },
      { title: 'Health Records', path: '/health-records', category: 'Support', icon: CheckCircle, desc: 'Clinic visits & medical conditions' },
      { title: 'Conduct & Support', path: '/discipline', category: 'Support', icon: CheckCircle, desc: 'Disciplinary incidents & interventions' },
      { title: 'Staff Leave', path: '/leave-requests', category: 'Human Resources', icon: Users, desc: 'Staff leave applications & notices' },
      { title: 'Library Catalog', path: '/library', category: 'Operations', icon: BookOpen, desc: 'Book inventory & textbook loans' },
      { title: 'Asset Registry', path: '/assets', category: 'Operations', icon: Layers, desc: 'Equipment & facility inventory' },
      { title: 'EMIS Statutory Returns', path: '/reports/emis', category: 'Statutory', icon: School, desc: 'Ministry returns & census ED461' },
      { title: 'Communication Hub', path: '/notifications', category: 'Communication', icon: Bell, desc: 'Messages & announcements' },
      { title: 'My Profile & Account', path: '/profile', category: 'Account', icon: Users, desc: 'Credentials & preferences' }
    ];

    if (!searchQuery.trim()) return allDestinations.slice(0, 7);
    const q = searchQuery.toLowerCase().trim();
    return allDestinations.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // WebSocket status subscription
  useEffect(() => {
    const unsub = subscribeWsStatus((status) => {
      setWsStatus(status);
    });
    return unsub;
  }, []);

  // Theme switcher
  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        localStorage.setItem('schoolbase_theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.remove('dark');
        localStorage.setItem('schoolbase_theme', 'light');
      }
    } catch (err) {
      console.warn('Could not persist theme:', err);
    }
  }, [isDark]);

  // Notifications poll
  const fetchNotifications = () => {
    if (!user || !sessionStorage.getItem('schoolbase_token')) return;
    if (user.role === 'super_admin' && !activeSchoolId) {
      setNotifications([]);
      return;
    }
    api.get('/notifications', { silent: true })
      .then(res => {
        if (res?.data && Array.isArray(res.data)) {
          setNotifications(res.data.slice(0, 5));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [user, activeSchoolId]);

  // Outside click for notif dropdown
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isNotifOpen]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = () => {
    api.post('/notifications/read-all')
      .then(() => fetchNotifications())
      .catch(() => {});
  };

  const currentTerm = getCurrentTerm();
  const displaySchool = schoolName || user?.school_name || '';

  // Resolve current route meta
  const meta = PAGE_META[location.pathname] || {
    title: 'SchoolBase',
    subtitle: `${displaySchool ? displaySchool + ' • ' : ''}${currentTerm.label}`
  };

  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <>
      <header className="sticky top-0 z-30 h-16 shrink-0 bg-surface/90 backdrop-blur-md border-b border-line px-4 md:px-8 flex items-center justify-between gap-4 select-none">
        {/* Left: Mobile hamburger + Dedicated Back Button + Page Context */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open sidebar navigation"
            className="lg:hidden p-2 text-muted hover:text-ink rounded-lg hover:bg-canvas cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Dedicated Back Navigation Button */}
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/dashboard');
              }
            }}
            aria-label="Go back to previous page"
            title="Go back to previous page"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-canvas text-ink text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-muted" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="truncate">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-base md:text-lg text-ink truncate leading-tight">
                {meta.title}
              </h2>

              {/* WebSocket status dot */}
              <span
                title={wsStatus === 'connected' ? 'Real-time WebSocket Live' : 'WebSocket Reconnecting…'}
                className="inline-flex items-center"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === 'connected' ? 'bg-brand-500 animate-pulse' : 'bg-accent'
                  }`}
                />
              </span>
            </div>

            <p className="text-[11px] text-muted hidden sm:flex items-center gap-1.5 truncate mt-0.5">
              {displaySchool && (
                <>
                  <span className="font-semibold text-ink/90">{displaySchool}</span>
                  <span className="text-muted/60">•</span>
                </>
              )}
              <span className="font-medium text-brand-600 dark:text-brand-400">{currentTerm.label}</span>
              <span className="text-muted/60">•</span>
              <span>{todayStr}</span>
            </p>
          </div>
        </div>

        {/* Right: In-Place Search, Notifications, Theme, User */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {displaySchool && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-700 dark:text-brand-300 text-xs font-semibold">
              <School className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span className="truncate max-w-[220px]">{displaySchool}</span>
            </div>
          )}

          {/* In-Place Search Bar (stays in position, never opens a separate modal form) */}
          <div ref={searchRef} className="relative">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line bg-canvas/60 focus-within:bg-surface focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 text-xs transition-all w-36 sm:w-56 md:w-64">
              <Search className="w-3.5 h-3.5 text-muted shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search in place..."
                className="w-full bg-transparent text-ink placeholder:text-muted focus:outline-hidden text-xs font-medium"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="text-muted hover:text-ink text-xs font-bold shrink-0"
                >
                  ✕
                </button>
              ) : (
                <kbd className="hidden md:inline-block font-mono text-[9px] bg-line/80 px-1 py-0.5 rounded text-muted shrink-0">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* In-Place Dropdown - Opens directly anchored underneath the search input! */}
            {isSearchOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 md:w-96 rounded-2xl bg-surface border border-line shadow-2xl p-2 z-50 animate-slideUp max-h-96 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-muted border-b border-line mb-1 flex items-center justify-between">
                  <span>Quick Navigation</span>
                  <span>{filteredSearchItems.length} destinations</span>
                </div>
                {filteredSearchItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">
                    No matching destinations found for "{searchQuery}".
                  </div>
                ) : (
                  filteredSearchItems.map(item => {
                    const IconComp = item.icon || School;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-canvas transition-colors cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-ink truncate group-hover:text-brand-700 dark:group-hover:text-brand-300">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-muted truncate">
                            {item.desc}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-canvas border border-line text-muted">
                          {item.category}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setIsDark(d => !d)}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-canvas transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notification Bell Dropdown */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen(o => !o)}
              aria-label="Open notifications"
              className="relative p-2 rounded-xl text-muted hover:text-ink hover:bg-canvas transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" />
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-surface border border-line shadow-2xl p-4 z-50 animate-slideUp">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                  <span className="font-display font-bold text-xs text-ink">
                    Notifications {unreadCount > 0 && `(${unreadCount})`}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] font-semibold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-center text-xs text-muted py-6">No recent alerts.</p>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-2 rounded-xl text-xs flex items-start gap-2.5 transition-colors ${
                          !n.is_read ? 'bg-brand-50/60 dark:bg-brand-950/30 font-medium' : 'hover:bg-canvas'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!n.is_read ? 'bg-brand-500' : 'bg-transparent'}`} />
                        <div className="flex-1 truncate">
                          <div className="text-xs text-ink truncate font-semibold">{n.title}</div>
                          <p className="text-[11px] text-muted line-clamp-2 leading-relaxed mt-0.5">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 mt-2 border-t border-line text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline"
                  >
                    View communication hub →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Chip & Fast Sign Out */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-line">
            <Link
              to="/profile"
              title="Manage Profile & Photo"
              className="flex items-center gap-2 p-1 -m-1 rounded-xl hover:bg-canvas transition-colors cursor-pointer group"
            >
              <Avatar name={user?.name || user?.username} src={user?.avatar_url} size="sm" />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-ink leading-none group-hover:text-brand-600 transition-colors">
                  {user?.name || user?.username}
                </div>
                <div className="text-[10px] text-muted capitalize font-mono mt-0.5">
                  {(user?.role || '').replace('_', ' ')}
                </div>
              </div>
            </Link>
            <button
              onClick={() => logout()}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
