import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  Search, Filter, Plus, User, X, Eye, Edit2, ArrowRightLeft, ChevronLeft, ChevronRight, FileText,
  Crown, Trash2, Users, Award, Printer, Ban, CheckCircle2, ShieldAlert
} from 'lucide-react';
import PrintReportModal from '../components/PrintReportModal';

const STATUS_COLORS = {
  enrolled:    'bg-sage/35 text-teal-dark',
  suspended:   'bg-amber-warning/15 text-amber-warning',
  withdrawn:   'bg-brick-critical/10 text-brick-critical',
  graduated:   'bg-ink/10 text-ink/60',
  transferred: 'bg-teal-primary/5 text-teal-dark/70',
  dropped_out: 'bg-brick-critical/15 text-brick-critical',
};

const EMPTY_FORM = {
  admission_number: '', first_name: '', middle_name: '', last_name: '',
  date_of_birth: '', gender: 'male',
  class_id: '', previous_school: '', leadership_position: 'none',
  nationality: '', home_address: '', religion: '',
  medical_notes: '',
  guardian_name: '', guardian_phone: '', guardian_email: '', guardian_national_id: '', guardian_relation: 'Mother',
};

const Students = () => {
  const { activeSchoolId, user } = useAuth();

  const isAdmin      = user?.role === 'school_admin' || user?.role === 'super_admin';
  const isTeacher    = user?.role === 'teacher';
  const isParent     = user?.role === 'parent';

  const [activeTab,    setActiveTab]   = useState('students'); // 'students' | 'parents'
  const [students,    setStudents]    = useState([]);
  const [parents,     setParents]     = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);

  // Bulk selection & PDF Modal states
  const [selectedIds, setSelectedIds] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);

  // Parent Edit & Autocomplete Modal states
  const [showParentModal, setShowParentModal] = useState(false);
  const [editingParent, setEditingParent] = useState(null);
  const [parentForm, setParentForm] = useState({ name: '', phone: '', email: '', relation: '', national_id: '' });
  const [parentSearch, setParentSearch] = useState('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [selectedExistingParent, setSelectedExistingParent] = useState(null);



  // Add modal
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [newStudent,    setNewStudent]    = useState(EMPTY_FORM);
  const [addError,      setAddError]      = useState('');
  const [addLoading,    setAddLoading]    = useState(false);
  const [activeSection, setActiveSection] = useState(1);
  const [createdParentCreds, setCreatedParentCreds] = useState(null);

  // Edit / Transfer modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStudent,   setEditStudent]   = useState(null);
  const [editForm,      setEditForm]      = useState({});
  const [editError,     setEditError]     = useState('');
  const [editLoading,   setEditLoading]   = useState(false);

  const dedupeById = (arr) => Array.from(new Map((arr || []).map(item => [item.id || item._id, item])).values());

  const fetchData = useCallback(() => {
    if (!activeSchoolId) return;
    setLoading(true);

    if (isAdmin) {
      api.get(`/schools/${activeSchoolId}/classes`)
        .then(res => { if (res.data) setClasses(dedupeById(res.data)); })
        .catch(() => {});
      api.get(`/schools/${activeSchoolId}/guardians`)
        .then(res => { if (res.data) setParents(dedupeById(res.data)); })
        .catch(() => {});
    } else if (isTeacher) {
      // Teachers need class list for filtering too
      api.get(`/schools/${activeSchoolId}/classes`)
        .then(res => { if (res.data) setClasses(dedupeById(res.data)); })
        .catch(() => {});
    }

    const q = new URLSearchParams({ page, per_page: 15 });
    if (search) q.set('search', search);
    if (classFilter) q.set('class_id', classFilter);
    if (isAdmin && statusFilter) q.set('status', statusFilter);

    api.get(`/schools/${activeSchoolId}/students?${q}`)
      .then(res => {
        setStudents(dedupeById(res.data || []));
        if (res.meta) setTotalPages(Math.ceil((res.meta.total || 1) / (res.meta.per_page || 15)));
        setError('');
      })
      .catch(() => setError('Failed to load student roster.'))
      .finally(() => setLoading(false));
  }, [activeSchoolId, page, classFilter, statusFilter, search, isAdmin, isTeacher]);


  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete or withdraw this student?')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/students/${studentId}?force=true`);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to delete student.');
    }
  };

  // ── Add Student ─────────────────────────────────────────────────────────────
  const handleAddStudent = async (e) => {
    e.preventDefault();
    // Client-side guardian contact validation
    if (!newStudent.guardian_name || !newStudent.guardian_name.trim()) {
      setAddError('Guardian name is required. Please go to Section 5 and fill in the Guardian details.');
      setActiveSection(5);
      return;
    }
    if (!newStudent.guardian_phone && !newStudent.guardian_email) {
      setAddError('Guardian contact is required. Please provide at least a phone number or email address in Section 5.');
      setActiveSection(5);
      return;
    }
    setAddLoading(true); setAddError('');
    try {
      const res = await api.post(`/schools/${activeSchoolId}/students`, newStudent);
      if (res.data) {
        setShowAddModal(false);
        if (res.data.parent_credentials) {
          setCreatedParentCreds({
            studentName: `${res.data.first_name} ${res.data.last_name}`,
            admissionNumber: res.data.admission_number,
            username: res.data.parent_credentials.username,
            tempPassword: res.data.parent_credentials.temp_password
          });
        }
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
      leadership_position: s.leadership_position || 'none',
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

  const handleToggleSuspend = async (s) => {
    const nextStatus = s.status === 'suspended' ? 'enrolled' : 'suspended';
    const confirmMsg = s.status === 'suspended'
      ? `Reinstate student '${s.first_name} ${s.last_name}' to enrolled status?`
      : `Suspend student '${s.first_name} ${s.last_name}'?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.patch(`/schools/${activeSchoolId}/students/${s.id}`, { status: nextStatus });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to update student status.');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(students.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.length} selected student records? This action cannot be undone.`)) return;
    try {
      await api.post(`/schools/${activeSchoolId}/students/bulk-delete`, { student_ids: selectedIds });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to bulk delete student records.');
    }
  };

  const openEditParent = (p) => {
    setEditingParent(p);
    setParentForm({
      name: p.name || '',
      phone: p.phone || '',
      email: p.email || '',
      relation: p.relation || 'Parent',
      national_id: p.national_id || '',
    });
    setShowParentModal(true);
  };

  const handleSaveParent = async (e) => {
    e.preventDefault();
    if (!editingParent) return;
    try {
      await api.patch(`/schools/${activeSchoolId}/students/guardians/${editingParent.id}`, parentForm);
      setShowParentModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to update parent details.');
    }
  };

  const handleExport = () => {
    api.downloadFile(`/schools/${activeSchoolId}/students/export`, `students_${activeSchoolId}.csv`)
      .catch(err => console.error('Export error:', err));
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

  // Format PDF Report Columns
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
              onClick={() => setShowReportModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF Report</span>
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

      {/* Tab Switcher for Admins */}
      {isAdmin && (
        <div className="flex border-b border-line-border/30 gap-6 text-sm font-sans font-bold">
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-3 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'students' ? 'border-b-2 border-teal-primary text-teal-primary' : 'text-ink/50 hover:text-ink'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Students Directory ({students.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('parents')}
            className={`pb-3 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'parents' ? 'border-b-2 border-teal-primary text-teal-primary' : 'text-ink/50 hover:text-ink'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Parents Directory ({parents.length})</span>
          </button>
        </div>
      )}

      {/* Filters — admins and teachers */}
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

      {/* Selection Action Bar (Appears when items are selected) */}
      {selectedIds.length > 0 && activeTab === 'students' && (
        <div className="bg-sage/15 border border-teal-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 animate-fadeIn shadow-sm">
          <div className="flex items-center space-x-3 text-xs font-bold text-ink">
            <span className="bg-teal-primary text-paper px-3 py-1 rounded-full font-mono">{selectedIds.length} Selected</span>
            <span>Batch Actions: Manage selected student records.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length === 1 && (
              <button
                onClick={() => window.location.href = `/students/${selectedIds[0]}`}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#e8f4f3] hover:bg-teal-primary/20 text-[#1b5e58] text-xs font-bold rounded-xl transition-all cursor-pointer border border-teal-primary/20 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
            )}

            {selectedIds.length === 1 && (
              <button
                onClick={() => {
                  const s = students.find(item => item.id === selectedIds[0]);
                  if (s) openEdit(s);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#fdf6e7] hover:bg-amber-warning/25 text-[#925f0e] text-xs font-bold rounded-xl transition-all cursor-pointer border border-amber-warning/30 shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            <button
              onClick={async () => {
                if (!window.confirm(`Suspend ${selectedIds.length} selected student(s)?`)) return;
                await Promise.all(selectedIds.map(id => api.put(`/schools/${activeSchoolId}/students/${id}`, { status: 'suspended' }).catch(() => {})));
                setSelectedIds([]);
                fetchStudents();
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#fdf0e6] hover:bg-orange-500/25 text-[#a84b00] text-xs font-bold rounded-xl transition-all cursor-pointer border border-orange-500/30 shadow-2xs"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspend ({selectedIds.length})</span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#fbeae8] hover:bg-brick-critical/25 text-[#9b2c2c] text-xs font-bold rounded-xl transition-all cursor-pointer border border-brick-critical/30 shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.length})</span>
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
                  <tr><td colSpan={isAdmin ? "8" : "7"} className="py-10 text-center text-ink/40 text-xs">Loading students...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={isAdmin ? "8" : "7"} className="py-10 text-center text-ink/40 text-xs">No students match the criteria.</td></tr>
                ) : students.map(s => (
                  <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                    {isAdmin && (
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
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
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => window.location.href = `/students/${s.id}`}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#e8f4f3] hover:bg-teal-primary/20 text-[#1b5e58] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border border-teal-primary/20"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#fdf6e7] hover:bg-amber-warning/25 text-[#925f0e] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border border-amber-warning/30"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleSuspend(s)}
                          title={s.status === 'suspended' ? 'Reinstate Student' : 'Suspend Student'}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border ${
                            s.status === 'suspended'
                              ? 'bg-teal-primary/15 text-teal-dark hover:bg-teal-primary/25 border-teal-primary/30'
                              : 'bg-[#fdf0e6] text-[#a84b00] hover:bg-orange-500/25 border-orange-500/30'
                          }`}
                        >
                          {s.status === 'suspended' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          <span>{s.status === 'suspended' ? 'Reinstate' : 'Suspend'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s.id)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#fbeae8] hover:bg-brick-critical/20 text-[#9b2c2c] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border border-brick-critical/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Parent Directory Table */
        <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                  <th className="py-4 px-6">Parent / Guardian Name</th>
                  <th className="py-4 px-6">Relation</th>
                  <th className="py-4 px-6">Contact Phone</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Linked Children</th>
                  <th className="py-4 px-6">Status</th>
                  {isAdmin && <th className="py-4 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                {parents.length === 0 ? (
                  <tr><td colSpan={isAdmin ? "7" : "6"} className="py-10 text-center text-ink/40 text-xs">No parent records registered yet.</td></tr>
                ) : parents.map(p => (
                  <tr key={p.id} className="hover:bg-sage/5 transition-colors">
                    <td className="py-4 px-6 font-bold">{p.name}</td>
                    <td className="py-4 px-6 text-ink/70">{p.relation || 'Parent'}</td>
                    <td className="py-4 px-6 font-mono text-xs numeric-data">{p.phone || '-'}</td>
                    <td className="py-4 px-6 font-mono text-xs text-ink/70">{p.email || '-'}</td>
                    <td className="py-4 px-6 text-teal-dark font-semibold text-xs">{p.linked_children || p.children || 'No linked children'}</td>
                    <td className="py-4 px-6">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sage/40 text-teal-dark">
                        Active
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => alert(`Parent Profile:\nName: ${p.name}\nPhone: ${p.phone || 'N/A'}\nEmail: ${p.email || 'N/A'}\nLinked Children: ${p.linked_children || p.children || 'None'}`)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#e8f4f3] hover:bg-teal-primary/20 text-[#1b5e58] text-xs font-bold rounded-xl transition-all cursor-pointer border border-teal-primary/20 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => openEditParent(p)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#fdf6e7] hover:bg-amber-warning/25 text-[#925f0e] text-xs font-bold rounded-xl transition-all cursor-pointer border border-amber-warning/30 shadow-2xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => alert('Parent account status active.')}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#fdf0e6] text-[#a84b00] hover:bg-orange-500/25 text-xs font-bold rounded-xl transition-all cursor-pointer border border-orange-500/30 shadow-2xs"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                          <button
                            onClick={() => handleDeleteParent(p.id)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#fbeae8] hover:bg-brick-critical/20 text-[#9b2c2c] text-xs font-bold rounded-xl transition-all cursor-pointer border border-brick-critical/30 shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
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

                {/* Section 5 — Guardian & Autocomplete Linkage */}
                {activeSection === 5 && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-teal-primary/10 border border-teal-primary/20 text-xs text-teal-primary font-semibold">
                      🔍 <strong>Search & Auto-Complete:</strong> Start typing an existing parent's name, phone, or email to auto-fill and link their account instead of re-entering data manually!
                    </div>

                    {/* Autocomplete Input */}
                    <div className="relative">
                      <label className="block text-xs font-bold text-ink/75 mb-1">Search Existing Parent / Guardian (Autocomplete)</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type parent name, phone (+263...), or email to retrieve existing record..."
                          className="w-full px-3.5 py-2.5 bg-paper border border-teal-primary/40 rounded-xl text-xs font-sans text-ink focus:outline-none focus:ring-2 focus:ring-teal-primary/30"
                          value={parentSearch}
                          onChange={(e) => {
                            setParentSearch(e.target.value);
                            setShowParentDropdown(true);
                          }}
                          onFocus={() => setShowParentDropdown(true)}
                        />
                        <Search className="w-4 h-4 text-teal-primary absolute right-3 top-3" />
                      </div>

                      {/* Dropdown Results */}
                      {showParentDropdown && parentSearch.trim().length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-paper border border-line-border/40 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-line-border/20">
                          {parents
                            .filter(p =>
                              p.name?.toLowerCase().includes(parentSearch.toLowerCase()) ||
                              p.phone?.includes(parentSearch) ||
                              p.email?.toLowerCase().includes(parentSearch.toLowerCase())
                            )
                            .map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setNewStudent({
                                    ...newStudent,
                                    guardian_name: p.name || '',
                                    guardian_phone: p.phone || '',
                                    guardian_email: p.email || '',
                                    guardian_national_id: p.national_id || '',
                                    guardian_relation: p.relation || 'Mother',
                                    existing_guardian_id: p.id
                                  });
                                  setSelectedExistingParent(p);
                                  setShowParentDropdown(false);
                                }}
                                className="p-3 hover:bg-teal-primary/10 cursor-pointer flex items-center justify-between transition-colors"
                              >
                                <div>
                                  <span className="font-bold text-xs text-ink block">{p.name}</span>
                                  <span className="text-[10px] text-ink/60 font-mono">Phone: {p.phone || '-'} | Email: {p.email || '-'}</span>
                                </div>
                                <span className="text-[9px] font-bold bg-teal-primary/10 text-teal-primary px-2 py-0.5 rounded">
                                  Link Parent
                                </span>
                              </div>
                            ))}
                          {parents.filter(p =>
                            p.name?.toLowerCase().includes(parentSearch.toLowerCase()) ||
                            p.phone?.includes(parentSearch) ||
                            p.email?.toLowerCase().includes(parentSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="p-3 text-xs text-ink/50 italic text-center">
                              No matching existing parent found. Fill in details below to register a new parent profile.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedExistingParent && (
                      <div className="p-3 rounded-xl bg-sage/30 border border-teal-primary/30 text-xs font-bold text-teal-dark flex justify-between items-center">
                        <span>✓ Linked to Existing Parent: <strong>{selectedExistingParent.name}</strong> ({selectedExistingParent.phone || selectedExistingParent.email})</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExistingParent(null);
                            setParentSearch('');
                          }}
                          className="text-[10px] underline hover:text-brick-critical cursor-pointer"
                        >
                          Clear Linkage
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={labelCls}>Guardian Name *</label><input required type="text" className={inputCls} placeholder="e.g. Mary Mandizera" value={newStudent.guardian_name} onChange={e => setNewStudent({...newStudent, guardian_name: e.target.value})} /></div>
                      <div><label className={labelCls}>Guardian Relation</label>
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
                        <input type="text" className={inputCls} placeholder="e.g. +263771234567" value={newStudent.guardian_phone} onChange={e => setNewStudent({...newStudent, guardian_phone: e.target.value})} />
                      </div>
                      <div>
                        <label className={`${labelCls} text-teal-primary`}>Email Address * (required if no phone)</label>
                        <input type="email" className={inputCls} placeholder="e.g. mary@gmail.com" value={newStudent.guardian_email} onChange={e => setNewStudent({...newStudent, guardian_email: e.target.value})} />
                      </div>
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
                <div>
                  <label className={labelCls}>Leadership Role</label>
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

      {/* Edit Parent Modal */}
      {showParentModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line-border/30 pb-3">
              <h3 className="text-lg font-display font-bold text-ink">Edit Parent / Guardian Contact</h3>
              <button onClick={() => setShowParentModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveParent} className="space-y-4 font-sans text-xs">
              <div>
                <label className={labelCls}>Parent / Guardian Full Name *</label>
                <input required type="text" className={inputCls} value={parentForm.name} onChange={e => setParentForm({...parentForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Relation *</label>
                  <select className={inputCls} value={parentForm.relation} onChange={e => setParentForm({...parentForm, relation: e.target.value})}>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Sponsor">Sponsor</option>
                    <option value="Relative">Relative</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>National ID</label>
                  <input type="text" className={inputCls} value={parentForm.national_id} onChange={e => setParentForm({...parentForm, national_id: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <input required type="text" className={inputCls} value={parentForm.phone} onChange={e => setParentForm({...parentForm, phone: e.target.value})} />
                </div>
                <div>
                  <label className={labelCls}>Email Address</label>
                  <input type="email" className={inputCls} value={parentForm.email} onChange={e => setParentForm({...parentForm, email: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowParentModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer">
                  Save Guardian Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parent Credentials Modal */}
      {createdParentCreds && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-paper border border-line-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-teal-primary">
              <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center font-bold">
                🔑
              </div>
              <div>
                <h3 className="font-sans font-bold text-base text-ink">Parent Credentials Generated!</h3>
                <p className="text-xs text-ink/60 font-sans">Login credentials created for {createdParentCreds.studentName}</p>
              </div>
            </div>

            <div className="bg-sage/10 p-4 rounded-xl space-y-3 font-sans border border-teal-primary/20">
              <div>
                <span className="text-[10px] uppercase font-bold text-ink/50 block">Admission Number</span>
                <span className="text-xs font-mono font-bold text-ink">{createdParentCreds.admissionNumber}</span>
              </div>
              <div className="border-t border-line-border/20 pt-2">
                <span className="text-[10px] uppercase font-bold text-ink/50 block">Parent Portal Username</span>
                <span className="text-sm font-mono font-bold text-teal-dark">{createdParentCreds.username}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-ink/50 block">Temporary Password</span>
                <span className="text-sm font-mono font-bold text-brick-critical bg-brick-critical/10 px-2 py-0.5 rounded">{createdParentCreds.tempPassword}</span>
              </div>
            </div>

            <p className="text-xs text-ink/60 italic font-sans">
              Provide these credentials to the parent/guardian to log in at the Parent Portal.
            </p>

            <div className="pt-2">
              <button
                onClick={() => setCreatedParentCreds(null)}
                className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl font-sans text-xs font-bold shadow-md cursor-pointer transition-colors"
              >
                Got It &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── EDIT PARENT MODAL ─────────────────────────────────────────────────── */}
      {showParentModal && editingParent && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative p-6 space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-line-border/20 pb-3">
              <h3 className="text-lg font-display font-bold text-ink">Edit Parent / Guardian Details</h3>
              <button onClick={() => setShowParentModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleUpdateParent} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-ink/75 mb-1">Parent Full Name *</label>
                <input required type="text" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl" value={parentForm.name} onChange={e => setParentForm({ ...parentForm, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink/75 mb-1">Phone Number</label>
                  <input type="text" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl font-mono" value={parentForm.phone} onChange={e => setParentForm({ ...parentForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block font-bold text-ink/75 mb-1">Email Address</label>
                  <input type="email" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl font-mono" value={parentForm.email} onChange={e => setParentForm({ ...parentForm, email: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink/75 mb-1">National ID</label>
                  <input type="text" className="w-full px-3 py-2 bg-paper border border-line-border rounded-xl" value={parentForm.national_id} onChange={e => setParentForm({ ...parentForm, national_id: e.target.value })} />
                </div>
                <div>
                  <label className="block font-bold text-ink/75 mb-1">Relation</label>
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
        subtitle={`Official Roster Report • ${classes.length} Classes Active`}
        schoolName="SchoolBase Academic Portal"
        summaryCards={reportKpis}
        columns={reportColumns}
        data={students}
        userRole={user?.role === 'super_admin' ? 'Super Admin' : 'School Admin'}
      />

    </div>
  );
};

export default Students;