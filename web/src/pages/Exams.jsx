import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Calendar, Plus, X, Loader2, Clock, MapPin, User } from 'lucide-react';

const Exams = () => {
  const { activeSchoolId, user } = useAuth();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('2026-T1');
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    class_id: '',
    subject: '',
    exam_date: '',
    start_time: '',
    duration_minutes: '120',
    room: '',
    invigilator: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAll = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    Promise.all([
      api.get(`/schools/${activeSchoolId}/exams?term=${term}`),
      api.get(`/schools/${activeSchoolId}/classes`)
    ])
      .then(([exRes, clRes]) => {
        setExams(exRes.data || []);
        const classList = clRes.data || [];
        setClasses(classList);
        if (classList.length > 0 && !form.class_id) {
          setForm(prev => ({ ...prev, class_id: String(classList[0].id) }));
        }
        setError('');
      })
      .catch(err => {
        console.error(err);
        setError('Could not load exams scheduling data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, [activeSchoolId, term]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post(`/schools/${activeSchoolId}/exams`, {
        ...form,
        class_id: form.class_id,
        duration_minutes: Number(form.duration_minutes),
        term
      });
      setShowModal(false);
      setForm(prev => ({
        ...prev,
        subject: '',
        exam_date: '',
        start_time: '',
        room: '',
        invigilator: ''
      }));
      fetchAll();
    } catch (err) {
      setFormError(err.message || 'Failed to schedule exam.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Exam Scheduling</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Plan assessments, assign invigilators, and schedule rooms for final exams.</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="bg-paper border border-line-border text-ink text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-sans font-bold"
          >
            <option value="2026-T1">Term 1 2026</option>
            <option value="2026-T2">Term 2 2026</option>
            <option value="2026-T3">Term 3 2026</option>
          </select>
          {(user?.role === 'school_admin' || user?.role === 'teacher') && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /><span>Schedule Exam</span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans">{error}</div>}

      {/* Grid or Table list */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                <th className="py-4 px-6">Date &amp; Time</th>
                <th className="py-4 px-6">Subject</th>
                <th className="py-4 px-6">Class</th>
                <th className="py-4 px-6"><div className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5" /><span>Room</span></div></th>
                <th className="py-4 px-6"><div className="flex items-center space-x-1"><User className="w-3.5 h-3.5" /><span>Invigilator</span></div></th>
                <th className="py-4 px-6 text-center">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-xs text-ink/40">
                    Loading exams calendar...
                  </td>
                </tr>
              ) : exams.length > 0 ? (
                exams.map((ex, idx) => (
                  <tr key={idx} className="hover:bg-sage/5 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold">{ex.exam_date}</div>
                      <div className="text-xs text-ink/50 flex items-center space-x-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span className="numeric-data">{ex.start_time}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-teal-dark">{ex.subject}</td>
                    <td className="py-4 px-6 font-semibold">{ex.class_name || `Class #${ex.class_id}`}</td>
                    <td className="py-4 px-6">{ex.room || '—'}</td>
                    <td className="py-4 px-6 font-medium">{ex.invigilator || '—'}</td>
                    <td className="py-4 px-6 text-center font-mono numeric-data text-xs">{ex.duration_minutes} mins</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-ink/50 text-xs">
                    No exams scheduled for {term}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Schedule Exam Session</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Class *</label>
                  <select
                    required
                    value={form.class_id}
                    onChange={e => setForm({ ...form, class_id: e.target.value })}
                    className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Subject Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Shona, English"
                    className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary"
                    value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Date *</label>
                  <input
                    required
                    type="date"
                    className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary"
                    value={form.exam_date}
                    onChange={e => setForm({ ...form, exam_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Start Time *</label>
                  <input
                    required
                    type="time"
                    className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary font-mono numeric-data"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary font-mono numeric-data"
                    value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Room / Venue</label>
                  <input
                    type="text"
                    placeholder="e.g. Hall A, Room 4"
                    className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary"
                    value={form.room}
                    onChange={e => setForm({ ...form, room: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Invigilator</label>
                <input
                  type="text"
                  placeholder="e.g. Mrs. Mutasa"
                  className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary"
                  value={form.invigilator}
                  onChange={e => setForm({ ...form, invigilator: e.target.value })}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer flex items-center space-x-2"
                >
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;