import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { initWebSocket } from '../../data/apiHooks';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ErrorBoundary from '../ErrorBoundary';
import { AlertTriangle } from 'lucide-react';

/**
 * AppShell — Base application layout shell for SchoolBase.
 * Deep-green sidebar (260px) + glass topbar + responsive content area.
 */
export default function AppShell({ children }) {
  const { user, activeSchoolId } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize WebSocket for real-time invalidation bus
  useEffect(() => {
    if (user) {
      const token = sessionStorage.getItem('schoolbase_token');
      const schoolId = activeSchoolId || user.school_id;
      initWebSocket(token, schoolId);
    }
  }, [user, activeSchoolId]);

  // License expiration check
  const isExpired = sessionStorage.getItem('schoolbase_license_expired') === 'true';
  const isLicensePage = location.pathname === '/school-admin/license';

  if (isExpired && user?.role !== 'super_admin' && !isLicensePage) {
    return (
      <div className="min-h-screen bg-canvas flex text-ink">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 lg:ml-[260px] ml-0 min-h-screen bg-red-500/5 flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card p-8 text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-display font-bold text-ink">
              School License Expired
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Your school's access license has expired. Please contact your system administrator or renew the license key.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <a
                href="/school-admin/license"
                className="btn-primary"
              >
                Renew License
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex text-ink">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-[260px] ml-0 flex flex-col min-w-0 min-h-screen">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-fadeIn">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
