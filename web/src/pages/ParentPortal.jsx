import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Calendar, GraduationCap, CreditCard, ChevronRight,
  Loader2, CheckCircle2, AlertTriangle, MessageSquare, DollarSign, X
} from 'lucide-react';

const ParentPortal = () => {
  const { activeSchoolId } = useAuth();
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [childProfile, setChildProfile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: '',
    currency: 'USD', // USD, ZiG, ZAR
    method: 'ecocash',
    phone_number: '' // for mobile money
  });
  const [paying, setPaying] = useState(false);

  const getExchangeRate = (curr) => {
    if (curr === 'ZiG') return 25.0000;
    if (curr === 'ZAR') return 18.0000;
    return 1.0000;
  };

  const getConvertedUSD = () => {
    const rate = getExchangeRate(paymentForm.currency);
    const val = Number(paymentForm.amount_paid) || 0;
    return (val / rate).toFixed(2);
  };

  // Fetch children list on mount
  useEffect(() => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/students`)
      .then(res => {
        // Parents get auto-filtered students matching their parent record
        const list = res.data?.data || res.data || [];
        setChildren(list);
        if (list.length > 0) {
          setSelectedChildId(list[0].id);
        }
      })
      .catch(err => {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to load child profiles linked to your account.' });
      })
      .finally(() => setLoading(false));
  }, [activeSchoolId]);

  // Fetch child profile when selected child ID changes
  useEffect(() => {
    if (!activeSchoolId || !selectedChildId) return;
    setLoadingProfile(true);
    setChildProfile(null);
    api.get(`/schools/${activeSchoolId}/students/${selectedChildId}/profile`)
      .then(res => {
        if (res.data) {
          setChildProfile(res.data);
          // Set outstanding fee amount as default payment value (converted to currency)
          const due = Number(res.data.feeSummary?.amount_due || 0) - Number(res.data.feeSummary?.amount_paid || 0);
          setPaymentForm(prev => ({
            ...prev,
            amount_paid: due > 0 ? String(Math.ceil(due * getExchangeRate(prev.currency))) : '100'
          }));
        }
      })
      .catch(err => {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to load details for the selected student.' });
      })
      .finally(() => setLoadingProfile(false));
  }, [activeSchoolId, selectedChildId]);

  // Update default payment amount whenever selected currency changes
  useEffect(() => {
    if (!childProfile?.feeSummary) return;
    const due = Number(childProfile.feeSummary.amount_due || 0) - Number(childProfile.feeSummary.amount_paid || 0);
    const rate = getExchangeRate(paymentForm.currency);
    setPaymentForm(prev => ({
      ...prev,
      amount_paid: due > 0 ? String(Math.ceil(due * rate)) : String(Math.ceil(100 * rate))
    }));
  }, [paymentForm.currency]);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!childProfile?.feeSummary?.id) return;
    const amount = Number(paymentForm.amount_paid);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    setPaying(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        amount_paid: amount,
        currency: paymentForm.currency,
        method: paymentForm.method,
        idempotency_key: 'online-pay-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
      };
      
      const res = await api.post(`/schools/${activeSchoolId}/fees/${childProfile.feeSummary.id}/pay-online`, payload);
      if (res.data) {
        setMessage({ 
          type: 'success', 
          text: `Success! Paid ${amount} ${paymentForm.currency} via ${paymentForm.method.toUpperCase()}. Reference: ${res.data.reference}` 
        });
        setShowPaymentModal(false);
        
        // Reload profile to show updated fees
        const updated = await api.get(`/schools/${activeSchoolId}/students/${selectedChildId}/profile`);
        setChildProfile(updated.data);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Transaction failed.' });
    } finally {
      setPaying(false);
    }
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 75) return 'bg-sage/40 text-teal-dark';
    if (score >= 50) return 'bg-amber-warning/10 text-amber-warning';
    return 'bg-brick-critical/15 text-brick-critical';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Parent Portal</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Academic progress, attendance sheets, and payments portal.</p>
        </div>

        {/* Child Selector */}
        {children.length > 0 && (
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-ink/50 uppercase tracking-wider">Select Child:</label>
            <select
              value={selectedChildId}
              onChange={e => setSelectedChildId(e.target.value)}
              className="bg-paper border border-line-border text-ink text-xs font-sans font-bold rounded-xl px-4 py-2 focus:outline-none focus:border-teal-primary"
            >
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.admission_number})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 border ${
          message.type === 'success' ? 'bg-sage/20 text-teal-dark border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border-brick-critical/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-teal-primary" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {loading || loadingProfile ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary" />
        </div>
      ) : childProfile ? (
        <div className="space-y-8">
          {/* Pupil Summary Row */}
          <div className="glass-panel p-6 rounded-2xl border border-line-border/30 grid grid-cols-1 md:grid-cols-4 gap-6 bg-sage/5">
            <div>
              <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Pupil Name</span>
              <h3 className="text-lg font-display font-bold text-ink mt-1">
                {childProfile.student?.first_name} {childProfile.student?.last_name}
              </h3>
            </div>
            <div>
              <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Classroom</span>
              <p className="text-base font-sans font-semibold text-teal-dark mt-1">
                {childProfile.student?.class_name || 'Unassigned'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Admission Number</span>
              <p className="text-base font-mono font-semibold text-ink mt-1">
                {childProfile.student?.admission_number}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Account Status</span>
              <p className="text-base font-sans font-semibold text-ink/80 mt-1 capitalize">
                {childProfile.student?.status}
              </p>
            </div>
          </div>

          {/* Academic and Payments Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Col: Fees, Attendance & Transactions */}
            <div className="space-y-6">
              {/* Fee Balance Card */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
                <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3">
                  <CreditCard className="w-5 h-5" />
                  <h3 className="text-sm font-sans font-bold text-ink">Zimbabwean Fees Balance</h3>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Term Total</span>
                    <p className="text-lg font-mono font-bold text-ink">${childProfile.feeSummary?.amount_due || 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Paid Amount</span>
                    <p className="text-lg font-mono font-bold text-teal-primary">${childProfile.feeSummary?.amount_paid || 0}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider block mb-2">Payment Status</span>
                  <div className="flex justify-between items-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      childProfile.feeSummary?.status === 'cleared' || childProfile.feeSummary?.status === 'paid' ? 'bg-sage/40 text-teal-dark' :
                      childProfile.feeSummary?.status === 'partial' ? 'bg-amber-warning/10 text-amber-warning' : 'bg-brick-critical/10 text-brick-critical'
                    }`}>
                      {childProfile.feeSummary?.status === 'cleared' ? 'CLEARED' : (childProfile.feeSummary?.status || 'UNPAID')}
                    </span>
                    
                    {childProfile.feeSummary?.status !== 'cleared' && childProfile.feeSummary?.status !== 'paid' && childProfile.feeSummary?.id && (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="px-3.5 py-1.5 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                      >
                        Pay Fees Online
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendance Tracker */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
                <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3">
                  <Calendar className="w-5 h-5" />
                  <h3 className="text-sm font-sans font-bold text-ink">Attendance Log Summary</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-sage/5 rounded-xl border border-line-border/25">
                    <span className="text-[9px] font-bold text-teal-dark block">Present</span>
                    <span className="text-base font-bold text-teal-dark mt-1 block">
                      {childProfile.attendanceSummary?.present || 0}
                    </span>
                  </div>
                  <div className="p-2 bg-brick-critical/5 rounded-xl border border-line-border/25">
                    <span className="text-[9px] font-bold text-brick-critical block">Absent</span>
                    <span className="text-base font-bold text-brick-critical mt-1 block">
                      {childProfile.attendanceSummary?.absent || 0}
                    </span>
                  </div>
                  <div className="p-2 bg-teal-primary/5 rounded-xl border border-line-border/25">
                    <span className="text-[9px] font-bold text-teal-primary block">Rate</span>
                    <span className="text-base font-bold text-teal-primary mt-1 block">
                      {childProfile.attendanceSummary?.percentage || 100}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment History Log */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
                <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3">
                  <CreditCard className="w-5 h-5" />
                  <h3 className="text-sm font-sans font-bold text-ink">Recent Transactions Log</h3>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {(childProfile.feePayments || []).map((pay) => (
                    <div key={pay.id} className="p-3 bg-sage/5 rounded-xl border border-line-border/20 text-[11px] space-y-1">
                      <div className="flex justify-between font-bold text-ink">
                        <span>{pay.payment_method.replace('_', ' ').toUpperCase()}</span>
                        <span className="text-teal-dark">${pay.amount_paid} USD</span>
                      </div>
                      <div className="flex justify-between text-ink/50 font-mono text-[9px]">
                        <span>Ref: {pay.reference || 'N/A'}</span>
                        <span>{pay.payment_date.substring(0, 10)}</span>
                      </div>
                      {pay.payment_currency && pay.payment_currency !== 'USD' && (
                        <p className="text-[9px] text-teal-primary/80 font-sans font-semibold">
                          Paid: {pay.amount_in_payment_currency} {pay.payment_currency} (Rate: {pay.exchange_rate})
                        </p>
                      )}
                    </div>
                  ))}
                  {(!childProfile.feePayments || childProfile.feePayments.length === 0) && (
                    <p className="text-center py-6 text-ink/40 text-[11px]">No transactions recorded for this term.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Right Col: Coursework Raw Grades */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3">
                <GraduationCap className="w-5 h-5" />
                <h3 className="text-sm font-sans font-bold text-ink">Academic Assessment Sheets</h3>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-line-border/30 rounded-xl">
                <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                  <thead className="bg-ink/5 border-b border-line-border/30 sticky top-0">
                    <tr className="text-ink/60 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Term</th>
                      <th className="py-2.5 px-4">Assessment</th>
                      <th className="py-2.5 px-4 text-right pr-4">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/20">
                    {(childProfile.gradesSummary || []).map((grade, index) => (
                      <tr key={index} className="hover:bg-sage/5 transition-colors">
                        <td className="py-3 px-4 font-bold text-ink">{grade.subject}</td>
                        <td className="py-3 px-4 text-ink/55 font-mono">{grade.term}</td>
                        <td className="py-3 px-4 text-ink/75 capitalize font-semibold">{grade.assessment_name || grade.assessment_type}</td>
                        <td className="py-3 px-4 text-right pr-4">
                          <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded ${getScoreBadgeColor(grade.grade_value)}`}>
                            {grade.grade_value}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!childProfile.gradesSummary || childProfile.gradesSummary.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-ink/40 italic">
                          No assessment grades posted for this student yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-ink/40 text-sm">
          No child records found linked to your parent user ID.
        </div>
      )}

      {/* Mock Payments Modal */}
      {showPaymentModal && childProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6 relative animate-scaleUp">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-lg font-display font-bold text-ink">Simulate Payment Portal</h3>
              <p className="text-xs text-ink/50 mt-0.5">Zimbabwean digital payment gateway simulator</p>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Currency</label>
                  <select
                    value={paymentForm.currency}
                    onChange={e => setPaymentForm({ ...paymentForm, currency: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ZiG">ZiG (Zimbabwe Gold)</option>
                    <option value="ZAR">ZAR (South African Rand)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Gateway Provider</label>
                  <select
                    value={paymentForm.method}
                    onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                  >
                    <option value="ecocash">EcoCash Wallet</option>
                    <option value="innbucks">InnBucks Wallet</option>
                    <option value="paynow">Paynow Gateway</option>
                    <option value="bank_transfer">Zim Bank Transfer</option>
                  </select>
                </div>
              </div>

              {paymentForm.method !== 'bank_transfer' && (
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Mobile Money Number / Wallet ID *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +263771122334"
                    className="w-full glass-input rounded-xl text-xs"
                    value={paymentForm.phone_number}
                    onChange={e => setPaymentForm({ ...paymentForm, phone_number: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">
                  Amount in {paymentForm.currency} *
                </label>
                <div className="relative">
                  <span className="text-ink/40 absolute left-3 top-3 text-xs font-bold font-mono">
                    {paymentForm.currency === 'USD' ? '$' : paymentForm.currency === 'ZiG' ? 'ZiG' : 'R'}
                  </span>
                  <input
                    type="number"
                    min="1"
                    required
                    className="pl-12 w-full glass-input rounded-xl text-xs font-mono font-bold"
                    value={paymentForm.amount_paid}
                    onChange={e => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                  />
                </div>
                {paymentForm.currency !== 'USD' && (
                  <p className="text-[10px] text-teal-primary font-sans font-semibold mt-1">
                    Rate: 1 USD = {getExchangeRate(paymentForm.currency)} {paymentForm.currency}. Est. Credited: ${getConvertedUSD()} USD.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={paying}
                className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Process Payment</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentPortal;
