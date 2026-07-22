import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  DollarSign, Zap, Wifi, Fuel, ShoppingBag, Plus, Loader2, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp, ShieldCheck
} from 'lucide-react';

const Expenses = () => {
  const { activeSchoolId } = useAuth();
  const [expenseData, setExpenseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Record Expense Form State
  const [form, setForm] = useState({
    title: '',
    category: 'internet_ict',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    receipt_ref: ''
  });

  const fetchData = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.get('/expenses');
      setExpenseData(res.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to retrieve operational expenditure records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSchoolId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/expenses', form);
      setMessage({ type: 'success', text: `Operational expense '${form.title}' recorded successfully.` });
      setForm({
        title: '',
        category: 'internet_ict',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        vendor_name: '',
        receipt_ref: ''
      });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to record expense.' });
    } finally {
      setSubmitting(false);
    }
  };

  const summary = expenseData?.summary || { total_fee_revenue: 0, total_expenses: 0, net_profit_loss: 0 };
  const categories = expenseData?.category_breakdown || [];
  const expenses = expenseData?.expenses || [];

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'internet_ict': return <Wifi className="w-4 h-4 text-sky-500" />;
      case 'utilities_electricity': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'fuel_maintenance': return <Fuel className="w-4 h-4 text-rose-500" />;
      case 'food_catering': return <ShoppingBag className="w-4 h-4 text-teal-primary" />;
      default: return <DollarSign className="w-4 h-4 text-ink/50" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Operational Expenditure &amp; Accounts Payable</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Track Starlink satellite internet, ZESA electricity tokens, generator fuel, and dining hall catering.</p>
        </div>
      </div>

      {/* Financial KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between border border-line-border/30 bg-white">
          <div>
            <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Total Tuition Fees Collected</span>
            <p className="text-2xl font-display font-bold text-teal-primary mt-1 numeric-data">${summary.total_fee_revenue?.toLocaleString() || '0.00'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-teal-primary" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 flex items-center justify-between border border-line-border/30 bg-white">
          <div>
            <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Total Operational Expenditure</span>
            <p className="text-2xl font-display font-bold text-brick-critical mt-1 numeric-data">${summary.total_expenses?.toLocaleString() || '0.00'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brick-critical/10 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-brick-critical" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 flex items-center justify-between border border-line-border/30 bg-white">
          <div>
            <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">School Operating Surplus / Net P&amp;L</span>
            <p className={`text-2xl font-display font-bold mt-1 numeric-data ${
              summary.net_profit_loss >= 0 ? 'text-teal-primary' : 'text-brick-critical'
            }`}>
              ${summary.net_profit_loss?.toLocaleString() || '0.00'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sage/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-teal-dark" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 border ${
          message.type === 'success' ? 'bg-sage/20 text-teal-dark border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border-brick-critical/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-teal-primary" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Record Expense Form */}
          <div className="glass-panel p-6 rounded-2xl border border-line-border/30 h-fit space-y-4">
            <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-teal-primary" />
              <span>Record Operational Expenditure</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Expense Title / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starlink Monthly Internet Subscription"
                  className="w-full glass-input rounded-xl text-xs"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Category</label>
                  <select
                    className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="internet_ict">Starlink / Internet / ICT</option>
                    <option value="utilities_electricity">ZESA Electricity / Power</option>
                    <option value="fuel_maintenance">Generator Diesel / Vehicle Fuel</option>
                    <option value="food_catering">Dining Hall Grocery / Catering</option>
                    <option value="rent_accommodation">Staff Quarters / Facility Rent</option>
                    <option value="supplies">Classroom Supplies &amp; Books</option>
                    <option value="other">Other Overhead Expenses</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Amount ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="120.00"
                    className="w-full glass-input rounded-xl text-xs font-mono font-bold"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Vendor / Service Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. Starlink / ZETDC"
                    className="w-full glass-input rounded-xl text-xs"
                    value={form.vendor_name}
                    onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Receipt / Invoice Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-STL-90812"
                    className="w-full glass-input rounded-xl text-xs"
                    value={form.receipt_ref}
                    onChange={e => setForm({ ...form, receipt_ref: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Expense Date</label>
                <input
                  type="date"
                  required
                  className="w-full glass-input rounded-xl text-xs"
                  value={form.expense_date}
                  onChange={e => setForm({ ...form, expense_date: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Post Expense Entry</span>
              </button>
            </form>
          </div>

          {/* Expense Ledger Table */}
          <div className="lg:col-span-2 glass-panel rounded-2xl border border-line-border/30 overflow-hidden h-fit">
            <div className="p-4 border-b border-line-border/30 bg-sage/5 flex justify-between items-center">
              <h4 className="text-xs font-sans font-bold text-ink uppercase tracking-wider">Operational Expense Ledger ({expenses.length})</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                <thead>
                  <tr className="bg-sage/10 border-b border-line-border/30 text-ink/60 font-bold uppercase tracking-wider">
                    <th className="py-3 px-5">Expense Details</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5">Vendor / Receipt Ref</th>
                    <th className="py-3 px-5 text-right pr-6">Amount ($ USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border/20">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-sage/5 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-ink">{e.title}</div>
                        <span className="text-[10px] text-ink/50 font-mono">{e.expense_date}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center space-x-1.5 font-semibold text-teal-dark capitalize">
                          {getCategoryIcon(e.category)}
                          <span>{e.category.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="text-ink/80 font-medium">{e.vendor_name || 'N/A'}</div>
                        {e.receipt_ref && <span className="text-[10px] font-mono text-ink/50">{e.receipt_ref}</span>}
                      </td>
                      <td className="py-3.5 px-5 text-right pr-6 font-mono font-bold text-brick-critical">
                        -${parseFloat(e.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-ink/40">
                        No operational expenses recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
