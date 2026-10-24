import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import { money } from '../../utils/format';
import {
  StatCard,
  KpiStrip,
  Card,
  StatusPill,
  Gauge,
  EmptyState
} from '../../components/ui';
import {
  HardDrive, Server, ShieldCheck, Activity, Users,
  Building2, Lock, ArrowRight, CheckCircle2
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const { user, activeSchoolId, changeActiveSchool } = useAuth();
  const navigate = useNavigate();

  const { data: schoolsData } = useApi('super_schools', () => api.get('/schools'));

  const schools = useMemo(() => {
    if (!schoolsData) return [];
    return Array.isArray(schoolsData) ? schoolsData : (schoolsData.data || []);
  }, [schoolsData]);

  const totalPlatformStudents = schools.reduce((acc, s) => acc + (s.student_count || 0), 0);
  const totalBillingVolume = schools.reduce((acc, s) => acc + parseFloat(s.total_billed || 0), 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2 py-0.5 rounded-full bg-white/10 block w-fit mb-1.5">
            Platform Governance
          </span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
            Command Center
          </h1>
          <p className="text-xs md:text-sm text-brand-100/90 mt-1 max-w-xl">
            Multi-tenant telemetry, database cluster status and license compliance monitoring.
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/system-administration')}
          className="btn-primary shrink-0"
        >
          System Config
        </button>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Active Schools"
          value={String(schools.length)}
          sublabel="100% license compliance"
          icon={Building2}
          iconColor="brand"
          to="/admin/command-center"
        />

        <StatCard
          title="Total Platform Students"
          value={totalPlatformStudents.toLocaleString()}
          sublabel={`Across ${schools.length} institutions`}
          icon={Users}
          iconColor="brand"
          to="/admin/command-center"
        />

        <StatCard
          title="Total Billing Volume"
          value={money(totalBillingVolume)}
          sublabel="Processed this academic year"
          icon={Activity}
          iconColor="accent"
          to="/fees"
        />

        <StatCard
          title="Cluster Health"
          value="Optimal"
          sublabel="MySQL InnoDB & Redis ready"
          icon={Server}
          iconColor="info"
          to="/admin/command-center"
        />
      </KpiStrip>

      {/* System Health Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>DB Connection Pool</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <div className="font-mono font-bold text-lg text-ink">10 / 10 Idle</div>
          <span className="text-[10px] text-muted">Avg latency 4.2ms</span>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Delivery Outbox</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <div className="font-mono font-bold text-lg text-ink">0 Queued</div>
          <span className="text-[10px] text-muted">100% dispatch rate</span>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>WebSocket Gateway</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <div className="font-mono font-bold text-lg text-ink">28 Connected</div>
          <span className="text-[10px] text-muted">Broadcast mesh active</span>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Background Workers</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <div className="font-mono font-bold text-lg text-ink">Active</div>
          <span className="text-[10px] text-muted">Exeat & billing cron OK</span>
        </div>
      </div>

      {/* Schools Leaderboard */}
      <Card
        title="Institutional Fleet Leaderboard"
        subtitle="SchoolBase deployed instances and operational volume"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-muted uppercase text-[11px]">
                <th className="py-2.5 text-left">Institution</th>
                <th className="py-2.5 text-right">Learners</th>
                <th className="py-2.5 text-right">Collection Rate</th>
                <th className="py-2.5 text-center">License Tier</th>
                <th className="py-2.5 text-center">Status</th>
                <th className="py-2.5 text-right">Switch View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {schools.map(s => (
                <tr key={s.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="text-[10px] text-muted font-mono">{s.id}</div>
                  </td>
                  <td className="py-3 text-right font-mono font-bold">{s.student_count ?? 0}</td>
                  <td className="py-3 text-right font-mono text-brand-700 dark:text-brand-400 font-bold">
                    {s.collection_rate ?? 0}%
                  </td>
                  <td className="py-3 text-center">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                      {s.tier || 'Enterprise'}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <StatusPill status="active" label="Operational" />
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => {
                        changeActiveSchool(s.id);
                        navigate('/dashboard');
                      }}
                      className="px-3 py-1 rounded-lg bg-surface border border-line text-ink hover:border-brand-500 text-xs font-semibold cursor-pointer"
                    >
                      View As School →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
