import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import BursarDashboard from './dashboards/BursarDashboard';
import TeacherDashboard from './dashboards/TeacherDashboard';
import ParentDashboard from './dashboards/ParentDashboard';
import StudentDashboard from './dashboards/StudentDashboard';
import WardenDashboard from './dashboards/WardenDashboard';
import NurseDashboard from './dashboards/NurseDashboard';
import SuperAdminDashboard from './dashboards/SuperAdminDashboard';

/**
 * Dashboard Router (Section 5)
 * Route /dashboard renders the role's dashboard.
 * Each role gets its own tailored dashboard composed of visuals that fit that role's job.
 * Non-negotiable rule #2: Never generic. No two dashboards share a layout by default.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const rawRole = (user?.role || '').toLowerCase().trim();

  if (rawRole === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  if (['school_admin', 'head', 'deputy_head', 'principal', 'headmaster', 'admin'].includes(rawRole)) {
    return <AdminDashboard />;
  }

  if (['teacher', 'hod', 'faculty', 'instructor'].includes(rawRole)) {
    return <TeacherDashboard />;
  }

  if (rawRole === 'bursar' || rawRole === 'accountant') {
    return <BursarDashboard />;
  }

  if (rawRole === 'parent' || rawRole === 'guardian') {
    return <ParentDashboard />;
  }

  if (rawRole === 'student' || rawRole === 'learner' || rawRole === 'pupil') {
    return <StudentDashboard />;
  }

  if (['boarding_master', 'warden', 'matron', 'hostel_master'].includes(rawRole)) {
    return <WardenDashboard />;
  }

  if (['nurse', 'doctor', 'medic'].includes(rawRole)) {
    return <NurseDashboard />;
  }

  // Safe fallback for standard learners / general users — never expose admin analytics
  return <StudentDashboard />;
}
