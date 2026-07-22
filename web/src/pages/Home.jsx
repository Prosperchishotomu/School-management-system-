import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, BookOpen, Users, DollarSign, Calendar, Activity, 
  ChevronRight, LayoutDashboard, ArrowRight, X, LogIn, Loader2, 
  AlertCircle, GraduationCap, Sparkles, Zap, Wifi, Building2, 
  TrendingUp, CheckCircle2, Globe, Award, Lock, Smartphone, FileText, Bot
} from 'lucide-react';

const Home = ({ preOpenLogin = false }) => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [showLogin, setShowLogin] = useState(preOpenLogin);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState(null);
  const [activeCurriculumTab, setActiveCurriculumTab] = useState('primary'); // 'primary' | 'secondary'

  const sessionExpired = searchParams.get('expired') === '1';

  useEffect(() => {
    if (preOpenLogin || searchParams.get('login') === '1') {
      setShowLogin(true);
    }
  }, [preOpenLogin, searchParams]);

  const handleCta = () => {
    if (user) {
      navigate(user.role === 'super_admin' ? '/admin/command-center' : '/dashboard');
    } else {
      setShowLogin(true);
    }
  };

  const handleDemoSelect = (demoUsername, demoPassword, roleLabel) => {
    setUsername(demoUsername);
    setPassword(demoPassword);
    setSelectedDemoRole(roleLabel);
    setError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      setShowLogin(false);
      const savedUser = JSON.parse(sessionStorage.getItem('schoolbase_user') || '{}');
      if (savedUser.role === 'super_admin') {
        navigate('/admin/command-center', { replace: true });
      } else if (savedUser.role === 'school_admin') {
        navigate('/school-admin/dashboard', { replace: true });
      } else if (savedUser.role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true });
      } else {
        navigate('/parent/dashboard', { replace: true });
      }
    } else {
      setError(result.error || 'Invalid credentials. Please try again.');
    }
  };

  const features = [
    {
      icon: GraduationCap,
      color: 'text-teal-primary bg-teal-primary/10 border-teal-primary/20',
      title: 'ZIMSEC & Cambridge Academic Engine',
      description: 'Supports Primary Grade 1–7 (6 to 54 Aggregate Units), O-Level best 5 passes, and A-Level Form 5–6 (1 to 15 Points across 3 subjects).'
    },
    {
      icon: DollarSign,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      title: 'Paynow & EcoCash Automated Gateway',
      description: 'Real-time online payment initiation, instant EcoCash IPN webhooks, automated receipt QR seals, and multi-currency (USD / ZiG) ledgers.'
    },
    {
      icon: Bot,
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
      title: 'AI Data Science & At-Risk Engine',
      description: 'Multi-variable predictive machine learning model calculating student at-risk scores (0–100%) and Pearson Subject Correlation matrices.'
    },
    {
      icon: Building2,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      title: 'Hostels & Staff Quarters Housing',
      description: 'Manage boarding dormitories, room & bed space allocations for students, residential staff quarters, and weekend exeat passes.'
    },
    {
      icon: Wifi,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      title: 'Starlink & ZESA OpEx Accounting',
      description: 'Track operational overheads (Starlink satellite internet, ZESA electricity tokens, generator diesel fuel) with live P&L Net Margin calculations.'
    },
    {
      icon: Smartphone,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      title: 'Parent SMS Alerts & WhatsApp Bot',
      description: 'Instant notification dispatches to guardians for daily attendance, fee balances, discipline incidents, and published report cards.'
    }
  ];

  const stats = [
    { label: 'System Uptime SLA', value: '99.98%', highlight: 'Enterprise Rated' },
    { label: 'ZIMSEC & Cambridge Rules', value: '100% Native', highlight: 'Units & Points' },
    { label: 'Payment Gateway Latency', value: '< 2.4s', highlight: 'Paynow & EcoCash' },
    { label: 'Tenant Security Standard', value: 'Isolated', highlight: 'Multi-Tenant RBAC' }
  ];

  return (
    <div className="min-h-screen bg-paper text-ink overflow-hidden font-sans relative">
      {/* Decorative ambient background lighting */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-30 border-b border-line-border/30 backdrop-blur-md bg-white/80 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-primary/15 flex items-center justify-center border border-teal-primary/30 shadow-md">
              <Shield className="w-5.5 h-5.5 text-teal-primary" />
            </div>
            <div>
              <span className="text-2xl font-display font-bold text-ink tracking-tight">
                School<span className="text-teal-primary">Base</span>
              </span>
              <span className="ml-2 text-[9px] font-mono font-bold text-teal-dark bg-sage/30 px-2 py-0.5 rounded-full border border-teal-primary/20 uppercase">
                SaaS Enterprise v2.5
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowLogin(true)}
              className="px-5 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-semibold rounded-xl shadow-lg hover:shadow-teal-primary/25 transition-all cursor-pointer flex items-center space-x-2"
            >
              {user ? (
                <>
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Enter Portal</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Client Login &amp; Demo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-16 pb-24 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Hero Left Column */}
        <div className="lg:col-span-7 space-y-6 text-left animate-fadeIn">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-teal-primary/10 border border-teal-primary/25 text-teal-dark text-[11px] font-bold uppercase tracking-wider rounded-full shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-teal-primary" />
            <span>Next-Generation Multi-Tenant School OS</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-ink leading-[1.1] tracking-tight">
            The Intelligent Operating System for <span className="text-teal-primary underline decoration-teal-primary/30 decoration-wavy">African &amp; Global Schools</span>
          </h1>

          <p className="text-sm md:text-base text-ink/70 leading-relaxed font-sans max-w-2xl">
            Unifying ZIMSEC &amp; Cambridge Grading, Paynow &amp; EcoCash Mobile Payments, AI Predictive Analytics, Hostels &amp; Staff Quarters, and Starlink &amp; ZESA Operational Accounting into a single high-performance cloud platform.
          </p>

          <div className="pt-4 flex flex-wrap gap-4 items-center">
            <button
              onClick={handleCta}
              className="px-7 py-4 bg-teal-primary hover:bg-teal-dark text-paper font-bold text-sm rounded-2xl shadow-xl hover:shadow-teal-primary/30 transition-all flex items-center space-x-2 cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>{user ? 'Open School Cockpit' : 'Launch Interactive Demo'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#curriculum-engine"
              className="px-6 py-4 bg-white hover:bg-sage/10 text-ink border border-line-border/50 font-bold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center shadow-sm"
            >
              <span>View Academic Rules</span>
            </a>
          </div>

          {/* Key Badges */}
          <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-ink/65 font-medium border-t border-line-border/20">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-primary" />
              <span>ZIMSEC Primary (6–54 Units)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-primary" />
              <span>A-Level (1–15 Points)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-primary" />
              <span>Multi-Tenant Isolated Data</span>
            </div>
          </div>
        </div>

        {/* Hero Right Column: High-Fidelity Live System Cockpit Preview Card */}
        <div className="lg:col-span-5 animate-fadeIn">
          <div className="relative group">
            {/* Ambient Background Glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-teal-primary/30 via-emerald-500/20 to-amber-500/20 rounded-3xl blur-2xl opacity-80 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="relative glass-card rounded-3xl border border-line-border/40 overflow-hidden shadow-2xl p-4 bg-white/90 text-left space-y-4">
              {/* Window Titlebar */}
              <div className="flex items-center justify-between pb-3 border-b border-line-border/20 text-ink/50 text-[10px] font-mono">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-brick-critical/60" />
                  <span className="w-3 h-3 rounded-full bg-amber-warning/60" />
                  <span className="w-3 h-3 rounded-full bg-teal-primary/60" />
                  <span className="ml-2 font-bold text-ink/80">harare_primary_cockpit.node</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-primary/10 text-teal-dark font-bold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-primary animate-pulse" />
                  <span>ONLINE REALTIME</span>
                </span>
              </div>

              {/* School Tenant Indicator Header */}
              <div className="p-3.5 rounded-2xl bg-teal-primary/10 border border-teal-primary/20 flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-bold text-teal-primary uppercase tracking-widest">Active Tenant Instance</span>
                  <h4 className="text-base font-display font-bold text-ink">Harare Primary School</h4>
                  <p className="text-[10px] text-ink/60 font-mono">Tenant Code: HARAREPR (HRE-)</p>
                </div>
                <div className="px-3 py-1 bg-white rounded-xl text-[10px] font-bold text-teal-dark shadow-sm border border-teal-primary/20">
                  2026-T1 Active
                </div>
              </div>

              {/* Real-time KPI Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-sage/10 border border-line-border/30">
                  <div className="flex items-center justify-between text-ink/50 text-[10px] font-bold uppercase">
                    <span>Paynow &amp; EcoCash</span>
                    <DollarSign className="w-3.5 h-3.5 text-teal-primary" />
                  </div>
                  <p className="text-base font-bold text-teal-dark font-mono mt-1">$148,450.00</p>
                  <span className="text-[9px] text-teal-primary font-semibold">88.4% Collection Rate</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-sage/10 border border-line-border/30">
                  <div className="flex items-center justify-between text-ink/50 text-[10px] font-bold uppercase">
                    <span>Predictive Pass Rate</span>
                    <TrendingUp className="w-3.5 h-3.5 text-teal-primary" />
                  </div>
                  <p className="text-base font-bold text-teal-dark font-mono mt-1">94.2% Passing</p>
                  <span className="text-[9px] text-teal-primary font-semibold">14.2 Avg Primary Units</span>
                </div>
              </div>

              {/* Sample Live Student Ledger Table */}
              <div className="border border-line-border/25 rounded-2xl overflow-hidden bg-white/50">
                <div className="px-3.5 py-2 bg-sage/20 border-b border-line-border/20 text-[9px] font-bold text-ink/60 uppercase flex justify-between items-center">
                  <span>Student Registry Snippet</span>
                  <span className="font-mono text-teal-primary">ZIMSEC &amp; Cambridge Verified</span>
                </div>
                <div className="divide-y divide-line-border/15 text-xs">
                  <div className="px-3.5 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-ink">Rufaro Chigumba</div>
                      <span className="text-[9px] text-ink/50 font-mono">HRE-STD00001 • Grade 1 Red</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-teal-primary/10 text-teal-primary font-bold text-[10px]">
                      6 Units (Distinction)
                    </span>
                  </div>

                  <div className="px-3.5 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-ink">Tinashe Moyo</div>
                      <span className="text-[9px] text-ink/50 font-mono">HRE-STD00002 • Form 6 Arts</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                      15 Points (3 A's)
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Shield Footer */}
              <div className="flex items-center justify-between text-[10px] text-ink/50 font-medium pt-1">
                <div className="flex items-center space-x-1 text-teal-primary font-semibold">
                  <Lock className="w-3 h-3" />
                  <span>Isolated Tenant Data</span>
                </div>
                <span>Zimbabwe Data Protection Act 2021</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Counter Section */}
      <section className="bg-white border-y border-line-border/30 py-12 relative z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, idx) => (
            <div key={idx} className="text-center space-y-1">
              <span className="text-[10px] font-sans font-bold text-teal-dark uppercase tracking-widest bg-teal-primary/10 px-2.5 py-0.5 rounded-full">{s.highlight}</span>
              <p className="text-3xl md:text-4xl font-display font-bold text-ink mt-2 numeric-data">{s.value}</p>
              <p className="text-xs text-ink/60 font-sans font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum Engine Feature Spotlight */}
      <section id="curriculum-engine" className="max-w-7xl mx-auto px-6 md:px-8 py-20 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-[10px] font-sans font-bold text-teal-primary uppercase tracking-widest bg-teal-primary/10 px-3 py-1 rounded-full border border-teal-primary/20">
            Native Grading Frameworks
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-ink">Built Specifically for Zimbabwean &amp; International Syllabi</h2>
          <p className="text-sm text-ink/65 leading-relaxed font-sans">
            Whether your school operates a Primary Grade 1–7 structure, Secondary O-Level, or Advanced Level Form 5–6, SchoolBase calculates exact units and point aggregates automatically.
          </p>
        </div>

        {/* Interactive Curriculum Switcher */}
        <div className="glass-panel p-8 rounded-3xl border border-line-border/30 shadow-xl bg-white max-w-4xl mx-auto space-y-6">
          <div className="flex justify-center space-x-3 border-b border-line-border/20 pb-4">
            <button
              onClick={() => setActiveCurriculumTab('primary')}
              className={`px-6 py-3 rounded-xl font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeCurriculumTab === 'primary' ? 'bg-teal-primary text-paper shadow-md' : 'bg-sage/10 text-ink/60 hover:bg-sage/20'
              }`}
            >
              Primary School Engine (Grade 1 – 7)
            </button>
            <button
              onClick={() => setActiveCurriculumTab('secondary')}
              className={`px-6 py-3 rounded-xl font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeCurriculumTab === 'secondary' ? 'bg-teal-primary text-paper shadow-md' : 'bg-sage/10 text-ink/60 hover:bg-sage/20'
              }`}
            >
              Secondary &amp; A-Level Engine (Form 1 – 6)
            </button>
          </div>

          {activeCurriculumTab === 'primary' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left animate-fadeIn">
              <div className="p-5 rounded-2xl bg-sage/10 border border-line-border/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-dark uppercase">Subject Grading</span>
                <h4 className="font-bold text-ink text-sm">1 to 9 Unit Scale</h4>
                <p className="text-xs text-ink/60">Marks map directly to ZIMSEC primary unit bands (1 = Distinction, 9 = Ungraded).</p>
              </div>
              <div className="p-5 rounded-2xl bg-sage/10 border border-line-border/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-dark uppercase">Aggregate Range</span>
                <h4 className="font-bold text-ink text-sm">6 to 54 Total Units</h4>
                <p className="text-xs text-ink/60">Calculates top 6 core subjects automatically for report cards and national rankings.</p>
              </div>
              <div className="p-5 rounded-2xl bg-sage/10 border border-line-border/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-dark uppercase">Terminal Year</span>
                <h4 className="font-bold text-ink text-sm">Grade 7 Completion</h4>
                <p className="text-xs text-ink/60">Automated end-of-year promotion or terminal completion status management.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left animate-fadeIn">
              <div className="p-5 rounded-2xl bg-sage/10 border border-line-border/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-dark uppercase">O-Level Rules</span>
                <h4 className="font-bold text-ink text-sm">Form 1 – 4 (Best 5 Passes)</h4>
                <p className="text-xs text-ink/60">Evaluates A–E letter grades and enforces 5 O-Level passes (Math &amp; English mandatory).</p>
              </div>
              <div className="p-5 rounded-2xl bg-sage/10 border border-line-border/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-dark uppercase">A-Level Points</span>
                <h4 className="font-bold text-ink text-sm">Form 5 – 6 (1 to 15 Points)</h4>
                <p className="text-xs text-ink/60">Sum of top 3 principal subjects (Grade A=5pts, B=4pts, C=3pts, D=2pts, E=1pt).</p>
              </div>
              <div className="p-5 rounded-2xl bg-sage/10 border border-line-border/20 space-y-2">
                <span className="text-[10px] font-bold text-teal-dark uppercase">Stream Promotion</span>
                <h4 className="font-bold text-ink text-sm">Automatic Stream Matching</h4>
                <p className="text-xs text-ink/60">Promotes Grade 2 Yellow $\rightarrow$ Grade 3 Yellow, Form 1 B $\rightarrow$ Form 2 B automatically.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Enterprise Feature Cards Grid */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 py-20 relative z-10 border-t border-line-border/25">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-ink">
            Complete Administrative Capabilities
          </h2>
          <p className="text-sm text-ink/60 font-sans">
            Engineered for school heads, bursars, housing wardens, and teachers to manage operations seamlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div key={idx} className="glass-panel p-7 rounded-3xl border border-line-border/30 hover:border-teal-primary/40 hover:shadow-xl transition-all duration-300 bg-white flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${f.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-ink group-hover:text-teal-primary transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-xs text-ink/65 leading-relaxed font-sans">
                    {f.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-line-border/15 flex items-center justify-between text-xs font-bold text-teal-primary">
                  <span>Operational Feature</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Call To Action Banner */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 py-16 relative z-10">
        <div className="glass-panel rounded-3xl p-10 md:p-14 bg-gradient-to-r from-teal-primary to-teal-dark text-paper border border-teal-primary/30 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-3 text-left max-w-2xl relative z-10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 bg-white/15 rounded-full text-paper">Ready For Live Deployment</span>
            <h2 className="text-3xl sm:text-4xl font-display font-bold leading-tight">Test-Drive SchoolBase Live for Your School</h2>
            <p className="text-xs sm:text-sm text-paper/85 font-sans leading-relaxed">
              Experience pre-configured primary and secondary demo tenants with ZIMSEC grading, Paynow fees, and AI risk scoring in 1 click.
            </p>
          </div>
          <button
            onClick={() => setShowLogin(true)}
            className="px-8 py-4 bg-paper hover:bg-white text-teal-dark font-bold text-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer relative z-10 shrink-0 flex items-center space-x-2"
          >
            <LogIn className="w-4 h-4 text-teal-primary" />
            <span>Launch Live Client Demo</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line-border/30 bg-white py-10 text-xs font-sans text-ink/50 relative z-10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-teal-primary" />
            <span className="font-bold text-ink">SchoolBase SaaS Suite</span>
            <span>&copy; {new Date().getFullYear()} All Rights Reserved.</span>
          </div>
          <div className="flex space-x-6 text-xs text-ink/65 font-medium">
            <span>Multi-Tenant Architecture</span>
            <span>ZIMSEC &amp; Cambridge Compliant</span>
            <span>Data Protection Act 2021</span>
          </div>
        </div>
      </footer>

      {/* Quick Demo Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md glass-panel rounded-3xl shadow-2xl p-8 border border-line-border/40 bg-white relative">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute right-5 top-5 p-2 text-ink/50 hover:text-ink hover:bg-sage/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-left space-y-1 border-b border-line-border/20 pb-4 mb-5">
              <span className="text-[10px] font-mono font-bold text-teal-primary uppercase tracking-wider">Client Sign In</span>
              <h3 className="text-2xl font-display font-bold text-ink">Access School Cockpit</h3>
              <p className="text-xs text-ink/60 font-sans">Select a pre-seeded demo account below or enter your login details.</p>
            </div>

            {sessionExpired && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Your session has expired. Please sign in again.</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Demo Selector Buttons */}
            <div className="mb-6 space-y-2">
              <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider text-left">Quick Demo Test Accounts:</label>
              <div className="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  onClick={() => handleDemoSelect('schooladmin', 'SchoolAdmin123', 'Harare Primary Admin')}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                    selectedDemoRole === 'Harare Primary Admin' ? 'bg-teal-primary/10 border-teal-primary text-teal-dark font-bold' : 'bg-sage/5 border-line-border/30 hover:bg-sage/10 text-ink'
                  }`}
                >
                  <div className="font-bold text-[11px]">🏫 Harare Primary Admin</div>
                  <div className="text-[9px] text-ink/50 font-mono">schooladmin</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSelect('superadmin', 'SuperSecurePass123', 'Super Admin')}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                    selectedDemoRole === 'Super Admin' ? 'bg-teal-primary/10 border-teal-primary text-teal-dark font-bold' : 'bg-sage/5 border-line-border/30 hover:bg-sage/10 text-ink'
                  }`}
                >
                  <div className="font-bold text-[11px]">👑 Super Admin (All)</div>
                  <div className="text-[9px] text-ink/50 font-mono">superadmin</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSelect('teacher', 'Teacher123', 'Teacher Role')}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                    selectedDemoRole === 'Teacher Role' ? 'bg-teal-primary/10 border-teal-primary text-teal-dark font-bold' : 'bg-sage/5 border-line-border/30 hover:bg-sage/10 text-ink'
                  }`}
                >
                  <div className="font-bold text-[11px]">👨‍🏫 Educator Portal</div>
                  <div className="text-[9px] text-ink/50 font-mono">teacher</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSelect('parent', 'Parent123', 'Parent Role')}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                    selectedDemoRole === 'Parent Role' ? 'bg-teal-primary/10 border-teal-primary text-teal-dark font-bold' : 'bg-sage/5 border-line-border/30 hover:bg-sage/10 text-ink'
                  }`}
                >
                  <div className="font-bold text-[11px]">👨‍👩‍👧 Parent Portal</div>
                  <div className="text-[9px] text-ink/50 font-mono">parent</div>
                </button>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left font-sans">
              <div>
                <label className="block text-xs font-bold text-ink/75 mb-1">Username / Account Email *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. schooladmin"
                  className="w-full glass-input rounded-xl text-xs"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink/75 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full glass-input rounded-xl text-xs"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer flex items-center justify-center space-x-2 mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Sign In to School Cockpit</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
