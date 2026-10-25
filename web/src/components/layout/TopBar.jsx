import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { subscribeWsStatus } from '../../data/apiHooks';
import CommandPalette from '../ui/CommandPalette';
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
  LogOut
} from 'lucide-react';

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
};

export default function TopBar({ onMenuClick }) {
  const { user, activeSchoolId, logout } = useAuth();
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('schoolbase_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const [wsStatus, setWsStatus] = useState('connected');

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

  // Resolve current route meta
  const meta = PAGE_META[location.pathname] || {
    title: 'SchoolBase',
    subtitle: 'Harare Academy & College • Term 1, 2026'
  };

  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-surface/90 backdrop-blur-md border-b border-line px-4 md:px-8 flex items-center justify-between gap-4 select-none">
        {/* Left: Mobile hamburger + Page Context */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open sidebar navigation"
            className="lg:hidden p-2 text-muted hover:text-ink rounded-lg hover:bg-canvas cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
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

            <p className="text-[11px] text-muted hidden sm:block truncate mt-0.5">
              Harare Academy & College • Term 1, 2026 • {todayStr}
            </p>
          </div>
        </div>

        {/* Right: Search, Notifications, Theme, User */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Global search trigger */}
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line bg-canvas/60 hover:bg-canvas text-muted hover:text-ink text-xs transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-muted shrink-0" />
            <span className="hidden md:inline">Search (Ctrl+K)</span>
            <kbd className="hidden md:inline-block font-mono text-[10px] bg-line/80 px-1 py-0.2 rounded text-muted">
              ⌘K
            </kbd>
          </button>

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
          <div className="flex items-center gap-2 pl-2 border-l border-line">
            <Avatar name={user?.name || user?.username} size="sm" />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-ink leading-none">
                {user?.name || user?.username}
              </div>
              <div className="text-[10px] text-muted capitalize font-mono mt-0.5">
                {(user?.role || '').replace('_', ' ')}
              </div>
            </div>
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

      {/* Command Palette Modal */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </>
  );
}
