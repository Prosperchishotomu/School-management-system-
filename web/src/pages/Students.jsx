import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  Search, Filter, Plus, User, X, Eye, Edit2, ArrowRightLeft, ChevronLeft, ChevronRight, FileText
} from 'lucide-react';

const STATUS_COLORS = {
  enrolled:    'bg-sage/35 text-teal-dark',
  suspended:   'bg-amber-warning/15 text-amber-warning',
  withdrawn:   'bg-brick-critical/10 text-brick-critical',
  graduated:   'bg-ink/10 text-ink/60',
  transferred: 'bg-teal-primary/5 text-teal-dark/70',
  dropped_out: 'bg-brick-critical/15 text-brick-critical',
};

const EMPTY_FORM = {
  // Section 1 — Identity
  admission_number: '', first_name: '', middle_name: '', last_name: '',
  date_of_birth: '', gender: 'male',
  // Section 2 — Enrollment
  class_id: '', previous_school: '',
  // Section 3 — Personal
  nationality: '', home_address: '', religion: '',
  // Section 4 — Medical
  medical_notes: '',
  // Section 5 — Guardian
  guardian_name: '', guardian_phone: '', guardian_email: '', guardian_national_id: '', guardian_relation: 'Mother',
};

const Students = () => {
  const { activeSchoolId, user } = useAuth();

  const isAdmin      = user?.role === 'school_admin' || user?.role === 'super_admin';
  const isTeacher    = user?.role === 'teacher';
  const isParent     = user?.role === 'parent';

  const [students,    setStudents]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);

  // Add modal
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [newStudent,    setNewStudent]    = useState(EMPTY_FORM);
  const [addError,      setAddError]      = useState('');
  const [addLoading,    setAddLoading]    = useState(false);
  const [activeSection, setActiveSection] = useState(1);

  // Edit / Transfer modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStudent,   setEditStudent]   = useState(null);
  const [editForm,      setEditForm]      = useState({});
  const [editError,     setEditError]     = useState('');
  const [editLoading,   setEditLoading]   = useState(false);

  const fetchData = useCallback(() => {
    if (!activeSchoolId) return;
    setLoading(true);

    if (isAdmin) {
      api.get(`/schools/${activeSchoolId}/classes`)
        .then(res => { if (res.data) setClasses(res.data); })
        .catch(() => {});
    }

    const q = new URLSearchParams({ page, per_page: 15, search });
    if (isAdmin && classFilter) q.set('class_id', classFilter);
    if (isAdmin && statusFilter) q.set('status', statusFilter);

    api.get(`/schools/${activeSchoolId}/students?${q}`)
      .then(res => {
        setStudents(res.data || []);
        if (res.meta) setTotalPages(Math.ceil((res.meta.total || 1) / (res.meta.per_page || 15)));
        setError('');
      })
      .catch(() => setError('Failed to load student roster.'))
      .finally(() => setLoading(false));
  }, [activeSchoolId, page, classFilter, statusFilter, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Add Student ─────────────────────────────────────────────────────────────
  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAddLoading(true); setAddError('');
    try {
      const res = await api.post(`/schools/${activeSchoolId}/students`, newStudent);
      if (res.data) {
        setShowAddModal(false);
        setNewStudent(EMPTY_FORM);
        setActiveSection(1);
        fetchData();
      }
    } catch (err) {
      setAddError(err.message || 'Failed to register student.');
    } finally { setAddLoading(false); }
  };

  // ── Edit / Transfer ──────────────────────────────────────────────────────────
  const openEdit = (s) => {
    setEditStudent(s);
    setEditForm({
      first_name: s.first_name, last_name: s.last_name, middle_name: s.middle_name || '',
      date_of_birth: s.date_of_birth, gender: s.gender, status: s.status,
      class_id: s.class_id || '', admission_number: s.admission_number,
      nationality: s.nationality || '', home_address: s.home_address || '',
      religion: s.religion || '', previous_school: s.previous_school || '',
      medical_notes: s.medical_notes || '',
    });
    setEditError(''); setShowEditModal(true);
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    setEditLoading(true); setEditError('');
    try {
      await api.patch(`/schools/${activeSchoolId}/students/${editStudent.id}`, editForm);
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      setEditError(err.message || 'Failed to update student.');
    } finally { 
      setEditLoading(false); 
    }
  };

  const handleExport = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost/backend/api/v1';
    const exportUrl = `${apiBase}/schools/${activeSchoolId}/students/export?token=${sessionStorage.getItem('schoolbase_token')}`;
    window.open(exportUrl, '_blank');
  };

  const sections = [
    { id: 1, title: 'Identity' },
    { id: 2, title: 'Enrollment' },
    { id: 3, title: 'Personal' },
    { id: 4, title: 'Medical' },
    { id: 5, title: 'Guardian' },
  ];

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center font-sans animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 text-sm">Select a school tenant from the sidebar switcher to view and manage students.</p>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs bg-paper text-ink';
  const labelCls = 'block text-xs font-semibold text-ink/70 mb-1';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">
            {isTeacher ? 'My Class Students' : isParent ? 'My Child' : 'Students Directory'}
          </h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {isTeacher ? 'Students in your assigned class.' : isParent ? 'Your linked child\'s record.' : 'Manage and view student academic records.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-teal-primary" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => { setShowAddModal(true); setActiveSection(1); }}
              className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /><span>Add Student</span>
            </button>
          </div>
        )}
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans">{error}</div>}

      {/* Filters — admins only */}
      {isAdmin && (
        <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchData(); }} className="flex-1 max-w-md relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-ink/40" />
            <input
              type="text" placeholder="Search by name or admission number..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-ink font-sans text-sm"
            />
          </form>
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-teal-primary" />
            <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1); }}
              className="bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary">
              <option value="">All Statuses</option>
              <option value="enrolled">Enrolled</option>
              <option value="suspended">Suspended</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="dropped_out">Dropped Out</option>
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                <th className="py-4 px-6">Admission No.</th>
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Class</th>
                <th className="py-4 px-6">Gender</th>
                <th className="py-4 px-6">DOB</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
              {loading ? (
                <tr><td colSpan="7" className="py-10 text-center text-ink/40 text-xs">Loading students...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan="7" className="py-10 text-center text-ink/40 text-xs">No students match the criteria.</td></tr>
              ) : students.map(s => (
                <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                  <td className="py-4 px-6 font-mono font-semibold numeric-data text-xs">{s.admission_number}</td>
                  <td className="py-4 px-6 font-bold">{s.first_name} {s.middle_name ? s.middle_name + ' ' : ''}{s.last_name}</td>
                  <td className="py-4 px-6">{s.class_name || 'Unassigned'}</td>
                  <td className="py-4 px-6 capitalize">{s.gender}</td>
                  <td className="py-4 px-6 numeric-data text-xs">{s.date_of_birth}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[s.status] || 'bg-ink/10 text-ink/60'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a href={`/students/${s.id}`}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                        <Eye className="w-3.5 h-3.5" /><span>View</span>
                      </a>
                      {isAdmin && (
                        <button onClick={() => openEdit(s)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-warning/10 hover:bg-amber-warning/20 text-amber-warning text-xs font-semibold rounded-lg transition-colors cursor-pointer">
                          <Edit2 className="w-3.5 h-3.5" /><span>Edit</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t border-line-border/30 flex justify-between items-center bg-paper/30">
            <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" />Previous
            </button>
            <span className="text-xs font-mono text-ink/50">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 border border-line-border rounded-xl text-xs font-semibold text-ink/70 disabled:opacity-40 cursor-pointer">
              Next<ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── ADD STUDENT MODAL ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <h3 className="text-xl font-display font-bold text-ink">Register New Student</h3>
              <button onClick={() => setShowAddModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {/* Section tabs */}
            <div className="flex border-b border-line-border/30 px-6">
              {sections.map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`px-4 py-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${activeSection === s.id ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/50 hover:text-ink'}`}>
                  {s.id}. {s.title}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddStudent} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {addError && <div className="p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{addError}</div>}

                {/* Section 1 — Identity */}
                {activeSection === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">Core identity information about the student.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelCls}>Admission Number *</label><input required type="text" className={inputCls} value={newStudent.admission_number} onChange={e => setNewStudent({...newStudent, admission_number: e.target.value})} /></div>
                      <div><label className={labelCls}>Gender *</label>
                        <select required className={inputCls} value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value})}>
                          <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><label className={labelCls}>First Name *</label><input required type="text" className={inputCls} value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} /></div>
                      <div><label className={labelCls}>Middle Name</label><input type="text" className={inputCls} value={newStudent.middle_name} onChange={e => setNewStudent({...newStudent, middle_name: e.target.value})} /></div>
                      <div><label className={labelCls}>Last Name *</label><input required type="text" className={inputCls} value={newStudent.last_name} onChange={e => setNewStudent({...newStudent, last_name: e.target.value})} /></div>
                    </div>
                    <div><label className={labelCls}>Date of Birth *</label><input required type="date" className={inputCls} value={newStudent.date_of_birth} onChange={e => setNewStudent({...newStudent, date_of_birth: e.target.value})} /></div>
                  </div>
                )}

                {/* Section 2 — Enrollment */}
                {activeSection === 2 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">School enrollment and class placement.</p>
                    <div><label className={labelCls}>Class Assignment</label>
                      <select className={inputCls} value={newStudent.class_id} onChange={e => setNewStudent({...newStudent, class_id: e.target.value})}>
                        <option value="">Select Class...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div><label className={labelCls}>Previous School</label><input type="text" className={inputCls} placeholder="Name of previous school attended" value={newStudent.previous_school} onChange={e => setNewStudent({...newStudent, previous_school: e.target.value})} /></div>
                  </div>
                )}

                {/* Section 3 — Personal */}
                {activeSection === 3 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">Personal background and contact details.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelCls}>Nationality</label><input type="text" className={inputCls} placeholder="e.g. Zimbabwean" value={newStudent.nationality} onChange={e => setNewStudent({...newStudent, nationality: e.target.value})} /></div>
                      <div><label className={labelCls}>Religion</label><input type="text" className={inputCls} placeholder="e.g. Christian" value={newStudent.religion} onChange={e => setNewStudent({...newStudent, religion: e.target.value})} /></div>
                    </div>
                    <div><label className={labelCls}>Home Address</label><textarea rows={3} className={inputCls} placeholder="Full residential address" value={newStudent.home_address} onChange={e => setNewStudent({...newStudent, home_address: e.target.value})} /></div>
                  </div>
                )}

                {/* Section 4 — Medical */}
                {activeSection === 4 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">Confidential medical notes (accessible to admin and teachers only).</p>
                    <div><label className={labelCls}>Medical Notes</label><textarea rows={5} className={inputCls} placeholder="Allergies, conditions, medications, emergency care instructions..." value={newStudent.medical_notes} onChange={e => setNewStudent({...newStudent, medical_notes: e.target.value})} /></div>
                  </div>
                )}

                {/* Section 5 — Guardian */}
                {activeSection === 5 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">Guardian information to link this student. Linking is performed automatically by National ID or phone check.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelCls}>Guardian Name *</label><input required={activeSection === 5} type="text" className={inputCls} placeholder="e.g. Mary Mandizera" value={newStudent.guardian_name} onChange={e => setNewStudent({...newStudent, guardian_name: e.target.value})} /></div>
                      <div><label className={labelCls}>Guardian Relation *</label>
                        <select className={inputCls} value={newStudent.guardian_relation} onChange={e => setNewStudent({...newStudent, guardian_relation: e.target.value})}>
                          <option value="Mother">Mother</option>
                          <option value="Father">Father</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Sponsor">Sponsor</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><label className={labelCls}>National ID Number</label><input type="text" className={inputCls} placeholder="e.g. 63-123456K78" value={newStudent.guardian_national_id} onChange={e => setNewStudent({...newStudent, guardian_national_id: e.target.value})} /></div>
                      <div><label className={labelCls}>Phone Number</label><input type="text" className={inputCls} placeholder="e.g. +263771234567" value={newStudent.guardian_phone} onChange={e => setNewStudent({...newStudent, guardian_phone: e.target.value})} /></div>
                      <div><label className={labelCls}>Email Address</label><input type="email" className={inputCls} placeholder="e.g. mary@gmail.com" value={newStudent.guardian_email} onChange={e => setNewStudent({...newStudent, guardian_email: e.target.value})} /></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-line-border/30 flex justify-between items-center">
                <div className="flex gap-2">
                  {activeSection > 1 && <button type="button" onClick={() => setActiveSection(s => s - 1)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/70 hover:bg-sage/10 cursor-pointer">← Back</button>}
                  {activeSection < 5 && <button type="button" onClick={() => setActiveSection(s => s + 1)} className="px-4 py-2 bg-ink/5 hover:bg-ink/10 rounded-xl text-xs font-semibold cursor-pointer">Next →</button>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={addLoading} className="px-5 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer">
                    {addLoading ? 'Saving...' : 'Register Student'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT / TRANSFER MODAL ─────────────────────────────────────────────── */}
      {showEditModal && editStudent && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <div>
                <h3 className="text-xl font-display font-bold text-ink">Edit Student Record</h3>
                <p className="text-xs text-ink/50 font-mono mt-0.5">{editStudent.first_name} {editStudent.last_name} · {editStudent.admission_number}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditStudent} className="flex-1 overflow-y-auto p-6 space-y-5">
              {editError && <div className="p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{editError}</div>}

              {/* Transfer section highlighted */}
              <div className="p-4 rounded-xl bg-teal-primary/5 border border-teal-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="w-4 h-4 text-teal-primary" />
                  <span className="text-xs font-bold text-teal-primary uppercase tracking-wider">Class Transfer</span>
                </div>
                <select className={inputCls} value={editForm.class_id} onChange={e => setEditForm({...editForm, class_id: e.target.value})}>
                  <option value="">Unassigned</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Status</label>
                  <select className={inputCls} value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                    <option value="enrolled">Enrolled</option>
                    <option value="suspended">Suspended</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="graduated">Graduated</option>
                    <option value="transferred">Transferred</option>
                    <option value="dropped_out">Dropped Out</option>
                  </select>
                </div>
                <div><label className={labelCls}>Admission Number</label><input type="text" className={inputCls} value={editForm.admission_number} onChange={e => setEditForm({...editForm, admission_number: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>First Name</label><input type="text" className={inputCls} value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} /></div>
                <div><label className={labelCls}>Middle Name</label><input type="text" className={inputCls} value={editForm.middle_name} onChange={e => setEditForm({...editForm, middle_name: e.target.value})} /></div>
                <div><label className={labelCls}>Last Name</label><input type="text" className={inputCls} value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Date of Birth</label><input type="date" className={inputCls} value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} /></div>
                <div><label className={labelCls}>Gender</label>
                  <select className={inputCls} value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})}>
                    <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Nationality</label><input type="text" className={inputCls} value={editForm.nationality} onChange={e => setEditForm({...editForm, nationality: e.target.value})} /></div>
                <div><label className={labelCls}>Religion</label><input type="text" className={inputCls} value={editForm.religion} onChange={e => setEditForm({...editForm, religion: e.target.value})} /></div>
              </div>
              <div><label className={labelCls}>Home Address</label><textarea rows={2} className={inputCls} value={editForm.home_address} onChange={e => setEditForm({...editForm, home_address: e.target.value})} /></div>
              <div><label className={labelCls}>Previous School</label><input type="text" className={inputCls} value={editForm.previous_school} onChange={e => setEditForm({...editForm, previous_school: e.target.value})} /></div>
              <div><label className={labelCls}>Medical Notes</label><textarea rows={3} className={inputCls} placeholder="Confidential..." value={editForm.medical_notes} onChange={e => setEditForm({...editForm, medical_notes: e.target.value})} /></div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" disabled={editLoading} className="px-5 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer">
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;