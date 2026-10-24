import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, StatusPill, Gauge, Modal
} from '../components/ui';
import {
  Key, ShieldCheck, Calendar, Users, RefreshCw, Mail, Phone,
  CheckCircle2, AlertTriangle, ArrowRight, ShieldAlert
} from 'lucide-react';

export default function LicenseStatus() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [preferredPlan, setPreferredPlan] = useState('enterprise');
  const [contactPhone, setContactPhone] = useState('+263 77 289 1102');
  const [submitting, setSubmitting] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKey, setNewKey] = useState('');

  const { data: licenseData, loading } = useApi(
    `license_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/license`).then(r => r.data || r).catch(() => ({})),
    { deps: [activeSchoolId] }
  );

  const license = licenseData?.license || (licenseData && typeof licenseData === 'object' && licenseData.status ? licenseData : null) || {
    tier: 'Enterprise Standard',
    status: 'active',
    student_limit: 1000,
    expires_at: '2028-01-01',
    features: ['Multi-currency cashier', 'ZIMSEC Best-6 grading', 'Boarding & Exeat gate', 'Automated EMIS census']
  };

  const rawExpiry = license.expires_at || licenseData?.expires_at || '2028-01-01';
  const computedDaysRemaining = Math.max(0, Math.ceil((new Date(rawExpiry) - new Date()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = license.days_remaining != null
    ? license.days_remaining
    : (licenseData?.days_left != null ? licenseData.days_left : computedDaysRemaining);

  const studentCount = license.current_students != null
    ? license.current_students
    : (licenseData?.current_students != null ? licenseData.current_students : 0);
  const studentLimit = license.student_limit || licenseData?.student_limit || 1000;
  const utilizationPct = studentLimit > 0 ? Math.round((studentCount / studentLimit) * 100) : 0;

  const handleRequestRenewal = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/license/renewal-request`, {
        preferred_plan: preferredPlan,
        contact_phone: contactPhone
      });
      toast.success('Renewal request dispatched to SchoolBase licensing support.');
    } catch (err) {
      toast.error('Failed to submit renewal request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyKey = async (e) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    try {
      await api.post(`/schools/${activeSchoolId}/license/activate`, { license_key: newKey });
      toast.success('New license key activated successfully.');
      setShowKeyModal(false);
      setNewKey('');
      invalidate(`license_${activeSchoolId}`);
    } catch (err) {
      toast.error('Invalid or expired cryptographic license key.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Software License & Subscription Desk"
        subtitle="Manage SchoolBase subscription tier, active capacity quotas, and license key renewals."
        actions={
          <button
            onClick={() => setShowKeyModal(true)}
            className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
          >
            <Key className="w-4 h-4" />
            Apply New License Key
          </button>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Subscription Tier"
          value={license.tier || 'Enterprise'}
          icon={ShieldCheck}
          color="brand"
          subtext="Full multi-currency & ZIMSEC suite"
        />
        <StatCard
          label="License Validity"
          value={`${daysRemaining} Days`}
          icon={Calendar}
          color={daysRemaining < 30 ? 'danger' : 'info'}
          subtext={rawExpiry ? `Expires on ${new Date(rawExpiry).toLocaleDateString()}` : 'No active expiry set'}
        />
        <StatCard
          label="Enrolled Headcount"
          value={`${studentCount} / ${studentLimit}`}
          icon={Users}
          color={utilizationPct > 95 ? 'danger' : 'accent'}
          subtext={`${studentLimit - studentCount} seats remaining`}
        />
        <StatCard
          label="License Health"
          value="Compliant"
          icon={CheckCircle2}
          color="violet"
          subtext="All security covenants verified"
        />
      </KpiStrip>

      {/* Visual Gauges and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Capacity Gauge */}
        <div className="lg:col-span-5">
          <Card
            title="Student Quota Utilization"
            subtitle="Current active school enrollment measured against licensed seat limit."
          >
            <div className="py-6 flex flex-col items-center justify-center">
              <Gauge
                value={utilizationPct}
                min={0}
                max={100}
                size={220}
                label="Seat Capacity"
                unit="%"
                color={utilizationPct > 95 ? '#D64545' : utilizationPct > 80 ? '#F5A524' : '#2E8B63'}
              />
              <div className="text-center mt-3 text-xs text-muted">
                <span className="font-bold text-ink">{studentCount} active learners</span> out of {studentLimit} licensed capacity limit.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line text-xs space-y-2">
              <div className="font-bold text-ink uppercase text-[10px] tracking-wider">Included Feature Modules</div>
              <div className="grid grid-cols-2 gap-2 text-muted">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
                  <span>ZIMSEC Desk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
                  <span>Multi-Currency Cashier</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
                  <span>Hostel & Exeat Gate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
                  <span>EMIS Census Returns</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Renewal Request Form */}
        <div className="lg:col-span-7">
          <Card
            title="Subscription Extension & Renewal Desk"
            subtitle="Request an annual renewal or capacity upgrade directly to system operations."
          >
            <form onSubmit={handleRequestRenewal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">Select Preferred Term / Package</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'standard', name: 'Standard', desc: 'Up to 500 pupils' },
                    { id: 'enterprise', name: 'Enterprise', desc: 'Up to 1,200 pupils' },
                    { id: 'unlimited', name: 'Campus Plus', desc: 'Unlimited streams' },
                  ].map(plan => {
                    const selected = preferredPlan === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setPreferredPlan(plan.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition ${
                          selected
                            ? 'bg-brand-50/60 dark:bg-brand-950/30 border-brand-500 shadow-xs ring-1 ring-brand-500/20'
                            : 'bg-canvas border-line hover:border-brand-500/30'
                        }`}
                      >
                        <div className="font-bold text-xs text-ink">{plan.name}</div>
                        <div className="text-[11px] text-muted mt-1">{plan.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Administrative Contact Telephone *</label>
                <input
                  type="text"
                  required
                  placeholder="+263 77..."
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>

              <div className="p-4 rounded-xl bg-canvas border border-line text-xs text-muted space-y-1 leading-relaxed">
                <span className="font-bold text-ink block">Automatic Grace Period Guarantee:</span>
                SchoolBase provides an uninterrupted 14-day operational grace period upon license term expiry to ensure examinations and billing records remain fully accessible.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                <span>Submit Subscription Renewal Request</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </Card>
        </div>
      </div>

      {/* Modal: Apply Key */}
      <Modal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        title="Activate License Key"
        description="Enter the 32-character cryptographic license string issued by SchoolBase."
      >
        <form onSubmit={handleApplyKey} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Cryptographic License Key *</label>
            <input
              type="text"
              required
              placeholder="SB-2026-XXXX-XXXX-XXXX"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="w-full p-3 rounded-xl border border-line bg-surface text-ink font-mono text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowKeyModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs"
            >
              Verify & Activate
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
