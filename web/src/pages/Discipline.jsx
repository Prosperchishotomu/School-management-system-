import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { AlertTriangle, Plus, X, Loader2, CheckCircle2 } from 'lucide-react';

const SEVERITY_STYLES = {
  minor:  { pill: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  moderate: { pill: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  serious: { pill: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const Discipline = () => {
  const { activeSchoolId, user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isViewOnly = user?.role === 'parent' || user?.role === 'school_admin';

  const [showModal, setShowModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({ incident_type: '', severity: 'minor', description: '', action_taken: '', incident_date: new Date().toISOString().split('T')[0] });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchIncidents = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/discipline?page=${page}&per_page=20`)
      .then(res => {
        setIncidents(res.data || []);
        if (res.meta) setTotalPages(Math.ceil((res.meta.total || 1) / 20));
        setError('');
      })
      .catch(() => { setIncidents([]); setError('Could not load incidents.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchIncidents(); }, [activeSchoolId, page]);

  const searchStudents = (term) => {
    if (!term || term.length < 2) { setStudentResults([]); return; }
    api.get(`/schools/${activeSchoolId}/students?search=${encodeURIComponent(term)}&per_page=5`)
      .then(res => setStudentResults(res.data || []))
      .catch(() => setStudentResults([]));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (!selectedStudent) { setFormError('Please select a student.'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      await api.post(`/schools/${activeSchoolId}/students/${selectedStudent.id}/discipline`, form);
      setShowModal(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setForm({ incident_type: '', severity: 'minor', description: '', action_taken: '', incident_date: new Date().toISOString().split('T')[0] });
      fetchIncidents();
    } catch (err) {
      setFormError(err.message || 'Failed to log incident.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleResolve = async (incidentId) => {
    if (isViewOnly) return;
    try {
      await api.patch(`/schools/${activeSchoolId}/discipline/${incidentId}`, { status: 'resolved' });
      fetchIncidents();
    } catch {}
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Discipline &amp; Incident Log</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {isViewOnly 
              ? 'Confidential incident records. View-only mode.' 
              : 'Confidential incident records. Authorised log entry enabled.'}
          </p>
        </div>
        {!isViewOnly && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-brick-critical hover:bg-brick-critical/80 text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /><span>Log Incident</span>
          </button>
        )}
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{error}</div>}

      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-6">Date</th>
              <th className="py-4 px-6">Student</th>
              <th className="py-4 px-6">Type</th>
              <th className="py-4 px-6">Severity</th>
              <th className="py-4 px-6 max-w-xs">Description</th>
              <th className="py-4 px-6 text-center">Status</th>
              {!isViewOnly && <th className="py-4 px-6 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
            {loading ? (
              <tr><td colSpan={isViewOnly ? "6" : "7"} className="py-12 text-center text-xs text-ink/40">Loading incidents...</td></tr>
            ) : incidents.map(inc => (
              <tr key={inc.id} className="hover:bg-sage/5 transition-colors">
                <td className="py-4 px-6 font-mono text-xs numeric-data text-ink/60 whitespace-nowrap">{inc.incident_date}</td>
                <td className="py-4 px-6 font-bold">{inc.student_name || `Student #${inc.student_id}`}</td>
                <td className="py-4 px-6 text-ink/70">{inc.incident_type}</td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${SEVERITY_STYLES[inc.severity]?.pill || 'bg-ink/10 text-ink'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_STYLES[inc.severity]?.dot || 'bg-ink/50'}`}></span>
                    <span>{inc.severity}</span>
                  </span>
                </td>
                <td className="py-4 px-6 text-xs text-ink/70 max-w-xs truncate">{inc.description}</td>
                <td className="py-4 px-6 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${inc.status === 'resolved' ? 'bg-sage/35 text-teal-dark' : 'bg-amber-warning/15 text-amber-warning'}`}>
                    {inc.status || 'open'}
                  </span>
                </td>
                {!isViewOnly && (
                  <td className="py-4 px-6 text-right">
                    {inc.status !== 'resolved' && (
                      <button onClick={() => handleResolve(inc.id)} className="text-[10px] font-semibold text-teal-primary hover:underline cursor-pointer">
                        Mark Resolved
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {incidents.length === 0 && !loading && (
              <tr><td colSpan={isViewOnly ? "6" : "7"} className="py-8 text-center text-ink/50 text-xs">No incidents recorded.</td></tr>
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

      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Log Discipline Incident</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              {/* Student picker */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Student *</label>
                {selectedStudent ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-sage/20 border border-teal-primary/30 rounded-lg">
                    <span className="text-xs font-bold text-ink">{selectedStudent.first_name} {selectedStudent.last_name}</span>
                    <button type="button" onClick={() => setSelectedStudent(null)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div>
                    <input type="text" placeholder="Search student name..." className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary"
                      value={studentSearch}
                      onChange={e => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                    />
                    {studentResults.length > 0 && (
                      <div className="mt-1 border border-line-border rounded-lg overflow-hidden bg-paper shadow-sm">
                        {studentResults.map(s => (
                          <button key={s.id} type="button" onClick={() => { setSelectedStudent(s); setStudentResults([]); setStudentSearch(''); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-sage/20 transition-colors cursor-pointer">
                            {s.first_name} {s.last_name} — {s.class_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Incident Type *</label>
                  <input required type="text" placeholder="e.g. Fighting, Cheating" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.incident_type} onChange={e => setForm({...form, incident_type: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Severity *</label>
                  <select className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}>
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="serious">Serious</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Date of Incident *</label>
                <input required type="date" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.incident_date} onChange={e => setForm({...form, incident_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Description *</label>
                <textarea required rows="3" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Action Taken</label>
                <textarea rows="2" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary resize-none" value={form.action_taken} onChange={e => setForm({...form, action_taken: e.target.value})} />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-brick-critical hover:bg-brick-critical/80 text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer flex items-center space-x-2">
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Log Incident</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discipline;