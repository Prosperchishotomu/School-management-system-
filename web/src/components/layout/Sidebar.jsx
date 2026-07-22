import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  GraduationCap,
  FileText,
  CreditCard,
  UserCheck,
  AlertTriangle,
  FileLock,
  ShieldCheck,
  HardDrive,
  LogOut,
  ChevronDown,
  ClipboardList,
  HeartPulse,
  Calendar,
  BookOpen,
  Megaphone,
  Grid3X3,
  KeyRound,
  FileBarChart2,
  Bell,
  Loader2,
  X,
  Package,
  Building2,
  DollarSign,
  Settings
} from 'lucide-react';


const Sidebar = ({ isOpen, onClose }) => {
  const { user, activeSchoolId, changeActiveSchool, logout } = useAuth();
  const [schools, setSchools] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch schools for super_admin switcher
  useEffect(() => {
    if (user?.role === 'super_admin') {
      api.get('/schools')
        .then(res => {
          if (res.data) setSchools(res.data);
        })
        .catch(err => console.error('Error fetching schools:', err));
    }
  }, [user]);

  const fetchAlerts = () => {
    if (!user) return;
    api.get('/notifications')
      .then(res => {
        if (res.data) setNotifications(res.data);
      })
      .catch(err => console.error('Alerts poll error:', err));
  };
  
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = (id) => {
    api.post(`/notifications/${id}/read`)
      .then(() => fetchAlerts())
      .catch(err => console.error(err));
  };

  const markAllRead = () => {
    api.post('/notifications/read-all')
      .then(() => fetchAlerts())
      .catch(err => console.error(err));
  };

  // Determine navigation menu items based on role
  const getNavLinks = () => {
    if (user?.role === 'super_admin') {
      const adminItems = [
        { path: '/admin/command-center', label: 'Command Center', icon: HardDrive },
        { path: '/admin/system-administration', label: 'System Administration', icon: Settings },
        { path: '/admin/licenses', label: 'License Desk', icon: FileLock },
        { path: '/admin/alerts', label: 'System Alerts', icon: AlertTriangle },
        { path: '/reporting', label: 'Reporting & KPIs', icon: FileBarChart2 },
        { path: '/audit-log', label: 'Platform Audits', icon: ShieldCheck }
      ];
      if (activeSchoolId) {
        // Allow super admin to control all school aspects
        const schoolItems = [
          { path: '/dashboard', label: 'School Dashboard', icon: LayoutDashboard },
          { path: '/tasks', label: 'Lesson Planner', icon: Calendar },
          { path: '/classes', label: 'Classes & Assignments', icon: Grid3X3 },
          { path: '/leave-requests', label: 'Absence & Leave', icon: CalendarCheck },
          { path: '/students', label: 'Students Roster', icon: Users },
          { path: '/attendance', label: 'Attendance Check', icon: CalendarCheck },
          { path: '/timetable', label: 'School Timetable', icon: Grid3X3 },
          { path: '/announcements', label: 'Announcements', icon: Megaphone },
          { path: '/grades', label: 'Grades Sheets', icon: GraduationCap },
          { path: '/results', label: 'Results Ledger', icon: FileText },
          { path: '/health-records', label: 'Health Files', icon: HeartPulse },
          { path: '/exams', label: 'Exams Scheduling', icon: Calendar },
          { path: '/fees', label: 'Fees & Payments', icon: CreditCard },
          { path: '/expenses', label: 'OpEx Expenses', icon: DollarSign },
          { path: '/hostels', label: 'Hostels & Housing', icon: Building2 },
          { path: '/library', label: 'Library Catalog', icon: BookOpen },
          { path: '/assets', label: 'Asset Register', icon: Package },
          { path: '/staff', label: 'Staff Roster', icon: UserCheck },
          { path: '/enquiries', label: 'Admissions Pipeline', icon: ClipboardList },
          { path: '/discipline', label: 'Discipline Log', icon: AlertTriangle },
          { path: '/user-management', label: 'User Logins', icon: KeyRound },
          { path: '/notifications', label: 'SMS & Alerts', icon: Bell }
        ];
        const uniquePaths = new Set(adminItems.map(item => item.path));
        schoolItems.forEach(item => {
          if (!uniquePaths.has(item.path)) {
            adminItems.push(item);
          }
        });
      }
      return adminItems;
    }

    // Standard school scope nav links
    let items = [];
    if (user?.role === 'parent') {
      items = [
        { path: '/parent-portal', label: 'Parent Portal', icon: LayoutDashboard },
        { path: '/leave-requests', label: 'Absence Notices', icon: CalendarCheck },
        { path: '/results', label: 'Report Cards', icon: FileText },
        { path: '/fees', label: 'Fees & Payments', icon: CreditCard },
        { path: '/timetable', label: 'Timetable', icon: Grid3X3 },
        { path: '/announcements', label: 'Announcements', icon: Megaphone }
      ];
    } else {
      items = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/students', label: 'Students', icon: Users },
        { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
        { path: '/timetable', label: 'Timetable', icon: Grid3X3 },
        { path: '/announcements', label: 'Announcements', icon: Megaphone }
      ];

      if (user?.role === 'school_admin' || user?.role === 'teacher') {
        items.push(
          { path: '/tasks', label: 'Lesson Planner', icon: Calendar },
          { path: '/leave-requests', label: 'Leave Requests', icon: CalendarCheck },
          { path: '/grades', label: 'Grades Sheets', icon: GraduationCap },
          { path: '/results', label: 'Results Ledger', icon: FileText },
          { path: '/health-records', label: 'Health Records', icon: HeartPulse },
          { path: '/exams', label: 'Exams Scheduling', icon: Calendar }
        );
      }
    }

    // Library accessible to everyone
    items.push(
      { path: '/library', label: 'Library Catalog', icon: BookOpen }
    );

    // Assets & heavy admin panels
    if (user?.role === 'school_admin') {
      items.push(
        { path: '/classes', label: 'Classes & Assignments', icon: Grid3X3 },
        { path: '/fees', label: 'Fees & Billing', icon: CreditCard },
        { path: '/expenses', label: 'OpEx Expenses', icon: DollarSign },
        { path: '/hostels', label: 'Hostels & Housing', icon: Building2 },
        { path: '/assets', label: 'Asset Register', icon: Package },
        { path: '/staff', label: 'Staff Roster', icon: UserCheck },
        { path: '/enquiries', label: 'Admissions Pipeline', icon: ClipboardList },
        { path: '/discipline', label: 'Discipline Log', icon: AlertTriangle },
        { path: '/reporting', label: 'Reporting & KPIs', icon: FileBarChart2 },
        { path: '/school-admin/license', label: 'License Status', icon: FileLock }
      );
    }

    return items;
  };

  const navLinks = getNavLinks();

  const [showChangePass, setShowChangePass] = useState(false);
  const [passForm, setPassForm]             = useState({ current: '', new: '', confirm: '' });
  const [passErr, setPassErr]               = useState('');
  const [passSuccess, setPassSuccess]       = useState('');
  const [passSaving, setPassSaving]         = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassErr(''); setPassSuccess('');
    if (passForm.new !== passForm.confirm) {
      setPassErr('New passwords do not match.');
      return;
    }
    if (passForm.new.length < 8) {
      setPassErr('New password must be at least 8 characters.');
      return;
    }
    setPassSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: passForm.current,
        new_password: passForm.new
      });
      setPassSuccess('Password successfully updated!');
      setPassForm({ current: '', new: '', confirm: '' });
      setTimeout(() => { setShowChangePass(false); setPassSuccess(''); }, 2000);
    } catch (err) {
      setPassErr(err.message || 'Failed to change password. Double check current password.');
    } finally {
      setPassSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-25"
        />
      )}

      <aside className={`w-64 h-screen fixed left-0 top-0 text-paper z-30 flex flex-col justify-between p-6 glass-sidebar transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Logo */}
          <div className="flex items-center justify-between mb-6 border-b border-paper/10 pb-6 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-primary/20 flex items-center justify-center border border-teal-primary/30">
                <ShieldCheck className="w-5 h-5 text-teal-primary" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold tracking-tight">
                  School<span className="text-teal-primary">Base</span>
                </h1>
                <span className="text-[10px] text-paper/40 font-mono tracking-widest uppercase">v1.0.0</span>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="md:hidden p-1.5 hover:bg-paper/5 rounded-lg text-paper/60 hover:text-paper cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {user?.role !== 'super_admin' && user?.school_name && (
            <div className="mb-6 bg-paper/5 border border-paper/10 rounded-xl p-3 flex-shrink-0 text-left">
              <span className="block text-[8px] font-sans font-bold text-paper/40 uppercase tracking-wider mb-1">
                Linked School Tenant
              </span>
              <p className="text-xs font-bold text-teal-primary truncate animate-fadeIn" title={user.school_name}>
                {user.school_name}
              </p>
            </div>
          )}

        {/* Super Admin School Switcher */}
        {user?.role === 'super_admin' && (
          <div className="mb-6 bg-paper/5 border border-paper/10 rounded-xl p-3 flex-shrink-0">
            <label className="block text-[10px] font-sans font-bold text-paper/50 uppercase tracking-wider mb-2">
              Viewing School Tenant
            </label>
            <div className="relative">
              <select
                value={activeSchoolId || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  changeActiveSchool(val);
                  if (val) {
                    window.location.replace('/dashboard');
                  } else {
                    window.location.replace('/admin/command-center');
                  }
                }}
                className="w-full bg-ink border border-paper/15 text-paper text-xs font-sans rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-teal-primary"
              >
                <option value="">Platform Overview</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-paper/40 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Navigation Items — Scrollable */}
        <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-sans font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-teal-primary text-paper shadow-md shadow-teal-primary/10'
                      : 'text-paper/60 hover:text-paper hover:bg-paper/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="border-t border-paper/10 pt-6 mt-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-xs font-semibold text-paper/90 truncate">{user?.username}</p>
            <p className="text-[10px] text-paper/40 font-mono uppercase tracking-wider">{user?.role?.replace('_', ' ')}</p>
          </div>
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-8 h-8 rounded-lg bg-paper/10 hover:bg-paper/20 text-paper flex items-center justify-center transition-all cursor-pointer"
                title="View Notifications"
              >
                <Bell className="w-4 h-4 text-paper/85" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brick-critical rounded-full flex items-center justify-center text-[8px] text-paper font-bold animate-pulse">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>

              {/* Dropdown panel */}
              {showNotifications && (
                <div className="absolute left-0 bottom-full mb-3 w-72 bg-paper text-ink rounded-xl border border-line-border/30 shadow-2xl p-4 z-50 space-y-3 font-sans text-xs">
                  <div className="flex justify-between items-center border-b border-line-border/30 pb-2">
                    <span className="font-bold text-ink/80 flex items-center space-x-1">
                      <Bell className="w-3.5 h-3.5 text-teal-primary" />
                      <span>Real-Time Notifications</span>
                    </span>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <button 
                        onClick={markAllRead} 
                        className="text-[10px] text-teal-primary hover:text-teal-dark font-semibold cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-line-border/10">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                        className={`pt-2 flex flex-col space-y-0.5 cursor-pointer hover:bg-sage/5 p-1.5 rounded transition-all ${!n.is_read ? 'font-semibold bg-sage/5' : ''}`}
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <span className={`${!n.is_read ? 'text-teal-primary font-bold' : 'text-ink/60'}`}>{n.title}</span>
                          {!n.is_read && <span className="w-1.5 h-1.5 bg-teal-primary rounded-full"></span>}
                        </div>
                        <p className="text-[10px] text-ink/75 leading-relaxed">{n.message}</p>
                        <span className="text-[8px] text-ink/40 font-mono mt-1 block">{n.created_at}</span>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-center text-ink/50 text-[11px] py-6">No unread alerts found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { setShowChangePass(true); setPassErr(''); setPassSuccess(''); }}
              className="w-8 h-8 rounded-lg bg-paper/10 hover:bg-paper/20 text-paper flex items-center justify-center transition-all cursor-pointer"
              title="Change Password"
            >
              <KeyRound className="w-4 h-4 text-paper/85" />
            </button>
            <button
              onClick={logout}
              className="w-8 h-8 rounded-lg bg-brick-critical/10 hover:bg-brick-critical/20 text-brick-critical flex items-center justify-center transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal Overlay */}
      {showChangePass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-paper text-ink rounded-2xl shadow-2xl border border-line-border/30 p-6 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-line-border/30 pb-3 mb-4">
              <h3 className="text-sm font-sans font-bold flex items-center space-x-1.5">
                <KeyRound className="w-4 h-4 text-teal-primary" />
                <span>Update Account Password</span>
              </h3>
              <button
                onClick={() => setShowChangePass(false)}
                className="w-6 h-6 rounded-lg hover:bg-sage/10 flex items-center justify-center text-ink/50 hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passErr && (
              <div className="mb-4 p-2.5 bg-brick-critical/10 border border-brick-critical/25 text-brick-critical text-[11px] rounded-lg">
                {passErr}
              </div>
            )}

            {passSuccess && (
              <div className="mb-4 p-2.5 bg-sage/35 border border-teal-primary/25 text-teal-dark text-[11px] font-semibold rounded-lg">
                {passSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-ink/65 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full glass-input rounded-xl text-xs"
                  value={passForm.current}
                  onChange={e => setPassForm({ ...passForm, current: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink/65 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 8 chars"
                  className="w-full glass-input rounded-xl text-xs"
                  value={passForm.new}
                  onChange={e => setPassForm({ ...passForm, new: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink/65 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full glass-input rounded-xl text-xs"
                  value={passForm.confirm}
                  onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePass(false)}
                  className="px-3.5 py-2 border border-line-border rounded-xl text-[11px] text-ink/60 hover:bg-sage/10 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passSaving}
                  className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper font-semibold rounded-xl text-[11px] cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {passSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  </>
);
};

export default Sidebar;
