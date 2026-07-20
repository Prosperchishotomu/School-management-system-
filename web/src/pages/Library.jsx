import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { BookOpen, Plus, X, Loader2, RotateCcw } from 'lucide-react';

const Library = () => {
  const { activeSchoolId, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'book', code: '', description: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Lend book state hooks
  const [showLendModal, setShowLendModal] = useState(false);
  const [selectedAssetForLend, setSelectedAssetForLend] = useState(null);
  const [lendForm, setLendForm] = useState({ holder_type: 'student', holder_id: '' });
  const [lendLoading, setLendLoading] = useState(false);

  const fetchAssets = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/assets?page=${page}&per_page=20&category=book`)
      .then(res => {
        setAssets(res.data || []);
        if (res.meta) setTotalPages(Math.ceil((res.meta.total || 1) / 20));
        setError('');
      })
      .catch(() => { setAssets([]); setError('Could not load library assets.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAssets(); }, [activeSchoolId, page]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post(`/schools/${activeSchoolId}/assets`, form);
      setShowModal(false);
      setForm({ name: '', category: 'book', code: '', description: '' });
      fetchAssets();
    } catch (err) {
      setFormError(err.message || 'Failed to add asset.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleReturn = async (assetId) => {
    try {
      await api.post(`/schools/${activeSchoolId}/assets/${assetId}/return`, {});
      fetchAssets();
    } catch {}
  };

  const handleLend = async (e) => {
    e.preventDefault();
    setLendLoading(true);
    try {
      await api.post(`/schools/${activeSchoolId}/assets/${selectedAssetForLend.id}/issue`, {
        holder_type: lendForm.holder_type,
        holder_id: lendForm.holder_id
      });
      setShowLendModal(false);
      setLendForm({ holder_type: 'student', holder_id: '' });
      fetchAssets();
    } catch (err) {
      alert(err.message || 'Failed to lend book.');
    } finally {
      setLendLoading(false);
    }
  };

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center font-sans animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 text-sm">Select a school tenant from the sidebar switcher to load the library and asset directory.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Library &amp; Asset Management</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Track books, equipment, and issued items with holder history.</p>
        </div>
        {user?.role === 'school_admin' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /><span>Add Asset</span>
          </button>
        )}
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{error}</div>}

      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-6">Code</th>
              <th className="py-4 px-6">Name / Title</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6">Issued To</th>
              <th className="py-4 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
            {loading ? (
              <tr><td colSpan="5" className="py-12 text-center text-xs text-ink/40">Loading assets...</td></tr>
            ) : assets.map(a => (
              <tr key={a.id} className="hover:bg-sage/5 transition-colors">
                <td className="py-4 px-6 font-mono text-xs numeric-data text-ink/60">{a.code || '—'}</td>
                <td className="py-4 px-6 font-bold">{a.name}</td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${a.status === 'available' ? 'bg-sage/35 text-teal-dark' : 'bg-amber-warning/15 text-amber-warning'}`}>
                    {a.status || 'available'}
                  </span>
                </td>
                <td className="py-4 px-6 text-xs text-ink/70">{a.holder_name || '—'}</td>
                 <td className="py-4 px-6 text-right">
                  <div className="inline-flex space-x-2 justify-end">
                    {a.status === 'issued' && (
                      <button onClick={() => handleReturn(a.id)} className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary text-xs font-semibold rounded-lg cursor-pointer">
                        <RotateCcw className="w-3.5 h-3.5" /><span>Return</span>
                      </button>
                    )}
                    {a.status === 'available' && user?.role === 'school_admin' && (
                      <button onClick={() => { setSelectedAssetForLend(a); setShowLendModal(true); }} className="inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-primary text-paper hover:bg-teal-dark text-xs font-semibold rounded-lg cursor-pointer">
                        <span>Lend</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {assets.length === 0 && !loading && (
              <tr><td colSpan="5" className="py-8 text-center text-ink/50 text-xs">No books registered yet.</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="p-4 border-t border-line-border/30 flex justify-between items-center bg-paper/30">
            <button onClick={() => setPage(p => Math.max(p-1, 1))} disabled={page===1} className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer">Previous</button>
            <span className="text-xs font-mono text-ink/50">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(p+1, totalPages))} disabled={page===totalPages} className="px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer">Next</button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Add Library Asset</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Name / Title *</label>
                <input required type="text" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input type="hidden" value="book" />
                  <span className="block px-3 py-2 bg-sage/10 text-teal-dark border border-line-border rounded-lg text-xs font-semibold">Book / Textbook</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Asset Code</label>
                  <input type="text" placeholder="e.g. LIB-001" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Description</label>
                <textarea rows="2" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2">
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Asset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showLendModal && selectedAssetForLend && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-paper rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowLendModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Lend Book</h3>
            <div className="p-3 bg-sage/5 border border-line-border/20 rounded-xl mb-4 font-mono text-[10px] space-y-1">
              <p>Title: <span className="font-bold text-ink">{selectedAssetForLend.name}</span></p>
              <p>Code: <span className="font-bold text-ink">{selectedAssetForLend.code}</span></p>
            </div>
            <form onSubmit={handleLend} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Borrower Type *</label>
                <select className="w-full px-3 py-2 border border-line-border rounded-lg text-xs bg-paper focus:outline-none focus:border-teal-primary" value={lendForm.holder_type} onChange={e => setLendForm({...lendForm, holder_type: e.target.value})}>
                  <option value="student">Student</option>
                  <option value="staff">Teacher / Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Borrower ID *</label>
                <input required type="text" placeholder="e.g. STU00001 or USR00003" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={lendForm.holder_id} onChange={e => setLendForm({...lendForm, holder_id: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowLendModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={lendLoading} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2">
                  {lendLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Check Out</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;