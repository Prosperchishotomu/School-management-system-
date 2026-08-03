import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Settings,
  Eye,
  EyeOff
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

  // Structured, role-based navigation groups organized by domain functionality
  const getGroupedNavLinks = () => {
    const role = user?.role;
    
    // Category 1: Main Overview
    const overviewItems = role === 'parent' 
      ? [{ path: '/parent-portal', label: 'Parent Portal', icon: LayoutDashboard }]
      : [{ path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];
    overviewItems.push({ path: '/notifications', label: 'Notifications & Feed', icon: Bell });

    // Category 2: People Directory (Students, Staff, Parents/Guardians, Admissions, Users)
    const peopleItems = [];
    if (role !== 'parent') {
      peopleItems.push({ path: '/students', label: 'Students Directory', icon: Users });
    }
    if (role === 'school_admin' || role === 'super_admin') {
      peopleItems.push({ path: '/staff', label: 'Staff Roster', icon: UserCheck });
      if (role === 'super_admin') {
        peopleItems.push({ path: '/user-management', label: 'User Logins', icon: KeyRound });
      }
    }

    // Category 3: School Activities & Operations (Attendance, Absence, Discipline, Health, Timetable, Announcements)
    const operationsItems = [];
    if (role !== 'parent') {
      operationsItems.push({ path: '/attendance', label: 'Attendance Check', icon: CalendarCheck });
      operationsItems.push({ path: '/leave-requests', label: 'Absence & Leave', icon: CalendarCheck });
    } else {
      operationsItems.push({ path: '/leave-requests', label: 'Absence Notices', icon: CalendarCheck });
    }
    if (role === 'school_admin' || role === 'teacher' || role === 'super_admin') {
      operationsItems.push({ path: '/health-records', label: 'Health Files', icon: HeartPulse });
      operationsItems.push({ path: '/discipline', label: 'Discipline Log', icon: AlertTriangle });
    }
    operationsItems.push({ path: '/timetable', label: 'School Timetable', icon: Grid3X3 });
    operationsItems.push({ path: '/announcements', label: 'Announcements', icon: Megaphone });

    // Category 4: Academics & Curriculum (Classes, Subjects, Lesson Planner, Grades, Results, Exams)
    const academicItems = [];
    if (role === 'school_admin' || role === 'super_admin') {
      academicItems.push({ path: '/classes', label: 'Classes & Subjects', icon: Grid3X3 });
    }
    if (role === 'teacher' || role === 'school_admin' || role === 'super_admin') {
      academicItems.push({ path: '/tasks', label: 'Lesson Planner', icon: Calendar });
      academicItems.push({ path: '/grades', label: 'Grades Sheets', icon: GraduationCap });
      academicItems.push({ path: '/results', label: 'Results Ledger', icon: FileText });
      academicItems.push({ path: '/exams', label: 'Exams Scheduling', icon: Calendar });
    }
    if (role === 'parent') {
      academicItems.push({ path: '/results', label: 'Report Cards', icon: FileText });
    }

    // Category 5: Fees & Finance (Fees, Expenses)
    const financeItems = [];
    if (role === 'school_admin' || role === 'super_admin') {
      financeItems.push({ path: '/fees', label: 'Fees & Billing', icon: CreditCard });
      financeItems.push({ path: '/expenses', label: 'OpEx Expenses', icon: DollarSign });
    } else if (role === 'parent') {
      financeItems.push({ path: '/fees', label: 'Fees & Payments', icon: CreditCard });
    }

    // Category 6: Campus & Resources (Hostels, Assets, Library)
    const facilityItems = [];
    if (role === 'school_admin' || role === 'super_admin') {
      facilityItems.push({ path: '/hostels', label: 'Hostels & Housing', icon: Building2 });
      facilityItems.push({ path: '/assets', label: 'Asset Register', icon: Package });
    }
    facilityItems.push({ path: '/library', label: 'Library Catalog', icon: BookOpen });

    // Category 7: Governance & Reports
    const governanceItems = [];
    if (role === 'super_admin') {
      governanceItems.push({ path: '/admin/command-center', label: 'Command Center', icon: HardDrive });
      governanceItems.push({ path: '/admin/system-administration', label: 'System Administration', icon: Settings });
      governanceItems.push({ path: '/admin/licenses', label: 'License Desk', icon: FileLock });
      governanceItems.push({ path: '/admin/alerts', label: 'System Alerts', icon: AlertTriangle });
      governanceItems.push({ path: '/audit-log', label: 'Platform Audits', icon: ShieldCheck });
    }
    if (role === 'school_admin' || role === 'super_admin') {
      governanceItems.push({ path: '/reporting', label: 'Reporting & KPIs', icon: FileBarChart2 });
      governanceItems.push({ path: '/school-admin/license', label: 'License Status', icon: FileLock });
    }

    const groups = [
      { id: 'overview', title: 'Main Overview', items: overviewItems }
    ];

    if (peopleItems.length > 0) groups.push({ id: 'people', title: 'People & Directory', items: peopleItems });
    if (operationsItems.length > 0) groups.push({ id: 'operations', title: 'Activities & Operations', items: operationsItems });
    if (academicItems.length > 0) groups.push({ id: 'academics', title: 'Academics & Curriculum', items: academicItems });
    if (financeItems.length > 0) groups.push({ id: 'finance', title: 'Fees & Finance', items: financeItems });
    if (facilityItems.length > 0) groups.push({ id: 'facilities', title: 'Campus & Resources', items: facilityItems });
    if (governanceItems.length > 0) groups.push({ id: 'governance', title: 'Governance & Reports', items: governanceItems });

    return groups;
  };

  const location = useLocation();
  const navGroups = getGroupedNavLinks();

  // Accordion state for expandable categories
  const [expandedGroups, setExpandedGroups] = useState({
    overview: true,
    people: true,
    operations: true,
    academics: true,
    finance: true,
    facilities: false,
    governance: false
  });

  // Auto-expand group containing current route path
  useEffect(() => {
    const currentPath = location.pathname;
    navGroups.forEach(g => {
      if (g.items.some(item => item.path === currentPath)) {
        setExpandedGroups(prev => ({ ...prev, [g.id]: true }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const [showChangePass, setShowChangePass] = useState(false);
  const [passForm, setPassForm]             = useState({ current: '', new: '', confirm: '' });
  const [passErr, setPassErr]               = useState('');
  const [passSuccess, setPassSuccess]       = useState('');
  const [passSaving, setPassSaving]         = useState(false);
  const [showPassVals, setShowPassVals]     = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassErr(''); setPassSuccess('');
    if (passForm.new !== passForm.confirm) {
      setPassErr('New passwords do not match.');
      return;
    }
    if (passForm.new.length < 6) {
      setPassErr('Password must be at least 6 characters.');
      return;
    }
    setPassSaving(true);
    try {
      await api.post('/change-password', {
        current_password: passForm.current,
        new_password: passForm.new
      });
      setPassSuccess('Password updated successfully!');
      setPassForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setShowChangePass(false), 1500);
    } catch (err) {
      setPassErr(err.response?.data?.error?.message || err.message || 'Failed to update password.');
    } finally {
      setPassSaving(false);
    }
  };

  return (
    <>
      {/* Sidebar Navigation */}
      <div className={`fixed top-0 bottom-0 left-0 w-64 bg-ink text-paper p-5 z-30 transition-transform duration-300 md:translate-x-0 ${
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } flex flex-col border-r border-paper/10`}>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo & Tenant Header */}
          <div className="flex justify-between items-center mb-5 flex-shrink-0">
            <h1 className="font-display font-bold text-xl tracking-tight text-paper">
              School<span className="text-teal-primary">Base</span>
            </h1>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 hover:bg-paper/5 rounded-lg text-paper/60 hover:text-paper cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {user?.role !== 'super_admin' && user?.school_name && (
            <div className="mb-4 bg-paper/5 border border-paper/10 rounded-xl p-2.5 flex-shrink-0 text-left">
              <span className="block text-[8px] font-sans font-bold text-paper/40 uppercase tracking-wider mb-0.5">
                School Tenant
              </span>
              <p className="text-xs font-bold text-teal-primary truncate animate-fadeIn" title={user.school_name}>
                {user.school_name}
              </p>
            </div>
          )}

          {/* Super Admin School Switcher */}
          {user?.role === 'super_admin' && (
            <div className="mb-4 bg-paper/5 border border-paper/10 rounded-xl p-2.5 flex-shrink-0">
              <label className="block text-[9px] font-sans font-bold text-paper/50 uppercase tracking-wider mb-1.5">
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
                  className="w-full bg-ink border border-paper/15 text-paper text-xs font-sans rounded-lg px-2.5 py-1.5 pr-8 appearance-none focus:outline-none focus:border-teal-primary"
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

          {/* Navigation Items — Scrollable Expandable Accordion Groups */}
          <nav className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
            {navGroups.map((group) => {
              const isExpanded = expandedGroups[group.id] ?? true;
              const hasActiveItem = group.items.some(item => item.path === location.pathname);

              return (
                <div key={group.id} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[9px] font-sans font-bold uppercase tracking-wider text-paper/45 hover:text-paper hover:bg-paper/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-1.5">
                      <span>{group.title}</span>
                      {hasActiveItem && !isExpanded && (
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-primary animate-pulse" />
                      )}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-teal-primary' : 'text-paper/30'}`} />
                  </button>

                  {isExpanded && (
                    <div className="space-y-0.5 pl-1 animate-fadeIn">
                      {group.items.map((link) => {
                        const Icon = link.icon;
                        return (
                          <NavLink
                            key={link.path}
                            to={link.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition-all duration-150 ${
                                isActive
                                  ? 'bg-teal-primary text-paper font-bold shadow-md shadow-teal-primary/10'
                                  : 'text-paper/65 hover:text-paper hover:bg-paper/5'
                              }`
                            }
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{link.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Footer */}
        <div className="border-t border-paper/10 pt-4 mt-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-paper/90 truncate">{user?.username}</p>
              <p className="text-[9px] text-paper/40 font-mono uppercase tracking-wider">{user?.role?.replace('_', ' ')}</p>
            </div>
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative w-8 h-8 rounded-lg bg-paper/10 hover:bg-paper/20 text-paper flex items-center justify-center transition-all cursor-pointer"
                  title="View Notifications"
                >
                  <Bell className="w-3.5 h-3.5 text-paper/85" />
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
                <KeyRound className="w-3.5 h-3.5 text-paper/85" />
              </button>
              <button
                onClick={logout}
                className="w-8 h-8 rounded-lg bg-brick-critical/10 hover:bg-brick-critical/20 text-brick-critical flex items-center justify-center transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
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
                <div className="relative">
                  <input
                    type={showPassVals ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="w-full glass-input rounded-xl text-xs pr-10"
                    value={passForm.current}
                    onChange={e => setPassForm({ ...passForm, current: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassVals(!showPassVals)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer focus:outline-none"
                  >
                    {showPassVals ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink/65 mb-1">New Password</label>
                <input
                  type={showPassVals ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  className="w-full glass-input rounded-xl text-xs"
                  value={passForm.new}
                  onChange={e => setPassForm({ ...passForm, new: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink/65 mb-1">Confirm New Password</label>
                <input
                  type={showPassVals ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  className="w-full glass-input rounded-xl text-xs"
                  value={passForm.confirm}
                  onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePass(false)}
                  className="px-4 py-2 border border-line-border rounded-xl text-ink/70 hover:bg-sage/10 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passSaving}
                  className="px-5 py-2 bg-teal-primary text-paper rounded-xl hover:bg-teal-dark font-semibold shadow-md disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {passSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
