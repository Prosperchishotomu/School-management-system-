import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../utils/api';
import { ThreeDIcon } from '../ui/ThreeDIcon';
import { ThreeDBarChart } from '../ui/ThreeDBarChart';
import { ThreeDFlipCard } from '../ui/ThreeDFlipCard';
import {
  Calculator,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
  DollarSign,
  BookOpen,
  FlaskConical,
  Briefcase,
  Palette,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  PieChart as PieIcon,
  ChevronRight,
  ShieldAlert,
  GraduationCap
} from 'lucide-react';

export const DynamicFeeEngine = ({ schoolId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('live'); // 'live' | 'simulator'

  // Simulator inputs
  const [simParams, setSimParams] = useState({
    infant_count: 24,
    infant_rate: 180,
    junior_count: 27,
    junior_rate: 260,
    ordinary_count: 56,
    ordinary_rate: 380,
    advanced_arts_count: 20,
    advanced_com_count: 20,
    advanced_sci_count: 20,
    advanced_rate: 460,
    boarding_count: 44,
    boarding_rate: 550,
    sda_rate: 30,
    csc_enrolled: 100,
    csc_fee: 40,
    sci_lab_enrolled: 40,
    sci_lab_fee: 35,
    art_enrolled: 58,
    art_fee: 25,
  });

  const fetchCalculatorData = async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/schools/${schoolId}/fees/calculator`);
      const payload = res.data?.data;
      setData(payload);

      if (payload) {
        // Pre-populate simulator with live numbers
        const pInfant = payload.phases?.find(p => p.phase === 'infant');
        const pJunior = payload.phases?.find(p => p.phase === 'junior');
        const pOrd = payload.phases?.find(p => p.phase === 'ordinary');
        const pAdv = payload.phases?.find(p => p.phase === 'advanced');

        setSimParams(prev => ({
          ...prev,
          infant_count: pInfant?.student_count ?? 24,
          infant_rate: pInfant?.rate_per_student ?? 180,
          junior_count: pJunior?.student_count ?? 27,
          junior_rate: pJunior?.rate_per_student ?? 260,
          ordinary_count: pOrd?.student_count ?? 56,
          ordinary_rate: pOrd?.rate_per_student ?? 380,
          advanced_arts_count: payload.alevel_breakdown?.streams?.ARTS?.count ?? 20,
          advanced_com_count: payload.alevel_breakdown?.streams?.COMMERCIAL?.count ?? 20,
          advanced_sci_count: payload.alevel_breakdown?.streams?.SCIENCES?.count ?? 20,
          advanced_rate: pAdv?.rate_per_student ?? 460,
          boarding_count: payload.summary?.boarding_students ?? 44,
          boarding_rate: payload.rates_applied?.boarding_fee ?? 550,
          sda_rate: payload.rates_applied?.sda_levy ?? 30,
        }));
      }
    } catch (err) {
      console.error('Failed to load dynamic fees calculation:', err);
      setError('Unable to load real-time fee calculation from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalculatorData();
  }, [schoolId]);

  // Client-side simulation calculations based on sliders
  const simCalculations = useMemo(() => {
    const nInfant = Number(simParams.infant_count) || 0;
    const nJunior = Number(simParams.junior_count) || 0;
    const nOrd = Number(simParams.ordinary_count) || 0;
    const nArts = Number(simParams.advanced_arts_count) || 0;
    const nCom = Number(simParams.advanced_com_count) || 0;
    const nSci = Number(simParams.advanced_sci_count) || 0;
    const nAdv = nArts + nCom + nSci;
    const totalStudents = nInfant + nJunior + nOrd + nAdv;

    const infantRev = nInfant * (Number(simParams.infant_rate) || 0);
    const juniorRev = nJunior * (Number(simParams.junior_rate) || 0);
    const ordRev = nOrd * (Number(simParams.ordinary_rate) || 0);
    const advRev = nAdv * (Number(simParams.advanced_rate) || 0);
    const tuitionRev = infantRev + juniorRev + ordRev + advRev;

    const boardingRev = (Number(simParams.boarding_count) || 0) * (Number(simParams.boarding_rate) || 0);
    const sdaRev = totalStudents * (Number(simParams.sda_rate) || 0);

    const cscRev = (Number(simParams.csc_enrolled) || 0) * (Number(simParams.csc_fee) || 0);
    const sciLabRev = (Number(simParams.sci_lab_enrolled) || 0) * (Number(simParams.sci_lab_fee) || 0);
    const artRev = (Number(simParams.art_enrolled) || 0) * (Number(simParams.art_fee) || 0);
    const subjectFeesRev = cscRev + sciLabRev + artRev;

    const grandTotal = tuitionRev + boardingRev + sdaRev + subjectFeesRev;
    const avgFee = totalStudents > 0 ? Math.round(grandTotal / totalStudents) : 0;

    return {
      totalStudents,
      nAdv,
      tuitionRev,
      infantRev,
      juniorRev,
      ordRev,
      advRev,
      boardingRev,
      sdaRev,
      subjectFeesRev,
      grandTotal,
      avgFee
    };
  }, [simParams]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center space-y-4 min-h-[300px]">
        <div className="animate-spin text-teal-primary">
          <RefreshCw className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold text-ink/70">Connecting to dynamic fees calculation engine...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card rounded-2xl p-8 border border-brick-critical/30 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-brick-critical" />
          <p className="text-sm text-brick-critical font-medium">{error || 'Data unavailable'}</p>
        </div>
        <button
          onClick={fetchCalculatorData}
          className="px-4 py-2 bg-teal-primary text-white rounded-xl text-xs font-bold hover:bg-teal-dark transition-all cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, phases, alevel_breakdown, charged_subjects } = data;

  // Chart data for 3D Bar Charts
  const phaseEnrollmentChartData = phases.map(p => ({
    label: p.phase === 'infant' ? 'ECD' : p.phase === 'junior' ? 'Primary' : p.phase === 'ordinary' ? 'O-Level' : 'A-Level',
    sublabel: `${p.student_count} pupils`,
    value: p.student_count,
    color: p.phase === 'infant' ? '#F43F5E' : p.phase === 'junior' ? '#10B981' : p.phase === 'ordinary' ? '#3B82F6' : '#8B5CF6',
    topColor: p.phase === 'infant' ? '#FDA4AF' : p.phase === 'junior' ? '#6EE7B7' : p.phase === 'ordinary' ? '#93C5FD' : '#C4B5FD',
    sideColor: p.phase === 'infant' ? '#BE123C' : p.phase === 'junior' ? '#047857' : p.phase === 'ordinary' ? '#1D4ED8' : '#6D28D9',
  }));

  const streamEnrollmentChartData = [
    {
      label: 'ARTS',
      sublabel: `${alevel_breakdown?.streams?.ARTS?.count || 0} Students`,
      value: alevel_breakdown?.streams?.ARTS?.count || 0,
      color: '#F59E0B',
      topColor: '#FDE68A',
      sideColor: '#B45309',
    },
    {
      label: 'COMMERCIAL',
      sublabel: `${alevel_breakdown?.streams?.COMMERCIAL?.count || 0} Students`,
      value: alevel_breakdown?.streams?.COMMERCIAL?.count || 0,
      color: '#10B981',
      topColor: '#6EE7B7',
      sideColor: '#047857',
    },
    {
      label: 'SCIENCES',
      sublabel: `${alevel_breakdown?.streams?.SCIENCES?.count || 0} Students`,
      value: alevel_breakdown?.streams?.SCIENCES?.count || 0,
      color: '#06B6D4',
      topColor: '#A5F3FC',
      sideColor: '#0E7490',
    }
  ];

  const revenueBreakdownChartData = [
    {
      label: 'Tuition',
      sublabel: 'Phased base',
      value: summary?.projected_tuition_revenue || 0,
      color: '#6366F1',
      topColor: '#A5B4FC',
      sideColor: '#4338CA',
    },
    {
      label: 'Boarding',
      sublabel: `${summary?.boarding_students || 0} Boarders`,
      value: summary?.projected_boarding_revenue || 0,
      color: '#3B82F6',
      topColor: '#93C5FD',
      sideColor: '#1D4ED8',
    },
    {
      label: 'Subject Levies',
      sublabel: 'Science/Lab/Art',
      value: summary?.projected_subject_fees || 0,
      color: '#10B981',
      topColor: '#6EE7B7',
      sideColor: '#047857',
    },
    {
      label: 'SDA Levy',
      sublabel: 'Development',
      value: summary?.projected_sda_levy || 0,
      color: '#F59E0B',
      topColor: '#FDE68A',
      sideColor: '#B45309',
    }
  ];

  return (
    <div className="w-full space-y-6 page-flip-enter">
      {/* ─── Header & Mode Switcher ────────────────────────────────────────── */}
      <div className="glass-card rounded-3xl p-6 shadow-xl border border-line-border/60 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-teal-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <ThreeDIcon name="calculator" size={56} animate={true} />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl md:text-2xl font-display font-extrabold text-ink">
                  Dynamic School Fee Engine
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-primary/10 text-teal-primary border border-teal-primary/20">
                  Live DB Synchronized
                </span>
              </div>
              <p className="text-xs text-ink/60 mt-1 max-w-2xl font-sans">
                Dynamic automated fee computation based on student numbers across ECD, Primary, O-Level, and A-Level tiers (Arts, Commercials, Sciences) with specialized school-charged practical levies.
              </p>
            </div>
          </div>

          {/* Toggle Live vs Simulator */}
          <div className="flex items-center p-1.5 rounded-2xl bg-sage/60 border border-line-border/50 shadow-inner">
            <button
              onClick={() => setMode('live')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                mode === 'live'
                  ? 'bg-surface text-teal-primary shadow-md border border-line-border/40'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              <PieIcon className="w-4 h-4" />
              <span>Live Ledger & Breakdown</span>
            </button>
            <button
              onClick={() => setMode('simulator')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
                mode === 'simulator'
                  ? 'bg-teal-primary text-white shadow-md'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>What-If Simulator</span>
            </button>
          </div>
        </div>
      </div>

      {mode === 'live' ? (
        <>
          {/* ─── Top 3D Interactive KPI Cards with Flips ─────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Projected Revenue */}
            <ThreeDFlipCard
              minHeight="150px"
              frontContent={
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-sans text-ink/50 uppercase tracking-wider">
                      Projected Revenue
                    </span>
                    <h3 className="text-2xl font-display font-extrabold text-ink mt-1">
                      ${(summary?.projected_total_revenue || 0).toLocaleString()}
                    </h3>
                    <p className="text-[11px] text-teal-primary font-semibold mt-1 flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{summary?.total_students} Enrolled Pupils</span>
                    </p>
                  </div>
                  <ThreeDIcon name="fees" size={44} animate={true} />
                </div>
              }
              backContent={
                <div className="space-y-1.5 text-xs">
                  <p className="font-bold text-ink text-[11px] uppercase tracking-wider border-b border-line-border/40 pb-1">
                    Revenue Breakdown
                  </p>
                  <div className="flex justify-between text-ink/70">
                    <span>Base Tuition:</span>
                    <span className="font-mono font-bold">${summary?.projected_tuition_revenue?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>Subject Levies:</span>
                    <span className="font-mono font-bold text-teal-primary">${summary?.projected_subject_fees?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>Boarding Levy:</span>
                    <span className="font-mono font-bold">${summary?.projected_boarding_revenue?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>SDA Levy:</span>
                    <span className="font-mono font-bold">${summary?.projected_sda_levy?.toLocaleString()}</span>
                  </div>
                </div>
              }
            />

            {/* Card 2: Actual Fee Collection Rate */}
            <ThreeDFlipCard
              minHeight="150px"
              frontContent={
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-sans text-ink/50 uppercase tracking-wider">
                      Collection Rate
                    </span>
                    <h3 className="text-2xl font-display font-extrabold text-ink mt-1">
                      {summary?.collection_rate_pct}%
                    </h3>
                    <div className="w-28 h-2 rounded-full bg-sage mt-2 overflow-hidden">
                      <div
                        className="h-full bg-teal-primary rounded-full transition-all duration-1000"
                        style={{ width: `${summary?.collection_rate_pct}%` }}
                      />
                    </div>
                  </div>
                  <ThreeDIcon name="analytics" size={44} animate={false} />
                </div>
              }
              backContent={
                <div className="space-y-1.5 text-xs">
                  <p className="font-bold text-ink text-[11px] uppercase tracking-wider border-b border-line-border/40 pb-1">
                    Collection Ledger
                  </p>
                  <div className="flex justify-between text-ink/70">
                    <span>Actual Billed:</span>
                    <span className="font-mono font-bold">${summary?.actual_billed?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Collected:</span>
                    <span className="font-mono">${summary?.actual_collected?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-brick-critical font-bold">
                    <span>Outstanding:</span>
                    <span className="font-mono">${summary?.actual_outstanding?.toLocaleString()}</span>
                  </div>
                </div>
              }
            />

            {/* Card 3: Phase Tier Rates */}
            <ThreeDFlipCard
              minHeight="150px"
              frontContent={
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-sans text-ink/50 uppercase tracking-wider">
                      Phase Tier Tuition
                    </span>
                    <h3 className="text-xl font-display font-extrabold text-ink mt-1">
                      $180 – $460
                    </h3>
                    <p className="text-[11px] text-ink/60 mt-1">
                      Varies: ECD, Prim, O & A
                    </p>
                  </div>
                  <ThreeDIcon name="alevel" size={44} animate={true} />
                </div>
              }
              backContent={
                <div className="space-y-1.5 text-xs">
                  <p className="font-bold text-ink text-[11px] uppercase tracking-wider border-b border-line-border/40 pb-1">
                    Standard Phase Rates
                  </p>
                  <div className="flex justify-between text-ink/70">
                    <span>ECD (Infant):</span>
                    <span className="font-mono font-bold">$180/term</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>Primary (Grades 1-7):</span>
                    <span className="font-mono font-bold">$260/term</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>O-Level (Forms 1-4):</span>
                    <span className="font-mono font-bold">$380/term</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>A-Level (Forms 5-6):</span>
                    <span className="font-mono font-bold text-teal-primary">$460/term</span>
                  </div>
                </div>
              }
            />

            {/* Card 4: Subject Practical Levies */}
            <ThreeDFlipCard
              minHeight="150px"
              frontContent={
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-sans text-ink/50 uppercase tracking-wider">
                      School Charged Subjects
                    </span>
                    <h3 className="text-2xl font-display font-extrabold text-ink mt-1">
                      ${summary?.projected_subject_fees?.toLocaleString()}
                    </h3>
                    <p className="text-[11px] text-teal-primary font-semibold mt-1">
                      {charged_subjects?.length || 0} Special Charged Subjects
                    </p>
                  </div>
                  <ThreeDIcon name="sciences" size={44} animate={true} />
                </div>
              }
              backContent={
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-ink text-[11px] uppercase tracking-wider border-b border-line-border/40 pb-1">
                    Top Subject Levies
                  </p>
                  {charged_subjects?.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex justify-between text-ink/70 text-[11px]">
                      <span className="truncate pr-1">{s.name}:</span>
                      <span className="font-mono font-bold text-teal-primary">${s.fee}</span>
                    </div>
                  ))}
                </div>
              }
            />
          </div>

          {/* ─── 3D Visual Charts Section: Bars & Distributions ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 3D Bar Chart 1: Enrollment by Phase */}
            <div className="glass-card rounded-3xl p-6 shadow-lg border border-line-border/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <ThreeDIcon name="students" size={32} animate={false} />
                  <div>
                    <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                      Pupils by Educational Phase
                    </h3>
                    <p className="text-xs text-ink/50">ECD, Primary, O-Level, A-Level</p>
                  </div>
                </div>
                <ThreeDBarChart
                  data={phaseEnrollmentChartData}
                  height={180}
                  barWidth={38}
                />
              </div>
            </div>

            {/* 3D Bar Chart 2: A-Level Specialization Breakdown */}
            <div className="glass-card rounded-3xl p-6 shadow-lg border border-line-border/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <ThreeDIcon name="alevel" size={32} animate={false} />
                  <div>
                    <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                      A-Level Streams (60 Students)
                    </h3>
                    <p className="text-xs text-ink/50">Arts, Commercials, Sciences</p>
                  </div>
                </div>
                <ThreeDBarChart
                  data={streamEnrollmentChartData}
                  height={180}
                  barWidth={46}
                />
              </div>
            </div>

            {/* 3D Bar Chart 3: Revenue Streams Breakdown */}
            <div className="glass-card rounded-3xl p-6 shadow-lg border border-line-border/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <ThreeDIcon name="fees" size={32} animate={false} />
                  <div>
                    <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                      Revenue Stream Composition
                    </h3>
                    <p className="text-xs text-ink/50">Tuition, Boarding, Labs, SDA</p>
                  </div>
                </div>
                <ThreeDBarChart
                  data={revenueBreakdownChartData}
                  height={180}
                  barWidth={38}
                  currency={true}
                />
              </div>
            </div>
          </div>

          {/* ─── Educational Phase Breakdown Cards ───────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-extrabold text-ink flex items-center space-x-2">
                <Layers className="w-5 h-5 text-teal-primary" />
                <span>Phase Fee Schedule (Varying by Grade & Educational Level)</span>
              </h3>
              <span className="text-xs text-ink/50 font-medium">4 Core Educational Phases</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {phases.map((p, idx) => {
                const iconMap = { infant: 'ecd', junior: 'primary', ordinary: 'olevel', advanced: 'alevel' };
                return (
                  <div
                    key={idx}
                    className="glass-card rounded-2xl p-5 border border-line-border/50 hover:border-teal-primary/40 transition-all threed-card"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">
                          Phase Tier {idx + 1}
                        </span>
                        <h4 className="text-base font-bold text-ink mt-0.5">{p.label}</h4>
                      </div>
                      <ThreeDIcon name={iconMap[p.phase] || 'students'} size={40} animate={true} />
                    </div>

                    <div className="mt-4 pt-3 border-t border-line-border/30 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-ink/70">
                        <span>Enrolled Pupils:</span>
                        <span className="font-mono font-bold text-ink">{p.student_count}</span>
                      </div>
                      <div className="flex justify-between items-center text-ink/70">
                        <span>Boarding Pupils:</span>
                        <span className="font-mono font-bold text-teal-primary">{p.boarding_count}</span>
                      </div>
                      <div className="flex justify-between items-center text-ink/70">
                        <span>Tuition Rate:</span>
                        <span className="font-mono font-bold text-amber-600">${p.rate_per_student}/term</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-line-border/30 font-bold text-ink">
                        <span>Phase Total:</span>
                        <span className="font-mono text-teal-primary">${p.projected_tuition?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── A-Level Categorization & Multi-Subject Matrix ──────────────── */}
          <div className="glass-card rounded-3xl p-6 shadow-xl border border-line-border/60 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-border/40 pb-4">
              <div>
                <h3 className="text-lg font-display font-extrabold text-ink flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5 text-teal-primary" />
                  <span>A-Level Streams Matrix (ARTS, COMMERCIAL, SCIENCES)</span>
                </h3>
                <p className="text-xs text-ink/60 mt-0.5">
                  Full ZIMSEC Curriculum support. Students can take 3, 4, 5, or 6 subjects across specialized pathways.
                </p>
              </div>

              {/* Multi-subject distribution badge */}
              <div className="flex items-center space-x-2 bg-sage/60 px-3 py-1.5 rounded-xl border border-line-border/50 text-xs">
                <span className="font-bold text-ink">Multi-Subject Load:</span>
                <span className="px-2 py-0.5 rounded-md bg-teal-primary/10 text-teal-primary font-mono font-bold">
                  {alevel_breakdown?.distribution?.taking_4} taking 4/5 subs
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 font-mono font-bold">
                  {alevel_breakdown?.distribution?.taking_5_plus} taking 5+ subs
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Stream 1: ARTS */}
              <div className="glass-panel rounded-2xl p-5 border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ThreeDIcon name="arts" size={42} animate={true} />
                    <div>
                      <h4 className="font-extrabold text-ink text-sm">ARTS STREAM</h4>
                      <p className="text-[11px] text-amber-600 font-semibold">
                        {alevel_breakdown?.streams?.ARTS?.count} Active Students
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
                    Humanities
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-ink/70 pt-2 border-t border-amber-500/20">
                  <p className="font-semibold text-ink text-[11px]">Core & Elective Subjects:</p>
                  <p className="text-[11px] leading-relaxed text-ink/60">
                    Literature in English, History, Divinity, Art & Design, French, Shona, General Paper.
                  </p>
                  <div className="flex items-center justify-between pt-2 text-[10px] text-amber-700 font-semibold">
                    <span>Taking 4 subjects: {alevel_breakdown?.streams?.ARTS?.taking_4}</span>
                    <span>Taking 5+ subjects: {alevel_breakdown?.streams?.ARTS?.taking_5_plus}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-500/20">
                  <p className="text-[10px] font-bold text-ink/50 uppercase">Sample Candidates:</p>
                  <div className="space-y-1 mt-1">
                    {alevel_breakdown?.streams?.ARTS?.sample_students?.slice(0, 3).map((st, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] bg-surface/60 p-1.5 rounded-lg border border-line-border/30">
                        <span className="font-semibold text-ink">{st.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 font-bold">
                          {st.subject_count} Subjects
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stream 2: COMMERCIAL */}
              <div className="glass-panel rounded-2xl p-5 border border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ThreeDIcon name="commercial" size={42} animate={true} />
                    <div>
                      <h4 className="font-extrabold text-ink text-sm">COMMERCIAL STREAM</h4>
                      <p className="text-[11px] text-emerald-600 font-semibold">
                        {alevel_breakdown?.streams?.COMMERCIAL?.count} Active Students
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                    Business
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-ink/70 pt-2 border-t border-emerald-500/20">
                  <p className="font-semibold text-ink text-[11px]">Core & Elective Subjects:</p>
                  <p className="text-[11px] leading-relaxed text-ink/60">
                    Accounting, Business Studies, Economics, Computer Science, Mathematics, General Paper.
                  </p>
                  <div className="flex items-center justify-between pt-2 text-[10px] text-emerald-700 font-semibold">
                    <span>Taking 4 subjects: {alevel_breakdown?.streams?.COMMERCIAL?.taking_4}</span>
                    <span>Taking 5+ subjects: {alevel_breakdown?.streams?.COMMERCIAL?.taking_5_plus}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-500/20">
                  <p className="text-[10px] font-bold text-ink/50 uppercase">Sample Candidates:</p>
                  <div className="space-y-1 mt-1">
                    {alevel_breakdown?.streams?.COMMERCIAL?.sample_students?.slice(0, 3).map((st, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] bg-surface/60 p-1.5 rounded-lg border border-line-border/30">
                        <span className="font-semibold text-ink">{st.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-bold">
                          {st.subject_count} Subjects
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stream 3: SCIENCES */}
              <div className="glass-panel rounded-2xl p-5 border border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-transparent space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ThreeDIcon name="sciences" size={42} animate={true} />
                    <div>
                      <h4 className="font-extrabold text-ink text-sm">SCIENCES STREAM</h4>
                      <p className="text-[11px] text-cyan-600 font-semibold">
                        {alevel_breakdown?.streams?.SCIENCES?.count} Active Students
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700">
                    STEM
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-ink/70 pt-2 border-t border-cyan-500/20">
                  <p className="font-semibold text-ink text-[11px]">Core & Elective Subjects:</p>
                  <p className="text-[11px] leading-relaxed text-ink/60">
                    Pure Mathematics, Physics, Chemistry, Biology, Computer Science, General Paper.
                  </p>
                  <div className="flex items-center justify-between pt-2 text-[10px] text-cyan-700 font-semibold">
                    <span>Taking 4 subjects: {alevel_breakdown?.streams?.SCIENCES?.taking_4}</span>
                    <span>Taking 5+ subjects: {alevel_breakdown?.streams?.SCIENCES?.taking_5_plus}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-cyan-500/20">
                  <p className="text-[10px] font-bold text-ink/50 uppercase">Sample Candidates:</p>
                  <div className="space-y-1 mt-1">
                    {alevel_breakdown?.streams?.SCIENCES?.sample_students?.slice(0, 3).map((st, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] bg-surface/60 p-1.5 rounded-lg border border-line-border/30">
                        <span className="font-semibold text-ink">{st.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 font-bold">
                          {st.subject_count} Subjects
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── School-Charged Specialized Subject Levies Table ─────────────── */}
          <div className="glass-card rounded-3xl p-6 shadow-xl border border-line-border/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-border/40 pb-3">
              <div>
                <h3 className="text-base font-display font-extrabold text-ink flex items-center space-x-2">
                  <FlaskConical className="w-5 h-5 text-teal-primary" />
                  <span>Specialized School-Charged Subjects & Practical Levies</span>
                </h3>
                <p className="text-xs text-ink/60 mt-0.5">
                  Lab supplies, software licenses, art consumables, and specialist workshop surcharges automatically levied upon student enrollment.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink/50">Total Subject Revenue:</span>
                <p className="text-base font-extrabold text-teal-primary font-mono">
                  ${summary?.projected_subject_fees?.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line-border/40 text-[10px] uppercase font-bold text-ink/50">
                    <th className="py-2.5 px-3">Subject / Practical Area</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Applicable Level</th>
                    <th className="py-2.5 px-3 text-right">Fee Per Pupil</th>
                    <th className="py-2.5 px-3 text-right">Enrolled Students</th>
                    <th className="py-2.5 px-3 text-right">Total Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border/30">
                  {charged_subjects?.map((s, idx) => (
                    <tr key={idx} className="hover:bg-sage/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-ink flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-lg bg-teal-primary/10 flex items-center justify-center text-[10px] font-bold text-teal-primary font-mono">
                          {s.code || s.id}
                        </span>
                        <span>{s.name}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          s.category === 'sciences' ? 'bg-cyan-500/10 text-cyan-600' :
                          s.category === 'commercials' ? 'bg-emerald-500/10 text-emerald-600' :
                          'bg-amber-500/10 text-amber-600'
                        }`}>
                          {s.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-ink/60 uppercase text-[10px] font-medium">
                        {s.level || 'All Phases'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                        ${Number(s.fee).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-teal-primary">
                        {s.enrolled_students}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-ink">
                        ${Number(s.total_subject_revenue).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ─── What-If Simulator Mode ───────────────────────────────────────── */
        <div className="glass-card rounded-3xl p-6 shadow-2xl border border-line-border/60 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-line-border/40 pb-4">
            <div>
              <h3 className="text-lg font-display font-extrabold text-ink flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-teal-primary" />
                <span>Interactive Student & Phase Fee Simulator</span>
              </h3>
              <p className="text-xs text-ink/60 mt-1">
                Simulate how changes in student enrollment across ECD, Primary, O-Level, A-Level streams and subject practical fees impact institutional budget projections.
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Simulated Total Revenue</span>
              <h2 className="text-3xl font-display font-extrabold text-teal-primary font-mono">
                ${simCalculations.grandTotal.toLocaleString()}
              </h2>
              <span className="text-[10px] text-ink/60">
                Avg per pupil: ${simCalculations.avgFee} | {simCalculations.totalStudents} pupils
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Controls */}
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-2">
                <Users className="w-4 h-4 text-teal-primary" />
                <span>Pupil Enrollment by Phase & Rates</span>
              </h4>

              {/* ECD Controls */}
              <div className="p-4 rounded-2xl bg-surface/70 border border-line-border/50 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <ThreeDIcon name="ecd" size={28} animate={false} />
                    <span className="text-xs font-bold text-ink">Early Childhood Development (ECD)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-500">
                    {simParams.infant_count} pupils @ ${simParams.infant_rate} = ${(simCalculations.infantRev).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Pupils Count: {simParams.infant_count}</label>
                    <input
                      type="range" min="0" max="200" step="1"
                      value={simParams.infant_count}
                      onChange={e => setSimParams({ ...simParams, infant_count: Number(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Tuition Rate ($): {simParams.infant_rate}</label>
                    <input
                      type="range" min="50" max="500" step="10"
                      value={simParams.infant_rate}
                      onChange={e => setSimParams({ ...simParams, infant_rate: Number(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Primary Controls */}
              <div className="p-4 rounded-2xl bg-surface/70 border border-line-border/50 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <ThreeDIcon name="primary" size={28} animate={false} />
                    <span className="text-xs font-bold text-ink">Primary School (Grades 1-7)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600">
                    {simParams.junior_count} pupils @ ${simParams.junior_rate} = ${(simCalculations.juniorRev).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Pupils Count: {simParams.junior_count}</label>
                    <input
                      type="range" min="0" max="500" step="5"
                      value={simParams.junior_count}
                      onChange={e => setSimParams({ ...simParams, junior_count: Number(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Tuition Rate ($): {simParams.junior_rate}</label>
                    <input
                      type="range" min="100" max="800" step="10"
                      value={simParams.junior_rate}
                      onChange={e => setSimParams({ ...simParams, junior_rate: Number(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* O-Level Controls */}
              <div className="p-4 rounded-2xl bg-surface/70 border border-line-border/50 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <ThreeDIcon name="olevel" size={28} animate={false} />
                    <span className="text-xs font-bold text-ink">O-Level (Forms 1-4)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-600">
                    {simParams.ordinary_count} pupils @ ${simParams.ordinary_rate} = ${(simCalculations.ordRev).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Pupils Count: {simParams.ordinary_count}</label>
                    <input
                      type="range" min="0" max="500" step="5"
                      value={simParams.ordinary_count}
                      onChange={e => setSimParams({ ...simParams, ordinary_count: Number(e.target.value) })}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Tuition Rate ($): {simParams.ordinary_rate}</label>
                    <input
                      type="range" min="150" max="1000" step="10"
                      value={simParams.ordinary_rate}
                      onChange={e => setSimParams({ ...simParams, ordinary_rate: Number(e.target.value) })}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* A-Level Stream Controls */}
              <div className="p-4 rounded-2xl bg-surface/70 border border-line-border/50 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <ThreeDIcon name="alevel" size={28} animate={false} />
                    <span className="text-xs font-bold text-ink">A-Level Streams (Forms 5-6)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-600">
                    {simCalculations.nAdv} pupils @ ${simParams.advanced_rate} = ${(simCalculations.advRev).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-amber-600 font-semibold">Arts: {simParams.advanced_arts_count}</label>
                    <input
                      type="range" min="0" max="150" step="2"
                      value={simParams.advanced_arts_count}
                      onChange={e => setSimParams({ ...simParams, advanced_arts_count: Number(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-600 font-semibold">Com: {simParams.advanced_com_count}</label>
                    <input
                      type="range" min="0" max="150" step="2"
                      value={simParams.advanced_com_count}
                      onChange={e => setSimParams({ ...simParams, advanced_com_count: Number(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-600 font-semibold">Sci: {simParams.advanced_sci_count}</label>
                    <input
                      type="range" min="0" max="150" step="2"
                      value={simParams.advanced_sci_count}
                      onChange={e => setSimParams({ ...simParams, advanced_sci_count: Number(e.target.value) })}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Ancillary Levies Controls */}
              <div className="p-4 rounded-2xl bg-surface/70 border border-line-border/50 space-y-3">
                <span className="text-xs font-bold text-ink">Boarding & Subject Levies</span>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Boarders: {simParams.boarding_count}</label>
                    <input
                      type="range" min="0" max="200" step="2"
                      value={simParams.boarding_count}
                      onChange={e => setSimParams({ ...simParams, boarding_count: Number(e.target.value) })}
                      className="w-full accent-teal-primary cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">Boarding Fee: ${simParams.boarding_rate}</label>
                    <input
                      type="range" min="200" max="1200" step="25"
                      value={simParams.boarding_rate}
                      onChange={e => setSimParams({ ...simParams, boarding_rate: Number(e.target.value) })}
                      className="w-full accent-teal-primary cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink/50 font-semibold">SDA Levy: ${simParams.sda_rate}</label>
                    <input
                      type="range" min="10" max="100" step="5"
                      value={simParams.sda_rate}
                      onChange={e => setSimParams({ ...simParams, sda_rate: Number(e.target.value) })}
                      className="w-full accent-teal-primary cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Simulation Results & 3D Visualizer */}
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-teal-primary" />
                <span>Simulated Revenue Breakdown</span>
              </h4>

              {/* 3D Bar Representation of Simulation */}
              <div className="glass-panel p-5 rounded-2xl border border-line-border/50">
                <ThreeDBarChart
                  data={[
                    {
                      label: 'ECD',
                      sublabel: `${simParams.infant_count} pupils`,
                      value: simCalculations.infantRev,
                      color: '#F43F5E',
                      topColor: '#FDA4AF',
                      sideColor: '#BE123C',
                    },
                    {
                      label: 'Primary',
                      sublabel: `${simParams.junior_count} pupils`,
                      value: simCalculations.juniorRev,
                      color: '#10B981',
                      topColor: '#6EE7B7',
                      sideColor: '#047857',
                    },
                    {
                      label: 'O-Level',
                      sublabel: `${simParams.ordinary_count} pupils`,
                      value: simCalculations.ordRev,
                      color: '#3B82F6',
                      topColor: '#93C5FD',
                      sideColor: '#1D4ED8',
                    },
                    {
                      label: 'A-Level',
                      sublabel: `${simCalculations.nAdv} pupils`,
                      value: simCalculations.advRev,
                      color: '#8B5CF6',
                      topColor: '#C4B5FD',
                      sideColor: '#6D28D9',
                    },
                    {
                      label: 'Boarding',
                      sublabel: `${simParams.boarding_count} boarders`,
                      value: simCalculations.boardingRev,
                      color: '#06B6D4',
                      topColor: '#A5F3FC',
                      sideColor: '#0E7490',
                    }
                  ]}
                  height={190}
                  barWidth={36}
                  currency={true}
                />
              </div>

              {/* Consolidated Summary Table */}
              <div className="glass-panel rounded-2xl p-5 border border-line-border/50 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-ink/70">
                  <span>Total Base Tuition:</span>
                  <span className="font-mono font-bold text-ink">${simCalculations.tuitionRev.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-ink/70">
                  <span>Specialized Subject Levies:</span>
                  <span className="font-mono font-bold text-teal-primary">${simCalculations.subjectFeesRev.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-ink/70">
                  <span>Boarding Services:</span>
                  <span className="font-mono font-bold text-blue-600">${simCalculations.boardingRev.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-ink/70">
                  <span>School Development Association (SDA):</span>
                  <span className="font-mono font-bold text-amber-600">${simCalculations.sdaRev.toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t border-line-border/40 flex justify-between items-center font-extrabold text-base text-ink">
                  <span>Grand Total Projected Revenue:</span>
                  <span className="font-mono text-teal-primary text-xl">${simCalculations.grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicFeeEngine;
