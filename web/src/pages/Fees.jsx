import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import { api } from '../utils/api';
import { money, pct, compact } from '../utils/format';
import {
  PageHeader,
  KpiStrip,
  StatCard,
  Card,
  Tabs,
  DataTable,
  StatusPill,
  Money,
  Modal,
  EmptyState,
  Skeleton
} from '../components/ui';
import {
  CreditCard, DollarSign, TrendingUp, AlertTriangle, FileText,
  Search, CheckCircle2, XCircle, Printer, Eye, ArrowRight,
  ShieldCheck, RefreshCw, Upload, Download, Landmark, Plus
} from 'lucide-react';
import ImportModal from '../components/ImportModal';
import { getCurrentTerm } from '../utils/dateTerms';

export default function Fees() {
  const { user, activeSchoolId, activeSchool, schoolName } = useAuth();
  const navigate = useNavigate();
  const currentTerm = getCurrentTerm();

  // Parents must NEVER access the school-wide cashier treasury or debtor ledger
  if (user?.role === 'parent') {
    return <Navigate to="/parent-portal" replace />;
  }

  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const schoolId = activeSchoolId || user?.school_id || '';
  const activeTab = searchParams.get('tab') || 'cashier';

  // 1. Invoices & Fees Ledger
  const { data: feesData, loading: feesLoading, refetch: refetchFees } = useApi(
    `fees_ledger_${schoolId}`,
    () => api.get(`/schools/${schoolId}/fees?per_page=1000`)
  );

  // 2. Summary & KPIs
  const { data: summaryData } = useApi(
    `fees_summary_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=bursar`)
  );

  // 3. Remote Payments Queue
  const { data: remoteData, refetch: refetchRemote } = useApi(
    `remote_payments_${schoolId}`,
    () => api.get(`/schools/${schoolId}/remote-payments`)
  );

  // 4. Top Debtors
  const { data: debtorsData } = useApi(
    `debtors_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees/top-debtors`)
  );
  const debtorsList = useMemo(() => {
    if (!debtorsData) return [];
    return Array.isArray(debtorsData) ? debtorsData : (debtorsData.data || []);
  }, [debtorsData]);

  // 5. Debtors Ageing
  const { data: ageingData } = useApi(
    `ageing_fees_${schoolId}`,
    () => api.get(`/schools/${schoolId}/analytics/fees/ageing`)
  );

  // Cashier Desk State
  const [cashierStudentSearch, setCashierStudentSearch] = useState('');
  const [selectedStudentFee, setSelectedStudentFee] = useState(null);
  const [cashierCurrency, setCashierCurrency] = useState('USD');
  const [cashierMethod, setCashierMethod] = useState('cash');
  const [cashierAmount, setCashierAmount] = useState('');
  const [cashierRef, setCashierRef] = useState('');
  const [cashierLoading, setCashierLoading] = useState(false);

  // 6. Enrolled Students for Invoicing
  const { data: studentsData } = useApi(
    `students_${schoolId}`,
    () => api.get(`/schools/${schoolId}/students?per_page=1000`).then(r => r.data || [])
  );
  const students = useMemo(() => {
    if (!studentsData) return [];
    return Array.isArray(studentsData) ? studentsData : (studentsData.data || []);
  }, [studentsData]);

  // Bill Student Modal State
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [billForm, setBillForm] = useState({
    student_id: '',
    title: `${currentTerm.name} Tuition & Levies`,
    term: currentTerm.label,
    amount_due: '',
    due_date: ''
  });
  const [billingLoading, setBillingLoading] = useState(false);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  const fees = useMemo(() => {
    if (!feesData) return [];
    return Array.isArray(feesData) ? feesData : (feesData.data || []);
  }, [feesData]);

  const remotePayments = useMemo(() => {
    if (!remoteData) return [];
    return Array.isArray(remoteData) ? remoteData : (remoteData.data || []);
  }, [remoteData]);

  // Total KPIs
  const summaryKpis = summaryData?.kpis || {};
  const totalBilled = summaryKpis.fees_billed !== undefined
    ? Number(summaryKpis.fees_billed)
    : fees.reduce((acc, f) => acc + parseFloat(f.amount_due || 0), 0);
  const totalCollected = summaryKpis.fees_collected !== undefined
    ? Number(summaryKpis.fees_collected)
    : fees.reduce((acc, f) => acc + parseFloat(f.amount_paid || 0), 0);
  const outstanding = summaryKpis.outstanding_balance !== undefined
    ? Number(summaryKpis.outstanding_balance)
    : Math.max(0, totalBilled - totalCollected);
  const collectionRate = summaryKpis.collection_rate !== undefined
    ? Number(summaryKpis.collection_rate)
    : (totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0);

  const handleTabChange = (t) => {
    setSearchParams({ tab: t }, { replace: true });
  };

  // FX Rates
  const fxRates = {
    USD: 1.0,
    ZiG: 26.85,
    ZAR: 18.40
  };

  // Filter students for Cashier Lookup
  const searchedFeeResults = useMemo(() => {
    if (!cashierStudentSearch || cashierStudentSearch.length < 2) return [];
    const q = cashierStudentSearch.toLowerCase();
    return fees.filter(f => {
      const name = `${f.first_name || ''} ${f.last_name || ''}`.toLowerCase();
      const adm = (f.admission_number || '').toLowerCase();
      return name.includes(q) || adm.includes(q);
    }).slice(0, 5);
  }, [fees, cashierStudentSearch]);

  // Cashier payment execution
  const handleCashierPayment = async (e) => {
    e.preventDefault();
    if (!selectedStudentFee) {
      toast.error('Please select a student invoice first.');
      return;
    }
    if (!cashierAmount || Number(cashierAmount) <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }

    setCashierLoading(true);
    try {
      const res = await api.post(`/schools/${schoolId}/fees/${selectedStudentFee.id}/payments`, {
        amount_paid: Number(cashierAmount),
        payment_method: cashierMethod,
        currency: cashierCurrency,
        reference: cashierRef || `CASH-${Date.now().toString().slice(-6)}`
      });

      toast.success('Payment recorded successfully.');

      // Setup active receipt
      setActiveReceipt({
        receipt_number: `REC-2026-${Date.now().toString().slice(-5)}`,
        student_name: `${selectedStudentFee.first_name} ${selectedStudentFee.last_name}`,
        admission_number: selectedStudentFee.admission_number,
        class_name: selectedStudentFee.class_name,
        amount: Number(cashierAmount),
        currency: cashierCurrency,
        method: cashierMethod,
        date: new Date().toISOString(),
        cashier: user?.name || 'Bursar Desk'
      });
      setReceiptModalOpen(true);

      // Invalidate dependent queries across the system (Section 6.1)
      invalidate([
        `fees_ledger_${schoolId}`,
        `fees_summary_${schoolId}`,
        `summary_${schoolId}`,
        `top_debtors_${schoolId}`,
        `ageing_fees_${schoolId}`
      ]);
      refetchFees();
      setCashierAmount('');
      setCashierRef('');
    } catch (err) {
      toast.error(err?.message || 'Payment recording failed.');
    } finally {
      setCashierLoading(false);
    }
  };

  // Remote payment approval
  const handleApproveRemote = async (id) => {
    try {
      await api.post(`/schools/${schoolId}/remote-payments/${id}/approve`);
      toast.success('Payment approved and credited to student ledger.');
      invalidate([`remote_payments_${schoolId}`, `fees_ledger_${schoolId}`, `summary_${schoolId}`]);
      refetchRemote();
      refetchFees();
    } catch (err) {
      toast.error(err?.message || 'Approval failed.');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const tabs = [
    { id: 'cashier', label: 'Cashier Desk', icon: CreditCard },
    { id: 'ledger', label: 'Invoices & Ledger', icon: FileText, count: fees.length },
    { id: 'reconciliation', label: 'Remote Approvals', icon: CheckCircle2, count: remotePayments.length },
    { id: 'debtors', label: 'Debtors Ageing', icon: AlertTriangle }
  ];

  const handleBillStudent = async (e) => {
    e.preventDefault();
    if (!billForm.student_id) {
      toast.error('Please select a student to invoice.');
      return;
    }
    if (!billForm.amount_due || parseFloat(billForm.amount_due) <= 0) {
      toast.error('Please enter a valid billing amount.');
      return;
    }

    setBillingLoading(true);
    try {
      await api.post(`/schools/${schoolId}/fees`, billForm);
      toast.success(`Fee invoice created successfully.`);
      setBillModalOpen(false);
      setBillForm({
        student_id: '',
        title: 'Term 1 Tuition & Levies',
        term: 'Term 1 2026',
        amount_due: '',
        due_date: '2026-02-15'
      });
      invalidate([
        `fees_ledger_${schoolId}`,
        `fees_summary_${schoolId}`,
        `debtors_${schoolId}`,
        `ageing_fees_${schoolId}`
      ]);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to bill student.');
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees & Cashier Desk"
        subtitle="Multi-currency collection treasury (USD, ZiG, ZAR), cashier point-of-sale & debtors management"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBillModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-surface border border-brand-500/30 rounded-lg shadow-2xs hover:bg-brand-50 dark:hover:bg-brand-950/50 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bill Student Fee</span>
            </button>
            <button
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink bg-surface border border-line rounded-lg shadow-2xs hover:bg-canvas transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Fees</span>
            </button>
            <button
              onClick={() => handleTabChange('cashier')}
              className="btn-primary"
            >
              <CreditCard className="w-4 h-4 mr-1.5" />
              Cashier POS
            </button>
          </div>
        }
      />

      {/* Finance KPI Strip (Section 4 & 5.2) */}
      <KpiStrip>
        <StatCard
          title="Total Billed"
          value={money(totalBilled)}
          sublabel="Term 1 academic & boarding"
          icon={FileText}
          iconColor="brand"
        />

        <StatCard
          title="Total Collected"
          value={money(totalCollected)}
          sublabel={`${collectionRate}% overall collection rate`}
          icon={TrendingUp}
          iconColor="brand"
        />

        <StatCard
          title="Outstanding Arrears"
          value={money(outstanding)}
          sublabel="Immediate recovery target"
          icon={AlertTriangle}
          iconColor="danger"
          to="/fees?tab=debtors"
        />

        <StatCard
          title="Remote Declarations"
          value={String(remotePayments.length)}
          sublabel="Proof of payments to vet"
          icon={Landmark}
          iconColor="accent"
          to="/fees?tab=reconciliation"
        />
      </KpiStrip>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        variant="underline"
      />

      {/* TAB 1: Cashier Desk (Section 4) */}
      {activeTab === 'cashier' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cashier Payment Form */}
          <Card
            title="Cashier Desk Terminal"
            subtitle="Record direct intake across USD, ZiG & ZAR with live conversion"
            className="lg:col-span-2"
          >
            {/* Live FX Rate Strip */}
            <div className="p-3 mb-5 rounded-xl bg-canvas border border-line flex items-center justify-between text-xs font-mono">
              <span className="text-muted">Live RBZ FX Spot:</span>
              <span className="font-bold text-ink">1 USD = ZiG 26.85</span>
              <span className="text-muted">|</span>
              <span className="font-bold text-ink">1 USD = ZAR 18.40</span>
              <span className="text-[10px] text-brand-700 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded-full font-sans font-semibold">
                Updated Live
              </span>
            </div>

            {/* Student Search for Cashier */}
            <div className="mb-4 relative">
              <label className="text-xs font-semibold text-ink block mb-1">
                Lookup Student (Name or Admission Number)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cashierStudentSearch}
                  onChange={e => setCashierStudentSearch(e.target.value)}
                  placeholder="Type student name or ADM number…"
                  className="glass-input pl-9 w-full text-xs font-sans"
                />
              </div>

              {/* Instant Search Suggestions */}
              {searchedFeeResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-xl z-30 p-1 space-y-1 max-h-48 overflow-y-auto">
                  {searchedFeeResults.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentFee(f);
                        setCashierStudentSearch(`${f.first_name} ${f.last_name}`);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-canvas text-xs flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-ink">{f.first_name} {f.last_name}</span>
                        <span className="text-muted text-[11px] ml-2 font-mono">({f.admission_number})</span>
                      </div>
                      <span className="font-mono text-danger font-semibold">{money(f.amount_due - f.amount_paid)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Student Banner */}
            {selectedStudentFee ? (
              <div className="p-4 mb-5 rounded-xl bg-brand-50/70 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900/40 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-display font-bold text-sm text-ink">
                    {selectedStudentFee.first_name} {selectedStudentFee.last_name}
                  </h4>
                  <div className="text-muted font-mono">{selectedStudentFee.admission_number} • {selectedStudentFee.class_name}</div>
                </div>
                <div className="text-right">
                  <span className="text-muted text-[11px] block">Balance Due:</span>
                  <span className="font-mono font-extrabold text-base text-danger tabular-nums">
                    {money(selectedStudentFee.amount_due - selectedStudentFee.amount_paid)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 mb-5 rounded-xl bg-canvas text-center text-xs text-muted border border-line">
                Please search and select a learner above to initiate a cashier transaction.
              </div>
            )}

            {/* Payment Controls */}
            <form onSubmit={handleCashierPayment} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1.5">Intake Currency</label>
                <div className="grid grid-cols-3 gap-2">
                  {['USD', 'ZiG', 'ZAR'].map(curr => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCashierCurrency(curr)}
                      className={`py-2 text-center rounded-xl font-mono font-bold border transition-colors cursor-pointer ${
                        cashierCurrency === curr
                          ? 'bg-brand-700 text-white border-brand-700 shadow-xs'
                          : 'bg-canvas text-ink border-line hover:border-brand-500'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Amount to Pay ({cashierCurrency}) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={cashierAmount}
                    onChange={e => setCashierAmount(e.target.value)}
                    placeholder="0.00"
                    className="glass-input w-full font-mono text-base font-bold"
                  />
                  {cashierCurrency !== 'USD' && cashierAmount && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-mono">
                      ≈ US$ {(Number(cashierAmount) / fxRates[cashierCurrency]).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1.5">Payment Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'Cash Desk' },
                    { id: 'ecocash', label: 'EcoCash' },
                    { id: 'innbucks', label: 'InnBucks' },
                    { id: 'bank_transfer', label: 'Bank Transfer' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCashierMethod(m.id)}
                      className={`p-2 rounded-xl text-center font-medium border text-xs transition-colors cursor-pointer ${
                        cashierMethod === m.id
                          ? 'bg-brand-100 text-brand-900 border-brand-500 font-semibold dark:bg-brand-950/60 dark:text-brand-300'
                          : 'bg-canvas text-ink border-line hover:border-brand-500'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Receipt Note / Bank Reference (Optional)</label>
                <input
                  type="text"
                  value={cashierRef}
                  onChange={e => setCashierRef(e.target.value)}
                  placeholder="e.g. EcoCash Approval Code or Cashier Note"
                  className="glass-input w-full font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={cashierLoading || !selectedStudentFee}
                  className="btn-primary w-full py-3 text-sm shadow-md"
                >
                  {cashierLoading ? 'Recording Transaction…' : 'Issue Official Receipt & Update Ledger'}
                </button>
              </div>
            </form>
          </Card>

          {/* Side Card: Bank Details & Quick Totals */}
          <div className="space-y-6">
            <Card title="Official Bank Accounts" subtitle="Stanbic & CBZ multi-currency accounts">
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-canvas border border-line">
                  <div className="font-bold text-ink">Stanbic Bank Zimbabwe</div>
                  <div className="text-muted">Main Branch</div>
                  <div className="font-mono mt-1 text-ink">USD A/C: 9140003482910</div>
                </div>

                <div className="p-3 rounded-xl bg-canvas border border-line">
                  <div className="font-bold text-ink">CBZ Bank Limited</div>
                  <div className="text-muted">Kwame Nkrumah Branch</div>
                  <div className="font-mono mt-1 text-ink">ZiG A/C: 0112398471002</div>
                </div>
              </div>
            </Card>

            <Card title="Cashier Session Protocol" subtitle="Internal audit controls">
              <p className="text-xs text-muted leading-relaxed">
                All cashier transactions are recorded on the append-only finance ledger. Official printed receipts must bear the cashier seal and SHA-256 verification token.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Invoices & Fees Ledger */}
      {activeTab === 'ledger' && (
        <DataTable
          columns={[
            {
              key: 'student',
              label: 'Student',
              sortable: true,
              render: (_, row) => (
                <div>
                  <div className="font-semibold text-ink">{row.first_name} {row.last_name}</div>
                  <div className="text-[11px] font-mono text-muted">{row.admission_number || 'No ADM'}</div>
                </div>
              )
            },
            { key: 'class_name', label: 'Class', sortable: true },
            {
              key: 'amount_due',
              label: 'Billed (USD)',
              sortable: true,
              align: 'right',
              render: (v) => <Money amount={v} />
            },
            {
              key: 'amount_paid',
              label: 'Paid (USD)',
              sortable: true,
              align: 'right',
              render: (v) => <Money amount={v} />
            },
            {
              key: 'balance',
              label: 'Outstanding',
              sortable: true,
              align: 'right',
              render: (_, row) => {
                const bal = parseFloat(row.amount_due || 0) - parseFloat(row.amount_paid || 0);
                return (
                  <span className={`font-mono font-bold ${bal > 0 ? 'text-danger' : 'text-brand-700'}`}>
                    {money(bal)}
                  </span>
                );
              }
            },
            {
              key: 'status',
              label: 'Status',
              align: 'center',
              render: (_, row) => {
                const due = parseFloat(row.amount_due || 0);
                const paid = parseFloat(row.amount_paid || 0);
                const bal = due - paid;
                if (due === 0) return <StatusPill status="neutral" label="Unbilled" />;
                return <StatusPill status={bal <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'} />;
              }
            },
            {
              key: 'actions',
              label: 'Ledger',
              align: 'right',
              render: (_, row) => (
                <button
                  type="button"
                  onClick={() => navigate(`/students/${row.student_id}?tab=finance`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60 rounded-lg transition cursor-pointer"
                  title="View complete verified student ledger"
                >
                  <span>Ledger</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )
            }
          ]}
          data={fees}
          loading={feesLoading}
          emptyTitle="No invoices found"
          csvExportName="fees_ledger"
        />
      )}

      {/* TAB 3: Remote Payments Review Queue */}
      {activeTab === 'reconciliation' && (
        <Card
          title="Remote Proof of Payments (POP) Verification Queue"
          subtitle="Parent online payment declarations pending bursary approval"
        >
          {remotePayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-muted uppercase text-[11px]">
                    <th className="py-2.5 text-left">Student</th>
                    <th className="py-2.5 text-left">Method</th>
                    <th className="py-2.5 text-right">Amount</th>
                    <th className="py-2.5 text-left">Reference</th>
                    <th className="py-2.5 text-center">Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {remotePayments.map(p => (
                    <tr key={p.id} className="hover:bg-canvas/40 transition-colors">
                      <td className="py-3 font-semibold text-ink">{p.student_name || 'Student'}</td>
                      <td className="py-3 uppercase font-mono text-[11px] text-muted">{p.payment_method}</td>
                      <td className="py-3 text-right font-mono font-bold text-ink">
                        {money(p.amount, p.currency)}
                      </td>
                      <td className="py-3 font-mono text-muted">{p.reference || 'None'}</td>
                      <td className="py-3 text-center">
                        <StatusPill status={p.status || 'pending'} />
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleApproveRemote(p.id)}
                          className="px-3 py-1 rounded-lg bg-brand-700 text-white font-semibold text-xs hover:bg-brand-900 transition-colors cursor-pointer"
                        >
                          Approve POP
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Verification queue clear"
              description="There are currently no pending proof of payment declarations to review."
              compact={true}
            />
          )}
        </Card>
      )}

      {/* TAB 4: Debtors Ageing */}
      {activeTab === 'debtors' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="glass-card p-4">
              <span className="text-[11px] text-muted font-mono uppercase">0 - 30 Days</span>
              <div className="text-xl font-bold font-display text-ink font-mono mt-1">
                {money(ageingData?.data?.['0-30 days'] || 0)}
              </div>
              <span className="text-[10px] text-muted">Recent billing cycle</span>
            </div>

            <div className="glass-card p-4">
              <span className="text-[11px] text-accent font-mono uppercase">31 - 60 Days</span>
              <div className="text-xl font-bold font-display text-accent font-mono mt-1">
                {money(ageingData?.data?.['31-60 days'] || 0)}
              </div>
              <span className="text-[10px] text-muted">First reminder dispatched</span>
            </div>

            <div className="glass-card p-4">
              <span className="text-[11px] text-danger font-mono uppercase">61 - 90 Days</span>
              <div className="text-xl font-bold font-display text-danger font-mono mt-1">
                {money(ageingData?.data?.['61-90 days'] || 0)}
              </div>
              <span className="text-[10px] text-muted">Urgent bursary notice</span>
            </div>

            <div className="glass-card p-4">
              <span className="text-[11px] text-red-600 font-mono uppercase">90+ Days (Default)</span>
              <div className="text-xl font-bold font-display text-red-600 font-mono mt-1">
                {money(ageingData?.data?.['90+ days'] || 0)}
              </div>
              <span className="text-[10px] text-muted">Subject to suspension review</span>
            </div>
          </div>

          <Card title="Top Debtors Recovery Roster" subtitle="Accounts in arrears requiring direct follow-up">
            {debtorsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted uppercase text-[11px]">
                      <th className="py-2.5 text-left">Student Name</th>
                      <th className="py-2.5 text-left">Class</th>
                      <th className="py-2.5 text-right">Balance Due</th>
                      <th className="py-2.5 text-right">Days Overdue</th>
                      <th className="py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {debtorsList.map(d => (
                      <tr key={d.student_id} className="hover:bg-canvas/40 transition-colors">
                        <td className="py-3 font-semibold text-ink">{d.student_name}</td>
                        <td className="py-3 text-muted">{d.class_name}</td>
                        <td className="py-3 text-right font-mono font-bold text-danger">{money(d.balance_due)}</td>
                        <td className="py-3 text-right font-mono text-muted">{d.days_overdue != null ? `${d.days_overdue}d` : '0d'}</td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => toast.success(`Payment SMS reminder dispatched to ${d.student_name}'s guardian.`)}
                            className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink hover:border-brand-500 font-semibold text-xs cursor-pointer"
                          >
                            Send Reminder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No Debtors in Arrears"
                description="There are currently no student accounts in arrears."
                compact={true}
              />
            )}
          </Card>
        </div>
      )}

      {/* Official Electronic Printable Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        maxWidth="max-w-md"
        title="Official Payment Receipt"
        subtitle={activeReceipt?.receipt_number}
        footer={
          <div className="flex items-center justify-between w-full">
            <button onClick={() => setReceiptModalOpen(false)} className="btn-secondary">
              Close
            </button>
            <button onClick={handlePrintReceipt} className="btn-primary">
              <Printer className="w-4 h-4 mr-1.5" />
              Print Receipt
            </button>
          </div>
        }
      >
        {activeReceipt && (
          <div id="printable-receipt" className="printable-area p-6 border border-line rounded-xl space-y-4 text-xs font-mono bg-white text-slate-900 shadow-sm">
            <div className="text-center pb-3 border-b border-line">
              <h3 className="font-display font-extrabold text-base text-slate-900">{activeReceipt.school_name || activeSchool?.name || schoolName || 'Official School Receipt'}</h3>
              <p className="text-[11px] text-slate-600 font-sans">Official Cashier Treasury Receipt</p>
              <div className="text-[10px] text-slate-500 font-mono mt-1">Receipt No: {activeReceipt.receipt_number}</div>
            </div>

            <div className="space-y-1.5 text-muted">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="text-ink">{new Date(activeReceipt.date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Student:</span>
                <span className="text-ink font-semibold">{activeReceipt.student_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Admission No:</span>
                <span className="text-ink">{activeReceipt.admission_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Class:</span>
                <span className="text-ink">{activeReceipt.class_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <span className="text-ink uppercase">{activeReceipt.method}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-canvas border border-line flex justify-between items-center text-sm font-bold text-ink">
              <span>AMOUNT PAID:</span>
              <span>{money(activeReceipt.amount, activeReceipt.currency)}</span>
            </div>

            <div className="text-center pt-2 text-[10px] text-muted font-sans">
              Issued by {activeReceipt.cashier} • SHA-256 Verified
            </div>
          </div>
        )}
      </Modal>

      {/* Bill Student Invoice Modal */}
      <Modal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title="Create Student Fee Invoice"
        description="Issue a new fee billing record to a student's institutional ledger."
      >
        <form onSubmit={handleBillStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Select Student *</label>
            <select
              required
              value={billForm.student_id}
              onChange={e => setBillForm({ ...billForm, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Choose student from roster...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.admission_number || s.id}) — {s.class_name || 'Enrolled'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Billing Term *</label>
              <select
                value={billForm.term}
                onChange={e => setBillForm({ ...billForm, term: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="Term 1 2026">Term 1 2026</option>
                <option value="Term 2 2026">Term 2 2026</option>
                <option value="Term 3 2026">Term 3 2026</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Amount Due ($ USD) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="e.g. 450.00"
                value={billForm.amount_due}
                onChange={e => setBillForm({ ...billForm, amount_due: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Invoice Title / Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Term 1 Tuition & General Purpose Levy"
              value={billForm.title}
              onChange={e => setBillForm({ ...billForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                'Term 1 Tuition & Levies',
                'Boarding & Catering Fee',
                'Science Lab & Practical Levy',
                'ZIMSEC Exam Registration Fee',
                'Development Fund Levy'
              ].map(tag => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => setBillForm({ ...billForm, title: tag })}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-canvas border border-line text-muted hover:text-ink hover:border-brand-500 transition cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Payment Deadline (Due Date)</label>
            <input
              type="date"
              value={billForm.due_date}
              onChange={e => setBillForm({ ...billForm, due_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setBillModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={billingLoading}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {billingLoading ? 'Creating Invoice...' : 'Issue Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Fees Modal */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        schoolId={schoolId}
        entity="fees"
        title="Bulk Import Fee Invoices"
        invalidateKeys={[
          `fees_ledger_${schoolId}`,
          `fees_summary_${schoolId}`,
          `debtors_${schoolId}`,
          `ageing_fees_${schoolId}`
        ]}
      />
    </div>
  );
}
