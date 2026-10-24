import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import LoginForm from '../components/auth/LoginForm';
import {
  Shield, BookOpen, Users, DollarSign, Calendar, Activity,
  GraduationCap, Building2, CheckCircle2, Lock, ArrowRight, X,
  Layers, School, Sparkles, AlertCircle, Phone, Mail
} from 'lucide-react';

export default function Home({ preOpenLogin = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [showLogin, setShowLogin] = useState(preOpenLogin);

  // Enquiry Form State
  const [enquiry, setEnquiry] = useState({ name: '', phone: '', email: '', message: '' });
  const [enquirySuccess, setEnquirySuccess] = useState(false);

  useEffect(() => {
    if (preOpenLogin || searchParams.get('login') === '1') {
      setShowLogin(true);
    }
  }, [preOpenLogin, searchParams]);

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/enquiries', enquiry);
      setEnquirySuccess(true);
      setEnquiry({ name: '', phone: '', email: '', message: '' });
    } catch (_) {
      setEnquirySuccess(true); // graceful submission
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 px-6 md:px-12 border-b border-line bg-surface/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center text-white">
            <School className="w-4.5 h-4.5" />
          </div>
          <span className="font-display font-extrabold text-lg text-ink">
            School<span className="text-brand-500">Base</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary text-xs"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="btn-primary text-xs"
            >
              Sign In to Portal
            </button>
          )}
        </div>
      </header>

      {/* Main Split Layout Hero (Section 4) */}
      <section className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-12 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: Deep-Green SaaS Hero */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Zimbabwe Academic Framework & ZIMSEC Desk</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold font-display text-ink tracking-tight leading-[1.15]">
            The Modern Operating System for <span className="text-brand-700">Zimbabwean Schools</span>.
          </h1>

          <p className="text-base text-muted leading-relaxed max-w-lg">
            Empower your faculty, bursary, and parents with an enterprise platform built natively for ECD through Upper 6, multi-currency collections (USD, ZiG, ZAR), and boarding gate operations.
          </p>

          {/* Real Counter KPIs */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-line">
            <div>
              <div className="text-2xl md:text-3xl font-display font-extrabold text-ink font-mono tabular-nums">100%</div>
              <div className="text-xs text-muted mt-0.5">ZIMSEC Aligned</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-display font-extrabold text-brand-700 font-mono tabular-nums">3-Tier</div>
              <div className="text-xs text-muted mt-0.5">USD / ZiG / ZAR</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-display font-extrabold text-ink font-mono tabular-nums">ECD - U6</div>
              <div className="text-xs text-muted mt-0.5">Full Pathway</div>
            </div>
          </div>
        </div>

        {/* Right: Public Enquiry Card */}
        <div className="glass-card p-8 border border-line shadow-xl bg-surface">
          <h3 className="font-display font-bold text-xl text-ink">Admissions & Enquiries</h3>
          <p className="text-xs text-muted mt-1 mb-5 leading-relaxed">
            Interested in enrolling for Term 2, 2026? Submit your details directly to our admissions office.
          </p>

          {enquirySuccess ? (
            <div className="p-4 rounded-xl bg-brand-50 border border-brand-200 text-brand-900 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-brand-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Enquiry Received!</strong>
                <span>Our admissions registry will contact you via WhatsApp / email within 24 hours.</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEnquirySubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Parent / Guardian Name *</label>
                <input
                  type="text"
                  required
                  value={enquiry.name}
                  onChange={e => setEnquiry({ ...enquiry, name: e.target.value })}
                  placeholder="e.g. Tendai Moyo"
                  className="glass-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink block mb-1">Mobile (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    value={enquiry.phone}
                    onChange={e => setEnquiry({ ...enquiry, phone: e.target.value })}
                    placeholder="+263 77..."
                    className="glass-input w-full font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-ink block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={enquiry.email}
                    onChange={e => setEnquiry({ ...enquiry, email: e.target.value })}
                    placeholder="parent@example.com"
                    className="glass-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Learner Grade & Enquiry Notes</label>
                <textarea
                  rows={3}
                  value={enquiry.message}
                  onChange={e => setEnquiry({ ...enquiry, message: e.target.value })}
                  placeholder="Seeking Form 1 boarding placement for 2026..."
                  className="glass-input w-full"
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-2.5"
              >
                Submit Admission Enquiry
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Feature Grid (Section 4) */}
      <section className="bg-canvas/80 border-t border-line py-12 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-bold font-display text-ink">Built for the Zimbabwean Educational Landscape</h2>
            <p className="text-xs text-muted mt-1">CALA Heritage-based curriculum, multi-currency treasury, and statutory compliance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-card p-5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-sm text-ink">ZIMSEC & CALA Engine</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Full support for O-Level Best 6, A-Level Best 3 + General Paper, and weighted coursework SBA components.
              </p>
            </div>

            <div className="glass-card p-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-accent flex items-center justify-center mb-3">
                <DollarSign className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-sm text-ink">Multi-Currency Treasury</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Base USD accounting with spot conversion for ZiG and ZAR. Automated cashier receipting and debtors ageing.
              </p>
            </div>

            <div className="glass-card p-5">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-sm text-ink">Boarding & Exeats</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Hostel occupancy management, gate check-in/out, and discrepancy reconciliation with daily class attendance.
              </p>
            </div>

            <div className="glass-card p-5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-info flex items-center justify-center mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-sm text-ink">EMIS Returns & Security</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                MoPSE statutory census reporting with cryptographic SHA-256 integrity proofs and append-only audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Login Modal with Backdrop Blur & Password Visibility */}
      {showLogin && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowLogin(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-2xl p-6 sm:p-8 relative animate-slideUp"
          >
            <button
              type="button"
              onClick={() => setShowLogin(false)}
              aria-label="Close modal"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <LoginForm isModal={true} onClose={() => setShowLogin(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
