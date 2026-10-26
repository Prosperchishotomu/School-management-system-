import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import Attendance from './pages/Attendance';
import Grades from './pages/Grades';
import Results from './pages/Results';
import Fees from './pages/Fees';
import Staff from './pages/Staff';
import AuditLog from './pages/AuditLog';
import CommandCenter from './pages/CommandCenter';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Enquiries from './pages/Enquiries';
import Discipline from './pages/Discipline';
import Library from './pages/Library';
import Assets from './pages/Assets';
import Announcements from './pages/Announcements';
import Timetable from './pages/Timetable';
import UserManagement from './pages/UserManagement';
import HealthRecords from './pages/HealthRecords';
import Exams from './pages/Exams';
import Reporting from './pages/Reporting';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';

// New security/robustness components
import ErrorBoundary from './components/ErrorBoundary';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LicenseStatus from './pages/LicenseStatus';
import SystemAdministration from './pages/SystemAdministration';
import Tasks from './pages/Tasks';
import Classes from './pages/Classes';
import ParentPortal from './pages/ParentPortal';
import LeaveRequests from './pages/LeaveRequests';
import Hostels from './pages/Hostels';
import Expenses from './pages/Expenses';
import SecuritySettings from './pages/SecuritySettings';
import StatusPage from './pages/StatusPage';
import SyncStatus from './components/layout/SyncStatus';

// Additional Domain Modules
import AcademicsSetup from './pages/AcademicsSetup';
import SchemesOfWork from './pages/SchemesOfWork';
import ZimsecBoard from './pages/ZimsecBoard';
import BoardingExeat from './pages/BoardingExeat';
import EmisReturns from './pages/EmisReturns';
import UserProfile from './pages/UserProfile';

// Clean role helper to determine home landing path
export function getHomeRoute(user) {
  if (!user) return '/login';
  const role = (user.role || '').toLowerCase().trim();
  if (role === 'super_admin') return '/admin/command-center';
  if (['school_admin', 'admin', 'principal', 'head', 'deputy_head', 'headmaster'].includes(role)) return '/school-admin/dashboard';
  if (['teacher', 'hod', 'faculty', 'instructor'].includes(role)) return '/teacher/dashboard';
  if (['parent', 'guardian'].includes(role)) return '/parent-portal';
  if (['student', 'learner', 'pupil'].includes(role)) return '/student/dashboard';
  if (['bursar', 'accountant'].includes(role)) return '/fees';
  if (['boarding_master', 'warden', 'matron', 'hostel_master'].includes(role)) return '/boarding/exeats';
  if (['nurse', 'doctor', 'medic'].includes(role)) return '/health-records';
  return '/dashboard';
}

// Protected Route wrapper component — removes restricted pages silently instead of showing 403
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-2 border-teal-primary/30 border-t-teal-primary rounded-full animate-spin"></div>
          <p className="text-xs font-sans text-ink/50 animate-pulse">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = (user.role || '').toLowerCase().trim();
  const isAdmin = ['super_admin', 'school_admin', 'admin', 'principal', 'head', 'deputy_head', 'headmaster'].includes(userRole);

  if (allowedRoles && allowedRoles.length > 0) {
    const isAllowed = 
      userRole === 'super_admin' ||
      allowedRoles.includes(userRole) ||
      (isAdmin && (allowedRoles.includes('school_admin') || allowedRoles.includes('head')));

    if (!isAllowed) {
      // Instead of loading error 403, silently remove the page for unprivileged users
      // by redirecting them directly to their designated workspace
      const destination = getHomeRoute(user);
      return <Navigate to={destination} replace />;
    }
  }

  return children;
};

import { AlertTriangle, Menu } from 'lucide-react';

// Main Layout Shell
const LayoutShell = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isExpired = sessionStorage.getItem('schoolbase_license_expired') === 'true';
  const isLicensePage = location.pathname === '/school-admin/license';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isExpired && user?.role !== 'super_admin' && !isLicensePage) {
    return (
      <div className="min-h-screen bg-canvas flex text-ink">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 lg:ml-[260px] ml-0 min-h-screen bg-danger/5 flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-md w-full glass-panel rounded-2xl p-6 sm:p-8 border border-danger/20 shadow-2xl text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto text-danger">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-ink">School License Expired</h2>
              <p className="text-sm font-sans text-muted mt-3 leading-relaxed">
                Your school's access license has expired and the grace period has ended. 
                Most essential operations have been suspended. 
                Please ask your school administrator to contact system support or renew the license key.
              </p>
            </div>
            <div className="border-t border-line pt-6 flex justify-center space-x-3">
              <button 
                onClick={() => {
                  window.location.href = '/school-admin/license';
                }}
                className="px-5 py-2.5 bg-brand-700 text-white rounded-xl text-xs font-semibold cursor-pointer font-sans shadow hover:bg-brand-900 transition-colors"
              >
                View License desk
              </button>
              <button 
                onClick={() => {
                  sessionStorage.clear();
                  window.location.replace('/login');
                }}
                className="px-5 py-2.5 bg-ink text-surface rounded-xl text-xs font-semibold cursor-pointer font-sans shadow hover:opacity-90 transition-opacity"
              >
                Log Out
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex text-ink overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 lg:ml-[260px] ml-0 min-h-screen bg-canvas overflow-y-auto w-full min-w-0 transition-all">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <SyncStatus />
        <div className="p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public: Landing page */}
      <Route path="/" element={<Home />} />

      {/* Public: Login */}
      <Route path="/login" element={<Login />} />

      {/* Public: Password Reset requests */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Super Admin Command Center */}
      <Route
        path="/admin/command-center"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <LayoutShell>
              <CommandCenter defaultTab="overview" />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/licenses"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <LayoutShell>
              <CommandCenter defaultTab="licenses" />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/alerts"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <LayoutShell>
              <CommandCenter defaultTab="health" />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Dashboard Redirect */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {user?.role === 'super_admin' ? (
              <Navigate to="/admin/command-center" replace />
            ) : ['school_admin', 'head', 'deputy_head', 'admin', 'principal', 'headmaster'].includes((user?.role || '').toLowerCase().trim()) ? (
              <Navigate to="/school-admin/dashboard" replace />
            ) : ['teacher', 'hod', 'faculty', 'instructor'].includes((user?.role || '').toLowerCase().trim()) ? (
              <Navigate to="/teacher/dashboard" replace />
            ) : ['bursar', 'accountant'].includes((user?.role || '').toLowerCase().trim()) ? (
              <Navigate to="/fees" replace />
            ) : ['boarding_master', 'warden', 'matron'].includes((user?.role || '').toLowerCase().trim()) ? (
              <Navigate to="/boarding/exeats" replace />
            ) : ['nurse', 'doctor', 'medic'].includes((user?.role || '').toLowerCase().trim()) ? (
              <Navigate to="/health-records" replace />
            ) : ['parent', 'guardian'].includes((user?.role || '').toLowerCase().trim()) ? (
              <Navigate to="/parent/dashboard" replace />
            ) : (
              <Navigate to="/student/dashboard" replace />
            )}
          </ProtectedRoute>
        }
      />

      {/* Role-Specific Dashboards */}
      <Route
        path="/school-admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin']}>
            <LayoutShell>
              <Dashboard />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* License status check (School admins) */}
      <Route
        path="/school-admin/license"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin']}>
            <LayoutShell>
              <LicenseStatus />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/dashboard"
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <LayoutShell>
              <Dashboard />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/dashboard"
        element={
          <ProtectedRoute allowedRoles={['parent']}>
            <LayoutShell>
              <Dashboard />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Students Directory */}
      <Route
        path="/students"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'super_admin']}>
            <LayoutShell>
              <Students />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Individual Student Profile */}
      <Route
        path="/students/:id"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'super_admin']}>
            <LayoutShell>
              <StudentProfile />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Attendance Register */}
      <Route
        path="/attendance"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'student', 'super_admin']}>
            <LayoutShell>
              <Attendance />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Grades entry */}
      <Route
        path="/grades"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'super_admin']}>
            <LayoutShell>
              <Grades />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Results / Report Card Ledger */}
      <Route
        path="/results"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'student', 'super_admin']}>
            <LayoutShell>
              <Results />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Fees / Payments Ledger */}
      <Route
        path="/fees"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'bursar', 'parent', 'student', 'super_admin']}>
            <LayoutShell>
              <Fees />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Staff Roster */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'super_admin']}>
            <LayoutShell>
              <Staff />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Audit Log */}
      <Route
        path="/audit-log"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <LayoutShell>
              <AuditLog />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Enquiries */}
      <Route
        path="/enquiries"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin']}>
            <LayoutShell>
              <Enquiries />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Discipline */}
      <Route
        path="/discipline"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin', 'teacher', 'parent']}>
            <LayoutShell>
              <Discipline />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Library */}
      <Route
        path="/library"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
            <LayoutShell>
              <Library />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* School Assets Registry */}
      <Route
        path="/assets"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin']}>
            <LayoutShell>
              <Assets />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Announcements bundled in notification hub */}
      <Route
        path="/announcements"
        element={<Navigate to="/notifications?tab=announcements" replace />}
      />

      {/* Timetable */}
      <Route
        path="/timetable"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
            <LayoutShell>
              <Timetable />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* User Management */}
      <Route
        path="/user-management"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'school_admin']}>
            <LayoutShell>
              <UserManagement />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Health Records */}
      <Route
        path="/health-records"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'super_admin']}>
            <LayoutShell>
              <HealthRecords />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Exams */}
      <Route
        path="/exams"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'super_admin']}>
            <LayoutShell>
              <Exams />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Reporting */}
      <Route
        path="/reporting"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'school_admin']}>
            <LayoutShell>
              <Reporting />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Notifications and unified chats */}
      <Route
        path="/messages"
        element={<Navigate to="/notifications?tab=chats" replace />}
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
            <LayoutShell>
              <Notifications />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      <Route path="/settings/security" element={<ProtectedRoute><LayoutShell><SecuritySettings /></LayoutShell></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><LayoutShell><UserProfile /></LayoutShell></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><LayoutShell><Timetable /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['head', 'deputy_head', 'school_admin', 'super_admin']}><LayoutShell><EmisReturns /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/reports/registers" element={<ProtectedRoute allowedRoles={['head', 'deputy_head', 'school_admin', 'super_admin']}><LayoutShell><Reporting /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/reports/emis" element={<ProtectedRoute allowedRoles={['head', 'deputy_head', 'school_admin', 'super_admin']}><LayoutShell><EmisReturns /></LayoutShell></ProtectedRoute>} />
      <Route path="/finance/dashboard" element={<ProtectedRoute allowedRoles={['bursar', 'school_admin', 'super_admin']}><LayoutShell><Fees /></LayoutShell></ProtectedRoute>} />
      <Route path="/finance/fee-structures" element={<ProtectedRoute allowedRoles={['bursar', 'school_admin', 'super_admin']}><LayoutShell><Fees /></LayoutShell></ProtectedRoute>} />
      <Route path="/finance/invoices" element={<ProtectedRoute allowedRoles={['bursar', 'parent', 'student', 'school_admin', 'super_admin']}><LayoutShell><Fees /></LayoutShell></ProtectedRoute>} />
      <Route path="/finance/payments" element={<ProtectedRoute allowedRoles={['bursar', 'parent', 'student', 'school_admin', 'super_admin']}><LayoutShell><Fees /></LayoutShell></ProtectedRoute>} />
      <Route path="/finance/expenses" element={<ProtectedRoute allowedRoles={['bursar', 'school_admin', 'super_admin']}><LayoutShell><Expenses /></LayoutShell></ProtectedRoute>} />
      <Route path="/finance/reports" element={<ProtectedRoute allowedRoles={['bursar', 'head', 'school_admin', 'super_admin']}><LayoutShell><Reporting /></LayoutShell></ProtectedRoute>} />
      <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><LayoutShell><Dashboard /></LayoutShell></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute allowedRoles={['student']}><LayoutShell><Results /></LayoutShell></ProtectedRoute>} />
      <Route path="/student/report-cards" element={<ProtectedRoute allowedRoles={['student']}><LayoutShell><Results /></LayoutShell></ProtectedRoute>} />
      <Route path="/parent/children/:id" element={<ProtectedRoute allowedRoles={['parent']}><LayoutShell><ParentPortal /></LayoutShell></ProtectedRoute>} />
      <Route path="/parent/fees/pay" element={<ProtectedRoute allowedRoles={['parent']}><LayoutShell><Fees /></LayoutShell></ProtectedRoute>} />
      <Route path="/parent/exeats" element={<ProtectedRoute allowedRoles={['parent']}><LayoutShell><BoardingExeat /></LayoutShell></ProtectedRoute>} />
      <Route path="/boarding/dashboard" element={<ProtectedRoute allowedRoles={['boarding_master', 'head', 'deputy_head', 'school_admin', 'super_admin']}><LayoutShell><BoardingExeat /></LayoutShell></ProtectedRoute>} />
      <Route path="/boarding/allocations" element={<ProtectedRoute allowedRoles={['boarding_master', 'head', 'deputy_head', 'school_admin', 'super_admin']}><LayoutShell><Hostels /></LayoutShell></ProtectedRoute>} />
      <Route path="/boarding/houses" element={<ProtectedRoute allowedRoles={['boarding_master', 'head', 'deputy_head', 'school_admin', 'super_admin']}><LayoutShell><Hostels /></LayoutShell></ProtectedRoute>} />
      <Route path="/health/dashboard" element={<ProtectedRoute allowedRoles={['nurse', 'school_admin', 'super_admin']}><LayoutShell><HealthRecords /></LayoutShell></ProtectedRoute>} />
      <Route path="/health/students/:id" element={<ProtectedRoute allowedRoles={['nurse', 'school_admin', 'super_admin']}><LayoutShell><HealthRecords /></LayoutShell></ProtectedRoute>} />
      <Route path="/guidance/sessions" element={<ProtectedRoute allowedRoles={['counsellor', 'school_admin', 'super_admin']}><LayoutShell><HealthRecords /></LayoutShell></ProtectedRoute>} />
      <Route path="/teacher/classes" element={<ProtectedRoute allowedRoles={['teacher', 'hod', 'school_admin', 'super_admin']}><LayoutShell><Classes /></LayoutShell></ProtectedRoute>} />
      <Route path="/teacher/attendance/:sectionId" element={<ProtectedRoute allowedRoles={['teacher', 'school_admin', 'super_admin']}><LayoutShell><Attendance /></LayoutShell></ProtectedRoute>} />
      <Route path="/teacher/timetable" element={<ProtectedRoute allowedRoles={['teacher', 'hod', 'school_admin', 'super_admin']}><LayoutShell><Timetable /></LayoutShell></ProtectedRoute>} />
      <Route path="/teacher/schemes" element={<ProtectedRoute allowedRoles={['teacher', 'hod', 'school_admin', 'super_admin']}><LayoutShell><SchemesOfWork /></LayoutShell></ProtectedRoute>} />
      <Route path="/teacher/marks-entry" element={<ProtectedRoute allowedRoles={['teacher', 'hod', 'school_admin', 'super_admin']}><LayoutShell><Grades /></LayoutShell></ProtectedRoute>} />
      <Route path="/teacher/students/:id" element={<ProtectedRoute allowedRoles={['teacher', 'hod', 'school_admin', 'super_admin']}><LayoutShell><StudentProfile /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/students/new" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']}><LayoutShell><Students /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/students/:id/subjects" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']}><LayoutShell><StudentProfile /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/enrollments" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']}><LayoutShell><Students /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/timetable/:sectionId" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']}><LayoutShell><Timetable /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/attendance" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']}><LayoutShell><Attendance /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/exams/:id/results" element={<ProtectedRoute allowedRoles={['head', 'school_admin', 'teacher', 'super_admin']}><LayoutShell><Exams /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/exam-entries/:id/import" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']}><LayoutShell><ZimsecBoard /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/library" element={<ProtectedRoute allowedRoles={['librarian', 'school_admin', 'super_admin']}><LayoutShell><Library /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/boarding" element={<ProtectedRoute allowedRoles={['boarding_master', 'school_admin', 'super_admin']}><LayoutShell><Hostels /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['head', 'school_admin', 'super_admin']}><LayoutShell><Dashboard /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['super_admin', 'school_admin']}><LayoutShell><UserManagement /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/staff/:id" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']}><LayoutShell><Staff /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/academics/:section" element={<ProtectedRoute allowedRoles={['head', 'school_admin', 'super_admin']}><LayoutShell><AcademicsSetup /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/admissions" element={<ProtectedRoute allowedRoles={['school_admin', 'head', 'super_admin']}><LayoutShell><Enquiries /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['school_admin', 'head', 'super_admin']}><LayoutShell><Announcements /></LayoutShell></ProtectedRoute>} />
      <Route path="/admin/calendar" element={<ProtectedRoute allowedRoles={['school_admin', 'head', 'super_admin']}><LayoutShell><Timetable /></LayoutShell></ProtectedRoute>} />
      <Route path="/403" element={<Navigate to="/dashboard" replace />} />
      <Route path="/404" element={<LayoutShell><StatusPage code={404} /></LayoutShell>} />

      {/* System Administration & Tasks */}
      <Route
        path="/admin/system-administration"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <LayoutShell>
              <SystemAdministration />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute allowedRoles={['teacher', 'school_admin', 'super_admin']}>
            <LayoutShell>
              <Tasks />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/classes"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'super_admin']}>
            <LayoutShell>
              <Classes />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hostels"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'boarding_master', 'super_admin']}>
            <LayoutShell>
              <Hostels />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'bursar', 'super_admin']}>
            <LayoutShell>
              <Expenses />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent-portal"
        element={
          <ProtectedRoute allowedRoles={['parent']}>
            <LayoutShell>
              <ParentPortal />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-requests"
        element={
          <ProtectedRoute allowedRoles={['teacher', 'school_admin', 'super_admin']}>
            <LayoutShell>
              <LeaveRequests />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academics/setup"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin']}>
            <LayoutShell>
              <AcademicsSetup />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academics/schemes"
        element={
          <ProtectedRoute allowedRoles={['teacher', 'hod', 'deputy_head', 'head', 'school_admin', 'super_admin']}>
            <LayoutShell>
              <SchemesOfWork />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/zimsec/portal"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin']}>
            <LayoutShell>
              <ZimsecBoard />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/boarding/exeats"
        element={
          <ProtectedRoute allowedRoles={['boarding_master', 'head', 'deputy_head', 'school_admin', 'parent', 'super_admin']}>
            <LayoutShell>
              <BoardingExeat />
            </LayoutShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/emis"
        element={
          <ProtectedRoute allowedRoles={['head', 'deputy_head', 'school_admin', 'super_admin']}>
            <LayoutShell>
              <EmisReturns />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route
        path="*"
        element={
          <Navigate to={user ? '/404' : '/login'} replace />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
