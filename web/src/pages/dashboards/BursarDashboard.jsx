import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import { money, pct, compact } from '../../utils/format';
import {
  StatCard,
  KpiStrip,
  Card,
  StatusPill,
  EmptyState,
  Skeleton
} from '../../components/ui';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
  DollarSign, TrendingUp, AlertTriangle, Layers, Clock,
  CreditCard, ArrowRight, RefreshCw, CheckCircle2
} from 'lucide-react';

export default function BursarDashboard() {
  const { user, activeSchoolId } = useAuth();
  const navigate = useNavigate();
  const schoolId = activeSchoolId || user?.school_id || 'HARAREPR';

  // 1. Summary
  const { data: summary } = useApi(
    `bursar_summary_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=bursar`),
    { pollInterval: 60000 }
  );

  // 2. Collection by method
  const { data: methodSeries } = useApi(
    `fees_by_method_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees?group=method`)
  );

  // 3. Top Debtors
  const { data: topDebtors } = useApi(
    `top_debtors_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees/top-debtors`)
  );

  // 4. Ageing
  const { data: ageing } = useApi(
    `fee_ageing_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees/ageing`)
  );

  const kpis = summary?.kpis || {};
  const roleData = summary?.role_specific || {};

  // Method donut chart colors
  const METHOD_COLORS = ['#1B5E43', '#2E8B63', '#F5A524', '#3B82F6', '#8B5CF6'];

  const methodChartData = (methodSeries || []).slice(0, 5).map(m => ({
    name: m.label || 'Other',
    value: parseFloat(m.collected || 0)
  }));

  return (
    <div className="space-y-6">
      {/* Greeting Hero */}
      <div className="rounded-2xl p-6 bg-surface border border-line text-ink shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono tracking-wider text-brand-700 dark:text-brand-300 uppercase px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20">
              Finance & Bursary Desk
            </span>
            <span className="text-xs text-muted font-mono">
              Multi-Currency Treasury
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-ink tracking-tight">
            Treasury Overview: {user?.name || 'Bursar'}
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1.5 max-w-2xl leading-relaxed">
            Multi-currency collections are active. Current collection rate is {kpis.collection_rate ?? 0}%.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/fees')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-700 text-white transition-colors shadow-sm cursor-pointer"
          >
            Open Cashier Desk
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Today's Receipts"
          value={money(roleData.today_receipts ?? 0)}
          sublabel="Cashier & gateway intake"
          icon={DollarSign}
          iconColor="brand"
          to="/fees"
        />

        <StatCard
          title="Month Collected"
          value={money(roleData.month_collected ?? kpis.fees_collected ?? 0)}
          sublabel={`${kpis.collection_rate ?? 0}% term progress`}
          icon={TrendingUp}
          iconColor="brand"
          to="/fees"
        />

        <StatCard
          title="Collection Rate"
          value={`${kpis.collection_rate ?? 0}%`}
          sublabel="Target: 85%"
          icon={CreditCard}
          iconColor="accent"
          to="/fees"
        />

        <StatCard
          title="Total Outstanding"
          value={money(kpis.outstanding_balance ?? 0)}
          sublabel="Arrears across all streams"
          icon={AlertTriangle}
          iconColor="danger"
          to="/fees?tab=debtors"
        />

        <StatCard
          title="Pending Bank POPs"
          value={roleData.unreconciled_payments ?? 0}
          sublabel="Remote payments to verify"
          icon={Layers}
          iconColor="info"
          to="/fees?tab=reconciliation"
        />
      </KpiStrip>

      {/* Multi-Currency FX Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => navigate('/fees')} 
          className="glass-card p-4 flex items-center justify-between cursor-pointer hover:border-brand-500/50 hover:shadow-md transition-all hover:-translate-y-0.5"
          title="Click to drill down to Fee Schedules & Billing"
        >
          <div>
            <span className="text-[11px] font-mono text-muted uppercase">Base Currency</span>
            <div className="text-xl font-bold font-display text-ink mt-0.5">USD (US$)</div>
            <span className="text-[10px] text-muted">Primary billing denomination • Click to drill down →</span>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-brand-100 text-brand-700">1.00</span>
        </div>

        <div 
          onClick={() => navigate('/fees')} 
          className="glass-card p-4 flex items-center justify-between cursor-pointer hover:border-brand-500/50 hover:shadow-md transition-all hover:-translate-y-0.5"
          title="Click to drill down to Multi-Currency Rates & Fees"
        >
          <div>
            <span className="text-[11px] font-mono text-muted uppercase">Zimbabwe Gold (ZiG)</span>
            <div className="text-xl font-bold font-display text-ink mt-0.5">ZiG 26.85</div>
            <span className="text-[10px] text-muted">RBZ Interbank Weighted Rate • Drill down →</span>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-amber-100 text-accent">Active</span>
        </div>

        <div 
          onClick={() => navigate('/fees')} 
          className="glass-card p-4 flex items-center justify-between cursor-pointer hover:border-brand-500/50 hover:shadow-md transition-all hover:-translate-y-0.5"
          title="Click to drill down to Multi-Currency Rates & Fees"
        >
          <div>
            <span className="text-[11px] font-mono text-muted uppercase">South African Rand</span>
            <div className="text-xl font-bold font-display text-ink mt-0.5">ZAR 18.40</div>
            <span className="text-[10px] text-muted">Cross-rate spot conversion • Drill down →</span>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-blue-100 text-info">Active</span>
        </div>
      </div>

      {/* Primary Visuals: Method Donut & Debtors List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Method Donut */}
        <Card
          title="Collections by Payment Method"
          subtitle="Distribution of receipts across payment channels"
        >
          {methodChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {methodChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={METHOD_COLORS[index % METHOD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [money(val), 'Collected']}
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Skeleton variant="chart" />
          )}
        </Card>

        {/* Top 10 Debtors */}
        <Card
          title="Top Accounts in Arrears"
          subtitle="Highest outstanding balances requiring bursary follow-up"
          action={
            <button
              onClick={() => navigate('/fees?tab=debtors')}
              className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
            >
              All Debtors →
            </button>
          }
          className="lg:col-span-2"
        >
          {topDebtors && topDebtors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-muted uppercase text-[11px]">
                    <th className="py-2.5 text-left">Student</th>
                    <th className="py-2.5 text-left">Class</th>
                    <th className="py-2.5 text-right">Balance Due</th>
                    <th className="py-2.5 text-right">Days Overdue</th>
                    <th className="py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {topDebtors.slice(0, 6).map((d) => (
                    <tr key={d.student_id} className="hover:bg-canvas/40 transition-colors">
                      <td className="py-2.5">
                        <div className="font-semibold text-ink">{d.student_name}</div>
                        <div className="text-[10px] text-muted font-mono">{d.admission_number}</div>
                      </td>
                      <td className="py-2.5 text-muted">{d.class_name}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-danger">
                        {money(d.balance_due)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="font-mono px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-danger">
                          {d.days_overdue || 45}d
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          onClick={() => navigate(`/fees?studentId=${d.student_id}`)}
                          className="px-2.5 py-1 rounded-lg bg-surface border border-line text-ink font-semibold hover:border-brand-500 transition-colors cursor-pointer"
                        >
                          Collect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No outstanding debtors" description="All accounts are currently in good standing." compact={true} />
          )}
        </Card>
      </div>
    </div>
  );
}
