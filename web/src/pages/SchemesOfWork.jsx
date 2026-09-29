import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { FileText, CheckCircle, Clock, XCircle, Plus, Send, Eye, BookOpen, UserCheck } from 'lucide-react';

export default function SchemesOfWork() {
  const { user, activeSchoolId } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('schemes');
  const [schemes, setSchemes] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedScheme, setSelectedScheme] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeSchoolId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'schemes') {
        const res = await api.get(`/schools/${activeSchoolId}/schemes`);
        setSchemes(res.data || []);
      } else {
        const res = await api.get(`/schools/${activeSchoolId}/lesson-plans`);
        setLessonPlans(res.data || []);
      }
    } catch (err) {
      addToast('Error loading schemes of work.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScheme = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'schemes') {
        await api.post(`/schools/${activeSchoolId}/schemes`, formData);
        addToast('Scheme of work created successfully.', 'success');
      } else {
        await api.post(`/schools/${activeSchoolId}/lesson-plans`, formData);
        addToast('Lesson plan created successfully.', 'success');
      }
      setShowModal(false);
      setFormData({});
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error?.message || 'Creation failed.', 'error');
    }
  };

  const handleSubmitToHod = async (id) => {
    try {
      await api.post(`/schemes/${id}/submit`);
      addToast('Submitted to HOD for approval.', 'success');
      fetchData();
    } catch (err) {
      addToast('Failed to submit scheme.', 'error');
    }
  };

  const handleHodReview = async (id, status) => {
    try {
      await api.post(`/schemes/${id}/review`, { status, comments: 'Reviewed by HOD' });
      addToast(`Scheme of work ${status}.`, 'success');
      fetchData();
    } catch (err) {
      addToast('Review update failed.', 'error');
    }
  };

  return (
    <div className="module-page schemes-page p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900 p-6 rounded-3xl border border-indigo-500/20 backdrop-blur-md shadow-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-400" />
            Schemes of Work & Lesson Plans
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            MoPSE Curriculum Schemes, Teaching Objectives, SOM & HOD Approval Workflows
          </p>
        </div>
        <button
          onClick={() => { setFormData({}); setShowModal(true); }}
          className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create {activeTab === 'schemes' ? 'Scheme of Work' : 'Lesson Plan'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('schemes')}
          className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 ${
            activeTab === 'schemes' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" /> Schemes of Work
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 ${
            activeTab === 'plans' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Lesson Plans
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 backdrop-blur-xl shadow-xl">
        {activeTab === 'schemes' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-4 px-4">Wk</th>
                  <th className="py-4 px-4">Class & Subject</th>
                  <th className="py-4 px-4">Topic & Sub-topic</th>
                  <th className="py-4 px-4">Teacher</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
                {schemes.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="py-4 px-4 font-mono font-bold text-indigo-400">W{s.week_number}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-white">{s.class_name}</div>
                      <div className="text-xs text-slate-400">{s.subject_name}</div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <div className="font-semibold text-slate-100 truncate">{s.topic}</div>
                      <div className="text-xs text-slate-400 truncate">{s.sub_topic || 'General'}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-300">{s.teacher_name}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                        s.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        s.status === 'submitted' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {s.status === 'approved' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {s.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {s.status === 'draft' && (
                          <button onClick={() => handleSubmitToHod(s.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center gap-1">
                            <Send className="w-3 h-3" /> Submit HOD
                          </button>
                        )}
                        {['hod', 'deputy_head', 'head', 'school_admin', 'super_admin'].includes(user?.role) && s.status === 'submitted' && (
                          <>
                            <button onClick={() => handleHodReview(s.id, 'approved')} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs">
                              Approve
                            </button>
                            <button onClick={() => handleHodReview(s.id, 'rejected')} className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs">
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {schemes.length === 0 && (
                  <tr><td colSpan="6" className="text-center py-10 text-slate-500">No schemes of work submitted yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-4 px-4">Date</th>
                  <th className="py-4 px-4">Class & Subject</th>
                  <th className="py-4 px-4">Topic</th>
                  <th className="py-4 px-4">Duration</th>
                  <th className="py-4 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
                {lessonPlans.map(lp => (
                  <tr key={lp.id} className="hover:bg-slate-800/40">
                    <td className="py-4 px-4 font-mono text-xs">{lp.lesson_date?.slice(0, 10)}</td>
                    <td className="py-4 px-4 font-bold">{lp.class_name} ({lp.subject_name})</td>
                    <td className="py-4 px-4">{lp.topic}</td>
                    <td className="py-4 px-4 font-mono text-xs">{lp.duration_minutes} mins</td>
                    <td className="py-4 px-4 text-xs font-semibold text-indigo-400">{lp.status}</td>
                  </tr>
                ))}
                {lessonPlans.length === 0 && (
                  <tr><td colSpan="5" className="text-center py-10 text-slate-500">No lesson plans found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h2 className="text-xl font-bold text-white">Create {activeTab === 'schemes' ? 'Scheme of Work' : 'Lesson Plan'}</h2>
            <form onSubmit={handleCreateScheme} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Week Number</label>
                <input type="number" required placeholder="1" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setFormData({...formData, week_number: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Topic</label>
                <input type="text" required placeholder="e.g. Quadratic Equations" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setFormData({...formData, topic: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Objectives & Competencies</label>
                <textarea rows="3" placeholder="Learning outcomes..." className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setFormData({...formData, objectives: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl">Save Scheme</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
