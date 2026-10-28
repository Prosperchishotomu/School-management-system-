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
  GraduationCap, CalendarCheck, BookOpen, AlertCircle, Users, Check,
  Search, Filter, Sparkles, Layers, BarChart3, ChevronDown, CheckCircle, XCircle,
  MessageSquare, Settings2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { getCurrentTerm, formatTermLabel } from '../utils/dateTerms';

export default function Results() {
  const { user, activeSchoolId, activeSchool, schoolName } = useAuth();
  const currentTerm = getCurrentTerm();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const schoolId = activeSchoolId || user?.school_id || '';
  const userRole = user?.role || 'student';
  const isParent = ['parent', 'guardian', 'student'].includes(userRole);
  const isAdmin = ['school_admin', 'super_admin', 'principal', 'head', 'headmaster', 'deputy_head'].includes(userRole);
  const isTeacher = userRole === 'teacher';

  // Modal for A4 print
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeStudentReport, setActiveStudentReport] = useState(null);

  // ==========================================
  // ACADEMIC PERIOD ARCHIVE & HISTORICAL NAVIGATION
  // ==========================================
  const [selectedTerm, setSelectedTerm] = useState(() => searchParams.get('term') || currentTerm.name || 'Term 3');
  const [selectedYear, setSelectedYear] = useState(() => searchParams.get('year') || String(currentTerm.year || 2026));

  const isHistorical = selectedYear !== String(currentTerm.year) || selectedTerm !== currentTerm.name;

  const availableYears = useMemo(() => {
    const endYear = currentTerm.year || new Date().getFullYear();
    const startYear = endYear - 4;
    const yrs = [];
    for (let y = endYear; y >= startYear; y--) {
      yrs.push(String(y));
    }
    return yrs;
  }, [currentTerm.year]);

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
    isParent ? `parent_results_${schoolId}_${user?.id}_${selectedTerm}_${selectedYear}` : null,
    () => api.get(`/schools/${schoolId}/results?term=${encodeURIComponent(selectedTerm)}&year=${selectedYear}`),
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
      : (Array.isArray(parentResultsPayload?.data?.children_list)
          ? parentResultsPayload.data.children_list
          : []);

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
          : (Array.isArray(parentResultsPayload?.data?.results)
              ? parentResultsPayload.data.results
              : (Array.isArray(parentResultsPayload?.data) ? parentResultsPayload.data : [])));

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
    if (Array.isArray(parentResultsPayload.data?.results)) return parentResultsPayload.data.results;
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

  // Admin Directorate View Mode: 'broadsheet' vs 'analytics'
  const [adminViewMode, setAdminViewMode] = useState('broadsheet');
  const isSuperAdmin = userRole === 'super_admin';

  // Admin Analytics & Automated Submissions Aggregation
  const { 
    data: adminAnalyticsData, 
    loading: adminAnalyticsLoading,
    refetch: refetchAdminAnalytics
  } = useApi(
    isAdmin ? `admin_analytics_${schoolId}_${selectedTerm}` : null,
    () => api.get(`/schools/${schoolId}/grades/admin-analytics?term=${encodeURIComponent(selectedTerm)}`),
    { enabled: isAdmin }
  );
  const adminAnalytics = adminAnalyticsData?.data || adminAnalyticsData || {};

  const handleAdminUnlockClass = async (classId, className) => {
    if (!window.confirm(`Are you sure you want to unlock marks for ${className}? This is a Super Admin reversal.`)) return;
    try {
      await api.post(`/schools/${schoolId}/classes/${classId}/grades/unlock`, {
        term: selectedTerm,
        year: Number(selectedYear) || 2026
      });
      toast.success(`Marks for ${className} unlocked.`);
      invalidate([
        `admin_analytics_${schoolId}_${selectedTerm}`,
        `class_results_${schoolId}_${classId}`
      ]);
      refetchAdminAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to unlock class grades.');
    }
  };

  // 2. Fetch Classes
  const { data: classesData } = useApi(
    !isParent ? `results_classes_${schoolId}` : null,
    () => api.get(`/schools/${schoolId}/classes`),
    { enabled: !isParent }
  );
  const allClasses = Array.isArray(classesData)
    ? classesData
    : (Array.isArray(classesData?.data) ? classesData.data : (Array.isArray(classesData?.classes) ? classesData.classes : []));

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
    !isParent && selectedClassId ? `class_results_${schoolId}_${selectedClassId}_${selectedTerm}_${selectedYear}` : null,
    () => api.get(`/schools/${schoolId}/results?class_id=${selectedClassId}&term=${encodeURIComponent(selectedTerm)}&year=${selectedYear}`),
    { enabled: Boolean(!isParent && selectedClassId) }
  );

  const rawStudentsList = useMemo(() => {
    if (isParent || !classResultsPayload) return [];
    if (Array.isArray(classResultsPayload)) return classResultsPayload;
    if (Array.isArray(classResultsPayload.results)) return classResultsPayload.results;
    if (Array.isArray(classResultsPayload.data?.results)) return classResultsPayload.data.results;
    if (Array.isArray(classResultsPayload.data)) return classResultsPayload.data;
    return [];
  }, [isParent, classResultsPayload]);

  // Sort students in strictly descending order of performance
  const studentsResults = useMemo(() => {
    if (!rawStudentsList || rawStudentsList.length === 0) return [];
    return [...rawStudentsList].sort((a, b) => {
      // 1. If assigned rank exists (Rank 1 is highest)
      if (a.rank != null && b.rank != null && a.rank !== b.rank) {
        return Number(a.rank) - Number(b.rank);
      }
      // 2. Primary units: lower units is higher distinction (Unit 1 is top)
      if (a.total_units != null && b.total_units != null && a.total_units !== b.total_units) {
        return Number(a.total_units) - Number(b.total_units);
      }
      // 3. A-Level points: higher points is top
      if (a.total_points != null && b.total_points != null && a.total_points !== b.total_points) {
        return Number(b.total_points) - Number(a.total_points);
      }
      // 4. Overall percentage: descending (100% down to 0%)
      return (Number(b.overall_percentage) || 0) - (Number(a.overall_percentage) || 0);
    });
  }, [rawStudentsList]);

  // ==========================================
  // FILTERS & SEARCH (FOR TEACHERS & ADMINS)
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [broadsheetView, setBroadsheetView] = useState('full'); // 'full' (all subjects & marks) | 'summary'

  // Extract all distinct subjects across this class for the multi-subject broadsheet
  const classSubjects = useMemo(() => {
    const map = new Map();
    studentsResults.forEach(st => {
      (st.subjects || []).forEach(sub => {
        const name = sub.subject_name || sub.name;
        if (name && !map.has(name)) {
          map.set(name, {
            name,
            code: sub.subject_code || name.substring(0, 4).toUpperCase()
          });
        }
      });
    });
    return Array.from(map.values());
  }, [studentsResults]);

  const isClassTeacher = Boolean(classResultsPayload?.is_class_teacher || classResultsPayload?.data?.is_class_teacher || isAdmin);
  const isSubjectTeacher = Boolean(classResultsPayload?.is_subject_teacher || classResultsPayload?.data?.is_subject_teacher);
  const assignedSubjects = classResultsPayload?.assigned_subjects || classResultsPayload?.data?.assigned_subjects || [];
  const isSecondary = Boolean(classResultsPayload?.is_secondary || classResultsPayload?.data?.is_secondary);

  const streamComparison = classResultsPayload?.stream_comparison || classResultsPayload?.data?.stream_comparison || [];
  const isCohortAggregated = Boolean(classResultsPayload?.is_aggregated || classResultsPayload?.data?.is_aggregated || String(selectedClassId).startsWith('cohort:'));
  const cohortName = classResultsPayload?.cohort_name || classResultsPayload?.data?.cohort_name || (String(selectedClassId).startsWith('cohort:') ? String(selectedClassId).replace('cohort:', '').trim() : null);

  const currentClassObj = availableClasses.find(c => c.id === selectedClassId) || allClasses.find(c => c.id === selectedClassId);
  const currentClassName = isCohortAggregated
    ? `All ${cohortName || 'Cohort'} (${streamComparison.length > 0 ? streamComparison.length : 'All'} Streams Aggregated)`
    : (currentClassObj?.name || 'Class Broadsheet');

  // Build Cohort & Stream Options (aggregating sister streams into grade cohorts)
  const cohortOptions = useMemo(() => {
    if (!availableClasses || availableClasses.length === 0) return [];
    
    // Group classes by grade_level or first name word
    const gradeGroups = new Map();
    availableClasses.forEach(c => {
      const gLevel = c.grade_level || c.name.split(' ')[0] || 'Cohorts';
      if (!gradeGroups.has(gLevel)) gradeGroups.set(gLevel, []);
      gradeGroups.get(gLevel).push(c);
    });

    const options = [];
    gradeGroups.forEach((classesInGrade, gradeName) => {
      if (classesInGrade.length > 1) {
        options.push({
          id: `cohort:${gradeName}`,
          name: `⭐ All ${gradeName} (${classesInGrade.length} Streams Aggregated)`,
          is_aggregated: true,
          grade_name: gradeName
        });
      }
      classesInGrade.forEach(c => {
        options.push({
          id: c.id,
          name: classesInGrade.length > 1 ? `  ↳ ${c.name}` : c.name,
          role_type: c.role_type,
          subject_name: c.subject_name
        });
      });
    });
    return options;
  }, [availableClasses]);

  // Official Terminal Appraisal State
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evaluatingStudent, setEvaluatingStudent] = useState(null);
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalForm, setEvalForm] = useState({
    conduct: 'Good',
    class_teacher_remark: '',
    head_remark: '',
    next_term_date: ''
  });

  const handleOpenEvaluation = (student) => {
    setEvaluatingStudent(student);
    setEvalForm({
      conduct: student.conduct || 'Good',
      class_teacher_remark: student.class_teacher_remark || '',
      head_remark: student.head_remark || '',
      next_term_date: student.next_term_date || ''
    });
    setShowEvalModal(true);
  };

  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!evaluatingStudent) return;
    setEvalSubmitting(true);
    try {
      await api.put(`/schools/${schoolId}/students/${evaluatingStudent.student_id}/evaluation`, {
        term: selectedTerm,
        academic_year: selectedYear,
        ...evalForm
      });
      toast.success(`Appraisal recorded for ${evaluatingStudent.student_name}.`);
      setShowEvalModal(false);
      if (activeStudentReport && activeStudentReport.student_id === evaluatingStudent.student_id) {
        setActiveStudentReport(prev => ({ ...prev, ...evalForm }));
      }
      invalidate([`class_results_${schoolId}_${selectedClassId}`, `student_eval_${evaluatingStudent.student_id}`]);
      refetchClassResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save evaluation.');
    } finally {
      setEvalSubmitting(false);
    }
  };

  // Student Elective Subjects Assignment State
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectStudent, setSubjectStudent] = useState(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [allAvailableSubjects, setAllAvailableSubjects] = useState([]);
  const [subjectSubmitting, setSubjectSubmitting] = useState(false);

  const handleOpenSubjectAssignment = async (student) => {
    setSubjectStudent(student);
    try {
      const res = await api.get(`/schools/${schoolId}/students/${student.student_id}/subjects`);
      const assigned = res.data?.data?.assigned_subjects || res.data?.assigned_subjects || [];
      const available = res.data?.data?.available_subjects || res.data?.available_subjects || [];
      setSelectedSubjectIds(assigned.map(a => a.subject_id));
      setAllAvailableSubjects(available);
      setShowSubjectModal(true);
    } catch (err) {
      toast.error('Failed to load student subjects.');
    }
  };

  const applyComboPreset = (type) => {
    if (type === 'all') {
      setSelectedSubjectIds(allAvailableSubjects.map(s => s.id));
      return;
    }
    const keywords = {
      sciences: ['physics', 'chemistry', 'biology', 'mathematics', 'pure math', 'computer science'],
      commercials: ['accounting', 'accounts', 'commerce', 'business studies', 'economics', 'mathematics'],
      arts: ['history', 'literature', 'divinity', 'religious studies', 'geography', 'shona', 'ndebele', 'sociology']
    }[type] || [];

    const matched = allAvailableSubjects.filter(sub => {
      const n = (sub.name || '').toLowerCase();
      return keywords.some(k => n.includes(k));
    });
    setSelectedSubjectIds(matched.map(m => m.id));
  };

  const handleSaveStudentSubjects = async () => {
    if (!subjectStudent) return;
    setSubjectSubmitting(true);
    try {
      await api.put(`/schools/${schoolId}/students/${subjectStudent.student_id}/subjects`, {
        subject_ids: selectedSubjectIds,
        class_id: subjectStudent.class_id
      });
      toast.success(`Assigned ${selectedSubjectIds.length} subjects to ${subjectStudent.student_name}.`);
      setShowSubjectModal(false);
      invalidate([`class_results_${schoolId}_${selectedClassId}`, `students_${schoolId}`]);
      refetchClassResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save subject enrollment.');
    } finally {
      setSubjectSubmitting(false);
    }
  };

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
    setActiveStudentReport({
      ...student,
      term: student.term || selectedTerm,
      year: student.academic_year || student.year || selectedYear,
      academic_year: student.academic_year || student.year || selectedYear
    });
    setReportModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to convert any primary grade/score strictly to 'Unit X'
  const getPrimaryUnitLabel = (val, score) => {
    if (val && String(val).trim().toLowerCase().startsWith('unit')) return String(val).trim();
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) return `Unit ${num}`;
    const s = parseFloat(score || 0);
    if (s >= 80) return 'Unit 1';
    if (s >= 70) return 'Unit 2';
    if (s >= 60) return 'Unit 3';
    if (s >= 50) return 'Unit 4';
    if (s >= 45) return 'Unit 5';
    if (s >= 40) return 'Unit 6';
    if (s >= 35) return 'Unit 7';
    if (s >= 30) return 'Unit 8';
    return 'Unit 9';
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
    const cLevel = (currentClassObj?.level || '').toLowerCase();
    if (/form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b|advanced/i.test(cName)) return 'a_level';
    if (/form\s*[1-4]|ordinary/i.test(cName) || cLevel.includes('sec')) return 'o_level';
    return 'primary_g4_g7'; // All primary levels use units only
  }, [isParent, activeChildResult, studentsResults, currentClassObj]);

  const isPrimary = useMemo(() => {
    if (levelCategory === 'primary_g4_g7' || levelCategory === 'primary' || levelCategory === 'ecd_to_g3') return true;
    const cName = (activeChildResult?.class_name || activeStudentReport?.class_name || currentClassObj?.name || '').toLowerCase();
    const cLevel = (currentClassObj?.level || '').toLowerCase();
    if (/grade\s*[1-7]|ecd|infant|junior|primary/i.test(cName) || cLevel.includes('prim')) return true;
    return false;
  }, [levelCategory, activeChildResult, activeStudentReport, currentClassObj]);

  // Cohort grade distribution (teacher & admin view only)
  const gradeDistribution = useMemo(() => {
    if (isParent || !Array.isArray(studentsResults)) return [];
    const counts = {};
    studentsResults.forEach(st => {
      const g = isPrimary
        ? getPrimaryUnitLabel(st.grade, st.overall_percentage)
        : (st.grade || 'U');
      counts[g] = (counts[g] || 0) + 1;
    });
    if (Object.keys(counts).length === 0) {
      if (isPrimary) {
        return [
          { grade: 'Unit 1', count: 0 }, { grade: 'Unit 2', count: 0 }, { grade: 'Unit 3', count: 0 },
          { grade: 'Unit 4', count: 0 }, { grade: 'Unit 5', count: 0 }, { grade: 'Unit 6', count: 0 },
          { grade: 'Unit 7', count: 0 }, { grade: 'Unit 8', count: 0 }, { grade: 'Unit 9', count: 0 }
        ];
      }
      return [
        { grade: 'A', count: 0 }, { grade: 'B', count: 0 }, { grade: 'C', count: 0 },
        { grade: 'D', count: 0 }, { grade: 'E', count: 0 }, { grade: 'U', count: 0 }
      ];
    }
    return Object.entries(counts).map(([grade, count]) => ({ grade, count }));
  }, [isParent, studentsResults, isPrimary]);

  const cohortPassRate = useMemo(() => {
    if (!Array.isArray(studentsResults) || !studentsResults.length) return null;
    const passes = studentsResults.filter(s => s.pass_status === 'pass' || (s.overall_percentage >= 50));
    return parseFloat(((passes.length / studentsResults.length) * 100).toFixed(1));
  }, [studentsResults]);

  const cohortAggregateKpi = useMemo(() => {
    if (!Array.isArray(studentsResults) || !studentsResults.length) {
      if (isPrimary) return { label: 'Cohort Units Average', val: '—', note: 'Primary school units (Unit 1 is highest distinction)' };
      if (levelCategory === 'a_level') return { label: 'Points Average', val: '—', note: '5-point scale (A=5, B=4, C=3, D=2, E=1)' };
      return { label: 'Average Passes', val: '—', note: 'Pass grades: A, B, C' };
    }

    if (isPrimary) {
      const avgUnits = (studentsResults.reduce((acc, s) => acc + (s.total_units || 0), 0) / studentsResults.length).toFixed(1);
      return { label: 'Cohort Units Average', val: `${avgUnits} Units`, note: 'Ranked by Total Units (lower is better, 6 units is Best)' };
    }
    if (levelCategory === 'a_level') {
      const avgPts = (studentsResults.reduce((acc, s) => acc + (s.total_points || 0), 0) / studentsResults.length).toFixed(1);
      return { label: 'Points Average', val: `${avgPts} Pts`, note: 'A=5, B=4, C=3, D=2, E=1, O=0, F=0' };
    }
    const avgPasses = (studentsResults.reduce((acc, s) => acc + (s.passes_count || 0), 0) / studentsResults.length).toFixed(1);
    return { label: 'Average Quality Passes', val: `${avgPasses} Passes`, note: 'Symbols: A, B, C, D, E, U' };
  }, [studentsResults, levelCategory, isPrimary]);

  // Filtered student list according to active search and filters
  const filteredStudents = useMemo(() => {
    let list = studentsResults;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(st =>
        (st.student_name && st.student_name.toLowerCase().includes(q)) ||
        (st.admission_number && String(st.admission_number).toLowerCase().includes(q))
      );
    }

    if (selectedSubjectFilter !== 'all') {
      list = list.filter(st =>
        (st.subjects || []).some(s =>
          (s.subject_name || s.name)?.toLowerCase() === selectedSubjectFilter.toLowerCase() ||
          (s.subject_code && s.subject_code.toLowerCase() === selectedSubjectFilter.toLowerCase())
        )
      );
    }

    if (selectedGradeFilter !== 'all') {
      list = list.filter(st => {
        const pct = Number(st.overall_percentage) || 0;
        const g = String(st.grade || '').toUpperCase();
        const units = Number(st.total_units);
        if (selectedGradeFilter === 'distinction') {
          if (isPrimary) return (!isNaN(units) && units <= 12) || pct >= 75 || g === 'UNIT 1' || g === 'UNIT 2';
          if (levelCategory === 'a_level') return (Number(st.total_points) >= 10) || pct >= 75 || ['A', 'A*'].includes(g);
          return ['A', 'A*'].includes(g) || pct >= 75;
        }
        if (selectedGradeFilter === 'credit') {
          if (isPrimary) return (!isNaN(units) && units > 12 && units <= 24) || (pct >= 60 && pct < 75);
          return ['B', 'C'].includes(g) || (pct >= 60 && pct < 75);
        }
        if (selectedGradeFilter === 'pass') {
          return st.pass_status === 'pass' || pct >= 50;
        }
        if (selectedGradeFilter === 'fail') {
          return st.pass_status !== 'pass' && pct < 50;
        }
        return true;
      });
    }

    return list;
  }, [studentsResults, searchQuery, selectedSubjectFilter, selectedGradeFilter, isPrimary, levelCategory]);

  // Aggregate multi-subject performance analytics for 3D visual deck
  const subjectAnalytics = useMemo(() => {
    const map = new Map();
    studentsResults.forEach(st => {
      (st.subjects || []).forEach(sub => {
        const sName = sub.subject_name || sub.name;
        if (!sName) return;
        if (!map.has(sName)) {
          map.set(sName, {
            name: sName,
            code: sub.subject_code || sName.substring(0, 4).toUpperCase(),
            scores: [],
            passes: 0,
            distinctions: 0,
            highest: 0,
            lowest: 100
          });
        }
        const item = map.get(sName);
        const score = Number(sub.average ?? sub.overall_percentage ?? 0);
        item.scores.push(score);
        if (score >= 50) item.passes++;
        if (score >= 75) item.distinctions++;
        if (score > item.highest) item.highest = score;
        if (score < item.lowest) item.lowest = score;
      });
    });
    return Array.from(map.values()).map(item => {
      const avg = item.scores.length ? Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length) : 0;
      const passRate = item.scores.length ? Math.round((item.passes / item.scores.length) * 100) : 0;
      return {
        ...item,
        count: item.scores.length,
        average: avg,
        passRate
      };
    });
  }, [studentsResults]);

  // Academic Period Archive & Historical Navigator Component
  const renderPeriodNavigator = () => (
    <div className="glass-card p-4 rounded-2xl border border-line bg-surface/90 shadow-xs space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-400 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <span>Academic Period Navigation</span>
              {isHistorical ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Archived Period ({selectedTerm}, {selectedYear})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  Active Live Period
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted">
              Explore terminal examination results, report cards, and broadsheets across terms and academic years.
            </p>
          </div>
        </div>

        {/* Controls: Year Selector, Term Selector & Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Picker */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-canvas/60 text-xs">
            <span className="text-[11px] font-semibold text-muted font-mono">Academic Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-ink focus:outline-hidden cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr} className="text-ink bg-surface">
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Term Buttons */}
          <div className="flex items-center gap-1 p-1 rounded-xl border border-line bg-canvas/60 text-xs font-mono">
            {['Term 1', 'Term 2', 'Term 3'].map(term => (
              <button
                key={term}
                onClick={() => setSelectedTerm(term)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedTerm === term
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'text-muted hover:text-ink hover:bg-surface'
                }`}
              >
                {term}
              </button>
            ))}
          </div>

          {/* Return to Current Term */}
          {isHistorical && (
            <button
              onClick={() => {
                setSelectedTerm(currentTerm.name || 'Term 3');
                setSelectedYear(String(currentTerm.year || new Date().getFullYear()));
              }}
              className="px-3 py-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold text-xs transition cursor-pointer"
              title="Reset to current active term"
            >
              Current Term →
            </button>
          )}
        </div>
      </div>
    </div>
  );

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

        {/* Academic Period Archive Navigator */}
        {renderPeriodNavigator()}

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
            <div className="p-6 rounded-2xl bg-surface border border-line text-ink shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-mono tracking-wider text-brand-700 dark:text-brand-300 uppercase px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20">
                    {activeChildResult.class_name} • {activeChildResult.term || currentTerm.name}, {activeChildResult.year || currentTerm.year}
                  </span>
                  <StatusPill
                    status={activeChildResult.is_published ? 'published' : 'draft'}
                    label={activeChildResult.is_published ? 'Official Release' : 'Pending HOD Vetting'}
                    size="sm"
                  />
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-extrabold text-ink tracking-tight">
                  {activeChildResult.student_name}
                </h2>
                <p className="text-xs md:text-sm text-muted mt-1">
                  Admission No: <span className="font-mono font-bold text-ink">{activeChildResult.admission_number}</span> • Form Master: <span className="font-semibold text-ink">{activeChildResult.form_master_name}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleOpenReport(activeChildResult)}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-white" />
                  <span>View & Print Transcript</span>
                </button>
              </div>
            </div>

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-5 border border-line">
                <span className="text-xs text-muted font-medium uppercase font-mono">Terminal Average</span>
                <div className="text-2xl font-bold font-display text-brand-700 mt-1">
                  {activeChildResult.pass_status === 'ungraded' ? '0%' : `${activeChildResult.overall_percentage}%`}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {activeChildResult.pass_status === 'ungraded' ? (
                    'No terminal marks recorded'
                  ) : isPrimary ? (
                    <>Total Aggregate: <span className="font-bold text-ink">{activeChildResult.total_units || 0} Units</span> ({activeChildResult.pass_status === 'pass' ? 'Passing' : 'Needs Review'})</>
                  ) : (
                    <>Overall Grade: <span className="font-bold text-ink">{activeChildResult.grade}</span> ({activeChildResult.pass_status === 'pass' ? 'Passing' : 'Needs Review'})</>
                  )}
                </div>
              </div>

              <div className="glass-card p-5 border border-line">
                <span className="text-xs text-muted font-medium uppercase font-mono">
                  {isPrimary
                    ? 'Total Subject Units'
                    : activeChildResult.level_category === 'a_level'
                    ? 'ZIMSEC Points'
                    : 'Quality Passes (A-C)'}
                </span>
                <div className="text-2xl font-bold font-display text-ink mt-1">
                  {activeChildResult.pass_status === 'ungraded'
                    ? '0'
                    : (isPrimary
                    ? `${activeChildResult.total_units || 0} Units`
                    : activeChildResult.level_category === 'a_level'
                    ? `${activeChildResult.total_points || 0} Pts`
                    : `${activeChildResult.passes_count || 0} Passes`)}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {isPrimary
                    ? 'Units scale (1-9): Best = 6 Units (Unit 1 is highest distinction)'
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
                      <th className="py-3 px-3 text-center">{isPrimary ? 'Unit (1-9)' : 'Grade / Points'}</th>
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
                          {isPrimary ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-teal-primary/10 text-teal-dark border border-teal-primary/20">
                              {sub.units ? `Unit ${sub.units}` : getPrimaryUnitLabel(sub.grade, sub.average || sub.overall_percentage)}
                            </span>
                          ) : (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-extrabold ${
                              sub.grade === 'A'
                                ? 'bg-teal-primary/10 text-teal-dark border border-teal-primary/20'
                                : sub.grade === 'B'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : sub.grade === 'C'
                                ? 'bg-brand-50 text-brand-700 border border-brand-200'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}>
                              {sub.grade || '—'}
                            </span>
                          )}
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

            {/* Official Remarks Card - Wired to real database evaluation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Class Teacher's Term Appraisal" subtitle={`Form Master: ${activeChildResult.form_master_name || 'Class Teacher'}`}>
                <div className="p-4 rounded-xl bg-canvas/40 border border-line/60 space-y-3">
                  <p className="text-xs text-ink italic leading-relaxed">
                    "{activeChildResult.class_teacher_remark || (activeChildResult.evaluation && activeChildResult.evaluation.class_teacher_remark) || `${activeChildResult.student_name} has demonstrated sound academic commitment and consistent effort in terminal assessments. Commended.`}"
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted border-t border-line/60 pt-2 font-mono">
                    <span>Conduct: <strong className="text-ink">{activeChildResult.conduct || (activeChildResult.evaluation && activeChildResult.evaluation.conduct) || 'Good'}</strong></span>
                    <span>Class Standing: <strong className="text-ink">{activeChildResult.rank ? `Rank #${activeChildResult.rank}` : (activeChildResult.overall_percentage >= 50 ? 'Passing' : 'Review')}</strong></span>
                  </div>
                </div>
              </Card>

              <Card title="Headmaster's Endorsement" subtitle="Executive Academic Directorate">
                <div className="p-4 rounded-xl bg-canvas/40 border border-line/60 space-y-3">
                  <p className="text-xs text-ink italic leading-relaxed">
                    "{activeChildResult.head_remark || (activeChildResult.evaluation && activeChildResult.evaluation.head_remark) || 'A commendable terminal evaluation reflecting consistent hard work and dedication. Well positioned for upcoming term evaluations and national board preparation.'}"
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted border-t border-line/60 pt-2 font-mono">
                    <span>Next Term Begins: <strong className="text-ink">{activeChildResult.next_term_date || (activeChildResult.evaluation && activeChildResult.evaluation.next_term_date) || 'To be communicated'}</strong></span>
                    <span>Status: <strong className="text-ink">Enrolled</strong></span>
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
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex items-center p-1 rounded-xl border border-line bg-canvas text-xs font-semibold mr-1">
                <button
                  type="button"
                  onClick={() => setAdminViewMode('broadsheet')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    adminViewMode === 'broadsheet'
                      ? 'bg-brand-700 text-white shadow-2xs'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Class Broadsheets
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode('analytics')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    adminViewMode === 'analytics'
                      ? 'bg-brand-700 text-white shadow-2xs'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Admin Visual Analytics</span>
                </button>
              </div>
            )}

            <button
              onClick={() => {
                const token = sessionStorage.getItem('schoolbase_token') || localStorage.getItem('schoolbase_token');
                window.open(`/api/schools/${schoolId}/classes/${selectedClassId}/results/export?term=${encodeURIComponent(selectedTerm)}&year=${selectedYear}&token=${token}`, '_blank');
              }}
              className="btn-secondary text-xs flex items-center gap-1.5"
              title="Download CSV Broadsheet for this Term & Year"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

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

      {/* Academic Period Archive Navigator */}
      {renderPeriodNavigator()}

      {isAdmin && adminViewMode === 'analytics' ? (
        <div className="space-y-6">
          {/* Executive Directorate Header Banner */}
          <div className="p-6 rounded-2xl bg-linear-to-r from-brand-900 via-indigo-950 to-brand-900 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 text-white border border-white/30 uppercase tracking-wider">
                  Executive Directorate Analytics
                </span>
                <span className="text-xs text-white/80 font-mono">
                  {selectedTerm} • {selectedYear}
                </span>
              </div>
              <h2 className="text-2xl font-display font-extrabold tracking-tight">
                School-wide Academic Performance & Cohort Submissions
              </h2>
              <p className="text-xs text-white/70 max-w-2xl mt-1 leading-relaxed">
                Aggregated real-time metrics generated from class teacher submissions. Marks submitted by class teachers automatically populate these administrative analytics with immutability guarantees.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition border border-white/20 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Executive Report</span>
              </button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 border border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-mono font-bold uppercase">Overall Pass Rate</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold font-display text-emerald-600 dark:text-emerald-400 mt-2">
                {adminAnalytics.overall_pass_rate ?? 0}%
              </div>
              <div className="text-[11px] text-muted mt-1">Across all assessed learner examinations</div>
            </div>

            <div className="glass-card p-5 border border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-mono font-bold uppercase">School-wide Mean</span>
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-700 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold font-display text-ink mt-2">
                {adminAnalytics.overall_average ?? 0}%
              </div>
              <div className="text-[11px] text-muted mt-1">Institutional cumulative mean mark</div>
            </div>

            <div className="glass-card p-5 border border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-mono font-bold uppercase">Cohort Submissions</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold font-display text-ink mt-2">
                {adminAnalytics.submitted_cohorts || 0} / {adminAnalytics.total_cohorts || 0}
              </div>
              <div className="text-[11px] text-muted mt-1">Classes finalized & submitted to admin</div>
            </div>

            <div className="glass-card p-5 border border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-mono font-bold uppercase">Top Candidate</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold font-display text-ink mt-2">
                {adminAnalytics.top_achievers?.[0]?.average_mark ? `${adminAnalytics.top_achievers[0].average_mark}%` : '—'}
              </div>
              <div className="text-[11px] text-muted mt-1 truncate">
                {adminAnalytics.top_achievers?.[0] ? `${adminAnalytics.top_achievers[0].first_name} ${adminAnalytics.top_achievers[0].last_name} (${adminAnalytics.top_achievers[0].class_name})` : 'Awaiting grades'}
              </div>
            </div>
          </div>

          {/* Grid Layout: Cohort Submissions & Class Performance Table */}
          <Card
            title="Class Cohort Submissions & Performance League"
            subtitle="Real-time submission status, class teacher lock tracking, and pass rate analytics."
          >
            <div className="overflow-x-auto border border-line rounded-xl">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-canvas border-b border-line text-muted uppercase text-[11px]">
                    <th className="py-2.5 px-3 text-left">Class Cohort</th>
                    <th className="py-2.5 px-2 text-center">Grade Level</th>
                    <th className="py-2.5 px-3 text-right">Learners</th>
                    <th className="py-2.5 px-3 text-right">Assessed</th>
                    <th className="py-2.5 px-3 text-right">Average</th>
                    <th className="py-2.5 px-3 text-center min-w-[140px]">Pass Rate</th>
                    <th className="py-2.5 px-3 text-center">Submission Status</th>
                    <th className="py-2.5 px-3 text-right">Submitted By</th>
                    {isSuperAdmin && <th className="py-2.5 px-3 text-center">Admin Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {adminAnalyticsLoading ? (
                    <Skeleton variant="table-row" count={6} />
                  ) : (adminAnalytics.cohort_performance || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-muted">
                        No class records found for this academic period.
                      </td>
                    </tr>
                  ) : (
                    (adminAnalytics.cohort_performance || []).map((cp) => {
                      const isSubmitted = cp.submission_status === 'submitted' || cp.submission_status === 'verified';
                      return (
                        <tr key={cp.id} className="hover:bg-canvas/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-ink">
                            {cp.name}
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted font-mono">
                            {cp.grade_level || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-ink">
                            {cp.total_students}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-ink font-semibold">
                            {cp.assessed_students}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-700 dark:text-brand-400">
                            {cp.average_mark}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 h-1.5 bg-canvas rounded-full overflow-hidden border border-line">
                                <div
                                  className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, cp.pass_rate))}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-[11px]">{cp.pass_rate}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isSubmitted ? (
                              <StatusPill status="submitted" label="Submitted & Immutable" size="sm" />
                            ) : (
                              <StatusPill status="draft" label="Pending Submission" size="sm" />
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted text-[11px]">
                            {cp.submitted_by ? (
                              <div>
                                <span className="font-semibold text-ink block">{cp.submitted_by}</span>
                                <span className="text-[10px]">{cp.submitted_at ? new Date(cp.submitted_at).toLocaleDateString() : ''}</span>
                              </div>
                            ) : (
                              <span className="text-muted/50">—</span>
                            )}
                          </td>
                          {isSuperAdmin && (
                            <td className="py-2.5 px-3 text-center">
                              {isSubmitted ? (
                                <button
                                  type="button"
                                  onClick={() => handleAdminUnlockClass(cp.id, cp.name)}
                                  className="px-2.5 py-1 rounded-lg text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 font-bold text-[11px] transition flex items-center gap-1 mx-auto cursor-pointer"
                                  title="Super Admin reversal to unlock class marks"
                                >
                                  <Unlock className="w-3 h-3" />
                                  <span>Unlock</span>
                                </button>
                              ) : (
                                <span className="text-muted/40 text-[10px]">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Dual Column: Subject League Table & Gender Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject League Table */}
            <Card
              title="Subject League Table"
              subtitle="Ranked performance and examination pass rates by syllabus subject."
            >
              <div className="overflow-x-auto border border-line rounded-xl">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-canvas border-b border-line text-muted uppercase text-[11px]">
                      <th className="py-2 px-3 text-left">Subject</th>
                      <th className="py-2 px-2 text-right">Scripts</th>
                      <th className="py-2 px-3 text-right">Mean Score</th>
                      <th className="py-2 px-3 text-center">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {(adminAnalytics.subject_league || []).map((sub, i) => (
                      <tr key={sub.subject_name || i} className="hover:bg-canvas/30 transition-colors">
                        <td className="py-2 px-3 font-semibold text-ink flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-700 font-mono text-[10px] flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          <span>{sub.subject_name}</span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-muted">
                          {sub.assessed_count}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-ink">
                          {sub.average_mark}%
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            sub.pass_rate >= 70
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : sub.pass_rate >= 50
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                              : 'bg-danger/10 text-danger border border-danger/20'
                          }`}>
                            {sub.pass_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Gender Performance & Top Achievers Deck */}
            <div className="space-y-6">
              {/* Gender Comparison */}
              <Card
                title="Gender Equity & Cohort Distribution"
                subtitle="Comparative performance analysis between male and female candidates."
              >
                <div className="grid grid-cols-2 gap-4">
                  {(adminAnalytics.gender_distribution || []).map(g => {
                    const isFemale = (g.gender || '').toLowerCase().startsWith('f');
                    return (
                      <div key={g.gender} className="p-4 rounded-xl border border-line bg-canvas/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs uppercase tracking-wider text-muted font-mono">
                            {isFemale ? 'Female Learners' : 'Male Learners'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/10 text-brand-700">
                            {g.total_assessments} scripts
                          </span>
                        </div>
                        <div className="text-2xl font-extrabold font-display text-ink">
                          {g.average_mark}%
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span>Pass Rate:</span>
                          <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{g.pass_rate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Top 10 High Achievers */}
              <Card
                title="Top 10 Institutional Achievers"
                subtitle="Leading academic performers across all class cohorts."
              >
                <div className="divide-y divide-line/60 max-h-80 overflow-y-auto">
                  {(adminAnalytics.top_achievers || []).map((ach, idx) => (
                    <div key={ach.id || idx} className="py-2.5 px-3 flex items-center justify-between hover:bg-canvas/40 transition rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-500 text-white shadow-xs'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-canvas text-muted border border-line font-mono'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-ink text-xs">{ach.first_name} {ach.last_name}</div>
                          <div className="text-[10px] text-muted">{ach.class_name} • ADM: {ach.admission_number}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-sm text-brand-700 dark:text-brand-400">
                          {ach.average_mark}%
                        </div>
                        <div className="text-[10px] text-muted font-mono">{ach.subjects_count} Subjects</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <>
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
                  : `You are assigned as Subject Teacher. You are authorized to view marks for your allocated subject(s): ${(Array.isArray(assignedSubjects) ? assignedSubjects : []).map(s => s.subject_name).join(', ') || 'Assigned Subject'}. Full broadsheets are restricted to the Class Teacher.`}
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

      {/* ========================================================================= */}
      {/* 3D VISUAL PERFORMANCE DECK (FOR ADMINS, HEADS, AND TEACHERS)               */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {/* Class Selection & Inspection Control Bar */}
        <div className="p-5 rounded-2xl border border-line bg-surface/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-brand-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-brand-700/20 shrink-0">
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">
                  {currentClassName}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                  {formatTermLabel(selectedTerm)} • {selectedYear}
                </span>
                {isClassTeacher && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    {isAdmin ? 'School Administrator' : 'Form Master / Class Teacher'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {isAdmin
                  ? `Full administrative access: ${availableClasses.length} class cohorts available across the institution.`
                  : isClassTeacher
                  ? `Class Form Master broadsheet authorization. Multi-subject ledger and terminal transcripts enabled.`
                  : `Subject Teacher portal. Assigned to: ${assignedSubjects.map(s => s.subject_name).join(', ') || 'Class Syllabus'}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-canvas px-3 py-1.5 rounded-xl border border-line text-xs font-semibold">
              <span className="text-muted font-mono">Cohort / Stream:</span>
              <select
                value={selectedClassId}
                onChange={e => {
                  setSelectedClassId(e.target.value);
                  setSelectedSubjectFilter('all');
                  setSelectedGradeFilter('all');
                  setSearchQuery('');
                }}
                className="bg-transparent font-bold text-ink focus:outline-hidden cursor-pointer max-w-[280px] truncate"
              >
                {cohortOptions.map(c => (
                  <option 
                    key={c.id} 
                    value={c.id} 
                    className={`text-ink bg-surface ${c.is_aggregated ? 'font-bold text-brand-700 dark:text-brand-300' : ''}`}
                  >
                    {c.name} {c.role_type === 'class_teacher' ? '★ (Class Teacher)' : c.role_type === 'subject_teacher' ? `• (${c.subject_name || 'Subject'})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4-COLUMN 3D ISOMETRIC METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Cohort Pass Rate */}
          <div className="relative overflow-hidden rounded-2xl p-5 border border-line bg-linear-to-br from-surface to-surface/80 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.7)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted">Pass Rate</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold font-display text-emerald-600 dark:text-emerald-400 mt-2">
              {cohortPassRate !== null ? `${cohortPassRate}%` : '—'}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <div className="h-1.5 flex-1 bg-canvas rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full"
                  style={{ width: `${cohortPassRate !== null ? Math.min(100, Math.max(0, cohortPassRate)) : 0}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-bold">
                {studentsResults?.length > 0
                  ? `${studentsResults.filter(s => s.pass_status === 'pass' || s.overall_percentage >= 50).length}/${studentsResults.length}`
                  : 'No marks recorded'
                }
              </span>
            </div>
          </div>

          {/* 2. Academic Aggregate Benchmark */}
          <div className="relative overflow-hidden rounded-2xl p-5 border border-line bg-linear-to-br from-surface to-surface/80 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.7)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
                {cohortAggregateKpi.label}
              </span>
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-400 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold font-display text-ink mt-2">
              {cohortAggregateKpi.val}
            </div>
            <p className="text-[11px] text-muted mt-2 truncate" title={cohortAggregateKpi.note}>
              {cohortAggregateKpi.note}
            </p>
          </div>

          {/* 3. Class Enrollment & Capacity Limit */}
          <div className="relative overflow-hidden rounded-2xl p-5 border border-line bg-linear-to-br from-surface to-surface/80 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.7)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
                Class Limit & Enrolled
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold font-display text-ink mt-2 flex items-baseline gap-1.5">
              <span>{studentsResults.length}</span>
              {currentClassObj?.capacity ? (
                <span className="text-base font-normal text-muted">/ {currentClassObj.capacity}</span>
              ) : (
                <span className="text-xs font-normal text-muted">Learners</span>
              )}
            </div>
            {currentClassObj?.capacity ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <div className="h-1.5 flex-1 bg-canvas rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-blue-500 to-indigo-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((studentsResults.length / currentClassObj.capacity) * 100))}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] font-bold">
                  {Math.round((studentsResults.length / currentClassObj.capacity) * 100)}%
                </span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted font-mono">Enrolled candidates</div>
            )}
          </div>

          {/* 4. Top Performer / Dux Scholar */}
          <div className="relative overflow-hidden rounded-2xl p-5 border border-line bg-linear-to-br from-surface to-surface/80 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.7)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted">
                Cohort Leader (Rank #1)
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base font-bold text-ink mt-2 truncate" title={studentsResults[0]?.student_name || 'Pending'}>
              {studentsResults[0]?.student_name || 'No marks recorded'}
            </div>
            <div className="text-xs text-muted mt-1 flex items-center gap-2">
              <span className="font-mono font-extrabold text-brand-700 dark:text-brand-300 text-sm">
                {studentsResults[0]?.overall_percentage != null ? `${studentsResults[0].overall_percentage}%` : '—'}
              </span>
              {studentsResults[0] && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {isPrimary
                    ? getPrimaryUnitLabel(studentsResults[0].grade, studentsResults[0].overall_percentage)
                    : (studentsResults[0].grade || 'Grade A')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3D VISUAL DISTRIBUTION & CURRICULUM SUBJECT MASTERY DECK */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 3D Grade / Units Distribution Histogram */}
          <div className="lg:col-span-1 rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h4 className="font-bold text-sm text-ink flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                    <span>{isPrimary ? "Units Histogram (1-9)" : "Grade Spread (A-U)"}</span>
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5">
                    {isPrimary ? 'Primary units frequency (Unit 1 is top distinction)' : 'Letter grade breakdown across cohort'}
                  </p>
                </div>
              </div>

              <div className="h-52 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="grade" stroke="var(--muted)" fontSize={11} />
                    <YAxis stroke="var(--muted)" fontSize={11} />
                    <Tooltip
                      formatter={(v) => [v, 'Students']}
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--line)',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {gradeDistribution.map((entry, idx) => {
                        const g = String(entry.grade || '').toUpperCase();
                        let color = '#2563eb';
                        if (g === 'A' || g === '1' || g.includes('UNIT 1') || g.includes('DIST')) color = '#059669';
                        else if (g === 'B' || g === '2' || g.includes('UNIT 2') || g.includes('MERIT')) color = '#0284c7';
                        else if (g === 'C' || g === '3' || g.includes('UNIT 3') || g.includes('CRED')) color = '#7c3aed';
                        else if (g === 'D' || g === '4' || g.includes('UNIT 4')) color = '#d97706';
                        else if (g === 'E' || g === '5') color = '#ea580c';
                        else if (g === 'U' || g.includes('FAIL') || g.includes('UNIT 9')) color = '#e11d48';
                        return <Cell key={`grade-cell-${idx}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-line text-[11px] text-muted flex items-center justify-between font-mono">
              <span>Cohort Size: {studentsResults.length}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Pass Threshold: 50%</span>
            </div>
          </div>

          {/* Right: 3D Curriculum Subject Mastery Grid */}
          <div className="lg:col-span-2 rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
                <div>
                  <h4 className="font-bold text-sm text-ink flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                    <span>Curriculum Subject Mastery Deck ({classSubjects.length} Syllabi)</span>
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5">
                    Live performance breakdown per subject syllabus with mean marks and passing rates.
                  </p>
                </div>
                {selectedSubjectFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedSubjectFilter('all')}
                    className="text-xs text-brand-700 dark:text-brand-300 font-bold hover:underline self-start sm:self-auto cursor-pointer"
                  >
                    Clear Filter ({selectedSubjectFilter})
                  </button>
                )}
              </div>

              {subjectAnalytics.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted italic">
                  No subject examination marks compiled yet for this cohort in {formatTermLabel(selectedTerm)}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  {subjectAnalytics.map(sub => {
                    const isSelected = selectedSubjectFilter.toLowerCase() === sub.name.toLowerCase();
                    return (
                      <div
                        key={sub.name}
                        onClick={() => setSelectedSubjectFilter(isSelected ? 'all' : sub.name)}
                        className={`group relative rounded-xl p-3.5 border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-500/10 border-brand-500/40 shadow-sm ring-2 ring-brand-500/30'
                            : 'bg-canvas/50 hover:bg-canvas border-line hover:border-brand-500/30 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-ink truncate max-w-[130px]" title={sub.name}>
                            {sub.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface border border-line text-muted">
                            {sub.code}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between mt-2">
                          <div>
                            <span className="text-[10px] uppercase font-mono text-muted block">Class Mean</span>
                            <span className="text-lg font-black font-display text-ink">{sub.average}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-mono text-muted block">Pass Rate</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              {sub.passRate}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 h-1.5 bg-line/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              sub.passRate >= 75
                                ? 'bg-linear-to-r from-emerald-500 to-teal-400'
                                : sub.passRate >= 50
                                ? 'bg-linear-to-r from-blue-500 to-indigo-400'
                                : 'bg-linear-to-r from-amber-500 to-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, sub.passRate))}%` }}
                          />
                        </div>

                        <div className="mt-2 pt-2 border-t border-line/60 flex items-center justify-between text-[10px] text-muted">
                          <span>Peak: <strong className="text-ink">{sub.highest}%</strong></span>
                          <span className="font-bold text-brand-700 dark:text-brand-300 group-hover:underline">
                            {isSelected ? 'Filtering Active ✓' : 'Focus Subject →'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-line text-[11px] text-muted flex items-center justify-between">
              <span>Click any subject tile to filter the broadsheet marks below</span>
              <span className="font-mono">{formatTermLabel(selectedTerm)} • {selectedYear}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE BROADSHEET SEARCH & FILTER TOOLBAR                             */}
        {/* ========================================================================= */}
        <div className="glass-card p-4 rounded-2xl border border-line bg-surface/90 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student by name or admission number..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-canvas/60 border border-line text-ink placeholder:text-muted focus:outline-hidden focus:border-brand-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Subject Filter Dropdown */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-canvas/60 text-xs">
                <BookOpen className="w-3.5 h-3.5 text-muted" />
                <span className="text-[11px] font-semibold text-muted font-mono">Subject:</span>
                <select
                  value={selectedSubjectFilter}
                  onChange={e => setSelectedSubjectFilter(e.target.value)}
                  className="bg-transparent font-bold text-ink focus:outline-hidden cursor-pointer"
                >
                  <option value="all" className="text-ink bg-surface">All Class Subjects ({classSubjects.length})</option>
                  {classSubjects.map(s => (
                    <option key={s.name} value={s.name} className="text-ink bg-surface">
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Standing Filter Dropdown */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-canvas/60 text-xs">
                <Filter className="w-3.5 h-3.5 text-muted" />
                <span className="text-[11px] font-semibold text-muted font-mono">Standing:</span>
                <select
                  value={selectedGradeFilter}
                  onChange={e => setSelectedGradeFilter(e.target.value)}
                  className="bg-transparent font-bold text-ink focus:outline-hidden cursor-pointer"
                >
                  <option value="all" className="text-ink bg-surface">All Standings</option>
                  <option value="distinction" className="text-ink bg-surface">
                    {isPrimary ? 'Distinctions (Units 1-2 / 75%+)' : levelCategory === 'a_level' ? 'Distinctions (10+ Pts / A)' : 'Distinctions (Grade A)'}
                  </option>
                  <option value="credit" className="text-ink bg-surface">
                    {isPrimary ? 'Merits / Credits (Units 3-5)' : 'Credits (Grade B-C)'}
                  </option>
                  <option value="pass" className="text-ink bg-surface">Passing (50%+)</option>
                  <option value="fail" className="text-ink bg-surface">Needs Remedial (&lt;50%)</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              {(searchQuery || selectedSubjectFilter !== 'all' || selectedGradeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSubjectFilter('all');
                    setSelectedGradeFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-canvas text-xs font-semibold text-ink transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}

              {/* Live Count Badge */}
              <div className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 font-mono text-[11px] font-bold">
                Showing {filteredStudents.length} of {studentsResults.length} learners
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STREAM PERFORMANCE COMPARISON DECK (WHEN COHORT HAS MULTIPLE STREAMS)       */}
        {/* ========================================================================= */}
        {streamComparison.length > 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-700" />
                  <span>Stream Comparative Performance Breakdown</span>
                </h3>
                <p className="text-xs text-muted">
                  Cross-stream academic comparison across all {streamComparison.length} streams in {cohortName || 'this cohort'}
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300">
                {streamComparison.reduce((acc, s) => acc + (s.student_count || 0), 0)} Total Learners
              </span>
            </div>

            {/* Stream Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {streamComparison.map((strm, idx) => (
                <div
                  key={strm.stream_id || idx}
                  className="p-3.5 rounded-2xl border border-line bg-surface shadow-2xs hover:border-brand-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="font-bold text-ink text-xs truncate">{strm.stream_name || strm.stream}</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-canvas border border-line text-muted">
                      {strm.student_count} learners
                    </span>
                  </div>

                  <div className="py-3 space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">Mean Score:</span>
                        <span className="font-mono font-extrabold text-ink">{strm.mean_score}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.min(100, Math.max(0, strm.mean_score))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Pass Rate:</span>
                      <span className={`font-mono font-bold ${
                        strm.pass_rate >= 70 ? 'text-brand-700 dark:text-brand-300' : strm.pass_rate >= 50 ? 'text-amber-600' : 'text-danger'
                      }`}>
                        {strm.pass_rate}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Distinctions:</span>
                      <span className="font-mono font-semibold text-ink">{strm.distinctions || 0}</span>
                    </div>

                    {strm.top_student && (
                      <div className="pt-2 border-t border-line/60 text-[11px] truncate">
                        <span className="text-muted">Top: </span>
                        <span className="font-semibold text-ink">{strm.top_student.name}</span>
                        <span className="font-mono text-brand-700 ml-1">({strm.top_student.score}%)</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedClassId(strm.stream_id)}
                    className="w-full mt-1 py-1 rounded-lg border border-line bg-canvas hover:bg-surface text-[11px] font-bold text-brand-700 transition cursor-pointer text-center"
                  >
                    Drill Into {strm.stream_name || strm.stream}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CLASS RANKING & MULTI-SUBJECT BROADSHEET TABLE                             */}
        {/* ========================================================================= */}
        <Card
          title={
            isClassTeacher
              ? `Class Broadsheet: ${currentClassName}`
              : `Subject Mark Sheet: ${currentClassName} — ${assignedSubjects[0]?.subject_name || 'Allocated Subject'}`
          }
          subtitle={
            isClassTeacher
              ? (isPrimary
                  ? 'Official multi-subject broadsheet displaying all enrolled learners with individual subjects, marks, and units in descending rank order (Unit 1 is highest distinction)'
                  : levelCategory === 'a_level'
                  ? 'Official multi-subject broadsheet displaying all enrolled learners with individual subjects, marks, and ZIMSEC points in descending order (A=5, B=4, C=3, D=2, E=1)'
                  : 'Official multi-subject broadsheet displaying all enrolled learners with individual subjects, marks, and symbols (A-U) in descending rank order')
              : 'Subject Teacher ledger: Displaying marks, units, and standings for your allocated syllabus.'
          }
          actions={
            isClassTeacher && classSubjects.length > 0 ? (
              <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-line text-xs font-semibold">
                <button
                  onClick={() => setBroadsheetView('full')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    broadsheetView === 'full' ? 'bg-surface text-brand-700 shadow-xs font-bold' : 'text-muted hover:text-ink'
                  }`}
                >
                  Multi-Subject View ({classSubjects.length})
                </button>
                <button
                  onClick={() => setBroadsheetView('summary')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    broadsheetView === 'summary' ? 'bg-surface text-brand-700 shadow-xs font-bold' : 'text-muted hover:text-ink'
                  }`}
                >
                  Summary View
                </button>
              </div>
            ) : null
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-muted uppercase text-[11px] bg-canvas/30">
                  <th className="py-2.5 px-3 text-center w-12">
                    {isCohortAggregated ? 'Univ Rank' : 'Rank'}
                  </th>
                  {isCohortAggregated && (
                    <th className="py-2.5 px-2 text-center w-14">Stream Rank</th>
                  )}
                  <th className="py-2.5 px-3 text-left min-w-[170px]">Learner Name</th>
                  {isCohortAggregated && (
                    <th className="py-2.5 px-2 text-center w-24">Stream</th>
                  )}
                  <th className="py-2.5 px-3 text-left w-24">Adm No</th>
                  {isClassTeacher ? (
                    <>
                      {broadsheetView === 'full' && classSubjects.map(sub => {
                        const isTargetFilter = selectedSubjectFilter.toLowerCase() === sub.name.toLowerCase();
                        return (
                          <th
                            key={sub.name}
                            className={`py-2.5 px-2 text-center min-w-[95px] transition-colors ${
                              isTargetFilter ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300 font-bold' : ''
                            }`}
                            title={sub.name}
                          >
                            <div>{sub.code || sub.name}</div>
                            <div className="text-[9px] text-muted font-normal lowercase truncate max-w-[90px]">{sub.name}</div>
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-3 text-right min-w-[90px]">Weighted Avg</th>
                      <th className="py-2.5 px-3 text-center min-w-[95px]">
                        {isPrimary
                          ? 'Total Units'
                          : levelCategory === 'a_level'
                          ? 'Total Points'
                          : 'Passes (A-C)'}
                      </th>
                      <th className="py-2.5 px-3 text-center min-w-[90px]">{isPrimary ? 'Unit' : 'Grade'}</th>
                      <th className="py-2.5 px-3 text-center w-20">Status</th>
                      <th className="py-2.5 px-3 text-right min-w-[180px]">Actions</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-3 text-left">Allocated Subject</th>
                      <th className="py-2.5 px-3 text-right">Subject Score</th>
                      <th className="py-2.5 px-3 text-center">{isPrimary ? 'Unit' : 'Subject Grade'}</th>
                      <th className="py-2.5 px-3 text-center">Pass / Fail</th>
                      <th className="py-2.5 px-3 text-right min-w-[100px]">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={isClassTeacher ? (broadsheetView === 'full' ? classSubjects.length + 10 : 10) : 8}>
                      <div className="p-8 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-400 flex items-center justify-center mx-auto">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-bold text-ink">No matching learners found</h4>
                        <p className="text-xs text-muted max-w-sm mx-auto">
                          {searchQuery || selectedSubjectFilter !== 'all' || selectedGradeFilter !== 'all'
                            ? 'No learners in this cohort match the active search or filter criteria.'
                            : 'No student results compiled for this class yet in this term.'}
                        </p>
                        {(searchQuery || selectedSubjectFilter !== 'all' || selectedGradeFilter !== 'all') && (
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setSelectedSubjectFilter('all');
                              setSelectedGradeFilter('all');
                            }}
                            className="btn-secondary text-xs inline-flex items-center gap-1.5"
                          >
                            Clear Active Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const teacherSubject = st.subjects?.[0];
                    return (
                      <tr key={st.student_id || idx} className="hover:bg-canvas/40 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-ink font-mono">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                            (st.form_rank || st.rank || idx + 1) === 1
                              ? 'bg-amber-100 text-amber-800 font-extrabold border border-amber-300'
                              : (st.form_rank || st.rank || idx + 1) <= 3
                              ? 'bg-neutral-100 text-neutral-800 font-bold'
                              : 'text-muted'
                          }`}>
                            {st.form_rank || st.rank || idx + 1}
                          </span>
                        </td>

                        {isCohortAggregated && (
                          <td className="py-2.5 px-2 text-center font-mono text-muted text-[11px]">
                            {st.class_rank ? `#${st.class_rank}` : '—'}
                          </td>
                        )}

                        <td className="py-2.5 px-3 font-semibold text-ink whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{st.student_name}</span>
                            {st.combination && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                                {st.combination}
                              </span>
                            )}
                          </div>
                        </td>

                        {isCohortAggregated && (
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-canvas border border-line font-medium text-[10px] text-ink">
                              {st.stream || st.class_name}
                            </span>
                          </td>
                        )}

                        <td className="py-2.5 px-3 font-mono text-muted text-[11px] whitespace-nowrap">{st.admission_number}</td>

                        {isClassTeacher ? (
                          <>
                            {/* Multi-subject marks per student */}
                            {broadsheetView === 'full' && classSubjects.map(sub => {
                              const match = (st.subjects || []).find(s => (s.subject_name || s.name)?.toLowerCase() === sub.name.toLowerCase() || (s.subject_code && s.subject_code.toLowerCase() === sub.code.toLowerCase()));
                              const isTargetFilter = selectedSubjectFilter.toLowerCase() === sub.name.toLowerCase();
                              
                              // Check if learner is enrolled in this elective subject
                              const isEnrolledInSubject = (st.enrolled_subject_ids || []).includes(sub.id) ||
                                (st.enrolled_subject_names || []).some(n => n.toLowerCase() === sub.name.toLowerCase()) ||
                                Boolean(match);

                              if (!match) {
                                if (isEnrolledInSubject) {
                                  return (
                                    <td
                                      key={sub.name}
                                      className={`py-2 px-2 text-center font-mono text-[11px] ${
                                        isTargetFilter ? 'bg-brand-500/5' : ''
                                      }`}
                                      title="Learner enrolled — marks pending assessment recording"
                                    >
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                        Pending
                                      </span>
                                    </td>
                                  );
                                }
                                return (
                                  <td
                                    key={sub.name}
                                    className={`py-2 px-2 text-center text-muted/50 font-mono text-[11px] ${
                                      isTargetFilter ? 'bg-brand-500/5' : ''
                                    }`}
                                    title="Not enrolled in this elective subject"
                                  >
                                    —
                                  </td>
                                );
                              }
                              const score = match.average ?? match.overall_percentage;
                              const grade = isPrimary
                                ? (match.units ? `U${match.units}` : getPrimaryUnitLabel(match.grade, score))
                                : (match.grade || '—');
                              return (
                                <td
                                  key={sub.name}
                                  className={`py-2 px-2 text-center font-mono text-[11px] whitespace-nowrap ${
                                    isTargetFilter ? 'bg-brand-500/10 font-bold ring-1 ring-brand-500/20' : ''
                                  }`}
                                >
                                  <div className="font-extrabold text-ink">{score != null ? `${score}%` : '—'}</div>
                                  <div className={`text-[10px] font-bold ${
                                    isPrimary
                                      ? 'text-teal-dark dark:text-teal-400'
                                      : ['A', 'B', 'C'].includes(match.grade)
                                      ? 'text-brand-700 dark:text-brand-400'
                                      : 'text-muted'
                                  }`}>
                                    {grade}
                                  </div>
                                </td>
                              );
                            })}

                            <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-ink">{st.overall_percentage}%</td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold whitespace-nowrap">
                              {isPrimary ? (
                                <span className="px-2 py-0.5 rounded-full bg-teal-primary/10 text-teal-dark font-bold text-xs">
                                  {st.total_units !== undefined ? `${st.total_units} units` : '—'}
                                </span>
                              ) : levelCategory === 'a_level' ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold text-xs">
                                  {st.total_points !== undefined ? `${st.total_points} pts` : '—'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-bold text-xs">
                                  {st.passes_count !== undefined ? `${st.passes_count} passes` : '—'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold font-mono">
                              {isPrimary
                                ? (st.units ? `Unit ${st.units}` : getPrimaryUnitLabel(st.grade, st.overall_percentage))
                                : (st.grade || '—')}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <StatusPill
                                status={st.pass_status === 'pass' || (st.overall_percentage >= 50) ? 'present' : 'absent'}
                                label={st.pass_status === 'pass' || (st.overall_percentage >= 50) ? 'Pass' : 'Fail'}
                                size="sm"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEvaluation(st)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-line bg-surface hover:bg-canvas text-ink font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                                  title="Record or update terminal appraisal remarks"
                                >
                                  <Award className="w-3.5 h-3.5 text-brand-700" />
                                  <span>Appraise</span>
                                </button>
                                {isSecondary && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSubjectAssignment(st)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-line bg-surface hover:bg-canvas text-ink font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                                    title="Assign / update enrolled elective subjects"
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-info" />
                                    <span>Electives</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenReport(st)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-line bg-surface hover:border-brand-500 text-ink font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                                >
                                  <Printer className="w-3.5 h-3.5 text-muted" />
                                  <span>Print A4</span>
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-left font-medium text-brand-700 dark:text-brand-400">
                              {teacherSubject?.subject_name || assignedSubjects[0]?.subject_name || 'Allocated Subject'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">
                              {teacherSubject ? `${teacherSubject.average}%` : `${st.overall_percentage}%`}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold font-mono">
                              {isPrimary
                                ? (teacherSubject?.units ? `Unit ${teacherSubject.units}` : getPrimaryUnitLabel(teacherSubject?.grade || st.grade, teacherSubject ? teacherSubject.average : st.overall_percentage))
                                : (teacherSubject?.grade || st.grade || '—')}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <StatusPill
                                status={(teacherSubject?.average || st.overall_percentage) >= 50 ? 'present' : 'absent'}
                                label={(teacherSubject?.average || st.overall_percentage) >= 50 ? 'Pass' : 'Fail'}
                                size="sm"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenReport(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-line bg-surface hover:border-brand-500 text-ink font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                              >
                                <Printer className="w-3.5 h-3.5 text-muted" />
                                <span>Report Card</span>
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* PRINTABLE A4 TRANSCRIPT MODAL */}
      {renderPrintModal()}

      {/* OFFICIAL TERMINAL APPRAISAL MODAL */}
      <Modal
        isOpen={showEvalModal}
        onClose={() => setShowEvalModal(false)}
        title={`Terminal Appraisal: ${evaluatingStudent?.student_name || 'Learner'}`}
        description="Record official conduct rating, form master remark, and headmaster's endorsement for the printed report card."
      >
        <form onSubmit={handleSaveEvaluation} className="space-y-4">
          <div className="p-3 rounded-xl bg-canvas border border-line text-xs flex justify-between">
            <div>
              <span className="text-muted block">Admission Number</span>
              <span className="font-mono font-bold text-ink">{evaluatingStudent?.admission_number || '—'}</span>
            </div>
            <div>
              <span className="text-muted block">Current Standing</span>
              <span className="font-bold text-brand-700 font-mono">
                {evaluatingStudent?.overall_percentage}% • Rank #{evaluatingStudent?.rank || '—'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">General Conduct & Discipline Rating *</label>
            <select
              value={evalForm.conduct}
              onChange={e => setEvalForm({ ...evalForm, conduct: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
            >
              <option value="Excellent">Excellent — Exemplary discipline and attitude</option>
              <option value="Very Good">Very Good — Highly cooperative and responsible</option>
              <option value="Good">Good — Satisfactory general demeanor</option>
              <option value="Fair">Fair — Average compliance, occasional reminders needed</option>
              <option value="Needs Improvement">Needs Improvement — Requires focused behavioral intervention</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Class Teacher's Term Appraisal *</label>
            <textarea
              required
              rows={3}
              value={evalForm.class_teacher_remark}
              onChange={e => setEvalForm({ ...evalForm, class_teacher_remark: e.target.value })}
              placeholder="e.g. Shows great diligence and academic discipline across all subjects. Commended for consistency."
              className="w-full p-3 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Headmaster's Official Endorsement</label>
            <textarea
              rows={2}
              value={evalForm.head_remark}
              onChange={e => setEvalForm({ ...evalForm, head_remark: e.target.value })}
              placeholder="e.g. An excellent terminal achievement. Positioned well for national examinations."
              className="w-full p-3 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Next Term Re-opening Date</label>
            <input
              type="date"
              value={evalForm.next_term_date}
              onChange={e => setEvalForm({ ...evalForm, next_term_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowEvalModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={evalSubmitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {evalSubmitting ? 'Recording...' : 'Save Official Appraisal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* STUDENT ELECTIVES ASSIGNMENT MODAL */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title={`Elective Syllabus: ${subjectStudent?.student_name || 'Learner'}`}
        description="Allocate specific curriculum subjects studied by this secondary or A-level student."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-canvas border border-line">
            <span className="text-[11px] font-bold text-muted px-2">Combination Presets:</span>
            <button
              type="button"
              onClick={() => applyComboPreset('sciences')}
              className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-brand-500 text-[11px] font-bold text-ink"
            >
              🔬 Sciences
            </button>
            <button
              type="button"
              onClick={() => applyComboPreset('commercials')}
              className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-brand-500 text-[11px] font-bold text-ink"
            >
              📊 Commercials
            </button>
            <button
              type="button"
              onClick={() => applyComboPreset('arts')}
              className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-brand-500 text-[11px] font-bold text-ink"
            >
              📚 Arts & Humanities
            </button>
            <button
              type="button"
              onClick={() => applyComboPreset('all')}
              className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-brand-500 text-[11px] font-bold text-ink"
            >
              All Subjects
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 border border-line rounded-xl p-2 bg-canvas/30">
            {allAvailableSubjects.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted">No curriculum subjects registered in this school.</div>
            ) : (
              allAvailableSubjects.map(sub => {
                const checked = selectedSubjectIds.includes(sub.id);
                return (
                  <label
                    key={sub.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                      checked
                        ? 'border-brand-500 bg-brand-500/10 text-brand-900 dark:text-brand-100 font-bold'
                        : 'border-line bg-surface text-ink hover:bg-canvas font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedSubjectIds([...selectedSubjectIds, sub.id]);
                          } else {
                            setSelectedSubjectIds(selectedSubjectIds.filter(id => id !== sub.id));
                          }
                        }}
                        className="rounded border-line text-brand-700 focus:ring-brand-500"
                      />
                      <span>{sub.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted uppercase">
                      {sub.code || sub.department || 'General'}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
            <span className="font-semibold text-muted">
              {selectedSubjectIds.length} subjects enrolled
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStudentSubjects}
                disabled={subjectSubmitting}
                className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
              >
                {subjectSubmitting ? 'Saving...' : 'Save Enrolled Subjects'}
              </button>
            </div>
          </div>
        </div>
        </Modal>
        </>
      )}
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
                {activeStudentReport.school_name || activeSchool?.name || schoolName || 'School Academic Report'}
              </h2>
              <p className="text-xs uppercase tracking-wider font-mono">
                Ministry of Primary & Secondary Education Centre #{activeStudentReport.center_no || activeSchool?.center_no || '—'}
              </p>
              <h3 className="text-sm font-bold font-sans mt-2 underline">
                OFFICIAL TERMINAL REPORT CARD — {(activeStudentReport?.term || selectedTerm).toUpperCase()}, {activeStudentReport?.academic_year || activeStudentReport?.year || selectedYear}
              </h3>
            </div>

            {/* Student Bio Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border p-3 rounded-lg bg-neutral-50/50">
              <div>Name: <strong>{activeStudentReport.student_name}</strong></div>
              <div>ADM: <strong className="font-mono">{activeStudentReport.admission_number || '—'}</strong></div>
              <div>Class: <strong>{activeStudentReport.class_name || currentClassName}</strong></div>
              <div>Rank: <strong className="font-mono">{activeStudentReport.rank ? `${activeStudentReport.rank} of ${activeStudentReport.class_size || '—'}` : '—'}</strong></div>
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
                  <th className="p-2 border-r border-black text-center">{isPrimary ? 'Unit (1-9)' : 'Grade'}</th>
                  <th className="p-2 text-left">Teacher Remark</th>
                </tr>
              </thead>
              <tbody>
                {activeStudentReport.subjects && activeStudentReport.subjects.length > 0 ? (
                  activeStudentReport.subjects.map((row, i) => (
                    <tr key={i} className="border-b border-black/40">
                      <td className="p-2 border-r border-black font-semibold">{row.subject_name || row.name}</td>
                      <td className="p-2 border-r border-black text-right font-mono">{row.test_score !== undefined && row.test_score !== null ? `${row.test_score}` : '—'}</td>
                      <td className="p-2 border-r border-black text-right font-mono">{row.project_score !== undefined && row.project_score !== null ? `${row.project_score}` : '—'}</td>
                      <td className="p-2 border-r border-black text-right font-mono">{row.exam_score !== undefined && row.exam_score !== null ? `${row.exam_score}` : '—'}</td>
                      <td className="p-2 border-r border-black text-right font-mono font-bold">{row.average !== undefined && row.average !== null ? `${row.average}%` : '—'}</td>
                      <td className="p-2 border-r border-black text-center font-bold">
                        {isPrimary
                          ? (row.units ? `Unit ${row.units}` : getPrimaryUnitLabel(row.grade, row.average))
                          : (row.grade || '—')}
                      </td>
                      <td className="p-2 italic text-neutral-700">{row.remark || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-neutral-500 italic">
                      No academic marks recorded for this student in {(activeStudentReport?.term || selectedTerm)}. Enter marks in the Academic Ledger to populate this report card.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Attendance & Summary */}
            <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded-lg">
              <div>
                <span className="font-bold block">Attendance Record:</span>
                <span>
                  {activeStudentReport.attendance?.total_days
                    ? `${activeStudentReport.attendance.present_days || 0} of ${activeStudentReport.attendance.total_days} days present (${activeStudentReport.attendance.rate || 0}%) • ${activeStudentReport.attendance.absent_days || 0} absent`
                    : 'No attendance records on file for this period'}
                </span>
              </div>
              <div>
                <span className="font-bold block">
                  {isPrimary
                    ? 'Total Units Aggregate:'
                    : levelCategory === 'a_level'
                    ? 'A-Level Points Total:'
                    : 'Quality Passes (A-C):'}
                </span>
                <span className="font-mono text-base font-bold">
                  {isPrimary
                    ? (activeStudentReport.total_units !== undefined && activeStudentReport.total_units !== null
                        ? `${activeStudentReport.total_units} Units (${activeStudentReport.total_units <= 12 ? 'Distinction' : activeStudentReport.total_units <= 24 ? 'Credit' : 'Satisfactory Pass'})`
                        : '—')
                    : levelCategory === 'a_level'
                    ? (activeStudentReport.total_points !== undefined && activeStudentReport.total_points !== null ? `${activeStudentReport.total_points} Points` : '—')
                    : (activeStudentReport.passes_count !== undefined && activeStudentReport.passes_count !== null ? `${activeStudentReport.passes_count} Passes (A-C)` : '—')}
                </span>
              </div>
            </div>

            {/* Conduct & Next Term Schedule Strip */}
            {(activeStudentReport.conduct || activeStudentReport.next_term_date) && (
              <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded-lg bg-neutral-50/50">
                {activeStudentReport.conduct && (
                  <div>
                    <span className="font-bold text-neutral-600 block">General Conduct & Discipline:</span>
                    <span className="font-semibold text-black">{activeStudentReport.conduct}</span>
                  </div>
                )}
                {activeStudentReport.next_term_date && (
                  <div>
                    <span className="font-bold text-neutral-600 block">Next Term Resumption:</span>
                    <span className="font-semibold text-black">{activeStudentReport.next_term_date}</span>
                  </div>
                )}
              </div>
            )}

            {/* Official Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-black text-xs">
              <div className="space-y-4">
                <span className="font-bold block">Class Teacher's Term Remark:</span>
                <p className="italic text-neutral-800 min-h-[36px]">
                  {activeStudentReport.class_teacher_remark || 'Satisfactory academic performance and diligence observed.'}
                </p>
                <div className="pt-6 border-b border-black w-48 text-[11px] text-neutral-600">
                  Signature: {activeStudentReport.form_master_name || 'Form Master'}
                </div>
              </div>

              <div className="space-y-4">
                <span className="font-bold block">Headmaster's Official Endorsement:</span>
                <p className="italic text-neutral-800 min-h-[36px]">
                  {activeStudentReport.head_remark || 'Approved and endorsed for official academic progression.'}
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
