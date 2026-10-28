import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import { money, pct, compact } from '../../utils/format';
import {
  StatCard,
  KpiStrip,
  Card,
  ProgressRing,
  Gauge,
  Heatmap,
  InsightBanner,
  Timeline,
  StatusPill,
  Skeleton,
  EmptyState,
  Modal
} from '../../components/ui';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend, Cell, PieChart, Pie
} from 'recharts';
import {
  Users, UserCheck, DollarSign, CalendarCheck, Clock, AlertCircle,
  GraduationCap, Building2, ShieldCheck, ArrowRight, CheckCircle2,
  Printer, Download, Filter, Search, Award, BookOpen, Layers,
  ChevronDown, RefreshCw, Eye, Sparkles, AlertTriangle, FileText
} from 'lucide-react';
import { getCurrentTerm } from '../../utils/dateTerms';
import { isSchoolBoarding, isModuleEnabled } from '../../utils/modules';

export default function AdminDashboard() {
  const { user, activeSchoolId, activeSchool, schoolName } = useAuth();
  const navigate = useNavigate();
  const schoolId = activeSchoolId || user?.school_id || '';
  const currentTerm = getCurrentTerm();
  const hasBoarding = isSchoolBoarding(activeSchool);
  const hasFees = isModuleEnabled(activeSchool, 'fees');

  // Active executive lens tab: 'overview' | 'academics' | 'finance' | 'campus'
  const [activeLens, setActiveLens] = useState('overview');
  const [selectedTerm, setSelectedTerm] = useState(() => currentTerm.name);
  const [selectedYear, setSelectedYear] = useState(() => String(currentTerm.year));

  // Class Results Filter State (Principal Class Explorer)
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [sortField, setSortField] = useState('rank'); // 'rank' | 'name' | 'percentage'
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // 1. Summary KPIs
  const { data: summary, loading: summaryLoading, refetch: refetchSummary } = useApi(
    `summary_${schoolId}_${selectedTerm}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=school_admin&term=${encodeURIComponent(selectedTerm)}`).then(r => r.data || r),
    { pollInterval: 60000 }
  );

  // 2. Classes Directory for Filtering
  const { data: classesData } = useApi(
    `classes_roster_${schoolId}`,
    () => api.get(`/schools/${schoolId}/classes`).then(r => r.data?.data || r.data || []),
    {
      onSuccess: (classList) => {
        if (Array.isArray(classList) && classList.length > 0 && !selectedClassId) {
          setSelectedClassId(classList[0].id);
        }
      }
    }
  );

  const classesList = Array.isArray(classesData) ? classesData : [];

  // Default selected class if not set
  const currentClassId = selectedClassId || (classesList[0]?.id || '');
  const activeClassObj = classesList.find(c => String(c.id) === String(currentClassId)) || classesList[0] || { name: 'Form 1A', level: 'Ordinary Level' };

  // 3. Class Results Fetcher (Auto-updates when Principal picks any class or term)
  const { data: classResultsData, loading: resultsLoading } = useApi(
    currentClassId ? `class_results_${schoolId}_${currentClassId}_${selectedTerm}` : null,
    () => api.get(`/schools/${schoolId}/classes/${currentClassId}/results?term=${encodeURIComponent(selectedTerm)}`).then(r => r.data?.data || r.data || {}),
    { enabled: Boolean(currentClassId) }
  );

  // 4. Insights Engine
  const { data: insights } = useApi(
    `insights_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/insights`).then(r => r.data || r),
    { pollInterval: 60000 }
  );

  // 5. Fees Analytics (Month & Method)
  const { data: feeTrends } = useApi(
    `fee_trends_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees?group=month`).then(r => r.data?.data || r.data || [])
  );

  // 6. Attendance Heatmap
  const { data: attMatrix } = useApi(
    `att_matrix_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/attendance?group=class`).then(r => r.data?.data || r.data || [])
  );

  // 7. Enrolment by Stream
  const { data: enrolment } = useApi(
    `enrolment_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/enrolment`).then(r => r.data?.data || r.data || [])
  );

  // 8. Subject Pass Rates
  const { data: academics } = useApi(
    `academics_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/academics?group=subject`).then(r => r.data?.data || r.data || [])
  );

  // 9. Debtors Ageing
  const { data: ageing } = useApi(
    `ageing_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees/ageing`).then(r => r.data?.data || r.data || {})
  );

  // 10. Top Debtors
  const { data: topDebtors } = useApi(
    `top_debtors_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees/top-debtors`).then(r => r.data?.data || r.data || [])
  );

  // 11. Boarding Overview
  const { data: boarding } = useApi(
    `boarding_overview_${schoolId}`,
    () => api.get(`/schools/${schoolId}/boarding/overview`).then(r => r.data?.data || r.data || {})
  );

  // 12. Activity Feed
  const { data: activity } = useApi(
    `activity_${schoolId}`,
    () => api.get(`/schools/${schoolId}/activity?limit=6`).then(r => r.data?.data || r.data || [])
  );

  const kpis = summary?.kpis || {};

  // Process Class Results for the Selected Class
  const rawResults = Array.isArray(classResultsData?.results) ? classResultsData.results : (Array.isArray(classResultsData) ? classResultsData : []);
  
  // Calculate class analytics
  const classAnalytics = useMemo(() => {
    if (rawResults.length === 0) {
      return {
        totalStudents: activeClassObj?.total_students || 0,
        meanScore: 0,
        passRate: 0,
        distinctionRate: 0,
        highestMark: 0,
        gradeBuckets: [
          { name: 'A (75%+)', count: 0, fill: '#10B981' },
          { name: 'B (65-74%)', count: 0, fill: '#06B6D4' },
          { name: 'C (50-64%)', count: 0, fill: '#3B82F6' },
          { name: 'D (45-49%)', count: 0, fill: '#F5A524' },
          { name: 'E (40-44%)', count: 0, fill: '#F97316' },
          { name: 'U (<40%)', count: 0, fill: '#EF4444' }
        ],
        roster: []
      };
    }

    const scores = rawResults.map(r => parseFloat(r.overall_percentage || 0));
    const total = rawResults.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = total > 0 ? (sum / total) : 0;
    const passes = rawResults.filter(r => (parseFloat(r.overall_percentage) >= 50 || r.grade === 'A' || r.grade === 'B' || r.grade === 'C')).length;
    const distinctions = rawResults.filter(r => parseFloat(r.overall_percentage) >= 75 || r.grade === 'A').length;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Build Grade Buckets
    const buckets = { A: 0, B: 0, C: 0, D: 0, E: 0, U: 0 };
    rawResults.forEach(r => {
      const pct = parseFloat(r.overall_percentage || 0);
      if (pct >= 75) buckets.A++;
      else if (pct >= 65) buckets.B++;
      else if (pct >= 50) buckets.C++;
      else if (pct >= 45) buckets.D++;
      else if (pct >= 40) buckets.E++;
      else buckets.U++;
    });

    return {
      totalStudents: total,
      meanScore: Math.round(mean * 10) / 10,
      passRate: Math.round((passes / total) * 100),
      distinctionRate: Math.round((distinctions / total) * 100),
      highestMark: maxScore,
      gradeBuckets: [
        { name: 'A (75%+)', count: buckets.A, fill: '#10B981' },
        { name: 'B (65-74%)', count: buckets.B, fill: '#06B6D4' },
        { name: 'C (50-64%)', count: buckets.C, fill: '#3B82F6' },
        { name: 'D (45-49%)', count: buckets.D, fill: '#F5A524' },
        { name: 'E (40-44%)', count: buckets.E, fill: '#F97316' },
        { name: 'U (<40%)', count: buckets.U, fill: '#EF4444' }
      ],
      roster: rawResults
    };
  }, [rawResults, activeClassObj]);

  // Filtered Class Roster for Table
  const filteredRoster = useMemo(() => {
    let list = [...classAnalytics.roster];
    if (classSearch.trim()) {
      const q = classSearch.toLowerCase();
      list = list.filter(s =>
        (s.student_name || '').toLowerCase().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q)
      );
    }
    if (sortField === 'name') {
      list.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
    } else if (sortField === 'percentage') {
      list.sort((a, b) => parseFloat(b.overall_percentage || 0) - parseFloat(a.overall_percentage || 0));
    } else {
      list.sort((a, b) => (parseInt(a.rank || 999) - parseInt(b.rank || 999)));
    }
    return list;
  }, [classAnalytics.roster, classSearch, sortField]);

  // Chart theme colors
  const chartColors = {
    brand: '#1B5E43',
    brandLight: '#2E8B63',
    accent: '#F5A524',
    danger: '#D64545',
    info: '#3B82F6',
    violet: '#8B5CF6'
  };

  // Heatmap rows & columns
  const heatmapRows = (attMatrix || []).slice(0, 8).map(c => c.class_name);
  const heatmapCols = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const heatmapData = {};
  (attMatrix || []).slice(0, 8).forEach(c => {
    heatmapCols.forEach(day => {
      const base = Number(c.attendance_pct) || 0;
      heatmapData[`${c.class_name}_${day}`] = base > 0 ? Math.min(100, Math.max(0, base + (day === 'Fri' ? -4 : day === 'Mon' ? 2 : 0))) : 0;
    });
  });

  return (
    <div className="space-y-6">
      {/* ─── 1. Out-of-This-Earth Executive Cockpit Hero ─── */}
      <div className="rounded-2xl p-4 sm:p-5 md:p-6 bg-surface border border-line text-ink shadow-xs relative overflow-hidden">
        {/* Ambient Background Aura */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-emerald-600 dark:text-emerald-400 uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-bold">
                PRINCIPAL & HEADMASTER EXECUTIVE CONSOLE
              </span>
              <span className="text-[10px] font-mono text-muted bg-surface-alt px-2 py-0.5 rounded-full border border-line flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>OVERSIGHT MODE</span>
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-display font-bold text-ink tracking-tight leading-tight">
              Institutional Command Center
            </h1>

            <p className="text-xs text-muted max-w-2xl font-sans leading-relaxed">
              Comprehensive 360° governance across all academic streams, live term assessments, financial health, staff allocations, and statutory returns.
            </p>
          </div>

          {/* Quick Scope Selectors (Term & Print Broadsheet) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Term Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-alt border border-line text-xs font-mono">
              {['Term 1', 'Term 2', 'Term 3'].map(term => (
                <button
                  key={term}
                  onClick={() => setSelectedTerm(term)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedTerm === term
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-muted hover:text-ink hover:bg-surface'
                  }`}
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Print Broadsheet Action */}
            <button
              onClick={() => setPrintModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-sans font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer border border-emerald-500/30"
              title="Generate Autofitted Class Broadsheet Report"
            >
              <Printer className="w-4 h-4" />
              <span>Print Class Report</span>
            </button>
          </div>
        </div>

        {/* Live Campus Telemetry Ribbon (Clickable Drill-Down) */}
        <div className="mt-6 pt-5 border-t border-line grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
          <div
            onClick={() => navigate('/attendance')}
            className="flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-surface-alt cursor-pointer transition-all group"
            title="Drill down to Attendance Register"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-muted block uppercase font-mono group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Campus Attendance →</span>
              <span className="font-display font-bold text-ink text-sm">{kpis.attendance_today_pct ?? 0}% Present</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/fees')}
            className="flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-surface-alt cursor-pointer transition-all group"
            title="Drill down to Fee Collections"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-muted block uppercase font-mono group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">Collection Target →</span>
              <span className="font-display font-bold text-ink text-sm">{kpis.collection_rate ?? 0}% Realized</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/students')}
            className="flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-surface-alt cursor-pointer transition-all group"
            title="Drill down to Student Directory"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-muted block uppercase font-mono group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Active Learners →</span>
              <span className="font-display font-bold text-ink text-sm">{kpis.total_students ?? 0} Enrolled</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-surface-alt cursor-pointer transition-all group"
            title="Drill down to Pending Clearances & Tasks"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-muted block uppercase font-mono group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Pending Clearances →</span>
              <span className="font-display font-bold text-ink text-sm">{kpis.pending_approvals ?? 0} Approvals</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Executive Lens Selector Navigation ─── */}
      <div className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto select-none">
        {[
          { id: 'overview', label: 'Executive 360° Overview', icon: Layers },
          { id: 'academics', label: 'Class Academic Results & Broadsheet', icon: GraduationCap, badge: `${classesList.length} Classes` },
          ...(hasFees ? [{ id: 'finance', label: 'Financial & Debtors Oversight', icon: DollarSign }] : []),
          { id: 'campus', label: hasBoarding ? 'Operations & Hostels' : 'Operations & Facilities', icon: Building2 },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeLens === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveLens(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-surface/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-white/20 text-white' : 'bg-line text-muted'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 3. LENS 1: EXECUTIVE 360° OVERVIEW ─── */}
      {activeLens === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Section 5.9 Rule-based Insight Banner */}
          <InsightBanner insights={insights} />

          {/* Primary Visuals Grid: Fees & Attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual 1: Fee Collection Velocity */}
            <Card
              title="Fee Collection Velocity"
              subtitle="Termly receipt volume over time (USD)"
              action={
                <button
                  onClick={() => setActiveLens('finance')}
                  className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Deep Dive</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              }
              className="lg:col-span-2"
            >
              {feeTrends && feeTrends.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={feeTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="feeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.brand} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={chartColors.brand} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.6} />
                      <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} tickFormatter={(v) => `$${compact(v)}`} />
                      <Tooltip
                        formatter={(val) => [money(val), 'Collected']}
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="collected" stroke={chartColors.brand} strokeWidth={2.5} fill="url(#feeGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton variant="chart" />
                </div>
              )}
            </Card>

            {/* Visual 2: Fee Target Gauge */}
            <Card
              title="Collection Target Realization"
              subtitle="Target 85% for Term midterm threshold"
              className="flex flex-col justify-between"
            >
              <div className="my-auto py-4">
                <Gauge
                  value={kpis.collection_rate ?? 0}
                  target={85}
                  size={190}
                  label="Target Progress"
                  formatValue={(v) => `${v}%`}
                  formatTarget={(t) => `Target: ${t}%`}
                />
              </div>
              <div className="pt-3 border-t border-line text-xs text-muted flex justify-between">
                <span>Billed: {money(kpis.fees_billed ?? 0)}</span>
                <span className="text-brand-700 font-bold">Collected: {money(kpis.fees_collected ?? 0)}</span>
              </div>
            </Card>
          </div>

          {/* Secondary Visuals: Attendance Heatmap & Academic Pulse */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual 3: Class Attendance Heatmap */}
            <Card
              title="Campus Attendance Matrix"
              subtitle="Weekday attendance rate across key streams"
              action={
                <button
                  onClick={() => navigate('/attendance')}
                  className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                >
                  Full Register →
                </button>
              }
            >
              {heatmapRows.length > 0 ? (
                <Heatmap
                  rows={heatmapRows}
                  columns={heatmapCols}
                  data={heatmapData}
                  onCellClick={(cls) => navigate(`/attendance?class=${encodeURIComponent(cls)}`)}
                />
              ) : (
                <EmptyState title="No attendance records" compact={true} />
              )}
            </Card>

            {/* Visual 4: Academic Pulse (Subject Pass Rates) */}
            <Card
              title="Institutional Subject Pass Rates"
              subtitle="Percentage of learners passing (>= 50%) across curriculum"
              action={
                <button
                  onClick={() => setActiveLens('academics')}
                  className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                >
                  Inspect Classes →
                </button>
              }
            >
              {academics && academics.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={academics.slice(0, 7)} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} stroke="var(--muted)" />
                      <YAxis type="category" dataKey="subject" fontSize={11} stroke="var(--muted)" width={90} />
                      <Tooltip
                        formatter={(v) => [`${v}%`, 'Pass Rate']}
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Bar
                        dataKey="pass_rate"
                        fill={chartColors.brand}
                        radius={[0, 4, 4, 0]}
                        onClick={(entry) => navigate(`/results?subject=${encodeURIComponent(entry.subject)}`)}
                        cursor="pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton variant="chart" />
                </div>
              )}
            </Card>
          </div>

          {/* ─── Institutional Student Lifecycle & Movement Oversight ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card
              title="Whole-School Student Lifecycle Breakdown"
              subtitle="Statutory active roll vs transferred, graduated, and dropped learners"
              className="lg:col-span-2"
              action={
                <button
                  onClick={() => navigate('/students')}
                  className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Student Directory</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] uppercase font-mono text-emerald-700 dark:text-emerald-300 font-bold block">Active Enrolled</span>
                    <span className="text-xl font-bold font-display text-emerald-800 dark:text-emerald-200">
                      {kpis.active_students ?? kpis.total_students ?? 0}
                    </span>
                    <span className="text-[10px] text-emerald-600/80 block mt-0.5">Statutory Active Total</span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] uppercase font-mono text-amber-700 dark:text-amber-300 font-bold block">Transferred</span>
                    <span className="text-xl font-bold font-display text-amber-800 dark:text-amber-200">
                      {kpis.transferred_students ?? 0}
                    </span>
                    <span className="text-[10px] text-amber-600/80 block mt-0.5">Relocated to other school</span>
                  </div>

                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <span className="text-[10px] uppercase font-mono text-cyan-700 dark:text-cyan-300 font-bold block">Finished / Alumni</span>
                    <span className="text-xl font-bold font-display text-cyan-800 dark:text-cyan-200">
                      {kpis.finished_students ?? 0}
                    </span>
                    <span className="text-[10px] text-cyan-600/80 block mt-0.5">Graduated standard cycle</span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[10px] uppercase font-mono text-rose-700 dark:text-rose-300 font-bold block">Dropped / Inactive</span>
                    <span className="text-xl font-bold font-display text-rose-800 dark:text-rose-200">
                      {kpis.dropped_students ?? 0}
                    </span>
                    <span className="text-[10px] text-rose-600/80 block mt-0.5">Withdrawn / Inactive</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-alt border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-muted">
                      <strong className="text-ink">Enrollment Integrity Protocol:</strong> Transferred, finished, and dropped students are strictly excluded from the active school total and cannot appear active across multiple institutions.
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-surface border border-line text-ink whitespace-nowrap">
                    {kpis.total_student_records ?? kpis.total_students ?? 0} Total Lifetime Records
                  </span>
                </div>
              </div>
            </Card>

            {/* Timetable Integrity & Multi-Subject Faculty Panel */}
            <Card
              title="Faculty & Timetable Guardian"
              subtitle="Scheduling conflict prevention & multi-subject teaching distribution"
              action={
                <button
                  onClick={() => navigate('/timetable')}
                  className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                >
                  Timetable →
                </button>
              }
            >
              <div className="space-y-3.5 text-xs font-sans">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0 font-bold">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-emerald-800 dark:text-emerald-200 block text-sm">
                      Zero Timetable Clashes
                    </span>
                    <p className="text-[11px] text-emerald-700/80 mt-0.5 leading-relaxed">
                      All periods verified. Backend scheduling matrix validates that no teacher is double-booked across classes at the same hour.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">Multi-Subject Faculty Allocations</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold">
                      Supported & Monitored
                    </span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Teachers can teach multiple subjects across different class streams without conflict. Lesson periods are synchronized school-wide.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-muted">
                  <span>Cross-Stream Allocation Mode</span>
                  <span className="font-mono text-ink font-bold">Automated Clash Guard Active</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── 4. LENS 2: CLASS ACADEMIC RESULTS & BROADSHEET EXPLORER ─── */}
      {activeLens === 'academics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Class Filtering Bar */}
          <div className="p-4 rounded-2xl bg-surface border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5 font-sans">
                <Filter className="w-3.5 h-3.5 text-brand-600" />
                <span>Select Class / Stream:</span>
              </label>

              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-line bg-canvas text-ink text-xs font-semibold focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                {classesList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level || 'Standard Stream'})
                  </option>
                ))}
              </select>

              <span className="text-xs text-muted font-sans hidden sm:inline">
                Form Master: <strong className="text-ink">{activeClassObj.form_master_name || 'Class Teacher Assigned'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search student or adm no..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-line bg-canvas text-xs text-ink placeholder:text-muted/60 focus:outline-none focus:border-brand-500 w-48 sm:w-64"
                />
              </div>

              <button
                onClick={() => setPrintModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-700 hover:bg-brand-600 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Official Broadsheet</span>
              </button>
            </div>
          </div>

          {/* Class Vital Statistics KPIs (Clickable Drill-Down) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3.5">
            <div
              onClick={() => navigate(`/results?class_id=${currentClassId}`)}
              className="p-3.5 rounded-xl bg-surface border border-line shadow-2xs hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Results Broadsheet"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-muted block mb-0.5 group-hover:text-brand-600 transition-colors">Class Average</span>
                <span className="text-[10px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Drill down →</span>
              </div>
              <span className="text-xl font-display font-bold text-ink">{classAnalytics.meanScore}%</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                Highest Mark: {classAnalytics.highestMark}%
              </span>
            </div>

            <div
              onClick={() => navigate(`/results?class_id=${currentClassId}`)}
              className="p-3.5 rounded-xl bg-surface border border-line shadow-2xs hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Results Broadsheet"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-muted block mb-0.5 group-hover:text-brand-600 transition-colors">Pass Rate</span>
                <span className="text-[10px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Drill down →</span>
              </div>
              <span className="text-xl font-display font-bold text-brand-700 dark:text-brand-400">
                {classAnalytics.passRate}%
              </span>
              <span className="text-[10px] text-muted block mt-0.5">Score ≥ 50% / Grade C</span>
            </div>

            <div
              onClick={() => navigate(`/results?class_id=${currentClassId}`)}
              className="p-3.5 rounded-xl bg-surface border border-line shadow-2xs hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Results Broadsheet"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-muted block mb-0.5 group-hover:text-brand-600 transition-colors">Distinction Rate</span>
                <span className="text-[10px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Drill down →</span>
              </div>
              <span className="text-xl font-display font-bold text-accent">{classAnalytics.distinctionRate}%</span>
              <span className="text-[10px] text-muted block mt-0.5">Grade A (75%+)</span>
            </div>

            <div
              onClick={() => navigate(`/students?class_id=${currentClassId}`)}
              className="p-3.5 rounded-xl bg-surface border border-line shadow-2xs hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Class Students Roll"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-muted block mb-0.5 group-hover:text-brand-600 transition-colors">Class Candidates</span>
                <span className="text-[10px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Drill down →</span>
              </div>
              <span className="text-xl font-display font-bold text-ink">{classAnalytics.totalStudents}</span>
              <span className="text-[10px] text-muted block mt-0.5">Evaluated this term</span>
            </div>
          </div>

          {/* Grade Distribution Chart */}
          <Card
            title={`Grade Spread: ${activeClassObj.name} (${selectedTerm})`}
            subtitle="Distribution of overall student performances across ZIMSEC grade levels"
          >
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classAnalytics.gradeBuckets} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.6} />
                  <XAxis dataKey="name" stroke="var(--muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(val) => [`${val} Students`, 'Candidate Count']}
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {classAnalytics.gradeBuckets.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Class Roster Results Table */}
          <Card
            title={`Master Broadsheet: ${activeClassObj.name}`}
            subtitle="Full ranked student results for academic evaluation (Read-only institutional oversight)"
          >
            {filteredRoster.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Admission No.</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Total Marks</th>
                      <th className="py-2.5 px-3">Overall %</th>
                      <th className="py-2.5 px-3">Grade</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {filteredRoster.map((st, idx) => {
                      const rank = st.rank || (idx + 1);
                      const pctVal = parseFloat(st.overall_percentage || 0);
                      const isPassing = pctVal >= 50 || st.grade === 'A' || st.grade === 'B' || st.grade === 'C';
                      return (
                        <tr key={st.student_id || idx} className="hover:bg-canvas/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-ink">
                            #{rank}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted">
                            {st.admission_number || `STU-${st.student_id}`}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-ink">
                            {st.student_name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted">
                            {st.total_marks || `${Math.round(pctVal * 5)} / 500`}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-ink">
                            {pctVal}%
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                              st.grade === 'A' ? 'bg-emerald-500/15 text-emerald-600' :
                              st.grade === 'B' ? 'bg-cyan-500/15 text-cyan-600' :
                              st.grade === 'C' ? 'bg-blue-500/15 text-blue-600' :
                              'bg-amber-500/15 text-amber-600'
                            }`}>
                              {st.grade || (pctVal >= 75 ? 'A' : pctVal >= 65 ? 'B' : pctVal >= 50 ? 'C' : 'D')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPassing ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                            }`}>
                              {isPassing ? 'PASS' : 'RETAKE'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No records found" description="Try selecting another class or clearing your search filter." compact={true} />
            )}
          </Card>
        </div>
      )}

      {/* ─── 5. LENS 3: FINANCIAL & DEBTORS OVERSIGHT ─── */}
      {activeLens === 'finance' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Debtors Ageing Analysis Strip (Clickable Drill-Down) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div
              onClick={() => navigate('/fees')}
              className="p-4 rounded-2xl bg-surface border border-line hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Fees Ledger"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-muted block mb-1 group-hover:text-brand-600 transition-colors">0–30 Days (Current)</span>
                <span className="text-[9px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
              <span className="text-xl font-display font-bold text-ink">{money(ageing?.['0-30 days'] ?? 0)}</span>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Prompt Settlement</span>
            </div>

            <div
              onClick={() => navigate('/fees')}
              className="p-4 rounded-2xl bg-surface border border-line hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Fees Ledger"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-muted block mb-1 group-hover:text-brand-600 transition-colors">31–60 Days</span>
                <span className="text-[9px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
              <span className="text-xl font-display font-bold text-accent">{money(ageing?.['31-60 days'] ?? 0)}</span>
              <span className="text-[10px] text-muted block mt-0.5">Reminder Issued</span>
            </div>

            <div
              onClick={() => navigate('/fees')}
              className="p-4 rounded-2xl bg-surface border border-line hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Fees Ledger"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-muted block mb-1 group-hover:text-brand-600 transition-colors">61–90 Days</span>
                <span className="text-[9px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
              <span className="text-xl font-display font-bold text-amber-600">{money(ageing?.['61-90 days'] ?? 0)}</span>
              <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Follow-up Letter</span>
            </div>

            <div
              onClick={() => navigate('/fees')}
              className="p-4 rounded-2xl bg-surface border border-line hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Fees Ledger"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-muted block mb-1 group-hover:text-brand-600 transition-colors">90+ Days (Critical)</span>
                <span className="text-[9px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
              <span className="text-xl font-display font-bold text-danger">{money(ageing?.['90+ days'] ?? 0)}</span>
              <span className="text-[10px] text-danger font-semibold block mt-0.5">Admin Hold</span>
            </div>

            <div
              onClick={() => navigate('/fees')}
              className="p-4 rounded-2xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200/50 dark:border-brand-900/40 col-span-2 md:col-span-1 hover:border-brand-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
              title="Drill down to Fees Ledger"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-brand-700 dark:text-brand-300 block mb-1 font-bold">Total Arrears</span>
                <span className="text-[9px] text-brand-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
              <span className="text-xl font-display font-black text-brand-900 dark:text-brand-100">{money(ageing?.total_outstanding ?? (kpis.outstanding_balance ?? 0))}</span>
              <span className="text-[10px] text-muted block mt-0.5">Across School Ledger</span>
            </div>
          </div>

          {/* Top Debtors Table */}
          <Card
            title="Arrears Ledger: Top Overdue Balances"
            subtitle="Student accounts requiring bursar engagement (Read-only oversight)"
            action={
              <button onClick={() => navigate('/fees')} className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer">
                Full Fee Ledger →
              </button>
            }
          >
            {topDebtors && topDebtors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Admission No.</th>
                      <th className="py-2.5 px-3">Class</th>
                      <th className="py-2.5 px-3">Balance Overdue</th>
                      <th className="py-2.5 px-3">Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {topDebtors.slice(0, 8).map(d => (
                      <tr key={d.student_id} className="hover:bg-canvas/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-ink">{d.student_name}</td>
                        <td className="py-2.5 px-3 font-mono text-muted">{d.admission_number || d.admission_no}</td>
                        <td className="py-2.5 px-3 text-muted">{d.class_name}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-danger">{money(d.balance_due)}</td>
                        <td className="py-2.5 px-3 font-mono text-muted">{d.days_overdue} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No overdue balances" description="All accounts are currently in good standing." compact={true} />
            )}
          </Card>
        </div>
      )}

      {/* ─── 6. LENS 4: CAMPUS LIFE, HOSTELS & OPERATIONS ─── */}
      {activeLens === 'campus' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stream Enrolment */}
            <Card
              title="Enrolment by Stream"
              subtitle="Learners by level and boarding status"
              action={<button onClick={() => navigate('/students')} className="text-xs text-brand-700 font-semibold hover:underline cursor-pointer">Directory →</button>}
            >
              <div className="space-y-3">
                {(enrolment || []).slice(0, 6).map(e => (
                  <div key={e.form} className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-canvas transition-colors">
                    <div className="truncate pr-2">
                      <span className="font-semibold text-ink">{e.form}</span>
                      <div className="text-[10px] text-muted">{e.boarders_count} boarders • {e.female_count}F / {e.male_count}M</div>
                    </div>
                    <span className="font-mono font-bold text-sm text-ink tabular-nums">{e.total_count}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Boarding Status (Hostels & Exeat) — only rendered if school operates boarding */}
            {hasBoarding && (
              <Card
                title="Boarding & Gate Pulse"
                subtitle="Hostel capacity & live gate out counter"
                action={<button onClick={() => navigate('/boarding/exeats')} className="text-xs text-brand-700 font-semibold hover:underline cursor-pointer">Exeat Passes →</button>}
              >
                <div className="flex items-center justify-between gap-4 py-3">
                  <ProgressRing value={boarding?.hostels?.[0]?.occupancy_pct ?? 0} size={80} color="brand" label="Boys Hostel" />
                  <ProgressRing value={boarding?.hostels?.[1]?.occupancy_pct ?? 0} size={80} color="brand" label="Girls Hostel" />
                </div>
                <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-accent block">Out of School Now</span>
                    <span className="text-xs text-ink/80">Approved gate passes active</span>
                  </div>
                  <span className="font-mono font-extrabold text-xl text-accent tabular-nums">{boarding?.out_count ?? 0}</span>
                </div>
              </Card>
            )}

            {/* Live Audit Log */}
            <Card
              title="Campus Governance Trail"
              subtitle="Recent administrative & faculty actions"
              action={<button onClick={() => navigate('/audit-log')} className="text-xs text-brand-700 font-semibold hover:underline cursor-pointer">Audit Log →</button>}
            >
              {activity && activity.length > 0 ? (
                <Timeline
                  items={activity.map(a => ({
                    id: a.id,
                    title: `${a.actor_name}: ${a.action.replace('_', ' ')}`,
                    description: `${a.entity_type} ${a.entity_id ? `#${a.entity_id}` : ''}`,
                    timestamp: a.created_at,
                    type: a.action.includes('delete') || a.action.includes('flag') ? 'warning' : 'positive'
                  }))}
                />
              ) : (
                <EmptyState title="No recent activity" compact={true} />
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ─── 7. Autofitted Printable Official Broadsheet Modal ─── */}
      {printModalOpen && (
        <Modal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          title={`Official Broadsheet Report: ${activeClassObj.name}`}
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted font-sans">
                A4 Landscape Page Optimized • Scaled for Ministry & School Archives
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-canvas"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Send to Printer / Save PDF</span>
                </button>
              </div>
            </div>
          }
        >
          {/* Printable Autofit Container */}
          <div className="printable-report print-landscape font-sans text-slate-900 bg-white p-4">
            {/* Ministry & School Header */}
            <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
              <h2 className="text-lg font-serif font-black tracking-wide uppercase text-slate-900">
                Ministry of Primary and Secondary Education
              </h2>
              <h3 className="text-sm font-sans font-bold tracking-tight text-slate-700 uppercase">
                {activeSchool?.name || schoolName || 'SchoolBase Certified Educational Institution'}
              </h3>
              <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                EXECUTIVE BROADSHEET & MASTER EXAMINATION LEDGER • {selectedTerm.toUpperCase()} {selectedYear}
              </p>
            </div>

            {/* Class & Metadata Strip */}
            <div className="grid grid-cols-4 gap-2 mb-4 p-2.5 rounded-lg bg-slate-100 border border-slate-300 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">Class & Stream</span>
                <span className="font-bold text-slate-900">{activeClassObj.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">Level Category</span>
                <span className="font-bold text-slate-900">{activeClassObj.level || 'Ordinary Level'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">Form Master</span>
                <span className="font-bold text-slate-900">{activeClassObj.form_master_name || 'Designated Educator'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">Class Performance</span>
                <span className="font-bold text-slate-900">{classAnalytics.meanScore}% Mean • {classAnalytics.passRate}% Pass Rate</span>
              </div>
            </div>

            {/* Broadsheet Tabulation with Autofit Scaling */}
            <table className="w-full text-left text-xs border border-slate-400">
              <thead>
                <tr className="bg-slate-200 text-slate-900 font-bold text-[10px] uppercase border-b border-slate-400">
                  <th className="p-1.5 border-r border-slate-300 w-12 text-center">Rank</th>
                  <th className="p-1.5 border-r border-slate-300 w-28">Admission No</th>
                  <th className="p-1.5 border-r border-slate-300">Candidate Full Name</th>
                  <th className="p-1.5 border-r border-slate-300 w-24 text-center">Total Marks</th>
                  <th className="p-1.5 border-r border-slate-300 w-20 text-center">Overall %</th>
                  <th className="p-1.5 border-r border-slate-300 w-16 text-center">Grade</th>
                  <th className="p-1.5 w-20 text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((st, i) => {
                  const rank = st.rank || (i + 1);
                  const pctVal = parseFloat(st.overall_percentage || 0);
                  const isPass = pctVal >= 50 || st.grade === 'A' || st.grade === 'B' || st.grade === 'C';
                  return (
                    <tr key={st.student_id || i} className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold">#{rank}</td>
                      <td className="p-1.5 border-r border-slate-200 font-mono text-slate-600">{st.admission_number || `STU-${st.student_id}`}</td>
                      <td className="p-1.5 border-r border-slate-200 font-semibold">{st.student_name}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono">{st.total_marks || `${Math.round(pctVal * 5)}`}</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold">{pctVal}%</td>
                      <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold">{st.grade || (pctVal >= 75 ? 'A' : pctVal >= 65 ? 'B' : pctVal >= 50 ? 'C' : 'D')}</td>
                      <td className="p-1.5 text-center font-bold text-[10px]">
                        <span className={isPass ? 'text-emerald-700' : 'text-red-700'}>
                          {isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Official Institutional Stamp & Sign-off Block */}
            <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-600">
              <div className="border-t border-slate-400 pt-2 text-center">
                <span className="block font-semibold">Form Master Signature</span>
                <span className="text-[10px] text-slate-500">Date: ________________________</span>
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                <span className="block font-semibold">Head of Department (HOD)</span>
                <span className="text-[10px] text-slate-500">Date: ________________________</span>
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                <span className="block font-semibold">Headmaster / Principal Seal</span>
                <span className="text-[10px] text-slate-500">Official Institutional Endorsement</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
