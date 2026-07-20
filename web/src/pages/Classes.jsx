import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Grid, BookOpen, User, Plus, Trash2, CheckCircle2,
  AlertTriangle, Loader2, Sparkles
} from 'lucide-react';

const Classes = () => {
  const { activeSchoolId } = useAuth();
  const [schoolInfo, setSchoolInfo] = useState(null);
  
  // Tabs: 'classes' or 'assignments'
  const [activeTab, setActiveTab] = useState('classes');
  
  // Core states
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  // Loadings & messages
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Create Class Form
  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: 'Grade 1'
  });

  useEffect(() => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}`)
      .then(res => {
        if (res.data) {
          setSchoolInfo(res.data);
          const defaultLvl = res.data.school_type === 'secondary' ? 'Form 1' : 'ECD A';
          setClassForm(prev => ({ ...prev, grade_level: defaultLvl }));
        }
      })
      .catch(err => console.error('Error fetching school details:', err));
  }, [activeSchoolId]);

  const getGradeLevels = () => {
    if (!schoolInfo) return ['Grade 1'];
    if (schoolInfo.school_type === 'secondary') {
      return ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'];
    } else {
      return ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];
    }
  };
  
  // Create Assignment Form
  const [assignForm, setAssignForm] = useState({
    class_id: '',
    subject_id: '',
    teacher_id: ''
  });

  const fetchData = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const [classesRes, staffRes, subjectsRes, assignmentsRes] = await Promise.all([
        api.get(`/schools/${activeSchoolId}/classes`),
        api.get(`/schools/${activeSchoolId}/staff`),
        api.get(`/schools/${activeSchoolId}/subjects`),
        api.get(`/schools/${activeSchoolId}/teaching-assignments`)
      ]);
      
      setClasses(classesRes.data || []);
      setStaff(staffRes.data || []);
      setSubjects(subjectsRes.data || []);
      setAssignments(assignmentsRes.data || []);
      
      if (classesRes.data?.length > 0) {
        setAssignForm(prev => ({ ...prev, class_id: classesRes.data[0].id }));
      }
      if (subjectsRes.data?.length > 0) {
        setAssignForm(prev => ({ ...prev, subject_id: subjectsRes.data[0].id }));
      }
      if (staffRes.data?.length > 0) {
        setAssignForm(prev => ({ ...prev, teacher_id: staffRes.data[0].user_id }));
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load classrooms configuration data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSchoolId]);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!classForm.name.trim()) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post(`/schools/${activeSchoolId}/classes`, classForm);
      if (res.data) {
        setMessage({ type: 'success', text: `Classroom "${classForm.name}" created successfully.` });
        setClassForm({ name: '', grade_level: 'Grade 1' });
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create class.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm('Are you sure you want to delete this class? This will dissociate timetable slots and pupils.')) return;
    setMessage({ type: '', text: '' });
    try {
      await api.delete(`/schools/${activeSchoolId}/classes/${classId}`);
      setMessage({ type: 'success', text: 'Classroom deleted successfully.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete class.' });
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.class_id || !assignForm.subject_id || !assignForm.teacher_id) {
      setMessage({ type: 'error', text: 'Please fill in all assignment parameters.' });
      return;
    }
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post(`/schools/${activeSchoolId}/teaching-assignments`, assignForm);
      if (res.data) {
        setMessage({ type: 'success', text: 'Teaching assignment created successfully.' });
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign teacher.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm('Delete this teaching assignment?')) return;
    setMessage({ type: '', text: '' });
    try {
      await api.delete(`/schools/${activeSchoolId}/teaching-assignments/${id}`);
      setMessage({ type: 'success', text: 'Teaching assignment removed.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove assignment.' });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Classrooms & Subject Assignments</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Configure class structures and map teacher duties.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-line-border/20">
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex items-center space-x-2 px-5 py-3 border-b-2 font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'classes' ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/50 hover:text-ink'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Class Roster Structures</span>
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center space-x-2 px-5 py-3 border-b-2 font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'assignments' ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/50 hover:text-ink'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Teacher-Subject Mapping</span>
        </button>
      </div>

      {/* Messaging alerts */}
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
        <>
          {activeTab === 'classes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Creator Form */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 h-fit space-y-4">
                <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-teal-primary" />
                  <span>Setup New Classroom</span>
                </h3>
                
                <form onSubmit={handleCreateClass} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Classroom Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Grade 1 Red"
                      className="w-full glass-input rounded-xl text-xs"
                      value={classForm.name}
                      onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Grade Level</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={classForm.grade_level}
                      onChange={e => setClassForm({ ...classForm, grade_level: e.target.value })}
                    >
                      {getGradeLevels().map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Construct Classroom</span>
                  </button>
                </form>
              </div>

              {/* Roster Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map(c => {
                  return (
                    <div key={c.id} className="glass-panel p-5 rounded-2xl border border-line-border/30 hover:shadow-lg transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-sans font-bold text-base text-ink">{c.name}</h4>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-primary/10 text-teal-primary uppercase">
                            {c.grade_level}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink/50 mt-1 font-mono">ID: {c.id}</p>
                      </div>

                      <div className="mt-6 flex justify-between items-center border-t border-line-border/20 pt-3">
                        <span className="text-[10px] text-ink/65 font-sans font-bold">Harare Primary School</span>
                        <button
                          onClick={() => handleDeleteClass(c.id)}
                          className="p-1.5 text-brick-critical hover:bg-brick-critical/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Classroom"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {classes.length === 0 && (
                  <div className="col-span-2 text-center py-20 text-ink/40 text-sm">
                    No classes set up yet. Build your first classroom above!
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Assignment Form */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 h-fit space-y-4">
                <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                  <User className="w-4 h-4 text-teal-primary" />
                  <span>Assign Teacher Duty</span>
                </h3>
                
                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Target Class</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={assignForm.class_id}
                      onChange={e => setAssignForm({ ...assignForm, class_id: e.target.value })}
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Subject</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={assignForm.subject_id}
                      onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code}){s.category && s.category !== 'general' ? ` [${s.category.toUpperCase()}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Teacher</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={assignForm.teacher_id}
                      onChange={e => setAssignForm({ ...assignForm, teacher_id: e.target.value })}
                    >
                      {staff.filter(st => st.role_title === 'Teacher' || st.role_title === 'Class Teacher').map(st => (
                        <option key={st.id} value={st.user_id}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Assign Duty</span>
                  </button>
                </form>
              </div>

              {/* Assignments Table */}
              <div className="lg:col-span-2 glass-panel rounded-2xl border border-line-border/30 overflow-hidden h-fit">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border/30 text-ink/60 font-bold uppercase tracking-wider">
                        <th className="py-3 px-5">Class</th>
                        <th className="py-3 px-5">Subject</th>
                        <th className="py-3 px-5">Assigned Teacher</th>
                        <th className="py-3 px-5 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/20">
                      {assignments.map(a => (
                        <tr key={a.id} className="hover:bg-sage/5 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-ink">{a.class_name || a.class_id}</td>
                          <td className="py-3.5 px-5 font-semibold text-teal-dark">{a.subject_name || a.subject_id}</td>
                          <td className="py-3.5 px-5 text-ink/75 font-medium">{a.teacher_name || a.teacher_id}</td>
                          <td className="py-3.5 px-5 text-right pr-6">
                            <button
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="p-1 text-brick-critical hover:bg-brick-critical/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {assignments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-ink/40">
                            No subject assignments registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Classes;
