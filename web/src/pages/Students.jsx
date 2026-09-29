import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import {
  Search, Filter, Plus, User, X, Eye, Edit2, ChevronLeft, ChevronRight, FileText,
  Crown, Trash2, Users, Award, Printer, Ban, CheckCircle2, ArrowUpRight,
  ArrowRightLeft, Key, Lock, BarChart3
} from 'lucide-react';
import PrintReportModal from '../components/PrintReportModal';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const STATUS_COLORS = {
  enrolled:    'bg-sage/35 text-teal-dark',
  suspended:   'bg-amber-warning/15 text-amber-warning',
  withdrawn:   'bg-brick-critical/10 text-brick-critical',
  graduated:   'bg-ink/10 text-ink/60',
  transferred: 'bg-teal-primary/5 text-teal-dark/70',
  dropped_out: 'bg-brick-critical/15 text-brick-critical',
};

const CHART_COLORS = ['#356AE6', '#8A63D2', '#C77B18', '#C73A4A', '#1B4D6B', '#4FA8A0', '#65748B'];
const GENDER_COLORS = { male: '#356AE6', female: '#C77B18', other: '#8A63D2' };

const EMPTY_FORM = {
  admission_number: '', first_name: '', middle_name: '', last_name: '',
  date_of_birth: '', gender: 'male',
  class_id: '', previous_school: '', leadership_position: 'none',
  nationality: '', home_address: '', religion: '',
  medical_notes: '',
  guardian_name: '', guardian_phone: '', guardian_email: '', guardian_national_id: '', guardian_relation: 'Mother',
  parent_username: '', parent_password: '',
};

const Students = () => {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const isAdmin   = user?.role === 'school_admin' || user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const isParent  = user?.role === 'parent';

  const [activeTab,     setActiveTab]    = useState('students');
  const [students,      setStudents]     = useState([]);
  const [parents,       setParents]      = useState([]);
  const [classes,       setClasses]      = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState('');
  const [search,        setSearch]       = useState('');
  const [classFilter,   setClassFilter]  = useState('');
  const [statusFilter,  setStatusFilter] = useState('');
  const [page,          setPage]         = useState(1);
  const [totalPages,    setTotalPages]   = useState(1);

  // Selection
  const [selectedIds,       setSelectedIds]      = useState([]);
  const [showReportModal,   setShowReportModal]  = useState(false);

  // Credentials display after registration
  const [createdCreds, setCreatedCreds] = useState(null);

  // Add modal
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [newStudent,    setNewStudent]    = useState(EMPTY_FORM);
  const [addError,      setAddError]      = useState('');
  const [addLoading,    setAddLoading]    = useState(false);
  const [activeSection, setActiveSection] = useState(1);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStudent,   setEditStudent]   = useState(null);
  const [editForm,      setEditForm]      = useState({});
  const [editError,     setEditError]     = useState('');
  const [editLoading,   setEditLoading]   = useState(false);

  // Parent Edit Modal
  const [showParentModal, setShowParentModal] = useState(false);
  const [editingParent,   setEditingParent]   = useState(null);
  const [parentForm,      setParentForm]      = useState({ name: '', phone: '', email: '', relation: '', national_id: '' });

  const dedupeById = (arr) => Array.from(new Map((arr || []).map(item => [item.id || item._id, item])).values());

  const fetchData = useCallback(() => {
    if (!activeSchoolId) return;
    setLoading(true);

    const fetchClasses = api.get(`/schools/${activeSchoolId}/classes`)
      .then(res => { if (res.data) setClasses(dedupeById(res.data)); })
      .catch(() => {});

    const fetchParents = isAdmin
      ? api.get(`/schools/${activeSchoolId}/guardians`)
          .then(res => { if (res.data) setParents(dedupeById(res.data)); })
          .catch(() => {})
      : Promise.resolve();

    const q = new URLSearchParams({ page, per_page: 15 });
    if (search) q.set('search', search);
    if (classFilter) q.set('class_id', classFilter);
    if (isAdmin && statusFilter) q.set('status', statusFilter);

    const fetchStudents = api.get(`/schools/${activeSchoolId}/students?${q}`)
      .then(res => {
        setStudents(dedupeById(res.data || []));
        if (res.meta) setTotalPages(Math.ceil((res.meta.total || 1) / (res.meta.per_page || 15)));
        setError('');
      })
      .catch(() => setError('Failed to load student roster.'));

    Promise.all([fetchClasses, fetchParents, fetchStudents]).finally(() => setLoading(false));
  }, [activeSchoolId, page, classFilter, statusFilter, search, isAdmin, isTeacher]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete or withdraw this student?')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/students/${studentId}?force=true`);
      toast.success('Student record removed successfully.');
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete student.');
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (newStudent.date_of_birth) {
      const dobDate = new Date(newStudent.date_of_birth);
      if (dobDate > new Date()) {
        setAddError('Date of birth cannot be in the future.');
        setActiveSection(1);
        return;
      }
    }
    if (!newStudent.guardian_name || !newStudent.guardian_name.trim()) {
      setAddError('Guardian name is required. Please go to Section 5 and fill in the Guardian details.');
      setActiveSection(5);
      return;
    }
    if (!newStudent.guardian_phone && !newStudent.guardian_email) {
      setAddError('Guardian contact is required. Please provide at least a phone number or email in Section 5.');
      setActiveSection(5);
      return;
    }
    if (!newStudent.parent_username || !newStudent.parent_username.trim()) {
      setAddError('Parent login username is required. Please fill it in Section 5.');
      setActiveSection(5);
      return;
    }
    if (!newStudent.parent_password || !newStudent.parent_password.trim()) {
      setAddError('Parent login password is required. Please fill it in Section 5.');
      setActiveSection(5);
      return;
    }
    setAddLoading(true); setAddError('');
    try {
      const res = await api.post(`/schools/${activeSchoolId}/students`, newStudent);
      if (res.data) {
        setShowAddModal(false);
        setNewStudent(EMPTY_FORM);
        setActiveSection(1);
        fetchData();
        if (res.credentials) {
          setCreatedCreds(res.credentials);
        } else {
          toast.success('Student registered successfully.');
        }
      }
    } catch (err) {
      setAddError(err.message || 'Failed to register student.');
    } finally { setAddLoading(false); }
  };

  const openEdit = (s) => {
    setEditStudent(s);
    setEditForm({
      first_name: s.first_name, last_name: s.last_name, middle_name: s.middle_name || '',
      date_of_birth: s.date_of_birth, gender: s.gender, status: s.status,
      class_id: s.class_id || '', admission_number: s.admission_number,
      leadership_position: s.leadership_position || 'none',
      nationality: s.nationality || '', home_address: s.home_address || '',
      religion: s.religion || '', previous_school: s.previous_school || '',
      medical_notes: s.medical_notes || '',
    });
    setEditError(''); setShowEditModal(true);
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    if (editForm.date_of_birth && new Date(editForm.date_of_birth) > new Date()) {
      setEditError('Date of birth cannot be in the future.');
      return;
    }
    setEditLoading(true); setEditError('');
    try {
      await api.patch(`/schools/${activeSchoolId}/students/${editStudent.id}`, editForm);
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      setEditError(err.message || 'Failed to update student.');
    } finally { setEditLoading(false); }
  };

  const handleToggleSuspend = async (s) => {
    const nextStatus = s.status === 'suspended' ? 'enrolled' : 'suspended';
    const confirmMsg = s.status === 'suspended'
      ? `Reinstate '${s.first_name} ${s.last_name}' to enrolled status?`
      : `Suspend '${s.first_name} ${s.last_name}'?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.patch(`/schools/${activeSchoolId}/students/${s.id}`, { status: nextStatus });
      toast.success(nextStatus === 'enrolled' ? 'Student reinstated successfully.' : 'Student suspended.');
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to update student status.');
    }
  };

  const handleSelectAll = (e) => {
    setSelectedIds(e.target.checked ? students.map(s => s.id) : []);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Permanently delete ${selectedIds.length} selected student records? This cannot be undone.`)) return;
    try {
      await api.post(`/schools/${activeSchoolId}/students/bulk-delete`, { student_ids: selectedIds });
      toast.success(`${selectedIds.length} student record(s) deleted.`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to bulk delete student records.');
    }
  };

  const openEditParent = (p) => {
    setEditingParent(p);
    setParentForm({ name: p.name || '', phone: p.phone || '', email: p.email || '', relation: p.relation || 'Parent', national_id: p.national_id || '' });
    setShowParentModal(true);
  };

  const handleSaveParent = async (e) => {
    e.preventDefault();
    if (!editingParent) return;
    try {
      await api.patch(`/schools/${activeSchoolId}/students/guardians/${editingParent.id}`, parentForm);
      toast.success('Guardian details updated successfully.');
      setShowParentModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to update parent details.');
    }
  };

  const handleExport = () => {
    api.downloadFile(`/schools/${activeSchoolId}/students/export`, `students_${activeSchoolId}.csv`)
      .catch(err => console.error('Export error:', err));
  };

  const handleDeleteParent = async (parentId) => {
    if (!window.confirm('Remove this parent/guardian record?')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/students/guardians/${parentId}`);
      toast.success('Guardian removed.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to remove guardian.');
    }
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

  const reportColumns = [
    { header: 'Admission No.', accessor: 'admission_number' },
    { header: 'Student Name', accessor: row => `${row.first_name} ${row.middle_name ? row.middle_name + ' ' : ''}${row.last_name}` },
    { header: 'Class', accessor: row => row.class_name || 'Unassigned' },
    { header: 'Gender', accessor: 'gender' },
    { header: 'DOB', accessor: 'date_of_birth' },
    { header: 'Status', accessor: 'status' },
  ];

  const reportKpis = [
    { label: 'Total Roster', value: students.length },
    { label: 'Enrolled Pupils', value: students.filter(s => s.status === 'enrolled' || s.status === 'active').length },
    { label: 'Suspended Pupils', value: students.filter(s => s.status === 'suspended').length },
    { label: 'Classes Mapped', value: classes.length }
  ];

  // Chart data
  const classChartData = classes.map(c => ({
    name: c.name,
    count: students.filter(s => s.class_id === c.id || s.class_name === c.name).length,
  })).filter(d => d.count > 0);

  const genderData = ['male', 'female', 'other'].map(g => ({
    name: g.charAt(0).toUpperCase() + g.slice(1),
    value: students.filter(s => s.gender === g).length,
  })).filter(d => d.value > 0);

  const statusData = Object.keys(STATUS_COLORS).map(st => ({
    name: st.replace('_', ' '),
    value: students.filter(s => s.status === st).length,
  })).filter(d => d.value > 0);

  const anyModalOpen = showAddModal || showEditModal || showParentModal || showReportModal;
  const selectionActive = selectedIds.length > 0;

  return (
    <div className="module-page students-page p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">

      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="module-title text-3xl font-display font-bold text-ink">
            {isTeacher ? 'My Class Students' : isParent ? 'My Child' : 'Students Directory'}
          </h2>
          <p className="module-subtitle text-sm font-sans text-ink/60 mt-1">
            {isTeacher ? 'Your assigned learners and class records.' : isParent ? 'Your linked child\'s school record.' : 'Review enrollment, status, guardians, and academic records.'}
          </p>
        </div>
        {isAdmin && (
          <div className={`flex items-center space-x-2 transition-opacity ${selectionActive ? 'opacity-30 pointer-events-none' : ''}`}>
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
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

      {/* Charts / Visuals Panel */}
      {isAdmin && students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Enrollment by Class */}
          <div className="glass-card rounded-2xl p-4 border border-line-border/30 col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-teal-primary" />
              <h3 className="text-xs font-bold text-ink/70 uppercase tracking-wider">Enrollment by Class</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={classChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                <YAxis tick={{ fontSize: 8 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" fill="#2a9d8f" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gender Breakdown */}
          <div className="glass-card rounded-2xl p-4 border border-line-border/30">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-teal-primary" />
              <h3 className="text-xs font-bold text-ink/70 uppercase tracking-wider">Gender Breakdown</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {genderData.map((entry) => (
                    <Cell key={entry.name} fill={GENDER_COLORS[entry.name.toLowerCase()] || '#e9c46a'} />
                  ))}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Status Breakdown */}
          <div className="glass-card rounded-2xl p-4 border border-line-border/30">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-teal-primary" />
              <h3 className="text-xs font-bold text-ink/70 uppercase tracking-wider">Status Overview</h3>
            </div>
            <div className="space-y-1.5 mt-2">
              {statusData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs text-ink/70 capitalize flex-1">{s.name}</span>
                  <span className="text-xs font-bold text-ink">{s.value}</span>
                  <div className="w-20 h-1.5 bg-ink/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.value / students.length) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      {isAdmin && (
        <div className="flex border-b border-line-border/30 gap-6 text-sm font-sans font-bold">
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-3 transition-all cursor-pointer flex items-center space-x-2 ${activeTab === 'students' ? 'border-b-2 border-teal-primary text-teal-primary' : 'text-ink/50 hover:text-ink'}`}
          >
            <User className="w-4 h-4" />
            <span>Students Directory ({students.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('parents')}
            className={`pb-3 transition-all cursor-pointer flex items-center space-x-2 ${activeTab === 'parents' ? 'border-b-2 border-teal-primary text-teal-primary' : 'text-ink/50 hover:text-ink'}`}
          >
            <Users className="w-4 h-4" />
            <span>Parents Directory ({parents.length})</span>
          </button>
        </div>
      )}

      {/* Filters */}
      {(isAdmin || isTeacher) && activeTab === 'students' && (
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
            {isAdmin && (
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
            )}
          </div>
        </div>
      )}

      {/* Floating Selection Action Bar */}
      {selectionActive && activeTab === 'students' && (
        <div className="bg-ink/95 backdrop-blur-md rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 animate-fadeIn shadow-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <span className="bg-teal-primary text-paper text-[11px] font-bold px-3 py-1 rounded-full font-mono">{selectedIds.length} selected</span>
            <span className="text-paper/70 text-xs font-sans">
              {selectedIds.length === 1
                ? (() => { const s = students.find(x => x.id === selectedIds[0]); return s ? `${s.first_name} ${s.last_name}` : ''; })()
                : `${selectedIds.length} students`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length === 1 && (() => {
              const s = students.find(x => x.id === selectedIds[0]);
              return s ? (
                <>
                  <button
                    onClick={() => { window.location.href = `/students/${s.id}`; }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-paper text-xs font-semibold rounded-xl transition-all cursor-pointer border border-white/15"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /><span>View Profile</span>
                  </button>
                  <button
                    onClick={() => { openEdit(s); setSelectedIds([]); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-amber-400/20"
                  >
                    <Edit2 className="w-3.5 h-3.5" /><span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleSuspend(s)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer border ${
                      s.status === 'suspended'
                        ? 'bg-teal-primary/30 hover:bg-teal-primary/50 text-teal-300 border-teal-400/30'
                        : 'bg-orange-400/20 hover:bg-orange-400/30 text-orange-300 border-orange-400/20'
                    }`}
                  >
                    {s.status === 'suspended' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    <span>{s.status === 'suspended' ? 'Reinstate' : 'Suspend'}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteStudent(s.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" /><span>Delete</span>
                  </button>
                </>
              ) : null;
            })()}
            {selectedIds.length > 1 && (
              <>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Suspend ${selectedIds.length} students?`)) return;
                    await Promise.all(selectedIds.map(id => api.patch(`/schools/${activeSchoolId}/students/${id}`, { status: 'suspended' }).catch(() => {})));
                    toast.success(`${selectedIds.length} students suspended.`);
                    setSelectedIds([]);
                    fetchData();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-400/20 hover:bg-orange-400/30 text-orange-300 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-orange-400/20"
                >
                  <Ban className="w-3.5 h-3.5" /><span>Suspend All ({selectedIds.length})</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /><span>Delete All ({selectedIds.length})</span>
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedIds([])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-paper/50 hover:text-paper text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /><span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Students Table */}
      {activeTab === 'students' ? (
        <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                  {isAdmin && (
                    <th className="py-4 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={students.length > 0 && selectedIds.length === students.length}
                        className="rounded border-line-border text-teal-primary focus:ring-teal-primary cursor-pointer"
                      />
                    </th>
                  )}
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
                  <tr><td colSpan={isAdmin ? '8' : '7'} className="py-10 text-center text-ink/40 text-xs">Loading students...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={isAdmin ? '8' : '7'} className="py-10 text-center text-ink/40 text-xs">No students match the criteria.</td></tr>
                ) : students.map(s => {
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => isAdmin && handleToggleSelect(s.id)}
                      className={`transition-colors cursor-pointer ${isSelected ? 'bg-teal-primary/8 border-l-2 border-l-teal-primary' : 'hover:bg-sage/5 border-l-2 border-l-transparent'}`}
                    >
                      {isAdmin && (
                        <td className="py-4 px-4 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(s.id)}
                            className="rounded border-line-border text-teal-primary focus:ring-teal-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-4 px-6 font-mono font-semibold numeric-data text-xs">{s.admission_number}</td>
                      <td className="py-4 px-6">
                        <div className="font-bold">{s.first_name} {s.middle_name ? s.middle_name + ' ' : ''}{s.last_name}</div>
                        {s.leadership_position && s.leadership_position !== 'none' && (
                          <span className="inline-flex items-center space-x-1 mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 border border-amber-500/30">
                            <Crown className="w-2.5 h-2.5 text-amber-600" />
                            <span>{s.leadership_position.replace('_', ' ')}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">{s.class_name || 'Unassigned'}</td>
                      <td className="py-4 px-6 capitalize">{s.gender}</td>
                      <td className="py-4 px-6 numeric-data text-xs">{s.date_of_birth}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[s.status] || 'bg-ink/10 text-ink/60'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isSelected
                          ? <span className="text-[10px] font-semibold text-teal-primary">Selected</span>
                          : <span className="text-[11px] text-ink/25 font-sans">click row</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Parents Directory */
        <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                  <th className="py-4 px-6">Parent / Guardian Name</th>
                  <th className="py-4 px-6">Relation</th>
                  <th className="py-4 px-6">Contact Phone</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Linked Child</th>
                  <th className="py-4 px-6">Account Status</th>
                  {isAdmin && <th className="py-4 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                {parents.length === 0 ? (
                  <tr><td colSpan={isAdmin ? '7' : '6'} className="py-10 text-center text-ink/40 text-xs">No parent records registered yet.</td></tr>
                ) : parents.map(p => (
                  <tr key={`${p.id}-${p.student_first}`} className="hover:bg-sage/5 transition-colors">
                    <td className="py-4 px-6 font-bold">{p.name}</td>
                    <td className="py-4 px-6 text-ink/60">{p.relation || 'Guardian'}</td>
                    <td className="py-4 px-6 font-mono text-xs">{p.phone || '-'}</td>
                    <td className="py-4 px-6 font-mono text-xs">{p.email || '-'}</td>
                    <td className="py-4 px-6">
                      {p.student_first ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-primary/10 text-teal-dark text-xs font-bold rounded-lg">
                          <User className="w-3 h-3" />
                          {p.student_first} {p.student_last}
                          {p.admission_number && <span className="font-mono text-[9px] opacity-60">({p.admission_number})</span>}
                        </span>
                      ) : <span className="text-ink/40 text-xs">Not linked</span>}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.user_id ? 'bg-sage/40 text-teal-dark' : 'bg-amber-warning/15 text-amber-warning'}`}>
                        {p.user_id ? 'Active' : 'No Account'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditParent(p)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-amber-500/20"
                          >
                            <Edit2 className="w-3.5 h-3.5" /><span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteParent(p.id)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-brick-critical/10 hover:bg-brick-critical/20 text-brick-critical text-xs font-bold rounded-xl transition-all cursor-pointer border border-brick-critical/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" /><span>Delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && activeTab === 'students' && (
        <div className="flex justify-between items-center">
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

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <h3 className="text-xl font-display font-bold text-ink">Register New Student</h3>
              <button onClick={() => setShowAddModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {/* Section tabs */}
            <div className="flex border-b border-line-border/30 px-6 overflow-x-auto">
              {sections.map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`px-4 py-3 text-xs font-bold transition-colors cursor-pointer border-b-2 whitespace-nowrap ${activeSection === s.id ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/50 hover:text-ink'}`}>
                  {s.id}. {s.title}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddStudent} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {addError && <div className="p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{addError}</div>}

                {/* Section 1 - Identity */}
                {activeSection === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">Core identity information about the student.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelCls}>Admission Number</label><input disabled type="text" className={`${inputCls} bg-sage/10 cursor-not-allowed text-teal-dark font-semibold`} value="Generated Automatically" /></div>
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
                    <div><label className={labelCls}>Date of Birth *</label><input required type="date" max={new Date().toISOString().split('T')[0]} className={inputCls} value={newStudent.date_of_birth} onChange={e => setNewStudent({...newStudent, date_of_birth: e.target.value})} /></div>
                  </div>
                )}

                {/* Section 2 - Enrollment */}
                {activeSection === 2 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">School enrollment, class placement, and leadership title.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelCls}>Class Assignment</label>
                        <select className={inputCls} value={newStudent.class_id} onChange={e => setNewStudent({...newStudent, class_id: e.target.value})}>
                          <option value="">Select Class...</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Leadership Position / Role</label>
                        <select className={inputCls} value={newStudent.leadership_position || 'none'} onChange={e => setNewStudent({...newStudent, leadership_position: e.target.value})}>
                          <option value="none">None (Regular Student)</option>
                          <option value="headboy">Head Boy</option>
                          <option value="headgirl">Head Girl</option>
                          <option value="prefect">Senior Prefect</option>
                          <option value="class_monitress">Class Monitress / Captain</option>
                          <option value="sports_captain">Sports Captain</option>
                          <option value="chapel_prefect">Chapel Prefect</option>
                          <option value="hostel_prefect">Hostel Prefect</option>
                        </select>
                      </div>
                    </div>
                    <div><label className={labelCls}>Previous School</label><input type="text" className={inputCls} placeholder="Name of previous school attended" value={newStudent.previous_school} onChange={e => setNewStudent({...newStudent, previous_school: e.target.value})} /></div>
                  </div>
                )}

                {/* Section 3 - Personal */}
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

                {/* Section 4 - Medical */}
                {activeSection === 4 && (
                  <div className="space-y-4">
                    <p className="text-xs text-ink/50 font-sans">Confidential medical notes (accessible to admin and teachers only).</p>
                    <div><label className={labelCls}>Medical Notes</label><textarea rows={5} className={inputCls} placeholder="Allergies, conditions, medications, emergency care instructions..." value={newStudent.medical_notes} onChange={e => setNewStudent({...newStudent, medical_notes: e.target.value})} /></div>
                  </div>
                )}

                {/* Section 5 - Guardian + Portal Credentials */}
                {activeSection === 5 && (
                  <div className="space-y-5">
                    <p className="text-xs text-ink/50 font-sans">Parent or guardian information and their portal login credentials.</p>

                    {/* Guardian Details */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-ink/70 uppercase tracking-wider border-b border-line-border/30 pb-2">Guardian Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelCls}>Guardian Name *</label><input required type="text" className={inputCls} placeholder="e.g. Mary Mandizera" value={newStudent.guardian_name} onChange={e => setNewStudent({...newStudent, guardian_name: e.target.value})} /></div>
                        <div><label className={labelCls}>Relation</label>
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
                        <div>
                          <label className={`${labelCls} text-teal-primary`}>Phone Number * (required if no email)</label>
                          <input type="text" className={inputCls} placeholder="+263771234567" value={newStudent.guardian_phone} onChange={e => setNewStudent({...newStudent, guardian_phone: e.target.value})} />
                        </div>
                        <div>
                          <label className={`${labelCls} text-teal-primary`}>Email Address * (required if no phone)</label>
                          <input type="email" className={inputCls} placeholder="e.g. mary@gmail.com" value={newStudent.guardian_email} onChange={e => setNewStudent({...newStudent, guardian_email: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    {/* Portal Login Credentials */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-line-border/30 pb-2">
                        <Key className="w-4 h-4 text-teal-primary" />
                        <h4 className="text-xs font-bold text-ink/70 uppercase tracking-wider">Parent Portal Login Credentials</h4>
                      </div>
                      <div className="p-3 rounded-xl bg-teal-primary/5 border border-teal-primary/20 text-xs text-ink/70 font-sans">
                        Set the username and password the parent will use to access the Parent Portal. You will need to share these with the parent.
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`${labelCls} text-teal-primary`}>Username *</label>
                          <input
                            required type="text"
                            placeholder="e.g. mary.mandizera"
                            className={inputCls}
                            value={newStudent.parent_username}
                            onChange={e => setNewStudent({...newStudent, parent_username: e.target.value.toLowerCase().replace(/\s+/g, '.')})}
                          />
                          <p className="text-[9px] text-ink/40 mt-0.5">Lowercase only. Spaces become dots.</p>
                        </div>
                        <div>
                          <label className={`${labelCls} text-teal-primary`}>Password *</label>
                          <input
                            required type="text"
                            placeholder="Set a secure password"
                            className={`${inputCls} font-mono`}
                            value={newStudent.parent_password}
                            onChange={e => setNewStudent({...newStudent, parent_password: e.target.value})}
                          />
                          <p className="text-[9px] text-ink/40 mt-0.5">Min 6 characters recommended.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-line-border/30 flex justify-between items-center">
                <div className="flex gap-2">
                  {activeSection > 1 && <button type="button" onClick={() => setActiveSection(s => s - 1)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/70 hover:bg-sage/10 cursor-pointer">Back</button>}
                  {activeSection < 5 && <button type="button" onClick={() => setActiveSection(s => s + 1)} className="px-4 py-2 bg-ink/5 hover:bg-ink/10 rounded-xl text-xs font-semibold cursor-pointer">Next</button>}
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

      {/* EDIT STUDENT MODAL */}
      {showEditModal && editStudent && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <div>
                <h3 className="text-xl font-display font-bold text-ink">Edit Student Record</h3>
                <p className="text-xs text-ink/50 font-mono mt-0.5">{editStudent.first_name} {editStudent.last_name} - {editStudent.admission_number}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditStudent} className="flex-1 overflow-y-auto p-6 space-y-5">
              {editError && <div className="p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{editError}</div>}

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

              <div className="grid grid-cols-3 gap-4">
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
                <div><label className={labelCls}>Leadership Role</label>
                  <select className={inputCls} value={editForm.leadership_position || 'none'} onChange={e => setEditForm({...editForm, leadership_position: e.target.value})}>
                    <option value="none">Regular Student</option>
                    <option value="headboy">Head Boy</option>
                    <option value="headgirl">Head Girl</option>
                    <option value="prefect">Senior Prefect</option>
                    <option value="class_monitress">Class Monitress / Captain</option>
                    <option value="sports_captain">Sports Captain</option>
                    <option value="chapel_prefect">Chapel Prefect</option>
                    <option value="hostel_prefect">Hostel Prefect</option>
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
                <div><label className={labelCls}>Date of Birth</label><input type="date" max={new Date().toISOString().split('T')[0]} className={inputCls} value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} /></div>
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

      {/* EDIT PARENT MODAL */}
      {showParentModal && editingParent && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative p-6 space-y-4 animate-fadeIn max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-line-border/20 pb-3">
              <h3 className="text-lg font-display font-bold text-ink">Edit Parent / Guardian Details</h3>
              <button onClick={() => setShowParentModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveParent} className="space-y-4 text-xs font-sans">
              <div><label className="block font-bold text-ink/75 mb-1">Parent Full Name *</label><input required type="text" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl" value={parentForm.name} onChange={e => setParentForm({ ...parentForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-ink/75 mb-1">Phone Number</label><input type="text" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl font-mono" value={parentForm.phone} onChange={e => setParentForm({ ...parentForm, phone: e.target.value })} /></div>
                <div><label className="block font-bold text-ink/75 mb-1">Email Address</label><input type="email" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl font-mono" value={parentForm.email} onChange={e => setParentForm({ ...parentForm, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-ink/75 mb-1">National ID</label><input type="text" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl" value={parentForm.national_id} onChange={e => setParentForm({ ...parentForm, national_id: e.target.value })} /></div>
                <div><label className="block font-bold text-ink/75 mb-1">Relation</label>
                  <select className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl font-semibold" value={parentForm.relation} onChange={e => setParentForm({ ...parentForm, relation: e.target.value })}>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Sponsor">Sponsor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-line-border/20">
                <button type="button" onClick={() => setShowParentModal(false)} className="px-4 py-2 border border-line-border rounded-xl font-semibold text-ink/70 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-teal-primary hover:bg-teal-dark text-paper font-semibold rounded-xl shadow-md cursor-pointer">Save Parent Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PrintReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="STUDENT DIRECTORY & ENROLLMENT LEDGER"
        subtitle={`Official Roster Report - ${classes.length} Classes Active`}
        schoolName="SchoolBase Academic Portal"
        summaryCards={reportKpis}
        columns={reportColumns}
        data={students}
        userRole={user?.role === 'super_admin' ? 'Super Admin' : 'School Admin'}
      />

      {/* CREDENTIAL DISPLAY MODAL */}
      {createdCreds && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-paper border border-line-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-teal-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-ink">Parent Account Created</h3>
                <p className="text-xs text-ink/60 font-sans mt-0.5">Share these login credentials with the parent. They access the Parent Portal using these details.</p>
              </div>
            </div>
            <div className="bg-sage/10 rounded-xl border border-teal-primary/20 divide-y divide-line-border/30 overflow-hidden font-sans">
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-ink/50 tracking-wider">Username</span>
                <span className="text-sm font-mono font-bold text-teal-dark select-all">{createdCreds.username}</span>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-ink/50 tracking-wider">Password</span>
                <span className="text-sm font-mono font-bold text-brick-critical bg-brick-critical/10 px-2 py-0.5 rounded select-all">{createdCreds.password}</span>
              </div>
            </div>
            <p className="text-[11px] text-brick-critical font-bold font-sans">
              This password is shown once. Copy it and share it with the parent immediately.
            </p>
            <button
              onClick={() => setCreatedCreds(null)}
              className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl font-sans text-xs font-bold shadow-md cursor-pointer transition-colors"
            >
              Got It - Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Students;
