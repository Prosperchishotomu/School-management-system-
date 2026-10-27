import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import {
  StatCard,
  KpiStrip,
  Card,
  StatusPill,
  EmptyState
} from '../../components/ui';
import {
  BookOpen, CalendarCheck, Clock, Award,
  CheckCircle, ArrowRight
} from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id || '';

  const { data: summaryData } = useApi(
    `student_dashboard_${schoolId}_${user?.id}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=student`)
  );

  const { data: resultsData } = useApi(
    `student_results_${schoolId}_${user?.id}`,
    () => api.get(`/schools/${schoolId}/results`)
  );

  const studentData = summaryData?.data?.role_specific || {};
  const subjects = resultsData?.data?.results?.[0]?.subjects || resultsData?.results?.[0]?.subjects || [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 bg-surface border border-line text-ink shadow-xs">
        <span className="text-[11px] font-mono tracking-wider text-brand-700 dark:text-brand-300 uppercase px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 block w-fit mb-1.5">
          Student Desk
        </span>
        <h1 className="text-2xl md:text-3xl font-display font-extrabold text-ink tracking-tight">
          Hello, {user?.name || user?.username || 'Student'}
        </h1>
        <p className="text-xs md:text-sm text-muted mt-1 max-w-xl">
          Welcome to your student learning portal. Review your enrolled subjects, continuous assessment marks, and attendance.
        </p>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Attendance Rate"
          value={`${studentData.attendance_pct ?? 0}%`}
          sublabel="Current term attendance"
          icon={CalendarCheck}
          iconColor="brand"
          to="/attendance"
        />

        <StatCard
          title="Overall Average"
          value={`${studentData.term_average ?? 0}%`}
          sublabel="Terminal performance average"
          icon={Award}
          iconColor="brand"
          to="/results"
        />

        <StatCard
          title="Active Subjects"
          value={`${studentData.subjects_count ?? subjects.length} Syllabi`}
          sublabel="Enrolled subject courses"
          icon={BookOpen}
          iconColor="info"
          to="/classes"
        />

        <StatCard
          title="Pending Tasks"
          value={`${studentData.upcoming_tasks ?? 0} Tasks`}
          sublabel="Coursework components"
          icon={Clock}
          iconColor="accent"
          to="/tasks"
        />
      </KpiStrip>

      {/* Primary Panels: Subject Grades & Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Current Subject Performance"
          subtitle="Latest continuous assessment averages"
          action={
            <button
              onClick={() => navigate('/results')}
              className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
            >
              Report Cards →
            </button>
          }
        >
          {subjects.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No continuous assessment marks recorded yet for this term.
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {subjects.map(s => (
                <div 
                  key={s.subject_id || s.subject_name} 
                  onClick={() => navigate('/results')}
                  className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-canvas/50 px-2 rounded-lg transition-colors"
                  title="Click to drill down to Results & Gradebook"
                >
                  <div>
                    <div className="font-semibold text-xs text-ink">{s.subject_name}</div>
                    <div className="text-[11px] text-muted">Syllabus component • View details →</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-ink tabular-nums">{s.average || 0}%</span>
                    <StatusPill status={s.is_pass ? "present" : "neutral"} label={s.grade_symbol || s.grade || '—'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Today's Timetable"
          subtitle="Classes and periods scheduled for today"
          action={
            <button
              onClick={() => navigate('/timetable')}
              className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
            >
              Full Timetable →
            </button>
          }
        >
          <div className="p-8 text-center text-xs text-muted">
            No class timetable sessions active for today.
          </div>
        </Card>
      </div>
    </div>
  );
}
