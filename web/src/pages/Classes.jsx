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
  const [classForm, setClassForm] = useState({ name: '', grade_level: 'Form 1', stream: 'North', capacity: 40, form_master_id: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', level: 'all', department: 'General' });
  const [assignForm, setAssignForm] = useState({ class_id: '', subject_id: '', teacher_id: '' });
  const [submitting, setSubmitting] = useState(false);

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
    return classes.reduce((acc, c) => acc + (c.capacity || 40), 0);
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
      setClassForm({ name: '', grade_level: 'Form 1', stream: 'North', capacity: 40, form_master_id: '' });
      invalidate(`classes_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create class.');
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

  const schoolType = (schoolInfo?.school_type || 'primary').toLowerCase();
  const hasAlevel = Boolean(schoolInfo?.has_alevel || schoolType === 'high_school' || schoolType === 'combined' || schoolType === 'a_level');
  const isOrdinaryLevel = (schoolType === 'secondary' || schoolType === 'o_level' || schoolType === 'secondary_o_level') && !hasAlevel;
  const gradeLevels = hasAlevel
    ? ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower 6', 'Upper 6']
    : isOrdinaryLevel
    ? ['Form 1', 'Form 2', 'Form 3', 'Form 4']
    : ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes & Academic Streams"
        subtitle={`Academic directory for ${schoolInfo?.name || 'Harare Academy'}. Manage classes, teacher allocations, and student roll.`}
        backTo="/dashboard"
        backLabel="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportSubjectsModal(true)}
              className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition shadow-xs flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-muted" />
              Import Subjects
            </button>
            <button
              onClick={() => setShowSubjectModal(true)}
              className="px-4 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition shadow-xs flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4 text-brand-500" />
              New Subject
            </button>
            <button
              onClick={() => setShowClassModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Class
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
                  const isSelected = activeClass?.id === cls.id;
                  const capacity = cls.capacity || 40;
                  const count = cls.student_count || 0;
                  const pct = Math.min(100, Math.round((count / capacity) * 100));
                  const formMaster = staff.find(s => s.id === cls.form_master_id || s.user_id === cls.form_master_id);

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
                          <span className="text-xs font-mono font-bold text-ink">{count} / {capacity}</span>
                          <span className="text-[10px] text-muted block">enrolled</span>
                        </div>
                      </div>

                      {/* Capacity progress bar */}
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
                  subtitle={`Form Master: ${staff.find(s => s.id === activeClass.form_master_id)?.name || 'Unassigned'} • Capacity: ${activeClass.student_count || 0}/${activeClass.capacity || 40}`}
                  actions={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setAssignForm(prev => ({ ...prev, class_id: activeClass.id }));
                          setShowAssignModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition"
                      >
                        Assign Subject
                      </button>
                      <button
                        onClick={() => {
                          setDeletingId(activeClass.id);
                          setDeleteType('class');
                        }}
                        className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition"
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
                        {Math.max(0, (activeClass.capacity || 40) - classStudents.length)}
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Enrolled Students ({classStudents.length})</h4>
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
                    <option key={c.id} value={c.id}>{c.name} (Capacity: {c.capacity || 40})</option>
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
              <label className="block text-xs font-bold text-ink mb-1">Stream / Section</label>
              <input
                type="text"
                placeholder="North, South, A, etc."
                value={classForm.stream}
                onChange={e => setClassForm({ ...classForm, stream: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Desk Capacity</label>
              <input
                type="number"
                min="10"
                max="80"
                value={classForm.capacity}
                onChange={e => setClassForm({ ...classForm, capacity: parseInt(e.target.value) || 40 })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
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

      {/* MODAL: Create Subject */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title="Add Curriculum Subject"
        description="Register an academic discipline into the syllabus."
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Subject Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Mathematics or Heritage Studies"
              value={subjectForm.name}
              onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Subject Code</label>
              <input
                type="text"
                placeholder="e.g. 4004 (ZIMSEC)"
                value={subjectForm.code}
                onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Department</label>
              <input
                type="text"
                placeholder="Sciences, Humanities, etc."
                value={subjectForm.department}
                onChange={e => setSubjectForm({ ...subjectForm, department: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
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
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Teacher to Subject & Class"
        description="Allocate an educator to deliver a curriculum subject for a specific stream."
      >
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
