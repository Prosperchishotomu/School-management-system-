import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import {
  School, ShieldCheck, GraduationCap, ArrowLeft,
  Layers, Building2, Globe2, Sparkles, CheckCircle2
} from 'lucide-react';

export default function Login() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // If already authenticated in this tab, present active session dashboard gateway
  if (user) {
    return (
      <div className="min-h-screen w-full bg-[#0a0f1d] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-5 relative z-10 ring-1 ring-white/5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-inner">
            <School className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-white tracking-tight">Active Session Detected</h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Signed in on this tab as <span className="font-bold text-white">{user.username || user.name}</span>
              <span className="block mt-1 font-mono text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                {(user.role || '').replace(/_/g, ' ')}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-[0.99]"
            >
              Continue to Dashboard
            </button>
            <button
              onClick={() => logout()}
              className="w-full py-2.5 rounded-xl border border-slate-700/80 hover:bg-slate-800/80 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Sign Out & Sign in as Different User
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0f1d] text-slate-100 flex flex-col lg:flex-row relative overflow-hidden font-sans select-none">
      {/* Background Architectural Mesh & Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-[750px] h-[750px] rounded-full bg-gradient-to-br from-emerald-600/15 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-[750px] h-[750px] rounded-full bg-gradient-to-tl from-cyan-600/10 via-emerald-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Left Feature Column (Visible on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative p-12 xl:p-16 flex-col justify-between bg-gradient-to-b from-[#0a0f1d] via-[#0d162b]/60 to-[#0a0f1d] text-white z-10 border-r border-white/10 backdrop-blur-xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between relative z-10">
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 group-hover:scale-105 transition-transform duration-300 border border-emerald-400/30">
              <School className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <span className="font-display font-black text-2xl tracking-tight text-white block leading-none">
                School<span className="text-emerald-400">Base</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                Institutional Management System
              </span>
            </div>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-xl font-medium border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Website</span>
          </Link>
        </div>

        {/* Center Hero Copy & Capabilities Highlights */}
        <div className="my-auto py-10 max-w-lg relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>National Educational Standard • MoPSE Compliant</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-display font-black text-white leading-tight tracking-tight mb-4">
            Next-Generation Educational Governance & Broadside Engine
          </h1>

          <p className="text-sm text-slate-300/90 leading-relaxed mb-8 font-sans">
            Precision administration engineered for primary, secondary, and high schools. Seamlessly unifying admissions, ZIMSEC continuous assessments, dual-currency fees, and boarding security.
          </p>

          {/* Pillars Grid */}
          <div className="space-y-3">
            {[
              {
                icon: GraduationCap,
                title: 'ZIMSEC & Cambridge Assessment Broadsheets',
                desc: 'Automated termly ranking, grade point calculation, and official broadsheets.'
              },
              {
                icon: Layers,
                title: 'Multi-Currency Treasury & Cashier Desk',
                desc: 'Real-time billing in USD & ZiG with automated receipt generation and debtor aging.'
              },
              {
                icon: Building2,
                title: 'Hostels, Residences & Biometric Exeats',
                desc: 'Digital student gate passes, dormitory room occupancy, and guardian notification alerts.'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-emerald-500/40 backdrop-blur-sm transition-all duration-300"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 group-hover:scale-105 transition-transform">
                  <feature.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-display font-bold text-white tracking-tight">{feature.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Institutional Stamp */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            <span>Harare • Bulawayo • Gweru • Mutare</span>
          </div>
          <span className="flex items-center gap-1.5 text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>MoPSE Certified Platform</span>
          </span>
        </div>
      </div>

      {/* Right Column: Sleek Executive Auth Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-12 z-10">
        <div className="w-full max-w-[440px]">
          {/* Top back link on mobile */}
          <div className="lg:hidden flex items-center justify-between mb-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white">
                <School className="w-4 h-4" />
              </div>
              <span className="font-display font-extrabold text-base text-white">
                School<span className="text-emerald-400">Base</span>
              </span>
            </Link>

            <Link
              to="/"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back Home</span>
            </Link>
          </div>

          {/* Unified Executive Glass Card */}
          <div className="rounded-3xl p-7 sm:p-9 border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-black/70 animate-slideUp text-white ring-1 ring-white/5">
            <LoginForm isModal={false} />
          </div>

          {/* Quick Help Footer */}
          <div className="text-center text-xs text-slate-400 mt-6">
            <span>Need account activation or access assistance? </span>
            <Link to="/enquiries" className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline">
              Contact School Administration
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
