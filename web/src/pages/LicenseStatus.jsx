import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { ShieldAlert, CheckCircle, RefreshCw, Calendar, Users, AlertTriangle, Key, Mail, Phone, Loader2 } from 'lucide-react';

const LicenseStatus = () => {
  const { activeSchoolId, user } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Renewal Request state
  const [preferredPlan, setPreferredPlan] = useState('full');
  const [contactPhone, setContactPhone] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');

  const fetchLicenseDetails = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setError('');
    api.get(`/schools/${activeSchoolId}/license`)
      .then(res => {
        if (res.data) {
          setData(res.data);
        } else {
          setError('Failed to load license details.');
        }
      })
      .catch(err => {
        console.error('Error fetching license info:', err);
        setError(err.message || 'Error connecting to license server.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLicenseDetails();
  }, [activeSchoolId]);

  const handleRequestRenewal = async (e) => {
    e.preventDefault();
    if (!activeSchoolId) return;
    setRequestLoading(true);
    setRequestSuccess('');
    setError('');

    try {
      const res = await api.post(`/schools/${activeSchoolId}/license/renewal-request`, {
        preferred_plan: preferredPlan,
        contact_phone: contactPhone
      });
      setRequestLoading(false);
      if (res.data?.success || res.success) {
        setRequestSuccess('Renewal request submitted! A support administrator has been notified.');
      } else {
        setError(res.error?.message || 'Failed to submit renewal request.');
      }
    } catch (err) {
      setRequestLoading(false);
      setError(err.message || 'Error submitting renewal request.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-primary" />
        <p className="text-xs text-ink/50 font-sans font-medium">Retrieving active school license metadata...</p>
      </div>
    );
  }

  const license = data?.license;
  const usage = data?.usage;
  const daysLeft = data?.days_left;
  const isExpired = data?.is_expired;
  const isExpiring = data?.is_expiring;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-ink">School License Status</h1>
        <p className="text-sm font-sans text-ink/65 mt-1">
          Monitor your school's authorization license, user limits, and term plans.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main License Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Plan / Expiration details */}
        <div className="md:col-span-2 glass-panel rounded-2xl p-6 border border-line-border/30 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold font-sans text-ink/50">Current Plan</span>
              <h2 className="text-2xl font-bold font-display text-ink capitalize">
                {license?.plan ? `${license.plan} Subscription` : 'No Active Plan'}
              </h2>
            </div>
            
            {/* Status Pill */}
            {license?.status === 'active' && !isExpiring && !isExpired && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-teal-primary/10 text-teal-dark border border-teal-primary/20 flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Authorized</span>
              </span>
            )}
            {isExpiring && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-warning/10 text-amber-warning border border-amber-warning/20 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                <span>Expiring Soon</span>
              </span>
            )}
            {isExpired && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-brick-critical/10 text-brick-critical border border-brick-critical/20 flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Expired / Suspended</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-line-border/30 pt-6">
            <div className="space-y-1 flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-ink/40 mt-1" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-ink/50">Expiration Date</span>
                <span className="text-sm font-sans font-semibold text-ink">
                  {license?.expires_at ? new Date(license.expires_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="space-y-1 flex items-start space-x-3">
              <RefreshCw className="w-5 h-5 text-ink/40 mt-1" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-ink/50">Days Remaining</span>
                <span className={`text-sm font-sans font-bold ${daysLeft <= 7 ? 'text-brick-critical' : daysLeft <= 30 ? 'text-amber-warning' : 'text-teal-dark'}`}>
                  {daysLeft !== null && daysLeft !== undefined ? `${daysLeft} Day(s)` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Grace Period Warning */}
          {daysLeft < 0 && daysLeft >= -14 && (
            <div className="p-4 rounded-xl bg-amber-warning/10 border border-amber-warning/30 text-amber-warning text-xs font-sans space-y-1">
              <p className="font-semibold">Grace Period Warning</p>
              <p className="leading-relaxed">
                Your license expired on {new Date(license.expires_at).toLocaleDateString()}. 
                You are currently within the 14-day grace period. Access will be suspended on {new Date(new Date(license.expires_at).getTime() + (14 * 24 * 60 * 60 * 1000)).toLocaleDateString()}.
              </p>
            </div>
          )}
        </div>

        {/* Usage limits */}
        <div className="glass-panel rounded-2xl p-6 border border-line-border/30 space-y-6">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold font-sans text-ink/50">Plan Quotas & Usage</span>
            <h3 className="text-lg font-bold font-display text-ink mt-1">Tenant Volume</h3>
          </div>

          <div className="space-y-4">
            {/* Users Limit */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-sans">
                <span className="text-ink/65 flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>Total Users Logins</span>
                </span>
                <span className="font-semibold text-ink">
                  {usage?.users} / {usage?.max_users || '∞'}
                </span>
              </div>
              <div className="w-full h-2 bg-ink/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    usage?.users >= usage?.max_users ? 'bg-brick-critical' : 'bg-teal-primary'
                  }`}
                  style={{ width: `${Math.min(100, (usage?.users / (usage?.max_users || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Enrolled Students */}
            <div className="space-y-1.5 border-t border-line-border/20 pt-4">
              <div className="flex justify-between text-xs font-sans">
                <span className="text-ink/65 flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>Enrolled Students</span>
                </span>
                <span className="font-semibold text-ink">
                  {usage?.enrolled_students} Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action / Renewal Request Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Form */}
        <div className="md:col-span-2 glass-panel rounded-2xl p-6 border border-line-border/30 space-y-4">
          <div className="flex items-center space-x-2 text-teal-primary">
            <Key className="w-5 h-5" />
            <h3 className="text-lg font-bold font-display text-ink">Request Subscription Renewal</h3>
          </div>
          <p className="text-xs font-sans text-ink/60">
            Submit a fast request to the platform supervisor. Once approved, the license updates automatically.
          </p>

          {requestSuccess && (
            <div className="p-4 rounded-xl bg-teal-primary/10 border border-teal-primary/20 text-teal-dark text-xs font-sans">
              {requestSuccess}
            </div>
          )}

          <form onSubmit={handleRequestRenewal} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-sans font-semibold text-ink/75 uppercase tracking-wider mb-2">
                  Preferred Plan
                </label>
                <select
                  value={preferredPlan}
                  onChange={(e) => setPreferredPlan(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input text-ink focus:outline-none focus:ring-1 focus:ring-teal-primary bg-transparent"
                >
                  <option value="basic">Basic School Roster (Up to 50 users)</option>
                  <option value="full">Standard Full Suite (Up to 250 users)</option>
                  <option value="premium">Enterprise Unlimited (Infinite users)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-semibold text-ink/75 uppercase tracking-wider mb-2">
                  Callback Phone Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +263 77 123 4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input text-ink focus:outline-none focus:ring-1 focus:ring-teal-primary bg-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={requestLoading}
              className="px-5 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-xs rounded-xl shadow hover:shadow-teal-primary/20 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {requestLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting request...</span>
                </>
              ) : (
                <span>Submit Renewal Request</span>
              )}
            </button>
          </form>
        </div>

        {/* Support Card */}
        <div className="glass-panel rounded-2xl p-6 border border-line-border/30 space-y-4">
          <h3 className="text-lg font-bold font-display text-ink">System Support</h3>
          <p className="text-xs font-sans text-ink/65 leading-relaxed">
            Need urgent assistance or want to process payment via EcoCash / Paynow manually? Get in touch with our licensing department:
          </p>

          <div className="space-y-3 pt-2 text-xs font-sans">
            <div className="flex items-center space-x-2.5 text-ink/70">
              <Mail className="w-4 h-4 text-teal-primary" />
              <span>licensing@schoolbase.co.zw</span>
            </div>
            <div className="flex items-center space-x-2.5 text-ink/70">
              <Phone className="w-4 h-4 text-teal-primary" />
              <span>+263 (242) 777-888</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LicenseStatus;
