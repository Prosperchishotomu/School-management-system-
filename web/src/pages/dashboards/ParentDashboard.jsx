import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import { money } from '../../utils/format';
import {
  StatCard,
  KpiStrip,
  Card,
  ProgressRing,
  Sparkline,
  Stepper,
  StatusPill,
  Avatar,
  EmptyState
} from '../../components/ui';
import {
  GraduationCap, CalendarCheck, DollarSign, Clock, BookOpen,
  Award, Shield, FileText, ArrowRight, CheckCircle2
} from 'lucide-react';

export default function ParentDashboard() {
  const { user, activeSchoolId } = useAuth();
  const navigate = useNavigate();
  const schoolId = activeSchoolId || user?.school_id || 'HARAREPR';

  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  // Summary with scoped children
  const { data: summary } = useApi(
    `parent_summary_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=parent`)
  );

  const rawChildren = summary?.role_specific?.children;
  const hasRealChildren = Array.isArray(rawChildren) && rawChildren.length > 0;
  
  const children = hasRealChildren
    ? rawChildren
    : (!summary ? [
        {
          id: 'STU00101',
          name: 'Tinashe Moyo',
          class: 'Form 3 Gamma',
          attendance_pct: 95,
          term_average: 78.4,
          class_position: '3rd of 42',
          fee_balance: 140.00,
          next_exam: 'Physics End-of-Term (18 Nov)',
          exeat_status: 'approved',
          exeat_step: 1
        },
        {
          id: 'STU00102',
          name: 'Nyasha Moyo',
          class: 'Grade 7 Diamond',
          attendance_pct: 98,
          term_average: 84.0,
          class_position: '1st of 36',
          fee_balance: 0.00,
          next_exam: 'ZIMSEC Mock 2 (24 Nov)',
          exeat_status: 'none',
          exeat_step: 0
        }
      ] : []);

  const currentChild = children[selectedChildIndex] || children[0] || null;

  const exeatSteps = [
    { label: 'Applied' },
    { label: 'Approved' },
    { label: 'Checked Out' },
    { label: 'Returned' }
  ];

  // If summary loaded and parent has no linked children in database
  if (summary && children.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-6 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md">
          <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2 py-0.5 rounded-full bg-white/10 block w-fit mb-1.5">
            Parent & Guardian Portal
          </span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
            Family Workspace
          </h1>
          <p className="text-xs md:text-sm text-brand-100/90 mt-1">
            Welcome to the school parent portal.
          </p>
        </div>

        <Card>
          <EmptyState
            icon={GraduationCap}
            title="No Linked Learners Found"
            description="There are currently no students linked to your parent account in this school. Please contact the school administration or bursar desk with your National ID to link your children."
            action={
              <button
                onClick={() => navigate('/parent-portal')}
                className="btn-secondary text-xs"
              >
                Go to Parent Portal
              </button>
            }
          />
        </Card>
      </div>
    );
  }

  const childFeeBalance = Number(currentChild?.fee_balance || 0);

  return (
    <div className="space-y-6">
      {/* Hero with Child Switcher Tabs */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2 py-0.5 rounded-full bg-white/10 block w-fit mb-1.5">
              Parent & Guardian Portal
            </span>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
              Family Workspace
            </h1>
            <p className="text-xs md:text-sm text-brand-100/90 mt-1">
              Select child to review academic progress, fees & welfare.
            </p>
          </div>

          {/* Child Switcher Tabs */}
          {children.length > 0 && (
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl shrink-0 overflow-x-auto">
              {children.map((c, idx) => (
                <button
                  key={c.id || idx}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedChildIndex === idx
                      ? 'bg-white text-brand-950 shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Avatar name={c?.name || 'Child'} size="xs" />
                  <span>{c?.name ? c.name.split(' ')[0] : `Child ${idx + 1}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Child Details Overview */}
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div>
          <h2 className="text-xl font-bold font-display text-ink">{currentChild?.name || 'Student'}</h2>
          <span className="text-xs text-muted">{currentChild?.class || 'Enrolled Student'} • Student ID: {currentChild?.id || '-'}</span>
        </div>

        <button
          onClick={() => navigate('/results')}
          className="btn-secondary text-xs"
        >
          View Full Report Card
        </button>
      </div>

      {/* Child KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Attendance Rate"
          value={`${currentChild?.attendance_pct ?? 0}%`}
          sublabel="Current term attendance"
          icon={CalendarCheck}
          iconColor="brand"
          to="/parent-portal"
        />

        <StatCard
          title="Term Average"
          value={`${currentChild?.term_average ?? 0}%`}
          sublabel={currentChild?.class_position || 'Active learner'}
          icon={Award}
          iconColor="brand"
          to="/results"
        />

        <StatCard
          title="Fee Balance"
          value={money(childFeeBalance)}
          sublabel={childFeeBalance > 0 ? 'Due immediately' : 'Account cleared'}
          icon={DollarSign}
          iconColor={childFeeBalance > 0 ? 'accent' : 'brand'}
          to={`/parent-portal?action=pay&child=${currentChild?.id || ''}`}
        />

        <StatCard
          title="Next Assessment"
          value="Upcoming Exam"
          sublabel={currentChild?.next_exam || 'Continuous assessment'}
          icon={GraduationCap}
          iconColor="info"
          to="/parent-portal"
        />
      </KpiStrip>

      {/* Primary Panels: Fee Pay Now & Exeat Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee Settlement Card */}
        <Card
          title="Term Tuition & Boarding Fees"
          subtitle="Multi-currency payment desk (EcoCash, InnBucks, Cash Declaration, Bank Transfer)"
          action={
            <StatusPill
              status={childFeeBalance === 0 ? 'paid' : 'partial'}
              label={childFeeBalance === 0 ? 'Fully Paid' : 'Balance Pending'}
            />
          }
        >
          <div className="p-4 rounded-xl bg-canvas border border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <span className="text-xs text-muted font-medium block">Current Amount Due</span>
              <span className="text-2xl font-display font-extrabold text-ink font-mono tabular-nums">
                {money(childFeeBalance)}
              </span>
              <span className="text-[11px] text-muted block mt-0.5">
                Equivalent: ≈ ZiG {(childFeeBalance * 26.85).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate(`/parent-portal?action=pay&child=${currentChild?.id || ''}`)}
                className="btn-primary flex items-center gap-1.5"
              >
                <DollarSign className="w-4 h-4" />
                Declare / Pay Fees
              </button>
            </div>
          </div>

          <div className="text-xs text-muted leading-relaxed">
            Parents can declare cash payments made at the cashier desk, bank deposit slips with reference numbers, or pay directly via EcoCash, InnBucks, and Card. Cleared payments update the student fees ledger immediately.
          </div>
        </Card>

        {/* Exeat Boarding Tracker */}
        <Card
          title="Boarding Gate & Exeat Pass"
          subtitle="Real-time gate pass status and checkout approval"
          action={
            <button
              onClick={() => navigate('/boarding/exeats')}
              className="btn-secondary text-xs"
            >
              Request Exeat
            </button>
          }
        >
          <div className="py-4">
            <Stepper
              steps={exeatSteps}
              currentStep={currentChild.exeat_step || 1}
            />
          </div>

          <div className="mt-4 p-3 rounded-xl bg-canvas text-xs space-y-1">
            <div className="flex justify-between text-muted">
              <span>Status:</span>
              <span className="font-semibold text-ink capitalize">{currentChild.exeat_status || 'None'}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Destination:</span>
              <span className="font-semibold text-ink">Family Residence (Harare)</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Expected Return:</span>
              <span className="font-semibold text-ink font-mono">Sunday 17:00</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
