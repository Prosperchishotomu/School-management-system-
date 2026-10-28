import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import { api } from '../utils/api';
import { money } from '../utils/format';
import {
  PageHeader,
  KpiStrip,
  StatCard,
  Card,
  FilterChips,
  DataTable,
  StatusPill,
  Avatar,
  Money,
  Drawer,
  Modal,
  Stepper,
  EmptyState,
  Skeleton
} from '../components/ui';
import {
  Users, UserPlus, Upload, Search, Filter, ShieldCheck,
  Building2, GraduationCap, Eye, Edit2, AlertCircle, Phone, Mail,
  CheckCircle2, ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ImportModal from '../components/ImportModal';
import { isSchoolBoarding } from '../utils/modules';

export default function Students() {
  const { user, activeSchoolId, activeSchool } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const schoolId = activeSchoolId || user?.school_id || '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';
  const hasBoarding = isSchoolBoarding(activeSchool);

  // Strict privacy rule: Parents only have access to their linked children via Parent Portal
  useEffect(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'parent' || role === 'guardian') {
      navigate('/parent-portal', { replace: true });
    }
  }, [user, navigate]);

  // URL-driven filter states
  const classFilter = searchParams.get('class') || 'all';
  const statusFilter = searchParams.get('status') || 'all';
  const genderFilter = searchParams.get('gender') || 'all';
  const searchQuery = searchParams.get('search') || '';

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Enrolment Wizard Modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [isCustomClass, setIsCustomClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState('');
  const [formData, setFormData] = useState({
    admission_number: '',
    first_name: '',
    last_name: '',
    gender: 'female',
    date_of_birth: '2010-05-14',
    class_id: '',
    is_boarding: 0,
    previous_school: '',
    medical_notes: '',
    allergies: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_relation: 'Mother'
  });

  // 1. Fetch Students
  const { data: studentsData, loading: studentsLoading, refetch } = useApi(
    schoolId ? `students_list_${schoolId}` : null,
    () => api.get(`/schools/${schoolId}/students?per_page=1000`),
    { enabled: Boolean(schoolId) }
  );

  // 2. Fetch Classes
  const { data: classesData, refetch: refetchClasses } = useApi(
    schoolId ? `classes_${schoolId}` : null,
    () => api.get(`/schools/${schoolId}/classes`),
    { enabled: Boolean(schoolId) }
  );
  const classes = classesData || [];

  // Handle prefill from Admissions Pipeline
  useEffect(() => {
    if (searchParams.get('prefill') === 'true') {
      const fn = searchParams.get('first_name') || '';
      const ln = searchParams.get('last_name') || '';
      const gName = searchParams.get('guardian_name') || searchParams.get('guardian') || '';
      const gPhone = searchParams.get('guardian_phone') || searchParams.get('phone') || '';
      const gEmail = searchParams.get('guardian_email') || searchParams.get('email') || '';
      const grade = searchParams.get('grade') || '';
      
      const matchedClass = classes.find(c => 
        (c.name || '').toLowerCase().includes(grade.toLowerCase())
      );

      setFormData(prev => ({
        ...prev,
        first_name: fn || prev.first_name,
        last_name: ln || prev.last_name,
        guardian_name: gName || prev.guardian_name,
        guardian_phone: gPhone || prev.guardian_phone,
        guardian_email: gEmail || prev.guardian_email,
        class_id: matchedClass?.id || prev.class_id,
        admission_number: prev.admission_number || `ADM-${Math.floor(1000 + Math.random() * 9000)}`
      }));
      setWizardOpen(true);
    }
  }, [searchParams, classes]);

  const students = useMemo(() => {
    if (!studentsData) return [];
    return Array.isArray(studentsData) ? studentsData : (studentsData.data || []);
  }, [studentsData]);

  // Filtered dataset
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      if (classFilter !== 'all' && st.class_name !== classFilter && st.class_id !== classFilter) return false;
      if (statusFilter !== 'all') {
        const s = (st.status || '').toLowerCase();
        if (statusFilter === 'active' && !['active', 'enrolled'].includes(s)) return false;
        if (statusFilter === 'transferred' && s !== 'transferred') return false;
        if (statusFilter === 'finished' && !['finished', 'graduated'].includes(s)) return false;
        if (statusFilter === 'dropped' && !['dropped', 'dropped_out', 'withdrawn', 'suspended'].includes(s)) return false;
        if (!['active', 'transferred', 'finished', 'dropped'].includes(statusFilter) && s !== statusFilter) return false;
      }
      if (genderFilter !== 'all' && st.gender !== genderFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullName = `${st.first_name || ''} ${st.last_name || ''}`.toLowerCase();
        const adm = (st.admission_number || '').toLowerCase();
        const guardian = (st.guardian_name || '').toLowerCase();
        if (!fullName.includes(q) && !adm.includes(q) && !guardian.includes(q)) return false;
      }
      return true;
    });
  }, [students, classFilter, statusFilter, genderFilter, searchQuery]);

  // Derived counts for KPI strip: Transferred, Finished, and Dropped students are strictly excluded from the active total
  const lifecycleCounts = useMemo(() => {
    let active = 0, transferred = 0, finished = 0, dropped = 0, total = students.length;
    students.forEach(st => {
      const s = (st.status || '').toLowerCase();
      if (s === 'active' || s === 'enrolled') active++;
      else if (s === 'transferred') transferred++;
      else if (s === 'finished' || s === 'graduated') finished++;
      else if (['dropped', 'dropped_out', 'withdrawn', 'suspended'].includes(s)) dropped++;
    });
    return { active, transferred, finished, dropped, total };
  }, [students]);

  const activeEnrolledCount = studentsData?.meta?.counts?.active ?? lifecycleCounts.active;
  const boardersCount = students.filter(s => s.is_boarding && ['active', 'enrolled'].includes((s.status || '').toLowerCase())).length;
  const femaleCount = students.filter(s => s.gender === 'female' && ['active', 'enrolled'].includes((s.status || '').toLowerCase())).length;
  const maleCount = students.filter(s => s.gender === 'male' && ['active', 'enrolled'].includes((s.status || '').toLowerCase())).length;

  // Mini Chart: Enrolment by Class
  const classChartData = useMemo(() => {
    const counts = {};
    if (Array.isArray(classes) && classes.length > 0) {
      classes.slice(0, 8).forEach(c => {
        if (c.name) counts[c.name] = 0;
      });
    }
    students.forEach(s => {
      const c = s.class_name || 'Unassigned';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [students, classes]);

  // Wizard Steps
  const wizardSteps = [
    { label: 'Personal Information' },
    { label: 'Academic Placement' },
    { label: 'Medical & Welfare' },
    { label: 'Guardian Contacts' },
    { label: 'Review & Confirm' }
  ];

  const handleOpenWizard = () => {
    const hasExistingClasses = Array.isArray(classes) && classes.length > 0;
    setIsCustomClass(!hasExistingClasses);
    setNewClassName('');
    setNewClassLevel('');
    setFormData({
      admission_number: `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '',
      last_name: '',
      middle_name: '',
      gender: 'female',
      date_of_birth: '2010-05-14',
      national_id: '',
      nationality: 'Zimbabwean',
      home_address: '',
      class_id: hasExistingClasses ? (classes[0]?.id || '') : '',
      is_boarding: 0,
      previous_school: '',
      medical_notes: '',
      allergies: '',
      guardian_name: '',
      guardian_phone: '',
      guardian_email: '',
      guardian_relation: 'Mother',
      guardian_national_id: '',
      parent_username: '',
      parent_password: ''
    });
    setWizardStep(0);
    setWizardOpen(true);
  };

  const handleNextStep = () => {
    if (wizardStep === 0) {
      if (!formData.first_name.trim()) {
        toast.warning('Please enter the student\'s first name.');
        return;
      }
      if (!formData.last_name.trim()) {
        toast.warning('Please enter the student\'s last name / surname.');
        return;
      }
    }
    if (wizardStep === 1) {
      const hasClass = (isCustomClass || classes.length === 0)
        ? Boolean(newClassName.trim())
        : Boolean(formData.class_id);
      if (!hasClass) {
        toast.warning('Please select an existing class stream or type a new class name.');
        return;
      }
    }
    if (wizardStep === 3) {
      if (!formData.guardian_name.trim()) {
        toast.warning('Please enter the primary guardian\'s name.');
        return;
      }
      if (!formData.guardian_phone.trim()) {
        toast.warning('Please enter a contact phone number for the guardian.');
        return;
      }
    }
    setWizardStep(s => Math.min(4, s + 1));
  };

  const handleSaveWizard = async () => {
    setWizardSaving(true);
    try {
      let finalClassId = formData.class_id;

      // If user typed a custom class name or no classes existed yet
      if ((isCustomClass || classes.length === 0 || !finalClassId) && newClassName.trim()) {
        const createRes = await api.post(`/schools/${schoolId}/classes`, {
          name: newClassName.trim(),
          grade_level: newClassLevel.trim() || newClassName.trim(),
          level: newClassName.toLowerCase().includes('form') ? 'Secondary' : 'Primary'
        });
        const createdCls = createRes?.data || createRes;
        finalClassId = createdCls.id;
        if (refetchClasses) refetchClasses();
      }

      if (!finalClassId) {
        toast.error('A class assignment is required. Please select or type a class.');
        setWizardStep(1);
        setWizardSaving(false);
        return;
      }

      await api.post(`/schools/${schoolId}/students`, {
        ...formData,
        class_id: finalClassId
      });
      toast.success('Student successfully enrolled.');
      setWizardOpen(false);
      invalidate([`students_list_${schoolId}`, `classes_${schoolId}`, `summary_${schoolId}`, `enrolment_${schoolId}`]);
      refetch();
      if (refetchClasses) refetchClasses();
    } catch (err) {
      toast.error(err?.message || 'Failed to enroll student.');
    } finally {
      setWizardSaving(false);
    }
  };

  const handleRowClick = (student) => {
    setSelectedStudent(student);
    setDrawerOpen(true);
  };

  // DataTable Column Definitions
  const columns = [
    {
      key: 'name',
      label: 'Student',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.first_name} ${row.last_name}`} size="sm" id={row.id} />
          <div>
            <div className="font-semibold text-ink hover:text-brand-700 transition-colors">
              {row.first_name} {row.last_name}
            </div>
            <div className="text-[11px] font-mono text-muted tabular-nums">
              {row.admission_number || 'No ADM'}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'class_name',
      label: 'Class & Residence',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{val || 'Unassigned'}</span>
          {row.is_boarding ? (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-violet-100 text-violet-700">
              Boarder
            </span>
          ) : (
            <span className="text-[10px] text-muted font-medium">Day</span>
          )}
        </div>
      )
    },
    {
      key: 'gender',
      label: 'Gender',
      render: (val) => (
        <span className="capitalize text-xs text-muted">
          {val || 'female'}
        </span>
      )
    },
    {
      key: 'guardian_name',
      label: 'Primary Guardian',
      render: (val, row) => (
        <div>
          <div className="text-xs font-medium text-ink">{val || 'Parent on file'}</div>
          {row.guardian_phone && (
            <div className="text-[11px] text-muted font-mono">{row.guardian_phone}</div>
          )}
        </div>
      )
    },
    {
      key: 'fee_balance',
      label: 'Fee Balance',
      sortable: true,
      align: 'right',
      render: (val, row) => {
        const bal = parseFloat(val || 0);
        const billed = parseFloat(row?.fee_due || row?.total_due || row?.total_billed || 0);
        const isUnbilled = billed === 0 && bal === 0;
        return (
          <div className="flex flex-col items-end">
            <Money amount={bal} />
            <StatusPill
              status={isUnbilled ? 'neutral' : (bal === 0 ? 'paid' : 'partial')}
              label={isUnbilled ? 'Unbilled' : (bal === 0 ? 'Cleared' : 'Due')}
              size="sm"
              className="mt-0.5"
            />
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (val) => <StatusPill status={val || 'enrolled'} />
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/students/${row.id}`);
            }}
            title="Open 360 Profile"
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-canvas transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Students Directory"
        subtitle="Manage enrolled learners, register admissions & track cohort balances"
        actions={
          <>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="btn btn-secondary btn-md shadow-xs"
                >
                  <Upload className="w-4 h-4 text-muted" />
                  <span>Import CSV/Excel</span>
                </button>
                <button
                  onClick={handleOpenWizard}
                  className="btn btn-primary btn-md shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Enrol Student</span>
                </button>
              </div>
            )}
          </>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Active Enrolled"
          value={activeEnrolledCount}
          sublabel="Strict active roll (excludes transferred/dropped)"
          icon={Users}
          iconColor="brand"
        />

        {hasBoarding ? (
          <StatCard
            title="Boarding Population"
            value={boardersCount}
            sublabel="Residing in hostels"
            icon={Building2}
            iconColor="violet"
          />
        ) : (
          <StatCard
            title="Day Scholars"
            value={Math.max(0, activeEnrolledCount - boardersCount)}
            sublabel="Active commuter learners"
            icon={Building2}
            iconColor="emerald"
          />
        )}

        <StatCard
          title="Gender Breakdown"
          value={`${femaleCount}F / ${maleCount}M`}
          sublabel={`${Math.round((femaleCount / (activeEnrolledCount || 1)) * 100)}% Female ratio`}
          icon={GraduationCap}
          iconColor="info"
        />

        <StatCard
          title="Transferred & Alumni"
          value={`${lifecycleCounts.transferred} Tr / ${lifecycleCounts.finished} Al`}
          sublabel="Excluded from active roll"
          icon={ShieldCheck}
          iconColor="accent"
        />

        <StatCard
          title="Fee Status Rate"
          value={
            (() => {
              const billedStudents = students.filter(s => parseFloat(s.fee_due || s.total_billed || s.total_due || 0) > 0);
              if (billedStudents.length === 0) return '0%';
              const clearedCount = billedStudents.filter(s => parseFloat(s.fee_balance || 0) === 0).length;
              return `${Math.round((clearedCount / billedStudents.length) * 100)}%`;
            })()
          }
          sublabel={
            (() => {
              const billedStudents = students.filter(s => parseFloat(s.fee_due || s.total_billed || s.total_due || 0) > 0);
              return billedStudents.length === 0 ? '0 billed accounts' : 'Billed term dues cleared';
            })()
          }
          icon={ShieldCheck}
          iconColor="accent"
          to="/fees"
        />
      </KpiStrip>

      {/* Mini Cohort Distribution Chart & Filter Bar */}
      <Card
        title="Student Cohort Distribution"
        subtitle="Enrolment density by class stream (Click stream bar to filter)"
      >
        <div className="h-36 w-full mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={classChartData}
              margin={{ top: 12, right: 16, left: -20, bottom: 4 }}
              barCategoryGap={classChartData.length <= 2 ? '40%' : '20%'}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted)" tickLine={false} />
              <YAxis allowDecimals={false} fontSize={11} stroke="var(--muted)" tickLine={false} />
              <Tooltip
                formatter={(val) => [`${val} Enrolled`, 'Students']}
                contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)', borderRadius: '0.75rem', fontSize: '12px' }}
              />
              <Bar
                dataKey="count"
                fill="var(--brand-700)"
                radius={[5, 5, 0, 0]}
                barSize={32}
                maxBarSize={40}
                onClick={(entry) => setSearchParams({ class: entry.name })}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Filter Toolbar */}
        <div className="pt-3 border-t border-line space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted">Lifecycle:</span>
            <FilterChips
              value={statusFilter}
              onChange={(val) => {
                const next = new URLSearchParams(searchParams);
                if (val === 'all') next.delete('status');
                else next.set('status', val);
                setSearchParams(next);
              }}
              options={[
                { value: 'all', label: `All Records (${lifecycleCounts.total})` },
                { value: 'active', label: `Active Enrolled (${lifecycleCounts.active})` },
                { value: 'transferred', label: `Transferred (${lifecycleCounts.transferred})` },
                { value: 'finished', label: `Finished / Alumni (${lifecycleCounts.finished})` },
                { value: 'dropped', label: `Dropped (${lifecycleCounts.dropped})` }
              ]}
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted">Streams:</span>
              <FilterChips
                value={classFilter}
                onChange={(val) => {
                  const next = new URLSearchParams(searchParams);
                  if (val === 'all') next.delete('class');
                  else next.set('class', val);
                  setSearchParams(next);
                }}
                options={[
                  { value: 'all', label: 'All Streams' },
                  ...Array.from(new Set(classes.map(c => c.name).filter(Boolean))).map(name => ({ value: name, label: name }))
                ]}
              />
            </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (!e.target.value) next.delete('search');
                else next.set('search', e.target.value);
                setSearchParams(next);
              }}
              placeholder="Filter by name, admission no…"
              className="glass-input pl-9 w-full text-xs"
            />
          </div>
        </div>
        </div>
      </Card>

      {/* Main Students DataTable */}
      <DataTable
        columns={columns}
        data={filteredStudents}
        loading={studentsLoading}
        onRowClick={handleRowClick}
        emptyTitle="No students found"
        emptyDescription="No learners match the current filter criteria."
        csvExportName="students_directory"
      />

      {/* Quick Record Inspection Modal (Centered, properly sized without vertical void) */}
      <Modal
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'Student Quick File'}
        subtitle={selectedStudent?.admission_number ? `Admission #${selectedStudent.admission_number}` : ''}
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                if (selectedStudent) {
                  navigate(`/students/${selectedStudent.id}`);
                }
              }}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-xs"
            >
              <span>Open 360 Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        {selectedStudent && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-canvas border border-line">
              <Avatar name={`${selectedStudent.first_name} ${selectedStudent.last_name}`} size="lg" />
              <div>
                <h4 className="text-base font-bold font-display text-ink">
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </h4>
                <div className="text-muted font-mono">{selectedStudent.admission_number}</div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusPill status={selectedStudent.status || 'enrolled'} />
                  {Number(selectedStudent.is_boarding) === 1 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      Boarder
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-canvas/50 border border-line">
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted block">Class Stream:</span>
                <span className="font-semibold text-ink">{selectedStudent.class_name || 'Unassigned'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted block">Gender:</span>
                <span className="font-semibold text-ink capitalize">{selectedStudent.gender || '—'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted block">Date of Birth:</span>
                <span className="font-semibold text-ink font-mono">{selectedStudent.date_of_birth || '—'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted block">Fee Balance:</span>
                <span className={`font-semibold font-mono ${Number(selectedStudent.fee_balance || 0) > 0 ? 'text-danger' : 'text-emerald-600'}`}>
                  {money(selectedStudent.fee_balance || 0)}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted block">Primary Guardian:</span>
                <span className="font-semibold text-ink">{selectedStudent.guardian_name || 'None listed'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted block">Guardian Phone:</span>
                <span className="font-semibold text-ink font-mono">{selectedStudent.guardian_phone || 'None'}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 5-Step Enrolment Stepper Wizard Modal */}
      <Modal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        maxWidth="max-w-xl"
        title="Enrolment Wizard"
        subtitle={`Step ${wizardStep + 1} of 5: ${wizardSteps[wizardStep].label}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              disabled={wizardStep === 0}
              onClick={() => setWizardStep(s => Math.max(0, s - 1))}
              className="btn btn-secondary btn-md disabled:opacity-30"
            >
              Previous
            </button>

            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="btn btn-primary btn-md shadow-sm"
              >
                <span>Next Step</span>
                <span>→</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={wizardSaving}
                onClick={handleSaveWizard}
                className="btn btn-primary btn-md shadow-md"
              >
                {wizardSaving ? 'Enrolling…' : 'Complete Enrolment'}
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-6">
          <Stepper steps={wizardSteps} currentStep={wizardStep} />

          {/* Step 1: Personal Information */}
          {wizardStep === 0 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink block mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="e.g. Farai"
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Last Name / Surname *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="e.g. Moyo"
                    className="glass-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink block mb-1">Middle Name(s)</label>
                  <input
                    type="text"
                    value={formData.middle_name || ''}
                    onChange={e => setFormData({ ...formData, middle_name: e.target.value })}
                    placeholder="e.g. Tadiwanashe"
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="glass-input w-full"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Birth Cert / National ID</label>
                  <input
                    type="text"
                    value={formData.national_id || ''}
                    onChange={e => setFormData({ ...formData, national_id: e.target.value })}
                    placeholder="e.g. 63-2940192A45"
                    className="glass-input w-full font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink block mb-1">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality || 'Zimbabwean'}
                    onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="e.g. Zimbabwean"
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">System Admission Number</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.admission_number}
                    className="glass-input w-full bg-canvas font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Residential Physical Address</label>
                <input
                  type="text"
                  value={formData.home_address || ''}
                  onChange={e => setFormData({ ...formData, home_address: e.target.value })}
                  placeholder="e.g. 14 Natal Road, Avondale, Harare"
                  className="glass-input w-full"
                />
              </div>
            </div>
          )}

          {/* Step 2: Placement */}
          {wizardStep === 1 && (
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-ink block">Class Stream Assignment *</label>
                  {classes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isCustomClass;
                        setIsCustomClass(next);
                        if (next) setFormData(prev => ({ ...prev, class_id: '' }));
                        else setFormData(prev => ({ ...prev, class_id: classes[0]?.id || '' }));
                      }}
                      className="text-[11px] text-teal-primary hover:text-teal-dark font-semibold cursor-pointer underline flex items-center gap-1"
                    >
                      {isCustomClass ? "← Choose existing class" : "+ Type / Create New Class"}
                    </button>
                  )}
                </div>

                {isCustomClass || classes.length === 0 ? (
                  <div className="p-3.5 bg-brand-50/50 rounded-xl border border-brand-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-brand-900">
                        {classes.length === 0 ? "No classes registered yet for this school" : "Create New Class Stream"}
                      </span>
                      <span className="text-[10px] bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full font-medium">Auto-Created</span>
                    </div>
                    <p className="text-[11px] text-muted">
                      Type the class name below. It will be immediately registered in the school curriculum and assigned to this learner.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink/75 mb-1">Class Name *</label>
                        <input
                          type="text"
                          required
                          value={newClassName}
                          onChange={e => setNewClassName(e.target.value)}
                          placeholder="e.g. Grade 1 or Form 1 Blue"
                          className="glass-input w-full font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-ink/75 mb-1">Grade / Form Level</label>
                        <input
                          type="text"
                          value={newClassLevel}
                          onChange={e => setNewClassLevel(e.target.value)}
                          placeholder="e.g. Grade 1 or Form 1"
                          className="glass-input w-full"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <select
                      value={formData.class_id}
                      onChange={e => setFormData({ ...formData, class_id: e.target.value })}
                      className="glass-input w-full text-xs font-semibold"
                    >
                      <option value="">-- Choose Assigned Class Stream --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.grade_level ? `(${c.grade_level})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {hasBoarding ? (
                <div>
                  <label className="font-semibold text-ink block mb-1">Boarding & Residence Type</label>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${Number(formData.is_boarding) === 0 ? 'bg-brand-50 border-brand-500 text-brand-900 font-semibold' : 'bg-surface border-line text-muted'}`}>
                      <input
                        type="radio"
                        name="is_boarding"
                        checked={Number(formData.is_boarding) === 0}
                        onChange={() => setFormData({ ...formData, is_boarding: 0 })}
                      />
                      <div>
                        <div className="text-xs">Day Scholar</div>
                        <div className="text-[10px] text-muted font-normal">Commuter student</div>
                      </div>
                    </label>
                    <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${Number(formData.is_boarding) === 1 ? 'bg-brand-50 border-brand-500 text-brand-900 font-semibold' : 'bg-surface border-line text-muted'}`}>
                      <input
                        type="radio"
                        name="is_boarding"
                        checked={Number(formData.is_boarding) === 1}
                        onChange={() => setFormData({ ...formData, is_boarding: 1 })}
                      />
                      <div>
                        <div className="text-xs">Boarder</div>
                        <div className="text-[10px] text-muted font-normal">Hostel residence allocated</div>
                      </div>
                    </label>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="font-semibold text-ink block mb-1">Previous School Attended</label>
                <input
                  type="text"
                  value={formData.previous_school}
                  onChange={e => setFormData({ ...formData, previous_school: e.target.value })}
                  placeholder="e.g. Churchill Boys High / St. Georges"
                  className="glass-input w-full"
                />
              </div>
            </div>
          )}

          {/* Step 3: Medical & Welfare */}
          {wizardStep === 2 && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Known Allergies</label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="e.g. Peanuts, Penicillin, Bee stings, None"
                  className="glass-input w-full"
                />
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Medical Conditions / Clinic Special Notes</label>
                <textarea
                  rows={3}
                  value={formData.medical_notes}
                  onChange={e => setFormData({ ...formData, medical_notes: e.target.value })}
                  placeholder="e.g. Mild asthma; inhaler kept at boarding sickbay. Spectacles worn for distance reading."
                  className="glass-input w-full"
                />
              </div>
            </div>
          )}

          {/* Step 4: Guardian Contacts & Portal Access */}
          {wizardStep === 3 && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Primary Guardian Name *</label>
                <input
                  type="text"
                  required
                  value={formData.guardian_name}
                  onChange={e => setFormData({ ...formData, guardian_name: e.target.value })}
                  placeholder="e.g. Mrs. Sarah Moyo"
                  className="glass-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink block mb-1">Mobile Phone (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    value={formData.guardian_phone}
                    onChange={e => setFormData({ ...formData, guardian_phone: e.target.value })}
                    placeholder="+263 77..."
                    className="glass-input w-full font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Relationship</label>
                  <select
                    value={formData.guardian_relation}
                    onChange={e => setFormData({ ...formData, guardian_relation: e.target.value })}
                    className="glass-input w-full"
                  >
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Grandparent">Grandparent</option>
                    <option value="Sponsor">Sponsor / NGO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink block mb-1">Guardian Email Address</label>
                  <input
                    type="email"
                    value={formData.guardian_email}
                    onChange={e => setFormData({ ...formData, guardian_email: e.target.value })}
                    placeholder="guardian@example.co.zw"
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Guardian National ID</label>
                  <input
                    type="text"
                    value={formData.guardian_national_id || ''}
                    onChange={e => setFormData({ ...formData, guardian_national_id: e.target.value })}
                    placeholder="e.g. 63-189204P18"
                    className="glass-input w-full font-mono"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink text-[11px] uppercase tracking-wider">Parent Portal Account</span>
                  <span className="text-[10px] text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md font-medium">Automatic Provisioning</span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  A parent portal login will be automatically established for <strong>{formData.guardian_name || 'the guardian'}</strong>. You may optionally specify custom credentials below:
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-medium text-muted block mb-1">Custom Username (Optional)</label>
                    <input
                      type="text"
                      value={formData.parent_username || ''}
                      onChange={e => setFormData({ ...formData, parent_username: e.target.value })}
                      placeholder="Auto-generated if blank"
                      className="glass-input w-full text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted block mb-1">Custom Password (Optional)</label>
                    <input
                      type="password"
                      value={formData.parent_password || ''}
                      onChange={e => setFormData({ ...formData, parent_password: e.target.value })}
                      placeholder="Auto-generated if blank"
                      className="glass-input w-full text-[11px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {wizardStep === 4 && (
            <div className="space-y-4 text-xs p-4 rounded-xl bg-canvas border border-line">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h4 className="font-bold text-sm text-ink font-display">Admission Summary Review</h4>
                <StatusPill status="enrolled" label="Ready to Enroll" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-muted">
                <div>Learner Name: <strong className="text-ink">{formData.first_name} {formData.middle_name ? `${formData.middle_name} ` : ''}{formData.last_name}</strong></div>
                <div>System ADM: <strong className="text-ink font-mono">{formData.admission_number}</strong></div>
                <div>Gender / DOB: <strong className="text-ink capitalize">{formData.gender} • {formData.date_of_birth}</strong></div>
                <div>National ID: <strong className="text-ink font-mono">{formData.national_id || 'Not provided'}</strong></div>
                <div>Class Stream: <strong className="text-ink">{(isCustomClass || classes.length === 0) ? (newClassName || 'Pending input') : (classes.find(c => c.id === formData.class_id)?.name || 'Stream assigned')}</strong></div>
                <div>Residence: <strong className="text-ink">{Number(formData.is_boarding) === 1 ? 'Boarder (Hostel)' : 'Day Scholar'}</strong></div>
                <div>Primary Guardian: <strong className="text-ink">{formData.guardian_name} ({formData.guardian_relation})</strong></div>
                <div>Guardian Phone: <strong className="text-ink font-mono">{formData.guardian_phone}</strong></div>
              </div>

              <div className="p-3 rounded-lg bg-surface border border-line text-[11px] text-muted flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>
                  Completing this admission automatically enrolls the learner, generates the initial term billing profile, and provisions the parent portal access account.
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          refetch();
        }}
        schoolId={schoolId}
        entity="students"
        title="Import Students Roster"
        invalidateKeys={[`students_list_${schoolId}`, `classes_${schoolId}`]}
      />
    </div>
  );
}
