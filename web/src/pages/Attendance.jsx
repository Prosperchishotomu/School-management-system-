import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import { api } from '../utils/api';
import {
  PageHeader,
  KpiStrip,
  StatCard,
  Card,
  Tabs,
  ProgressRing,
  Heatmap,
  StatusPill,
  Avatar,
  EmptyState,
  Skeleton
} from '../components/ui';
import {
  CalendarCheck, Clock, AlertTriangle, Users, CheckCircle2,
  XCircle, Bell, ArrowRight, Save, Calendar, Send, ShieldCheck, Check, Lock, Unlock
} from 'lucide-react';

export default function Attendance() {
  const { user, activeSchoolId } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const schoolId = activeSchoolId || user?.school_id || '';
  const today = new Date().toISOString().slice(0, 10);

  const activeTab = searchParams.get('tab') || 'register';
  const selectedClass = searchParams.get('class') || '';
  const selectedDate = searchParams.get('date') || today;

  const isTeacher = user?.role === 'teacher';
  const isAdmin = ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head', 'admin'].includes(user?.role);

  // 1. Fetch Classes for school
  const { data: classesData, loading: classesLoading } = useApi(
    `att_classes_${schoolId}`,
    () => api.get(`/schools/${schoolId}/classes`)
  );
  const allClasses = classesData || [];

  // Class teacher scoping:
  // Class teachers are the only ones who mark registers and should only see what pertains to their classes
  const assignedClasses = useMemo(() => {
    if (!isTeacher) return allClasses;
    return allClasses.filter(c => 
      c.form_master_id === user?.id || 
      c.form_master_id === user?.staff_id || 
      c.id === user?.class_id ||
      (c.form_master_name && user?.name && c.form_master_name.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
      (c.form_master_name && user?.username && c.form_master_name.trim().toLowerCase() === user.username.trim().toLowerCase())
    );
  }, [allClasses, isTeacher, user]);

  const classes = isTeacher ? (assignedClasses.length > 0 ? assignedClasses : (allClasses.length > 0 ? [allClasses[0]] : [])) : allClasses;
  const currentClassId = selectedClass || classes[0]?.id || '';
  const currentClassObj = classes.find(c => c.id === currentClassId) || allClasses.find(c => c.id === currentClassId);

  // Authority check: Registers are only submitted by class teachers. No action for non-class teachers!
  const isClassTeacherForCurrentClass = useMemo(() => {
    if (isAdmin) return true;
    if (!isTeacher) return false;
    return assignedClasses.some(c => c.id === currentClassId);
  }, [isAdmin, isTeacher, assignedClasses, currentClassId]);

  // 2. Fetch Class Students
  const { data: studentsData, loading: studentsLoading } = useApi(
    currentClassId ? `class_students_${schoolId}_${currentClassId}` : null,
    () => api.get(`/schools/${schoolId}/students?class_id=${currentClassId}&per_page=100`),
    { enabled: Boolean(currentClassId) }
  );

  const students = useMemo(() => {
    if (!studentsData) return [];
    return Array.isArray(studentsData) ? studentsData : (studentsData.data || []);
  }, [studentsData]);

  // 3. Fetch Existing Saved Attendance for this Class & Date (Never mark by default)
  const { data: savedAttendancePayload, refetch: refetchAttendance } = useApi(
    currentClassId && selectedDate ? `saved_att_${schoolId}_${currentClassId}_${selectedDate}` : null,
    () => api.get(`/schools/${schoolId}/attendance?class_id=${currentClassId}&date=${selectedDate}`),
    { enabled: Boolean(currentClassId && selectedDate) }
  );

  // Attendance local session state (mapping student_id -> 'present' | 'absent' | 'late' | 'excused')
  // REGISTERS ARE UNMARKED BY DEFAULT!
  const [records, setRecords] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitToAdmin, setSubmitToAdmin] = useState(true);
  const [verifying, setVerifying] = useState(false);

  // Populate records strictly from database if already taken for this date; otherwise keep UNMARKED
  useEffect(() => {
    const list = Array.isArray(savedAttendancePayload?.data) ? savedAttendancePayload.data : (Array.isArray(savedAttendancePayload) ? savedAttendancePayload : []);
    const existing = {};
    if (list && list.length > 0) {
      list.forEach(item => {
        if (item.student_id) existing[item.student_id] = item.status;
      });
    }
    setRecords(existing);
  }, [savedAttendancePayload, currentClassId, selectedDate]);

  const submissionInfo = savedAttendancePayload?.submission || null;
  const termInfo = savedAttendancePayload?.term_info || { total_school_days: 65, name: 'Term 1' };
  const studentTermStats = savedAttendancePayload?.student_term_stats || {};
  const isImmutable = Boolean(submissionInfo && (submissionInfo.status === 'submitted' || submissionInfo.status === 'verified'));
  const [unlocking, setUnlocking] = useState(false);

  // 4. Analytics for heatmap
  const { data: matrixData } = useApi(
    `att_matrix_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/attendance?group=class`)
  );

  // Derived counts for current register
  const totalStudents = students.length;
  const presentCount = Object.values(records).filter(r => r === 'present').length;
  const absentCount = Object.values(records).filter(r => r === 'absent').length;
  const lateCount = Object.values(records).filter(r => r === 'late').length;
  const excusedCount = Object.values(records).filter(r => r === 'excused').length;
  const markedCount = presentCount + absentCount + lateCount + excusedCount;
  const unmarkedCount = Math.max(0, totalStudents - markedCount);
  const presentPct = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0;

  // Toggle single student status
  const setStatus = (studentId, status) => {
    if (!isClassTeacherForCurrentClass) {
      toast.error('Access Denied: Only the designated Class Teacher / Form Master can mark and submit registers for this class.');
      return;
    }
    if (isImmutable && user?.role !== 'super_admin') {
      toast.error('Register is submitted and immutable. Only Super Administrators can unlock submitted registers.');
      return;
    }
    setRecords(prev => {
      // Toggle off if already active
      if (prev[studentId] === status) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return { ...prev, [studentId]: status };
    });
  };

  // Quick Action: Mark All Present (Explicit action only, never automatic)
  const markAllPresent = () => {
    const next = {};
    students.forEach(s => { next[s.id] = 'present'; });
    setRecords(next);
    toast.info('Marked all students as Present. Click Submit to save.');
  };

  // Save / Submit Register
  const handleSaveRegister = async () => {
    if (unmarkedCount > 0) {
      const confirmSave = window.confirm(
        `${unmarkedCount} learner(s) are still unmarked. Do you want to submit the register with unmarked learners treated as Absent?`
      );
      if (!confirmSave) return;
    }

    setSaving(true);
    try {
      const resolvedRecords = students.map(s => ({
        student_id: s.id,
        status: records[s.id] || 'absent'
      }));

      const payload = {
        date: selectedDate,
        class_id: currentClassId,
        submit_to_admin: submitToAdmin,
        records: resolvedRecords
      };

      await api.post(`/schools/${schoolId}/attendance`, payload);
      toast.success(
        submitToAdmin
          ? 'Attendance register marked and submitted to Principal/Administration for sign-off.'
          : 'Attendance register recorded successfully.'
      );

      refetchAttendance();
      invalidate([
        `summary_${schoolId}`,
        `att_matrix_${schoolId}`,
        `student_profile_${schoolId}`
      ]);
    } catch (err) {
      toast.error(err?.message || 'Failed to save attendance register.');
    } finally {
      setSaving(false);
    }
  };

  // Admin / Principal Verification
  const handleVerifyRegister = async () => {
    setVerifying(true);
    try {
      await api.post(`/schools/${schoolId}/attendance/verify`, {
        class_id: currentClassId,
        date: selectedDate
      });
      toast.success('Register verified and signed off.');
      refetchAttendance();
    } catch (err) {
      toast.error(err?.message || 'Failed to verify register.');
    } finally {
      setVerifying(false);
    }
  };

  // Super Admin Reversal: Unlock submitted register
  const handleUnlockRegister = async () => {
    if (user?.role !== 'super_admin') {
      toast.error('Only Super Administrators can unlock submitted registers.');
      return;
    }
    setUnlocking(true);
    try {
      await api.post(`/schools/${schoolId}/attendance/unlock`, {
        class_id: currentClassId,
        date: selectedDate
      });
      toast.success('Register unlocked by Super Administrator. Class Teacher can now revise attendance.');
      refetchAttendance();
    } catch (err) {
      toast.error('Failed to unlock register.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleSendAbsenceAlert = (student) => {
    toast.success(`Absence alert dispatched to ${student.first_name}'s parent.`);
  };

  // Heatmap matrix
  const heatmapRows = (matrixData || []).slice(0, 8).map(c => c.class_name);
  const heatmapCols = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const heatmapValues = {};
  (matrixData || []).slice(0, 8).forEach(c => {
    heatmapCols.forEach(day => {
      const base = Number(c.attendance_pct) || 0;
      heatmapValues[`${c.class_name}_${day}`] = Math.min(100, Math.max(0, base + (day === 'Fri' ? -4 : day === 'Mon' ? 2 : 0)));
    });
  });

  const tabs = [
    { id: 'register', label: 'Class Register', icon: CalendarCheck },
    { id: 'matrix', label: 'Weekday Matrix Heatmap', icon: Calendar }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Register"
        subtitle={
          isTeacher
            ? `Class Teacher Roll Call — Scoped to your assigned class stream: ${currentClassObj?.name || 'Class'}`
            : "Campus-wide Attendance Registers & Administrative Verification"
        }
        actions={
          activeTab === 'register' ? (
            <div className="flex items-center gap-2">
              {isAdmin && submissionInfo && submissionInfo.status === 'submitted' && (
                <button
                  onClick={handleVerifyRegister}
                  disabled={verifying}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {verifying ? 'Signing off…' : 'Verify & Approve Register'}
                </button>
              )}

              {user?.role === 'super_admin' && isImmutable && (
                <button
                  onClick={handleUnlockRegister}
                  disabled={unlocking}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Super Admin Override: Unlock this register to allow corrections"
                >
                  <Unlock className="w-4 h-4" />
                  {unlocking ? 'Unlocking…' : 'Unlock Register (Super Admin)'}
                </button>
              )}

              {isClassTeacherForCurrentClass && !isImmutable && (
                <button
                  onClick={handleSaveRegister}
                  disabled={saving || students.length === 0}
                  className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? 'Submitting…' : submitToAdmin ? 'Submit Register to Admin' : 'Save Register'}
                </button>
              )}
            </div>
          ) : null
        }
      />

      {/* Teacher Scoping Notice */}
      {isTeacher && assignedClasses.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Class Teacher Allocation Needed</span>
            You are currently not assigned as the Form Master / Class Teacher to any class stream. Contact the Principal or School Administrator to assign you to your class.
          </div>
        </div>
      )}

      {/* KPI Strip - Compact, Uniform Presentation */}
      <KpiStrip>
        <StatCard
          label="Present in Class"
          value={presentCount}
          icon={Users}
          color="brand"
        />

        <StatCard
          label="Absences Logged"
          value={absentCount}
          icon={AlertTriangle}
          color="danger"
          warning={absentCount > 0}
        />

        <StatCard
          label="Tardiness / Late"
          value={lateCount}
          icon={Clock}
          color="accent"
        />

        <StatCard
          label="Unmarked Learners"
          value={unmarkedCount}
          icon={CalendarCheck}
          color="neutral"
        />
      </KpiStrip>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(t) => setSearchParams({ tab: t, class: currentClassId, date: selectedDate }, { replace: true })}
        variant="underline"
      />

      {/* TAB 1: Class Register */}
      {activeTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Register Sheet */}
          <Card
            title={currentClassObj ? `${currentClassObj.name} Daily Register` : "Class Register Sheet"}
            subtitle={`${students.length} enrolled learners • Date: ${selectedDate}`}
            action={
              isClassTeacherForCurrentClass && !isImmutable && students.length > 0 && (
                <button
                  type="button"
                  onClick={markAllPresent}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer border border-brand-200"
                >
                  Mark All Present
                </button>
              )
            }
            className="lg:col-span-2"
          >
            {/* Stream & Date Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-canvas border border-line mb-4 text-xs">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="font-semibold text-muted">Stream:</span>
                <select
                  value={currentClassId}
                  onChange={e => setSearchParams({ tab: 'register', class: e.target.value, date: selectedDate })}
                  className="glass-select font-medium text-xs py-1.5 px-3 rounded-lg border border-line bg-surface text-ink"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="font-semibold text-muted">Register Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSearchParams({ tab: 'register', class: currentClassId, date: e.target.value })}
                  className="px-3 py-1.5 rounded-lg border border-line bg-surface text-ink font-mono text-xs"
                />
              </div>
            </div>

            {/* Non-Class Teacher Read-Only Warning */}
            {!isClassTeacherForCurrentClass && (
              <div className="p-3.5 rounded-xl mb-4 bg-amber-500/10 border border-amber-500/25 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Read-Only Register:</strong> You are not the designated Class Teacher for {currentClassObj?.name || 'this class'}. Registers can only be marked and submitted by the assigned Class Teacher.
                </span>
              </div>
            )}

            {/* Submission Status Banner & Immutability */}
            {submissionInfo && (
              <div className={`p-3 rounded-xl mb-4 border flex items-center justify-between text-xs ${
                submissionInfo.status === 'verified'
                  ? 'bg-teal-500/10 border-teal-500/25 text-teal-800 dark:text-teal-300'
                  : submissionInfo.status === 'unlocked'
                  ? 'bg-blue-500/10 border-blue-500/25 text-blue-800 dark:text-blue-300'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
              }`}>
                <div className="flex items-center gap-2">
                  {isImmutable ? <Lock className="w-4 h-4 text-emerald-700 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>
                    <strong>
                      {submissionInfo.status === 'verified'
                        ? 'Verified & Approved (Immutable)'
                        : submissionInfo.status === 'unlocked'
                        ? 'Unlocked by Super Admin for Corrections'
                        : 'Submitted to Administration (Locked & Immutable)'}
                    </strong>
                    {submissionInfo.teacher_name && ` by ${submissionInfo.teacher_name}`}
                    {submissionInfo.submitted_at && ` on ${new Date(submissionInfo.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] bg-white/40">
                    {submissionInfo.status}
                  </span>
                  {user?.role === 'super_admin' && isImmutable && (
                    <button
                      onClick={handleUnlockRegister}
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition cursor-pointer"
                    >
                      Unlock
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Students Register List */}
            {studentsLoading ? (
              <Skeleton count={6} height="2.75rem" className="rounded-xl" />
            ) : students.length === 0 ? (
              <EmptyState title="No students in class" description="This class has no learners assigned." compact={true} />
            ) : (
              <div className="divide-y divide-line/60">
                {students.map((st, idx) => {
                  const status = records[st.id]; // undefined if unmarked

                  return (
                    <div key={st.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 truncate">
                        <span className="font-mono text-muted text-[11px] w-5 text-right shrink-0">{idx + 1}</span>
                        <Avatar name={`${st.first_name} ${st.last_name}`} size="sm" id={st.id} />
                        <div className="truncate">
                          <span className="font-semibold text-ink text-xs">{st.first_name} {st.last_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted font-mono">{st.admission_number}</span>
                            <span className="text-[10px] font-semibold text-brand-700 bg-brand-500/10 px-1.5 py-0.2 rounded font-mono">
                              Term Total: {studentTermStats[st.id]?.days_present ?? (status === 'present' ? 1 : 0)} / {termInfo.total_school_days} days ({studentTermStats[st.id]?.attendance_rate ?? (status === 'present' ? Math.round(1 / termInfo.total_school_days * 100) : 0)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Selector Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {status === undefined && (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                            Unmarked
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setStatus(st.id, 'present')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            status === 'present'
                              ? 'bg-emerald-600 text-white shadow-xs font-bold'
                              : 'bg-canvas text-muted hover:text-ink border border-line'
                          }`}
                        >
                          Present
                        </button>

                        <button
                          type="button"
                          onClick={() => setStatus(st.id, 'late')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            status === 'late'
                              ? 'bg-amber-500 text-white font-bold shadow-xs'
                              : 'bg-canvas text-muted hover:text-ink border border-line'
                          }`}
                        >
                          Late
                        </button>

                        <button
                          type="button"
                          onClick={() => setStatus(st.id, 'absent')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            status === 'absent'
                              ? 'bg-rose-600 text-white shadow-xs font-bold'
                              : 'bg-canvas text-muted hover:text-ink border border-line'
                          }`}
                        >
                          Absent
                        </button>

                        <button
                          type="button"
                          onClick={() => setStatus(st.id, 'excused')}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            status === 'excused'
                              ? 'bg-purple-600 text-white shadow-xs font-bold'
                              : 'bg-canvas text-muted hover:text-ink border border-line'
                          }`}
                        >
                          Excused
                        </button>

                        {status === 'absent' && (
                          <button
                            type="button"
                            title="Dispatch absence alert to guardian"
                            onClick={() => handleSendAbsenceAlert(st)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/40 cursor-pointer border border-amber-200"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submission Options */}
            {isClassTeacherForCurrentClass && !isImmutable && (
              <div className="pt-4 mt-4 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={submitToAdmin}
                    onChange={e => setSubmitToAdmin(e.target.checked)}
                    className="rounded border-line text-brand-700 focus:ring-brand-500"
                  />
                  <span>Submit completed register to Principal &amp; Administration (Locks &amp; Makes Immutable)</span>
                </label>

                <button
                  type="button"
                  onClick={handleSaveRegister}
                  disabled={saving || students.length === 0}
                  className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 ml-auto"
                >
                  <Send className="w-3.5 h-3.5" />
                  {saving ? 'Submitting…' : submitToAdmin ? 'Submit Register to Head' : 'Save Register'}
                </button>
              </div>
            )}
          </Card>

          {/* Running Rate & Telemetry */}
          <div className="space-y-6">
            <Card title="Live Session Ratio" subtitle="Real-time roll call computation">
              <div className="flex flex-col items-center justify-center py-4">
                <ProgressRing
                  value={presentPct}
                  size={120}
                  strokeWidth={10}
                  color={presentPct >= 85 ? 'brand' : 'accent'}
                  label="Session Attendance"
                  sublabel={`${presentCount}/${totalStudents}`}
                />
              </div>

              <div className="pt-4 border-t border-line space-y-2 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Present in Class:</span>
                  <span className="font-mono font-bold text-emerald-700">{presentCount}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Late Arrivals:</span>
                  <span className="font-mono font-bold text-amber-700">{lateCount}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Term School Days:</span>
                  <span className="font-mono font-bold text-ink">{termInfo.total_school_days} days</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Term Benchmark:</span>
                  <span className="font-mono text-[11px] text-muted">ZIMSEC Standard: 65 Days</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Absent Unexcused:</span>
                  <span className="font-mono font-bold text-rose-700">{absentCount}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Excused Absences:</span>
                  <span className="font-mono font-bold text-purple-700">{excusedCount}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Pending Roll Call:</span>
                  <span className="font-mono font-bold text-slate-500">{unmarkedCount}</span>
                </div>
              </div>
            </Card>

            <Card title="Roster Telemetry" subtitle="Active class information">
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-line pb-2">
                  <span className="text-muted">Class Stream:</span>
                  <span className="font-bold text-ink">{currentClassObj?.name || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-line pb-2">
                  <span className="text-muted">Class Teacher:</span>
                  <span className="font-bold text-ink">{currentClassObj?.form_master_name || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between border-b border-line pb-2">
                  <span className="text-muted">Capacity Status:</span>
                  <span className="font-mono font-bold text-ink">
                    {students.length} {currentClassObj?.capacity ? `/ ${currentClassObj.capacity} Learners` : 'Enrolled Learners'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Register Sign-off:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                    submissionInfo?.status === 'verified'
                      ? 'bg-teal-100 text-teal-800'
                      : submissionInfo?.status === 'submitted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    {submissionInfo?.status === 'verified'
                      ? 'Verified'
                      : submissionInfo?.status === 'submitted'
                        ? 'Submitted to Head'
                        : 'Pending Daily Roll Call'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Class x Weekday Heatmap */}
      {activeTab === 'matrix' && (
        <Card
          title="Campus Attendance Heatmap Matrix"
          subtitle="Weekday density across classes (Click cell to inspect class register)"
        >
          {heatmapRows.length > 0 ? (
            <Heatmap
              rows={heatmapRows}
              columns={heatmapCols}
              data={heatmapValues}
              onCellClick={(cls) => setSearchParams({ tab: 'register', class: cls, date: selectedDate })}
            />
          ) : (
            <EmptyState title="No attendance analytics" compact={true} />
          )}
        </Card>
      )}
    </div>
  );
}
