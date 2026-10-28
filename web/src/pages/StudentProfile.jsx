import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import { api } from '../utils/api';
import { money, pct } from '../utils/format';
import {
  PageHeader,
  KpiStrip,
  StatCard,
  Card,
  Tabs,
  Avatar,
  StatusPill,
  Money,
  ProgressRing,
  Timeline,
  Sparkline,
  Modal,
  EmptyState,
  Skeleton
} from '../components/ui';
import {
  GraduationCap, CalendarCheck, DollarSign, Building2, HeartPulse,
  AlertTriangle, FileText, ArrowLeft, PlusCircle, CheckCircle2,
  Printer, Shield, Phone, Mail, Award, BookOpen, ArrowDownRight,
  ArrowUpRight, Plus, Receipt, CreditCard
} from 'lucide-react';

import { isSchoolBoarding } from '../utils/modules';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeSchoolId, activeSchool } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const schoolId = activeSchoolId || user?.school_id || '';
  const activeTab = searchParams.get('tab') || 'overview';
  const hasBoarding = isSchoolBoarding(activeSchool);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payCurrency, setPayCurrency] = useState('USD');
  const [payLoading, setPayLoading] = useState(false);

  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [chargeTitle, setChargeTitle] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDueDate, setChargeDueDate] = useState('');
  const [chargeLoading, setChargeLoading] = useState(false);

  // Elective Subjects Selection
  const [electiveModalOpen, setElectiveModalOpen] = useState(false);
  const [selectedElectives, setSelectedElectives] = useState([]);
  const [savingElectives, setSavingElectives] = useState(false);

  // Fetch student assigned and available subjects
  const { data: electiveData, refetch: refetchElectives } = useApi(
    `student_electives_${schoolId}_${id}`,
    () => api.get(`/schools/${schoolId}/students/${id}/subjects`).then(r => r.data || {})
  );

  useEffect(() => {
    if (electiveData?.assigned_subjects) {
      setSelectedElectives(electiveData.assigned_subjects.map(s => s.subject_id));
    }
  }, [electiveData]);

  const handleSaveElectives = async () => {
    setSavingElectives(true);
    try {
      await api.put(`/schools/${schoolId}/students/${id}/subjects`, {
        subject_ids: selectedElectives
      });
      toast.success('Elective subject choices updated successfully.');
      setElectiveModalOpen(false);
      refetchElectives();
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update subject choices.');
    } finally {
      setSavingElectives(false);
    }
  };

  const availableSubjectsList = electiveData?.available_subjects || [];
  const assignedSubjectsList = electiveData?.assigned_subjects || [];

  // Fetch 360 Student Profile
  const { data: profile, loading, refetch } = useApi(
    `student_profile_${schoolId}_${id}`,
    () => api.get(`/schools/${schoolId}/students/${id}/profile`)
  );

  // Fetch verified student financial ledger
  const { data: ledgerPayload, loading: ledgerLoading, refetch: refetchLedger } = useApi(
    `student_ledger_${schoolId}_${id}`,
    () => api.get(`/schools/${schoolId}/students/${id}/ledger`)
  );

  const student = profile?.student || {};
  const feeSummary = profile?.fee_summary || {};
  const ledgerSummary = ledgerPayload?.data?.summary || ledgerPayload?.summary || {};
  const ledgerEntries = ledgerPayload?.data?.ledger || ledgerPayload?.ledger || [];
  const feeBalance = typeof ledgerSummary.balance_due === 'number'
    ? ledgerSummary.balance_due
    : (typeof feeSummary.balance === 'number' ? feeSummary.balance : 0);

  const subjects = profile?.subjects || [];
  const attendanceStats = profile?.attendance_summary || null;
  const healthInfo = profile?.health || {};

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    setPayLoading(true);
    try {
      const feeId = feeSummary.id || `FEE-${id}`;
      await api.post(`/schools/${schoolId}/fees/${feeId}/payments`, {
        student_id: id,
        amount_paid: Number(payAmount),
        payment_method: payMethod,
        currency: payCurrency,
        reference: `REC-${Date.now().toString().slice(-6)}`
      });

      toast.success('Payment recorded successfully.');
      setPaymentModalOpen(false);
      setPayAmount('');

      // Cross-entity invalidation pass
      invalidate([
        `student_profile_${schoolId}_${id}`,
        `student_ledger_${schoolId}_${id}`,
        `students_list_${schoolId}`,
        `summary_${schoolId}`,
        `fees_`
      ]);
      refetch();
      refetchLedger();
    } catch (err) {
      toast.error(err?.message || 'Failed to record payment.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleAddCharge = async (e) => {
    e.preventDefault();
    if (!chargeTitle || !chargeAmount || Number(chargeAmount) <= 0) {
      toast.error('Please enter a charge title and valid amount.');
      return;
    }

    setChargeLoading(true);
    try {
      await api.post(`/schools/${schoolId}/students/${id}/charges`, {
        title: chargeTitle,
        amount: Number(chargeAmount),
        due_date: chargeDueDate || null
      });

      toast.success('Fee charge successfully posted to student financial ledger.');
      setChargeModalOpen(false);
      setChargeTitle('');
      setChargeAmount('');
      setChargeDueDate('');

      invalidate([
        `student_profile_${schoolId}_${id}`,
        `student_ledger_${schoolId}_${id}`,
        `students_list_${schoolId}`,
        `summary_${schoolId}`,
        `fees_`
      ]);
      refetch();
      refetchLedger();
    } catch (err) {
      toast.error(err?.message || 'Failed to post charge to student ledger.');
    } finally {
      setChargeLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: GraduationCap },
    { id: 'academic', label: 'Academics & Reports', icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'finance', label: 'Finance & Ledger', icon: DollarSign },
    { id: 'residence', label: hasBoarding ? 'Health & Residence' : 'Health & Medical', icon: hasBoarding ? Building2 : HeartPulse },
    { id: 'discipline', label: 'Discipline & Merits', icon: AlertTriangle }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="card" height="180px" />
        <Skeleton variant="stat-card" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/students')}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students Directory</span>
        </button>
      </div>

      {/* 360 Hero Header (Section 4) */}
      <div className="glass-card p-6 border border-line flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-5">
          <Avatar
            name={`${student.first_name} ${student.last_name}`}
            size="xl"
            id={student.id}
          />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold font-display text-ink tracking-tight">
                {student.first_name} {student.last_name}
              </h1>
              <StatusPill status={student.status || 'enrolled'} />
              {student.is_boarding ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Boarder • Chitepo Hall
                </span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-line text-muted">
                  Day Scholar
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted mt-2 flex-wrap font-mono">
              <span>Class: <strong className="text-ink font-sans">{student.class_name || 'Unassigned'}</strong></span>
              <span>Admission: <strong className="text-ink">{student.admission_number || student.id}</strong></span>
              <span>Candidate No: <strong className="text-ink">6024/0048</strong></span>
            </div>
          </div>
        </div>

        {/* Fee Status Card in Hero */}
        <div className="flex items-center gap-4 bg-canvas/80 p-4 rounded-xl border border-line shrink-0">
          <div>
            <span className="text-[11px] text-muted font-medium block">Current Balance</span>
            <div className="text-xl font-bold font-display font-mono text-ink">
              {money(feeBalance)}
            </div>
            <StatusPill
              status={Number(ledgerSummary?.total_billed || feeSummary?.total_due || 0) === 0 ? 'neutral' : (feeBalance === 0 ? 'paid' : 'partial')}
              label={Number(ledgerSummary?.total_billed || feeSummary?.total_due || 0) === 0 ? 'Unbilled' : (feeBalance === 0 ? 'Fully Cleared' : 'Payment Due')}
              size="sm"
              className="mt-1"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="btn-primary text-xs"
            >
              Record Payment
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        variant="underline"
      />

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <KpiStrip>
            <StatCard
              title="Attendance Rate"
              value={attendanceStats && attendanceStats.rate != null ? `${attendanceStats.rate}%` : 'N/A'}
              sublabel={attendanceStats && attendanceStats.total > 0 ? `${attendanceStats.present || 0} of ${attendanceStats.total} sessions` : 'No sessions logged'}
              icon={CalendarCheck}
              iconColor="brand"
            />

            <StatCard
              title="Academic Standing"
              value={student.academic_standing || 'In Good Standing'}
              sublabel={student.class_name ? `Enrolled in ${student.class_name}` : 'Roster Active'}
              icon={Award}
              iconColor="brand"
            />

            <StatCard
              title="Active Subjects"
              value={String(assignedSubjectsList.length || subjects.length)}
              sublabel="Enrolled subject courses"
              icon={GraduationCap}
              iconColor="info"
            />

            <StatCard
              title="Conduct & Merits"
              value={student.conduct_points != null ? `${student.conduct_points} Pts` : 'Clean Record'}
              sublabel="Campus deportment standing"
              icon={Shield}
              iconColor="brand"
            />
          </KpiStrip>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Academic Summary" subtitle="Term-on-term weighted averages">
              {Array.isArray(profile?.academic_summary) && profile.academic_summary.length > 0 ? (
                <div className="space-y-3">
                  {profile.academic_summary.map(t => (
                    <div key={t.term} className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line text-xs">
                      <div>
                        <span className="font-semibold text-ink">{t.term}</span>
                        <div className="text-muted">Mean Aggregate</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {t.trend && <Sparkline data={t.trend} width={70} height={24} />}
                        <span className="font-mono font-bold text-sm text-ink">{t.avg}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted">
                  No term aggregate averages recorded yet for this student.
                </div>
              )}
            </Card>

            <Card title="Guardian & Contacts" subtitle="Registered parents on file">
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-canvas border border-line">
                  <div className="font-semibold text-ink">{student.guardian_name || 'No guardian listed'}</div>
                  <div className="text-muted">{student.guardian_relation ? `${student.guardian_relation} (Primary Contact)` : 'Primary Contact'}</div>
                  <div className="flex flex-wrap items-center gap-4 mt-2 font-mono text-muted">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-brand-500" />
                      {student.guardian_phone || 'None'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-brand-500" />
                      {student.guardian_email || student.parent_email || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Academic Subjects */}
      {activeTab === 'academic' && (
        <Card
          title="Curriculum & Subject Component Marks"
          subtitle="Enrolled Electives, ZIMSEC School Based Assessments & Internal Examinations"
          action={
            <button
              onClick={() => setElectiveModalOpen(true)}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Students and staff can select elective subject combinations"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-600" />
              <span>Choose / Enroll Electives</span>
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-muted uppercase text-[11px]">
                  <th className="py-2.5 text-left">Subject Code & Name</th>
                  <th className="py-2.5 text-center">Type</th>
                  <th className="py-2.5 text-right">CA Tests (30%)</th>
                  <th className="py-2.5 text-right">Exam (70%)</th>
                  <th className="py-2.5 text-right">Weighted Mark</th>
                  <th className="py-2.5 text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {(assignedSubjectsList.length > 0 ? assignedSubjectsList.map(as => {
                  const matchingGr = subjects.find(s => s.code === as.subject_code || s.name === as.subject_name);
                  return {
                    code: as.subject_code || 'SUB',
                    name: as.subject_name || 'Subject',
                    type: as.status || 'elective',
                    ca: matchingGr?.ca != null ? `${matchingGr.ca}%` : '—',
                    exam: matchingGr?.exam != null ? `${matchingGr.exam}%` : '—',
                    total: matchingGr?.total != null ? `${matchingGr.total}%` : '—',
                    grade: matchingGr?.grade || '—'
                  };
                }) : subjects).map((s) => (
                  <tr key={s.code} className="hover:bg-canvas/40 transition-colors">
                    <td className="py-3 font-semibold text-ink">
                      <span>{s.name}</span>
                      <span className="font-mono text-muted text-[10px] ml-2">({s.code})</span>
                    </td>
                    <td className="py-3 text-center uppercase font-mono text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full ${s.type === 'core' ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'bg-accent/10 text-accent font-semibold'}`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">{s.ca}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{s.exam}</td>
                    <td className="py-3 text-right font-mono font-bold text-ink tabular-nums">{s.total}</td>
                    <td className="py-3 text-center">
                      <StatusPill status="present" label={s.grade} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assignedSubjectsList.length === 0 && subjects.length === 0 && (
            <div className="py-8 text-center">
              <EmptyState
                icon={BookOpen}
                title="No subjects enrolled"
                message="This student has not yet been assigned subjects. Click 'Choose / Enroll Electives' above to configure their curriculum."
              />
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Attendance */}
      {activeTab === 'attendance' && (
        <Card title="Attendance Registry" subtitle="Month-by-month session logs">
          {attendanceStats && attendanceStats.total > 0 ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-canvas border border-line mb-4">
              <div>
                <span className="font-bold text-sm text-ink">Term Summary</span>
                <p className="text-xs text-muted">Total school sessions held: {attendanceStats.total}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-brand-700">{attendanceStats.present || 0} Days Present</span>
                  <div className="text-[11px] text-muted font-mono">{attendanceStats.absent || 0} Absences</div>
                </div>
                <ProgressRing value={attendanceStats.rate || 0} size={64} color="brand" />
              </div>
            </div>
          ) : (
            <div className="py-8">
              <EmptyState
                icon={CalendarCheck}
                title="No attendance records"
                message="No roll-call sessions have been logged for this learner this term."
              />
            </div>
          )}
        </Card>
      )}

      {/* Tab 4: Accurate Student Financial Ledger */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* Summary KPIs Row matching Command Center aesthetics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard
              title="Total Billed / Invoiced"
              value={money(ledgerSummary.total_billed || 0)}
              sub="Accumulated charges & levies"
              icon={FileText}
              color="brand"
            />
            <StatCard
              title="Total Collected / Paid"
              value={money(ledgerSummary.total_paid || 0)}
              sub="Verified cashier & online payments"
              icon={CheckCircle2}
              color="emerald"
            />
            <StatCard
              title="Outstanding Balance Due"
              value={money(ledgerSummary.balance_due || 0)}
              sub={Number(ledgerSummary.total_billed || 0) === 0 ? "No invoices issued" : (ledgerSummary.balance_due > 0 ? "Immediate settlement required" : "Account fully cleared")}
              icon={DollarSign}
              color={ledgerSummary.balance_due > 0 ? "rose" : "brand"}
            />
            <StatCard
              title="Ledger Status"
              value={(Number(ledgerSummary.total_billed || 0) === 0 ? 'No Invoices' : (ledgerSummary.status || 'cleared')).replace('_', ' ').toUpperCase()}
              sub={`${ledgerEntries.length} verified transactions`}
              icon={CreditCard}
              color={Number(ledgerSummary.total_billed || 0) === 0 ? 'brand' : (ledgerSummary.status === 'cleared' ? 'emerald' : 'amber')}
            />
          </div>

          {/* Action Bar & Transaction History Card */}
          <Card
            title="Student Financial Ledger"
            subtitle="Append-only chronological debits, cashier receipts and running balance"
            action={
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Statement</span>
                </button>
                {['school_admin', 'bursar', 'super_admin'].includes(user?.role) && (
                  <button
                    type="button"
                    onClick={() => setChargeModalOpen(true)}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Post Charge</span>
                  </button>
                )}
                {['school_admin', 'bursar', 'super_admin', 'parent'].includes(user?.role) && (
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(true)}
                    className="btn-primary text-xs flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>+ Record Payment</span>
                  </button>
                )}
              </div>
            }
          >
            {ledgerLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  icon={Receipt}
                  title="No financial transactions recorded"
                  message="This student has no posted charges or payments on file. Post a fee charge or record an initial payment to start the running ledger."
                  action={
                    ['school_admin', 'bursar', 'super_admin'].includes(user?.role) ? (
                      <button
                        onClick={() => setChargeModalOpen(true)}
                        className="btn-primary text-xs mt-3"
                      >
                        + Post First Charge
                      </button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold text-muted uppercase tracking-wider bg-canvas/50">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Reference</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3">Term</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3 text-right">Debit (+)</th>
                      <th className="py-3 px-3 text-right">Credit (-)</th>
                      <th className="py-3 px-3 text-right">Running Balance</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {ledgerEntries.map((tx) => (
                      <tr key={tx.id} className="hover:bg-canvas/60 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap text-muted font-mono">
                          {new Date(tx.transaction_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono font-semibold text-ink">
                          {tx.reference || tx.id}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {tx.entry_type === 'debit' ? (
                              <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <span className="font-semibold text-ink truncate max-w-[260px]">
                              {tx.title}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-line text-muted">
                            {tx.term}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap uppercase font-mono text-[11px] text-muted">
                          {tx.payment_method || (tx.entry_type === 'debit' ? 'Invoice' : 'Direct')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {tx.debit > 0 ? money(tx.debit) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {tx.credit > 0 ? money(tx.credit) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                          {money(tx.running_balance)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <StatusPill
                            status={tx.entry_type === 'credit' ? 'cleared' : (tx.status || 'unpaid')}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-canvas/40 font-semibold text-xs text-ink">
                      <td colSpan={5} className="py-3 px-3 text-right">Totals / Current Net Balance:</td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                        {money(ledgerSummary.total_billed || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {money(ledgerSummary.total_paid || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                        {money(ledgerSummary.balance_due || 0)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusPill status={Number(ledgerSummary.total_billed || 0) === 0 ? 'neutral' : (ledgerSummary.status || 'cleared')} label={Number(ledgerSummary.total_billed || 0) === 0 ? 'Unbilled' : undefined} size="sm" />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 5: Health & Residence */}
      {activeTab === 'residence' && (
        <div className={`grid grid-cols-1 ${hasBoarding ? 'md:grid-cols-2' : 'max-w-2xl'} gap-6`}>
          {hasBoarding && (
            <Card title="Hostel Residence" subtitle="Boarding house placement and room allocation">
              {student.is_boarding ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-line text-muted">
                    <span>Hostel Hall:</span>
                    <span className="font-semibold text-ink">Hostel Dormitory</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-line text-muted">
                    <span>Residence Type:</span>
                    <span className="font-semibold text-teal-dark bg-teal-primary/10 px-2 py-0.5 rounded">Full Boarder</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-line text-muted">
                    <span>Room / Bed:</span>
                    <span className="font-semibold text-ink font-mono">Assigned by Warden</span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted">
                  This student is registered as a <strong className="text-ink">Day Scholar</strong> (non-resident).
                </div>
              )}
            </Card>
          )}

          <Card title="Medical Records" subtitle="Sanatorium visits and allergy alerts">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Blood Group:</span>
                <span className="font-semibold text-ink font-mono">{healthInfo?.blood_group || student.blood_group || 'Not recorded'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Known Allergies:</span>
                <span className={`font-semibold ${healthInfo?.allergies ? 'text-accent' : 'text-muted'}`}>{healthInfo?.allergies || student.allergies || 'None declared'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Clinic Consultations:</span>
                <span className="font-semibold text-ink">{healthInfo?.clinic_visits || 'No visits this term'}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 6: Discipline & Merits */}
      {activeTab === 'discipline' && (
        <Card title="Conduct & Pastoral Timeline" subtitle="House points, commendations and disciplinary notices">
          {Array.isArray(profile?.discipline) && profile.discipline.length > 0 ? (
            <Timeline items={profile.discipline} />
          ) : (
            <div className="py-6">
              <EmptyState
                icon={Shield}
                title="Clean Conduct Record"
                message="No disciplinary infractions or pastoral sanctions on file for this learner."
              />
            </div>
          )}
        </Card>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Fee Payment"
        subtitle={`Account: ${student.first_name} ${student.last_name}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPaymentModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={payLoading}
              onClick={handleRecordPayment}
              className="btn-primary"
            >
              {payLoading ? 'Saving…' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-ink block mb-1">Payment Currency</label>
            <div className="grid grid-cols-3 gap-2">
              {['USD', 'ZiG', 'ZAR'].map(curr => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setPayCurrency(curr)}
                  className={`py-2 text-center rounded-xl font-mono font-bold border transition-colors cursor-pointer ${
                    payCurrency === curr
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-canvas text-ink border-line hover:border-brand-500'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">Amount Paid ({payCurrency}) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              placeholder="0.00"
              className="glass-input w-full font-mono text-base"
            />
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">Payment Method</label>
            <select
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
              className="glass-input w-full"
            >
              <option value="cash">Cash (Cashier Desk)</option>
              <option value="ecocash">EcoCash</option>
              <option value="innbucks">InnBucks</option>
              <option value="bank_transfer">Bank Transfer (EFT)</option>
              <option value="pos">POS / Swipe Card</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Post Fee Charge / Debit Modal */}
      <Modal
        isOpen={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
        title="Post Fee Charge / Debit"
        subtitle={`Student: ${student.first_name || ''} ${student.last_name || ''} (${student.admission_number || student.id || ''})`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setChargeModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={chargeLoading}
              onClick={handleAddCharge}
              className="btn-primary"
            >
              {chargeLoading ? 'Posting…' : 'Post Charge to Ledger'}
            </button>
          </>
        }
      >
        <form onSubmit={handleAddCharge} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-ink block mb-1">Charge Title / Description *</label>
            <input
              type="text"
              required
              value={chargeTitle}
              onChange={e => setChargeTitle(e.target.value)}
              placeholder="e.g. Term 3 Tuition Fee, Science Lab Levy, Bus Pass"
              className="glass-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">Amount ($ USD) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={chargeAmount}
                onChange={e => setChargeAmount(e.target.value)}
                placeholder="0.00"
                className="glass-input w-full font-mono text-base"
              />
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={chargeDueDate}
                onChange={e => setChargeDueDate(e.target.value)}
                className="glass-input w-full"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Elective Subjects Choice Modal */}
      <Modal
        isOpen={electiveModalOpen}
        onClose={() => setElectiveModalOpen(false)}
        title="Elective Subject Enrollment Provision"
        subtitle={`Select subjects ${student.first_name || 'the student'} intends to study this academic cycle`}
        maxWidth="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setElectiveModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingElectives}
              onClick={handleSaveElectives}
              className="btn btn-primary btn-sm"
            >
              {savingElectives ? 'Saving Choices...' : `Confirm & Save ${selectedElectives.length} Subject(s)`}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          <div className="p-3 rounded-xl bg-canvas border border-line flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted">Student: <strong className="text-ink">{student.first_name} {student.last_name}</strong></span>
            <span className="text-muted">Class: <strong className="text-ink">{student.class_name || 'Enrolled Class'}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 font-mono font-bold">
              {selectedElectives.length} Subjects Selected
            </span>
          </div>

          {/* Quick Curriculum Stream Bundles */}
          <div>
            <label className="font-bold text-ink block mb-1.5 uppercase font-mono text-[10px] text-muted">
              Quick Curriculum Combos:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'Pure Sciences', keywords: ['math', 'phys', 'chem', 'bio'] },
                { name: 'Commercials', keywords: ['acc', 'comm', 'econ', 'bus'] },
                { name: 'Arts & Humanities', keywords: ['hist', 'lit', 'geo', 'relig', 'divin'] },
                { name: 'Select All Core', keywords: ['math', 'eng'] },
              ].map(bundle => (
                <button
                  key={bundle.name}
                  type="button"
                  onClick={() => {
                    const matchedIds = availableSubjectsList
                      .filter(sub => bundle.keywords.some(k => (sub.name || '').toLowerCase().includes(k) || (sub.code || '').toLowerCase().includes(k)))
                      .map(s => s.id);
                    setSelectedElectives(prev => Array.from(new Set([...prev, ...matchedIds])));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface-alt hover:bg-surface border border-line text-xs font-medium text-ink cursor-pointer transition-colors"
                >
                  + Add {bundle.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedElectives([])}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Subject Options Grid */}
          <div>
            <label className="font-bold text-ink block mb-2 uppercase font-mono text-[10px] text-muted">
              Curriculum Catalog ({availableSubjectsList.length} Available Subjects):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
              {availableSubjectsList.map(subj => {
                const isChecked = selectedElectives.includes(subj.id);
                return (
                  <label
                    key={subj.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-brand-500/5 border-brand-500/40 shadow-xs'
                        : 'bg-surface hover:bg-surface-alt border-line'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedElectives(prev => [...prev, subj.id]);
                        } else {
                          setSelectedElectives(prev => prev.filter(x => x !== subj.id));
                        }
                      }}
                      className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-ink leading-tight truncate">{subj.name}</div>
                      <div className="text-[10px] font-mono text-muted flex items-center gap-1.5 mt-0.5">
                        <span>{subj.code}</span>
                        {subj.category && <span className="text-[9px] px-1 rounded bg-line">{subj.category}</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
