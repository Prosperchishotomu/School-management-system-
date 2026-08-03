import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Grid, BookOpen, User, Plus, Trash2, CheckCircle2,
  AlertTriangle, Loader2, Sparkles, BookMarked, UserCheck,
  Eye, Edit2, Ban
} from 'lucide-react';


const Classes = () => {
  const { activeSchoolId } = useAuth();
  const [schoolInfo, setSchoolInfo] = useState(null);
  
  // Tabs: 'classes' | 'subjects' | 'assignments'
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
    grade_level: 'Grade 1',
    stream: '',
    form_master_id: ''
  });

  // Create Subject Form
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    level: 'all'
  });

  // Create Assignment Form
  const [assignForm, setAssignForm] = useState({
    class_id: '',
    subject_id: '',
    teacher_id: ''
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
      const hasALevel = schoolInfo.has_alevel === undefined || schoolInfo.has_alevel === 1 || schoolInfo.has_alevel === true || schoolInfo.has_alevel === '1';
      return hasALevel
        ? ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6']
        : ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
    } else {
      return ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];
    }
  };

  const fetchData = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const [classesRes, staffRes, subjectsRes, assignmentsRes] = await Promise.all([
        api.get(`/schools/${activeSchoolId}/classes`).catch(() => ({ data: [] })),
        api.get(`/schools/${activeSchoolId}/staff`).catch(() => ({ data: [] })),
        api.get(`/schools/${activeSchoolId}/subjects`).catch(() => ({ data: [] })),
        api.get(`/schools/${activeSchoolId}/teaching-assignments`).catch(() => ({ data: [] }))
      ]);

      const cls = classesRes.data || [];
      const stf = staffRes.data || [];
      const sub = subjectsRes.data || [];
      const ass = assignmentsRes.data || [];

      setClasses(cls);
      setStaff(stf);
      setSubjects(sub);
      setAssignments(ass);

      if (cls.length > 0 && !assignForm.class_id) {
        setAssignForm(prev => ({ ...prev, class_id: cls[0].id }));
      }
      if (sub.length > 0 && !assignForm.subject_id) {
        setAssignForm(prev => ({ ...prev, subject_id: sub[0].id }));
      }
      if (stf.length > 0 && !assignForm.teacher_id) {
        setAssignForm(prev => ({ ...prev, teacher_id: stf[0].user_id || stf[0].id }));
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load class configuration.' });
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
      await api.post(`/schools/${activeSchoolId}/classes`, classForm);
      setMessage({ type: 'success', text: `Classroom "${classForm.name}" created successfully!` });
      setClassForm({ name: '', grade_level: getGradeLevels()[0], stream: '', form_master_id: '' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to create classroom.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm('Are you sure you want to delete this classroom? All student links will be unassigned.')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/classes/${classId}`);
      setMessage({ type: 'success', text: 'Classroom deleted successfully.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete classroom.' });
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post(`/schools/${activeSchoolId}/subjects`, subjectForm);
      setMessage({ type: 'success', text: `Subject "${subjectForm.name}" added successfully!` });
      setSubjectForm({ name: '', code: '', level: 'all' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to add subject.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/subjects/${subjectId}`);
      setMessage({ type: 'success', text: 'Subject deleted successfully.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete subject.' });
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.class_id || !assignForm.subject_id || !assignForm.teacher_id) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post(`/schools/${activeSchoolId}/teaching-assignments`, assignForm);
      setMessage({ type: 'success', text: 'Teacher subject duty assigned successfully.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to assign teacher duty.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await api.delete(`/schools/${activeSchoolId}/teaching-assignments/${assignmentId}`);
      setMessage({ type: 'success', text: 'Teacher duty unassigned.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove assignment.' });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Classroom & Curriculum Management</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Setup classes, subject offerings, form masters, and teacher subject duties.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-sage/10 p-1 rounded-xl border border-line-border/30">
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'classes' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:text-ink'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Classrooms ({classes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'subjects' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:text-ink'
            }`}
          >
            <BookMarked className="w-4 h-4" />
            <span>Subjects Roster ({subjects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'assignments' ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:text-ink'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Teaching Assignments ({assignments.length})</span>
          </button>
        </div>
      </div>

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
          {/* TAB 1: CLASSES */}
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
                      placeholder="e.g. Grade 1 Red or Form 1 A"
                      className="w-full glass-input rounded-xl text-xs"
                      value={classForm.name}
                      onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Stream / Color</label>
                      <input
                        type="text"
                        placeholder="e.g. Blue"
                        className="w-full glass-input rounded-xl text-xs"
                        value={classForm.stream}
                        onChange={e => setClassForm({ ...classForm, stream: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Form Master / Mistress</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={classForm.form_master_id}
                      onChange={e => setClassForm({ ...classForm, form_master_id: e.target.value })}
                    >
                      <option value="">No Designated Form Master</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role_title || 'Staff'})</option>
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

              {/* Classroom Cards Roster */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map(c => (
                  <div key={c.id} className="glass-panel p-5 rounded-2xl border border-line-border/30 hover:shadow-lg transition-all flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-sans font-bold text-base text-ink">{c.name}</h4>
                          <p className="text-[10px] text-ink/50 font-mono mt-0.5">ID: {c.id}</p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-primary/10 text-teal-primary uppercase">
                          {c.grade_level}
                        </span>
                      </div>
                      
                      <div className="mt-3 space-y-1 text-xs font-sans">
                        <div className="flex items-center space-x-2 text-ink/75">
                          <User className="w-3.5 h-3.5 text-teal-primary" />
                          <span>Class Teacher: <strong className="text-ink font-semibold">{c.teacher_name || 'Unassigned'}</strong></span>
                        </div>
                        <div className="flex items-center space-x-2 text-ink/75">
                          <UserCheck className="w-3.5 h-3.5 text-amber-warning" />
                          <span>Form Master: <strong className="text-ink font-semibold">{c.form_master_name || 'Unassigned'}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-line-border/20 pt-3">
                      <button
                        onClick={() => alert(`Class Details:\nName: ${c.name}\nGrade: ${c.grade_level}\nForm Master: ${c.form_master_name || 'Unassigned'}`)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#e8f4f3] hover:bg-teal-primary/20 text-[#1b5e58] text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-teal-primary/20"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => {
                          const newName = prompt('Edit class name:', c.name);
                          if (newName && newName.trim()) {
                            api.put(`/schools/${activeSchoolId}/classes/${c.id}`, { name: newName.trim() })
                              .then(() => fetchData())
                              .catch(err => alert(err.message));
                          }
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#fdf6e7] hover:bg-amber-warning/25 text-[#925f0e] text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-amber-warning/30"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => alert('Classroom is active.')}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#fdf0e6] text-[#a84b00] hover:bg-orange-500/25 text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-orange-500/30"
                      >
                        <Ban className="w-3 h-3" />
                        <span>Suspend</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClass(c.id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#fbeae8] hover:bg-brick-critical/20 text-[#9b2c2c] text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-brick-critical/30"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>

                  </div>
                ))}
                {classes.length === 0 && (
                  <div className="col-span-2 text-center py-20 text-ink/40 text-sm">
                    No classes set up yet. Build your first classroom above!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SUBJECTS ROSTER */}
          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Subject Creation Form */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 h-fit space-y-4">
                <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                  <BookMarked className="w-4 h-4 text-teal-primary" />
                  <span>Register New Subject</span>
                </h3>

                <form onSubmit={handleCreateSubject} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Subject Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mathematics, Shona, Chemistry"
                      className="w-full glass-input rounded-xl text-xs"
                      value={subjectForm.name}
                      onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Subject Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MATH101"
                        className="w-full glass-input rounded-xl text-xs uppercase"
                        value={subjectForm.code}
                        onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Academic Level</label>
                      <select
                        className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                        value={subjectForm.level}
                        onChange={e => setSubjectForm({ ...subjectForm, level: e.target.value })}
                      >
                        <option value="all">All Levels</option>
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary (O-Level)</option>
                        <option value="alevel">Advanced (A-Level)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Register Subject</span>
                  </button>
                </form>
              </div>

              {/* Subjects Table */}
              <div className="lg:col-span-2 glass-panel rounded-2xl border border-line-border/30 overflow-hidden h-fit">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border/30 text-ink/60 font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-5">Code</th>
                        <th className="py-3.5 px-5">Subject Name</th>
                        <th className="py-3.5 px-5">Level Scope</th>
                        <th className="py-3.5 px-5 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/20">
                      {subjects.map(s => (
                        <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                          <td className="py-3.5 px-5 font-mono font-bold text-teal-primary">{s.code}</td>
                          <td className="py-3.5 px-5 font-bold text-ink">{s.name}</td>
                          <td className="py-3.5 px-5 capitalize text-ink/70">{s.level || 'All Levels'}</td>
                          <td className="py-3.5 px-5 text-right pr-6">
                            <button
                              onClick={() => handleDeleteSubject(s.id)}
                              className="p-1 text-brick-critical hover:bg-brick-critical/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Subject"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {subjects.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-ink/40">
                            No subjects configured yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEACHING ASSIGNMENTS */}
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
                          {s.name} ({s.code})
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
                      {staff.map(st => (
                        <option key={st.id} value={st.user_id || st.id}>{st.name} ({st.role_title || 'Staff'})</option>
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
                        <th className="py-3.5 px-5">Class</th>
                        <th className="py-3.5 px-5">Subject</th>
                        <th className="py-3.5 px-5">Assigned Teacher</th>
                        <th className="py-3.5 px-5 text-right pr-6">Action</th>
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
