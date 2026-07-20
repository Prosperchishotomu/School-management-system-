import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  HardDrive, Building, Key, AlertTriangle, RefreshCw, Plus, X,
  FileLock, Globe, Settings, ChevronRight, TrendingUp, Users,
  BookOpen, CheckCircle, ShieldAlert, Trash2, Edit3, Save,
  Loader2, Activity, Bell, LayoutDashboard, Calendar, Grid3X3,
  Clock, Mail, MessageSquare, Send, Info, CreditCard, Eye, EyeOff
} from 'lucide-react';
import { MiniBarChart } from '../components/charts/MiniBarChart';
import { MiniDonutChart } from '../components/charts/MiniDonutChart';
import { MiniLineChart } from '../components/charts/MiniLineChart';

const TABS = [
  { id: 'overview',    label: 'Platform Overview',   icon: LayoutDashboard },
  { id: 'schools',     label: 'School Management',   icon: Building },
  { id: 'licenses',    label: 'Licenses & Billing',  icon: FileLock },
  { id: 'config',      label: 'Global Config',        icon: Settings },
  { id: 'health',      label: 'System Health',        icon: Activity },
];

// ─── Stat Card ──────────────────────────────────────────────────────────────
const AnimatedCount = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }
    const isDecimal = value % 1 !== 0;
    let start = 0;
    const end = value;
    if (start === end) return;

    const duration = 1000; // ms
    const increment = end > start ? 1 : -1;
    const stepTime = Math.max(Math.floor(duration / Math.abs(end - start)), 20);
    
    let current = start;
    const timer = setInterval(() => {
      if (isDecimal) {
        current += (end - current) * 0.15;
        if (Math.abs(end - current) < 0.1) {
          setDisplayValue(end);
          clearInterval(timer);
        } else {
          setDisplayValue(parseFloat(current.toFixed(1)));
        }
      } else {
        current += Math.ceil((end - current) / 8) * increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
          setDisplayValue(end);
          clearInterval(timer);
        } else {
          setDisplayValue(current);
        }
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue}</>;
};

const StatCard = ({ label, value, icon: Icon, color = 'teal', suffix = '', warning = false }) => {
  const colorMap = {
    teal:   { bg: 'bg-teal-primary/10', text: 'text-teal-primary', val: 'text-ink' },
    amber:  { bg: 'bg-amber-warning/10', text: 'text-amber-warning', val: 'text-amber-warning' },
    red:    { bg: 'bg-brick-critical/10', text: 'text-brick-critical', val: 'text-brick-critical' },
  };
  const c = colorMap[warning ? 'red' : color] || colorMap.teal;
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
      <div>
        <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">{label}</span>
        <h4 className={`text-3xl font-display font-bold mt-1.5 numeric-data ${c.val}`}>
          {typeof value === 'number' ? <AnimatedCount value={value} /> : (value ?? '—')}{suffix}
        </h4>
      </div>
      <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
    </div>
  );
};

// ─── Tab: Overview ───────────────────────────────────────────────────────────
const OverviewTab = ({ stats, onRefresh, schools = [] }) => {
  const { activeSchoolId } = useAuth();
  const [extendedData, setExtendedData] = useState(null);
  const [extLoading, setExtLoading] = useState(false);

  useEffect(() => {
    if (activeSchoolId) {
      setExtLoading(true);
      api.get(`/schools/${activeSchoolId}/dashboard/extended`)
        .then(r => setExtendedData(r.data))
        .catch(err => console.error("Error loading extended cockpit stats:", err))
        .finally(() => setExtLoading(false));
    } else {
      setExtendedData(null);
    }
  }, [activeSchoolId]);

  const t = stats?.totals || {};
  const studentsPerSchool = (stats?.students_per_school || []).map(s => ({
    ...s, student_count: parseInt(s.student_count)
  }));
  const planBreakdown = (stats?.plan_breakdown || []).map(p => ({
    name: p.plan, value: parseInt(p.count)
  }));
  const registrations = (stats?.school_registrations || []).map(r => ({
    ...r, count: parseInt(r.count)
  }));

  if (activeSchoolId) {
    const activeSchool = schools.find(s => s.id === activeSchoolId);
    const activeSchoolName = activeSchool?.name || 'Selected School';

    if (extLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 font-sans">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary"/>
          <p className="text-xs text-ink/50 font-semibold mt-3">Loading school tenant cockpit telemetry...</p>
        </div>
      );
    }

    const cockpit = extendedData || {};
    const attendancePct = cockpit.kpis?.attendance_today_pct || 0;
    const feesPct = cockpit.kpis?.fees_collected_pct || 0;

    return (
      <div className="space-y-6 animate-fadeIn font-sans pb-12">
        {/* Banner */}
        <div className="bg-teal-primary/5 p-6 rounded-2xl border border-teal-primary/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-teal-primary/10 text-teal-primary">
              Active Audit Context
            </span>
            <h3 className="text-xl font-display font-bold text-ink">{activeSchoolName}</h3>
            <p className="text-xs text-ink/65 leading-relaxed">
              Super Admin cockpit view for school tenant configuration, system activity and telemetry.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              activeSchool?.status === 'active' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
            }`}>
              Status: {activeSchool?.status ? activeSchool.status.toUpperCase() : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* Cockpit KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Enrolled Students" value={cockpit.kpis?.total_students ?? 0} icon={Users} />
          <StatCard label="Active Faculty/Staff" value={cockpit.kpis?.total_staff ?? 0} icon={Users} />
          <StatCard label="Total Classes" value={cockpit.kpis?.total_classes ?? 0} icon={Building} />
          <StatCard label="Open Infractions" value={cockpit.kpis?.open_incidents ?? 0} icon={AlertTriangle} warning={cockpit.kpis?.open_incidents > 0} color="amber" />
        </div>

        {/* Dynamic Telemetry Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Financial Health Progress */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-ink border-b border-line-border/30 pb-3 flex items-center justify-between">
              <span>Financial &amp; Tuition Health</span>
              <span className="font-mono text-xs text-teal-primary font-bold">{feesPct}% Collected</span>
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-ink/75 mb-1.5">
                  <span>Tuition Collection Rate</span>
                  <span>Benchmark: ${parseFloat(activeSchool?.tuition_fee_benchmark || 500).toFixed(2)}</span>
                </div>
                <div className="w-full h-2.5 bg-ink/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-primary rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, feesPct)}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-ink/50 leading-relaxed font-sans">
                Tuition fee collection status is computed based on historical invoices vs compiled cashier transactions. Low rates indicate potential accounts receivable warnings.
              </p>
            </div>
          </div>

          {/* Section 2: Attendance Daily Indicator */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-ink border-b border-line-border/30 pb-3 flex items-center justify-between">
              <span>Daily Presence Diagnostic</span>
              <span className="font-mono text-xs text-teal-primary font-bold">{attendancePct}% Today</span>
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-ink/75 mb-1.5">
                  <span>Attendance Today</span>
                  <span>Registers Submitted: {cockpit.kpis?.registers_submitted ?? 0} / {cockpit.kpis?.total_classes ?? 0}</span>
                </div>
                <div className="w-full h-2.5 bg-ink/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-primary rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, attendancePct)}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-ink/50 leading-relaxed font-sans">
                Calculated dynamically from class teacher daily register submissions. Ensure all teachers check attendance to maintain diagnostic integrity.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Class Roster Diagnostics */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-ink border-b border-line-border/30 pb-3">
            Classroom Diagnostics &amp; Telemetry
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="bg-ink/5 text-ink/50 uppercase tracking-wider font-bold text-[9px]">
                  <th className="py-2.5 px-4">Class Details</th>
                  <th className="py-2.5 px-4 text-center">Class Teacher</th>
                  <th className="py-2.5 px-4 text-center">Attendance (Present / Total)</th>
                  <th className="py-2.5 px-4 text-center">Roster Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/10 text-ink">
                {cockpit.attendance_detail?.length > 0 ? (
                  cockpit.attendance_detail.map((cls, idx) => (
                    <tr key={idx} className="hover:bg-sage/5 transition-colors">
                      <td className="py-3 px-4 font-bold text-ink">{cls.name || `Grade ${cls.grade_level}`}</td>
                      <td className="py-3 px-4 text-center text-ink/65 font-medium">{cls.teacher_name || 'Not assigned'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold">{cls.present} / {cls.total}</span>
                        <span className="text-[10px] text-ink/40 ml-1.5">({cls.pct}%)</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          cls.status === 'submitted' ? 'bg-sage/40 text-teal-dark' : 'bg-amber-warning/10 text-amber-warning'
                        }`}>{cls.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="py-8 text-center text-ink/40">No classroom telemetry registered for this school.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Schools"           value={t.schools}           icon={Building}      />
        <StatCard label="Total Students"    value={t.students}          icon={Users}         />
        <StatCard label="Staff Members"     value={t.staff}             icon={Users}         />
        <StatCard label="Active Licenses"   value={t.active_licenses}   icon={Key}           />
        <StatCard label="Expiring ≤30d"     value={t.expiring_licenses} icon={Key}    warning={t.expiring_licenses > 0} color="amber" />
        <StatCard label="Active Alerts"     value={t.active_alerts}     icon={AlertTriangle} warning={t.active_alerts > 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-sm font-sans font-bold text-ink/70 mb-3">Students per School</h3>
          <MiniBarChart data={studentsPerSchool} xKey="school_name" yKey="student_count" height={200} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-sans font-bold text-ink/70 mb-3">License Plan Breakdown</h3>
          <MiniDonutChart data={planBreakdown} nameKey="name" valueKey="value" height={200} />
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-sans font-bold text-ink/70 mb-3">School Registrations (Last 6 Months)</h3>
        <MiniLineChart data={registrations} xKey="month" yKey="count" height={160} filled />
      </div>
    </div>
  );
};

// ─── Interactive Dynamic Loader Component ──────────────────────────────────
const InteractiveLoader = ({ message = 'Synchronizing' }) => {
  const [step, setStep] = useState(0);
  const steps = [
    'Establishing secure sandbox handshake...',
    'Decoding school tenant schema keys...',
    'Hydrating records from database cluster...',
    'Assembling components context...',
    'Finalizing dynamic layout assets...'
  ];
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s + 1) % steps.length);
    }, 850);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-teal-primary text-teal-600 drop-shadow-[0_0_8px_rgba(20,184,166,0.3)]" />
      <div className="text-center">
        <p className="text-sm font-semibold text-ink/80">{message}...</p>
        <p className="text-[10px] text-teal-dark/60 font-mono mt-1 animate-pulse font-semibold">{steps[step]}</p>
      </div>
    </div>
  );
};

// ─── Color Coded Alert Panel Component ──────────────────────────────────────
const ColorCodedAlert = ({ type = 'info', text, onClose }) => {
  if (!text) return null;
  const styles = {
    success: 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-[0_4px_12px_rgba(16,185,129,0.1)]',
    warning: 'bg-amber-50 text-amber-950 border-amber-300 shadow-[0_4px_12px_rgba(245,158,11,0.1)]',
    error: 'bg-rose-50 text-rose-950 border-rose-300 shadow-[0_4px_12px_rgba(244,63,94,0.1)]',
    info: 'bg-sky-50 text-sky-950 border-sky-300 shadow-[0_4px_12px_rgba(56,189,248,0.1)]'
  };
  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 animate-bounce" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />,
    error: <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 animate-bounce" />,
    info: <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
  };
  return (
    <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold font-sans transition-all animate-slideDown ${styles[type]}`}>
      <div className="flex items-center space-x-3">
        {icons[type]}
        <span>{text}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="hover:opacity-75 transition-opacity ml-4 cursor-pointer text-ink/50 hover:text-ink">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ─── Tab: School Management ───────────────────────────────────────────────────
const SchoolsTab = ({ schools, licenses = [], onRefresh }) => {
  const { activeSchoolId, changeActiveSchool, user } = useAuth();
  const displaySchools = activeSchoolId ? schools.filter(s => s.id === activeSchoolId) : schools;
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]   = useState({ 
    name: '', 
    code: '', 
    status: 'active', 
    tuition_fee_benchmark: 500.00,
    school_type: 'primary',
    admin_username: '',
    admin_email: '',
    admin_password: ''
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');

  // School edit states
  const [showEdit, setShowEdit]   = useState(false);
  const [editSchool, setEditSchool] = useState(null);
  const [editForm, setEditForm]     = useState({ name: '', tuition_fee_benchmark: 500.00 });
  const [editSaving, setEditSaving] = useState(false);

  // Nested Manage School Console State
  const [selectedManageSchool, setSelectedManageSchool] = useState(null);
  const [manageSubTab, setManageSubTab] = useState('overview'); // overview, users, staff, timetable, gateways
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [subSuccess, setSubSuccess] = useState('');

  // Manage: Users
  const [schoolUsers, setSchoolUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showResetPassModal, setShowResetPassModal] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [resetPassValue, setResetPassValue] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [schoolStudents, setSchoolStudents] = useState([]);
  
  const [userForm, setUserForm] = useState({
    name: '', username: '', password: '', email: '', phone: '', role: 'teacher', class_id: '', student_id: '', relation: 'Father'
  });

  // Manage: Staff
  const [schoolStaff, setSchoolStaff] = useState([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    role_title: 'Teacher',
    username: '',
    password: '',
    class_id: ''
  });

  // Manage: Timetable
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [periodsList, setPeriodsList] = useState([]);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [showManagePeriods, setShowManagePeriods] = useState(false);
  const [timetable, setTimetable] = useState([]);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editSlot, setEditSlot] = useState({ day: '', period: '', subject: '', teacher: '', id: '' });
  const [slotSaving, setSlotSaving] = useState(false);

  // Manage: Gateways Form
  const [gatewaysForm, setGatewaysForm] = useState({
    sms_gateway_url: '',
    sms_api_key: '',
    sms_sender_id: '',
    email_smtp_host: '',
    email_smtp_port: 587,
    email_smtp_user: '',
    email_smtp_pass: '',
    email_from_address: '',
    email_from_name: '',
    payment_gateway_type: 'mock',
    payment_merchant_id: '',
    payment_merchant_key: '',
    payment_api_url: ''
  });

  // Test gateways states
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [testSmsLoading, setTestSmsLoading] = useState(false);
  const [testBankingLoading, setTestBankingLoading] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState({ type: '', text: '' });
  const [smsTestResult, setSmsTestResult] = useState({ type: '', text: '' });
  const [bankingTestResult, setBankingTestResult] = useState({ type: '', text: '' });
  
  // Password visibility states
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [showPayKey, setShowPayKey] = useState(false);

  // Load nested sub-tab data dynamically
  useEffect(() => {
    if (!selectedManageSchool) return;
    setSubError('');
    setSubSuccess('');

    if (manageSubTab === 'users') {
      setSubLoading(true);
      Promise.all([
        api.get(`/schools/${selectedManageSchool.id}/users`),
        api.get(`/schools/${selectedManageSchool.id}/classes`),
        api.get(`/schools/${selectedManageSchool.id}/students?per_page=1000`)
      ]).then(([usersRes, classesRes, studentsRes]) => {
        setSchoolUsers(usersRes.data || []);
        setClasses(classesRes.data || []);
        setSchoolStudents(studentsRes.data || []);
      }).catch(() => setSubError('Could not sync user roster.'))
        .finally(() => setSubLoading(false));
    } 
    else if (manageSubTab === 'staff') {
      setSubLoading(true);
      Promise.all([
        api.get(`/schools/${selectedManageSchool.id}/staff`),
        api.get(`/schools/${selectedManageSchool.id}/classes`)
      ]).then(([staffRes, classesRes]) => {
        setSchoolStaff(staffRes.data || []);
        setClasses(classesRes.data || []);
      }).catch(() => setSubError('Could not sync teacher profiles.'))
        .finally(() => setSubLoading(false));
    } 
    else if (manageSubTab === 'timetable') {
      setSubLoading(true);
      Promise.all([
        api.get(`/schools/${selectedManageSchool.id}/classes`),
        api.get(`/schools/${selectedManageSchool.id}/subjects`),
        api.get(`/schools/${selectedManageSchool.id}/staff`)
      ]).then(([classesRes, subjectsRes, staffRes]) => {
        setClasses(classesRes.data || []);
        setSubjects(subjectsRes.data || []);
        setSchoolStaff(staffRes.data || []);
        if (classesRes.data?.length > 0) {
          setSelectedClass(String(classesRes.data[0].id));
        }
      }).catch(() => setSubError('Could not bind timetable configurations.'))
        .finally(() => setSubLoading(false));
    } 
    else if (manageSubTab === 'gateways') {
      setSubLoading(true);
      api.get(`/schools/${selectedManageSchool.id}/notification-settings`)
        .then(res => {
          if (res.data) {
            setGatewaysForm({
              sms_gateway_url: res.data.sms_gateway_url || '',
              sms_api_key: res.data.sms_api_key || '',
              sms_sender_id: res.data.sms_sender_id || '',
              email_smtp_host: res.data.email_smtp_host || '',
              email_smtp_port: parseInt(res.data.email_smtp_port || 587),
              email_smtp_user: res.data.email_smtp_user || '',
              email_smtp_pass: res.data.email_smtp_pass || '',
              email_from_address: res.data.email_from_address || '',
              email_from_name: res.data.email_from_name || '',
              payment_gateway_type: res.data.payment_gateway_type || 'mock',
              payment_merchant_id: res.data.payment_merchant_id || '',
              payment_merchant_key: res.data.payment_merchant_key || '',
              payment_api_url: res.data.payment_api_url || ''
            });
          }
        })
        .catch(() => setSubError('Could not sync settings profiles.'))
        .finally(() => setSubLoading(false));
    }
  }, [selectedManageSchool, manageSubTab]);

  // Load Timetable scheduling entries whenever selectedClass changes
  const fetchTimetableEntries = useCallback(() => {
    if (!selectedManageSchool || !selectedClass) return;
    api.get(`/schools/${selectedManageSchool.id}/timetable?class_id=${selectedClass}`)
      .then(res => {
        setTimetable(res.data || []);
      })
      .catch(() => setSubError('Failed to fetch scheduled lessons.'));
  }, [selectedManageSchool, selectedClass]);

  useEffect(() => {
    if (manageSubTab === 'timetable' && selectedClass) {
      fetchTimetableEntries();
    }
  }, [manageSubTab, selectedClass, fetchTimetableEntries]);

  // Load class specific timeslots from localstorage or fallbacks
  useEffect(() => {
    if (!selectedManageSchool || !selectedClass) return;
    const key = `schoolbase_periods_${selectedManageSchool.id}_${selectedClass}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setPeriodsList(JSON.parse(saved));
      } catch (e) {
        // Fallback
      }
    } else {
      setPeriodsList([
        '07:30–08:10', '08:10–08:50', '08:50–09:30', '09:30–10:10', 'BREAK', '10:30–11:10', '11:10–11:50', '11:50–12:30', '12:30–13:10'
      ]);
    }
  }, [selectedManageSchool, selectedClass]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      await api.post('/schools', form);
      setShowCreate(false); 
      setForm({ 
        name: '', 
        code: '', 
        status: 'active', 
        tuition_fee_benchmark: 500.00,
        school_type: 'primary',
        admin_username: '',
        admin_email: '',
        admin_password: ''
      }); 
      onRefresh();
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault(); setEditSaving(true);
    try {
      await api.patch(`/schools/${editSchool.id}`, editForm);
      setShowEdit(false); setEditSchool(null); onRefresh();
    } catch (ex) {
      alert(ex.message || 'Failed to update school details.');
    } finally { setEditSaving(false); }
  };

  const handleStatusToggle = async (school) => {
    const next = school.status === 'active' ? 'suspended' : 'active';
    await api.patch(`/schools/${school.id}`, { status: next });
    onRefresh();
  };

  const getLicenseInfo = (schoolId) => {
    const lic = licenses.find(l => l.school_id === schoolId);
    if (!lic) return { label: 'No License', style: 'bg-brick-critical/10 text-brick-critical' };
    const soon = (new Date(lic.expires_at) - new Date()) / (1000 * 86400) <= 30;
    
    if (lic.status !== 'active') {
      return { label: `${lic.plan} (${lic.status})`, style: 'bg-brick-critical/10 text-brick-critical' };
    }
    return {
      label: `${lic.plan} (active)`,
      style: soon ? 'bg-amber-warning/20 text-amber-warning font-semibold' : 'bg-sage/40 text-teal-dark font-medium'
    };
  };

  // User tab actions
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setSubError(''); setSubSuccess('');
    if (userForm.role === 'teacher' && !userForm.class_id) {
      setSubError('A teacher account must have an active class assignment.');
      return;
    }
    if (userForm.role === 'parent' && !userForm.student_id) {
      setSubError('A parent account must be linked to a student.');
      return;
    }
    setSubLoading(true);
    try {
      await api.post(`/schools/${selectedManageSchool.id}/users`, {
        name: userForm.name,
        username: userForm.username,
        password: userForm.password,
        email: userForm.email || null,
        phone: userForm.phone || null,
        role: userForm.role,
        class_id: userForm.class_id || null,
        student_id: userForm.student_id || null,
        relation: userForm.relation
      });
      setSubSuccess(`Successfully created user ${userForm.username}`);
      setShowAddUserModal(false);
      setUserForm({ name: '', username: '', password: '', email: '', phone: '', role: 'teacher', class_id: '', student_id: '', relation: 'Father' });
      // reload users list
      const uRes = await api.get(`/schools/${selectedManageSchool.id}/users`);
      setSchoolUsers(uRes.data || []);
    } catch (err) {
      setSubError(err.message || 'Failed to register account.');
    } finally {
      setSubLoading(false);
    }
  };

  const handleResetPassSubmit = async (e) => {
    e.preventDefault();
    setSubError(''); setSubSuccess('');
    if (resetPassValue.length < 8) {
      setSubError('Password must be at least 8 characters long.');
      return;
    }
    setSubLoading(true);
    try {
      await api.post(`/schools/${selectedManageSchool.id}/users/${selectedUserForReset.id}/reset-password`, {
        password: resetPassValue
      });
      setSubSuccess(`Successfully reset password for ${selectedUserForReset.username}`);
      setShowResetPassModal(false);
      setSelectedUserForReset(null);
      setResetPassValue('');
    } catch (err) {
      setSubError(err.message || 'Failed to reset password.');
    } finally {
      setSubLoading(false);
    }
  };

  const handleDeactivateUser = async (u) => {
    if (!window.confirm(`Permanently de-authorize and lock user account "${u.username}"?`)) return;
    setSubLoading(true);
    try {
      await api.delete(`/schools/${selectedManageSchool.id}/users/${u.id}`);
      setSubSuccess(`Successfully de-authorized ${u.username}`);
      const uRes = await api.get(`/schools/${selectedManageSchool.id}/users`);
      setSchoolUsers(uRes.data || []);
    } catch (err) {
      setSubError(err.message || 'Failed to lock user.');
    } finally {
      setSubLoading(false);
    }
  };

  // Staff tab actions
  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    setSubError(''); setSubSuccess('');
    if (staffForm.username && !staffForm.password) {
      setSubError('A password is required when creating a system login.');
      return;
    }
    if (staffForm.password && !staffForm.username) {
      setSubError('A username is required when creating a system login.');
      return;
    }
    if (staffForm.password && staffForm.password.length < 8) {
      setSubError('Password must be at least 8 characters long.');
      return;
    }
    setSubLoading(true);
    try {
      await api.post(`/schools/${selectedManageSchool.id}/staff`, staffForm);
      setSubSuccess(`Registered profile for ${staffForm.name}`);
      setShowAddStaffModal(false);
      setStaffForm({ 
        name: '', 
        email: '', 
        phone: '', 
        role_title: 'Teacher',
        username: '',
        password: '',
        class_id: ''
      });
      const sRes = await api.get(`/schools/${selectedManageSchool.id}/staff`);
      setSchoolStaff(sRes.data || []);
    } catch (err) {
      setSubError(err.message || 'Failed to save staff profile.');
    } finally {
      setSubLoading(false);
    }
  };

  // SMTP Mail configuration submit
  const handleSmtpSubmit = async (e) => {
    e.preventDefault();
    setSubError(''); setSubSuccess('');
    setSubLoading(true);
    try {
      await api.put(`/schools/${selectedManageSchool.id}/notification-settings`, gatewaysForm);
      setSubSuccess('SMTP outbound email configuration saved successfully.');
    } catch (err) {
      setSubError(err.message || 'Failed to save SMTP configurations.');
    } finally {
      setSubLoading(false);
    }
  };

  // SMS Gateway configuration submit
  const handleSmsSubmit = async (e) => {
    e.preventDefault();
    setSubError(''); setSubSuccess('');
    setSubLoading(true);
    try {
      await api.put(`/schools/${selectedManageSchool.id}/notification-settings`, gatewaysForm);
      setSubSuccess('SMS Gateway configuration parameters saved successfully.');
    } catch (err) {
      setSubError(err.message || 'Failed to save SMS gateway settings.');
    } finally {
      setSubLoading(false);
    }
  };

  // Tuition Fees Payment Gateway config submit
  const handlePaymentGatewaySubmit = async (e) => {
    e.preventDefault();
    setSubError(''); setSubSuccess('');
    setSubLoading(true);
    try {
      await api.put(`/schools/${selectedManageSchool.id}/notification-settings`, gatewaysForm);
      setSubSuccess('Tuition payment gateway credentials saved successfully.');
    } catch (err) {
      setSubError(err.message || 'Failed to save payment gateway integration credentials.');
    } finally {
      setSubLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    console.log('[SMTP DIAGNOSTIC] handleSendTestEmail initiated.');
    if (!testEmailAddress) {
      console.warn('[SMTP DIAGNOSTIC] Test email address is empty.');
      setSmtpTestResult({ type: 'error', text: 'Please enter a test email address first.' });
      return;
    }
    setTestEmailLoading(true);
    setSmtpTestResult({ type: '', text: '' });
    try {
      console.log('[SMTP DIAGNOSTIC] Saving notification-settings context before test...', gatewaysForm);
      await api.put(`/schools/${selectedManageSchool.id}/notification-settings`, gatewaysForm);
      console.log('[SMTP DIAGNOSTIC] Triggering backend diagnostics...');
      const res = await api.post(`/schools/${selectedManageSchool.id}/communication/test`, {
        type: 'email',
        recipient: testEmailAddress,
        message: 'This is an SMTP configuration test message sent from the SchoolBase global management system.'
      });
      console.log('[SMTP DIAGNOSTIC] Backend response:', res.data);
      let msg = `SMTP test completed. Status: ${res.data.status.toUpperCase()}\nDetails: ${res.data.details}`;
      if (res.data.trace?.handshake_logs) {
        msg += `\n\nSocket Handshake Trace:\n` + res.data.trace.handshake_logs.join('\n');
      }
      setSmtpTestResult({ 
        type: res.data.status === 'success' || res.data.status === 'simulated' ? 'success' : 'error', 
        text: msg 
      });
    } catch (err) {
      console.error('[SMTP DIAGNOSTIC] Caught connection error:', err);
      const errMsg = err.response?.data?.error?.message || err.message || 'SMTP server connection timed out.';
      setSmtpTestResult({ type: 'error', text: errMsg });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleSendTestSms = async () => {
    console.log('[SMS DIAGNOSTIC] handleSendTestSms initiated.');
    if (!testSmsPhone) {
      console.warn('[SMS DIAGNOSTIC] Test phone number is empty.');
      setSmsTestResult({ type: 'error', text: 'Please enter a test phone number first.' });
      return;
    }
    setTestSmsLoading(true);
    setSmsTestResult({ type: '', text: '' });
    try {
      console.log('[SMS DIAGNOSTIC] Saving notification-settings context before test...', gatewaysForm);
      await api.put(`/schools/${selectedManageSchool.id}/notification-settings`, gatewaysForm);
      console.log('[SMS DIAGNOSTIC] Triggering backend diagnostics...');
      const res = await api.post(`/schools/${selectedManageSchool.id}/communication/test`, {
        type: 'sms',
        recipient: testSmsPhone,
        message: 'This is an SMS gateway configuration test message sent from the SchoolBase global management system.'
      });
      console.log('[SMS DIAGNOSTIC] Backend response:', res.data);
      let msg = `SMS test completed. Status: ${res.data.status.toUpperCase()}\nDetails: ${res.data.details}`;
      if (res.data.trace) {
        msg += `\n\nTrace Parameters:\n` + Object.entries(res.data.trace).map(([k, v]) => `  ${k}: ${v}`).join('\n');
      }
      setSmsTestResult({ 
        type: res.data.status === 'success' || res.data.status === 'simulated' ? 'success' : 'error', 
        text: msg 
      });
    } catch (err) {
      console.error('[SMS DIAGNOSTIC] Caught connection error:', err);
      const errMsg = err.response?.data?.error?.message || err.message || 'SMS provider API request failed.';
      setSmsTestResult({ type: 'error', text: errMsg });
    } finally {
      setTestSmsLoading(false);
    }
  };

  const handleSendTestBanking = async () => {
    console.log('[BANKING DIAGNOSTIC] handleSendTestBanking initiated.');
    setTestBankingLoading(true);
    setBankingTestResult({ type: '', text: '' });
    try {
      console.log('[BANKING DIAGNOSTIC] Saving notification-settings context before test...', gatewaysForm);
      await api.put(`/schools/${selectedManageSchool.id}/notification-settings`, gatewaysForm);
      console.log('[BANKING DIAGNOSTIC] Triggering backend diagnostics...');
      const res = await api.post(`/schools/${selectedManageSchool.id}/communication/test`, {
        type: 'banking'
      });
      console.log('[BANKING DIAGNOSTIC] Backend response:', res.data);
      let msg = `Banking verification completed. Status: ${res.data.status.toUpperCase()}\nDetails: ${res.data.details}`;
      if (res.data.trace) {
        msg += `\n\nParameters Checked:\n` + Object.entries(res.data.trace).map(([k, v]) => `  ${k}: ${v}`).join('\n');
      }
      setBankingTestResult({ 
        type: res.data.status === 'success' ? 'success' : 'error', 
        text: msg 
      });
    } catch (err) {
      console.error('[BANKING DIAGNOSTIC] Caught connection error:', err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Banking gateway request failed.';
      setBankingTestResult({ type: 'error', text: errMsg });
    } finally {
      setTestBankingLoading(false);
    }
  };

  // Timetable scheduling handlers
  const handleSlotClick = (day, period) => {
    if (period === 'BREAK') return;
    const existing = timetable.find(t => t.day === day && t.period === period);
    const classTeacher = classes.find(c => String(c.id) === selectedClass)?.teacher_name || 'Unassigned';
    setEditSlot({
      day,
      period,
      subject: existing?.subject || '',
      teacher: classTeacher,
      id: existing?.id || ''
    });
    setShowSlotModal(true);
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!editSlot.subject) {
      alert('Please specify a curriculum subject.');
      return;
    }
    setSlotSaving(true);
    try {
      const slotId = editSlot.id || `${selectedClass}-${editSlot.day}-${editSlot.period}`.replace(/[: –]/g, '_');
      await api.put(`/schools/${selectedManageSchool.id}/timetable/${slotId}`, {
        class_id: selectedClass,
        day: editSlot.day,
        period: editSlot.period,
        subject: editSlot.subject,
        teacher: editSlot.teacher
      });
      setShowSlotModal(false);
      fetchTimetableEntries();
    } catch (err) {
      alert(err.message || 'Failed to schedule lesson.');
    } finally {
      setSlotSaving(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!editSlot.id) return;
    if (!window.confirm('Delete scheduled lesson?')) return;
    setSlotSaving(true);
    try {
      await api.delete(`/schools/${selectedManageSchool.id}/timetable/${editSlot.id}`);
      setShowSlotModal(false);
      fetchTimetableEntries();
    } catch (err) {
      alert(err.message || 'Failed to delete lesson.');
    } finally {
      setSlotSaving(false);
    }
  };

  const handleAddPeriod = (e) => {
    e.preventDefault();
    const p = newPeriodName.trim();
    if (!p) return;
    if (periodsList.includes(p)) {
      alert('Period slot already exists.');
      return;
    }
    const updated = [...periodsList, p].sort((a, b) => {
      if (a === 'BREAK') return -1;
      if (b === 'BREAK') return 1;
      return a.localeCompare(b);
    });
    setPeriodsList(updated);
    localStorage.setItem(`schoolbase_periods_${selectedManageSchool.id}_${selectedClass}`, JSON.stringify(updated));
    setNewPeriodName('');
  };

  const handleDeletePeriod = (periodToDelete) => {
    if (!window.confirm(`Delete the slot "${periodToDelete}"? scheduled classes in this slot will remain in DB but hidden.`)) return;
    const updated = periodsList.filter(p => p !== periodToDelete);
    setPeriodsList(updated);
    localStorage.setItem(`schoolbase_periods_${selectedManageSchool.id}_${selectedClass}`, JSON.stringify(updated));
  };

  // Master: If a school is selected for config management, render the nested school admin view
  if (selectedManageSchool) {
    const activeLic = licenses.find(l => l.school_id === selectedManageSchool.id);
    return (
      <div className="space-y-6 animate-fadeIn font-sans pb-12">
        {/* Manage School Console Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-teal-primary/5 p-6 rounded-2xl border border-teal-primary/10 gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => setSelectedManageSchool(null)} 
              className="text-teal-primary hover:text-teal-dark text-xs font-bold flex items-center space-x-1.5 cursor-pointer pb-2"
            >
              <span>&larr; Back to Tenant Schools Registry</span>
            </button>
            <div className="flex items-center space-x-3">
              <h3 className="text-2xl font-display font-bold text-ink">{selectedManageSchool.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                selectedManageSchool.status === 'active' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
              }`}>{selectedManageSchool.status}</span>
            </div>
            <p className="text-[10px] text-ink/50 font-mono">School Code: <span className="font-bold">{selectedManageSchool.code}</span> | Plan: <span className="font-bold">{activeLic?.plan || 'N/A'}</span></p>
          </div>
          
          <button
            onClick={() => { changeActiveSchool(selectedManageSchool.id); window.location.href = '/school-admin/dashboard'; }}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-teal-primary text-paper hover:bg-teal-dark text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <span>Drill-In to School Admin Portal</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {subError && <ColorCodedAlert type="error" text={subError} onClose={() => setSubError('')} />}
        {subSuccess && <ColorCodedAlert type="success" text={subSuccess} onClose={() => setSubSuccess('')} />}

        {/* Sub Navigation */}
        <div className="flex border-b border-line-border/30 gap-1 pb-1.5">
          {[
            { id: 'overview', label: 'School Overview', icon: LayoutDashboard },
            { id: 'users', label: 'User Logins', icon: Key },
            { id: 'staff', label: 'Teachers & Staff', icon: Users },
            { id: 'timetable', label: 'Timetable Designer', icon: Grid3X3 },
            { id: 'gateways', label: 'Integrations & Gateways', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setManageSubTab(tab.id)}
                className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  manageSubTab === tab.id
                    ? 'bg-paper text-teal-primary shadow border border-line-border/20'
                    : 'text-ink/60 hover:text-ink hover:bg-sage/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sub-tab content */}
        {subLoading ? (
          <InteractiveLoader message={`Fetching school ${manageSubTab} records`} />
        ) : (
          <div className="animate-fadeIn">
            {/* tab: overview */}
            {manageSubTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[10px] font-bold text-ink/40 uppercase block">Benchmark Tuition Fee</span>
                  <span className="text-xl font-bold text-teal-dark mt-2 block">${parseFloat(selectedManageSchool.tuition_fee_benchmark).toFixed(2)}</span>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[10px] font-bold text-ink/40 uppercase block">License Key Expiry</span>
                  <span className="text-sm font-bold text-ink mt-2 block">{activeLic ? new Date(activeLic.expires_at).toLocaleDateString() : 'No active license'}</span>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[10px] font-bold text-ink/40 uppercase block">Active License Status</span>
                  <span className="text-sm font-bold text-teal-primary mt-2 block capitalize">{activeLic?.status || 'Inactive'}</span>
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[10px] font-bold text-ink/40 uppercase block">Tenant Code ID</span>
                  <span className="text-sm font-mono font-bold text-ink/75 mt-2 block">{selectedManageSchool.id}</span>
                </div>
              </div>
            )}

            {/* tab: users */}
            {manageSubTab === 'users' && (
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-ink/40 uppercase">Filter Role:</span>
                    <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="bg-paper border border-line-border text-xs rounded-xl px-2.5 py-1.5 focus:outline-none">
                      <option value="">All Roles</option>
                      <option value="school_admin">Admins</option>
                      <option value="teacher">Teachers</option>
                      <option value="parent">Parents</option>
                      <option value="student">Students</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => { setShowAddUserModal(true); setSubError(''); }}
                    className="flex items-center space-x-1 px-3 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer hover:bg-teal-dark transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User Login</span>
                  </button>
                </div>

                <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border text-[10px] font-bold uppercase text-ink/50">
                        <th className="px-5 py-3">Profile Name</th>
                        <th className="px-5 py-3">Username</th>
                        <th className="px-5 py-3">System Role</th>
                        <th className="px-5 py-3">Link Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/20">
                      {schoolUsers.filter(u => !userRoleFilter || u.role === userRoleFilter).map(u => (
                        <tr key={u.id} className="hover:bg-sage/5 transition-colors">
                          <td className="px-5 py-3 font-semibold">{u.name}</td>
                          <td className="px-5 py-3 font-mono text-ink/60">{u.username}</td>
                          <td className="px-5 py-3 capitalize">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              u.role === 'school_admin' ? 'bg-purple-50 text-purple-600' :
                              u.role === 'teacher' ? 'bg-teal-50 text-teal-600' :
                              u.role === 'parent' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                            }`}>{u.role?.replace('_', ' ')}</span>
                          </td>
                          <td className="px-5 py-3 font-mono text-[10px] text-ink/40">{u.id}</td>
                          <td className="px-5 py-3 text-right space-x-2">
                            <button
                              onClick={() => { setSelectedUserForReset(u); setResetPassValue(''); setShowResetPassModal(true); }}
                              className="px-2.5 py-1.5 bg-paper border border-line-border hover:bg-sage/10 text-[10px] font-semibold rounded-lg cursor-pointer"
                            >
                              Reset Password
                            </button>
                            <button
                              disabled={u.username === user.username}
                              onClick={() => handleDeactivateUser(u)}
                              className="px-2.5 py-1.5 bg-brick-critical/5 hover:bg-brick-critical text-brick-critical hover:text-paper text-[10px] font-semibold rounded-lg cursor-pointer"
                            >
                              Lock Account
                            </button>
                          </td>
                        </tr>
                      ))}
                      {schoolUsers.length === 0 && (
                        <tr><td colSpan={5} className="px-5 py-8 text-center text-ink/40">No user accounts created.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* tab: staff */}
            {manageSubTab === 'staff' && (
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-ink uppercase tracking-wider">Teachers &amp; Staff Directory</h4>
                  <button 
                    onClick={() => { setShowAddStaffModal(true); setSubError(''); }}
                    className="flex items-center space-x-1 px-3 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer hover:bg-teal-dark transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Staff Profile</span>
                  </button>
                </div>

                <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border text-[10px] font-bold uppercase text-ink/50">
                        <th className="px-5 py-3">Staff Name</th>
                        <th className="px-5 py-3">Role Title</th>
                        <th className="px-5 py-3">Email Address</th>
                        <th className="px-5 py-3">Contact Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/20">
                      {schoolStaff.map(st => (
                        <tr key={st.id} className="hover:bg-sage/5 transition-colors">
                          <td className="px-5 py-3.5 font-semibold">{st.name}</td>
                          <td className="px-5 py-3.5 font-bold text-teal-dark">{st.role_title}</td>
                          <td className="px-5 py-3.5 text-ink/65">{st.email || '—'}</td>
                          <td className="px-5 py-3.5 text-ink/65 font-mono">{st.phone || '—'}</td>
                        </tr>
                      ))}
                      {schoolStaff.length === 0 && (
                        <tr><td colSpan={4} className="px-5 py-8 text-center text-ink/40">No staff registry profiles created.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* tab: timetable */}
            {manageSubTab === 'timetable' && (
              <div className="space-y-4 pt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-ink/40 uppercase">Select Class:</span>
                    <select 
                      value={selectedClass} 
                      onChange={e => setSelectedClass(e.target.value)} 
                      className="bg-paper border border-line-border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-semibold"
                    >
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <button
                    onClick={() => setShowManagePeriods(!showManagePeriods)}
                    className="flex items-center space-x-1.5 px-3 py-2 border border-line-border hover:bg-sage/10 text-ink text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-teal-primary" />
                    <span>{showManagePeriods ? 'Hide Panel' : 'Edit Time Periods'}</span>
                  </button>
                </div>

                {showManagePeriods && (
                  <div className="glass-card rounded-2xl p-5 border border-line-border/30 bg-sage/5 space-y-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-ink/80 flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-teal-primary" />
                      <span>Customize Timeslots</span>
                    </h5>
                    <p className="text-[11px] text-ink/65">Add or remove period breaks and subject lesson intervals for this class.</p>
                    
                    <form onSubmit={handleAddPeriod} className="flex gap-2 max-w-md">
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. 13:10–13:50 or BREAK" 
                        className="flex-1 px-3 py-1.5 border border-line-border bg-paper rounded-lg text-xs"
                        value={newPeriodName}
                        onChange={e => setNewPeriodName(e.target.value)}
                      />
                      <button type="submit" className="px-3.5 py-1.5 bg-teal-primary text-paper rounded-lg text-xs font-semibold cursor-pointer">
                        + Add
                      </button>
                    </form>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {periodsList.map(p => (
                        <span key={p} className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-paper border border-line-border/30 rounded-lg font-mono text-[10px]">
                          <span>{p}</span>
                          <button type="button" onClick={() => handleDeletePeriod(p)} className="text-brick-critical/60 hover:text-brick-critical ml-1.5 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timetable Grid */}
                <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border">
                        <th className="py-3 px-5 text-left text-[10px] font-bold text-ink/60 uppercase tracking-wider w-32">Period</th>
                        {DAYS.map(d => (
                          <th key={d} className="py-3 px-5 text-center text-[10px] font-bold text-ink/60 uppercase tracking-wider">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/20 text-xs">
                      {periodsList.map(period => (
                        <tr key={period} className={period === 'BREAK' ? 'bg-sage/5' : ''}>
                          <td className="py-3.5 px-5 font-mono font-bold text-ink/75 bg-sage/5 border-r border-line-border/20">{period}</td>
                          {DAYS.map(day => {
                            const entry = timetable.find(t => t.day === day && t.period === period);
                            return (
                              <td 
                                key={day} 
                                onClick={() => handleSlotClick(day, period)}
                                className={`py-3.5 px-5 text-center cursor-pointer transition-all border-r border-line-border/10 ${
                                  period === 'BREAK' ? 'bg-sage/5 cursor-not-allowed pointer-events-none' : 'hover:bg-teal-primary/5'
                                }`}
                              >
                                {entry ? (
                                  <div className="space-y-0.5">
                                    <p className="font-bold text-teal-dark">{entry.subject}</p>
                                    <p className="text-[9px] text-ink/50">{entry.teacher}</p>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-ink/20 italic hover:text-teal-primary/50 transition-colors">+ Schedule</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* tab: gateways */}
            {manageSubTab === 'gateways' && (
              <div className="space-y-6 pt-4 text-xs font-sans max-w-3xl">
                {/* SMTP configuration */}
                <form onSubmit={handleSmtpSubmit} className="space-y-4">
                  <div className="glass-card rounded-2xl p-5 border border-line-border/20 space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-teal-dark flex items-center space-x-1.5">
                      <Mail className="w-4 h-4" />
                      <span>SMTP Mail Configuration</span>
                    </h4>
                    <p className="text-[11px] text-ink/50">Specify the primary outbound email dispatch parameters for reminders and alerts.</p>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">SMTP Outbound Host</label>
                        <input type="text" className="w-full glass-input rounded-xl text-xs" placeholder="e.g. smtp.mailgun.org" value={gatewaysForm.email_smtp_host} onChange={e => setGatewaysForm({...gatewaysForm, email_smtp_host: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Port</label>
                        <input type="number" className="w-full glass-input rounded-xl text-xs numeric-data" placeholder="587" value={gatewaysForm.email_smtp_port} onChange={e => setGatewaysForm({...gatewaysForm, email_smtp_port: parseInt(e.target.value) || 587})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">SMTP Username</label>
                        <input type="text" className="w-full glass-input rounded-xl text-xs" placeholder="e.g. postmaster@yourdomain.com" value={gatewaysForm.email_smtp_user} onChange={e => setGatewaysForm({...gatewaysForm, email_smtp_user: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">SMTP Password</label>
                        <div className="relative">
                          <input 
                            type={showSmtpPass ? "text" : "password"} 
                            className="w-full glass-input rounded-xl text-xs pr-10" 
                            placeholder="••••••••••••••" 
                            autoComplete="new-password"
                            value={gatewaysForm.email_smtp_pass} 
                            onChange={e => setGatewaysForm({...gatewaysForm, email_smtp_pass: e.target.value})} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPass(!showSmtpPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer focus:outline-none"
                          >
                            {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Default From Email Address</label>
                        <input type="email" className="w-full glass-input rounded-xl text-xs" placeholder="e.g. alerts@schoolbase.co.zw" value={gatewaysForm.email_from_address} onChange={e => setGatewaysForm({...gatewaysForm, email_from_address: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Default Sender Display Name</label>
                        <input type="text" className="w-full glass-input rounded-xl text-xs" placeholder="e.g. SchoolBase Alerts" value={gatewaysForm.email_from_name} onChange={e => setGatewaysForm({...gatewaysForm, email_from_name: e.target.value})} />
                      </div>
                    </div>

                    {/* SMTP Test Row */}
                    <div className="border-t border-line-border/10 pt-4 mt-2 flex flex-col sm:flex-row items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-teal-dark/70 mb-1 uppercase tracking-wider">Test SMTP Mailbox</label>
                        <input 
                          type="email" 
                          placeholder="recipient@test.com" 
                          className="w-full glass-input rounded-xl text-xs" 
                          value={testEmailAddress}
                          onChange={e => setTestEmailAddress(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={testEmailLoading}
                        className="px-4 py-2 border border-teal-primary text-teal-primary hover:bg-teal-primary/5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        {testEmailLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Send Test Email</span>
                      </button>
                    </div>

                    {smtpTestResult.text && (
                      <div className={`p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed border select-text ${
                        smtpTestResult.type === 'success' 
                          ? 'bg-sage/20 border-teal-primary/20 text-teal-dark' 
                          : 'bg-brick-critical/10 border-brick-critical/20 text-brick-critical'
                      }`}>
                        {smtpTestResult.text}
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button type="submit" disabled={subLoading} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl font-bold cursor-pointer transition-all">
                        {subLoading ? 'Saving...' : 'Save SMTP Mail Configuration'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* SMS configuration */}
                <form onSubmit={handleSmsSubmit} className="space-y-4">
                  <div className="glass-card rounded-2xl p-5 border border-line-border/20 space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-teal-dark flex items-center space-x-1.5">
                      <Bell className="w-4 h-4" />
                      <span>SMS Gateway configurations</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">SMS API Endpoint Endpoint URL</label>
                        <input type="url" className="w-full glass-input rounded-xl text-xs" placeholder="https://api.sms-provider.com/v1/send" value={gatewaysForm.sms_gateway_url} onChange={e => setGatewaysForm({...gatewaysForm, sms_gateway_url: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Sender Identification Mask</label>
                        <input type="text" className="w-full glass-input rounded-xl text-xs uppercase" placeholder="e.g. SCH-BASE" value={gatewaysForm.sms_sender_id} onChange={e => setGatewaysForm({...gatewaysForm, sms_sender_id: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Authorization API Key</label>
                        <div className="relative">
                          <input 
                            type={showSmsKey ? "text" : "password"} 
                            className="w-full glass-input rounded-xl text-xs pr-10" 
                            placeholder="API Key Mask" 
                            autoComplete="new-password"
                            value={gatewaysForm.sms_api_key} 
                            onChange={e => setGatewaysForm({...gatewaysForm, sms_api_key: e.target.value})} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmsKey(!showSmsKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer focus:outline-none"
                          >
                            {showSmsKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* SMS Test Row */}
                    <div className="border-t border-line-border/10 pt-4 mt-2 flex flex-col sm:flex-row items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-teal-dark/70 mb-1 uppercase tracking-wider">Test SMS Gateway</label>
                        <input 
                          type="text" 
                          placeholder="e.g. +263777123456" 
                          className="w-full glass-input rounded-xl text-xs" 
                          value={testSmsPhone}
                          onChange={e => setTestSmsPhone(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendTestSms}
                        disabled={testSmsLoading}
                        className="px-4 py-2 border border-teal-primary text-teal-primary hover:bg-teal-primary/5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        {testSmsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Send Test SMS</span>
                      </button>
                    </div>

                    {smsTestResult.text && (
                      <div className={`p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed border select-text ${
                        smsTestResult.type === 'success' 
                          ? 'bg-sage/20 border-teal-primary/20 text-teal-dark' 
                          : 'bg-brick-critical/10 border-brick-critical/20 text-brick-critical'
                      }`}>
                        {smsTestResult.text}
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button type="submit" disabled={subLoading} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl font-bold cursor-pointer transition-all">
                        {subLoading ? 'Saving...' : 'Save SMS Gateway Configuration'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Tuition Fees Payment Gateways */}
                <form onSubmit={handlePaymentGatewaySubmit} className="space-y-4">
                  <div className="glass-card rounded-2xl p-5 border border-line-border/20 space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-teal-dark flex items-center space-x-1.5">
                      <CreditCard className="w-4 h-4" />
                      <span>Tuition Fees Payment Gateways</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Gateway Provider Type</label>
                        <select className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={gatewaysForm.payment_gateway_type} onChange={e => setGatewaysForm({...gatewaysForm, payment_gateway_type: e.target.value})}>
                          <option value="mock">Sandbox Mock gateway</option>
                          <option value="ecocash">EcoCash Express API</option>
                          <option value="paynow">Paynow Gateway integration</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Merchant Account ID / Shortcode</label>
                        <input type="text" className="w-full glass-input rounded-xl text-xs" placeholder="e.g. 193021" value={gatewaysForm.payment_merchant_id} onChange={e => setGatewaysForm({...gatewaysForm, payment_merchant_id: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-ink/70 mb-1">Integration Secret API Key</label>
                        <div className="relative">
                          <input 
                            type={showPayKey ? "text" : "password"} 
                            className="w-full glass-input rounded-xl text-xs pr-10" 
                            placeholder="Secret Key" 
                            autoComplete="new-password"
                            value={gatewaysForm.payment_merchant_key} 
                            onChange={e => setGatewaysForm({...gatewaysForm, payment_merchant_key: e.target.value})} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPayKey(!showPayKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer focus:outline-none"
                          >
                            {showPayKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink/70 mb-1">Gateway API Endpoint Base URL</label>
                      <input type="url" className="w-full glass-input rounded-xl text-xs" placeholder="https://api.paynow.co.zw/interface/initiate" value={gatewaysForm.payment_api_url} onChange={e => setGatewaysForm({...gatewaysForm, payment_api_url: e.target.value})} />
                    </div>

                    {/* Banking Test Row */}
                    <div className="border-t border-line-border/10 pt-4 mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendTestBanking}
                        disabled={testBankingLoading}
                        className="px-4 py-2 border border-teal-primary text-teal-primary hover:bg-teal-primary/5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        {testBankingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Verify Banking Settings</span>
                      </button>
                    </div>

                    {bankingTestResult.text && (
                      <div className={`p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed border select-text ${
                        bankingTestResult.type === 'success' 
                          ? 'bg-sage/20 border-teal-primary/20 text-teal-dark' 
                          : 'bg-brick-critical/10 border-brick-critical/20 text-brick-critical'
                      }`}>
                        {bankingTestResult.text}
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button type="submit" disabled={subLoading} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl font-bold cursor-pointer transition-all">
                        {subLoading ? 'Saving...' : 'Save Payment Gateway Credentials'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add User Account (styled professionally) */}
        {showAddUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
            <div className="w-full max-w-md bg-paper rounded-2xl shadow-2xl border border-line-border/30 p-6 animate-fadeIn relative">
              <button onClick={() => setShowAddUserModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
              <h4 className="text-lg font-display font-bold text-ink border-b border-line-border/20 pb-3 mb-4">Register User Login Credentials</h4>
              
              <form onSubmit={handleAddUserSubmit} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-[11px] font-bold text-ink/70 mb-1">Full Profile Name *</label>
                  <input required type="text" placeholder="e.g. John Sibanda" className="w-full glass-input rounded-xl text-xs" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-ink/70 mb-1">System Username *</label>
                    <input required type="text" placeholder="e.g. jsibanda" className="w-full glass-input rounded-xl text-xs font-mono" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value.toLowerCase()})} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink/70 mb-1">User Password *</label>
                    <input required type="password" placeholder="••••••••" className="w-full glass-input rounded-xl text-xs" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-ink/70 mb-1">Link Role Profile *</label>
                    <select required className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                      <option value="school_admin">School Admin / Principal</option>
                      <option value="teacher">Teacher / Academic staff</option>
                      <option value="parent">Parent / Student guardian</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-ink/70 mb-1">Email Address *</label>
                      <input required type="email" placeholder="e.g. name@domain.com" className="w-full glass-input rounded-xl text-xs" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink/70 mb-1">Phone (Cell) *</label>
                      <input required type="text" placeholder="e.g. +26377000000" className="w-full glass-input rounded-xl text-xs" value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Conditional fields based on user role */}
                {userForm.role === 'teacher' && (
                  <div className="p-3 bg-teal-primary/5 rounded-xl border border-teal-primary/10">
                    <label className="block text-[10px] font-bold text-teal-dark uppercase tracking-wider mb-1">Mandatory Class Assignment *</label>
                    <select required className="w-full glass-input rounded-lg text-xs bg-paper font-semibold" value={userForm.class_id} onChange={e => setUserForm({...userForm, class_id: e.target.value})}>
                      <option value="">-- Choose Class Room --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {userForm.role === 'parent' && (
                  <div className="p-3 bg-amber-warning/5 rounded-xl border border-amber-warning/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Student Ward *</label>
                        <select required className="w-full glass-input rounded-lg text-xs bg-paper font-semibold" value={userForm.student_id} onChange={e => setUserForm({...userForm, student_id: e.target.value})}>
                          <option value="">-- Select Ward --</option>
                          {schoolStudents.map(s => (
                            <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Relationship *</label>
                        <select required className="w-full glass-input rounded-lg text-xs bg-paper font-semibold" value={userForm.relation} onChange={e => setUserForm({...userForm, relation: e.target.value})}>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Guardian">Legal Guardian</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-line-border/30">
                  <button type="button" onClick={() => setShowAddUserModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer">Create Account</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reset Password */}
        {showResetPassModal && selectedUserForReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-paper rounded-2xl shadow-2xl border border-line-border/30 p-6 animate-fadeIn relative">
              <button onClick={() => { setShowResetPassModal(false); setSelectedUserForReset(null); }} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
              <h4 className="text-lg font-display font-bold text-ink border-b border-line-border/20 pb-3 mb-4">Reset User Password</h4>
              <p className="text-xs text-ink/60 mb-4">Assign a new login password for user <b>{selectedUserForReset.username}</b>.</p>
              
              <form onSubmit={handleResetPassSubmit} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-[11px] font-bold text-ink/70 mb-1">New Account Password *</label>
                  <input required type="password" placeholder="Min. 8 characters" className="w-full glass-input rounded-xl text-xs" value={resetPassValue} onChange={e => setResetPassValue(e.target.value)} />
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-line-border/30">
                  <button type="button" onClick={() => { setShowResetPassModal(false); setSelectedUserForReset(null); }} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer">Reset Password</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Staff Profile */}
        {showAddStaffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
            <div className="w-full max-w-md bg-paper rounded-2xl shadow-2xl border border-line-border/30 p-6 animate-fadeIn relative">
              <button onClick={() => setShowAddStaffModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
              <h4 className="text-lg font-display font-bold text-ink border-b border-line-border/20 pb-3 mb-4">Register Teacher / Staff Profile</h4>
              
              <form onSubmit={handleAddStaffSubmit} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-[11px] font-bold text-ink/70 mb-1">Staff Full Name *</label>
                  <input required type="text" placeholder="e.g. Grace Sibanda" className="w-full glass-input rounded-xl text-xs" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-ink/70 mb-1">Email Address</label>
                    <input type="email" placeholder="grace@harareprimary.ac.zw" className="w-full glass-input rounded-xl text-xs" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink/70 mb-1">Phone Number</label>
                    <input type="text" placeholder="e.g. +263 77 123 4567" className="w-full glass-input rounded-xl text-xs" value={staffForm.phone} onChange={e => setStaffForm({...staffForm, phone: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink/70 mb-1">Academic Role Title *</label>
                  <input required type="text" placeholder="e.g. Teacher, Grade 3 Assistant" className="w-full glass-input rounded-xl text-xs font-bold text-teal-dark" value={staffForm.role_title} onChange={e => setStaffForm({...staffForm, role_title: e.target.value})} />
                </div>

                {/* Optional system login */}
                <div className="border-t border-line-border/30 pt-3.5 space-y-3.5">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-teal-dark">System Login &amp; Classroom (Optional)</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-ink/70 mb-1">Account Username</label>
                      <input type="text" placeholder="e.g. gsmith" className="w-full glass-input rounded-xl text-xs font-mono" value={staffForm.username} onChange={e => setStaffForm({...staffForm, username: e.target.value.toLowerCase()})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink/70 mb-1">Account Password</label>
                      <input type="password" placeholder="Min. 8 characters" className="w-full glass-input rounded-xl text-xs" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink/70 mb-1">Classroom Assignment</label>
                    <select className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={staffForm.class_id} onChange={e => setStaffForm({...staffForm, class_id: e.target.value})}>
                      <option value="">-- Unassigned / Floating --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-line-border/30">
                  <button type="button" onClick={() => setShowAddStaffModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer">Save Profile</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Schedule Timetable Lesson Slot */}
        {showSlotModal && editSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-paper rounded-2xl shadow-2xl border border-line-border/30 p-6 animate-fadeIn relative">
              <button onClick={() => setShowSlotModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
              <h4 className="text-lg font-display font-bold text-ink border-b border-line-border/20 pb-3 mb-4">Schedule Class Lesson</h4>
              
              <div className="p-3 bg-sage/5 border border-line-border/20 rounded-xl mb-4 font-mono text-[10px] space-y-1">
                <p>Day: <span className="font-bold text-ink">{editSlot.day}</span></p>
                <p>Period: <span className="font-bold text-ink">{editSlot.period}</span></p>
              </div>

              <form onSubmit={handleSaveSlot} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-[11px] font-bold text-ink/70 mb-1">Subject Assignment *</label>
                  <select 
                    required 
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                    value={editSlot.subject}
                    onChange={e => setEditSlot({...editSlot, subject: e.target.value})}
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.name}>{sub.name} ({sub.level})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink/70 mb-1">Teacher Assignment</label>
                  <select 
                    required 
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                    value={editSlot.teacher}
                    onChange={e => setEditSlot({...editSlot, teacher: e.target.value})}
                  >
                    <option value="Unassigned">Unassigned</option>
                    {schoolStaff.map(st => (
                      <option key={st.id} value={st.name}>{st.name} ({st.role_title})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-line-border/30 gap-2">
                  {editSlot.id ? (
                    <button type="button" onClick={handleDeleteSlot} className="px-3.5 py-2 bg-brick-critical/10 text-brick-critical rounded-xl text-xs font-semibold cursor-pointer">
                      Unschedule
                    </button>
                  ) : <div />}
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => setShowSlotModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                    <button type="submit" disabled={slotSaving} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer">
                      Save Slot
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STANDARD VIEW: List registered school tenants
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-sans font-bold text-ink">Registered Tenant Schools</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-1.5 px-3 py-2 bg-teal-primary text-paper text-xs font-semibold rounded-xl hover:bg-teal-dark transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add School</span>
        </button>
      </div>

      {/* Schools table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-ink/5 border-b border-line-border/30">
            <tr className="text-ink/50 uppercase tracking-wider font-bold">
              <th className="px-5 py-3">School Name</th>
              <th className="px-5 py-3">Tenant Code</th>
              <th className="px-5 py-3">Tuition Fee Benchmark</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">License Plan</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/20">
            {displaySchools.map(s => {
              const lic = getLicenseInfo(s.id);
              return (
                <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-ink">{s.name}</td>
                  <td className="px-5 py-3.5 font-mono text-[10px] text-ink/55">{s.code}</td>
                  <td className="px-5 py-3.5 font-mono font-semibold text-teal-primary text-xs">${parseFloat(s.tuition_fee_benchmark || 500).toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      s.status === 'active' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider ${lic.style}`}>
                      {lic.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedManageSchool(s)}
                        className="px-2.5 py-1.5 bg-teal-primary/10 hover:bg-teal-primary text-teal-primary hover:text-paper text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 border border-teal-primary/20"
                      >
                        <span>Configure Portal</span><Settings className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { changeActiveSchool(s.id); window.location.href = '/school-admin/dashboard'; }}
                        className="px-2.5 py-1.5 bg-teal-primary/10 hover:bg-teal-primary text-teal-primary hover:text-paper text-[10px] font-semibold rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <span>Drill-In</span><ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setEditSchool(s); setEditForm({ name: s.name, tuition_fee_benchmark: parseFloat(s.tuition_fee_benchmark || 500) }); setShowEdit(true); }}
                        className="px-2.5 py-1.5 bg-paper hover:bg-sage/10 text-ink border border-line-border/30 text-[10px] font-semibold rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Edit3 className="w-3 h-3" /><span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleStatusToggle(s)}
                        className={`px-2.5 py-1.5 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${
                          s.status === 'active'
                            ? 'bg-brick-critical/10 text-brick-critical hover:bg-brick-critical hover:text-paper'
                            : 'bg-sage/30 text-teal-dark hover:bg-teal-primary hover:text-paper'
                        }`}
                      >
                        {s.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!displaySchools.length && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-ink/40">No schools registered.</td></tr>
            )}
          </tbody>
        </table>
      </div>


      {/* Create School Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
          <div className="w-full max-w-md bg-paper rounded-2xl shadow-2xl border border-line-border/30 p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-display font-bold text-ink">Add New School</h3>
              <button onClick={() => setShowCreate(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            {err && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{err}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">School Name</label>
                <input required className="w-full glass-input rounded-xl text-sm" placeholder="e.g. Bulawayo Primary School" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Tenant Code *</label>
                  <input required className="w-full glass-input rounded-xl text-sm font-mono uppercase" placeholder="e.g. BYO-PREP-01" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">School Type *</label>
                  <select required className="w-full glass-input rounded-xl text-xs bg-paper font-semibold" value={form.school_type} onChange={e => setForm({...form, school_type: e.target.value})}>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Fees Benchmark ($)</label>
                  <input required type="number" min="0" step="0.01" className="w-full glass-input rounded-xl text-sm numeric-data" placeholder="500.00" value={form.tuition_fee_benchmark} onChange={e => setForm({...form, tuition_fee_benchmark: e.target.value})} />
                </div>
              </div>

              {/* Default Administrator Login details */}
              <div className="border-t border-line-border/30 pt-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-dark">Default Administrator Login</h4>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Admin Username *</label>
                  <input required className="w-full glass-input rounded-xl text-sm font-mono" placeholder="e.g. bulawayoadmin" value={form.admin_username} onChange={e => setForm({...form, admin_username: e.target.value.toLowerCase()})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Admin Email *</label>
                    <input required type="email" className="w-full glass-input rounded-xl text-sm" placeholder="e.g. admin@school.ac.zw" value={form.admin_email} onChange={e => setForm({...form, admin_email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Admin Password *</label>
                    <input required type="password" placeholder="••••••••" className="w-full glass-input rounded-xl text-sm" value={form.admin_password} onChange={e => setForm({...form, admin_password: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-line-border rounded-xl text-sm text-ink/70 hover:bg-sage/10 cursor-pointer font-semibold">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-sm font-semibold cursor-pointer flex items-center space-x-2">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                  <span>{saving ? 'Creating...' : 'Create School'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
          <div className="w-full max-w-md bg-paper rounded-2xl shadow-2xl border border-line-border/30 p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-display font-bold text-ink">Edit School Details</h3>
              <button onClick={() => setShowEdit(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">School Name</label>
                <input required className="w-full glass-input rounded-xl text-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Full Fees Benchmark ($)</label>
                <input required type="number" min="0" step="0.01" className="w-full glass-input rounded-xl text-sm numeric-data" value={editForm.tuition_fee_benchmark} onChange={e => setEditForm({...editForm, tuition_fee_benchmark: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 border border-line-border rounded-xl text-sm text-ink/70 hover:bg-sage/10 cursor-pointer font-semibold">Cancel</button>
                <button type="submit" disabled={editSaving} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-sm font-semibold cursor-pointer flex items-center space-x-2">
                  {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Licenses ────────────────────────────────────────────────────────────
const LicensesTab = ({ licenses, schools, onRefresh }) => {
  const { activeSchoolId } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ school_id: '', plan: 'full', expires_at: '', max_users: 500 });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const displayLicenses = activeSchoolId ? licenses.filter(l => l.school_id === activeSchoolId) : licenses;

  useEffect(() => {
    if (activeSchoolId) {
      setForm(f => ({ ...f, school_id: activeSchoolId }));
    }
  }, [activeSchoolId]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      await api.post('/admin/licenses', form);
      setShowModal(false); setForm({ school_id: '', plan: 'full', expires_at: '', max_users: 500 }); onRefresh();
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  const isExpiringSoon = (date) => {
    const d = new Date(date);
    const now = new Date();
    return (d - now) / (1000 * 86400) <= 30;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-sans font-bold text-ink">License Registry</h3>
        <button onClick={() => setShowModal(true)} className="flex items-center space-x-1.5 px-3 py-2 bg-teal-primary text-paper text-xs font-semibold rounded-xl hover:bg-teal-dark transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5"/><span>Issue License</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayLicenses.map((lic, idx) => {
          const expiresAt = new Date(lic.expires_at);
          const now = new Date();
          const isPast = expiresAt < now;
          const isSuperseded = lic.status === 'expired' && !isPast;
          const expiringSoon = isExpiringSoon(lic.expires_at) && !isPast;
          
          let statusLabel = lic.status;
          let statusBadgeClass = 'bg-brick-critical/10 text-brick-critical';
          let borderLeftClass = 'border-brick-critical/50';

          if (lic.status === 'active') {
            if (isPast) {
              statusLabel = 'expired';
              statusBadgeClass = 'bg-brick-critical/10 text-brick-critical';
              borderLeftClass = 'border-brick-critical/50';
            } else if (expiringSoon) {
              statusLabel = 'active';
              statusBadgeClass = 'bg-sage/40 text-teal-dark';
              borderLeftClass = 'border-amber-warning/60';
            } else {
              statusLabel = 'active';
              statusBadgeClass = 'bg-sage/40 text-teal-dark';
              borderLeftClass = 'border-teal-primary/40';
            }
          } else if (isSuperseded) {
            statusLabel = 'superseded';
            statusBadgeClass = 'bg-ink/10 text-ink/65';
            borderLeftClass = 'border-ink/20';
          } else if (lic.status === 'suspended') {
            statusLabel = 'suspended';
            statusBadgeClass = 'bg-brick-critical/10 text-brick-critical';
            borderLeftClass = 'border-brick-critical/50';
          }

          return (
            <div key={idx} className={`glass-card rounded-2xl p-5 space-y-3 border-l-4 ${borderLeftClass}`}>
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-primary/10 text-teal-primary">{lic.plan} plan</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
                  {statusLabel}
                </span>
              </div>
              <div>
                <p className="font-sans font-bold text-sm text-ink">
                  {schools.find(s => s.id === lic.school_id)?.name || `School #${lic.school_id}`}
                </p>
                <p className={`text-xs font-mono mt-1 font-semibold ${expiringSoon ? 'text-amber-warning' : 'text-ink/50'}`}>
                  Expires: {lic.expires_at?.split(' ')[0]}
                  {expiringSoon && ' ⚠️'}
                </p>
              </div>
              <div className="text-[9px] font-mono text-ink/30 bg-ink/5 px-2 py-1 rounded truncate">
                {lic.license_key?.substring(0, 24)}...
              </div>
            </div>
          );
        })}
        {!displayLicenses.length && <div className="col-span-full py-12 text-center text-ink/40 text-xs font-sans">No licenses issued yet.</div>}
      </div>

      {/* Issue License Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(28,37,48,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-display font-bold text-ink">Issue License</h3>
              <button onClick={() => setShowModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            {err && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs border border-brick-critical/20">{err}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Target School</label>
                <select required className="w-full glass-input rounded-xl text-sm disabled:opacity-60 bg-paper text-ink" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value})} disabled={!!activeSchoolId}>
                  {activeSchoolId ? (
                    <option value={activeSchoolId}>{schools.find(s => s.id === activeSchoolId)?.name || 'Active School'}</option>
                  ) : (
                    <>
                      <option value="">Select School...</option>
                      {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </>
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Plan</label>
                  <select className="w-full glass-input rounded-xl text-sm" value={form.plan} onChange={e => setForm({...form, plan: e.target.value})}>
                    <option value="basic">Basic</option>
                    <option value="full">Full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Max Users</label>
                  <input type="number" min="1" className="w-full glass-input rounded-xl text-sm numeric-data" value={form.max_users} onChange={e => setForm({...form, max_users: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Expiry Date</label>
                <input type="date" required className="w-full glass-input rounded-xl text-sm" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-sm text-ink/70 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-sm font-semibold cursor-pointer flex items-center space-x-2">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                  <span>{saving ? 'Signing...' : 'Issue License'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ConfigTab = ({ schools = [] }) => {
  const { activeSchoolId } = useAuth();
  const [subjects, setSubjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState({ name: '', code: '', level: 'primary' });
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  // Term config state
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  useEffect(() => {
    if (activeSchoolId) {
      setSelectedSchoolId(activeSchoolId);
    }
  }, [activeSchoolId]);
  const [terms, setTerms]                       = useState([]);
  const [termsLoading, setTermsLoading]         = useState(false);
  const [termForm, setTermForm]                 = useState({ term_name: '', term_code: '', start_date: '', end_date: '', is_current: false });
  const [termSaving, setTermSaving]             = useState(false);
  const [termErr, setTermErr]                   = useState('');

  // Classes config state
  const [classes, setClasses]                   = useState([]);
  const [classesLoading, setClassesLoading]     = useState(false);
  const [classForm, setClassForm]               = useState({ name: '', grade_level: '', stream: '' });
  const [classSaving, setClassSaving]           = useState(false);
  const [classErr, setClassErr]                 = useState('');

  // Grading Thresholds config state
  const [thresholds, setThresholds]             = useState([]);
  const [schoolType, setSchoolType]             = useState('secondary');
  const [thresholdsLoading, setThresholdsLoading] = useState(false);
  const [thresholdSaving, setThresholdSaving]   = useState(false);
  const [thresholdErr, setThresholdErr]         = useState('');
  const [thresholdSuccess, setThresholdSuccess] = useState('');

  const fetchSubjects = useCallback(() => {
    setLoading(true);
    api.get('/admin/subjects')
      .then(r => setSubjects(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchTerms = useCallback((schoolId) => {
    if (!schoolId) {
      setTerms([]);
      return;
    }
    setTermsLoading(true);
    api.get(`/schools/${schoolId}/terms`)
      .then(r => setTerms(r.data || []))
      .catch(() => {})
      .finally(() => setTermsLoading(false));
  }, []);

  const fetchClasses = useCallback((schoolId) => {
    if (!schoolId) {
      setClasses([]);
      return;
    }
    setClassesLoading(true);
    api.get(`/schools/${schoolId}/classes`)
      .then(r => setClasses(r.data || []))
      .catch(() => {})
      .finally(() => setClassesLoading(false));
  }, []);

  const fetchThresholds = useCallback((schoolId) => {
    if (!schoolId) {
      setThresholds([]);
      return;
    }
    setThresholdsLoading(true);
    setThresholdErr('');
    setThresholdSuccess('');
    api.get(`/schools/${schoolId}/grade-thresholds`)
      .then(r => {
        if (r.data) {
          setThresholds(r.data.thresholds || []);
          setSchoolType(r.data.school_type || 'secondary');
        }
      })
      .catch((ex) => setThresholdErr(ex.message || 'Failed to fetch thresholds.'))
      .finally(() => setThresholdsLoading(false));
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    fetchTerms(selectedSchoolId);
    fetchClasses(selectedSchoolId);
    fetchThresholds(selectedSchoolId);
  }, [selectedSchoolId, fetchTerms, fetchClasses, fetchThresholds]);

  const loadDefaultThresholds = (type) => {
    if (type === 'primary') {
      setThresholds([
        { grade_symbol: '1', min_mark: 80, max_mark: 100, is_pass: 1 },
        { grade_symbol: '2', min_mark: 70, max_mark: 79.99, is_pass: 1 },
        { grade_symbol: '3', min_mark: 60, max_mark: 69.99, is_pass: 1 },
        { grade_symbol: '4', min_mark: 50, max_mark: 59.99, is_pass: 1 },
        { grade_symbol: '5', min_mark: 45, max_mark: 49.99, is_pass: 1 },
        { grade_symbol: '6', min_mark: 40, max_mark: 44.99, is_pass: 1 },
        { grade_symbol: '7', min_mark: 35, max_mark: 39.99, is_pass: 0 },
        { grade_symbol: '8', min_mark: 30, max_mark: 34.99, is_pass: 0 },
        { grade_symbol: '9', min_mark: 0, max_mark: 29.99, is_pass: 0 }
      ]);
    } else {
      setThresholds([
        { grade_symbol: 'A', min_mark: 75, max_mark: 100, is_pass: 1 },
        { grade_symbol: 'B', min_mark: 65, max_mark: 74.99, is_pass: 1 },
        { grade_symbol: 'C', min_mark: 50, max_mark: 64.99, is_pass: 1 },
        { grade_symbol: 'D', min_mark: 40, max_mark: 49.99, is_pass: 0 },
        { grade_symbol: 'E', min_mark: 30, max_mark: 39.99, is_pass: 0 },
        { grade_symbol: 'U', min_mark: 0, max_mark: 29.99, is_pass: 0 }
      ]);
    }
  };

  const handleAddThresholdRow = () => {
    setThresholds(prev => [
      ...prev,
      { grade_symbol: '', min_mark: 0, max_mark: 100, is_pass: 1 }
    ]);
  };

  const handleUpdateThresholdRow = (index, key, val) => {
    setThresholds(prev => prev.map((t, idx) => {
      if (idx !== index) return t;
      return { ...t, [key]: val };
    }));
  };

  const handleDeleteThresholdRow = (index) => {
    setThresholds(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveThresholds = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    setThresholdSaving(true);
    setThresholdErr('');
    setThresholdSuccess('');
    try {
      await api.post(`/schools/${selectedSchoolId}/grade-thresholds`, {
        school_type: schoolType,
        thresholds
      });
      setThresholdSuccess('Grading system thresholds updated successfully.');
      fetchThresholds(selectedSchoolId);
    } catch (ex) {
      setThresholdErr(ex.message || 'Saving thresholds failed.');
    } finally {
      setThresholdSaving(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      await api.post('/admin/subjects', form);
      setForm({ name: '', code: '', level: 'primary' }); fetchSubjects();
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this subject from the national curriculum?')) return;
    await api.delete(`/admin/subjects/${id}`); fetchSubjects();
  };

  const handleAddTerm = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    setTermSaving(true); setTermErr('');
    try {
      await api.post(`/schools/${selectedSchoolId}/terms`, {
        ...termForm,
        is_current: termForm.is_current ? 1 : 0
      });
      setTermForm({ term_name: '', term_code: '', start_date: '', end_date: '', is_current: false });
      fetchTerms(selectedSchoolId);
    } catch (ex) { setTermErr(ex.message); }
    finally { setTermSaving(false); }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    setClassSaving(true); setClassErr('');
    try {
      await api.post(`/schools/${selectedSchoolId}/classes`, classForm);
      setClassForm({ name: '', grade_level: '', stream: '' });
      fetchClasses(selectedSchoolId);
    } catch (ex) { setClassErr(ex.message); }
    finally { setClassSaving(false); }
  };

  const handleDeleteClass = async (id) => {
    if (!confirm('Are you sure you want to delete this class? This will delete all attendance, timetable and grade data associated with this class.')) return;
    try {
      await api.delete(`/schools/${selectedSchoolId}/classes/${id}`);
      fetchClasses(selectedSchoolId);
    } catch {}
  };

  const levelColors = { primary: 'bg-teal-primary/10 text-teal-primary', secondary: 'bg-amber-warning/10 text-amber-warning', all: 'bg-ink/10 text-ink/70' };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Subjects Management */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex justify-between items-center border-b border-line-border/30 pb-4 mb-5">
          <div>
            <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-teal-primary" /><span>National Curriculum Subjects</span>
            </h3>
            <p className="text-xs text-ink/50 mt-1">Subjects available to all school tenants for grading and timetabling.</p>
          </div>
        </div>

        {/* Add subject form */}
        {err && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs border border-brick-critical/20">{err}</div>}
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <input required placeholder="Subject Name" className="glass-input rounded-xl text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input required placeholder="Code (e.g. ENG)" className="glass-input rounded-xl text-sm font-mono uppercase" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} />
          <select className="glass-input rounded-xl text-sm" value={form.level} onChange={e => setForm({...form, level: e.target.value})}>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="all">All Levels</option>
          </select>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center space-x-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Plus className="w-3.5 h-3.5"/>}
            <span>Add Subject</span>
          </button>
        </form>

        {/* Subjects List */}
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-primary"/></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {subjects.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-white/50 border border-line-border/20 rounded-xl group">
                <div>
                  <p className="text-xs font-bold text-ink">{s.name}</p>
                  <div className="flex items-center space-x-1.5 mt-1">
                    <span className="font-mono text-[9px] font-bold text-ink/50">{s.code}</span>
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${levelColors[s.level] || levelColors.all}`}>{s.level}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-brick-critical hover:text-brick-critical/80 transition-opacity cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            ))}
            {!subjects.length && <div className="col-span-full py-6 text-center text-ink/40 text-xs">No subjects defined yet. Add some above.</div>}
          </div>
        )}
      </div>

      {/* Selector pane for School Specific Config */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink/70 mb-1">Select Tenant School</label>
          <select
            className="w-full sm:w-1/2 glass-input rounded-xl text-sm disabled:opacity-60 bg-paper text-ink"
            value={selectedSchoolId}
            onChange={e => setSelectedSchoolId(e.target.value)}
            disabled={!!activeSchoolId}
          >
            {activeSchoolId ? (
              <option value={activeSchoolId}>{schools.find(s => s.id === activeSchoolId)?.name || 'Active School'}</option>
            ) : (
              <>
                <option value="">Select a School to Configure Terms &amp; Classes...</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </>
            )}
          </select>
        </div>
      </div>

      {selectedSchoolId && (
        <>
          {/* School Term Configuration */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex justify-between items-center border-b border-line-border/30 pb-4 mb-5">
              <div>
                <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-teal-primary" /><span>School Term Configuration</span>
                </h3>
                <p className="text-xs text-ink/50 mt-1">Define educational term cycles and active dates for school tenants.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add form */}
              <div className="space-y-4">
                <form onSubmit={handleAddTerm} className="space-y-4 p-4 bg-sage/5 border border-line-border/20 rounded-2xl animate-fadeIn">
                  <h4 className="text-xs font-bold text-ink/75 uppercase tracking-wider">Create Term Cycle</h4>
                  {termErr && <div className="p-2.5 bg-brick-critical/10 text-brick-critical text-[11px] rounded-lg border border-brick-critical/20">{termErr}</div>}
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-ink/65 mb-0.5">Term Name</label>
                    <input required placeholder="e.g. Term 1 2026" className="w-full glass-input rounded-lg text-xs" value={termForm.term_name} onChange={e => setTermForm({...termForm, term_name: e.target.value})} />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-ink/65 mb-0.5">Term Code</label>
                    <input required placeholder="e.g. 2026-T1" className="w-full glass-input rounded-lg text-xs font-mono" value={termForm.term_code} onChange={e => setTermForm({...termForm, term_code: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-ink/65 mb-0.5">Start Date</label>
                      <input type="date" required className="w-full glass-input rounded-lg text-xs" value={termForm.start_date} onChange={e => setTermForm({...termForm, start_date: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink/65 mb-0.5">End Date</label>
                      <input type="date" required className="w-full glass-input rounded-lg text-xs" value={termForm.end_date} onChange={e => setTermForm({...termForm, end_date: e.target.value})} />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input type="checkbox" id="is_current" checked={termForm.is_current} onChange={e => setTermForm({...termForm, is_current: e.target.checked})} className="rounded text-teal-primary focus:ring-teal-primary cursor-pointer" />
                    <label htmlFor="is_current" className="text-xs text-ink/75 font-semibold cursor-pointer">Set as current active term</label>
                  </div>

                  <button type="submit" disabled={termSaving} className="w-full py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50">
                    {termSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                    <span>Save Term Config</span>
                  </button>
                </form>
              </div>

              {/* Terms List */}
              <div className="lg:col-span-2 space-y-3">
                <h4 className="text-xs font-bold text-ink/60 uppercase tracking-wider mb-2">Registered School Terms</h4>
                {termsLoading ? (
                  <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-teal-primary"/></div>
                ) : !terms.length ? (
                  <div className="h-40 border border-dashed border-line-border/40 rounded-2xl flex items-center justify-center text-xs text-ink/40">
                    No term configurations defined for this school. Add one on the left.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                    {terms.map((t, idx) => (
                      <div key={idx} className={`p-4 border rounded-xl space-y-2 relative transition-all ${
                        t.is_current ? 'bg-sage/10 border-teal-primary/30' : 'bg-white border-line-border/20 hover:border-line-border/45 shadow-sm'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-sans font-bold text-sm text-ink">{t.term_name}</h5>
                            <p className="text-[10px] text-ink/45 font-mono font-semibold mt-0.5">{t.term_code}</p>
                          </div>
                          {t.is_current === 1 && (
                            <span className="px-2 py-0.5 bg-teal-primary/10 text-teal-primary text-[8px] font-bold uppercase rounded-full tracking-wider border border-teal-primary/20">Active</span>
                          )}
                        </div>
                        <div className="text-[10px] text-ink/60 font-sans space-y-0.5 border-t border-line-border/10 pt-2 flex items-center justify-between">
                          <span>📅 Start: <b>{t.start_date}</b></span>
                          <span>🏁 End: <b>{t.end_date}</b></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* School Classes Management */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex justify-between items-center border-b border-line-border/30 pb-4 mb-5">
              <div>
                <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2">
                  <Grid3X3 className="w-5 h-5 text-teal-primary" /><span>School Classes Management</span>
                </h3>
                <p className="text-xs text-ink/50 mt-1">Configure classes, streams, and learning cohorts for this school tenant.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add form */}
              <div className="space-y-4">
                <form onSubmit={handleAddClass} className="space-y-4 p-4 bg-sage/5 border border-line-border/20 rounded-2xl animate-fadeIn">
                  <h4 className="text-xs font-bold text-ink/75 uppercase tracking-wider">Create New Class</h4>
                  {classErr && <div className="p-2.5 bg-brick-critical/10 text-brick-critical text-[11px] rounded-lg border border-brick-critical/20">{classErr}</div>}
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-ink/65 mb-0.5">Class Name *</label>
                    <input required placeholder="e.g. Grade 4 Yellow" className="w-full glass-input rounded-lg text-xs" value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-ink/65 mb-0.5">Grade Level *</label>
                      <input required placeholder="e.g. Grade 4" className="w-full glass-input rounded-lg text-xs" value={classForm.grade_level} onChange={e => setClassForm({...classForm, grade_level: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink/65 mb-0.5">Stream</label>
                      <input placeholder="e.g. Yellow" className="w-full glass-input rounded-lg text-xs" value={classForm.stream} onChange={e => setClassForm({...classForm, stream: e.target.value})} />
                    </div>
                  </div>

                  <button type="submit" disabled={classSaving} className="w-full py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50">
                    {classSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                    <span>Save Class</span>
                  </button>
                </form>
              </div>

              {/* Classes List */}
              <div className="lg:col-span-2 space-y-3">
                <h4 className="text-xs font-bold text-ink/60 uppercase tracking-wider mb-2">Active Classes</h4>
                {classesLoading ? (
                  <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-teal-primary"/></div>
                ) : !classes.length ? (
                  <div className="h-40 border border-dashed border-line-border/40 rounded-2xl flex items-center justify-center text-xs text-ink/40">
                    No classes registered. Add one on the left.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                    {classes.map((cls) => (
                      <div key={cls.id} className="p-3 bg-white border border-line-border/20 hover:border-line-border/45 rounded-xl shadow-sm flex items-center justify-between group">
                        <div>
                          <h5 className="font-sans font-bold text-xs text-ink">{cls.name}</h5>
                          <div className="flex items-center space-x-1.5 mt-1 font-mono text-[9px] text-ink/50">
                            <span>{cls.grade_level}</span>
                            {cls.stream && (
                              <>
                                <span>•</span>
                                <span>{cls.stream}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteClass(cls.id)} className="opacity-0 group-hover:opacity-100 text-brick-critical hover:text-brick-critical/80 transition-opacity cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* School Grading Thresholds Management */}
          <div className="glass-card rounded-2xl p-6 mt-8">
            <div className="flex justify-between items-center border-b border-line-border/30 pb-4 mb-5">
              <div>
                <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-teal-primary" /><span>School Grading System & Thresholds</span>
                </h3>
                <p className="text-xs text-ink/50 mt-1">
                  Adjust marks classifications between Primary (1 to 9 numerical scales) or Secondary (A to U letter grades) and configure custom mark intervals.
                </p>
              </div>
            </div>

            {thresholdErr && <div className="p-3 bg-brick-critical/10 text-brick-critical text-xs rounded-xl border border-brick-critical/20 mb-4">{thresholdErr}</div>}
            {thresholdSuccess && <div className="p-3 bg-sage/30 text-teal-dark text-xs rounded-xl border border-teal-primary/20 mb-4">{thresholdSuccess}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side: System Type Selector & Actions */}
              <div className="space-y-4">
                <div className="p-4 bg-sage/5 border border-line-border/20 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-ink/75 uppercase tracking-wider">System Type Settings</h4>
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-ink/65 mb-1">Grading Model *</label>
                    <select 
                      value={schoolType}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setSchoolType(newType);
                        if (confirm(`Do you want to reset and load standard default thresholds for a ${newType} school?`)) {
                          loadDefaultThresholds(newType);
                        }
                      }}
                      className="w-full glass-input rounded-lg text-xs"
                    >
                      <option value="secondary">Secondary (A, B, C, D, E, U)</option>
                      <option value="primary">Primary (1, 2, 3, 4, 5, 6, 7, 8, 9)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => loadDefaultThresholds(schoolType)}
                      className="w-full py-2 border border-line-border hover:bg-sage/10 text-ink/80 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <span>🔄 Load Default {schoolType === 'primary' ? 'Primary' : 'Secondary'} Scales</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleAddThresholdRow}
                      className="w-full py-2 bg-sage/25 hover:bg-sage/40 text-teal-dark rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom Row</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Interactive Thresholds Grid */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-xs font-bold text-ink/60 uppercase tracking-wider">Grading Thresholds Ranges</h4>
                
                {thresholdsLoading ? (
                  <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-teal-primary" /></div>
                ) : thresholds.length === 0 ? (
                  <div className="h-48 border border-dashed border-line-border/40 rounded-2xl flex items-center justify-center text-xs text-ink/40">
                    No thresholds configured for this school yet. Please click "Load Default Scales" above.
                  </div>
                ) : (
                  <form onSubmit={handleSaveThresholds} className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-line-border/30 text-ink/50 uppercase tracking-wider font-bold">
                            <th className="pb-2 w-28">Grade Symbol</th>
                            <th className="pb-2 w-28">Min Mark (%)</th>
                            <th className="pb-2 w-28">Max Mark (%)</th>
                            <th className="pb-2 w-28 text-center">Status</th>
                            <th className="pb-2 text-center w-12">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line-border/10">
                          {thresholds.map((t, idx) => (
                            <tr key={idx} className="hover:bg-sage/5">
                              <td className="py-2.5 pr-2">
                                <input
                                  type="text"
                                  required
                                  maxLength="5"
                                  placeholder="e.g. A"
                                  value={t.grade_symbol}
                                  onChange={(e) => handleUpdateThresholdRow(idx, 'grade_symbol', e.target.value.toUpperCase())}
                                  className="w-full px-2.5 py-1 bg-white border border-line-border rounded-lg text-xs font-bold text-ink"
                                />
                              </td>
                              <td className="py-2.5 pr-2">
                                <input
                                  type="number"
                                  required
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="e.g. 75"
                                  value={t.min_mark}
                                  onChange={(e) => handleUpdateThresholdRow(idx, 'min_mark', Number(e.target.value))}
                                  className="w-full px-2.5 py-1 bg-white border border-line-border rounded-lg text-xs font-mono"
                                />
                              </td>
                              <td className="py-2.5 pr-2">
                                <input
                                  type="number"
                                  required
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="e.g. 100"
                                  value={t.max_mark}
                                  onChange={(e) => handleUpdateThresholdRow(idx, 'max_mark', Number(e.target.value))}
                                  className="w-full px-2.5 py-1 bg-white border border-line-border rounded-lg text-xs font-mono"
                                />
                              </td>
                              <td className="py-2.5 pr-2 text-center">
                                <select
                                  value={t.is_pass}
                                  onChange={(e) => handleUpdateThresholdRow(idx, 'is_pass', Number(e.target.value))}
                                  className="px-2.5 py-1 bg-white border border-line-border rounded-lg text-xs font-semibold text-ink"
                                >
                                  <option value={1}>🟢 Pass</option>
                                  <option value={0}>🔴 Fail</option>
                                </select>
                              </td>
                              <td className="py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteThresholdRow(idx)}
                                  className="p-1 hover:bg-brick-critical/10 text-brick-critical rounded transition-colors cursor-pointer"
                                  title="Delete Threshold Row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="submit"
                      disabled={thresholdSaving}
                      className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1.5 ml-auto disabled:opacity-50"
                    >
                      {thresholdSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Grading Thresholds</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


// ─── Tab: System Health ───────────────────────────────────────────────────────
// ─── Tab: System Health ───────────────────────────────────────────────────────
const HealthTab = ({ alerts, auditLogs = [], onRefresh }) => {
  const { activeSchoolId } = useAuth();
  
  // Local filter states
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [alertSearch, setAlertSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const displayAlerts = activeSchoolId ? alerts.filter(a => a.school_id === activeSchoolId) : alerts;
  const displayAuditLogs = activeSchoolId ? auditLogs.filter(l => l.school_id === activeSchoolId) : auditLogs;

  const handleResolve = async (id) => {
    await api.patch(`/admin/alerts/${id}`, { status: 'resolved' }); onRefresh();
  };

  // Filter Alerts
  const filteredAlerts = displayAlerts.filter(alert => {
    const matchesSearch = alertSearch ? alert.message?.toLowerCase().includes(alertSearch.toLowerCase()) : true;
    const matchesSeverity = severityFilter ? alert.severity === severityFilter : true;
    return matchesSearch && matchesSeverity;
  });
  const slicedAlerts = filteredAlerts.slice(0, 10);

  // Filter Audit Logs
  const filteredLogs = displayAuditLogs.filter(log => {
    const matchesSearch = logSearch 
      ? (log.username?.toLowerCase().includes(logSearch.toLowerCase()) || 
         log.description?.toLowerCase().includes(logSearch.toLowerCase())) 
      : true;
    const matchesAction = actionFilter ? log.action === actionFilter : true;
    return matchesSearch && matchesAction;
  });
  const uniqueActions = Array.from(new Set(displayAuditLogs.map(l => l.action).filter(Boolean)));
  const slicedLogs = filteredLogs.slice(0, 10);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Health status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-sage/30 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-teal-primary animate-pulse"/>
          </div>
          <div>
            <p className="text-xs font-bold text-ink/60 uppercase tracking-wider">API Status</p>
            <p className="text-sm font-bold text-teal-primary mt-0.5">Operational</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-sage/30 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-teal-primary"/>
          </div>
          <div>
            <p className="text-xs font-bold text-ink/60 uppercase tracking-wider">Database</p>
            <p className="text-sm font-bold text-teal-primary mt-0.5">Connected</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-sage/30 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-teal-primary"/>
          </div>
          <div>
            <p className="text-xs font-bold text-ink/60 uppercase tracking-wider">Active Alerts</p>
            <p className={`text-sm font-bold mt-0.5 ${displayAlerts.length > 0 ? 'text-brick-critical' : 'text-teal-primary'}`}>
              {displayAlerts.length > 0 ? `${displayAlerts.length} alert${displayAlerts.length !== 1 ? 's' : ''}` : 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Platform Alerts Log */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-3 border-b border-line-border/30">
          <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-brick-critical"/><span>Platform Alert Log (Showing last 10)</span>
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Search alert msg..." 
              value={alertSearch} 
              onChange={e => setAlertSearch(e.target.value)} 
              className="px-3 py-1.5 border border-line-border/30 rounded-xl text-xs bg-paper focus:outline-none focus:border-teal-primary w-full sm:w-48"
            />
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 border border-line-border/30 rounded-xl text-xs bg-paper text-ink focus:outline-none focus:border-teal-primary"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {slicedAlerts.map((alert, i) => (
            <div key={i} className={`p-4 border rounded-xl flex items-center justify-between text-xs ${
              alert.severity === 'critical'
                ? 'bg-brick-critical/5 border-brick-critical/20'
                : 'bg-amber-warning/5 border-amber-warning/20'
            }`}>
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    alert.severity === 'critical' ? 'bg-brick-critical text-paper' : 'bg-amber-warning text-paper'
                  }`}>{alert.severity}</span>
                  <span className="font-mono text-ink/40 text-[9px]">{alert.created_at}</span>
                </div>
                <p className="text-ink/80 font-medium">{alert.message}</p>
              </div>
              <button onClick={() => handleResolve(alert.id)} className="ml-4 px-3 py-1.5 border border-line-border rounded-lg text-[10px] font-semibold bg-white hover:bg-sage/10 text-ink flex-shrink-0 cursor-pointer">
                Resolve
              </button>
            </div>
          ))}
          {!slicedAlerts.length && (
            <div className="text-center py-10">
              <CheckCircle className="w-10 h-10 text-teal-primary/40 mx-auto mb-3"/>
              <p className="text-xs text-ink/50 font-semibold">No active matching platform alerts.</p>
            </div>
          )}
        </div>
      </div>

      {/* Audit Log Section */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-3 border-b border-line-border/30">
          <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
            <Activity className="w-5 h-5 text-teal-primary"/><span>Super Admin Audit Log (Showing last 10)</span>
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Search user / details..." 
              value={logSearch} 
              onChange={e => setLogSearch(e.target.value)} 
              className="px-3 py-1.5 border border-line-border/30 rounded-xl text-xs bg-paper focus:outline-none focus:border-teal-primary w-full sm:w-48"
            />
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="px-3 py-1.5 border border-line-border/30 rounded-xl text-xs bg-paper text-ink focus:outline-none focus:border-teal-primary"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(act => <option key={act} value={act}>{act}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-ink/5 sticky top-0 border-b border-line-border/30 z-10">
              <tr className="text-ink/50 uppercase tracking-wider font-bold text-[9px]">
                <th className="px-4 py-2 bg-paper/95 backdrop-filter backdrop-blur-sm">Timestamp</th>
                <th className="px-4 py-2 bg-paper/95 backdrop-filter backdrop-blur-sm">User</th>
                <th className="px-4 py-2 bg-paper/95 backdrop-filter backdrop-blur-sm">School</th>
                <th className="px-4 py-2 bg-paper/95 backdrop-filter backdrop-blur-sm">Action</th>
                <th className="px-4 py-2 bg-paper/95 backdrop-filter backdrop-blur-sm">Description</th>
                <th className="px-4 py-2 bg-paper/95 backdrop-filter backdrop-blur-sm">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/10">
              {slicedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-sage/5 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[9px] text-ink/50 whitespace-nowrap">{log.created_at}</td>
                  <td className="px-4 py-2.5 font-semibold text-ink">{log.username} <span className="text-[9px] font-normal text-ink/50">({log.role?.replace('_', ' ')})</span></td>
                  <td className="px-4 py-2.5 text-ink/65 max-w-[120px] truncate" title={log.school_name || 'System-wide'}>{log.school_name || 'System-wide'}</td>
                  <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded bg-ink/5 text-ink/75 font-mono text-[9px] font-semibold">{log.action}</span></td>
                  <td className="px-4 py-2.5 text-ink/80 max-w-[280px] truncate" title={log.description}>{log.description}</td>
                  <td className="px-4 py-2.5 font-mono text-[9px] text-ink/55">{log.ip_address || '—'}</td>
                </tr>
              ))}
              {!slicedLogs.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40 text-xs">No matching audit logs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CommandCenter = ({ defaultTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [schools,   setSchools]   = useState([]);
  const [alerts,    setAlerts]    = useState([]);
  const [licenses,  setLicenses]  = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/alerts'),
      api.get('/admin/licenses'),
      api.get('/schools'),
      api.get('/admin/audit-log'),
    ]).then(([statsRes, alertsRes, licRes, schoolsRes, auditRes]) => {
      setStats(statsRes.data);
      setAlerts(alertsRes.data || []);
      setLicenses(licRes.data || []);
      setSchools(schoolsRes.data || []);
      setAuditLogs(auditRes.data || []);
      setError('');
    }).catch(() => {
      setError('Failed to load platform data. Check backend connectivity.');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-line-border/30 pb-5">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">Super Admin Command Center</h1>
          <p className="text-sm font-sans text-ink/55 mt-1">Full platform control — tenants, licenses, curriculum &amp; system health.</p>
        </div>
        <button onClick={fetchAll} className="flex items-center space-x-1.5 px-3.5 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-colors cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 text-teal-primary"/>
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans">{error}</div>
      )}

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto gap-1 p-1 bg-ink/5 rounded-2xl flex-shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-teal-primary border border-line-border/30'
                  : 'text-ink/60 hover:text-ink hover:bg-white/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5"/>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary"/>
        </div>
      ) : (
        <>
          {activeTab === 'overview'  && <OverviewTab  stats={stats} onRefresh={fetchAll} schools={schools} />}
          {activeTab === 'schools'   && <SchoolsTab   schools={schools} licenses={licenses} onRefresh={fetchAll} />}
          {activeTab === 'licenses'  && <LicensesTab  licenses={licenses} schools={schools} onRefresh={fetchAll} />}
          {activeTab === 'config'    && <ConfigTab    schools={schools} />}
          {activeTab === 'health'    && <HealthTab    alerts={alerts} auditLogs={auditLogs} onRefresh={fetchAll} />}
        </>
      )}
    </div>
  );
};


export default CommandCenter;