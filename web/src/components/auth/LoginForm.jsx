import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  School, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle,
  ShieldCheck
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
        setError(result.error || 'Invalid credentials. Please verify your details or contact your administrator.');
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

  return (
    <div className={`w-full transition-all duration-300 ${isShaking ? 'animate-shake' : ''}`}>
      {/* Brand Icon & Heading */}
      <div className="flex flex-col items-center text-center mb-7">
        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 border border-emerald-400/30 flex items-center justify-center text-white shadow-xl shadow-emerald-950/50 mb-3.5 group-hover:scale-105 transition-transform">
          <School className="w-6 h-6 text-emerald-100" />
        </div>

        <h2 className="text-2xl font-display font-extrabold text-white tracking-tight">
          Institutional Portal
        </h2>
        <p className="text-xs text-slate-400 mt-1.5 font-sans font-medium">
          Sign in to access your designated workspace
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 animate-fadeIn font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1 font-sans text-xs leading-relaxed">{error}</div>
        </div>
      )}

      {/* Form — Clean unified entry */}
      <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
        {/* Identifier Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-sans">
            Username or Email
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-400 transition-colors">
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
              placeholder="Enter your username or email"
              autoComplete="username"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700/80 bg-slate-950/70 text-white placeholder-slate-500 text-xs font-medium font-sans focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-inner transition-all"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 font-sans">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold hover:underline transition-colors font-sans"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-400 transition-colors">
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
              className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-700/80 bg-slate-950/70 text-white placeholder-slate-500 text-xs font-medium font-sans focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-inner transition-all"
            />

            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-emerald-400" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 hover:text-white font-medium font-sans">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
            />
            <span>Remember this device</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full mt-2 py-3.5 px-4 rounded-xl font-sans font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Authenticating…</span>
            </>
          ) : (
            <>
              <span>Sign In to Workspace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Security Compliance Footer */}
      <div className="mt-7 pt-5 border-t border-white/10 flex items-center justify-center gap-3 text-[11px] text-slate-400 font-sans font-medium">
        <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit SSL Encrypted</span>
        </span>
        <span className="text-slate-600">•</span>
        <span>Role-Isolated</span>
        <span className="text-slate-600">•</span>
        <span>MoPSE Certified</span>
      </div>
    </div>
  );
}
