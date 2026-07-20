import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Megaphone, Plus, X, Loader2, Trash2 } from 'lucide-react';

const Announcements = () => {
  const { activeSchoolId, user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', class_id: '', expires_at: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [classes, setClasses] = useState([]);

  const fetchAll = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    Promise.all([
      api.get(`/schools/${activeSchoolId}/announcements`),
      api.get(`/schools/${activeSchoolId}/classes`)
    ])
      .then(([ann, cls]) => {
        setAnnouncements(ann.data || []);
        setClasses(cls.data || []);
        setError('');
      })
      .catch(() => setError('Could not load announcements.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [activeSchoolId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post(`/schools/${activeSchoolId}/announcements`, { ...form, class_id: form.class_id || null });
      setShowModal(false);
      setForm({ title: '', body: '', class_id: '', expires_at: '' });
      fetchAll();
    } catch (err) {
      setFormError(err.message || 'Failed to post announcement.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/announcements/${id}`);
      fetchAll();
    } catch {}
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Announcements</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Broadcast notices to all staff, a specific class, or the whole school.</p>
        </div>
        {(user?.role === 'school_admin' || user?.role === 'teacher') && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /><span>Post Announcement</span>
          </button>
        )}
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{error}</div>}

      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-ink/40">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-ink/40 text-sm">
            No announcements posted yet.
          </div>
        ) : announcements.map(ann => (
          <div key={ann.id} className="glass-card glass-card-hover rounded-2xl p-6 border border-line-border/30">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <div className="flex items-center space-x-2 mb-1">
                  <Megaphone className="w-4 h-4 text-teal-primary flex-shrink-0" />
                  <h3 className="font-display font-bold text-ink text-lg">{ann.title}</h3>
                  {ann.class_name && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sage/35 text-teal-dark">{ann.class_name}</span>
                  )}
                  {!ann.class_id && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-warning/15 text-amber-warning">All School</span>
                  )}
                </div>
                <p className="text-sm font-sans text-ink/70 mt-2 leading-relaxed">{ann.body}</p>
                <div className="flex items-center space-x-4 mt-3">
                  <span className="text-[10px] font-mono text-ink/40 numeric-data">{ann.created_at}</span>
                  {ann.expires_at && (
                    <span className="text-[10px] font-mono text-amber-warning numeric-data">Expires: {ann.expires_at}</span>
                  )}
                </div>
              </div>
              {user?.role === 'school_admin' && (
                <button onClick={() => handleDelete(ann.id)} className="text-ink/30 hover:text-brick-critical transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Post Announcement</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Title *</label>
                <input required type="text" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Message *</label>
                <textarea required rows="4" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary resize-none" value={form.body} onChange={e => setForm({...form, body: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Target Class (optional)</label>
                  <select className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})}>
                    <option value="">All School</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Expiry Date (optional)</label>
                  <input type="date" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} />
                </div>
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2">
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Post</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;