import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import { api } from '../utils/api';
import {
  PageHeader,
  KpiStrip,
  StatCard,
  Card,
  StatusPill,
  EmptyState,
  Skeleton,
  Modal
} from '../components/ui';
import {
  GraduationCap, CheckCircle2, AlertCircle, TrendingUp, Award, Users, BookOpen,
  Sliders, Plus, Trash2, RotateCcw, Check, Sparkles, Lock, Unlock, Send,
  FileSpreadsheet, Printer, Shield, AlertTriangle
} from 'lucide-react';

export default function Grades() {
  const { user, activeSchoolId, activeSchool } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // If a parent attempts to access Grades mark entry, redirect immediately to Results
  if (user?.role === 'parent' || user?.role === 'guardian') {
    return <Navigate to="/results" replace />;
  }

  const schoolId = activeSchoolId || user?.school_id || '';
  const paramClass = searchParams.get('class') || '';
  const paramSubject = searchParams.get('subject') || '';

  // 1. Fetch Teacher / Admin Allocations
  const { data: allocationsData } = useApi(
    `my_allocations_${schoolId}`,
    () => api.get(`/schools/${schoolId}/my-allocations`)
  );
  const allocations = allocationsData?.data || allocationsData || {};
  const isAdmin = allocations.is_admin || ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head'].includes(user?.role);

  // 2. Fetch All Classes
  const { data: classesData } = useApi(
    `grades_classes_${schoolId}`,
    () => api.get(`/schools/${schoolId}/classes`)
  );
  const allClasses = Array.isArray(classesData?.data) ? classesData.data : (Array.isArray(classesData) ? classesData : []);

  // Determine available classes based on teacher allocations
  const availableClasses = useMemo(() => {
    if (isAdmin || !allocations) return allClasses;

    const teacherClassMap = new Map();
    // Primary class teacher allocations
    (allocations.primary_classes || []).forEach(c => teacherClassMap.set(c.id, c));
    // Secondary teaching assignments
    (allocations.teaching_assignments || []).forEach(ta => {
      const cls = allClasses.find(c => c.id === ta.class_id) || {
        id: ta.class_id,
        name: ta.class_name,
        grade_level: ta.class_level || 'Secondary'
      };
      teacherClassMap.set(cls.id, cls);
    });

    const teacherClasses = Array.from(teacherClassMap.values());
    return teacherClasses.length > 0 ? teacherClasses : allClasses;
  }, [isAdmin, allocations, allClasses]);

  // Current selected class ID
  const currentClassId = paramClass || availableClasses[0]?.id || '';
  const currentClass = allClasses.find(c => c.id === currentClassId) || availableClasses[0];

  // 3. Fetch All Subjects
  const { data: subjectsData } = useApi(
    `grades_subjects_${schoolId}`,
    () => api.get(`/schools/${schoolId}/subjects`)
  );
  const allSubjects = Array.isArray(subjectsData?.data) ? subjectsData.data : (Array.isArray(subjectsData) ? subjectsData : []);

  // Determine available subjects for current selected class
  const availableSubjects = useMemo(() => {
    if (isAdmin) return allSubjects;

    // Check if user is primary class teacher for this class
    const isPrimaryClassTeacher = (allocations.primary_classes || []).some(c => c.id === currentClassId);
    const isPrimaryLevel = !currentClass?.level || currentClass.level.toLowerCase().includes('primary') || (currentClass.name || '').toLowerCase().includes('grade');

    if (isPrimaryClassTeacher && isPrimaryLevel) {
      return allSubjects;
    }

    // Secondary subject teacher scoping: only show assigned subjects for this class
    const assignmentsForClass = (allocations.teaching_assignments || []).filter(ta => ta.class_id === currentClassId);
    if (assignmentsForClass.length > 0) {
      return assignmentsForClass.map(ta => ({
        id: ta.subject_id,
        name: ta.subject_name,
        code: ta.subject_code || ta.subject_name.substring(0, 4).toUpperCase()
      }));
    }

    return assignmentsForClass.length > 0 ? assignmentsForClass : [];
  }, [isAdmin, allocations, currentClassId, currentClass, allSubjects]);

  // Current selected subject
  const selectedSubject = useMemo(() => {
    if (paramSubject && availableSubjects.some(s => s.name?.toLowerCase() === paramSubject.toLowerCase())) {
      return paramSubject;
    }
    return availableSubjects[0]?.name || '';
  }, [paramSubject, availableSubjects]);

  // 4. Fetch Class Grades and Scoped Student Roster from Backend
  const { data: gradesData, loading: gradesLoading } = useApi(
    currentClassId && selectedSubject ? `gradebook_${schoolId}_${currentClassId}_${selectedSubject}` : null,
    () => api.get(`/schools/${schoolId}/classes/${currentClassId}/grades?subject=${encodeURIComponent(selectedSubject)}`),
    { enabled: Boolean(currentClassId && selectedSubject) }
  );

  const gradebookPayload = gradesData?.data || gradesData || {};
  const isImmutable = Boolean(gradebookPayload?.is_immutable);
  const submissionInfo = gradebookPayload?.submission;
  const isClassTeacher = Boolean(gradebookPayload?.is_class_teacher || isAdmin);
  const isSuperAdmin = user?.role === 'super_admin';

  // Mode: 'entry' (Subject Mark Entry) vs 'broadsheet' (Class Broadsheet All Subjects)
  const [viewMode, setViewMode] = useState('entry');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submittingToAdmin, setSubmittingToAdmin] = useState(false);
  const [submitNotes, setSubmitNotes] = useState('');

  // Fetch Class Broadsheet on demand when in broadsheet view
  const { data: broadsheetPayload, loading: broadsheetLoading } = useApi(
    viewMode === 'broadsheet' && currentClassId ? `grades_broadsheet_${schoolId}_${currentClassId}` : null,
    () => api.get(`/schools/${schoolId}/classes/${currentClassId}/grades/broadsheet`),
    { enabled: viewMode === 'broadsheet' && Boolean(currentClassId) }
  );
  const broadsheetData = broadsheetPayload?.data || broadsheetPayload || {};
  const broadsheetStudents = broadsheetData?.students || [];
  const broadsheetSubjects = broadsheetData?.subjects || [];

  const handleSubmitToAdmin = async () => {
    setSubmittingToAdmin(true);
    try {
      const res = await api.post(`/schools/${schoolId}/classes/${currentClassId}/grades/submit-to-admin`, {
        term: 'Term 3',
        year: new Date().getFullYear(),
        notes: submitNotes || `Term 3 grades submitted by ${user?.first_name || user?.name || 'Class Teacher'}`
      });
      toast.success(res.data?.data?.message || res.data?.message || 'Class marks submitted to Administration and locked as immutable.');
      setShowSubmitModal(false);
      setSubmitNotes('');
      invalidate([
        `gradebook_${schoolId}_${currentClassId}_${selectedSubject}`,
        `grades_classes_${schoolId}`,
        `grades_broadsheet_${schoolId}_${currentClassId}`,
        `admin_analytics_${schoolId}`,
        `analytics_${schoolId}`
      ]);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to submit marks.');
    } finally {
      setSubmittingToAdmin(false);
    }
  };

  const handleUnlockGrades = async () => {
    if (!window.confirm('Are you sure you want to unlock these grades? This will permit modifications until submitted again.')) return;
    try {
      const res = await api.post(`/schools/${schoolId}/classes/${currentClassId}/grades/unlock`, {
        term: 'Term 3',
        year: new Date().getFullYear()
      });
      toast.success(res.data?.data?.message || res.data?.message || 'Class marks unlocked successfully.');
      invalidate([
        `gradebook_${schoolId}_${currentClassId}_${selectedSubject}`,
        `grades_classes_${schoolId}`,
        `grades_broadsheet_${schoolId}_${currentClassId}`,
        `admin_analytics_${schoolId}`,
        `analytics_${schoolId}`
      ]);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to unlock grades.');
    }
  };

  const students = useMemo(() => {
    if (Array.isArray(gradebookPayload.students) && gradebookPayload.students.length > 0) {
      return gradebookPayload.students;
    }
    return [];
  }, [gradebookPayload]);

  // Assessment columns (Teacher configurable: Add, edit name, edit max marks, remove)
  const defaultColumns = useMemo(() => [
    { id: 'ca1', label: 'Test 1', max: 20 },
    { id: 'ca2', label: 'CALA / Project', max: 30 },
    { id: 'exam', label: 'Exam Paper', max: 50 }
  ], []);

  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(`sb_grade_cols_${schoolId}_${currentClassId}_${selectedSubject}`);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return defaultColumns;
  });

  // Load saved columns whenever class or subject changes
  useEffect(() => {
    if (!currentClassId || !selectedSubject) return;
    try {
      const saved = localStorage.getItem(`sb_grade_cols_${schoolId}_${currentClassId}_${selectedSubject}`);
      if (saved) {
        setColumns(JSON.parse(saved));
        return;
      }
    } catch (_) {}
    setColumns(defaultColumns);
  }, [schoolId, currentClassId, selectedSubject, defaultColumns]);

  // Test configuration modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configCols, setConfigCols] = useState([]);

  const openConfigModal = () => {
    setConfigCols(columns.map(c => ({ ...c })));
    setShowConfigModal(true);
  };

  const handleSaveColumns = () => {
    if (!configCols || configCols.length === 0) {
      toast.error('You must keep at least one assessment test.');
      return;
    }
    const sanitized = configCols.map((c, i) => ({
      id: c.id || `test_${i + 1}`,
      label: c.label?.trim() || `Test ${i + 1}`,
      max: Math.max(1, Number(c.max) || 100)
    }));
    setColumns(sanitized);
    try {
      localStorage.setItem(`sb_grade_cols_${schoolId}_${currentClassId}_${selectedSubject}`, JSON.stringify(sanitized));
    } catch (_) {}
    toast.success('Assessment tests & max marks saved for this subject.');
    setShowConfigModal(false);
  };

  const handleResetColumns = () => {
    setConfigCols(defaultColumns.map(c => ({ ...c })));
  };

  const handleAddTest = () => {
    const nextIdx = configCols.length + 1;
    setConfigCols([
      ...configCols,
      { id: `test_${Date.now().toString(36)}`, label: `Test ${nextIdx}`, max: 50 }
    ]);
  };

  const handleRemoveTest = (idx) => {
    if (configCols.length <= 1) {
      toast.error('You must have at least one test.');
      return;
    }
    setConfigCols(configCols.filter((_, i) => i !== idx));
  };

  // Grid scores state: { [student_id]: { [col_id]: number } }
  const [scores, setScores] = useState({});
  const [autosaveState, setAutosaveState] = useState('saved'); // 'saved' | 'saving' | 'dirty'
  const autosaveTimeout = useRef(null);

  // Initialize scores with saved database marks (defaulting to empty/unrecorded)
  useEffect(() => {
    if (students.length > 0) {
      const initial = {};
      const rawGrades = gradebookPayload.raw_grades || [];

      students.forEach((s) => {
        const studentScores = {};
        const sGrades = rawGrades.filter(g => g.student_id === s.id && g.subject === selectedSubject);
        if (sGrades.length > 0) {
          sGrades.forEach(g => {
            const colName = (g.assessment_name || '').toLowerCase();
            columns.forEach(col => {
              if (colName === col.id.toLowerCase() || colName === col.label.toLowerCase() || colName.includes(col.id.toLowerCase())) {
                studentScores[col.id] = g.grade_value;
              }
            });
            if (studentScores.exam === undefined && colName.includes('exam')) studentScores.exam = g.grade_value;
            if (studentScores.ca1 === undefined && (colName.includes('test 1') || colName.includes('ca1'))) studentScores.ca1 = g.grade_value;
            if (studentScores.ca2 === undefined && (colName.includes('cala') || colName.includes('ca2'))) studentScores.ca2 = g.grade_value;
          });
        }

        initial[s.id] = studentScores;
      });

      setScores(initial);
      setAutosaveState('saved');
    }
  }, [students, currentClassId, selectedSubject, gradebookPayload.raw_grades, columns]);

  // Handle cell changes & keyboard navigation
  const handleScoreChange = (studentId, colId, value) => {
    if (isImmutable && !isSuperAdmin) {
      toast.error('Class marks have been submitted and locked as immutable. Only Super Admin can unlock.');
      return;
    }
    const num = value === '' ? '' : Math.max(0, Number(value));
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [colId]: num
      }
    }));
    setAutosaveState('dirty');

    // Debounced autosave to backend API
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(async () => {
      setAutosaveState('saving');
      try {
        await api.post(`/schools/${schoolId}/classes/${currentClassId}/grades`, {
          class_id: currentClassId,
          subject: selectedSubject,
          scores: { [studentId]: { [colId]: num } }
        });
        setAutosaveState('saved');
        // Live update triggers across dashboards and results
        invalidate([
          `grades_classes_${schoolId}`,
          `class_results_${schoolId}_${currentClassId}`,
          `academics_${schoolId}`,
          `analytics_${schoolId}`,
          `dashboard_${schoolId}`,
          `summary_${schoolId}`
        ]);
      } catch (_) {
        setAutosaveState('saved');
      }
    }, 1000);
  };

  // Keyboard navigation across spreadsheet cells
  const handleKeyDown = (e, studentIndex, colIndex) => {
    const totalRows = students.length;
    const totalCols = columns.length;

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextRow = Math.min(totalRows - 1, studentIndex + 1);
      const nextCell = document.getElementById(`cell-${nextRow}-${colIndex}`);
      nextCell?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = Math.max(0, studentIndex - 1);
      const prevCell = document.getElementById(`cell-${prevRow}-${colIndex}`);
      prevCell?.focus();
    } else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
      if (colIndex < totalCols - 1) {
        e.preventDefault();
        const rightCell = document.getElementById(`cell-${studentIndex}-${colIndex + 1}`);
        rightCell?.focus();
      }
    } else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
      if (colIndex > 0) {
        e.preventDefault();
        const leftCell = document.getElementById(`cell-${studentIndex}-${colIndex - 1}`);
        leftCell?.focus();
      }
    }
  };

  // Level detection (Strict separation between Primary, O-Level, and A-Level)
  const className = currentClass?.name || '';
  const classLevel = (currentClass?.level || '').toLowerCase();
  const schoolType = (activeSchool?.school_type || '').toLowerCase();

  const isALevel = /form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b|advanced|a[- ]?level/i.test(className) ||
                   /a[- ]?level|form\s*[5-6]/i.test(classLevel);
  const isSecondary = isALevel || /form\s*[1-4]|ordinary|o[- ]?level/i.test(className) || classLevel.includes('sec') || schoolType.includes('secondary');
  const isPrimary = !isSecondary;

  // Live Statistics Computations (normalized against total max marks: 0 to 100%)
  const computedStats = useMemo(() => {
    let totalPct = 0;
    let count = 0;
    let highest = 0;
    let lowest = 100;
    let passing = 0;

    const totalPossible = columns.reduce((a, c) => a + (Number(c.max) || 0), 0) || 100;

    students.forEach(s => {
      const studentScores = scores[s.id] || {};
      const hasScores = columns.some(c => studentScores[c.id] !== '' && studentScores[c.id] != null);
      if (!hasScores) return;

      const rawEarned = columns.reduce((a, c) => a + (Number(studentScores[c.id]) || 0), 0);
      // Normalized percentage strictly clamped between 0 and 100%
      const pct = Math.min(100, Math.max(0, Math.round((rawEarned / totalPossible) * 100)));

      totalPct += pct;
      count++;
      if (pct > highest) highest = pct;
      if (pct < lowest) lowest = pct;
      if (pct >= 50) passing++;
    });

    const mean = count > 0 ? (totalPct / count).toFixed(1) : 0;
    const passRate = count > 0 ? Math.round((passing / count) * 100) : 0;

    return { mean, highest, lowest: count > 0 ? lowest : 0, passRate, candidateCount: count };
  }, [students, scores, columns]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interactive Gradebook & Mark Entry"
        subtitle={
          viewMode === 'broadsheet'
            ? `Class Broadsheet (All Subjects) • ${currentClass?.name || 'Class Ledger'}`
            : isPrimary
            ? `Primary Mark Entry (Units 1 to 9) • ${selectedSubject}`
            : isALevel
            ? `High School A-Level Mark Entry (5-Point Scale A-F) • ${selectedSubject}`
            : `Secondary O-Level Mark Entry (ZIMSEC Symbols A-U) • ${selectedSubject}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle: Subject Mark Entry vs Class Broadsheet */}
            <div className="flex items-center p-1 rounded-xl border border-line bg-canvas text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('entry')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'entry'
                    ? 'bg-brand-700 text-white shadow-2xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Subject Mark Sheet
              </button>
              <button
                type="button"
                onClick={() => setViewMode('broadsheet')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'broadsheet'
                    ? 'bg-brand-700 text-white shadow-2xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Class Broadsheet</span>
              </button>
            </div>

            {/* Immutability & Submission Controls */}
            {isImmutable ? (
              <div className="flex items-center gap-2">
                <StatusPill status="submitted" label="Submitted & Immutable" size="md" />
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={handleUnlockGrades}
                    className="btn-secondary text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                    title="Super Admin reversal to unlock marks"
                  >
                    <Unlock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Unlock Marks</span>
                  </button>
                )}
              </div>
            ) : isClassTeacher ? (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-2xs"
                title="Lock and forward final class marks to administration"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit to Admin</span>
              </button>
            ) : null}

            {viewMode === 'entry' && (
              <button
                onClick={openConfigModal}
                disabled={isImmutable}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 cursor-pointer shadow-xs disabled:opacity-50"
                title="Add, remove or edit tests and their max marks"
              >
                <Sliders className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400" />
                <span>Configure Tests ({columns.length})</span>
              </button>
            )}

            {/* Autosave Indicator */}
            {viewMode === 'entry' && (
              <span className="text-xs flex items-center gap-1.5 font-medium text-muted">
                {autosaveState === 'saving' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span>Autosaving marks…</span>
                  </>
                ) : autosaveState === 'dirty' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span>Unsaved changes</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-700" />
                    <span>Live synchronized</span>
                  </>
                )}
              </span>
            )}
          </div>
        }
      />

      {/* Immutability Banner */}
      {isImmutable && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider font-mono text-[11px] flex items-center gap-2">
                <span>Marks Submitted & Locked (Immutable)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold">
                  Official Submission
                </span>
              </div>
              <div className="mt-0.5 text-muted">
                Class marks have been submitted to the administration for terminal compiling and report generation. Modification is strictly locked.
                {submissionInfo?.teacher_name && (
                  <span className="font-semibold text-ink"> Submitted by {submissionInfo.teacher_name} on {new Date(submissionInfo.submitted_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
          {isSuperAdmin && (
            <button
              onClick={handleUnlockGrades}
              className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock (Super Admin)</span>
            </button>
          )}
        </div>
      )}

      {viewMode === 'broadsheet' ? (
        /* CLASS BROADSHEET VIEW (ALL SUBJECTS) */
        <Card
          title={`${currentClass?.name || 'Class'} — Comprehensive Broadsheet (All Subjects)`}
          subtitle="Holistic performance ledger showing all enrolled learners across every academic subject."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Ledger</span>
              </button>
            </div>
          }
        >
          {/* Class selection dropdown */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-canvas border border-line text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted">Viewing Class:</span>
              <select
                value={currentClassId}
                onChange={e => setSearchParams({ class: e.target.value, subject: selectedSubject })}
                className="glass-input font-medium"
              >
                {availableClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.grade_level ? `(${c.grade_level})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-muted font-mono">
              {broadsheetStudents.length} learners • {broadsheetSubjects.length} subjects
            </span>
          </div>

          <div className="overflow-x-auto border border-line rounded-xl">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-canvas border-b border-line text-muted uppercase text-[11px]">
                  <th className="py-2.5 px-3 text-left w-10">#</th>
                  <th className="py-2.5 px-3 text-left min-w-[180px]">Learner</th>
                  <th className="py-2.5 px-2 text-center w-12">Sex</th>
                  {broadsheetSubjects.map(sub => (
                    <th key={sub.id || sub.name} className="py-2.5 px-2 text-center min-w-[90px]" title={sub.name}>
                      <div className="truncate max-w-[100px]">{sub.code || sub.name}</div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right min-w-[90px]">Total</th>
                  <th className="py-2.5 px-3 text-right min-w-[90px]">Average</th>
                  <th className="py-2.5 px-3 text-center min-w-[90px]">
                    {isPrimary ? 'Units' : isALevel ? 'Points' : 'Passes'}
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[70px]">Rank</th>
                  <th className="py-2.5 px-3 text-center min-w-[90px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {broadsheetLoading ? (
                  <Skeleton variant="table-row" count={8} />
                ) : broadsheetStudents.length === 0 ? (
                  <tr>
                    <td colSpan={broadsheetSubjects.length + 8}>
                      <EmptyState
                        title="No broadsheet records found"
                        subtitle="Marks have not been recorded for any subjects in this class yet."
                        compact={true}
                      />
                    </td>
                  </tr>
                ) : (
                  broadsheetStudents.map((st, idx) => (
                    <tr key={st.student_id || idx} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-2 px-3 font-mono text-muted text-[11px]">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-ink">
                        <div>{st.first_name} {st.last_name}</div>
                        <div className="text-[10px] text-muted font-mono">{st.admission_number}</div>
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-[11px] text-muted uppercase">
                        {st.gender ? st.gender.charAt(0) : '—'}
                      </td>
                      {broadsheetSubjects.map(sub => {
                        const scoreData = (st.subjects || {})[sub.name];
                        const mark = scoreData?.mark;
                        const grade = scoreData?.grade;
                        return (
                          <td key={sub.id || sub.name} className="py-2 px-2 text-center font-mono">
                            {mark !== undefined && mark !== null ? (
                              <div>
                                <span className="font-bold text-ink">{mark}%</span>
                                {grade && <span className="text-[10px] text-muted block font-sans">({grade})</span>}
                              </div>
                            ) : (
                              <span className="text-muted/40">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-mono font-bold text-ink">
                        {st.total_marks || 0}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-extrabold text-brand-700 dark:text-brand-400">
                        {st.overall_average}%
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-ink">
                        {isPrimary
                          ? `${st.total_units || 0} U`
                          : isALevel
                          ? `${st.total_points || 0} Pts`
                          : `${st.passes_count || 0} Passes`}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-extrabold text-ink">
                        #{st.rank || idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <StatusPill
                          status={st.pass_status === 'pass' ? 'present' : 'absent'}
                          label={st.pass_status === 'pass' ? 'Passed' : 'Fail'}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* REGULAR SUBJECT ASSESSMENT SPREADSHEET */
        <>
          {/* Live Class Statistics Strip */}
          <KpiStrip>
            <StatCard
              title="Subject Mean Score"
              value={`${computedStats.mean}%`}
              sublabel={`Across ${computedStats.candidateCount} enrolled learners`}
              icon={GraduationCap}
              iconColor="brand"
            />

            <StatCard
              title="Credit Pass Rate"
              value={`${computedStats.passRate}%`}
              sublabel={isPrimary ? "Scoring Unit 1 to 4 (50%+)" : isALevel ? "Scoring 50%+ (Grade C & above)" : "Scoring 50%+ (Grade A to C)"}
              icon={TrendingUp}
              iconColor={computedStats.passRate >= 70 ? 'brand' : 'accent'}
            />

            <StatCard
              title="Highest Attained Mark"
              value={`${computedStats.highest}%`}
              sublabel="Top performing student"
              icon={Award}
              iconColor="brand"
            />

            <StatCard
              title="Lowest Attained Mark"
              value={`${computedStats.lowest}%`}
              sublabel="Remedial target candidate"
              icon={AlertCircle}
              iconColor="danger"
            />
          </KpiStrip>

          {/* Spreadsheet Card */}
          <Card
            title={`${selectedSubject} — Class Assessment Sheet`}
            subtitle="Arrow keys navigate cells. Real-time updates push automatically to student & parent broadsheets."
          >
            {/* Stream & Subject Selector Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-canvas border border-line mb-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted">Class / Stream:</span>
                <select
                  value={currentClassId}
                  onChange={e => setSearchParams({ class: e.target.value, subject: selectedSubject })}
                  className="glass-input font-medium"
                >
                  {availableClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.grade_level ? `(${c.grade_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted">Subject:</span>
                <select
                  value={selectedSubject}
                  onChange={e => setSearchParams({ class: currentClassId, subject: e.target.value })}
                  className="glass-input font-medium"
                >
                  {availableSubjects.map(s => (
                    <option key={s.id || s.code || s.name} value={s.name}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-muted text-[11px] font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{students.length} students enrolled in {selectedSubject}</span>
              </div>
            </div>

            {/* Spreadsheet Matrix */}
            <div className="overflow-x-auto border border-line rounded-xl">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-canvas border-b border-line text-muted uppercase text-[11px]">
                    <th className="py-2.5 px-3 text-left w-12">#</th>
                    <th className="py-2.5 px-3 text-left min-w-[200px]">Student Name & ADM</th>
                    {columns.map(c => (
                      <th key={c.id} className="py-2.5 px-3 text-center min-w-[120px]">
                        <div>{c.label}</div>
                        <div className="text-[10px] text-muted font-mono font-normal">Max: {c.max}</div>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right min-w-[110px]">
                      <div>Percentage</div>
                      <div className="text-[10px] text-muted font-mono font-normal">Max 100%</div>
                    </th>
                    <th className="py-2.5 px-3 text-center min-w-[130px]">
                      {isPrimary ? 'Units (1-9)' : isALevel ? 'A-Level (Pts)' : 'O-Level (A-U)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {gradesLoading ? (
                    <Skeleton variant="table-row" count={8} />
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 4}>
                        <EmptyState
                          title={`No students enrolled in ${selectedSubject}`}
                          subtitle="For elective secondary subjects, students must be registered to appear on this mark sheet."
                          compact={true}
                        />
                      </td>
                    </tr>
                  ) : (
                    students.map((st, sIdx) => {
                      const studentScores = scores[st.id] || {};
                      const hasScores = columns.some(c => studentScores[c.id] !== '' && studentScores[c.id] != null);

                      const totalPossible = columns.reduce((a, c) => a + (Number(c.max) || 0), 0) || 100;
                      const rawEarned = columns.reduce((a, c) => a + (Number(studentScores[c.id]) || 0), 0);
                      // Clamped 0% to 100%
                      const percentage = hasScores
                        ? Math.min(100, Math.max(0, Math.round((rawEarned / totalPossible) * 100)))
                        : 0;

                      let gradeDisplay = 'Ungraded';
                      let gradeBadge = 'neutral';

                      if (hasScores) {
                        if (isPrimary) {
                          // Primary schools have units only (Unit 1 to Unit 9), strictly NO letter symbols
                          const u = percentage >= 80 ? 1 : percentage >= 70 ? 2 : percentage >= 60 ? 3 : percentage >= 50 ? 4 : percentage >= 45 ? 5 : percentage >= 40 ? 6 : percentage >= 35 ? 7 : percentage >= 30 ? 8 : 9;
                          gradeDisplay = `Unit ${u}`;
                          gradeBadge = u <= 3 ? 'present' : u <= 6 ? 'submitted' : 'absent';
                        } else if (isALevel) {
                          // High School A-Level: 5-Point scale (A=5pts, B=4pts, C=3pts, D=2pts, E=1pt, O=0pts, F=0pts)
                          gradeDisplay = percentage >= 70 ? 'A (5pts)' : percentage >= 60 ? 'B (4pts)' : percentage >= 50 ? 'C (3pts)' : percentage >= 45 ? 'D (2pts)' : percentage >= 40 ? 'E (1pt)' : percentage >= 35 ? 'O (0pts)' : 'F (0pts)';
                          gradeBadge = percentage >= 50 ? 'present' : percentage >= 40 ? 'submitted' : 'absent';
                        } else {
                          // Secondary O-Level: Letter symbols A (75%+), B (65-74%), C (50-64%), D (45-49%), E (40-44%), U (0-39%)
                          gradeDisplay = percentage >= 75 ? 'A' : percentage >= 65 ? 'B' : percentage >= 50 ? 'C' : percentage >= 45 ? 'D' : percentage >= 40 ? 'E' : 'U';
                          gradeBadge = ['A', 'B', 'C'].includes(gradeDisplay) ? 'present' : ['D', 'E'].includes(gradeDisplay) ? 'submitted' : 'absent';
                        }
                      }

                      return (
                        <tr key={st.id} className="hover:bg-canvas/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-muted text-[11px]">{sIdx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-ink">
                            <div>{st.first_name} {st.last_name}</div>
                            <div className="text-[10px] text-muted font-mono">{st.admission_number}</div>
                          </td>

                          {/* Score Input Cells */}
                          {columns.map((c, cIdx) => (
                            <td key={c.id} className="py-1 px-2 text-center">
                              <input
                                id={`cell-${sIdx}-${cIdx}`}
                                type="number"
                                min="0"
                                max={c.max}
                                disabled={isImmutable}
                                value={studentScores[c.id] ?? ''}
                                onChange={e => handleScoreChange(st.id, c.id, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, sIdx, cIdx)}
                                className={`w-16 py-1 px-1.5 text-center font-mono font-bold rounded-lg border text-xs shadow-2xs ${
                                  isImmutable
                                    ? 'bg-canvas/50 text-muted border-line/60 cursor-not-allowed'
                                    : 'text-ink border-line bg-surface focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20'
                                }`}
                              />
                            </td>
                          ))}

                          {/* Computed Total & Percentage (Never exceeds 100%) */}
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {hasScores ? (
                              <div>
                                <span className="font-extrabold text-sm text-ink">{percentage}%</span>
                                <span className="text-[10px] text-muted block font-normal">({rawEarned}/{totalPossible})</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <StatusPill status={gradeBadge} label={gradeDisplay} size="sm" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Submit Class Marks to Administration Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Class Marks to Administration"
        description="Formal submission locks marks against modifications and automatically notifies the administration for executive analytics and report compilation."
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Strict Immutability Rule:</span>
              <p className="text-[11px] leading-relaxed">
                Once submitted, marks for <span className="font-bold text-ink">{currentClass?.name}</span> become permanently immutable. Non-class teachers and teachers will NOT be able to modify or delete grades. Only the <span className="font-bold text-ink">Super Administrator</span> has authority to unlock or reverse this submission.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted uppercase mb-1">
              Submission Remarks / Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={submitNotes}
              onChange={e => setSubmitNotes(e.target.value)}
              placeholder="e.g. All continuous assessments and end-of-term examinations finalized for Term 3."
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface font-sans text-xs focus:ring-2 focus:ring-brand-500 text-ink"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="btn-secondary text-xs"
              disabled={submittingToAdmin}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitToAdmin}
              disabled={submittingToAdmin}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              {submittingToAdmin ? (
                <>Submitting…</>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirm & Lock Submission</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Configure Assessment Tests Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title={`Configure Assessment Tests: ${selectedSubject}`}
        description="Choose the tests, change test titles, and specify maximum marks. Total percentage will automatically normalize to 100%."
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {configCols.map((col, idx) => (
              <div key={col.id || idx} className="p-3 rounded-xl border border-line bg-canvas flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-500/10 text-brand-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-muted uppercase mb-1">Test Name</label>
                  <input
                    type="text"
                    value={col.label}
                    onChange={e => {
                      const updated = [...configCols];
                      updated[idx].label = e.target.value;
                      setConfigCols(updated);
                    }}
                    placeholder="e.g. Test 1, CALA, Mid-Term"
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="w-24">
                  <label className="block text-[11px] font-bold text-muted uppercase mb-1">Max Mark</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={col.max}
                    onChange={e => {
                      const updated = [...configCols];
                      updated[idx].max = Number(e.target.value) || 1;
                      setConfigCols(updated);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg border border-line bg-surface text-xs font-mono font-bold text-ink text-center focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="pt-5">
                  <button
                    type="button"
                    onClick={() => handleRemoveTest(idx)}
                    disabled={configCols.length <= 1}
                    className="p-2 rounded-lg text-danger hover:bg-danger/10 disabled:opacity-30 cursor-pointer"
                    title="Remove Test"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleAddTest}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-brand-700" />
              <span>Add Another Test</span>
            </button>

            <button
              type="button"
              onClick={handleResetColumns}
              className="text-xs text-muted hover:text-ink flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Standard</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-900 dark:text-brand-300">
            <strong>Total Maximum Marks:</strong>{' '}
            <span className="font-mono font-bold">
              {configCols.reduce((sum, c) => sum + (Number(c.max) || 0), 0)}
            </span>
            . Learner earned marks will be divided by this total so subject percentage is always mathematically correct and never exceeds 100%.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveColumns}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save & Apply Tests</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
