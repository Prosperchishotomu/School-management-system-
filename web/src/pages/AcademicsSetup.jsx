import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { Calendar, BookOpen, Layers, Award, Plus, CheckCircle, RefreshCw, Layers3, Users } from 'lucide-react';

export default function AcademicsSetup() {
  const { activeSchoolId } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('sessions');
  const [loading, setLoading] = useState(false);

  // State arrays
  const [sessions, setSessions] = useState([]);
  const [terms, setTerms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [promotionRules, setPromotionRules] = useState([]);

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchData();
  }, [activeSchoolId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sessions') {
        const res = await api.get(`/schools/${activeSchoolId}/sessions`);
        setSessions(res.data || []);
      } else if (activeTab === 'terms') {
        const res = await api.get(`/schools/${activeSchoolId}/terms`);
        setTerms(res.data || []);
      } else if (activeTab === 'departments') {
        const res = await api.get(`/schools/${activeSchoolId}/departments`);
        setDepartments(res.data || []);
      } else if (activeTab === 'class-subjects') {
        const res = await api.get(`/schools/${activeSchoolId}/class-subjects`);
        setClassSubjects(res.data || []);
      } else if (activeTab === 'promotion') {
        const res = await api.get(`/promotion-rules`);
        setPromotionRules(res.data || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load academic configuration data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'sessions') {
        await api.post(`/schools/${activeSchoolId}/sessions`, formData);
        toast.success('Academic Session created successfully.');
      } else if (activeTab === 'terms') {
        await api.post(`/schools/${activeSchoolId}/terms`, formData);
        toast.success('Term configured successfully.');
      } else if (activeTab === 'departments') {
        await api.post(`/schools/${activeSchoolId}/departments`, formData);
        toast.success('Department added successfully.');
      } else if (activeTab === 'class-subjects') {
        await api.post(`/schools/${activeSchoolId}/class-subjects`, formData);
        toast.success('Subject assigned to class.');
      } else if (activeTab === 'promotion') {
        await api.post(`/promotion-rules`, formData);
        toast.success('Promotion rule saved.');
      }
      setShowModal(false);
      setFormData({});
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Operation failed.');
    }
  };

  return (
    <div className="module-page academics-page p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-primary/10 via-sky-info/5 to-surface p-6 rounded-2xl border border-line-border backdrop-blur-md shadow-sm">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-teal-primary" />
            Academic Setup & Structure
          </h1>
          <p className="text-ink/60 text-sm mt-1">
            Configure Academic Sessions, MoPSE Terms, Subject Allocations, Departments & Promotion Engines
          </p>
        </div>
        <button
          onClick={() => { setFormData({}); setShowModal(true); }}
          className="px-5 py-3 bg-teal-primary hover:bg-teal-dark text-white font-medium rounded-lg shadow-sm transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Configuration
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line-border pb-2">
        {[
          { id: 'sessions', label: 'Academic Sessions', icon: Calendar },
          { id: 'terms', label: 'MoPSE Terms', icon: Layers },
          { id: 'departments', label: 'Departments', icon: Layers3 },
          { id: 'class-subjects', label: 'Class Subjects', icon: BookOpen },
          { id: 'promotion', label: 'Promotion Rules', icon: Award }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? 'bg-teal-primary/10 text-teal-dark border border-teal-primary/30 shadow-sm'
                : 'text-ink/55 hover:text-ink hover:bg-sage'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table Content */}
      <div className="glass-card rounded-2xl border border-line-border p-6 backdrop-blur-xl shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center items-center text-teal-primary gap-3">
            <RefreshCw className="w-6 h-6 animate-spin" />
            Loading configuration...
          </div>
        ) : (
          <div>
            {activeTab === 'sessions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line-border text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      <th className="py-4 px-4">Year</th>
                      <th className="py-4 px-4">Session Name</th>
                      <th className="py-4 px-4">Start Date</th>
                      <th className="py-4 px-4">End Date</th>
                      <th className="py-4 px-4">Current Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/60 text-sm text-ink/80">
                    {sessions.map(s => (
                      <tr key={s.id} className="hover:bg-sage transition-colors">
                        <td className="py-4 px-4 font-bold text-ink">{s.year}</td>
                        <td className="py-4 px-4">{s.name}</td>
                        <td className="py-4 px-4">{s.start_date?.slice(0, 10)}</td>
                        <td className="py-4 px-4">{s.end_date?.slice(0, 10)}</td>
                        <td className="py-4 px-4">
                          {s.is_current ? (
                            <span className="px-3 py-1 bg-teal-primary/10 text-teal-dark rounded-full text-xs font-semibold border border-teal-primary/25 flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3.5 h-3.5" /> Active Session
                            </span>
                          ) : (
                            <span className="text-ink/45 text-xs">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr><td colSpan="5" className="text-center py-10 text-ink/45">No academic sessions found. Create your first calendar session.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'terms' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line-border text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      <th className="py-4 px-4">Term</th>
                      <th className="py-4 px-4">Session Year</th>
                      <th className="py-4 px-4">Start Date</th>
                      <th className="py-4 px-4">End Date</th>
                      <th className="py-4 px-4">Half Term Dates</th>
                      <th className="py-4 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/60 text-sm text-ink/80">
                    {terms.map(t => (
                      <tr key={t.id} className="hover:bg-sage transition-colors">
                        <td className="py-4 px-4 font-bold text-ink">{t.name}</td>
                        <td className="py-4 px-4">{t.session_year || 'N/A'}</td>
                        <td className="py-4 px-4">{t.start_date?.slice(0, 10)}</td>
                        <td className="py-4 px-4">{t.end_date?.slice(0, 10)}</td>
                        <td className="py-4 px-4 text-xs text-ink/55">
                          {t.half_term_start ? `${t.half_term_start?.slice(0, 10)} - ${t.half_term_end?.slice(0, 10)}` : 'None'}
                        </td>
                        <td className="py-4 px-4">
                          {t.is_current ? (
                            <span className="px-3 py-1 bg-teal-primary/10 text-teal-dark rounded-full text-xs font-semibold border border-teal-primary/25">
                              Active Term
                            </span>
                          ) : (
                            <span className="text-ink/45 text-xs">Completed / Scheduled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {terms.length === 0 && (
                      <tr><td colSpan="6" className="text-center py-10 text-ink/45">No MoPSE term dates configured yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'departments' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map(d => (
                  <div key={d.id} className="p-5 bg-surface rounded-xl border border-line-border hover:border-teal-primary/40 transition-all">
                    <h3 className="font-bold text-lg text-ink">{d.name}</h3>
                    <p className="text-xs text-teal-dark font-mono mt-1">Code: {d.code || 'N/A'}</p>
                    <div className="mt-4 pt-4 border-t border-line-border flex items-center justify-between text-xs text-ink/55">
                      <span>Head of Dept:</span>
                      <span className="font-semibold text-ink/80">{d.head_name || 'Unassigned'}</span>
                    </div>
                  </div>
                ))}
                {departments.length === 0 && (
                  <div className="col-span-full text-center py-10 text-ink/45">No department records created.</div>
                )}
              </div>
            )}

            {activeTab === 'class-subjects' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line-border text-xs font-semibold text-ink/55 uppercase tracking-wider">
                      <th className="py-4 px-4">Class Name</th>
                      <th className="py-4 px-4">Subject</th>
                      <th className="py-4 px-4">Assigned Teacher</th>
                      <th className="py-4 px-4">Periods/Wk</th>
                      <th className="py-4 px-4">Compulsory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/60 text-sm text-ink/80">
                    {classSubjects.map(cs => (
                      <tr key={cs.id} className="hover:bg-sage transition-colors">
                        <td className="py-4 px-4 font-bold text-teal-dark">{cs.class_name}</td>
                        <td className="py-4 px-4 font-semibold text-ink">{cs.subject_name} ({cs.subject_code})</td>
                        <td className="py-4 px-4">{cs.teacher_name || cs.staff_name || 'Unassigned'}</td>
                        <td className="py-4 px-4 font-mono">{cs.periods_per_week} hrs</td>
                        <td className="py-4 px-4">
                          {cs.is_compulsory ? (
                            <span className="px-2.5 py-0.5 bg-amber-warning/10 text-amber-warning rounded text-xs">Core/Compulsory</span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-sage text-ink/60 rounded text-xs">Elective</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'promotion' && (
              <div className="space-y-4">
                {promotionRules.map(pr => (
                  <div key={pr.id} className="p-5 bg-surface rounded-xl border border-line-border flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-semibold text-teal-dark">Rule #{pr.id}</span>
                      <h4 className="text-lg font-bold text-ink mt-1">
                        {pr.from_phase} &rarr; {pr.to_phase}
                      </h4>
                      <p className="text-xs text-ink/55 mt-1">
                        Minimum Passes Required: <strong className="text-ink">{pr.min_passes} subjects</strong>
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-sage rounded-lg border border-line-border text-xs text-ink/70">
                      Mandatory Subjects: {pr.mandatory_subject_ids || 'English Language'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6">
            <h2 className="text-xl font-display font-bold text-ink capitalize">Add {activeTab.replace('-', ' ')}</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {activeTab === 'sessions' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">Year (e.g. 2026)</label>
                    <input type="number" required placeholder="2026" className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, year: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">Start Date</label>
                    <input type="date" required className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">End Date</label>
                    <input type="date" required className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, end_date: e.target.value})} />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-ink/70">
                    <input type="checkbox" onChange={e => setFormData({...formData, is_current: e.target.checked})} />
                    Set as Current Active Session
                  </label>
                </>
              )}

              {activeTab === 'terms' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">Term Name</label>
                    <input type="text" required placeholder="Term 1 (2026)" className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">Term Number (1, 2, or 3)</label>
                    <input type="number" required placeholder="1" min="1" max="3" className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, term_number: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">Start Date</label>
                    <input type="date" required className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">End Date</label>
                    <input type="date" required className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, end_date: e.target.value})} />
                  </div>
                </>
              )}

              {activeTab === 'departments' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">Department Name</label>
                    <input type="text" required placeholder="Sciences / Humanities / Commercials" className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/60 mb-1">Code</label>
                    <input type="text" placeholder="SCI / HUM / COM" className="w-full glass-input rounded-lg p-3 text-ink text-sm" onChange={e => setFormData({...formData, code: e.target.value})} />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line-border">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-sage text-ink/70 text-sm font-medium rounded-lg hover:bg-line-border">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-teal-primary text-white text-sm font-medium rounded-lg hover:bg-teal-dark">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
