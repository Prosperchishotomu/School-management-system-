import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import {
  School, ShieldCheck, GraduationCap, ArrowLeft,
  Layers, Building2, Globe2, Sparkles
} from 'lucide-react';

export default function Login() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, allow continuation or account switch
  if (user) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <School className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-display text-white">Active Session Detected</h2>
          <p className="text-xs text-slate-400">
            You are currently signed in as <span className="font-bold text-white">{user.username || user.name}</span> (<span className="capitalize font-mono text-emerald-400">{(user.role || '').replace('_', ' ')}</span>).
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Continue to Dashboard
            </button>
            <button
              onClick={() => logout()}
              className="w-full py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Sign Out & Sign in as Different User
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative overflow-hidden font-sans select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-emerald-600/20 via-teal-500/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-[750px] h-[750px] rounded-full bg-gradient-to-tl from-cyan-500/10 via-emerald-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Left Feature Column (Visible on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative p-12 xl:p-16 flex-col justify-between bg-gradient-to-b from-slate-950 via-emerald-950/30 to-slate-950 text-white z-10 border-r border-white/10 backdrop-blur-md overflow-hidden">
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
              <span className="text-xs text-slate-400 font-medium">
                Enterprise School Management System
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
            <span>Zimbabwe Educational Standard</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-display font-black text-white leading-tight tracking-tight mb-4">
            Unified Institutional Governance & Examination Engine
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed mb-8 font-sans">
            Engineered specifically for Zimbabwean primary, secondary, and high schools. Seamlessly managing MoPSE statutory returns, ZIMSEC continuous assessments, multi-currency fees, and hostel gates.
          </p>

          {/* Pillars Grid */}
          <div className="space-y-3">
            {[
              {
                icon: GraduationCap,
                title: 'Primary (Units) & High School (A–U / Points)',
                desc: 'Automated termly ranking, position calculation, and broadsheets.'
              },
              {
                icon: Layers,
                title: 'Tiered Subject & Stream Allocations',
                desc: 'Teachers view only their designated subjects and stream rosters.'
              },
              {
                icon: Building2,
                title: 'Dual Currency & Boarding Exeats',
                desc: 'Real-time cashiering in USD & ZiG with biometric gate pass validation.'
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
            <span>MoPSE Census Certified</span>
          </span>
        </div>
      </div>

      {/* Right Column: Modern Login Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-12 z-10">
        <div className="w-full max-w-md">
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

          {/* Clean Card Container */}
          <div className="rounded-3xl p-6 sm:p-8 border border-slate-200/80 bg-white shadow-2xl shadow-emerald-950/20 animate-slideUp text-slate-900">
            <LoginForm isModal={false} />
          </div>

          {/* Quick Help Footer */}
          <div className="text-center text-xs text-slate-400 mt-6">
            <span>Need staff or student account activation? </span>
            <Link to="/enquiries" className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline">
              Contact School Administration
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
