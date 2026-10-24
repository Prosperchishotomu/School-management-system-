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
  Printer, Shield, Phone, Mail, Award, BookOpen
} from 'lucide-react';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeSchoolId } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const schoolId = activeSchoolId || user?.school_id || 'HARAREPR';
  const activeTab = searchParams.get('tab') || 'overview';

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payCurrency, setPayCurrency] = useState('USD');
  const [payLoading, setPayLoading] = useState(false);

  // Fetch 360 Student Profile
  const { data: profile, loading, refetch } = useApi(
    `student_profile_${schoolId}_${id}`,
    () => api.get(`/schools/${schoolId}/students/${id}/profile`)
  );

  const student = profile?.student || {};
  const feeSummary = profile?.fee_summary || {};
  const subjects = profile?.subjects || [];
  const attendanceStats = profile?.attendance_summary || { present: 41, total: 43, rate: 95 };
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

      // Cross-entity invalidation pass (Section 6.1)
      invalidate([
        `student_profile_${schoolId}_${id}`,
        `students_list_${schoolId}`,
        `summary_${schoolId}`,
        `fees_`
      ]);
      refetch();
    } catch (err) {
      toast.error(err?.message || 'Failed to record payment.');
    } finally {
      setPayLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: GraduationCap },
    { id: 'academic', label: 'Academics & Reports', icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'finance', label: 'Finance & Ledger', icon: DollarSign },
    { id: 'residence', label: 'Health & Residence', icon: Building2 },
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

  const feeBalance = parseFloat(feeSummary.balance ?? feeSummary.amount_due ?? 0);

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
              status={feeBalance === 0 ? 'paid' : 'partial'}
              label={feeBalance === 0 ? 'Fully Cleared' : 'Payment Due'}
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
              value={attendanceStats.rate != null ? `${attendanceStats.rate}%` : '100%'}
              sublabel={`${attendanceStats.present || 0} of ${attendanceStats.total || 0} sessions`}
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
              value={String(subjects.length)}
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
              <div className="space-y-3">
                {[
                  { term: 'Term 1, 2026', avg: '78.4%', trend: [68, 72, 75, 78] },
                  { term: 'Term 3, 2025', avg: '76.0%', trend: [65, 70, 74, 76] },
                  { term: 'Term 2, 2025', avg: '71.5%', trend: [60, 64, 68, 71] }
                ].map(t => (
                  <div key={t.term} className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line text-xs">
                    <div>
                      <span className="font-semibold text-ink">{t.term}</span>
                      <div className="text-muted">Mean Aggregate</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Sparkline data={t.trend} width={70} height={24} />
                      <span className="font-mono font-bold text-sm text-ink">{t.avg}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Guardian & Contacts" subtitle="Registered parents on file">
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-canvas border border-line">
                  <div className="font-semibold text-ink">{student.guardian_name || 'Mrs. Sarah Moyo'}</div>
                  <div className="text-muted">Mother (Primary Contact)</div>
                  <div className="flex items-center gap-4 mt-2 font-mono text-muted">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-brand-500" />
                      {student.guardian_phone || '+263 77 234 5678'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-brand-500" />
                      guardian@example.co.zw
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
        <Card title="Curriculum & Subject Component Marks" subtitle="ZIMSEC School Based Assessments & Internal Examinations">
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
                {(subjects.length > 0 ? subjects : [
                  { code: 'MATH', name: 'Mathematics', type: 'core', ca: 82, exam: 76, total: 78, grade: 'A' },
                  { code: 'PHYS', name: 'Physics', type: 'core', ca: 78, exam: 72, total: 74, grade: 'B' },
                  { code: 'CHEM', name: 'Chemistry', type: 'core', ca: 85, exam: 80, total: 81, grade: 'A' },
                  { code: 'ENG',  name: 'English Language', type: 'core', ca: 88, exam: 84, total: 85, grade: 'A' },
                  { code: 'CSC',  name: 'Computer Science', type: 'elective', ca: 92, exam: 90, total: 91, grade: 'A*' }
                ]).map((s) => (
                  <tr key={s.code} className="hover:bg-canvas/40 transition-colors">
                    <td className="py-3 font-semibold text-ink">
                      <span>{s.name}</span>
                      <span className="font-mono text-muted text-[10px] ml-2">({s.code})</span>
                    </td>
                    <td className="py-3 text-center uppercase font-mono text-[10px] text-muted">{s.type}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{s.ca}%</td>
                    <td className="py-3 text-right font-mono tabular-nums">{s.exam}%</td>
                    <td className="py-3 text-right font-mono font-bold text-ink tabular-nums">{s.total}%</td>
                    <td className="py-3 text-center">
                      <StatusPill status="present" label={s.grade} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Attendance */}
      {activeTab === 'attendance' && (
        <Card title="Attendance Registry" subtitle="Month-by-month session logs">
          <div className="flex items-center justify-between p-4 rounded-xl bg-canvas border border-line mb-4">
            <div>
              <span className="font-bold text-sm text-ink">Term 1 Summary</span>
              <p className="text-xs text-muted">Total school sessions held: 43</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="font-mono font-bold text-sm text-brand-700">41 Days Present</span>
                <div className="text-[11px] text-muted font-mono">2 Excused Absences</div>
              </div>
              <ProgressRing value={95} size={64} color="brand" />
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Finance Ledger */}
      {activeTab === 'finance' && (
        <Card
          title="Student Fee Statement"
          subtitle="Termly invoices and verified receipts"
          action={
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="btn-primary text-xs"
            >
              + Record Payment
            </button>
          }
        >
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-ink">Term 1 Tuition & Boarding Invoice</span>
                <div className="text-[11px] text-muted font-mono">Invoice #INV-2026-0041 • Due 31 Jan 2026</div>
              </div>
              <div className="text-right font-mono">
                <div className="font-bold text-sm text-ink">{money(480.00)}</div>
                <StatusPill status={feeBalance === 0 ? 'paid' : 'partial'} size="sm" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 5: Health & Residence */}
      {activeTab === 'residence' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Hostel Residence" subtitle="Boarding house placement and room allocation">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Hostel Hall:</span>
                <span className="font-semibold text-ink">Chitepo Boys Hall</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Room Number:</span>
                <span className="font-semibold text-ink font-mono">Block B, Room 14</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Bed Number:</span>
                <span className="font-semibold text-ink font-mono">Bed 02 (Lower bunk)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>House Master:</span>
                <span className="font-semibold text-ink">Mr. S. Mutasa</span>
              </div>
            </div>
          </Card>

          <Card title="Medical Records" subtitle="Sanatorium visits and allergy alerts">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Blood Group:</span>
                <span className="font-semibold text-ink font-mono">O+</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Known Allergies:</span>
                <span className="font-semibold text-accent">Penicillin</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line text-muted">
                <span>Clinic Consultations:</span>
                <span className="font-semibold text-ink">1 visit this term (Mild strain)</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 6: Discipline & Merits */}
      {activeTab === 'discipline' && (
        <Card title="Conduct & Pastoral Timeline" subtitle="House points, commendations and disciplinary notices">
          <Timeline
            items={[
              {
                id: 1,
                title: 'Academic Distinction Commendation',
                description: 'Awarded 10 House Points for 1st place in Science Olympiad.',
                timestamp: '2026-02-14',
                type: 'positive'
              },
              {
                id: 2,
                title: 'Library Merit Award',
                description: 'Commended by Head Librarian for book club stewardship.',
                timestamp: '2026-02-02',
                type: 'positive'
              }
            ]}
          />
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
    </div>
  );
}
