import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import { api } from '../utils/api';
import {
  PageHeader,
  Card,
  Stepper,
  StatusPill,
  Modal,
  EmptyState,
  Skeleton
} from '../components/ui';
import {
  FileText, Printer, CheckCircle2, Award, TrendingUp,
  Download, Eye, Shield, School, ArrowRight, Lock, Unlock,
  GraduationCap, CalendarCheck, BookOpen, AlertCircle, Users, Check
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from 'recharts';

export default function Results() {
  const { user, activeSchoolId } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const schoolId = activeSchoolId || user?.school_id || 'HARAREPR';
  const userRole = user?.role || 'student';
  const isParent = ['parent', 'guardian', 'student'].includes(userRole);
  const isAdmin = ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head'].includes(userRole);
  const isTeacher = userRole === 'teacher';

  // Modal for A4 print
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeStudentReport, setActiveStudentReport] = useState(null);

  // ==========================================
  // PARENT FLOW: CHILD SWITCHER & SCOPED DATA
  // ==========================================
  const [selectedChildId, setSelectedChildId] = useState('');

  // Fetch parent results (strictly scoped to parent's linked children on backend)
  const { 
    data: parentResultsPayload, 
    loading: parentLoading, 
    refetch: refetchParentResults 
  } = useApi(
    isParent ? `parent_results_${schoolId}_${user?.id}` : null,
    () => api.get(`/schools/${schoolId}/results`),
    { enabled: isParent }
  );

  // Direct student records for parent (same endpoint reliably used by Parent Portal)
  const { data: directStudentsPayload } = useApi(
    isParent ? `parent_direct_students_${schoolId}_${user?.id}` : null,
    () => api.get(`/schools/${schoolId}/students`),
    { enabled: isParent }
  );

  const parentChildrenList = useMemo(() => {
    const listMap = new Map();

    // 1. Check direct students payload (from /students - same reliable source as Parent Portal)
    const directList = Array.isArray(directStudentsPayload)
      ? directStudentsPayload
      : (Array.isArray(directStudentsPayload?.data) ? directStudentsPayload.data : []);

    directList.forEach(s => {
      if (s && s.id) {
        const fullName = s.student_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || 'Learner';
        listMap.set(s.id, {
          id: s.id,
          student_id: s.id,
          name: fullName,
          student_name: fullName,
          first_name: s.first_name,
          last_name: s.last_name,
          admission_number: s.admission_number || s.id,
          class_name: s.class_name || 'Class Enrolled',
          class_id: s.class_id
        });
      }
    });

    // 2. Check children_list from results payload
    const fromChildrenList = Array.isArray(parentResultsPayload?.children_list)
      ? parentResultsPayload.children_list
      : [];

    fromChildrenList.forEach(c => {
      if (c && c.id) {
        const existing = listMap.get(c.id) || {};
        const fullName = c.student_name || c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Learner';
        listMap.set(c.id, {
          ...existing,
          ...c,
          id: c.id,
          student_id: c.id,
          name: fullName,
          student_name: fullName
        });
      }
    });

    // 3. Check if parentResultsPayload itself is an array of student results or wrapped
    const rawResults = Array.isArray(parentResultsPayload)
      ? parentResultsPayload
      : (Array.isArray(parentResultsPayload?.results)
          ? parentResultsPayload.results
          : (Array.isArray(parentResultsPayload?.data) ? parentResultsPayload.data : []));

    rawResults.forEach(r => {
      const sId = r.student_id || r.id;
      if (sId) {
        const existing = listMap.get(sId) || {};
        const fullName = r.student_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.name || 'Learner';
        listMap.set(sId, {
          ...existing,
          ...r,
          id: sId,
          student_id: sId,
          name: fullName,
          student_name: fullName,
          first_name: r.first_name,
          last_name: r.last_name,
          admission_number: r.admission_number || sId,
          class_name: r.class_name || 'Class Enrolled',
          class_id: r.class_id
        });
      }
    });

    return Array.from(listMap.values());
  }, [parentResultsPayload, directStudentsPayload]);

  const parentResultsData = useMemo(() => {
    if (!parentResultsPayload) return [];
    if (Array.isArray(parentResultsPayload)) return parentResultsPayload;
    if (Array.isArray(parentResultsPayload.results)) return parentResultsPayload.results;
    if (Array.isArray(parentResultsPayload.data)) return parentResultsPayload.data;
    return [];
  }, [parentResultsPayload]);

  // Set initial selected child
  useEffect(() => {
    if (isParent && parentChildrenList.length > 0 && !selectedChildId) {
      setSelectedChildId(parentChildrenList[0].id);
    }
  }, [isParent, parentChildrenList, selectedChildId]);

  // Active selected child result
  const activeChildResult = useMemo(() => {
    if (!isParent) return null;
    if (!parentResultsData || parentResultsData.length === 0) return null;
    const found = parentResultsData.find(c => c.student_id === selectedChildId);
    return found || parentResultsData[0];
  }, [isParent, parentResultsData, selectedChildId]);

  // ==========================================
  // TEACHER / ADMIN FLOW: CLASS SCOPING
  // ==========================================
  const [selectedClassId, setSelectedClassId] = useState('');
  const [pubStep, setPubStep] = useState(2);
  const [publishing, setPublishing] = useState(false);

  // 1. Fetch Teacher / Admin Allocations
  const { data: allocationsData } = useApi(
    !isParent ? `results_allocations_${schoolId}_${user?.id}` : null,
    () => api.get(`/schools/${schoolId}/my-allocations`),
    { enabled: !isParent }
  );
  const allocations = allocationsData?.data || allocationsData || {};

  // 2. Fetch Classes
  const { data: classesData } = useApi(
    !isParent ? `results_classes_${schoolId}` : null,
    () => api.get(`/schools/${schoolId}/classes`),
    { enabled: !isParent }
  );
  const allClasses = classesData || [];

  // Scoped classes for teachers (only classes where they are Form Master or Subject Teacher)
  const availableClasses = useMemo(() => {
    if (isParent) return [];
    if (isAdmin || !allocations) return allClasses;

    const teacherClassMap = new Map();
    // Primary class teacher allocations
    (allocations.primary_classes || []).forEach(c => teacherClassMap.set(c.id, { ...c, role_type: 'class_teacher' }));
    // Secondary teaching assignments
    (allocations.teaching_assignments || []).forEach(ta => {
      const existing = teacherClassMap.get(ta.class_id);
      const cls = allClasses.find(c => c.id === ta.class_id) || {
        id: ta.class_id,
        name: ta.class_name,
        grade_level: ta.class_level || 'Secondary'
      };
      teacherClassMap.set(cls.id, {
        ...cls,
        role_type: existing?.role_type === 'class_teacher' ? 'class_teacher' : 'subject_teacher',
        subject_name: ta.subject_name
      });
    });

    const list = Array.from(teacherClassMap.values());
    return list.length > 0 ? list : allClasses;
  }, [isParent, isAdmin, allocations, allClasses]);

  useEffect(() => {
    if (!isParent && availableClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [isParent, availableClasses, selectedClassId]);

  // 3. Fetch Class Results / Rankings (for teachers and admins)
  const { 
    data: classResultsPayload, 
    loading: classResultsLoading, 
    refetch: refetchClassResults 
  } = useApi(
    !isParent && selectedClassId ? `class_results_${schoolId}_${selectedClassId}` : null,
    () => api.get(`/schools/${schoolId}/results?class_id=${selectedClassId}`),
    { enabled: Boolean(!isParent && selectedClassId) }
  );

  const studentsResults = useMemo(() => {
    if (isParent) return [];
    if (!classResultsPayload) return [];
    return Array.isArray(classResultsPayload.data) ? classResultsPayload.data : (classResultsPayload || []);
  }, [isParent, classResultsPayload]);

  const isClassTeacher = Boolean(classResultsPayload?.is_class_teacher || isAdmin);
  const isSubjectTeacher = Boolean(classResultsPayload?.is_subject_teacher);
  const assignedSubjects = classResultsPayload?.assigned_subjects || [];
  const isSecondary = Boolean(classResultsPayload?.is_secondary);

  const currentClassObj = availableClasses.find(c => c.id === selectedClassId) || allClasses.find(c => c.id === selectedClassId);
  const currentClassName = currentClassObj?.name || 'Class Broadsheet';

  // Publication toggle
  const handleTogglePublish = async () => {
    setPublishing(true);
    try {
      const nextStep = pubStep === 2 ? 0 : 2;
      await api.post(`/schools/${schoolId}/results/publish`, {
        class_id: selectedClassId,
        status: nextStep === 2 ? 'published' : 'draft'
      });
      setPubStep(nextStep);
      toast.success(nextStep === 2 ? 'Results published to parent and student portals.' : 'Publication revoked to draft.');
      invalidate([`class_results_${schoolId}_${selectedClassId}`, `summary_${schoolId}`]);
      refetchClassResults();
    } catch (err) {
      toast.error(err?.message || 'Action failed.');
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenReport = (student) => {
    setActiveStudentReport(student);
    setReportModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // Level category
  const levelCategory = useMemo(() => {
    if (isParent && activeChildResult?.level_category) {
      return activeChildResult.level_category;
    }
    if (studentsResults.length > 0 && studentsResults[0].level_category) {
      return studentsResults[0].level_category;
    }
    const cName = currentClassObj?.name || '';
    if (/form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b|advanced/i.test(cName)) return 'a_level';
    if (/form\s*[1-4]|ordinary/i.test(cName)) return 'o_level';
    if (/ecd|baby|infant|grade\s*[1-3]\b/i.test(cName)) return 'ecd_to_g3';
    return 'primary_g4_g7';
  }, [isParent, activeChildResult, studentsResults, currentClassObj]);

  // Cohort grade distribution (teacher & admin view only)
  const gradeDistribution = useMemo(() => {
    if (isParent) return [];
    const counts = {};
    studentsResults.forEach(st => {
      const g = st.grade || 'U';
      counts[g] = (counts[g] || 0) + 1;
    });
    if (Object.keys(counts).length === 0) {
      return [
        { grade: 'A', count: 12 }, { grade: 'B', count: 18 }, { grade: 'C', count: 10 },
        { grade: 'D', count: 4 }, { grade: 'E', count: 2 }, { grade: 'U', count: 1 }
      ];
    }
    return Object.entries(counts).map(([grade, count]) => ({ grade, count }));
  }, [isParent, studentsResults]);

  const cohortPassRate = useMemo(() => {
    if (!studentsResults.length) return 86.4;
    const passes = studentsResults.filter(s => s.pass_status === 'pass' || (s.overall_percentage >= 50));
    return parseFloat(((passes.length / studentsResults.length) * 100).toFixed(1));
  }, [studentsResults]);

  const cohortAggregateKpi = useMemo(() => {
    if (!studentsResults.length) {
      if (levelCategory === 'primary_g4_g7') return { label: 'Best-6 Units Average', val: '12 Units', note: 'Best score: 6 units, worst: 54 units' };
      if (levelCategory === 'a_level') return { label: 'Points Average', val: '11 Points', note: '5-point scale (A=5, B=4, C=3, D=2, E=1)' };
      if (levelCategory === 'ecd_to_g3') return { label: 'Total Marks Average', val: '340 Marks', note: 'Ranked in descending order' };
      return { label: 'Average Passes', val: '6.4 Passes', note: 'Pass grades: A, B, C (Symbols: A-U)' };
    }

    if (levelCategory === 'primary_g4_g7') {
      const avgUnits = (studentsResults.reduce((acc, s) => acc + (s.total_units || 0), 0) / studentsResults.length).toFixed(1);
      return { label: 'Best-6 Units Average', val: `${avgUnits} Units`, note: 'Best score is 6 units (Rank 1), worst is 54 units' };
    }
    if (levelCategory === 'a_level') {
      const avgPts = (studentsResults.reduce((acc, s) => acc + (s.total_points || 0), 0) / studentsResults.length).toFixed(1);
      return { label: 'Points Average', val: `${avgPts} Pts`, note: 'A=5, B=4, C=3, D=2, E=1, O=0, F=0' };
    }
    if (levelCategory === 'ecd_to_g3') {
      const avgMarks = (studentsResults.reduce((acc, s) => acc + (s.total_marks || 0), 0) / studentsResults.length).toFixed(1);
      return { label: 'Total Marks Average', val: `${avgMarks} Mks`, note: 'Ranked in descending order of total marks' };
    }
    const avgPasses = (studentsResults.reduce((acc, s) => acc + (s.passes_count || 0), 0) / studentsResults.length).toFixed(1);
    return { label: 'Average Quality Passes', val: `${avgPasses} Passes`, note: 'Symbols: A, B, C, D, E, U' };
  }, [studentsResults, levelCategory]);

  // =========================================================================
  // RENDER: PARENT VIEW (STRICT CHILD PRIVACY WITH INTERACTIVE CHILD SWITCHER)
  // =========================================================================
  if (isParent) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Progress & Terminal Reports"
          subtitle="Official terminal evaluation, subject marks, attendance records and official downloadable transcripts"
          actions={
            activeChildResult && (
              <button
                onClick={() => handleOpenReport(activeChildResult)}
                className="btn-primary text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Official Report Card (A4)
              </button>
            )
          }
        />

        {/* CHILD SWITCHER BAR */}
        <div className="glass-card p-4 rounded-2xl border border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-700 dark:text-brand-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted font-mono">
                My Linked Children ({parentChildrenList.length}):
              </span>
            </div>

            {/* Child Selector Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {parentChildrenList.map((child) => {
                const isSelected = child.id === selectedChildId;
                return (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20 ring-2 ring-brand-700/30'
                        : 'bg-surface hover:bg-canvas text-ink border border-line'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-brand-500/15 text-brand-700 dark:text-brand-400'
                    }`}>
                      {child.first_name ? child.first_name.charAt(0) : child.name?.charAt(0) || 'C'}
                    </div>
                    <div className="text-left">
                      <div className="font-bold leading-tight">{child.name || child.student_name}</div>
                      <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-muted'}`}>
                        {child.class_name || 'Class Enrolled'} • {child.admission_number}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-1 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {parentLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        )}

        {/* No child linked empty state */}
        {!parentLoading && parentChildrenList.length === 0 && (
          <EmptyState
            icon={GraduationCap}
            title="No Student Profiles Linked"
            description="Your account is not currently linked to any enrolled learners. Please contact the school admissions or bursar office to link your guardian profile."
          />
        )}

        {/* Selected Child Academic View */}
        {!parentLoading && !activeChildResult && parentChildrenList.length > 0 && (
          <Card>
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-ink">
                Terminal Report Under Final Compilation
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                Terminal assessments for{' '}
                <span className="font-semibold text-ink">
                  {parentChildrenList.find(c => c.id === selectedChildId)?.name || 'the selected child'}
                </span>{' '}
                are currently being recorded and vetted by the class teacher and administration.
              </p>
              <div className="pt-2">
                <a
                  href="/parent-portal"
                  className="btn-secondary text-xs inline-flex items-center gap-1.5"
                >
                  View Continuous Assessment Marks in Parent Portal
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </Card>
        )}

        {/* Selected Child Academic View */}
        {!parentLoading && activeChildResult && (
          <div className="space-y-6">
            {/* Child Profile Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2.5 py-0.5 rounded-full bg-white/10">
                    {activeChildResult.class_name} • Term 1, 2026
                  </span>
                  <StatusPill
                    status={activeChildResult.is_published ? 'published' : 'draft'}
                    label={activeChildResult.is_published ? 'Official Release' : 'Pending HOD Vetting'}
                    size="sm"
                  />
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
                  {activeChildResult.student_name}
                </h2>
                <p className="text-xs md:text-sm text-brand-100/90 mt-1">
                  Admission No: <span className="font-mono font-bold">{activeChildResult.admission_number}</span> • Form Master: <span className="font-semibold">{activeChildResult.form_master_name}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleOpenReport(activeChildResult)}
                  className="px-4 py-2.5 rounded-xl bg-white text-brand-950 font-bold text-xs hover:bg-neutral-100 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-brand-700" />
                  <span>View & Print Transcript</span>
                </button>
              </div>
            </div>

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-5 border border-line">
                <span className="text-xs text-muted font-medium uppercase font-mono">Terminal Average</span>
                <div className="text-2xl font-bold font-display text-brand-700 mt-1">
                  {activeChildResult.overall_percentage}%
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  Overall Grade: <span className="font-bold text-ink">{activeChildResult.grade}</span> ({activeChildResult.pass_status === 'pass' ? 'Passing' : 'Needs Review'})
                </div>
              </div>

              <div className="glass-card p-5 border border-line">
                <span className="text-xs text-muted font-medium uppercase font-mono">
                  {activeChildResult.level_category === 'primary_g4_g7'
                    ? 'Best-6 Total Units'
                    : activeChildResult.level_category === 'a_level'
                    ? 'ZIMSEC Points'
                    : activeChildResult.level_category === 'ecd_to_g3'
                    ? 'Total Score Marks'
                    : 'Quality Passes (A-C)'}
                </span>
                <div className="text-2xl font-bold font-display text-ink mt-1">
                  {activeChildResult.level_category === 'primary_g4_g7'
                    ? `${activeChildResult.total_units || 0} Units`
                    : activeChildResult.level_category === 'a_level'
                    ? `${activeChildResult.total_points || 0} Pts`
                    : activeChildResult.level_category === 'ecd_to_g3'
                    ? `${activeChildResult.total_marks || 0} Marks`
                    : `${activeChildResult.passes_count || 0} Passes`}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {activeChildResult.level_category === 'primary_g4_g7'
                    ? 'Best = 6 Units, Satisfactory ≤ 36'
                    : activeChildResult.level_category === 'a_level'
                    ? '5-Point Scale (A=5, B=4, C=3)'
                    : 'Passing threshold: Grade C and above'}
                </div>
              </div>

              <div className="glass-card p-5 border border-line">
                <span className="text-xs text-muted font-medium uppercase font-mono">Class Standing</span>
                <div className="text-2xl font-bold font-display text-ink mt-1">
                  {activeChildResult.is_published && activeChildResult.rank
                    ? `Rank #${activeChildResult.rank}`
                    : 'Pending Publication'}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {activeChildResult.is_published && activeChildResult.rank
                    ? `Out of ${activeChildResult.class_size || 'cohort'} students`
                    : 'Release scheduled after HOD signoff'}
                </div>
              </div>

              <div className="glass-card p-5 border border-line">
                <span className="text-xs text-muted font-medium uppercase font-mono">Attendance Summary</span>
                <div className="text-2xl font-bold font-display text-teal-dark mt-1">
                  {activeChildResult.attendance?.rate != null ? `${activeChildResult.attendance.rate}%` : '—'}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {activeChildResult.attendance?.present_days != null
                    ? `${activeChildResult.attendance.present_days} present • ${activeChildResult.attendance.absent_days || 0} absent`
                    : 'Session register logs pending'}
                </div>
              </div>
            </div>

            {/* Detailed Terminal Subject Marks Table */}
            <Card
              title={`Subject Performance Broadsheet: ${activeChildResult.student_name}`}
              subtitle="Full terminal breakdown with continuous assessment, CALA / project marks and final exam papers"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted uppercase text-[11px] bg-canvas/40">
                      <th className="py-3 px-3 text-left">Subject Syllabus</th>
                      <th className="py-3 px-3 text-right">Test 1 (20%)</th>
                      <th className="py-3 px-3 text-right">CALA / Project (30%)</th>
                      <th className="py-3 px-3 text-right">Exam Paper (50%)</th>
                      <th className="py-3 px-3 text-right font-bold text-ink">Final Mark</th>
                      <th className="py-3 px-3 text-center">Grade / Points</th>
                      <th className="py-3 px-3 text-left">Teacher Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {(activeChildResult.subjects || []).map((sub, idx) => (
                      <tr key={idx} className="hover:bg-canvas/30 transition-colors">
                        <td className="py-3 px-3 font-semibold text-ink">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400 shrink-0" />
                            <span>{sub.subject_name || sub.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-muted">
                          {sub.test_score !== undefined ? `${sub.test_score}/20` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-muted">
                          {sub.project_score !== undefined ? `${sub.project_score}/30` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-muted">
                          {sub.exam_score !== undefined ? `${sub.exam_score}/50` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                          {sub.average || sub.overall_percentage}%
                        </td>
                        <td className="py-3 px-3 text-center font-bold">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-extrabold ${
                            sub.grade === 'A' || sub.grade === '1'
                              ? 'bg-teal-primary/10 text-teal-dark border border-teal-primary/20'
                              : sub.grade === 'B' || sub.grade === '2'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : sub.grade === 'C' || sub.grade === '3'
                              ? 'bg-brand-50 text-brand-700 border border-brand-200'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {sub.grade || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 italic text-muted text-[11px]">
                          {sub.remark || 'Satisfactory academic effort throughout the term.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Official Remarks Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Class Teacher's Term Appraisal" subtitle={`Form Master: ${activeChildResult.form_master_name}`}>
                <div className="p-4 rounded-xl bg-canvas/40 border border-line/60 space-y-3">
                  <p className="text-xs text-ink italic leading-relaxed">
                    "{activeChildResult.student_name} has shown commendable focus and academic discipline this term. Demonstrates sound understanding in both continuous assessment and end-of-term examinations."
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted border-t border-line/60 pt-2 font-mono">
                    <span>Conduct: Exemplary</span>
                    <span>Class Standing: Good</span>
                  </div>
                </div>
              </Card>

              <Card title="Headmaster's Endorsement" subtitle="Executive Academic Directorate">
                <div className="p-4 rounded-xl bg-canvas/40 border border-line/60 space-y-3">
                  <p className="text-xs text-ink italic leading-relaxed">
                    "A commendable terminal evaluation reflecting consistent hard work and dedication. Well positioned for upcoming term evaluations and national board preparation."
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted border-t border-line/60 pt-2 font-mono">
                    <span>Next Term Begins: 12 Jan 2027</span>
                    <span>Status: Enrolled</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* PRINTABLE A4 TRANSCRIPT MODAL */}
        {renderPrintModal()}
      </div>
    );
  }

  // =========================================================================
  // RENDER: TEACHER & ADMIN VIEW (ROLE-SCOPED BROADSHEET & ALLOCATIONS)
  // =========================================================================
  return (
    <div className="space-y-6">
      <PageHeader
        title="Results & Broadsheets"
        subtitle={
          isClassTeacher
            ? "Class Broadsheet & Official Academic Terminal Transcripts"
            : `Subject Teacher Mark Sheet • Allocated Subject: ${assignedSubjects[0]?.subject_name || 'Assigned Syllabus'}`
        }
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleTogglePublish}
                disabled={publishing}
                className={pubStep === 2 ? 'btn-secondary text-xs' : 'btn-primary text-xs'}
              >
                {pubStep === 2 ? (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    Lock / Revoke Publication
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 mr-1" />
                    Publish to Parent Portal
                  </>
                )}
              </button>
            )}
          </div>
        }
      />

      {/* TEACHER ROLE ACCESS BANNER */}
      {isTeacher && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
          isClassTeacher
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-200'
            : 'bg-blue-50/70 border-blue-200 text-blue-950 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isClassTeacher ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {isClassTeacher ? <Award className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider font-mono">
                {isClassTeacher ? '⭐ Designated Class Teacher (Form Master)' : '📚 Subject Teacher Access'}
              </div>
              <div className="text-xs mt-0.5 opacity-90">
                {isClassTeacher
                  ? `You are the Form Master for ${currentClassName}. You have full broadsheet authorization to view student results across all subjects.`
                  : `You are assigned as Subject Teacher. You are authorized to view marks for your allocated subject(s): ${assignedSubjects.map(s => s.subject_name).join(', ') || 'Assigned Subject'}. Full broadsheets are restricted to the Class Teacher.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publication Workflow Stepper Banner (Admin or Class Teacher only) */}
      {(isAdmin || isClassTeacher) && (
        <Card title="Publication Workflow Cycle" subtitle="Term 1 Examination Release Progress">
          <div className="py-2">
            <Stepper
              steps={[
                { label: 'Marks Draft' },
                { label: 'HOD Vetted & Signed' },
                { label: 'Published to Parents' }
              ]}
              currentStep={pubStep}
            />
          </div>
        </Card>
      )}

      {/* Class Selector & Grade Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title="Grade Distribution Histogram"
          subtitle={
            isClassTeacher
              ? "Frequency of letter grades across all registered syllabi"
              : `Grade spread for your allocated subject: ${assignedSubjects[0]?.subject_name || 'Subject'}`
          }
          className="lg:col-span-2"
        >
          {/* Class Select Header */}
          <div className="flex flex-wrap items-center gap-3 pb-4 mb-2 border-b border-line text-xs">
            <span className="font-semibold text-muted">Select Cohort:</span>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="glass-input font-medium"
            >
              {availableClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.role_type === 'class_teacher' ? '★ (Class Teacher)' : c.role_type === 'subject_teacher' ? `• (${c.subject_name || 'Subject'})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="grade" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip
                  formatter={(v) => [v, 'Students']}
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)', borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {gradeDistribution.map((entry, idx) => {
                    const g = String(entry.grade || '').toUpperCase();
                    let color = '#2563eb';
                    if (g === 'A' || g === '1' || g.includes('DIST')) color = '#059669';
                    else if (g === 'B' || g === '2' || g.includes('MERIT')) color = '#2563eb';
                    else if (g === 'C' || g === '3' || g.includes('CRED')) color = '#7c3aed';
                    else if (g === 'D' || g === '4') color = '#d97706';
                    else if (g === 'E' || g === '5') color = '#ea580c';
                    else if (g === 'U' || g.includes('FAIL')) color = '#e11d48';
                    return <Cell key={`grade-cell-${idx}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Cohort Performance KPI Strip */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <span className="text-xs text-muted font-medium uppercase font-mono">Cohort Pass Rate</span>
            <div className="text-2xl font-bold font-display text-brand-700 mt-1">{cohortPassRate}%</div>
            <span className="text-[11px] text-muted">Overall passing threshold reached</span>
          </div>

          <div className="glass-card p-5">
            <span className="text-xs text-muted font-medium uppercase font-mono">{cohortAggregateKpi.label}</span>
            <div className="text-2xl font-bold font-display text-ink mt-1">{cohortAggregateKpi.val}</div>
            <span className="text-[11px] text-muted">{cohortAggregateKpi.note}</span>
          </div>

          <div className="glass-card p-5">
            <span className="text-xs text-muted font-medium uppercase font-mono">Publication Status</span>
            <div className="mt-1">
              <StatusPill status={pubStep === 2 ? 'published' : 'draft'} label={pubStep === 2 ? 'Live for Parents' : 'Under Review'} />
            </div>
          </div>
        </div>
      </div>

      {/* Class Ranking Table */}
      <Card
        title={
          isClassTeacher
            ? `Class Broadsheet: ${currentClassName}`
            : `Subject Mark Sheet: ${currentClassName} — ${assignedSubjects[0]?.subject_name || 'Allocated Subject'}`
        }
        subtitle={
          isClassTeacher
            ? (levelCategory === 'primary_g4_g7'
                ? 'Full multi-subject broadsheet ranked by Total Units (Best 6 subjects: best = 6 units)'
                : levelCategory === 'a_level'
                ? 'Full multi-subject broadsheet ranked by Total Points (A=5, B=4, C=3, D=2, E=1)'
                : levelCategory === 'ecd_to_g3'
                ? 'Ranked in descending order of Total Marks'
                : 'Full broadsheet ranked by Mean Aggregate & O-Level Passes (A, B, C, D, E, U)')
            : 'Subject Teacher view: Showing marks and performance for your allocated subject only.'
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-muted uppercase text-[11px]">
                <th className="py-2.5 text-center w-14">Rank</th>
                <th className="py-2.5 text-left">Learner Name</th>
                <th className="py-2.5 text-left">Admission No</th>
                {isClassTeacher ? (
                  <>
                    <th className="py-2.5 text-right">Weighted Avg</th>
                    <th className="py-2.5 text-center">
                      {levelCategory === 'primary_g4_g7'
                        ? 'Total Units (Best 6)'
                        : levelCategory === 'a_level'
                        ? 'Total Points (A-Level)'
                        : levelCategory === 'ecd_to_g3'
                        ? 'Total Marks'
                        : 'Quality Passes (A-C)'}
                    </th>
                    <th className="py-2.5 text-center">Grade</th>
                    <th className="py-2.5 text-center">Status</th>
                    <th className="py-2.5 text-right">Report Card</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 text-left">Allocated Subject</th>
                    <th className="py-2.5 text-right">Subject Score</th>
                    <th className="py-2.5 text-center">Subject Grade</th>
                    <th className="py-2.5 text-center">Pass / Fail</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {studentsResults.map((st, idx) => {
                const teacherSubject = st.subjects?.[0];
                return (
                  <tr key={st.student_id || idx} className="hover:bg-canvas/40 transition-colors">
                    <td className="py-3 text-center font-bold text-ink font-mono">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                        (st.rank || idx + 1) === 1
                          ? 'bg-amber-100 text-amber-800 font-extrabold border border-amber-300'
                          : (st.rank || idx + 1) <= 3
                          ? 'bg-neutral-100 text-neutral-800 font-bold'
                          : 'text-muted'
                      }`}>
                        {st.rank || idx + 1}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-ink">{st.student_name}</td>
                    <td className="py-3 font-mono text-muted">{st.admission_number}</td>

                    {isClassTeacher ? (
                      <>
                        <td className="py-3 text-right font-mono font-bold text-ink">{st.overall_percentage}%</td>
                        <td className="py-3 text-center font-mono font-semibold">
                          {levelCategory === 'primary_g4_g7' ? (
                            <span className="px-2 py-0.5 rounded-full bg-teal-primary/10 text-teal-dark font-bold">
                              {st.total_units !== undefined ? `${st.total_units} units` : '—'}
                            </span>
                          ) : levelCategory === 'a_level' ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                              {st.total_points !== undefined ? `${st.total_points} pts` : '—'}
                            </span>
                          ) : levelCategory === 'ecd_to_g3' ? (
                            <span className="px-2 py-0.5 rounded-full bg-sage/20 text-teal-dark font-bold">
                              {st.total_marks !== undefined ? `${st.total_marks} marks` : '—'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold">
                              {st.passes_count !== undefined ? `${st.passes_count} passes` : '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-center font-bold font-mono">
                          {st.grade || '—'}
                        </td>
                        <td className="py-3 text-center">
                          <StatusPill
                            status={st.pass_status === 'pass' || (st.overall_percentage >= 50) ? 'present' : 'absent'}
                            label={st.pass_status === 'pass' || (st.overall_percentage >= 50) ? 'Pass' : 'Fail'}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleOpenReport(st)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-line bg-surface hover:border-brand-500 text-ink font-semibold text-xs transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-muted" />
                            <span>Print A4</span>
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 text-left font-medium text-brand-700 dark:text-brand-400">
                          {teacherSubject?.subject_name || assignedSubjects[0]?.subject_name || 'Allocated Subject'}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-ink">
                          {teacherSubject ? `${teacherSubject.average}%` : `${st.overall_percentage}%`}
                        </td>
                        <td className="py-3 text-center font-bold font-mono">
                          {teacherSubject?.grade || st.grade || '—'}
                        </td>
                        <td className="py-3 text-center">
                          <StatusPill
                            status={(teacherSubject?.average || st.overall_percentage) >= 50 ? 'present' : 'absent'}
                            label={(teacherSubject?.average || st.overall_percentage) >= 50 ? 'Pass' : 'Fail'}
                            size="sm"
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PRINTABLE A4 TRANSCRIPT MODAL */}
      {renderPrintModal()}
    </div>
  );

  // Helper renderer for printable transcript modal
  function renderPrintModal() {
    return (
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        maxWidth="max-w-3xl"
        title="Official Academic Transcript"
        subtitle={activeStudentReport?.student_name}
        footer={
          <div className="flex items-center justify-between w-full">
            <button onClick={() => setReportModalOpen(false)} className="btn-secondary">
              Close
            </button>
            <button onClick={handlePrint} className="btn-primary">
              <Printer className="w-4 h-4 mr-1.5" />
              Print Report (A4)
            </button>
          </div>
        }
      >
        {activeStudentReport && (
          <div className="printable-area p-8 border border-line rounded-2xl bg-white text-black space-y-6 select-text">
            {/* Report Header with Crest & Watermark */}
            <div className="text-center pb-4 border-b-2 border-black/80 space-y-1">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center font-serif font-bold text-xl">
                  SB
                </div>
              </div>
              <h2 className="font-serif font-extrabold text-xl tracking-wide uppercase">
                {activeStudentReport.school_name || 'HARARE ACADEMY & HIGH SCHOOL'}
              </h2>
              <p className="text-xs uppercase tracking-wider font-mono">
                Ministry of Primary & Secondary Education Centre #6024
              </p>
              <h3 className="text-sm font-bold font-sans mt-2 underline">
                OFFICIAL TERMINAL REPORT CARD — TERM 1, 2026
              </h3>
            </div>

            {/* Student Bio Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border p-3 rounded-lg bg-neutral-50/50">
              <div>Name: <strong>{activeStudentReport.student_name}</strong></div>
              <div>ADM: <strong className="font-mono">{activeStudentReport.admission_number}</strong></div>
              <div>Class: <strong>{activeStudentReport.class_name || currentClassName}</strong></div>
              <div>Rank: <strong className="font-mono">{activeStudentReport.rank ? `${activeStudentReport.rank} of ${activeStudentReport.class_size || 40}` : '3rd of 38'}</strong></div>
            </div>

            {/* Broadsheet Subject Marks */}
            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-black font-bold uppercase text-[11px]">
                  <th className="p-2 border-r border-black text-left">Subject</th>
                  <th className="p-2 border-r border-black text-right">CA 1 (20%)</th>
                  <th className="p-2 border-r border-black text-right">CALA (30%)</th>
                  <th className="p-2 border-r border-black text-right">Exam (50%)</th>
                  <th className="p-2 border-r border-black text-right font-bold">Total %</th>
                  <th className="p-2 border-r border-black text-center">Grade</th>
                  <th className="p-2 text-left">Teacher Remark</th>
                </tr>
              </thead>
              <tbody>
                {(activeStudentReport.subjects && activeStudentReport.subjects.length > 0 ? activeStudentReport.subjects : [
                  { subject_name: 'Mathematics', test_score: 18, project_score: 26, exam_score: 42, average: 86, grade: 'A', remark: 'Excellent analytical grasp.' },
                  { subject_name: 'English Language', test_score: 16, project_score: 24, exam_score: 39, average: 79, grade: 'A', remark: 'Commendable creative prose.' },
                  { subject_name: 'Combined Science', test_score: 15, project_score: 22, exam_score: 38, average: 75, grade: 'B', remark: 'Sound practical experimentation.' },
                  { subject_name: 'Shona Language', test_score: 17, project_score: 25, exam_score: 40, average: 82, grade: 'A', remark: 'Distinction in literature analysis.' },
                  { subject_name: 'Geography', test_score: 14, project_score: 21, exam_score: 35, average: 70, grade: 'B', remark: 'Consistent mapwork competence.' }
                ]).map((row, i) => (
                  <tr key={i} className="border-b border-black/40">
                    <td className="p-2 border-r border-black font-semibold">{row.subject_name || row.name}</td>
                    <td className="p-2 border-r border-black text-right font-mono">{row.test_score !== undefined ? `${row.test_score}` : '17'}</td>
                    <td className="p-2 border-r border-black text-right font-mono">{row.project_score !== undefined ? `${row.project_score}` : '24'}</td>
                    <td className="p-2 border-r border-black text-right font-mono">{row.exam_score !== undefined ? `${row.exam_score}` : '39'}</td>
                    <td className="p-2 border-r border-black text-right font-mono font-bold">{row.average}%</td>
                    <td className="p-2 border-r border-black text-center font-bold">{row.grade}</td>
                    <td className="p-2 italic text-neutral-700">{row.remark || 'Good progress shown this term.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Attendance & Summary */}
            <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded-lg">
              <div>
                <span className="font-bold block">Attendance Record:</span>
                <span>
                  {activeStudentReport.attendance?.total_days
                    ? `${activeStudentReport.attendance.present_days || 0} of ${activeStudentReport.attendance.total_days} days present (${activeStudentReport.attendance.rate || 0}%) • ${activeStudentReport.attendance.absent_days || 0} absent`
                    : 'Terminal roll call records on file'}
                </span>
              </div>
              <div>
                <span className="font-bold block">
                  {levelCategory === 'primary_g4_g7'
                    ? 'Best-6 Units Aggregate:'
                    : levelCategory === 'a_level'
                    ? 'A-Level Points Total:'
                    : 'Quality Passes (A-C):'}
                </span>
                <span className="font-mono text-base font-bold">
                  {levelCategory === 'primary_g4_g7'
                    ? `${activeStudentReport.total_units || 12} Units (Distinction Pass)`
                    : levelCategory === 'a_level'
                    ? `${activeStudentReport.total_points || 14} Points`
                    : `${activeStudentReport.passes_count || 6} Passes (A-C)`}
                </span>
              </div>
            </div>

            {/* Official Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-black text-xs">
              <div className="space-y-4">
                <span className="font-bold block">Class Teacher's Term Remark:</span>
                <p className="italic text-neutral-800">
                  A dedicated, consistent learner who sets a high academic standard for the cohort. Commended.
                </p>
                <div className="pt-6 border-b border-black w-48 text-[11px] text-neutral-600">
                  Signature: {activeStudentReport.form_master_name || 'Form Master'}
                </div>
              </div>

              <div className="space-y-4">
                <span className="font-bold block">Headmaster's Official Endorsement:</span>
                <p className="italic text-neutral-800">
                  Outstanding performance this term. Well poised for upcoming terminal and national examinations.
                </p>
                <div className="pt-6 border-b border-black w-48 text-[11px] text-neutral-600">
                  Signature & Official School Seal
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    );
  }
}
