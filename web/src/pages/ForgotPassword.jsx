import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

const ForgotPassword = () => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resetLink, setResetLink] = useState(''); // Helpful for admins to grab immediately

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setResetLink('');
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { username });
      setLoading(false);
      
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Reset link generated successfully.');
        if (res.data.reset_link) {
          setResetLink(res.data.reset_link);
        }
      } else {
        setError(res.error?.message || 'Could not process request.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'An error occurred. Please check database connection.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-paper px-4 select-none">
      {/* Decorative background blur blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-teal-primary/10 blur-3xl animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-amber-warning/10 blur-3xl animate-pulse duration-[6000ms]" />

      {/* Main card */}
      <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-8 z-10 border border-line-border/30 relative">
        
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-teal-primary/10 flex items-center justify-center border border-teal-primary/20 mb-4">
            <Shield className="w-7 h-7 text-teal-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-ink tracking-tight">
            Reset Password
          </h1>
          <p className="text-xs font-sans text-ink/60 mt-1">Request a secure password reset link</p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs font-sans flex items-start space-x-2 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-4 rounded-xl bg-teal-primary/10 border border-teal-primary/20 text-teal-dark text-xs font-sans space-y-3 animate-fadeIn">
            <div className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-teal-primary" />
              <span>{successMsg}</span>
            </div>
            {resetLink && (
              <div className="bg-paper p-3 rounded-lg border border-teal-primary/20 select-all font-mono text-[10px] break-all">
                {resetLink}
              </div>
            )}
            {resetLink && (
              <p className="text-[10px] text-ink/50 leading-relaxed font-sans mt-1">
                Copy the link above and share it securely with the user (e.g. via SMS or WhatsApp).
              </p>
            )}
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-sans font-semibold text-ink/75 uppercase tracking-wider mb-2" htmlFor="username">
                Your Username
              </label>
              <input
                id="username"
                type="text"
                className="w-full px-4 py-3 rounded-xl glass-input text-ink font-sans text-sm focus:outline-none focus:ring-1 focus:ring-teal-primary"
                placeholder="e.g. schooladmin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
                autoFocus
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
                <span>Request Reset Link</span>
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

export default ForgotPassword;
