import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  CreditCard,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Printer,
  Loader2,
  HelpCircle
} from 'lucide-react';

const Fees = () => {
  const { activeSchoolId, user } = useAuth();
  const isParent = user?.role === 'parent';

  // Shared state
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Admin Tab selection: 'ledger' | 'approvals' | 'config'
  const [activeTab, setActiveTab] = useState('ledger');

  // Bank Info state
  const [bankInfo, setBankInfo] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    payment_instructions: ''
  });
  const [saveBankLoading, setSaveBankLoading] = useState(false);
  const [saveBankSuccess, setSaveBankSuccess] = useState('');

  // Remote declarations queue (For admin approvals & parent history)
  const [remotePayments, setRemotePayments] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);

  // Parent payment declaration form
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [declareAmount, setDeclareAmount] = useState('');
  const [declareMethod, setDeclareMethod] = useState('bank_transfer');
  const [declareRef, setDeclareRef] = useState('');
  const [declareDate, setDeclareDate] = useState(new Date().toISOString().split('T')[0]);
  const [declareLoading, setDeclareLoading] = useState(false);
  const [declareSuccess, setDeclareSuccess] = useState('');
  const [declareError, setDeclareError] = useState('');

  // Rejection modal state
  const [rejectionModalId, setRejectionModalId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Electronic Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Load fee structures
  const fetchFees = () => {
    if (!activeSchoolId) return;
    setLoading(true);

    const params = new URLSearchParams({ page, per_page: 20, status: statusFilter, search });

    api.get(`/schools/${activeSchoolId}/fees?${params}`)
      .then(res => {
        setFees(res.data || []);
        if (res.meta) setTotalPages(Math.ceil((res.meta.total || 1) / (res.meta.per_page || 20)));
        setError('');
      })
      .catch(err => {
        console.error('Error fetching fees:', err);
        setError('Failed to load fees balances.');
      })
      .finally(() => setLoading(false));
  };

  // Load school bank details
  const fetchBankDetails = () => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}`)
      .then(res => {
        if (res.data) {
          setBankInfo({
            bank_name: res.data.bank_name || '',
            account_number: res.data.account_number || '',
            account_name: res.data.account_name || '',
            payment_instructions: res.data.payment_instructions || ''
          });
        }
      })
      .catch(err => console.error('Error fetching bank info:', err));
  };

  // Load declarations queue
  const fetchRemotePayments = () => {
    if (!activeSchoolId) return;
    setRemoteLoading(true);
    api.get(`/schools/${activeSchoolId}/remote-payments`)
      .then(res => {
        setRemotePayments(res.data || []);
      })
      .catch(err => console.error('Error fetching remote payments:', err))
      .finally(() => setRemoteLoading(false));
  };

  useEffect(() => {
    fetchFees();
    fetchBankDetails();
    fetchRemotePayments();

    const params = new URLSearchParams(window.location.search);
    const receiptId = params.get('receipt');
    if (receiptId) {
      handleViewReceipt(receiptId);
    }
  }, [activeSchoolId, page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchFees();
  };

  const handleExport = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost/backend/api/v1';
    const exportUrl = `${apiBase}/schools/${activeSchoolId}/fees/export?token=${sessionStorage.getItem('schoolbase_token')}`;
    window.open(exportUrl, '_blank');
  };

  // Save bank configuration
  const handleSaveBankInfo = (e) => {
    e.preventDefault();
    setSaveBankLoading(true);
    setSaveBankSuccess('');
    api.put(`/schools/${activeSchoolId}/bank-account`, bankInfo)
      .then(() => {
        setSaveBankSuccess('Banking setup saved successfully.');
        fetchBankDetails();
      })
      .catch(() => setError('Failed to update bank configuration.'))
      .finally(() => setSaveBankLoading(false));
  };

  // Parent Payment Declaration Submission
  const handleDeclareSubmit = (e) => {
    e.preventDefault();
    if (!selectedStudentId || !declareAmount || !declareRef) {
      setDeclareError('Please fill in all payment details.');
      return;
    }
    setDeclareLoading(true);
    setDeclareError('');
    setDeclareSuccess('');

    api.post(`/schools/${activeSchoolId}/remote-payments`, {
      student_id: selectedStudentId,
      amount: parseFloat(declareAmount),
      payment_method: declareMethod,
      reference: declareRef,
      payment_date: declareDate
    })
      .then(() => {
        setDeclareSuccess('Payment declaration submitted successfully. Standard verification takes 1-2 banking days.');
        setDeclareAmount('');
        setDeclareRef('');
        fetchRemotePayments();
        fetchFees();
      })
      .catch(err => {
        setDeclareError(err.response?.data?.error?.message || 'Declaration submission failed. Check reference number.');
      })
      .finally(() => setDeclareLoading(false));
  };

  // Admin approves transaction
  const handleApproveDeclaration = (id) => {
    if (!window.confirm('Verify that this transaction has cleared in your banking statements?')) return;
    api.post(`/schools/${activeSchoolId}/remote-payments/${id}/verify`, { status: 'approved' })
      .then(() => {
        fetchRemotePayments();
        fetchFees();
      })
      .catch(err => alert(err.response?.data?.error?.message || 'Failed to verify transaction.'));
  };

  // Admin rejects transaction
  const handleRejectDeclaration = (e) => {
    e.preventDefault();
    setRejecting(true);
    api.post(`/schools/${activeSchoolId}/remote-payments/${rejectionModalId}/verify`, {
      status: 'rejected',
      rejection_reason: rejectionReason
    })
      .then(() => {
        setRejectionModalId(null);
        setRejectionReason('');
        fetchRemotePayments();
      })
      .catch(err => alert(err.response?.data?.error?.message || 'Failed to submit rejection.'))
      .finally(() => setRejecting(false));
  };

  // Open cryptographic Electronic Receipt
  const handleViewReceipt = (paymentId) => {
    setReceiptLoading(true);
    api.get(`/fee-payments/${paymentId}/receipt`)
      .then(res => {
        setActiveReceipt(res.data);
      })
      .catch(() => alert('Failed to pull electronic receipt.'))
      .finally(() => setReceiptLoading(false));
  };

  // Print Receipt handler
  const handlePrintReceipt = () => {
    window.print();
  };

  // Totals summary
  const totalDue = fees.reduce((a, f) => a + parseFloat(f.amount_due || 0), 0);
  const totalPaid = fees.reduce((a, f) => a + parseFloat(f.amount_paid || 0), 0);
  const totalBalance = totalDue - totalPaid;

  // Extract linked children mapping from parent fees
  const children = Array.from(
    new Map(fees.map(f => [f.student_id, { id: f.student_id, name: `${f.student_first_name} ${f.student_last_name}` }])).values()
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn printable-area">
      {/* Electronic Receipt Print Viewer */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:relative print:bg-white print:inset-0 print:p-0 non-printable-target">
          <div className="bg-paper rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-line-border/30 print:shadow-none print:border-none print:w-full print:max-w-none print:m-0">
            {/* Modal Actions */}
            <div className="p-4 bg-sage/20 border-b border-line-border flex justify-between items-center non-printable">
              <span className="text-xs font-sans font-bold text-teal-dark">Authentic Electronic Receipt</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintReceipt}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-teal-primary text-paper rounded-lg text-xs font-semibold hover:bg-teal-dark cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  <span>Print PDF</span>
                </button>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="px-3 py-1.5 border border-line-border rounded-lg text-xs hover:bg-sage/10 cursor-pointer text-ink font-semibold"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Receipt Sheet */}
            <div className="p-8 space-y-6 bg-white text-ink text-sm font-sans">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold uppercase tracking-wider">{activeReceipt.school_name}</h3>
                <p className="text-xs text-ink/60">OFFICIAL TUITION PAYMENT RECEIPT</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs border-y border-line-border/50 py-4">
                <div>
                  <p className="text-ink/50 font-bold uppercase text-[9px] tracking-wider">Student Details</p>
                  <p className="font-semibold text-ink mt-0.5">{activeReceipt.first_name} {activeReceipt.last_name}</p>
                  <p className="text-ink/65">Admission No: {activeReceipt.admission_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-ink/50 font-bold uppercase text-[9px] tracking-wider">Transaction Info</p>
                  <p className="font-semibold text-ink mt-0.5">Receipt ID: {activeReceipt.id}</p>
                  <p className="text-ink/65">Date: {activeReceipt.payment_date}</p>
                </div>
              </div>

              {/* Ledger breakdown */}
              <div className="space-y-3">
                <p className="text-ink/50 font-bold uppercase text-[9px] tracking-wider">Billing Allocation</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span>Term Invoice ({activeReceipt.term}):</span>
                    <span className="font-mono">${parseFloat(activeReceipt.amount_due).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-teal-primary border-t border-dashed border-line-border/40 pt-1.5">
                    <span>Amount Credited:</span>
                    <span className="font-mono">${parseFloat(activeReceipt.amount_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>Payment Mode:</span>
                    <span className="capitalize">{activeReceipt.payment_method?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>Reference / Signature:</span>
                    <span className="font-mono text-[10px]">{activeReceipt.reference || '—'}</span>
                  </div>
                  <div className="flex justify-between text-ink/70">
                    <span>Handled By:</span>
                    <span>{activeReceipt.cashier_name || 'System Auto'}</span>
                  </div>
                </div>
              </div>

              {/* Carry forward accounts */}
              <div className="bg-sage/10 p-3 rounded-xl border border-teal-primary/20 space-y-1 text-xs">
                <div className="flex justify-between text-ink font-semibold">
                  <span>Balance Brought Forward (Future Credit):</span>
                  <span className="font-mono text-teal-dark">${parseFloat(activeReceipt.credit_balance || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Trust Indicators: QR Code & Verification Seal */}
              <div className="border-t border-line-border/40 pt-5 flex justify-between items-center gap-6">
                {/* Visual QR Code Representation */}
                <div className="flex items-center space-x-3 bg-sage/5 p-2 rounded-xl border border-line-border/30">
                  <div className="w-16 h-16 bg-white p-1 rounded-lg border border-line-border/40 shadow-sm flex items-center justify-center">
                    <svg className="w-full h-full text-ink" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
                      {/* Quiet Zone & Corner Finders */}
                      <path d="M0 0h7v7H0V0zm22 0h7v7h-7V0zM0 22h7v7H0v-7z" fill="currentColor" />
                      <path d="M1 1h5v5H1V1zm22 0h5v5h-5V1zM1 23h5v5H1v-5z" fill="white" />
                      <path d="M2 2h3v3H2V2zm22 0h3v3h-3V2zM2 24h3v3H2v-3z" fill="currentColor" />
                      {/* Fake QR Data Dots Grid */}
                      <path d="M9 1h1v1H9V1zm2 0h3v1h-3V1zm4 0h1v2h-1V1zm2 0h2v1h-2V1zm0 2h1v1h-1V3zm2 0h1v1h-1V3zm-9 2h2v1H9V5zm4 0h1v1h-1V5zm2 0h3v1h-3V5z" fill="currentColor" />
                      <path d="M9 7h3v1H9V7zm5 0h1v2h-1V7zm2 0h2v1h-2V7zm3 0h1v1h-1V7zm1 2h1v2h-1V9zm-5 2h1v1h-1v-1zm2 0h2v1h-2v-1zm4 0h1v1h-1v-1zm-9 2h2v1H9v-1zm4 0h1v2h-1v-2zm3 0h2v1h-2v-1zm-7 3h1v1H9v-1zm3 0h1v1h-1v-1zm5 0h1v1h-1v-1zm-8 2h2v1H9v-1zm4 0h1v1h-1v-1zm2 0h3v1h-3v-1zm-6 2h1v1H9v-1zm2 0h1v1h-1v-1zm4 0h2v1h-2v-1z" fill="currentColor" />
                      <path d="M15 15h1v1h-1v-1zm2 2h1v1h-1v-1zm-2 2h1v1h-1v-1zm4 0h1v1h-1v-1zm3 0h1v1h-1v-1zm-3 2h2v1h-2v-1zm4 2h1v1h-1v-1z" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-ink/70">Receipt Scan Code</p>
                    <p className="text-[8px] text-ink/50 font-mono">ID: {activeReceipt.id}</p>
                    <p className="text-[8px] text-teal-dark font-semibold">Verify Cryptographic Ledger</p>
                  </div>
                </div>

                {/* Circular Official Registrar Seal Stamp */}
                <div className="relative w-24 h-24 flex items-center justify-center non-printable-target select-none">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-teal-primary/40 animate-[spin_120s_linear_infinite]" />
                  <div className="absolute inset-1 rounded-full border border-teal-primary/20 flex flex-col items-center justify-center bg-teal-primary/[0.02] text-center -rotate-12">
                    <ShieldCheck className="w-6 h-6 text-teal-primary/70 mb-0.5" />
                    <span className="text-[8px] font-bold text-teal-dark leading-none uppercase tracking-wider">OFFICIAL</span>
                    <span className="text-[7px] text-teal-primary/80 font-bold font-mono mt-0.5">VERIFIED</span>
                  </div>
                </div>
              </div>

              {/* Verification Stamp Code */}
              <div className="border-t border-line-border/30 pt-4 space-y-1.5 text-center">
                <p className="text-[8px] uppercase font-bold text-ink/40 tracking-widest">Cryptographic System Hash Stamp</p>
                <div className="bg-sage/5 p-2 rounded border border-line-border/30 font-mono text-[8px] text-ink/55 break-all select-all leading-normal">
                  {activeReceipt.authenticity_signature}
                </div>
                <div className="flex justify-center items-center space-x-1 text-[9px] text-teal-dark font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-primary" />
                  <span>Secure Cryptographical Ledger Authenticated Receipt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4 non-printable">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Fees &amp; Payments Ledger</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {isParent ? 'Review child tuition structures, check bank details, and declare remote transactions.' : 'Append-only receipts — balances are computed, never edited directly.'}
          </p>
        </div>
        {!isParent && (
          <div>
            <button
              onClick={handleExport}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-teal-primary" />
              <span>Export CSV</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans non-printable">{error}</div>
      )}

      {/* Parent Portal view */}
      {isParent ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 non-printable">
          {/* Children and invoices summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-display font-bold text-ink border-b border-line-border/30 pb-2">Active Invoices</h3>
              
              <div className="space-y-4">
                {fees.map((fee) => {
                  const balance = parseFloat(fee.amount_due) - parseFloat(fee.amount_paid);
                  return (
                    <div key={fee.id} className="p-4 rounded-xl border border-line-border/30 bg-paper/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-ink">{fee.student_first_name} {fee.student_last_name}</h4>
                        <p className="text-xs text-ink/50 mt-0.5">Term invoice: <span className="font-mono">{fee.term}</span></p>
                        <p className="text-[10px] text-teal-dark font-bold mt-1 bg-sage/20 px-2 py-0.5 rounded inline-block">
                          Carried Forward Credit: ${parseFloat(fee.student_credit_balance || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto">
                        <span className="text-xs text-ink/50 sm:hidden">Outstanding:</span>
                        <div className="space-y-1">
                          <p className={`text-base font-bold font-mono ${balance > 0 ? 'text-brick-critical' : 'text-teal-primary'}`}>
                            ${balance.toFixed(2)}
                          </p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            fee.status === 'cleared' ? 'bg-sage/35 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
                          }`}>
                            {fee.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* School Bank Account details */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-display font-bold text-ink border-b border-line-border/30 pb-2">School Bank Details (Remote Payments)</h3>
              {bankInfo.account_number ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                  <div className="space-y-2">
                    <p className="text-ink/50 uppercase font-bold text-[9px] tracking-wider">Bank Name</p>
                    <p className="font-bold text-ink text-sm">{bankInfo.bank_name}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-ink/50 uppercase font-bold text-[9px] tracking-wider">Account Number</p>
                    <p className="font-mono font-bold text-ink text-sm">{bankInfo.account_number}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-ink/50 uppercase font-bold text-[9px] tracking-wider">Account Name</p>
                    <p className="font-bold text-ink text-sm">{bankInfo.account_name}</p>
                  </div>
                  {bankInfo.payment_instructions && (
                    <div className="md:col-span-2 space-y-2 border-t border-line-border/20 pt-2">
                      <p className="text-ink/50 uppercase font-bold text-[9px] tracking-wider">Transfer Instructions</p>
                      <p className="text-ink/75 leading-relaxed">{bankInfo.payment_instructions}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-ink/40 text-xs">
                  <HelpCircle className="w-5 h-5" />
                  <span>The school admin has not configured their banking profile yet. Please contact school administration directly for billing bank instructions.</span>
                </div>
              )}
            </div>

            {/* Payment declarations list */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-display font-bold text-ink border-b border-line-border/30 pb-2">Declared Remote Transactions</h3>
              {remoteLoading ? (
                <div className="text-center py-4 text-xs text-ink/40">Loading declaration history...</div>
              ) : remotePayments.map((rp) => (
                <div key={rp.id} className="p-3 bg-paper rounded-xl border border-line-border/20 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold">{rp.first_name} {rp.last_name}</p>
                    <p className="text-[10px] text-ink/50 mt-0.5">Method: <span className="uppercase">{rp.payment_method.replace('_', ' ')}</span> | Ref: <span className="font-mono">{rp.reference}</span></p>
                    {rp.rejection_reason && (
                      <p className="text-[10px] text-brick-critical font-medium mt-1">Reason: {rp.rejection_reason}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1.5">
                    <p className="font-bold font-mono">${parseFloat(rp.amount).toFixed(2)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      rp.status === 'approved' ? 'bg-sage/35 text-teal-dark' :
                      rp.status === 'rejected' ? 'bg-brick-critical/15 text-brick-critical' :
                      'bg-amber-warning/15 text-amber-warning'
                    }`}>
                      {rp.status}
                    </span>
                  </div>
                </div>
              ))}
              {remotePayments.length === 0 && !remoteLoading && (
                <p className="text-center text-ink/50 text-xs py-4">No declared transfers found.</p>
              )}
            </div>
          </div>

          {/* Payment submission form */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-display font-bold text-ink border-b border-line-border/30 pb-2">Declare Payment</h3>
              <form onSubmit={handleDeclareSubmit} className="space-y-4 mt-4 font-sans text-xs">
                {declareError && (
                  <div className="p-3 rounded-xl bg-brick-critical/10 text-brick-critical font-medium">{declareError}</div>
                )}
                {declareSuccess && (
                  <div className="p-3 rounded-xl bg-sage/20 text-teal-dark border border-teal-primary/20 font-medium">{declareSuccess}</div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-ink/70">Select Child</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink"
                    required
                  >
                    <option value="">Choose Child</option>
                    {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink/70">Amount Paid ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 500.00"
                    value={declareAmount}
                    onChange={(e) => setDeclareAmount(e.target.value)}
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink/70">Transaction Reference Code</label>
                  <input
                    type="text"
                    placeholder="Bank Ref / EcoCash ID"
                    value={declareRef}
                    onChange={(e) => setDeclareRef(e.target.value)}
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink/70">Payment Date</label>
                  <input
                    type="date"
                    value={declareDate}
                    onChange={(e) => setDeclareDate(e.target.value)}
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink/70">Payment Channel</label>
                  <select
                    value={declareMethod}
                    onChange={(e) => setDeclareMethod(e.target.value)}
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money (EcoCash/InnBucks)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={declareLoading}
                  className="w-full py-2 bg-teal-primary text-paper rounded-xl font-semibold hover:bg-teal-dark disabled:opacity-50 cursor-pointer"
                >
                  {declareLoading ? 'Submitting Declaration...' : 'Submit Declaration'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Admin Dashboard view */
        <div className="space-y-8 non-printable">
          {/* Totals Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Total Billed</span>
                <p className="text-2xl font-display font-bold text-ink mt-1 numeric-data">${totalDue.toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-ink/5 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-ink/50" />
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Total Collected</span>
                <p className="text-2xl font-display font-bold text-teal-primary mt-1 numeric-data">${totalPaid.toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-teal-primary" />
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Outstanding Balance</span>
                <p className="text-2xl font-display font-bold text-brick-critical mt-1 numeric-data">${totalBalance.toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brick-critical/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-brick-critical" />
              </div>
            </div>
          </div>

          {/* Admin Tabs */}
          <div className="flex border-b border-line-border/30 space-x-6 text-sm font-sans">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`pb-3 font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'ledger' ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/60 hover:text-ink'
              }`}
            >
              Ledger Balances
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-3 font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'approvals' ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/60 hover:text-ink'
              }`}
            >
              <span>Remote Approvals</span>
              {remotePayments.filter(rp => rp.status === 'pending').length > 0 && (
                <span className="bg-brick-critical text-paper text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {remotePayments.filter(rp => rp.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`pb-3 font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'config' ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/60 hover:text-ink'
              }`}
            >
              Billing Setup
            </button>
          </div>

          {/* Tab Content: Ledger Balances */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
                  <input
                    type="text"
                    placeholder="Search student name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-ink font-sans text-sm focus:outline-none"
                  />
                  <button type="submit" className="absolute left-3.5 top-2.5">
                    <Search className="w-4 h-4 text-ink/40" />
                  </button>
                </form>
                <div className="flex items-center gap-3">
                  <Filter className="w-4 h-4 text-teal-primary" />
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="cleared">Cleared</option>
                  </select>
                </div>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                        <th className="py-4 px-6">Student</th>
                        <th className="py-4 px-6">Term</th>
                        <th className="py-4 px-6 text-right">Amount Due</th>
                        <th className="py-4 px-6 text-right">Amount Paid</th>
                        <th className="py-4 px-6 text-right">Carry-Forward Credit</th>
                        <th className="py-4 px-6 text-right">Outstanding</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                      {fees.map((fee) => {
                        const balance = parseFloat(fee.amount_due) - parseFloat(fee.amount_paid);
                        return (
                          <tr key={fee.id} className="hover:bg-sage/5 transition-colors">
                            <td className="py-4 px-6 font-bold">{fee.student_first_name} {fee.student_last_name}</td>
                            <td className="py-4 px-6 numeric-data text-xs font-mono">{fee.term}</td>
                            <td className="py-4 px-6 text-right numeric-data font-mono">${parseFloat(fee.amount_due).toFixed(2)}</td>
                            <td className="py-4 px-6 text-right numeric-data font-mono text-teal-primary font-bold">${parseFloat(fee.amount_paid).toFixed(2)}</td>
                            <td className="py-4 px-6 text-right numeric-data font-mono text-teal-dark font-semibold">${parseFloat(fee.student_credit_balance || 0).toFixed(2)}</td>
                            <td className={`py-4 px-6 text-right numeric-data font-mono font-bold ${balance > 0 ? 'text-brick-critical' : 'text-teal-primary'}`}>
                              ${balance.toFixed(2)}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                fee.status === 'cleared' ? 'bg-sage/35 text-teal-dark' :
                                fee.status === 'partial' ? 'bg-amber-warning/15 text-amber-warning' :
                                'bg-brick-critical/10 text-brick-critical'
                              }`}>
                                {fee.status}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <a
                                href={`/students/${fee.student_id}`}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary text-xs font-semibold rounded-lg transition-colors"
                              >
                                View Profile
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                      {fees.length === 0 && !loading && (
                        <tr>
                          <td colSpan="8" className="py-8 text-center text-ink/50 text-xs">No fee records match this filter.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="p-4 border-t border-line-border/30 flex justify-between items-center bg-paper/30">
                    <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer">Previous</button>
                    <span className="text-xs font-mono text-ink/50">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer">Next</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Content: Remote Approvals Queue */}
          {activeTab === 'approvals' && (
            <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                    <th className="py-4 px-6">Parent</th>
                    <th className="py-4 px-6">Student</th>
                    <th className="py-4 px-6">Ref Code</th>
                    <th className="py-4 px-6">Method</th>
                    <th className="py-4 px-6 text-right">Amount</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                  {remotePayments.map((rp) => (
                    <tr key={rp.id} className="hover:bg-sage/5 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-bold">{rp.parent_name}</span>
                        <span className="text-[10px] text-ink/50 block font-mono">{rp.parent_phone}</span>
                      </td>
                      <td className="py-4 px-6 font-semibold">{rp.first_name} {rp.last_name}</td>
                      <td className="py-4 px-6 font-mono text-xs text-teal-dark">{rp.reference}</td>
                      <td className="py-4 px-6 uppercase text-xs font-medium text-ink/75">{rp.payment_method.replace('_', ' ')}</td>
                      <td className="py-4 px-6 text-right font-mono font-bold">${parseFloat(rp.amount).toFixed(2)}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          rp.status === 'approved' ? 'bg-sage/35 text-teal-dark' :
                          rp.status === 'rejected' ? 'bg-brick-critical/15 text-brick-critical' :
                          'bg-amber-warning/15 text-amber-warning'
                        }`}>
                          {rp.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {rp.status === 'pending' ? (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleApproveDeclaration(rp.id)}
                              className="px-2.5 py-1.5 bg-teal-primary text-paper rounded-lg text-xs font-semibold hover:bg-teal-dark cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectionModalId(rp.id)}
                              className="px-2.5 py-1.5 bg-brick-critical/10 text-brick-critical rounded-lg text-xs font-semibold hover:bg-brick-critical/20 cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : rp.status === 'approved' ? (
                          /* Authenticated Receipt link */
                          <button
                            onClick={() => handleViewReceipt(rp.fee_payment_id || ("RP-" + rp.id))}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-primary/10 text-teal-primary text-xs font-semibold rounded-lg hover:bg-teal-primary/20 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        ) : (
                          <span className="text-ink/40 text-xs italic">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {remotePayments.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-ink/50 text-xs font-medium">No remote declarations awaiting approval.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Content: Billing Setup Configuration */}
          {activeTab === 'config' && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl">
              <h3 className="text-lg font-display font-bold text-ink border-b border-line-border/30 pb-2">Modify School Bank Profile</h3>
              <form onSubmit={handleSaveBankInfo} className="space-y-4 mt-4 font-sans text-xs">
                {saveBankSuccess && (
                  <div className="p-3 rounded-xl bg-sage/20 text-teal-dark border border-teal-primary/20 font-medium">{saveBankSuccess}</div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-ink/70">Bank Name</label>
                    <input
                      type="text"
                      value={bankInfo.bank_name}
                      onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })}
                      placeholder="e.g. Standard Chartered Bank"
                      className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-ink/70">Account Name</label>
                    <input
                      type="text"
                      value={bankInfo.account_name}
                      onChange={(e) => setBankInfo({ ...bankInfo, account_name: e.target.value })}
                      placeholder="e.g. Harare Primary School Operations"
                      className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink/70">Account Number</label>
                  <input
                    type="text"
                    value={bankInfo.account_number}
                    onChange={(e) => setBankInfo({ ...bankInfo, account_number: e.target.value })}
                    placeholder="e.g. 010099887711"
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink/70">Payment Instructions / Notes</label>
                  <textarea
                    value={bankInfo.payment_instructions}
                    onChange={(e) => setBankInfo({ ...bankInfo, payment_instructions: e.target.value })}
                    placeholder="e.g. Please include your student admission number as reference (e.g. STD0001) in bank transfers."
                    className="w-full bg-paper border border-line-border rounded-xl px-3 py-2 text-ink h-24"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saveBankLoading}
                  className="px-4 py-2 bg-teal-primary text-paper rounded-xl font-semibold hover:bg-teal-dark disabled:opacity-50 cursor-pointer text-xs inline-flex items-center space-x-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{saveBankLoading ? 'Saving Setup...' : 'Save Bank Details'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Admin Rejection Modal Details */}
      {rejectionModalId && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 non-printable">
          <div className="bg-paper rounded-2xl w-full max-w-sm overflow-hidden border border-line-border/30 p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-display font-bold text-ink border-b border-line-border/30 pb-2">Reject Payment Declaration</h3>
            <form onSubmit={handleRejectDeclaration} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-ink/70">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Reference code not found on bank statement. Please check value."
                  className="w-full bg-paper border border-line-border rounded-xl p-2.5 text-ink h-20"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRejectionModalId(null)}
                  className="px-3 py-1.5 border border-line-border rounded-lg text-ink font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="px-3 py-1.5 bg-brick-critical text-paper rounded-lg font-semibold hover:bg-brick-dark disabled:opacity-50 cursor-pointer"
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;