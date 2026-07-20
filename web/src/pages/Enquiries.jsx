import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  ClipboardList,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  UserPlus
} from 'lucide-react';

const STATUS_STYLES = {
  new:       'bg-sky-100 text-sky-700',
  contacted: 'bg-amber-100 text-amber-700',
  tour:      'bg-purple-100 text-purple-700',
  offered:   'bg-teal-100 text-teal-700',
  enrolled:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-700',
};

const Enquiries = () => {
  const { activeSchoolId } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    applicant_name: '', grade_applying_for: '', guardian_name: '',
    guardian_phone: '', guardian_email: '', notes: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchEnquiries = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    const params = new URLSearchParams({ page, per_page: 20, status: statusFilter });
    api.get(`/schools/${activeSchoolId}/enquiries?${params}`)
      .then(res => {
        setEnquiries(res.data || []);
        if (res.meta) setTotalPages(Math.ceil((res.meta.total || 1) / 20));
        setError('');
      })
      .catch(() => {
        setEnquiries([]);
        setError('Could not load enquiries.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEnquiries(); }, [activeSchoolId, page, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post(`/schools/${activeSchoolId}/enquiries`, form);
      setShowModal(false);
      setForm({ applicant_name: '', grade_applying_for: '', guardian_name: '', guardian_phone: '', guardian_email: '', notes: '' });
      fetchEnquiries();
    } catch (err) {
      setFormError(err.message || 'Failed to create enquiry.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await api.patch(`/schools/${activeSchoolId}/enquiries/${id}`, { status: newStatus });
      fetchEnquiries();
    } catch {}
  };

  const handleConvert = async (id) => {
    if (!window.confirm('Convert this enquiry into a full student record?')) return;
    try {
      await api.post(`/schools/${activeSchoolId}/enquiries/${id}/convert`, {});
      fetchEnquiries();
    } catch (err) {
      alert(err.message || 'Conversion failed.');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Enquiries &amp; Admissions</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Track prospective student applications through the admissions pipeline.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /><span>New Enquiry</span>
        </button>
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{error}</div>}

      {/* Pipeline Filter */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-2">
        {['', 'new', 'contacted', 'tour', 'offered', 'enrolled', 'declined'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-semibold transition-all cursor-pointer ${
              statusFilter === s
                ? 'bg-teal-primary text-paper shadow-md'
                : 'bg-ink/5 text-ink/60 hover:bg-ink/10'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-6">Applicant</th>
              <th className="py-4 px-6">Grade</th>
              <th className="py-4 px-6">Guardian</th>
              <th className="py-4 px-6">Phone</th>
              <th className="py-4 px-6 text-center">Status</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
            {loading ? (
              <tr><td colSpan="6" className="py-12 text-center text-xs text-ink/40">Loading enquiries...</td></tr>
            ) : enquiries.map(e => (
              <tr key={e.id} className="hover:bg-sage/5 transition-colors">
                <td className="py-4 px-6 font-bold">{e.applicant_name}</td>
                <td className="py-4 px-6 text-ink/70">{e.grade_applying_for}</td>
                <td className="py-4 px-6 text-ink/70">{e.guardian_name}</td>
                <td className="py-4 px-6 font-mono text-xs numeric-data">{e.guardian_phone || '—'}</td>
                <td className="py-4 px-6 text-center">
                  <select
                    value={e.status}
                    onChange={(ev) => handleStatusUpdate(e.id, ev.target.value)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_STYLES[e.status] || 'bg-ink/10 text-ink'}`}
                  >
                    {Object.keys(STATUS_STYLES).map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td className="py-4 px-6 text-right">
                  {e.status === 'offered' && (
                    <button
                      onClick={() => handleConvert(e.id)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /><span>Enrol</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {enquiries.length === 0 && !loading && (
              <tr><td colSpan="6" className="py-8 text-center text-ink/50 text-xs">No enquiries found.</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="p-4 border-t border-line-border/30 flex justify-between items-center bg-paper/30">
            <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer">Previous</button>
            <span className="text-xs font-mono text-ink/50">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer">Next</button>
          </div>
        )}
      </div>

      {/* New Enquiry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">New Admission Enquiry</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Applicant Name *</label>
                  <input required type="text" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.applicant_name} onChange={e => setForm({...form, applicant_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Grade Applying For *</label>
                  <input required type="text" placeholder="e.g. Form 1" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.grade_applying_for} onChange={e => setForm({...form, grade_applying_for: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Guardian / Parent Name *</label>
                <input required type="text" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.guardian_name} onChange={e => setForm({...form, guardian_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Phone</label>
                  <input type="text" placeholder="+2637..." className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.guardian_phone} onChange={e => setForm({...form, guardian_phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Email</label>
                  <input type="email" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.guardian_email} onChange={e => setForm({...form, guardian_email: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Notes</label>
                <textarea rows="2" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer flex items-center space-x-2">
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Enquiry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Enquiries;