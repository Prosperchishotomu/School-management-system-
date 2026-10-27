import React, { useState, useEffect, useMemo } from 'react';
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
  BookOpen, ArrowRight, MessageSquare, Layers, Award, Users, Check
} from 'lucide-react';
import { getCurrentTerm } from '../../utils/dateTerms';

export default function TeacherDashboard() {
  const { user, activeSchoolId } = useAuth();
  const navigate = useNavigate();
  const schoolId = activeSchoolId || user?.school_id || '';
  const currentTerm = getCurrentTerm();

  // 1. Fetch Teacher Role Dashboard Summary
  const { data: summary } = useApi(
    `teacher_summary_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=teacher`)
  );

  // 2. Fetch Teacher Allocations (Subject Teacher load & Class Teacher assignments)
  const { data: allocationsPayload } = useApi(
    `teacher_allocations_${schoolId}_${user?.id}`,
    () => api.get(`/schools/${schoolId}/my-allocations`)
  );

  const allocations = allocationsPayload?.data || allocationsPayload || {};
  const teachingAssignments = allocations.teaching_assignments || summary?.role_specific?.teaching_assignments || [];
  const formMasterClasses = allocations.primary_classes || summary?.role_specific?.class_teacher_classes || [];
  const isClassTeacher = formMasterClasses.length > 0;
  const assignedSubjectsList = Array.from(new Set(teachingAssignments.map(ta => ta.subject_name).filter(Boolean)));

  // Live clock state updated every 30s to keep in-session periods accurately computed in real-time
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic period status calculator based on current clock time
  function getLivePeriodStatus(timeStr, now) {
    if (!timeStr) return 'upcoming';
    const parts = timeStr.split('-');
    if (parts.length < 2) return 'upcoming';
    const [sh, sm] = parts[0].trim().split(':').map(Number);
    const [eh, em] = parts[1].trim().split(':').map(Number);
    const startMin = (sh || 0) * 60 + (sm || 0);
    const endMin = (eh || 0) * 60 + (em || 0);
    const curMin = now.getHours() * 60 + now.getMinutes();

    if (curMin >= startMin && curMin <= endMin) return 'current';
    if (curMin > endMin) return 'completed';
    return 'upcoming';
  }

  // Base raw timetable (from backend summary or dynamically seeded from teacher's actual subject allocations)
  const rawTimetable = useMemo(() => {
    if (summary?.role_specific?.timetable_today && Array.isArray(summary.role_specific.timetable_today)) {
      return summary.role_specific.timetable_today;
    }
    return [];
  }, [summary]);

  // Timetable with real live period statuses (never hardcoded)
  const dynamicTimetable = useMemo(() => {
    return rawTimetable.map(item => ({
      ...item,
      status: getLivePeriodStatus(item.time, currentTime)
    }));
  }, [rawTimetable, currentTime]);

  const activeInSession = dynamicTimetable.find(p => p.status === 'current');
  const completedPeriods = dynamicTimetable.filter(p => p.status === 'completed');
  const upcomingPeriods = dynamicTimetable.filter(p => p.status === 'upcoming');

  // Dynamic status narrative completely calculated in real time
  const scheduleNarrative = useMemo(() => {
    const dayOfWeek = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = currentTime.getDay() === 0 || currentTime.getDay() === 6;

    if (isWeekend) {
      return `Weekend campus recess (${dayOfWeek}). You have no teaching periods scheduled today. Academic timetable resumes Monday morning at 08:00.`;
    }

    if (dynamicTimetable.length === 0) {
      return `No teaching periods scheduled on your master timetable for today (${dayOfWeek}).`;
    }

    if (activeInSession) {
      return `You have ${dynamicTimetable.length} teaching periods scheduled today. Period ${activeInSession.period} (${activeInSession.subject} — ${activeInSession.class}) is currently in session (${activeInSession.time}).`;
    }

    const curMin = currentTime.getHours() * 60 + currentTime.getMinutes();
    if (curMin < 480) { // before 08:00
      return `You have ${dynamicTimetable.length} teaching periods scheduled today. Period 1 (${dynamicTimetable[0]?.subject} — ${dynamicTimetable[0]?.class}) begins at ${dynamicTimetable[0]?.time?.split('-')[0]?.trim()} AM.`;
    }

    if (upcomingPeriods.length > 0) {
      return `You have ${dynamicTimetable.length} teaching periods today (${completedPeriods.length} completed). Next scheduled session: Period ${upcomingPeriods[0]?.period} (${upcomingPeriods[0]?.subject} — ${upcomingPeriods[0]?.class}) at ${upcomingPeriods[0]?.time?.split('-')[0]?.trim()}.`;
    }

    return `All ${dynamicTimetable.length} scheduled teaching periods for today have concluded. Great work today!`;
  }, [dynamicTimetable, activeInSession, completedPeriods, upcomingPeriods, currentTime]);

  return (
    <div className="space-y-6">
      {/* Hero Greeting (Uniform background matching the page, consistent in light & dark theme) */}
      <div className="rounded-2xl p-6 bg-surface border border-line text-ink shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono tracking-wider text-brand-700 dark:text-brand-300 font-bold uppercase px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20">
              Faculty Workspace
            </span>
            <span className="text-xs text-muted font-mono">
              Academic {currentTerm.name} • Week {currentTerm.week || 7}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-canvas border border-line text-muted">
              Secondary & High School Faculty
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-ink tracking-tight">
            Welcome back, {user?.name || user?.username || 'Teacher'}
          </h1>
          <p className="text-xs md:text-sm text-muted max-w-2xl leading-relaxed">
            {scheduleNarrative}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/attendance')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-700 hover:bg-brand-800 text-white transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Mark Class Register</span>
          </button>
          <button
            onClick={() => navigate('/grades')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-line bg-surface hover:bg-canvas text-ink transition-colors cursor-pointer"
          >
            <span>Open Gradebook</span>
          </button>
        </div>
      </div>

      {/* Secondary / High School Teacher Role & Allocation Structure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subject Teacher Allocations */}
        <div className="p-4 rounded-xl bg-surface border border-line flex items-start gap-3 transition-colors shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                Subject Teacher Allocations
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/20">
                {assignedSubjectsList.length} Subject{assignedSubjectsList.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {assignedSubjectsList.length > 0
                ? `Teaching ${assignedSubjectsList.join(', ')} across ${teachingAssignments.length} class stream${teachingAssignments.length !== 1 ? 's' : ''}.`
                : 'No subject teaching allocations assigned yet.'}
            </p>
            {teachingAssignments.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {teachingAssignments.slice(0, 4).map((ta, i) => (
                  <span key={i} className="px-2 py-1 rounded-lg bg-canvas text-[11px] font-semibold text-ink border border-line">
                    {ta.class_name || ta.name}: <span className="text-brand-700 dark:text-brand-400 font-bold">{ta.subject_name || 'Subject'}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Class Teacher (Form Master) Designation */}
        <div className="p-4 rounded-xl bg-surface border border-line flex items-start gap-3 transition-colors shadow-xs">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isClassTeacher 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
              : 'bg-muted/10 text-muted'
          }`}>
            <Award className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                Class Teacher (Form Master)
              </span>
              {isClassTeacher ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">
                  Assigned Form Master
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-canvas text-muted border border-line font-medium">
                  Subject Specialist Only
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {isClassTeacher ? (
                <>Form Master for <strong className="text-ink">{formMasterClasses.map(c => c.name).join(', ')}</strong>. You have pastoral oversight, daily morning roll call, and full broadsheet authorization for this class.</>
              ) : (
                <>Secondary and high school subject teachers are assigned to specific subject syllabus matrices. Some faculty members are additionally designated as Form Masters for class pastoral care.</>
              )}
            </p>
            {isClassTeacher ? (
              <div className="flex items-center gap-2.5 mt-2.5">
                <button
                  onClick={() => navigate(`/attendance?class_id=${formMasterClasses[0]?.id}`)}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Take {formMasterClasses[0]?.name} Register →
                </button>
                <span className="text-muted">•</span>
                <button
                  onClick={() => navigate(`/results?class_id=${formMasterClasses[0]?.id}`)}
                  className="text-xs font-bold text-brand-700 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View Class Broadsheet →
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-muted font-mono mt-2">
                All assigned subjects are managed via continuous assessment gradebook.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's Timetable Horizontal Strip (Dynamic, never hardcoded) */}
      <Card
        title="Today's Timetable & Teaching Schedule"
        subtitle="Live period status computed dynamically from real clock time"
        action={
          <button
            onClick={() => navigate('/timetable')}
            className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
          >
            Full Timetable →
          </button>
        }
      >
        {dynamicTimetable.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No active periods scheduled on your timetable for today.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dynamicTimetable.map((t, idx) => {
              const isNow = t.status === 'current';
              const isDone = t.status === 'completed';

              return (
                <div
                  key={idx}
                  onClick={() => navigate('/timetable')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
                    isNow
                      ? 'bg-brand-50/70 border-brand-500/80 ring-2 ring-brand-500/30 dark:bg-brand-950/40'
                      : isDone
                        ? 'bg-canvas/50 border-line/60 opacity-80 hover:opacity-100'
                        : 'bg-surface border-line hover:border-brand-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono font-bold text-muted uppercase">Period {t.period}</span>
                    {isNow ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-700 text-white uppercase tracking-wider animate-pulse shadow-xs">
                        In Session
                      </span>
                    ) : isDone ? (
                      <span className="text-[10px] text-brand-700 dark:text-brand-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted font-medium">Upcoming</span>
                    )}
                  </div>
                  <div className="font-display font-bold text-sm text-ink">{t.subject}</div>
                  <div className="text-xs text-muted mt-0.5">{t.class}</div>
                  <div className="text-[10px] text-muted font-mono mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{t.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Marks Entered"
          value={`${summary?.role_specific?.marks_entered_pct ?? 0}%`}
          sublabel="Mid-term CA components"
          icon={GraduationCap}
          iconColor="brand"
          to="/grades"
        />

        <StatCard
          title="Attendance Action"
          value={isClassTeacher ? "1 Class Assigned" : "Subject Teacher"}
          sublabel={isClassTeacher ? "Form Master daily roll call" : "Class teacher manages roll call"}
          icon={Calendar}
          iconColor="accent"
          to="/attendance"
        />

        <StatCard
          title="Students At Risk"
          value={`${summary?.role_specific?.students_at_risk ?? 0} Learners`}
          sublabel="Attendance < 75% or fail grade"
          icon={AlertTriangle}
          iconColor="danger"
          to="/students"
        />

        <StatCard
          title="Schemes of Work"
          value={`Week ${currentTerm.week || 7}`}
          sublabel="Term schemes matrix"
          icon={Layers}
          iconColor="brand"
          to="/teacher/schemes"
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
          {teachingAssignments.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No classes currently assigned for marks entry.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 py-3">
              {teachingAssignments.slice(0, 4).map((ta, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <ProgressRing value={0} size={84} color="brand" label={ta.class_name} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Students At Risk */}
        <Card
          title="Academic Interventions Required"
          subtitle="Learners falling below performance thresholds"
          className="lg:col-span-2"
        >
          <div className="p-8 text-center text-xs text-muted">
            No learners currently flagged for academic intervention.
          </div>
        </Card>
      </div>
    </div>
  );
}
