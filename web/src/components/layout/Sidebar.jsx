import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import Gauge from '../ui/Gauge';
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
  ChevronRight,
  ClipboardList,
  HeartPulse,
  Calendar,
  BookOpen,
  Megaphone,
  Grid3X3,
  KeyRound,
  FileBarChart2,
  Bell,
  MessageSquare,
  Package,
  Building2,
  DollarSign,
  Settings,
  Shield,
  Layers,
  Sparkles,
  School,
  X
} from 'lucide-react';
import { getCurrentTerm } from '../../utils/dateTerms';

export default function Sidebar({ isOpen, onClose }) {
  const { user, activeSchoolId, schoolName, changeActiveSchool, logout } = useAuth();
  const location = useLocation();

  const [schools, setSchools] = useState([]);
  const [counts, setCounts] = useState({
    pendingExeats: 0,
    unpaidInvoices: 0,
    unreadMessages: 0
  });

  const [license, setLicense] = useState({
    tier: '',
    daysLeft: 0,
    studentLimit: 0,
    studentsCount: 0
  });

  // Fetch live counts & license data
  useEffect(() => {
    if (!user) return;

    if (user.role === 'super_admin') {
      api.get('/schools')
        .then(res => { if (res.data) setSchools(res.data); })
        .catch(() => {});
    }

    const schoolId = activeSchoolId || user.school_id;
    if (schoolId) {
      api.get(`/schools/${schoolId}/dashboard/extended`)
        .then(res => {
          if (res?.data) {
            const k = res.data.kpis || {};
            const lic = res.data.license || {};
            setLicense({
              tier: lic.tier || 'Active',
              daysLeft: lic.days_left ?? 0,
              studentLimit: lic.max_students || k.max_students || 0,
              studentsCount: k.total_students || 0
            });
          }
        })
        .catch(() => {});

      // Notifications badge
      if (sessionStorage.getItem('schoolbase_token')) {
        api.get('/notifications', { silent: true })
          .then(res => {
            if (res?.data && Array.isArray(res.data)) {
              const unread = res.data.filter(n => !n.is_read).length;
              setCounts(c => ({ ...c, unreadMessages: unread }));
            }
          })
          .catch(() => {});
      }
    }
  }, [user, activeSchoolId]);

  const userRole = (user?.role || 'student').toLowerCase().trim();
  const role = userRole;
  const isAdmin = ['super_admin', 'school_admin', 'admin', 'principal', 'head', 'deputy_head', 'headmaster'].includes(userRole);

  const hasRoleAccess = (allowedRoles = []) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (userRole === 'super_admin') {
      // Super admin overview is solely the Command Center, not the school-level dashboard
      if (allowedRoles.includes('super_admin')) return true;
      return false;
    }
    if (isAdmin && (allowedRoles.includes('school_admin') || allowedRoles.includes('head'))) return true;
    return allowedRoles.includes(userRole);
  };

  // Grouped role-filtered sections with uppercase labels & live badges
  // Unprivileged users will NEVER see links or sections to pages they cannot access
  const navSections = [
    {
      label: 'OVERVIEW',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['school_admin', 'bursar', 'teacher', 'parent', 'student', 'boarding_master', 'nurse'] },
        { path: '/admin/command-center', label: 'Command Center', icon: HardDrive, roles: ['super_admin'] }
      ]
    },
    {
      label: 'PEOPLE',
      items: [
        { path: '/parent-portal', label: 'My Children', icon: Users, roles: ['parent'] },
        { path: '/students', label: 'Students', icon: Users, roles: ['school_admin', 'teacher', 'super_admin'] },
        { path: '/staff', label: 'Staff Roster', icon: UserCheck, roles: ['school_admin', 'teacher', 'super_admin'] },
        { path: '/user-management', label: 'User Management', icon: KeyRound, roles: ['super_admin', 'school_admin'] },
        { path: '/enquiries', label: 'Admissions & Enquiries', icon: Sparkles, roles: ['school_admin', 'super_admin'] }
      ]
    },
    {
      label: 'ACADEMICS',
      items: [
        { path: '/classes', label: 'Classes & Subjects', icon: Grid3X3, roles: ['school_admin', 'super_admin', 'teacher'] },
        { path: '/timetable', label: 'Timetable', icon: Calendar, roles: ['school_admin', 'teacher', 'parent', 'student', 'super_admin'] },
        { path: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['school_admin', 'teacher', 'super_admin'] },
        { path: '/grades', label: 'Gradebook', icon: GraduationCap, roles: ['school_admin', 'teacher', 'super_admin'] },
        { path: '/results', label: 'Results & Reports', icon: FileText, roles: ['school_admin', 'teacher', 'parent', 'student', 'super_admin'] },
        { path: '/exams', label: 'Examinations', icon: ClipboardList, roles: ['school_admin', 'teacher', 'super_admin'] },
        { path: '/academics/schemes', label: 'Schemes of Work', icon: Layers, roles: ['school_admin', 'teacher', 'super_admin'] },
        { path: '/zimsec/portal', label: 'ZIMSEC Desk', icon: Shield, roles: ['school_admin', 'super_admin'] },
        { path: '/academics/setup', label: 'Academic Setup', icon: Settings, roles: ['school_admin', 'super_admin'] }
      ]
    },
    {
      label: 'FINANCE',
      items: [
        { path: '/fees', label: 'Fees & Cashier', icon: CreditCard, roles: ['school_admin', 'bursar', 'super_admin'] },
        { path: '/parent-portal', label: 'My Children Fees', icon: CreditCard, roles: ['parent'], badge: counts.unpaidInvoices > 0 ? counts.unpaidInvoices : null },
        { path: '/expenses', label: 'Expenses', icon: DollarSign, roles: ['school_admin', 'bursar', 'super_admin'] },
        { path: '/fees?tab=reconciliation', label: 'Reconciliation', icon: Layers, roles: ['school_admin', 'bursar', 'super_admin'] },
        { path: '/fees?tab=debtors', label: 'Debtors', icon: AlertTriangle, roles: ['school_admin', 'bursar', 'super_admin'] }
      ]
    },
    {
      label: 'BOARDING',
      items: [
        { path: '/hostels', label: 'Hostels', icon: Building2, roles: ['school_admin', 'boarding_master', 'super_admin'] },
        { path: '/boarding/exeats', label: 'Exeat Board', icon: ClipboardList, roles: ['school_admin', 'boarding_master', 'parent', 'super_admin'], badge: counts.pendingExeats > 0 ? counts.pendingExeats : null },
        { path: '/hostels?tab=points', label: 'House Points', icon: Sparkles, roles: ['school_admin', 'boarding_master', 'teacher', 'super_admin'] }
      ]
    },
    {
      label: 'WELFARE',
      items: [
        { path: '/health-records', label: 'Health Records', icon: HeartPulse, roles: ['school_admin', 'nurse', 'super_admin'] },
        { path: '/discipline', label: 'Discipline', icon: AlertTriangle, roles: ['school_admin', 'teacher', 'super_admin'] },
        { path: '/leave-requests', label: 'Leave Requests', icon: CalendarCheck, roles: ['school_admin', 'teacher', 'super_admin'] }
      ]
    },
    {
      label: 'RESOURCES',
      items: [
        { path: '/library', label: 'Library Catalog', icon: BookOpen, roles: ['school_admin', 'teacher', 'parent', 'student', 'super_admin'] },
        { path: '/assets', label: 'Assets', icon: Package, roles: ['school_admin', 'super_admin'] },
        { path: '/tasks', label: 'Tasks', icon: ClipboardList, roles: ['school_admin', 'teacher', 'super_admin'] }
      ]
    },
    {
      label: 'COMMUNICATION',
      items: [
        { path: '/notifications', label: 'Messages & Alerts', icon: MessageSquare, roles: ['school_admin', 'teacher', 'parent', 'student', 'bursar', 'boarding_master', 'nurse', 'super_admin'], badge: counts.unreadMessages > 0 ? counts.unreadMessages : null }
      ]
    },
    {
      label: 'ADMIN',
      items: [
        { path: '/reports/emis', label: 'EMIS Returns', icon: FileBarChart2, roles: ['school_admin', 'super_admin'] },
        { path: '/reporting', label: 'Reporting', icon: FileBarChart2, roles: ['school_admin', 'super_admin'] },
        { path: '/audit-log', label: 'Audit Log', icon: ShieldCheck, roles: ['super_admin'] },
        { path: '/settings/security', label: 'Security', icon: KeyRound, roles: ['school_admin', 'super_admin'] },
        { path: '/school-admin/license', label: 'License Desk', icon: FileLock, roles: ['school_admin', 'super_admin'] }
      ]
    }
  ];

  const currentTerm = getCurrentTerm();
  const displaySchool = schoolName || user?.school_name || '';

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[260px] sidebar-deep-green flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-xl border-r border-brand-900/60 select-none`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white shadow-xs">
              <School className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-display font-extrabold text-base tracking-tight text-white block leading-none">
                School<span className="text-brand-500">Base</span>
              </span>
              <span className="text-[10px] text-brand-400 font-mono font-medium">
                {currentTerm.label}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* School context display: Super Admin Switcher or Active School Banner */}
        {user?.role === 'super_admin' && schools.length > 0 ? (
          <div className="px-4 py-2.5 bg-black/25 border-b border-white/10">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-white/60 font-semibold tracking-wider uppercase">ACTIVE SCHOOL</label>
              <span className="text-[9px] bg-brand-500/20 text-brand-300 font-bold px-1.5 py-0.2 rounded">SUPER ADMIN</span>
            </div>
            <select
              value={activeSchoolId || ''}
              onChange={(e) => changeActiveSchool(e.target.value)}
              className="w-full bg-brand-950/80 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none focus:border-brand-500"
            >
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        ) : displaySchool ? (
          <div className="px-4 py-2.5 bg-black/25 border-b border-white/10 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
              <School className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-wider text-white/50 font-semibold block leading-none mb-0.5">CURRENT INSTITUTION</span>
              <span className="text-xs font-semibold text-white truncate block" title={displaySchool}>{displaySchool}</span>
            </div>
          </div>
        ) : null}

        {/* Scrollable Navigation Area */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
          {navSections.map((sec) => {
            const visibleItems = sec.items.filter(item => hasRoleAccess(item.roles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={sec.label} className="space-y-1">
                <div className="px-3 text-[10px] font-bold text-white/40 tracking-wider font-mono uppercase">
                  {sec.label}
                </div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path.split('?')[0]));

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-brand-700 text-white font-semibold shadow-xs'
                          : 'text-white/75 hover:text-white hover:bg-white/8'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge !== undefined && item.badge !== null && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-accent text-brand-950">
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-white/80" />
                        )}
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom card: License status (Admin only) & Sign out */}
        <div className="p-3 border-t border-white/10 bg-black/15 shrink-0 space-y-3">
          {isAdmin && Boolean(license.tier) && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-white/90 text-[11px]">{license.tier} Tier</span>
                <span className="text-[10px] font-mono text-white/60">{license.daysLeft}d remaining</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-brand-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((license.studentsCount / (license.studentLimit || 1000)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/50 mt-1 font-mono">
                <span>{license.studentsCount} students</span>
                <span>limit {license.studentLimit}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <NavLink
              to="/profile"
              onClick={onClose}
              title="Manage Profile"
              className="truncate pr-2 hover:opacity-90 transition cursor-pointer flex-1"
            >
              <div className="text-xs font-semibold text-white truncate">{user?.name || user?.username}</div>
              <div className="text-[10px] text-white/50 capitalize font-mono">{(role || 'user').replace(/_/g, ' ')} • Edit Profile →</div>
            </NavLink>

            <button
              onClick={logout}
              title="Sign out"
              className="w-8 h-8 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
