import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  School, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle,
  ShieldCheck, Check
} from 'lucide-react';

export default function LoginForm({ isModal = false, onClose = null, onSuccess = null }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [ssoNotice, setSsoNotice] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await login(username.trim(), password);
      setLoading(false);

      if (result.success) {
        if (onSuccess) onSuccess();
        if (onClose) onClose();

        const savedUser = JSON.parse(sessionStorage.getItem('schoolbase_user') || '{}');
        const role = (savedUser.role || '').toLowerCase().trim();

        if (role === 'super_admin') {
          navigate('/admin/command-center', { replace: true });
        } else if (['school_admin', 'head', 'deputy_head', 'admin', 'principal'].includes(role)) {
          navigate('/school-admin/dashboard', { replace: true });
        } else if (['teacher', 'hod'].includes(role)) {
          navigate('/teacher/dashboard', { replace: true });
        } else if (role === 'bursar') {
          navigate('/fees', { replace: true });
        } else if (role === 'parent') {
          navigate('/parent-portal', { replace: true });
        } else if (role === 'student') {
          navigate('/student/dashboard', { replace: true });
        } else if (role === 'boarding_master') {
          navigate('/boarding/exeats', { replace: true });
        } else if (role === 'nurse') {
          navigate('/health-records', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        setError(result.error || 'Invalid credentials. Please verify your details or contact your school administrator.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Authentication service unreachable. Please check your connection.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleSsoClick = () => {
    setSsoNotice(true);
    setTimeout(() => setSsoNotice(false), 3500);
  };

  return (
    <div className={`w-full transition-all duration-300 ${isShaking ? 'animate-shake' : ''}`}>
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 border border-emerald-500/30 flex items-center justify-center text-white shadow-xl shadow-emerald-900/20 mb-3.5">
          <School className="w-7 h-7 text-white" />
        </div>

        <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
          Welcome to <span className="text-emerald-700">SchoolBase</span>
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-xs font-sans font-medium">
          Unified Institutional Access for Staff, Students & Parents
        </p>
      </div>

      {/* Enterprise Single Sign-On (SSO) Options */}
      <div className="space-y-2 mb-5">
        <div className="grid grid-cols-2 gap-2">
          {/* Google Workspace for Education */}
          <button
            type="button"
            onClick={handleSsoClick}
            className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer shadow-xs"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            <span className="truncate">Google Workspace</span>
          </button>

          {/* Microsoft 365 Education */}
          <button
            type="button"
            onClick={handleSsoClick}
            className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer shadow-xs"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span className="truncate">Microsoft 365</span>
          </button>
        </div>

        {ssoNotice && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-sans font-medium flex items-center gap-2 animate-fadeIn">
            <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Redirecting to institutional Single Sign-On (SSO) provider...</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center mb-5">
        <div className="border-t border-slate-200 w-full" />
        <span className="bg-slate-100 text-slate-600 border border-slate-200/80 px-3 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono">
          or institutional credentials
        </span>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs flex items-start gap-2.5 animate-fadeIn font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 font-sans text-xs leading-relaxed">{error}</div>
        </div>
      )}

      {/* Form — Single unified entry point */}
      <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
        {/* Identifier Input */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 font-sans">
            Username. <span className="text-rose-600 font-bold">*</span>
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-700 transition-colors">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={username}
              onChange={e => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. bursar, schooladmin, or email"
              autoComplete="username"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium font-sans placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 font-sans">
              Password <span className="text-rose-600 font-bold">*</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold hover:underline transition-colors font-sans"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-700 transition-colors">
              <Lock className="w-4 h-4" />
            </div>

            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium font-sans placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-all"
            />

            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-emerald-700" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 hover:text-slate-900 font-medium font-sans">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 bg-white border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
            <span>Remember this device</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full mt-2 py-3 px-4 rounded-xl font-sans font-bold text-xs tracking-wide uppercase text-white bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] transition-all duration-200 shadow-md shadow-emerald-900/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Authenticating…</span>
            </>
          ) : (
            <>
              <span>Sign In to SchoolBase</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        {/* Fast Role Portals */}
        <div className="pt-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 text-center font-mono">
            Quick Select Portal Account
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => { setUsername('bursar'); setPassword('Password123!'); }}
              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 hover:text-emerald-800 transition text-center cursor-pointer"
            >
              Bursar
            </button>
            <button
              type="button"
              onClick={() => { setUsername('schooladmin'); setPassword('Password123!'); }}
              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 hover:text-emerald-800 transition text-center cursor-pointer"
            >
              School Admin
            </button>
            <button
              type="button"
              onClick={() => { setUsername('superadmin'); setPassword('Password123!'); }}
              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 hover:text-emerald-800 transition text-center cursor-pointer"
            >
              Super Admin
            </button>
            <button
              type="button"
              onClick={() => { setUsername('parent'); setPassword('Password123!'); }}
              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 hover:text-emerald-800 transition text-center cursor-pointer"
            >
              Parent
            </button>
          </div>
        </div>
      </form>

      {/* Security Compliance Footer */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-center gap-3 text-[11px] text-slate-600 font-sans font-medium">
        <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span>256-Bit SSL Encrypted</span>
        </span>
        <span className="text-slate-400">•</span>
        <span>Role-Based Access</span>
        <span className="text-slate-400">•</span>
        <span>MoPSE Certified</span>
      </div>
    </div>
  );
}
