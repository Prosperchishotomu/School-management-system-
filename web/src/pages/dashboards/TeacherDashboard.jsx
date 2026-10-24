import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import {
  StatCard,
  KpiStrip,
  Card,
  ProgressRing,
  StatusPill,
  EmptyState,
  Skeleton
} from '../../components/ui';
import {
  Calendar, CheckCircle, Clock, GraduationCap, AlertTriangle,
  BookOpen, ArrowRight, MessageSquare, Layers
} from 'lucide-react';

export default function TeacherDashboard() {
  const { user, activeSchoolId } = useAuth();
  const navigate = useNavigate();
  const schoolId = activeSchoolId || user?.school_id || 'HARAREPR';

  const { data: summary } = useApi(
    `teacher_summary_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=teacher`)
  );

  const timetable = summary?.role_specific?.timetable_today || [
    { period: '1', time: '08:00 - 08:45', subject: 'Mathematics', class: 'Form 3 Gamma', status: 'completed' },
    { period: '2', time: '08:50 - 09:35', subject: 'Mathematics', class: 'Form 4 Delta', status: 'current' },
    { period: '3', time: '09:40 - 10:25', subject: 'Mathematics', class: 'Lower 6 Sciences', status: 'upcoming' },
    { period: '4', time: '10:45 - 11:30', subject: 'Combined Science', class: 'Form 2 Beta', status: 'upcoming' }
  ];

  return (
    <div className="space-y-6">
      {/* Hero Greeting */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2 py-0.5 rounded-full bg-white/10">
              Faculty Workspace
            </span>
            <span className="text-xs text-white/60 font-mono">
              Academic Term 1 • Week 7
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
            Welcome back, {user?.name || user?.username || 'Teacher'}
          </h1>
          <p className="text-xs md:text-sm text-brand-100/90 mt-1.5 max-w-2xl leading-relaxed">
            You have 4 teaching periods scheduled today. Period 2 is currently in session.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/attendance')}
            className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-700 text-white transition-colors shadow-sm cursor-pointer"
          >
            Mark Class Register
          </button>
        </div>
      </div>

      {/* Today's Timetable Horizontal Strip */}
      <Card
        title="Today's Timetable & Teaching Schedule"
        subtitle="Current and upcoming periods for today"
        action={
          <button
            onClick={() => navigate('/timetable')}
            className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
          >
            Full Timetable →
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {timetable.map((t, idx) => {
            const isNow = t.status === 'current';
            const isDone = t.status === 'completed';

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all ${
                  isNow
                    ? 'bg-brand-50 border-brand-500/80 ring-2 ring-brand-500/30 dark:bg-brand-950/40'
                    : isDone
                      ? 'bg-canvas/50 border-line/60 opacity-75'
                      : 'bg-surface border-line'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono font-bold text-muted uppercase">Period {t.period}</span>
                  {isNow ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-700 text-white uppercase tracking-wider animate-pulse">
                      In Session
                    </span>
                  ) : isDone ? (
                    <span className="text-[10px] text-brand-700 font-semibold">Done</span>
                  ) : (
                    <span className="text-[10px] text-muted">Upcoming</span>
                  )}
                </div>
                <div className="font-display font-bold text-sm text-ink">{t.subject}</div>
                <div className="text-xs text-muted mt-0.5">{t.class}</div>
                <div className="text-[10px] text-muted font-mono mt-2">{t.time}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Marks Entered"
          value="78%"
          sublabel="Mid-term CA components"
          icon={GraduationCap}
          iconColor="brand"
          to="/grades"
        />

        <StatCard
          title="Attendance Action"
          value="2 Classes"
          sublabel="Registers pending submission"
          icon={Calendar}
          iconColor="accent"
          to="/attendance"
        />

        <StatCard
          title="Students At Risk"
          value="6 Learners"
          sublabel="Attendance < 75% or fail grade"
          icon={AlertTriangle}
          iconColor="danger"
          to="/students"
        />

        <StatCard
          title="Schemes of Work"
          value="Week 7 Approved"
          sublabel="HOD reviewed & signed"
          icon={Layers}
          iconColor="brand"
          to="/academics/schemes"
        />
      </KpiStrip>

      {/* Visuals: Marks Entry Progress & Students At Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Marks Entry Progress Rings */}
        <Card
          title="Assessment Marks Completion"
          subtitle="Progress by assigned class stream"
          action={
            <button
              onClick={() => navigate('/grades')}
              className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
            >
              Gradebook →
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-4 py-3">
            <div className="flex flex-col items-center">
              <ProgressRing value={90} size={84} color="brand" label="Form 3 Gamma" />
            </div>
            <div className="flex flex-col items-center">
              <ProgressRing value={65} size={84} color="accent" label="Form 4 Delta" />
            </div>
            <div className="flex flex-col items-center">
              <ProgressRing value={85} size={84} color="brand" label="Lower 6 Sciences" />
            </div>
            <div className="flex flex-col items-center">
              <ProgressRing value={40} size={84} color="danger" label="Form 2 Beta" />
            </div>
          </div>
        </Card>

        {/* Students At Risk */}
        <Card
          title="Academic Interventions Required"
          subtitle="Learners falling below performance thresholds"
          className="lg:col-span-2"
        >
          <div className="divide-y divide-line/60">
            {[
              { name: 'Kudakwashe Zhou', class: 'Form 4 Delta', reason: 'Math mark 38% & 3 absences', severity: 'critical' },
              { name: 'Tariro Mhlanga', class: 'Form 3 Gamma', reason: 'Missed CALA Project 1 submission', severity: 'warning' },
              { name: 'Panashe Dube', class: 'Form 2 Beta', reason: 'Attendance dropped to 68%', severity: 'critical' },
              { name: 'Ruvimbo Chiwenga', class: 'Lower 6 Sciences', reason: 'Chemistry test score 42%', severity: 'warning' }
            ].map((s, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-ink">{s.name}</div>
                  <div className="text-[11px] text-muted">{s.class} • {s.reason}</div>
                </div>
                <StatusPill status={s.severity === 'critical' ? 'critical' : 'pending'} label={s.severity === 'critical' ? 'Action Required' : 'Monitor'} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
