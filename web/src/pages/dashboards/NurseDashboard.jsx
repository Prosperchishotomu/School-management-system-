import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import {
  StatCard,
  KpiStrip,
  Card,
  StatusPill,
  EmptyState
} from '../../components/ui';
import {
  HeartPulse, AlertTriangle, ShieldCheck,
  Activity, Plus
} from 'lucide-react';

export default function NurseDashboard() {
  const { user, activeSchoolId } = useAuth();
  const navigate = useNavigate();
  const schoolId = activeSchoolId || user?.school_id || '';

  const { data: summaryData } = useApi(
    `nurse_summary_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=nurse`)
  );

  const nurseData = summaryData?.data?.role_specific || {};

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 bg-surface border border-line text-ink shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-wider text-brand-700 dark:text-brand-300 uppercase px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 block w-fit mb-1.5">
            Sanatorium & Student Health
          </span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-ink tracking-tight">
            Clinic Desk
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1 max-w-xl">
            {nurseData.visits_today ?? 0} student consultations recorded today. Review chronic medical alerts and medical history.
          </p>
        </div>

        <button
          onClick={() => navigate('/health-records')}
          className="btn-primary shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Log Clinic Visit
        </button>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Visits Today"
          value={`${nurseData.visits_today ?? 0} Consults`}
          sublabel="Today's consultations"
          icon={HeartPulse}
          iconColor="brand"
          to="/health-records"
        />

        <StatCard
          title="Chronic Registry"
          value={`${nurseData.chronic_conditions_count ?? 0} Learners`}
          sublabel="Care plans monitored"
          icon={AlertTriangle}
          iconColor="accent"
          to="/health-records"
        />

        <StatCard
          title="Allergy Flags"
          value={`${nurseData.allergies_count ?? 0} Flags`}
          sublabel="Refectory notified"
          icon={ShieldCheck}
          iconColor="info"
          to="/health-records"
        />

        <StatCard
          title="External Referrals"
          value={`${nurseData.referrals_this_term ?? 0} Patients`}
          sublabel="Hospital consultations"
          icon={Activity}
          iconColor="violet"
          to="/health-records"
        />
      </KpiStrip>

      {/* Primary Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Chronic Conditions & Allergy Watch"
          subtitle="Boarders requiring daily medical protocol supervision"
          action={
            <button
              onClick={() => navigate('/health-records')}
              className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
            >
              Full Registry →
            </button>
          }
        >
          <div className="p-8 text-center text-xs text-muted">
            No active chronic medical or allergy alerts logged for this cohort.
          </div>
        </Card>

        <Card
          title="Common Health Complaints (This Term)"
          subtitle="Aggregated consultation diagnoses"
        >
          <div className="p-8 text-center text-xs text-muted">
            No clinic visits recorded for this term yet.
          </div>
        </Card>
      </div>
    </div>
  );
}
