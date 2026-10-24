import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Calendar, GraduationCap, CreditCard, ChevronRight,
  Loader2, CheckCircle2, AlertTriangle, MessageSquare, DollarSign, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const SUBJECT_BAR_COLORS = [
  '#2563eb', // Royal Blue
  '#0d9488', // Emerald Teal
  '#7c3aed', // Purple / Violet
  '#ea580c', // Coral Orange
  '#0284c7', // Sky Blue
  '#16a34a', // Fresh Green
  '#d97706', // Warm Amber
  '#db2777', // Magenta Rose
  '#4f46e5'  // Deep Indigo
];

const ParentPortal = () => {
  const { activeSchoolId } = useAuth();
  const toast = useToast();

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
    phone_number: '', // for mobile money
    cashier_name: '',  // for cash payment
    receipt_number: '' // for cash payment
  });
  const [paying, setPaying] = useState(false);

  // Residence application state
  const [residenceNotes, setResidenceNotes] = useState('');
  const [applyingResidence, setApplyingResidence] = useState(false);
  const [residenceSuccess, setResidenceSuccess] = useState('');

  const handleApplyResidence = async (e) => {
    e.preventDefault();
    if (!selectedChildId) return;
    setApplyingResidence(true);
    setResidenceSuccess('');
    try {
      await api.post('/hostels/applications', {
        student_id: selectedChildId,
        notes: residenceNotes || 'Parent application for boarding residence'
      });
      setResidenceSuccess('Residence accommodation application submitted to school administration successfully.');
      setResidenceNotes('');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message || 'Failed to submit residence application.' });
    } finally {
      setApplyingResidence(false);
    }
  };

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

  const [searchParams] = useSearchParams();

  // Fetch children list on mount
  useEffect(() => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/students`)
      .then(res => {
        const rawList = res.data?.data || res.data || [];
        const dedupeMap = new Map();
        rawList.forEach(c => { if (c && c.id) dedupeMap.set(c.id, c); });
        const list = Array.from(dedupeMap.values());
        setChildren(list);

        const queryChild = searchParams.get('child');
        const matched = list.find(c => c.id === queryChild);
        if (matched) {
          setSelectedChildId(matched.id);
        } else if (list.length > 0) {
          setSelectedChildId(list[0].id);
        }

        if (searchParams.get('action') === 'pay') {
          setShowPaymentModal(true);
        }
      })
      .catch(err => {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to load child profiles linked to your account.' });
      })
      .finally(() => setLoading(false));
  }, [activeSchoolId, searchParams]);

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
    if (!selectedChildId) {
      toast.warning('Please select a learner to declare payment for.');
      return;
    }
    const amount = Number(paymentForm.amount_paid);
    if (isNaN(amount) || amount <= 0) {
      toast.warning('Please enter a valid positive payment amount.');
      return;
    }

    const isOffline = paymentForm.method === 'cash' || paymentForm.method === 'bank_transfer';

    if (isOffline && !paymentForm.cashier_name.trim()) {
      toast.warning(paymentForm.method === 'cash' ? 'Please enter the receiving cashier or officer name.' : 'Please enter the bank and branch/sender name.');
      return;
    }

    setPaying(true);
    setMessage({ type: '', text: '' });
    try {
      let res;

      if (isOffline) {
        // Cash or Bank deposit declaration – records payment into remote_payments pending bursar clearance
        const declRef = paymentForm.receipt_number.trim() || ((paymentForm.method === 'cash' ? 'CSH-' : 'BNK-') + Date.now().toString(36).toUpperCase());
        res = await api.post(`/schools/${activeSchoolId}/remote-payments`, {
          student_id: selectedChildId,
          fee_id: childProfile?.feeSummary?.id || null,
          amount_paid: amount,
          currency: paymentForm.currency,
          payment_method: paymentForm.method,
          method: paymentForm.method,
          reference: declRef,
          cashier_name: paymentForm.cashier_name,
          notes: `${paymentForm.method === 'cash' ? 'Cash payment' : 'Bank transfer deposit'} declared by parent. Officer/Bank: ${paymentForm.cashier_name}. Ref: ${declRef}`,
          idempotency_key: 'decl-pay-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
        });
      } else {
        if (childProfile?.feeSummary?.id) {
          res = await api.post(`/schools/${activeSchoolId}/fees/${childProfile.feeSummary.id}/pay-online`, {
            amount_paid: amount,
            currency: paymentForm.currency,
            method: paymentForm.method,
            idempotency_key: 'online-pay-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
          });
        } else {
          // If no invoice yet, create remote payment declaration
          const onlineRef = (paymentForm.method === 'ecocash' ? 'ECO-' : 'INB-') + Date.now().toString(36).toUpperCase();
          res = await api.post(`/schools/${activeSchoolId}/remote-payments`, {
            student_id: selectedChildId,
            amount_paid: amount,
            currency: paymentForm.currency,
            payment_method: paymentForm.method,
            phone_number: paymentForm.phone_number,
            reference: onlineRef,
            notes: `Online payment via ${paymentForm.method.toUpperCase()} for student ${selectedChildId}`,
            idempotency_key: 'online-pay-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
          });
        }
      }

      if (res.data) {
        const refNumber = res.data.data?.reference || res.data.reference || 'Pending';
        setMessage({ 
          type: 'success', 
          text: isOffline
            ? `Payment declaration submitted! Ref: ${refNumber}. The bursar desk will reconcile and clear your receipt.`
            : `Payment initiated! ${amount} ${paymentForm.currency} via ${paymentForm.method.toUpperCase()}. Ref: ${refNumber}`
        });
        toast.success(isOffline ? 'Fee payment declaration submitted for bursar clearance!' : 'Payment processed successfully!');
        setShowPaymentModal(false);
        
        // Reload profile to show updated fees
        const updated = await api.get(`/schools/${activeSchoolId}/students/${selectedChildId}/profile`);
        setChildProfile(updated.data);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Transaction failed.' });
      toast.error(err.response?.data?.message || 'Payment submission failed.');
    } finally {
      setPaying(false);
    }
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 75) return 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
    if (score >= 50) return 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300';
    return 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300';
  };

  const childGrades = childProfile?.grades || childProfile?.gradesSummary || [];
  const subjectScores = Object.values(childGrades.reduce((acc, grade) => {
    const subject = grade.subject_name || grade.subject || 'Unspecified';
    const score = Number(grade.grade_value ?? grade.average);
    if (!Number.isFinite(score)) return acc;
    if (!acc[subject]) acc[subject] = { subject, total: 0, count: 0 };
    acc[subject].total += score;
    acc[subject].count += 1;
    return acc;
  }, {})).map(item => ({ subject: item.subject, average: Number((item.total / item.count).toFixed(1)) }));
  const attendanceData = [
    { name: 'Present', value: Number(childProfile?.attendanceSummary?.present || 0), color: '#16827a' },
    { name: 'Late', value: Number(childProfile?.attendanceSummary?.late || 0), color: '#c77b18' },
    { name: 'Absent', value: Number(childProfile?.attendanceSummary?.absent || 0), color: '#c73a4a' }
  ].filter(item => item.value > 0);
  const feeData = [
    { name: 'Paid', value: Number(childProfile?.feeSummary?.amount_paid || 0), color: '#16827a' },
    { name: 'Balance', value: Math.max(0, Number(childProfile?.feeSummary?.amount_due || 0) - Number(childProfile?.feeSummary?.amount_paid || 0)), color: '#c77b18' }
  ].filter(item => item.value > 0);

  return (
    <div className="module-page parent-page p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-line pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Parent Portal</h2>
          <p className="text-sm font-sans text-muted font-medium mt-1">Academic progress, attendance sheets, and payments portal.</p>
        </div>

        {/* Child Selector */}
        {children.length > 0 && (
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Select Child:</label>
            <select
              value={selectedChildId}
              onChange={e => setSelectedChildId(e.target.value)}
              className="bg-surface border border-line text-ink text-xs font-sans font-bold rounded-xl px-4 py-2 focus:outline-none focus:border-teal-primary shadow-xs"
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
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 border font-medium ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30' : 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
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
          <div className="glass-panel p-6 rounded-2xl border border-line grid grid-cols-1 md:grid-cols-4 gap-6 bg-surface shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Pupil Name</span>
              <h3 className="text-lg font-display font-bold text-ink mt-1">
                {childProfile.student?.first_name} {childProfile.student?.last_name}
              </h3>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Classroom</span>
              <p className="text-base font-sans font-bold text-teal-primary mt-1">
                {childProfile.student?.class_name || 'Unassigned'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Admission Number</span>
              <p className="text-base font-mono font-bold text-ink mt-1">
                {childProfile.student?.admission_number}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Account Status</span>
              <p className="text-base font-sans font-bold text-ink mt-1 capitalize">
                {childProfile.student?.status}
              </p>
            </div>
          </div>

          {/* Academic and Payments Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Col: Fees, Attendance & Transactions */}
            <div className="space-y-6">
              {/* Fee Balance Card */}
              <div className="glass-panel p-6 rounded-2xl border border-line space-y-4 shadow-sm">
                <div className="flex items-center space-x-2 text-teal-primary border-b border-line pb-3">
                  <CreditCard className="w-5 h-5 text-teal-primary" />
                  <h3 className="text-sm font-sans font-bold text-ink">Zimbabwean Fees Balance</h3>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Term Total</span>
                    <p className="text-xl font-mono font-bold text-ink mt-0.5">${childProfile.feeSummary?.amount_due || 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Paid Amount</span>
                    <p className="text-xl font-mono font-bold text-teal-primary mt-0.5">${childProfile.feeSummary?.amount_paid || 0}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Payment Status</span>
                  <div className="flex justify-between items-center">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      childProfile.feeSummary?.status === 'cleared' || childProfile.feeSummary?.status === 'paid'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' :
                      childProfile.feeSummary?.status === 'partial'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300' :
                        'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    }`}>
                      {childProfile.feeSummary?.status === 'cleared' ? 'CLEARED' : (childProfile.feeSummary?.status || 'UNPAID')}
                    </span>
                    
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Declare / Pay Fees
                    </button>
                  </div>
                </div>
              </div>

              {/* Attendance Tracker */}
              <div className="glass-panel p-6 rounded-2xl border border-line space-y-4 shadow-sm">
                <div className="flex items-center space-x-2 text-teal-primary border-b border-line pb-3">
                  <Calendar className="w-5 h-5 text-teal-primary" />
                  <h3 className="text-sm font-sans font-bold text-ink">Attendance Log Summary</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block uppercase tracking-wider">Present</span>
                    <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-1 block">
                      {childProfile.attendanceSummary?.present || 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/30">
                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block uppercase tracking-wider">Absent</span>
                    <span className="text-lg font-bold text-rose-800 dark:text-rose-200 mt-1 block">
                      {childProfile.attendanceSummary?.absent || 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/30">
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 block uppercase tracking-wider">Rate</span>
                    <span className="text-lg font-bold text-teal-800 dark:text-teal-200 mt-1 block">
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
                        <span>Ref: {pay.reference || '-'}</span>
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

              {/* Residence Accommodation Application */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 space-y-4">
                <div className="flex items-center space-x-2 text-teal-primary border-b border-line-border/20 pb-3">
                  <span className="text-base">🛏️</span>
                  <h3 className="text-sm font-sans font-bold text-ink">Boarding Residence Application</h3>
                </div>

                <form onSubmit={handleApplyResidence} className="space-y-3">
                  <p className="text-[11px] text-ink/60 font-sans">
                    Apply for boarding house / hostel residence accommodation for {childProfile?.student?.first_name || 'your child'}.
                  </p>
                  <div>
                    <label className="block text-[9px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Special Requirements / Notes</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Dietary preferences, medical notes, or room preference..."
                      className="w-full glass-input rounded-xl text-xs"
                      value={residenceNotes}
                      onChange={e => setResidenceNotes(e.target.value)}
                    />
                  </div>
                  {residenceSuccess && (
                    <p className="text-xs font-semibold text-teal-dark bg-sage/20 p-2 rounded-lg border border-teal-primary/20">
                      {residenceSuccess}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={applyingResidence}
                    className="w-full py-2 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-bold shadow transition-colors cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {applyingResidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Submit Residence Application</span>}
                  </button>
                </form>
              </div>

            </div>
            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-line space-y-4 shadow-sm">
              <div className="flex items-center space-x-2 text-teal-primary border-b border-line pb-3">
                <GraduationCap className="w-5 h-5 text-teal-primary" />
                <h3 className="text-sm font-sans font-bold text-ink">Academic Assessment Sheets</h3>
              </div>

              {(subjectScores.length > 0 || attendanceData.length > 0 || feeData.length > 0) && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {subjectScores.length > 0 && (
                    <div className="border border-line rounded-xl p-4 bg-surface/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Average by subject</p>
                      <ResponsiveContainer width="100%" height={210}>
                        <BarChart data={subjectScores} margin={{ top: 8, right: 8, left: -20, bottom: 32 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.3} />
                          <XAxis dataKey="subject" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip
                            formatter={(value) => [`${value}%`, 'Subject Average']}
                            contentStyle={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--line)',
                              color: 'var(--ink)',
                              borderRadius: '0.75rem',
                              fontSize: '11px',
                              fontWeight: 600,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}
                          />
                          <Bar dataKey="average" radius={[6, 6, 0, 0]}>
                            {subjectScores.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={SUBJECT_BAR_COLORS[index % SUBJECT_BAR_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {attendanceData.length > 0 && (
                    <div className="border border-line rounded-xl p-4 bg-surface/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Attendance distribution</p>
                      <ResponsiveContainer width="100%" height={210}>
                        <PieChart>
                          <Pie data={attendanceData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3}>
                            {attendanceData.map(item => <Cell key={item.name} fill={item.color} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--line)',
                              color: 'var(--ink)',
                              borderRadius: '0.75rem',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, color: 'var(--ink)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {feeData.length > 0 && (
                    <div className="border border-line rounded-xl p-4 bg-surface/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Fee position</p>
                      <ResponsiveContainer width="100%" height={210}>
                        <PieChart>
                          <Pie data={feeData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3}>
                            {feeData.map(item => <Cell key={item.name} fill={item.color} />)}
                          </Pie>
                          <Tooltip
                            formatter={value => `$${Number(value).toFixed(2)}`}
                            contentStyle={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--line)',
                              color: 'var(--ink)',
                              borderRadius: '0.75rem',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, color: 'var(--ink)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-line rounded-xl">
                <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                  <thead className="bg-surface border-b border-line sticky top-0">
                    <tr className="text-muted font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Term</th>
                      <th className="py-2.5 px-4">Assessment</th>
                      <th className="py-2.5 px-4 text-right pr-4">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {childGrades.map((grade, index) => (
                      <tr key={index} className="hover:bg-line/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-ink">{grade.subject}</td>
                        <td className="py-3 px-4 text-muted font-mono">{grade.term}</td>
                        <td className="py-3 px-4 text-ink capitalize font-semibold">{grade.assessment_name || grade.assessment_type}</td>
                        <td className="py-3 px-4 text-right pr-4">
                          <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded ${getScoreBadgeColor(grade.grade_value)}`}>
                            {grade.grade_value}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {childGrades.length === 0 && (
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
              <h3 className="text-lg font-display font-bold text-ink">Make a Fee Payment</h3>
              <p className="text-xs text-ink/50 mt-0.5">EcoCash · InnBucks · Paynow · Bank Transfer · Cash Declaration</p>
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
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Payment Method</label>
                  <select
                    value={paymentForm.method}
                    onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                  >
                    <option value="ecocash">📱 EcoCash Wallet</option>
                    <option value="innbucks">📱 InnBucks Wallet</option>
                    <option value="paynow">🌐 Paynow Gateway</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="cash">💵 Cash at Cashier Desk</option>
                  </select>
                </div>
              </div>

              {/* Mobile money number field */}
              {!['bank_transfer', 'cash'].includes(paymentForm.method) && (
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Mobile Wallet Number *</label>
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

              {/* Cash & Bank Transfer Payment Declaration fields */}
              {(paymentForm.method === 'cash' || paymentForm.method === 'bank_transfer') && (
                <div className="space-y-3 p-3 bg-amber-warning/5 rounded-xl border border-amber-warning/20">
                  <p className="text-[10px] font-semibold text-amber-warning">
                    {paymentForm.method === 'cash'
                      ? '💵 Cash Payment Declaration: Declare a cash payment made at the school cashier desk. The school bursar will verify and issue your receipt.'
                      : '🏦 Bank Transfer / Deposit Slip Declaration: Declare your direct bank transfer or deposit slip. The bursar will match with bank records and credit your student account.'}
                  </p>
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">
                      {paymentForm.method === 'cash' ? 'Receiving Cashier / Officer Name *' : 'Bank Name & Branch / Depositor Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={paymentForm.method === 'cash' ? 'e.g. Mrs Ncube (Bursar Desk)' : 'e.g. CABS First Street / T. Moyo'}
                      className="w-full glass-input rounded-xl text-xs"
                      value={paymentForm.cashier_name}
                      onChange={e => setPaymentForm({ ...paymentForm, cashier_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">
                      {paymentForm.method === 'cash' ? 'Manual Receipt Number (optional)' : 'Deposit Slip / Bank Reference Number *'}
                    </label>
                    <input
                      type="text"
                      required={paymentForm.method === 'bank_transfer'}
                      placeholder={paymentForm.method === 'cash' ? 'e.g. RCP-0042 (from paper receipt)' : 'e.g. FT2628499291 or Slip #'}
                      className="w-full glass-input rounded-xl text-xs"
                      value={paymentForm.receipt_number}
                      onChange={e => setPaymentForm({ ...paymentForm, receipt_number: e.target.value })}
                    />
                  </div>
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
