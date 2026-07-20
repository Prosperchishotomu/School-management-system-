import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, BookOpen, Users, DollarSign, Calendar, Activity, 
  ChevronRight, LayoutDashboard, ArrowRight, X, LogIn, Loader2, 
  AlertCircle, Clock, Play, GraduationCap, Sparkles
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
  const sessionExpired = searchParams.get('expired') === '1';

  // Toggle login popup based on params
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
      icon: Users,
      title: 'Zimbabwean Curriculum Integration',
      description: 'Pre-loaded with ZIMSEC primary and secondary syllabi for swift subject assignment and grading.'
    },
    {
      icon: BookOpen,
      title: 'Class Diaries & Assessments',
      description: 'Schedule term exams, configure grading weight distributions, and print consolidated ledgers.'
    },
    {
      icon: DollarSign,
      title: 'Fee Collection & Remotes',
      description: 'Remote payment declarations, approval verification tables, and automatic credit balance carryovers.'
    },
    {
      icon: Activity,
      title: 'Live Attendance Monitors',
      description: 'Offline-ready daily registers showing real-time stats and statistical slump alerts.'
    },
    {
      icon: Shield,
      title: 'Data Protection Compliant',
      description: 'Multi-tenant database structures fully aligned with the Zimbabwe Data Protection Act (2021).'
    },
    {
      icon: Calendar,
      title: 'Term & Calendar Cycles',
      description: 'Admin-managed academic terms ensuring coordinated session dates across Harare regions.'
    }
  ];

  return (
    <div className="min-h-screen bg-paper text-ink overflow-hidden font-sans relative">
      {/* Decorative background blobs */}
      <div className="absolute top-1/6 left-1/5 w-[500px] h-[500px] rounded-full bg-teal-primary/5 blur-3xl animate-pulse duration-[8000ms] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-warning/5 blur-3xl animate-pulse duration-[6000ms] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-20 border-b border-line-border/30 backdrop-blur-md bg-white/70">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center border border-teal-primary/25 shadow-sm">
              <Shield className="w-5.5 h-5.5 text-teal-primary" />
            </div>
            <div>
              <span className="text-2xl font-display font-bold text-ink tracking-tight">
                School<span className="text-teal-primary">Base</span>
              </span>
              <p className="text-[9px] font-mono tracking-widest text-ink/40 uppercase">SaaS Suite v1.0</p>
            </div>
          </div>

          <button
            onClick={handleCta}
            className="px-5 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-semibold rounded-xl shadow-md hover:shadow-teal-primary/20 transition-all cursor-pointer flex items-center space-x-1.5"
          >
            {user ? (
              <>
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Enter Portal</span>
              </>
            ) : (
              <>
                <span>Sign In to School</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </header>

      {/* Hero Section: Split Layout (Copy left, Video right) */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 py-16 lg:py-24 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Copy Column */}
        <div className="lg:col-span-6 space-y-6 text-left animate-fadeIn">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-teal-primary/10 border border-teal-primary/20 text-teal-primary text-[10px] font-bold uppercase tracking-widest rounded-full">
            <Sparkles className="w-3 h-3 text-teal-primary" />
            <span>Multi-Tenant Administrative Hub</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-ink leading-[1.1]">
            Management Portal for Next-Gen <span className="text-teal-primary">Schools</span>
          </h1>
          <p className="text-sm md:text-base text-ink/65 leading-relaxed font-sans max-w-xl">
            Streamline class registries, curriculum planning, offline registers, tuition collection ledgers, and dynamic performance ranking scorecards from a single secure cloud cockpit.
          </p>

          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={handleCta}
              className="px-6 py-3.5 bg-teal-primary hover:bg-teal-dark text-paper font-semibold text-sm rounded-xl shadow-lg hover:shadow-teal-primary/20 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <span>{user ? 'Go to Command Center' : 'Access Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#features"
              className="px-6 py-3.5 bg-white hover:bg-sage/10 text-ink border border-line-border/50 font-semibold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center"
            >
              Explore Capabilities
            </a>
          </div>
        </div>

        {/* Right Video Container Column */}
        <div className="lg:col-span-6 animate-fadeIn">
          <div className="relative group">
            {/* Elegant glass bezel frame */}
            <div className="absolute -inset-2 bg-gradient-to-r from-teal-primary/15 to-amber-warning/15 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative glass-card rounded-2xl border border-line-border/30 overflow-hidden shadow-2xl p-2 bg-white/70">
              
              {/* Bezel Titlebar header */}
              <div className="flex items-center space-x-2 px-3 pb-2 pt-1 border-b border-line-border/20 text-ink/40 text-[10px] font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-brick-critical/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-warning/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-teal-primary/20" />
                <span className="ml-2 font-semibold">harare_primary_learning.mp4</span>
              </div>

              {/* Video Player Box */}
              <div className="relative aspect-video bg-ink rounded-lg overflow-hidden mt-1.5 shadow-inner">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-300"
                  src="https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054ba208413a9ec6f43e117bfa4ecbe&profile_id=139&oauth2_token_id=57447761"
                />

                {/* Localized Floating Badges */}
                <div className="absolute bottom-3 left-3 bg-ink/75 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-paper flex items-center space-x-1.5 border border-white/10 shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-primary animate-pulse" />
                  <span>Harare Learning Hub</span>
                </div>
                
                <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-sans font-bold text-ink/80 border border-white/40 shadow-md">
                  📚 Primary Class
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 md:px-8 py-20 relative z-10 border-t border-line-border/25">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-ink">
            A Complete Administrative Dashboard
          </h2>
          <p className="text-xs md:text-sm text-ink/50">
            Crafted for principals, educators, and administrators to orchestrate every layer of learning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="glass-card rounded-2xl p-6 border border-line-border/30 hover:border-teal-primary/30 transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center border border-teal-primary/20 mb-4 group-hover:bg-teal-primary group-hover:text-paper transition-all">
                  <Icon className="w-5 h-5 text-teal-primary group-hover:text-paper transition-all" />
                </div>
                <h3 className="font-sans font-bold text-base text-ink mb-2">{feat.title}</h3>
                <p className="text-xs text-ink/60 leading-relaxed font-sans">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Compliance / Legal section */}
      <section className="bg-sage/5 py-16 border-t border-line-border/20">
        <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <h3 className="text-xl md:text-2xl font-display font-bold text-ink flex items-center space-x-2">
              <Shield className="w-6 h-6 text-teal-primary" />
              <span>Zimbabwe Data Protection Act (2021)</span>
            </h3>
            <p className="text-xs text-ink/65 leading-relaxed font-sans">
              SchoolBase protects student records and school databases under strict compliance criteria. All transaction details, academic rankings, and medical files are isolated at the database level.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5 border border-line-border/30 w-full md:w-80 flex flex-col items-center text-center space-y-4 bg-white">
            <span className="text-[10px] font-mono font-bold text-teal-primary uppercase bg-teal-primary/10 px-2.5 py-0.5 rounded-full">Audited System</span>
            <p className="text-xs font-semibold text-ink/80 leading-relaxed">
              Hosted in a sandboxed, low-latency stack with 20-minute automated inactivity logouts.
            </p>
            <button
              onClick={handleCta}
              className="w-full py-2.5 bg-ink hover:bg-ink/95 text-paper text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line-border/30 py-8 bg-paper">
        <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-ink/40 font-sans">
          <p>© {new Date().getFullYear()} SchoolBase Multi-Tenant Suite. All rights reserved.</p>
          <div className="flex space-x-4">
            <span>Zimbabwe Data Protection Act (2021)</span>
            <span>•</span>
            <span>Security Audited</span>
          </div>
        </div>
      </footer>

      {/* Transparent Login Modal Overlay */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl p-8 text-paper relative animate-zoomIn">
            
            {/* Close Button */}
            <button
              onClick={() => {
                setShowLogin(false);
                setError('');
              }}
              className="absolute top-5 right-5 text-white/50 hover:text-white cursor-pointer transition-colors p-1 hover:bg-white/10 rounded-full"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Brand Header */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-teal-primary/15 flex items-center justify-center border border-teal-primary/30 mb-3 shadow-inner">
                <GraduationCap className="w-6 h-6 text-teal-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                School<span className="text-teal-primary">Base</span> Portal
              </h2>
              <p className="text-xs text-white/60 mt-0.5">Zimbabwe Multi-Tenant Desk</p>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-brick-critical/20 border border-brick-critical/30 text-white text-xs font-sans flex items-start space-x-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-brick-critical" />
                <span>{error}</span>
              </div>
            )}

            {/* Session Expired Prompt */}
            {sessionExpired && !error && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-warning/20 border border-amber-warning/30 text-white text-xs font-sans flex items-start space-x-2">
                <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-warning" />
                <span>Your login session expired. Please sign in again.</span>
              </div>
            )}

            {/* Transparent Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-sans font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. schooladmin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/35 font-sans text-xs focus:border-teal-primary/60 focus:bg-white/10 focus:outline-none transition-all"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-sans font-semibold text-white/70 uppercase tracking-wider">
                    Password
                  </label>
                  <Link 
                    to="/forgot-password" 
                    className="text-[10px] text-teal-primary hover:underline font-sans font-medium"
                    onClick={() => setShowLogin(false)}
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/35 font-sans text-xs focus:border-teal-primary/60 focus:bg-white/10 focus:outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-xs rounded-xl shadow-lg hover:shadow-teal-primary/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-paper" />
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Access Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center border-t border-white/10 pt-4 text-[9px] text-white/40 leading-relaxed">
              This system is restricted to authorized personnel.<br />
              Zimbabwe Data Protection Act (2021) Compliant.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
