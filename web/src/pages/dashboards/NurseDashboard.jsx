import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  StatCard,
  KpiStrip,
  Card,
  StatusPill,
  EmptyState
} from '../../components/ui';
import {
  HeartPulse, AlertTriangle, ShieldCheck, Users,
  Activity, Plus, ArrowRight
} from 'lucide-react';

export default function NurseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const chronicBoarders = [
    { name: 'Tatenda Dube', class: 'Form 3 Gamma', condition: 'Type 1 Diabetes', hostel: 'Chitepo Hall', alerts: 'Insulin stored in clinic' },
    { name: 'Rudo Chiwenga', class: 'Form 2 Beta', condition: 'Severe Asthma', hostel: 'Kaguvi Hall', alerts: 'Inhaler protocol active' },
    { name: 'Kudzai Moyo', class: 'Grade 7 Diamond', condition: 'Peanut & Nut Allergy', hostel: 'Day Scholar', alerts: 'EpiPen registered' }
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2 py-0.5 rounded-full bg-white/10 block w-fit mb-1.5">
            Sanatorium & Student Health
          </span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
            Clinic Desk
          </h1>
          <p className="text-xs md:text-sm text-brand-100/90 mt-1 max-w-xl">
            8 student consultations recorded today. All chronic medical registries are up to date.
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
          value="8 Consults"
          sublabel="5 treated & returned"
          icon={HeartPulse}
          iconColor="brand"
          to="/health-records"
        />

        <StatCard
          title="Chronic Registry"
          value="19 Learners"
          sublabel="Care plans monitored"
          icon={AlertTriangle}
          iconColor="accent"
          to="/health-records"
        />

        <StatCard
          title="Allergy Flags"
          value="34 Flags"
          sublabel="Refectory notified"
          icon={ShieldCheck}
          iconColor="info"
          to="/health-records"
        />

        <StatCard
          title="External Referrals"
          value="3 Patients"
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
          <div className="divide-y divide-line/60">
            {chronicBoarders.map(b => (
              <div key={b.name} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-xs text-ink">{b.name}</div>
                  <div className="text-[11px] text-muted">{b.class} • {b.hostel}</div>
                  <div className="text-[11px] text-accent mt-0.5 font-medium">{b.alerts}</div>
                </div>
                <StatusPill status="open" label={b.condition} />
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Common Health Complaints (This Term)"
          subtitle="Aggregated consultation diagnoses"
        >
          <div className="space-y-3 py-1">
            {[
              { complaint: 'Mild viral headache / fatigue', count: 42, pct: 44 },
              { complaint: 'Sports strain / minor contusion', count: 28, pct: 29 },
              { complaint: 'Seasonal allergic rhinitis', count: 16, pct: 17 },
              { complaint: 'Abdominal pain / upset', count: 10, pct: 10 }
            ].map(c => (
              <div key={c.complaint} className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-ink">{c.complaint}</span>
                  <span className="font-mono text-muted">{c.count} visits ({c.pct}%)</span>
                </div>
                <div className="w-full bg-line/60 h-2 rounded-full overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
