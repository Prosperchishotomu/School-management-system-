import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, BookOpen, Users, DollarSign, Calendar, Activity, 
  ChevronRight, LayoutDashboard, ArrowRight, X, LogIn, Loader2, 
  AlertCircle, GraduationCap, Sparkles, Zap, Wifi, Building2, 
  TrendingUp, CheckCircle2, Globe, Award, Lock, Smartphone, FileText, Bot,
  Eye, EyeOff
} from 'lucide-react';

const Home = ({ preOpenLogin = false }) => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [showLogin, setShowLogin] = useState(preOpenLogin);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
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
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[140px] pointer-events-none" />

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
                  <span>Client Login</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-16 pb-24 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
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
              <span>{user ? 'Open School Cockpit' : 'Login to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#curriculum-engine"
              className="px-6 py-4 bg-white hover:bg-sage/10 text-ink border border-line-border/50 font-bold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center shadow-sm"
            >
              <span>View Academic Rules</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 animate-fadeIn">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-primary/20 to-amber-warning/20 rounded-3xl blur-2xl group-hover:scale-105 transition-transform duration-500 pointer-events-none" />
            <div className="relative glass-panel rounded-3xl border border-line-border/30 overflow-hidden shadow-2xl p-6 space-y-6">
              
              <div className="flex items-center justify-between border-b border-line-border/15 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center text-teal-primary">
                    <LayoutDashboard className="w-5.5 h-5.5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-display font-bold text-ink">Administrative Cockpit</h3>
                    <p className="text-[10px] text-ink/50 font-sans">Live System Monitor</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-teal-dark bg-sage/40 px-2.5 py-1 rounded-full border border-teal-primary/15 uppercase">
                  Active Connection
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                {stats.map((s, idx) => (
                  <div key={idx} className="glass-card p-4 rounded-2xl flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-ink/40 uppercase tracking-wider leading-tight pr-2">{s.label}</span>
                    <h4 className="text-xl font-display font-bold text-teal-primary numeric-data mt-2">
                      {s.value}
                    </h4>
                    <p className="text-[9px] font-sans text-ink/50 mt-1">{s.highlight}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-line-border/15 pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-teal-primary animate-pulse" />
                    <span className="font-semibold text-ink/75">Academic Engine Core</span>
                  </div>
                  <span className="text-[10px] text-ink/50 font-mono">100% Native Grading</span>
                </div>
                <div className="w-full bg-sage/30 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-teal-primary h-full rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="curriculum-engine" className="bg-white border-y border-line-border/25 py-24 relative z-10 text-left">
        <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-16">
          <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="text-[10px] font-mono font-bold text-teal-primary uppercase tracking-widest px-3 py-1 bg-teal-primary/10 rounded-full">Intelligent Core Logic</span>
              <h2 className="text-3xl md:text-5xl font-display font-bold text-ink leading-tight">
                Fully Adapts to Zimbabwe &amp; Cambridge Curriculums
              </h2>
            </div>
            <p className="text-sm text-ink/65 leading-relaxed font-sans max-w-md">
              No general templates or simple calculations. The academic engine handles points aggregates, grade thresholds, and course weights automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 bg-paper">
              <span className="text-[10px] font-mono font-bold text-teal-primary uppercase block mb-2">Primary Module</span>
              <h3 className="font-display font-bold text-lg text-ink">Grade 1–7 Units</h3>
              <p className="text-xs text-ink/65 leading-relaxed mt-2 font-sans">
                Best 4 subjects units summation mapping. Logic converts percentage grades to aggregate units (1 as best, 9 as worst) and flags at-risk students automatically.
              </p>
            </div>
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 bg-paper">
              <span className="text-[10px] font-mono font-bold text-amber-warning uppercase block mb-2">Secondary Module</span>
              <h3 className="font-display font-bold text-lg text-ink">O-Level Aggregates</h3>
              <p className="text-xs text-ink/65 leading-relaxed mt-2 font-sans">
                Best 5 passed subjects with letters-to-numbers conversion to calculate aggregate values for advanced level entry requirements.
              </p>
            </div>
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 bg-paper">
              <span className="text-[10px] font-mono font-bold text-brick-critical uppercase block mb-2">Advanced Module</span>
              <h3 className="font-display font-bold text-lg text-ink">A-Level Points</h3>
              <p className="text-xs text-ink/65 leading-relaxed mt-2 font-sans">
                15 Points engine across 3 registered subjects. Correctly handles subjects like Divinity or Literature with specific weighting rules.
              </p>
            </div>
            <div className="glass-panel p-6 rounded-2xl border border-line-border/30 bg-paper">
              <span className="text-[10px] font-mono font-bold text-teal-primary uppercase block mb-2">Automation Core</span>
              <h3 className="font-display font-bold text-lg text-ink">AI-Based Analysis</h3>
              <p className="text-xs text-ink/65 leading-relaxed mt-2 font-sans">
                Live calculated Pearson Correlation coefficients and Multi-variable regression predicting student at-risk indexes using class attendance and financial health.
              </p>
            </div>
          </div>
        </div>
      </section>

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

      <section className="max-w-7xl mx-auto px-6 md:px-8 py-16 relative z-10">
        <div className="glass-panel rounded-3xl p-10 md:p-14 bg-gradient-to-r from-teal-primary to-teal-dark text-paper border border-teal-primary/30 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-3 text-left max-w-2xl relative z-10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 bg-white/15 rounded-full text-paper">Ready For Live Deployment</span>
            <h2 className="text-3xl sm:text-4xl font-display font-bold leading-tight">Access the SchoolBase Portal</h2>
            <p className="text-xs sm:text-sm text-paper/85 font-sans leading-relaxed">
              Enter your administrative credentials to securely access your school's cockpit.
            </p>
          </div>
          <button
            onClick={() => setShowLogin(true)}
            className="px-8 py-4 bg-paper hover:bg-white text-teal-dark font-bold text-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer relative z-10 shrink-0 flex items-center space-x-2"
          >
            <LogIn className="w-4 h-4 text-teal-primary" />
            <span>Sign In to Portal</span>
          </button>
        </div>
      </section>

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
              <p className="text-xs text-ink/60 font-sans">Enter your login details to access the system.</p>
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

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left font-sans">
              <div>
                <label className="block text-xs font-bold text-ink/75 mb-1">Username / Account Email *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  className="w-full glass-input rounded-xl text-xs"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink/75 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="w-full glass-input rounded-xl text-xs pr-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
