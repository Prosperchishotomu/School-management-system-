import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Drawer, EmptyState, ConfirmDialog, Tabs, ProgressRing
} from '../components/ui';
import {
  Layers, BookOpen, Users, UserCheck, Plus, Trash2, Edit3,
  AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert, Sparkles, Filter, Upload
} from 'lucide-react';
import ImportModal from '../components/ImportModal';
import { STANDARD_SUBJECTS, STANDARD_DEPARTMENTS } from '../data/standardSubjects';

export default function Classes() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('classes'); // 'classes' | 'matrix' | 'subjects' | 'promotion'
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [importSubjectsModal, setImportSubjectsModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  // Forms
  const [classForm, setClassForm] = useState({ name: '', grade_level: 'Form 1', stream: '', capacity: '', form_master_id: '' });
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editClassForm, setEditClassForm] = useState({ id: '', name: '', grade_level: 'Form 1', stream: '', capacity: '', form_master_id: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', level: 'all', department: 'General' });
  const [customSubject, setCustomSubject] = useState(false);
  const [assignForm, setAssignForm] = useState({ class_id: '', subject_id: '', teacher_id: '' });
  const [submitting, setSubmitting] = useState(false);

  // Bulk subject enrollment state
  const [showBulkSubjectModal, setShowBulkSubjectModal] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [enrollingSubjects, setEnrollingSubjects] = useState(false);

  // Promotion state
  const [promoFromClass, setPromoFromClass] = useState('');
  const [promoToClass, setPromoToClass] = useState('');
  const [promoSelectedIds, setPromoSelectedIds] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);

  // Data fetching via unified hooks
  const { data: classesData, loading: loadingClasses } = useApi(
    `classes_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/classes`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: staffData } = useApi(
    `staff_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/staff`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: subjectsData } = useApi(
    `subjects_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/subjects`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: assignmentsData } = useApi(
    `teaching_assignments_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/teaching-assignments`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: schoolInfo } = useApi(
    `school_info_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}`).then(r => r.data || {}),
    { deps: [activeSchoolId] }
  );

  const classes = classesData || [];
  const staff = staffData || [];
  const subjects = subjectsData || [];
  const assignments = assignmentsData || [];

  // Selected class for master-detail
  const activeClass = useMemo(() => {
    if (!selectedClassId && classes.length > 0) return classes[0];
    return classes.find(c => String(c.id) === String(selectedClassId)) || classes[0];
  }, [classes, selectedClassId]);

  // Fetch students for the active class or promotion source
  const { data: classStudentsData, loading: loadingStudents } = useApi(
    `class_students_${activeClass?.id}`,
    () => activeClass ? api.get(`/schools/${activeSchoolId}/students?class_id=${activeClass.id}`).then(r => r.data?.students || r.data || []) : Promise.resolve([]),
    { deps: [activeClass?.id] }
  );

  const { data: promoStudentsData } = useApi(
    `promo_students_${promoFromClass}`,
    () => promoFromClass ? api.get(`/schools/${activeSchoolId}/students?class_id=${promoFromClass}`).then(r => r.data?.students || r.data || []) : Promise.resolve([]),
    { deps: [promoFromClass] }
  );

  const classStudents = Array.isArray(classStudentsData) ? classStudentsData : [];
  const promoStudents = Array.isArray(promoStudentsData) ? promoStudentsData : [];

  // Clash detection in teaching assignments
  const clashWarnings = useMemo(() => {
    const warnings = [];
    // Identify teachers assigned to excessive subjects or duplicate combinations
    const map = new Map();
    assignments.forEach(a => {
      const key = `${a.class_id}_${a.subject_id}`;
      if (map.has(key)) {
        const cls = classes.find(c => String(c.id) === String(a.class_id));
        const sub = subjects.find(s => String(s.id) === String(a.subject_id));
        warnings.push({
          type: 'duplicate',
          message: `Multiple teachers assigned to ${sub?.name || 'Subject'} in ${cls?.name || 'Class'}`
        });
      }
      map.set(key, true);
    });
    return warnings;
  }, [assignments, classes, subjects]);

  // Total enrolled across all classes
  const totalStudents = useMemo(() => {
    return classes.reduce((acc, c) => acc + (c.student_count || c.total_students || 0), 0);
  }, [classes]);

  const totalCapacity = useMemo(() => {
    return classes.reduce((acc, c) => acc + (c.capacity ? parseInt(c.capacity) : 0), 0);
  }, [classes]);

  const avgUtilization = totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0;

  // Handlers
  const handleCreateClass = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/classes`, classForm);
      toast.success(`Class ${classForm.name} created successfully.`);
      setShowClassModal(false);
      setClassForm({ name: '', grade_level: 'Form 1', stream: '', capacity: '', form_master_id: '' });
      invalidate(`classes_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create class.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/schools/${activeSchoolId}/classes/${editClassForm.id}`, editClassForm);
      toast.success(`Class ${editClassForm.name} limit and details updated.`);
      setShowEditClassModal(false);
      invalidate([`classes_${activeSchoolId}`, `class_students_${editClassForm.id}`]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update class limit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/subjects`, subjectForm);
      toast.success(`Subject ${subjectForm.name} created.`);
      setShowSubjectModal(false);
      setSubjectForm({ name: '', code: '', level: 'all', department: 'General' });
      invalidate(`subjects_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/teaching-assignments`, assignForm);
      toast.success('Teaching assignment recorded.');
      setShowAssignModal(false);
      invalidate(`teaching_assignments_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign teacher.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId || !deleteType) return;
    try {
      if (deleteType === 'class') {
        await api.delete(`/schools/${activeSchoolId}/classes/${deletingId}`);
        toast.success('Class removed.');
        invalidate(`classes_${activeSchoolId}`);
      } else if (deleteType === 'subject') {
        await api.delete(`/schools/${activeSchoolId}/subjects/${deletingId}`);
        toast.success('Subject removed.');
        invalidate(`subjects_${activeSchoolId}`);
      } else if (deleteType === 'assignment') {
        await api.delete(`/schools/${activeSchoolId}/teaching-assignments/${deletingId}`);
        toast.success('Assignment unlinked.');
        invalidate(`teaching_assignments_${activeSchoolId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete operation failed.');
    } finally {
      setDeletingId(null);
      setDeleteType(null);
    }
  };

  const handleBulkPromote = async () => {
    if (!promoFromClass || !promoToClass) {
      toast.error('Select both origin and target classes.');
      return;
    }
    if (promoSelectedIds.length === 0) {
      toast.error('Select at least one student to promote.');
      return;
    }
    setPromoLoading(true);
    try {
      await api.post(`/schools/${activeSchoolId}/classes/bulk-promote`, {
        from_class_id: promoFromClass,
        to_class_id: promoToClass,
        student_ids: promoSelectedIds
      });
      toast.success(`Successfully promoted ${promoSelectedIds.length} students.`);
      setPromoSelectedIds([]);
      invalidate(`classes_${activeSchoolId}`);
      invalidate(`promo_students_${promoFromClass}`);
      invalidate(`class_students_${promoToClass}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk promotion failed.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleBulkEnrollSubjects = async () => {
    if (!activeClass || selectedSubjectIds.length === 0 || classStudents.length === 0) {
      toast.error('Please select at least one subject and ensure the class has students.');
      return;
    }
    setEnrollingSubjects(true);
    try {
      await api.post(`/schools/${activeSchoolId}/classes/${activeClass.id}/bulk-assign-subjects`, {
        student_ids: classStudents.map(s => s.id),
        subject_ids: selectedSubjectIds
      });
      toast.success(`Successfully enrolled ${classStudents.length} students into ${selectedSubjectIds.length} subjects!`);
      setShowBulkSubjectModal(false);
      setSelectedSubjectIds([]);
      invalidate([`class_students_${activeClass.id}`, `classes_${activeSchoolId}`]);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to bulk assign subjects.');
    } finally {
      setEnrollingSubjects(false);
    }
  };

  const schoolType = (schoolInfo?.school_type || 'secondary').toLowerCase();
  const hasAlevel = Boolean(schoolInfo?.has_alevel || schoolType === 'high_school' || schoolType === 'combined' || schoolType === 'a_level');
  const hasStreams = schoolInfo?.has_streams !== 0 && schoolInfo?.has_streams !== false;
  const isOrdinaryLevel = (schoolType === 'secondary' || schoolType === 'o_level' || schoolType === 'secondary_o_level') && !hasAlevel;
  const gradeLevels = (schoolType === 'combined' || schoolType === 'mixed')
    ? ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', ...(hasAlevel ? ['Lower 6', 'Upper 6'] : [])]
    : schoolType === 'primary'
    ? ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7']
    : hasAlevel
    ? ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower 6', 'Upper 6']
    : ['Form 1', 'Form 2', 'Form 3', 'Form 4'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes & Academic Streams"
        subtitle={`Academic directory for ${schoolInfo?.name || 'your institution'}. Manage classes, teacher allocations, and student roll.`}
        backTo="/dashboard"
        backLabel="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportSubjectsModal(true)}
              className="btn btn-secondary btn-md shadow-xs"
            >
              <Upload className="w-4 h-4 text-muted" />
              <span>Import Subjects</span>
            </button>
            <button
              onClick={() => setShowSubjectModal(true)}
              className="btn btn-secondary btn-md shadow-xs"
            >
              <BookOpen className="w-4 h-4 text-brand-500" />
              <span>New Subject</span>
            </button>
            <button
              onClick={() => setShowClassModal(true)}
              className="btn btn-primary btn-md shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Class</span>
            </button>
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Classes"
          value={classes.length}
          icon={Layers}
          color="brand"
          subtext={`${classes.filter(c => (c.student_count || 0) > 0).length} active streams`}
        />
        <StatCard
          label="Total Students"
          value={totalStudents}
          icon={Users}
          color="info"
          subtext={`Across ${classes.length} classroom streams`}
        />
        <StatCard
          label="Capacity Utilization"
          value={`${avgUtilization}%`}
          icon={UserCheck}
          color={avgUtilization > 95 ? 'danger' : 'accent'}
          subtext={`${totalStudents} / ${totalCapacity} available seats`}
        />
        <StatCard
          label="Subjects Offered"
          value={subjects.length}
          icon={BookOpen}
          color="violet"
          subtext={`${assignments.length} teacher-class allocations`}
        />
      </KpiStrip>

      {/* Clash alerts if any */}
      {clashWarnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-3 text-xs">
            <ShieldAlert className="w-5 h-5 text-accent shrink-0" />
            <div>
              <span className="font-bold">Schedule Clash Detected:</span> {clashWarnings[0].message}
            </div>
          </div>
          <button
            onClick={() => setActiveTab('matrix')}
            className="text-xs font-semibold underline underline-offset-4 hover:opacity-80"
          >
            Review Matrix
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'classes', label: 'Class Master-Detail', count: classes.length },
          { id: 'matrix', label: 'Teaching Matrix & Allocations', count: assignments.length },
          { id: 'subjects', label: 'Subjects Directory', count: subjects.length },
          { id: 'promotion', label: 'Bulk Promotion Desk' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Master-Detail Classes */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Class List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Streams ({classes.length})</span>
              <span className="text-xs text-muted">Click to view roster & allocations</span>
            </div>

            {classes.length === 0 ? (
              <EmptyState
                title="No Classes Configured"
                description="Add your first classroom stream or grade level to populate the roll."
                actionLabel="Create Class"
                onAction={() => setShowClassModal(true)}
              />
            ) : (
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
                {classes.map(cls => {
                  const capacity = cls.capacity ? parseInt(cls.capacity) : null;
                  const count = cls.student_count || 0;
                  const pct = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : null;
                  const formMaster = staff.find(s => s.id === cls.form_master_id || s.user_id === cls.form_master_id);
                  const isSelected = selectedClassId === cls.id;

                  return (
                    <div
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-surface border-brand-500 shadow-sm ring-1 ring-brand-500/30'
                          : 'bg-surface border-line hover:border-line hover:bg-canvas'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-ink">{cls.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-canvas border border-line text-muted font-medium">
                              {cls.grade_level || 'Grade'}
                            </span>
                            {cls.stream && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-100">
                                {cls.stream}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted mt-1 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-brand-500" />
                            <span>Form Master: {formMaster?.name || 'Unassigned'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-ink">
                            {count} {capacity ? `/ ${capacity}` : 'learners'}
                          </span>
                          <span className="text-[10px] text-muted block">
                            {capacity ? `${pct}% capacity` : 'enrolled'}
                          </span>
                        </div>
                      </div>

                      {/* Capacity progress bar if configured */}
                      {capacity ? (
                        <div className="mt-3">
                          <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden border border-line/50">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 95 ? 'bg-danger' : pct >= 80 ? 'bg-accent' : 'bg-brand-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Selected Class Detail Roster */}
          <div className="lg:col-span-7 space-y-6">
            {activeClass ? (
              <>
                <Card
                  title={`${activeClass.name} — Class Detail`}
                  subtitle={`Form Master: ${staff.find(s => s.id === activeClass.form_master_id)?.name || 'Unassigned'} • Capacity: ${activeClass.student_count || 0}${activeClass.capacity ? ` / ${activeClass.capacity} Desks` : ' (Open Capacity)'}`}
                  actions={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditClassForm({
                            id: activeClass.id,
                            name: activeClass.name || '',
                            grade_level: activeClass.grade_level || activeClass.level || 'Form 1',
                            stream: activeClass.stream || '',
                            capacity: activeClass.capacity !== null && activeClass.capacity !== undefined ? activeClass.capacity : '',
                            form_master_id: activeClass.form_master_id || ''
                          });
                          setShowEditClassModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="Edit Class Limit & Settings"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400" />
                        <span>Edit Class Limit</span>
                      </button>
                      <button
                        onClick={() => {
                          setAssignForm(prev => ({ ...prev, class_id: activeClass.id }));
                          setShowAssignModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition cursor-pointer"
                      >
                        Assign Subject
                      </button>
                      <button
                        onClick={() => {
                          setDeletingId(activeClass.id);
                          setDeleteType('class');
                        }}
                        className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition cursor-pointer"
                        title="Delete Class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  }
                >
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-canvas border border-line">
                      <div className="text-[11px] text-muted font-medium">Class Roll</div>
                      <div className="text-lg font-bold font-mono text-ink mt-0.5">{classStudents.length}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-canvas border border-line">
                      <div className="text-[11px] text-muted font-medium">Free Desks</div>
                      <div className="text-lg font-bold font-mono text-brand-500 mt-0.5">
                        {activeClass.capacity ? Math.max(0, activeClass.capacity - classStudents.length) : 'Open'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-canvas border border-line">
                      <div className="text-[11px] text-muted font-medium">Assigned Subjects</div>
                      <div className="text-lg font-bold font-mono text-ink mt-0.5">
                        {assignments.filter(a => String(a.class_id) === String(activeClass.id)).length}
                      </div>
                    </div>
                  </div>

                  {/* Assigned Subjects in this class */}
                  <div className="mb-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Teaching Allocations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {assignments
                        .filter(a => String(a.class_id) === String(activeClass.id))
                        .map(a => {
                          const sub = subjects.find(s => String(s.id) === String(a.subject_id));
                          const tch = staff.find(s => String(s.id) === String(a.teacher_id) || String(s.user_id) === String(a.teacher_id));
                          return (
                            <div key={a.id} className="p-2.5 rounded-lg bg-canvas border border-line flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-ink">{sub?.name || 'Subject'}</span>
                                <span className="text-muted block text-[11px]">{tch?.name || 'No Teacher'}</span>
                              </div>
                              <button
                                onClick={() => {
                                  setDeletingId(a.id);
                                  setDeleteType('assignment');
                                }}
                                className="text-muted hover:text-danger p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Student Roll Table */}
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                      Enrolled Students ({classStudents.length})
                    </h4>
                    {classStudents.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedSubjectIds([]);
                          setShowBulkSubjectModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/25 transition cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Enroll Class to Subjects</span>
                      </button>
                    )}
                  </div>
                  <DataTable
                    columns={[
                      {
                        key: 'name',
                        label: 'Student',
                        render: (_, row) => (
                          <div className="flex items-center gap-2">
                            <Avatar name={`${row.first_name} ${row.last_name}`} size="sm" />
                            <div>
                              <div className="font-semibold text-ink">{row.first_name} {row.last_name}</div>
                              <div className="text-[10px] font-mono text-muted">{row.admission_number || 'ADM-N/A'}</div>
                            </div>
                          </div>
                        )
                      },
                      { key: 'gender', label: 'Gender', render: v => <span className="capitalize">{v || 'N/A'}</span> },
                      {
                        key: 'status',
                        label: 'Status',
                        render: v => <StatusPill status={v || 'active'} />
                      }
                    ]}
                    data={classStudents}
                    loading={loadingStudents}
                    emptyTitle="No Students Enrolled"
                    emptyMessage="Use the Students directory or Enrolment Wizard to place learners into this class."
                    compact
                  />
                </Card>
              </>
            ) : (
              <EmptyState
                title="Select a Class"
                description="Choose a stream from the left directory to view full details."
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Teaching Matrix & Allocations */}
      {activeTab === 'matrix' && (
        <Card
          title="Teaching Assignment Matrix"
          subtitle="Cross-mapping of curriculum subjects, assigned teachers, and classes."
          actions={
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-3.5 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Link Teacher to Class
            </button>
          }
        >
          <DataTable
            columns={[
              {
                key: 'class_id',
                label: 'Class Stream',
                sortable: true,
                render: v => {
                  const c = classes.find(cl => String(cl.id) === String(v));
                  return <span className="font-bold text-ink">{c?.name || `Class #${v}`}</span>;
                }
              },
              {
                key: 'subject_id',
                label: 'Curriculum Subject',
                sortable: true,
                render: v => {
                  const s = subjects.find(sub => String(sub.id) === String(v));
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink">{s?.name || 'Subject'}</span>
                      {s?.code && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-canvas border border-line">{s.code}</span>}
                    </div>
                  );
                }
              },
              {
                key: 'teacher_id',
                label: 'Assigned Teacher',
                sortable: true,
                render: v => {
                  const t = staff.find(st => String(st.id) === String(v) || String(st.user_id) === String(v));
                  return (
                    <div className="flex items-center gap-2">
                      <Avatar name={t?.name || 'Teacher'} size="sm" />
                      <div>
                        <div className="font-medium text-ink">{t?.name || 'Staff Member'}</div>
                        <div className="text-[10px] text-muted">{t?.role_title || 'Teacher'}</div>
                      </div>
                    </div>
                  );
                }
              },
              {
                key: 'actions',
                label: '',
                render: (_, row) => (
                  <button
                    onClick={() => {
                      setDeletingId(row.id);
                      setDeleteType('assignment');
                    }}
                    className="p-1.5 text-muted hover:text-danger rounded-lg transition"
                    title="Unlink Assignment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )
              }
            ]}
            data={assignments}
            emptyTitle="No Teaching Assignments Found"
            emptyMessage="Link educators to classes and subjects to generate the active academic master timetable."
          />
        </Card>
      )}

      {/* TAB 3: Subjects Directory */}
      {activeTab === 'subjects' && (
        <Card
          title="Subjects Directory"
          subtitle="Accredited subjects for ZIMSEC / Cambridge examinations and national curriculum."
          actions={
            <button
              onClick={() => setShowSubjectModal(true)}
              className="px-3.5 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add Subject
            </button>
          }
        >
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Subject Name',
                sortable: true,
                render: (v, row) => (
                  <div>
                    <div className="font-bold text-ink">{v}</div>
                    <div className="text-[11px] text-muted">{row.department || 'General Department'}</div>
                  </div>
                )
              },
              {
                key: 'code',
                label: 'ZIMSEC Code',
                render: v => <span className="font-mono text-xs text-ink font-semibold">{v || 'N/A'}</span>
              },
              {
                key: 'level',
                label: 'Target Level',
                render: v => <span className="capitalize text-xs text-muted">{v || 'All levels'}</span>
              },
              {
                key: 'actions',
                label: '',
                render: (_, row) => (
                  <button
                    onClick={() => {
                      setDeletingId(row.id);
                      setDeleteType('subject');
                    }}
                    className="p-1.5 text-muted hover:text-danger rounded-lg transition"
                    title="Delete Subject"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )
              }
            ]}
            data={subjects}
            emptyTitle="No Subjects Registered"
            emptyMessage="Configure subjects to enable mark entry, timetables, and official report cards."
          />
        </Card>
      )}

      {/* TAB 4: Bulk Promotion Desk */}
      {activeTab === 'promotion' && (
        <Card
          title="End of Term / Year Bulk Promotion Desk"
          subtitle="Transition students across form levels, grade streams, or graduation cohorts."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-canvas border border-line mb-6">
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">Source Class (Current Roll)</label>
              <select
                value={promoFromClass}
                onChange={e => {
                  setPromoFromClass(e.target.value);
                  setPromoSelectedIds([]);
                }}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select origin class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.student_count || 0} students)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">Destination Class (Promoted Roll)</label>
              <select
                value={promoToClass}
                onChange={e => setPromoToClass(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select destination class...</option>
                {classes
                  .filter(c => String(c.id) !== String(promoFromClass))
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.capacity ? `(Capacity: ${c.capacity})` : ''}</option>
                  ))}
              </select>
            </div>
          </div>

          {promoFromClass && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (promoSelectedIds.length === promoStudents.length) {
                        setPromoSelectedIds([]);
                      } else {
                        setPromoSelectedIds(promoStudents.map(s => s.id));
                      }
                    }}
                    className="text-xs font-semibold text-brand-700 hover:underline"
                  >
                    {promoSelectedIds.length === promoStudents.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs text-muted">({promoSelectedIds.length} of {promoStudents.length} selected)</span>
                </div>

                <button
                  disabled={promoSelectedIds.length === 0 || !promoToClass || promoLoading}
                  onClick={handleBulkPromote}
                  className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition disabled:opacity-50 flex items-center gap-2 shadow-xs"
                >
                  <ArrowRight className="w-4 h-4" />
                  {promoLoading ? 'Promoting...' : `Promote Selected (${promoSelectedIds.length})`}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {promoStudents.map(st => {
                  const checked = promoSelectedIds.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition ${
                        checked ? 'bg-surface border-brand-500 shadow-xs' : 'bg-surface border-line hover:bg-canvas'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setPromoSelectedIds(prev =>
                            prev.includes(st.id) ? prev.filter(id => id !== st.id) : [...prev, st.id]
                          );
                        }}
                        className="rounded text-brand-700 focus:ring-brand-500"
                      />
                      <Avatar name={`${st.first_name} ${st.last_name}`} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-ink truncate">{st.first_name} {st.last_name}</div>
                        <div className="text-[10px] font-mono text-muted">{st.admission_number || 'ADM-N/A'}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* MODAL: Create Class */}
      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title="Create New Classroom Stream"
        description="Establish a new student cohort and assign its designated Form Master."
      >
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Class Display Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Form 1 North or Grade 4 Blue"
              value={classForm.name}
              onChange={e => setClassForm({ ...classForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Grade Level</label>
              <select
                value={classForm.grade_level}
                onChange={e => setClassForm({ ...classForm, grade_level: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                {gradeLevels.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Stream / Section <span className="text-[10px] text-muted font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. East, Blue, or leave blank"
                value={classForm.stream}
                onChange={e => setClassForm({ ...classForm, stream: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Desk Capacity <span className="text-[10px] text-muted font-normal">(Configurable Limit)</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 35, 45, 60..."
                value={classForm.capacity}
                onChange={e => setClassForm({ ...classForm, capacity: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Form Master</label>
              <select
                value={classForm.form_master_id}
                onChange={e => setClassForm({ ...classForm, form_master_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Unassigned</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role_title || 'Teacher'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowClassModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Save Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Class Limit & Details */}
      <Modal
        isOpen={showEditClassModal}
        onClose={() => setShowEditClassModal(false)}
        title={`Edit Class Limit: ${editClassForm.name}`}
        description="Change class desk capacity (maximum enrollment limit), stream label, and assigned Form Master."
      >
        <form onSubmit={handleUpdateClass} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Class Display Name *</label>
            <input
              type="text"
              required
              value={editClassForm.name}
              onChange={e => setEditClassForm({ ...editClassForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Class Limit / Max Enrollment <span className="text-[10px] text-muted font-normal">(Configurable)</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 35, 45, 60..."
                value={editClassForm.capacity}
                onChange={e => setEditClassForm({ ...editClassForm, capacity: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono font-bold"
              />
              <span className="text-[10px] text-muted mt-1 block">Maximum student intake allowed for this class</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Stream / Section <span className="text-[10px] text-muted font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Leave blank if school has no streams"
                value={editClassForm.stream}
                onChange={e => setEditClassForm({ ...editClassForm, stream: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Form Master / Class Teacher</label>
            <select
              value={editClassForm.form_master_id}
              onChange={e => setEditClassForm({ ...editClassForm, form_master_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
            >
              <option value="">Unassigned</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role_title || 'Teacher'})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowEditClassModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Update Class Limit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Create Subject */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title="Add Curriculum Subject"
        description="Register an academic discipline into the syllabus."
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-ink">Curriculum Subject *</label>
              <button
                type="button"
                onClick={() => setCustomSubject(prev => !prev)}
                className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                {customSubject ? '← Choose standard subject' : '+ Type custom subject'}
              </button>
            </div>
            {customSubject ? (
              <input
                type="text"
                required
                placeholder="Enter subject title (e.g. Robotics, Mandarin, Development Studies)"
                value={subjectForm.name}
                onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-semibold"
              />
            ) : (
              <select
                value={subjectForm.name}
                onChange={e => {
                  const selected = STANDARD_SUBJECTS.find(s => s.name === e.target.value);
                  if (selected) {
                    setSubjectForm({
                      ...subjectForm,
                      name: selected.name,
                      department: selected.department,
                      level: selected.level
                    });
                  } else {
                    setSubjectForm({ ...subjectForm, name: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-semibold"
              >
                <option value="">-- Choose Standard Subject --</option>
                {STANDARD_SUBJECTS.map(s => (
                  <option key={s.name} value={s.name}>
                    {s.name} — {s.department}
                  </option>
                ))}
              </select>
            )}
            <span className="text-[10px] text-muted mt-1 block">
              Choose an accredited curriculum subject or type a custom discipline for your institution.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Subject / Syllabus Code <span className="text-[10px] text-muted font-normal">(Configurable)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 4004, 0580, MATH-1, or leave blank"
                value={subjectForm.code}
                onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Department</label>
              <select
                value={subjectForm.department}
                onChange={e => setSubjectForm({ ...subjectForm, department: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
              >
                {STANDARD_DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowSubjectModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Register Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Teaching Assignment */}
      <Modal/>
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Teacher to Subject & Class"
        description="Allocate an educator to deliver a curriculum subject for a specific stream."
      
        <form onSubmit={handleAssignTeacher} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Target Class *</label>
            <select
              required
              value={assignForm.class_id}
              onChange={e => setAssignForm({ ...assignForm, class_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select Class...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Curriculum Subject *</label>
            <select
              required
              value={assignForm.subject_id}
              onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select Subject...</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Assigned Teacher *</label>
            <select
              required
              value={assignForm.teacher_id}
              onChange={e => setAssignForm({ ...assignForm, teacher_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select Teacher...</option>
              {staff.map(st => (
                <option key={st.id} value={st.id}>{st.name} ({st.role_title || 'Teacher'})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowAssignModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Linking...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      {/* MODAL: Bulk Enroll Class to Subjects */}
      <Modal
        isOpen={showBulkSubjectModal}
        onClose={() => setShowBulkSubjectModal(false)}
        title={`Enroll ${activeClass?.name || 'Class'} to Subjects`}
        description={`Select curriculum subjects to assign to all ${classStudents.length} enrolled learners.`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-brand-50/60 dark:bg-brand-950/30 border border-brand-500/20 rounded-xl text-xs flex items-center justify-between">
            <span className="text-muted">
              Target Cohort: <strong className="text-ink">{activeClass?.name}</strong> ({classStudents.length} students)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedSubjectIds.length === subjects.length) {
                    setSelectedSubjectIds([]);
                  } else {
                    setSelectedSubjectIds(subjects.map(s => s.id));
                  }
                }}
                className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline cursor-pointer"
              >
                {selectedSubjectIds.length === subjects.length ? 'Deselect All' : 'Select All Subjects'}
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {subjects.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted">
                No subjects registered in this school yet. Add subjects in the Curriculum tab first.
              </div>
            ) : (
              subjects.map(sub => {
                const isChecked = selectedSubjectIds.includes(sub.id);
                return (
                  <label
                    key={sub.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      isChecked
                        ? 'bg-brand-500/10 border-brand-500 text-ink font-semibold'
                        : 'bg-surface border-line text-muted hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedSubjectIds(prev =>
                            prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                          );
                        }}
                        className="rounded border-line text-brand-700 focus:ring-brand-500"
                      />
                      <div>
                        <span className="text-ink font-medium">{sub.name}</span>
                        {sub.code && <span className="text-[10px] text-muted font-mono ml-2">({sub.code})</span>}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-canvas border border-line text-muted">
                      {sub.category || 'General'}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-line">
            <span className="text-xs text-muted">
              {selectedSubjectIds.length} of {subjects.length} subjects selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBulkSubjectModal(false)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedSubjectIds.length === 0 || enrollingSubjects || classStudents.length === 0}
                onClick={handleBulkEnrollSubjects}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {enrollingSubjects ? 'Enrolling...' : `Confirm & Enroll (${selectedSubjectIds.length})`}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => {
          setDeletingId(null);
          setDeleteType(null);
        }}
        onConfirm={handleDelete}
        title="Confirm Removal"
        description="Are you sure you want to remove this academic record? Enrolled relationships or subject allocations will be unlinked."
        confirmText="Remove Record"
        danger
      />

      <ImportModal
        isOpen={importSubjectsModal}
        onClose={() => setImportSubjectsModal(false)}
        schoolId={activeSchoolId}
        entity="subjects"
        title="Import Curriculum Subjects"
        invalidateKeys={[`subjects_${activeSchoolId}`]}
      />
    </div>
  );
}
