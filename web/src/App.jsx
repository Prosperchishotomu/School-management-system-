import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
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

// Protected Route wrapper component
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

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'super_admin') {
      return <Navigate to="/admin/command-center" replace />;
    }
    if (user.role === 'school_admin') {
      return <Navigate to="/school-admin/dashboard" replace />;
    }
    if (user.role === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />;
    }
    return <Navigate to="/parent/dashboard" replace />;
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
      <div className="min-h-screen bg-paper flex text-ink">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 md:ml-64 ml-0 min-h-screen bg-brick-critical/5 flex items-center justify-center p-8">
          <div className="max-w-md w-full glass-panel rounded-2xl p-8 border border-brick-critical/20 shadow-2xl text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-brick-critical/10 flex items-center justify-center mx-auto text-brick-critical">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-ink">School License Expired</h2>
              <p className="text-sm font-sans text-ink/65 mt-3 leading-relaxed">
                Your school's access license has expired and the grace period has ended. 
                Most essential operations have been suspended. 
                Please ask your school administrator to contact system support or renew the license key.
              </p>
            </div>
            <div className="border-t border-line-border/30 pt-6 flex justify-center space-x-3">
              <button 
                onClick={() => {
                  window.location.href = '/school-admin/license';
                }}
                className="px-5 py-2.5 bg-teal-primary text-white rounded-xl text-xs font-semibold cursor-pointer font-sans shadow"
              >
                View License desk
              </button>
              <button 
                onClick={() => {
                  sessionStorage.clear();
                  window.location.replace('/login');
                }}
                className="px-5 py-2.5 bg-ink text-paper rounded-xl text-xs font-semibold cursor-pointer font-sans shadow"
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
    <div className="min-h-screen bg-paper flex text-ink">
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-paper border-b border-line-border/30 px-6 flex items-center justify-between z-20">
        <span className="font-display font-bold text-ink">
          School<span className="text-teal-primary">Base</span>
        </span>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-sage/10 rounded-xl text-ink cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 md:ml-64 ml-0 min-h-screen bg-sage/5 overflow-y-auto pt-16 md:pt-0">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
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
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === 'super_admin' ? '/admin/command-center' : '/dashboard'} replace /> : <Home preOpenLogin={true} />}
      />

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
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
            {user?.role === 'super_admin' ? (
              <Navigate to="/admin/command-center" replace />
            ) : user?.role === 'school_admin' ? (
              <Navigate to="/school-admin/dashboard" replace />
            ) : user?.role === 'teacher' ? (
              <Navigate to="/teacher/dashboard" replace />
            ) : (
              <Navigate to="/parent/dashboard" replace />
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
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
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
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
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
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
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
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
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
          <ProtectedRoute allowedRoles={['school_admin', 'parent', 'super_admin']}>
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

      {/* Announcements */}
      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={['school_admin', 'teacher', 'parent', 'super_admin']}>
            <LayoutShell>
              <Announcements />
            </LayoutShell>
          </ProtectedRoute>
        }
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
          <ProtectedRoute allowedRoles={['super_admin']}>
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

      {/* Notifications settings */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <LayoutShell>
              <Notifications />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

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
          <ProtectedRoute allowedRoles={['school_admin', 'super_admin']}>
            <LayoutShell>
              <Classes />
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
          <ProtectedRoute allowedRoles={['parent', 'teacher', 'school_admin', 'super_admin']}>
            <LayoutShell>
              <LeaveRequests />
            </LayoutShell>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route
        path="*"
        element={
          <Navigate to={user ? (user.role === 'super_admin' ? '/admin/command-center' : '/dashboard') : '/login'} replace />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
