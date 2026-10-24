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
  EmptyState
} from '../../components/ui';
import {
  BookOpen, CalendarCheck, Clock, Award, FileText,
  Calendar, CheckCircle, ArrowRight
} from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const subjects = [
    { name: 'Mathematics', teacher: 'Mr. Chikomo', grade: 'A', score: 82 },
    { name: 'Physics', teacher: 'Mrs. Dube', grade: 'B', score: 74 },
    { name: 'Chemistry', teacher: 'Dr. Moyo', grade: 'A', score: 80 },
    { name: 'English Language', teacher: 'Ms. Sibanda', grade: 'A', score: 86 },
    { name: 'Computer Science', teacher: 'Mr. Mutasa', grade: 'A*', score: 91 }
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md">
        <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2 py-0.5 rounded-full bg-white/10 block w-fit mb-1.5">
          Student Desk
        </span>
        <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
          Hello, {user?.name || user?.username || 'Student'}
        </h1>
        <p className="text-xs md:text-sm text-brand-100/90 mt-1 max-w-xl">
          Welcome to your learning portal. 3 assignments are active and mid-term results are published.
        </p>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Attendance"
          value="95%"
          sublabel="41 of 43 days present"
          icon={CalendarCheck}
          iconColor="brand"
          to="/attendance"
        />

        <StatCard
          title="Overall Average"
          value="82.6%"
          sublabel="Top 5% in Form 3"
          icon={Award}
          iconColor="brand"
          to="/results"
        />

        <StatCard
          title="Active Subjects"
          value="5 Syllabi"
          sublabel="Full ZIMSEC science cohort"
          icon={BookOpen}
          iconColor="info"
          to="/classes"
        />

        <StatCard
          title="Pending Tasks"
          value="2 Projects"
          sublabel="CALA coursework components"
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
          <div className="divide-y divide-line/60">
            {subjects.map(s => (
              <div key={s.name} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-ink">{s.name}</div>
                  <div className="text-[11px] text-muted">{s.teacher}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-xs text-ink tabular-nums">{s.score}%</span>
                  <StatusPill status="present" label={s.grade} />
                </div>
              </div>
            ))}
          </div>
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
          <div className="space-y-2.5">
            {[
              { period: '1', time: '08:00 - 08:45', name: 'Mathematics', room: 'Lab 2' },
              { period: '2', time: '08:50 - 09:35', name: 'Computer Science', room: 'IT Lab A' },
              { period: '3', time: '09:40 - 10:25', name: 'Physics', room: 'Science Block' },
              { period: '4', time: '10:45 - 11:30', name: 'Chemistry', room: 'Lab 1' }
            ].map(t => (
              <div key={t.period} className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-ink">{t.name}</span>
                  <div className="text-[11px] text-muted">{t.room} • Period {t.period}</div>
                </div>
                <span className="font-mono text-[11px] text-muted">{t.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
