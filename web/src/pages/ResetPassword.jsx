import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2, ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../utils/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid reset link: Missing token. Please request a new link.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      setLoading(false);

      if (res.data?.success || res.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(res.error?.message || 'Failed to reset password. The link may have expired.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'An error occurred. The reset token might be expired or invalid.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-paper px-4 select-none">
      {/* Decorative background blur blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-teal-primary/10 blur-3xl animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-amber-warning/10 blur-3xl animate-pulse duration-[6000ms]" />

      <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-8 z-10 border border-line-border/30 relative">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-teal-primary/10 flex items-center justify-center border border-teal-primary/20 mb-4">
            <Shield className="w-7 h-7 text-teal-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-ink tracking-tight">
            New Password
          </h1>
          <p className="text-xs font-sans text-ink/60 mt-1">
            Choose a strong password (minimum 8 characters)
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs font-sans flex items-start space-x-2 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-4 rounded-xl bg-teal-primary/10 border border-teal-primary/20 text-teal-dark text-xs font-sans flex items-start space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-teal-primary" />
            <span>
              <strong>Password updated!</strong> Redirecting you to the login screen...
            </span>
          </div>
        )}

        {!token && (
          <div className="mb-5 p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs font-sans flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              No reset token found in URL. Please request a new reset link from the login page.
            </span>
          </div>
        )}

        {!success && token && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-semibold text-ink/75 uppercase tracking-wider mb-2" htmlFor="new-password">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-4 pr-10 py-3 rounded-xl glass-input text-ink font-sans text-sm focus:outline-none focus:ring-1 focus:ring-teal-primary"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
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

            <div>
              <label className="block text-xs font-sans font-semibold text-ink/75 uppercase tracking-wider mb-2" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                className="w-full px-4 py-3 rounded-xl glass-input text-ink font-sans text-sm focus:outline-none focus:ring-1 focus:ring-teal-primary"
                placeholder="Must match password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Change Password</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center border-t border-line-border/30 pt-4">
          <Link
            to="/login"
            className="inline-flex items-center text-xs text-teal-primary hover:underline font-sans font-medium space-x-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
