import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  CalendarCheck,
  TrendingUp,
  CreditCard,
  AlertOctagon,
  Heart,
  PlusCircle,
  X,
  DollarSign,
  ChevronLeft,
  FileText
} from 'lucide-react';

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeSchoolId, user } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentError, setPaymentError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchProfile = () => {
    if (!activeSchoolId || !id) return;
    setLoading(true);
    
    api.get(`/schools/${activeSchoolId}/students/${id}/profile`)
      .then(res => {
        setProfile(res.data);
        setError('');
      })
      .catch(err => {
        console.error('Error fetching student profile:', err);
        setError('Failed to fetch student profile details.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProfile();
  }, [activeSchoolId, id]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0) {
      setPaymentError('Please enter a valid amount.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    // Generate random idempotency key for connectivity failure safety
    const idempotencyKey = `IDEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const feeId = profile?.fee_summary?.id;
      if (!feeId) throw new Error('No active fee ledger found for this student.');

      const res = await api.post(`/schools/${activeSchoolId}/fees/${feeId}/payments`, {
        amount_paid: Number(paymentAmount),
        payment_method: paymentMethod,
        reference: paymentRef || 'Manual Entry'
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });

      if (res.data) {
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentRef('');
        setPaymentMethod('cash');
        fetchProfile(); // Refresh profile
      }
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-primary"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
        <div className="p-4 rounded-xl bg-brick-critical/10 text-brick-critical font-sans text-sm">
          {error || 'Student not found.'}
        </div>
        <button onClick={() => navigate('/students')} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold">
          Back to Directory
        </button>
      </div>
    );
  }

  const { student, attendance_summary, grades_summary, fee_summary, fee_history, discipline_history, health_history } = profile;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Back button and profile header */}
      <div className="space-y-4">
        <button
          onClick={() => navigate('/students')}
          className="flex items-center space-x-1.5 text-xs font-sans font-bold text-ink/60 hover:text-teal-primary transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-line-border/30 pb-6 gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-ink">
              {student.first_name} {student.middle_name ? student.middle_name + ' ' : ''}{student.last_name}
            </h2>
            <p className="text-sm font-sans text-ink/60 mt-1">
              Admission: <span className="font-mono font-bold text-ink/80 numeric-data">{student.admission_number}</span> | Class: <span className="font-bold text-ink/80">{student.class_name || 'Unassigned'}</span>
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            student.status === 'enrolled' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
          }`}>
            {student.status}
          </span>
        </div>
      </div>

      {/* Grid of Profile Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Attendance Summary */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2 border-b border-line-border/30 pb-3">
            <CalendarCheck className="w-5 h-5 text-teal-primary" />
            <span>Attendance History</span>
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-sage/10 p-3 rounded-xl">
              <span className="text-[10px] font-sans font-bold text-ink/50 uppercase">Rate</span>
              <p className="text-2xl font-display font-bold text-teal-primary mt-1 numeric-data">{attendance_summary?.percentage}%</p>
            </div>
            <div className="bg-sage/10 p-3 rounded-xl">
              <span className="text-[10px] font-sans font-bold text-ink/50 uppercase">Present</span>
              <p className="text-2xl font-display font-bold text-ink mt-1 numeric-data">{attendance_summary?.present}</p>
            </div>
            <div className="bg-brick-critical/5 p-3 rounded-xl">
              <span className="text-[10px] font-sans font-bold text-ink/50 uppercase">Absent</span>
              <p className="text-2xl font-display font-bold text-brick-critical mt-1 numeric-data">{attendance_summary?.absent}</p>
            </div>
          </div>
          <div className="text-xs font-sans text-ink/50 text-center">
            Total active school days logged: <span className="font-semibold text-ink numeric-data">{attendance_summary?.total_days}</span>
          </div>
        </div>

        {/* Grades Overview */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2 border-b border-line-border/30 pb-3">
            <TrendingUp className="w-5 h-5 text-teal-primary" />
            <span>Academic Performance</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line-border text-ink/50 uppercase tracking-wider font-bold">
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Term</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/30 text-ink">
                {grades_summary.map((grade, idx) => (
                  <tr key={idx} className="hover:bg-sage/5">
                    <td className="py-2.5 font-semibold">{grade.subject}</td>
                    <td className="py-2.5 numeric-data">{grade.term}</td>
                    <td className="py-2.5 capitalize">{grade.assessment_type}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-teal-primary numeric-data">{grade.grade_value}%</td>
                  </tr>
                ))}
                {grades_summary.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-ink/40 text-xs">No grades logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fees Ledger & Payments */}
        <div className="glass-card rounded-2xl p-6 space-y-4 lg:col-span-2">
          <div className="flex justify-between items-center border-b border-line-border/30 pb-3">
            <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-teal-primary" />
              <span>Fees Ledger (Zimbabwean Dollars/USD)</span>
            </h3>
            {user?.role === 'school_admin' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Record Fee Payment</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Arrears summary */}
            <div className="bg-sage/15 border border-line-border/40 rounded-xl p-4 flex flex-col justify-center text-center">
              <span className="text-xs font-sans font-bold text-ink/50 uppercase">Term Balance</span>
              <p className="text-2xl font-display font-bold text-ink mt-2 numeric-data">
                ${fee_summary ? Math.max(0, fee_summary.amount_due - fee_summary.amount_paid).toFixed(2) : '0.00'}
              </p>
              <span className="text-[10px] font-sans text-ink/40 mt-1">Due for current term ({fee_summary?.term})</span>
            </div>

            {/* Credit Balance Carried Forward */}
            <div className="bg-teal-primary/5 border border-teal-primary/20 rounded-xl p-4 flex flex-col justify-center text-center">
              <span className="text-xs font-sans font-bold text-teal-dark uppercase">Carried Forward Credit</span>
              <p className="text-2xl font-display font-bold text-teal-primary mt-2 font-mono">
                ${parseFloat(profile?.student?.credit_balance || 0).toFixed(2)}
              </p>
              <span className="text-[10px] font-sans text-teal-dark/60 mt-1">Balance brought forward for future terms</span>
            </div>

            {/* Payment history list */}
            <div className="space-y-3">
              <h4 className="text-xs font-sans font-bold text-ink/65 uppercase tracking-wide">Receipt History Ledger</h4>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                {fee_history.map((pay, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white/40 border border-line-border/20 rounded-xl text-xs">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-ink/80 numeric-data">{pay.reference || 'N/A'}</span>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          pay.payment_method === 'cash' ? 'bg-sage/40 text-teal-dark border border-teal-dark/10' :
                          pay.payment_method === 'bank_transfer' ? 'bg-teal-primary/10 text-teal-primary border border-teal-primary/20' :
                          'bg-amber-warning/15 text-amber-warning border border-amber-warning/30'
                        }`}>
                          {pay.payment_method === 'bank_transfer' ? 'Bank' : pay.payment_method === 'mobile_money' ? 'Mobile' : 'Cash'}
                        </span>
                      </div>
                      <p className="text-[10px] text-ink/40 mt-0.5 numeric-data">{pay.payment_date}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-teal-primary numeric-data">+${pay.amount_paid}</span>
                      <a 
                        href={`/fees?receipt=${pay.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.replace(`/fees?receipt=${pay.id}`);
                        }}
                        className="p-1 hover:bg-sage/20 rounded text-teal-primary"
                        title="View Authentic Receipt"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
                {fee_history.length === 0 && (
                  <div className="text-center py-6 text-ink/40">No receipt history recorded.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Restricted Security Layers: Incident log and Health info */}
        {(user?.role === 'school_admin' || user?.role === 'teacher') && (
          <>
            {/* Discipline Log */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2 border-b border-line-border/30 pb-3">
                <AlertOctagon className="w-5 h-5 text-brick-critical" />
                <span>Restricted Discipline & Incident Log</span>
              </h3>
              <div className="space-y-3">
                {discipline_history.map((inc, idx) => (
                  <div key={idx} className="p-3 bg-brick-critical/5 border border-brick-critical/10 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="font-bold text-brick-critical uppercase tracking-wide text-[10px]">{inc.action_taken || 'Logged'}</span>
                      <span className="text-[10px] font-mono text-ink/40 numeric-data">{inc.created_at}</span>
                    </div>
                    <p className="text-ink/80 leading-relaxed font-sans">{inc.description}</p>
                  </div>
                ))}
                {discipline_history.length === 0 && (
                  <div className="text-center py-6 text-ink/40 text-xs">No discipline incidents recorded.</div>
                )}
              </div>
            </div>

            {/* Health Records */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-sans font-bold text-ink flex items-center space-x-2 border-b border-line-border/30 pb-3">
                <Heart className="w-5 h-5 text-brick-critical" />
                <span>Restricted Health Profile</span>
              </h3>
              {health_history ? (
                <div className="space-y-4 text-xs font-sans text-ink">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-teal-primary/5 border border-teal-primary/10 p-3 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-ink/50 tracking-wider">Blood Group</span>
                      <p className="text-sm font-bold text-teal-dark mt-1">{health_history.blood_group || 'Not Mapped'}</p>
                    </div>
                    <div className="bg-brick-critical/5 border border-brick-critical/10 p-3 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-brick-critical tracking-wider">Medical Conditions</span>
                      <p className="text-xs font-semibold text-ink mt-1 leading-relaxed">{health_history.medical_conditions || 'None Declared'}</p>
                    </div>
                  </div>

                  <div className="bg-ink/5 border border-line-border/20 p-3 rounded-xl space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-ink/50 tracking-wider">Allergies / Special Notices</span>
                      <p className="text-xs text-ink/80 mt-1 leading-relaxed">{health_history.allergies || 'No known allergies'}</p>
                    </div>
                    {health_history.confidential_notes && (
                      <div className="border-t border-line-border/20 pt-2 mt-2">
                        <span className="text-[10px] font-bold uppercase text-brick-critical tracking-wider">Confidential Clinical Notes</span>
                        <p className="text-xs text-ink/80 mt-1 leading-relaxed font-medium">{health_history.confidential_notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-sage/10 border border-line-border/30 p-3 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-teal-dark tracking-wider">Emergency Contact</span>
                    <div className="mt-1 flex justify-between font-medium">
                      <span>{health_history.emergency_contact_name || 'N/A'}</span>
                      <span className="font-mono">{health_history.emergency_contact_phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-ink/40 text-xs">No medical or allergy alerts registered.</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Payment recording modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">
              Record Student Fee Payment
            </h3>

            {paymentError && (
              <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4 font-sans text-sm">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Amount Paid (USD/ZWL)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-ink/40 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="50.00"
                    className="w-full pl-8 pr-4 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs numeric-data"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Payment Method</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs bg-paper text-ink"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Hard Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money (EcoCash/OneMoney)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Bank Reference / Txn ID</label>
                <input
                  type="text"
                  placeholder="e.g. EC-12984021"
                  className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs font-mono"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer"
                >
                  {paymentLoading ? 'Recording...' : 'Submit Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfile;