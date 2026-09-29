import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import {
  UserCheck, Plus, X, Loader2, Mail, Send, MessageSquare, Inbox,
  Edit3, Trash2, Printer, Eye, BookOpen, Phone, AtSign, Ban,
  CheckCircle2, BarChart3, Users, BookMarked
} from 'lucide-react';
import PrintReportModal from '../components/PrintReportModal';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const CHART_COLORS = ['#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#264653', '#a8dadc'];

const Staff = () => {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [staff, setStaff]           = useState([]);
  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({ name: '', email: '', phone: '', role_title: '', class_id: '', username: '', password: '', subject_ids: [] });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]   = useState('');
  const [generatedCreds, setGeneratedCreds] = useState(null);
  const [error, setError]           = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [selectedIds, setSelectedIds]     = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editStaff, setEditStaff]         = useState(null);
  const [editForm, setEditForm]           = useState({ name: '', email: '', phone: '', role_title: '', class_id: '', subject_ids: [] });
  const [classes, setClasses]             = useState([]);
  const [subjects, setSubjects]           = useState([]);
  const [schoolInfo, setSchoolInfo]       = useState(null);

  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgForm, setMsgForm]           = useState({ recipient_id: '', subject: '', body: '' });
  const [msgLoading, setMsgLoading]     = useState(false);
  const [msgError, setMsgError]         = useState('');
  const [msgSuccess, setMsgSuccess]     = useState('');

  const [viewStaff, setViewStaff]               = useState(null);
  const [viewStaffProfile, setViewStaffProfile] = useState(null);
  const [viewStaffLoading, setViewStaffLoading] = useState(false);

  const isPrimary   = schoolInfo?.school_type === 'primary';
  const isPrincipal = ['school_admin', 'super_admin'].includes(user?.role);
  const isTeacher   = user?.role === 'teacher';
  const selectionActive = selectedIds.length > 0;

  const handleViewStaff = async (s) => {
    setViewStaff(s);
    setViewStaffProfile(null);
    setViewStaffLoading(true);
    try {
      const res = await api.get(`/schools/${activeSchoolId}/staff/${s.id}`);
      setViewStaffProfile(res.data);
    } catch (e) {
      setViewStaffProfile({ staff: s, assignments: [], messages: [] });
    } finally {
      setViewStaffLoading(false);
    }
  };

  const handleToggleStatus = async (staffMember) => {
    const nextStatus = staffMember.status === 'deactivated' ? 'active' : 'deactivated';
    try {
      await api.patch(`/schools/${activeSchoolId}/staff/${staffMember.id}`, {
        name: staffMember.name, email: staffMember.email, phone: staffMember.phone,
        role_title: staffMember.role_title, class_id: staffMember.class_id, status: nextStatus
      });
      toast.success(nextStatus === 'active' ? `${staffMember.name} reactivated.` : `${staffMember.name} deactivated.`);
      setSelectedIds([]);
      fetchStaff();
    } catch (err) {
      toast.error(err.message || 'Failed to update staff status.');
    }
  };

  const dedupeById = (arr) => Array.from(new Map((arr || []).map(item => [item.id || item._id, item])).values());

  const fetchStaff = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/staff`)
      .then(res => { setStaff(dedupeById(res.data || [])); setError(''); })
      .catch(() => setError('Failed to load staff roster.'))
      .finally(() => setLoading(false));
  };

  const fetchClasses = () => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}/classes`)
      .then(res => { setClasses(dedupeById(res.data || [])); })
      .catch(() => {});
  };

  const fetchSubjects = () => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}/subjects`)
      .then(res => { setSubjects(dedupeById(res.data || [])); })
      .catch(() => {
        // fallback to global subjects
        api.get('/subjects').then(r => setSubjects(dedupeById(r.data || []))).catch(() => {});
      });
  };

  const fetchMessages = () => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}/teacher-messages`)
      .then(res => { setMessages(dedupeById(res.data || [])); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStaff();
    fetchMessages();
    fetchClasses();
    fetchSubjects();
    if (activeSchoolId) {
      api.get(`/schools/${activeSchoolId}`)
        .then(res => { setSchoolInfo(res.data?.data || res.data); })
        .catch(e => console.error(e));
    }
  }, [activeSchoolId]);

  const toggleSubject = (id, formObj, setFormObj) => {
    const ids = formObj.subject_ids || [];
    setFormObj({ ...formObj, subject_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setGeneratedCreds(null);
    try {
      const payload = { ...form };
      const res = await api.post(`/schools/${activeSchoolId}/staff`, payload);
      const data = res.data;
      if (data?.generated_password) {
        setGeneratedCreds({ username: data.generated_username, password: data.generated_password });
      } else {
        setShowModal(false);
      }
      setForm({ name: '', email: '', phone: '', role_title: '', class_id: '', username: '', password: '', subject_ids: [] });
      fetchStaff();
    } catch (err) {
      setFormError(err.message || 'Failed to add staff member.');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (s) => {
    setEditStaff(s);
    setEditForm({
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      role_title: s.role_title || '',
      class_id: s.class_id || '',
      subject_ids: []
    });
    // Load existing subject assignments
    api.get(`/schools/${activeSchoolId}/staff/${s.id}/subjects`)
      .then(res => {
        const ids = (res.data || []).map(sub => sub.id);
        setEditForm(prev => ({ ...prev, subject_ids: ids }));
      })
      .catch(() => {});
    setFormError('');
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.patch(`/schools/${activeSchoolId}/staff/${editStaff.id}`, {
        name: editForm.name, email: editForm.email, phone: editForm.phone,
        role_title: editForm.role_title, class_id: editForm.class_id
      });
      // Update subject assignments
      if (!isPrimary && Array.isArray(editForm.subject_ids)) {
        await api.put(`/schools/${activeSchoolId}/staff/${editStaff.id}/subjects`, { subject_ids: editForm.subject_ids }).catch(() => {});
      }
      setShowEditModal(false);
      setEditStaff(null);
      fetchStaff();
    } catch (err) {
      setFormError(err.message || 'Failed to update staff member.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;
    const target = staff.find(s => s.id === staffId);
    try {
      await api.delete(`/schools/${activeSchoolId}/staff/${staffId}`);
      toast.success(`${target?.name || 'Staff member'} removed from roster.`);
      setSelectedIds([]);
      fetchStaff();
    } catch (err) {
      toast.error(err.message || 'Failed to delete staff member.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setMsgLoading(true);
    setMsgError('');
    setMsgSuccess('');
    try {
      await api.post(`/schools/${activeSchoolId}/teacher-messages`, msgForm);
      setMsgSuccess('Message sent successfully!');
      setMsgForm({ recipient_id: '', subject: '', body: '' });
      fetchMessages();
      setTimeout(() => { setShowMsgModal(false); setMsgSuccess(''); }, 1500);
    } catch (err) {
      setMsgError(err.message || 'Failed to send message.');
    } finally {
      setMsgLoading(false);
    }
  };

  const openMsgModal = (recipientId = '') => {
    setMsgForm({ recipient_id: recipientId, subject: '', body: '' });
    setMsgError('');
    setMsgSuccess('');
    setShowMsgModal(true);
  };

  const filterByRole = (roleTitle, filterKey) => {
    if (!roleTitle) return filterKey === 'support';
    const t = roleTitle.toLowerCase();
    switch (filterKey) {
      case 'class_teacher': return t.includes('class teacher') || t.includes('form master') || t.includes('form mistress');
      case 'subject_teacher': return t.includes('subject teacher');
      case 'admin':  return t.includes('principal') || t.includes('headmaster') || t.includes('headmistress') || t.includes('deputy head') || t.includes('vice principal') || t.includes('bursar') || t.includes('librarian');
      case 'support': return t.includes('support') || t.includes('cleaner') || t.includes('security') || t.includes('driver') || t.includes('cook') || t.includes('catering');
      default: return true;
    }
  };

  const filteredStaff = roleFilter === 'all' ? staff : staff.filter(s => filterByRole(s.role_title, roleFilter));

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} staff member(s) permanently?`)) return;
    try {
      await Promise.all(selectedIds.map(id => api.delete(`/schools/${activeSchoolId}/staff/${id}`).catch(() => {})));
      toast.success(`${selectedIds.length} staff record(s) removed.`);
      setSelectedIds([]);
      fetchStaff();
    } catch (err) {
      toast.error(err.message || 'Failed to bulk delete staff records.');
    }
  };

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center font-sans animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
          <UserCheck className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 text-sm">Select a school tenant from the sidebar switcher to view and manage school staff.</p>
      </div>
    );
  }

  const reportColumns = [
    { header: 'Staff Name', accessor: 'name' },
    { header: 'Role / Title', accessor: row => row.role_title || 'Teacher' },
    { header: 'Email Address', accessor: 'email' },
    { header: 'Phone Number', accessor: 'phone' },
    { header: 'Assigned Class', accessor: row => row.class_name || 'Unassigned' },
    { header: 'Account Status', accessor: row => row.status || 'active' },
  ];

  const reportKpis = [
    { label: 'Total Faculty', value: staff.length },
    { label: 'Active Staff', value: staff.filter(s => !s.status || s.status === 'active').length },
    { label: 'Deactivated', value: staff.filter(s => s.status === 'deactivated').length },
    { label: 'Classes Assigned', value: staff.filter(s => s.class_id).length }
  ];

  // Chart data
  const roleData = [
    { name: 'Class Teachers', value: staff.filter(s => filterByRole(s.role_title, 'class_teacher')).length },
    { name: 'Subject Teachers', value: staff.filter(s => filterByRole(s.role_title, 'subject_teacher')).length },
    { name: 'Admin', value: staff.filter(s => filterByRole(s.role_title, 'admin')).length },
    { name: 'Support', value: staff.filter(s => filterByRole(s.role_title, 'support')).length },
  ].filter(d => d.value > 0);

  const statusData = [
    { name: 'Active', value: staff.filter(s => !s.status || s.status === 'active').length, fill: '#2a9d8f' },
    { name: 'Deactivated', value: staff.filter(s => s.status === 'deactivated').length, fill: '#e76f51' },
  ].filter(d => d.value > 0);

  const filterTabs = isPrimary
    ? [
        { key: 'all', label: 'All Staff' },
        { key: 'class_teacher', label: 'Class Teachers' },
        { key: 'admin', label: 'Administration' },
        { key: 'support', label: 'Support Staff' },
      ]
    : [
        { key: 'all', label: 'All Staff' },
        { key: 'class_teacher', label: 'Class Teachers' },
        { key: 'subject_teacher', label: 'Subject Teachers' },
        { key: 'admin', label: 'Administration' },
        { key: 'support', label: 'Support Staff' },
      ];

  const inputCls = 'w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs bg-paper text-ink';
  const labelCls = 'block text-xs font-semibold text-ink/70 mb-1';

  // Role options per school type
  const roleOptions = isPrimary
    ? [
        { value: 'Class Teacher', label: 'Class Teacher' },
        { value: 'Deputy Head / Vice Principal', label: 'Deputy Head / Vice Principal' },
        { value: 'Senior Master / Mistress', label: 'Senior Master / Mistress' },
        { value: 'Bursar / Accountant', label: 'Bursar / Accountant' },
        { value: 'School Librarian', label: 'School Librarian' },
      ]
    : [
        { value: 'Class Teacher', label: 'Class Teacher' },
        { value: 'Subject Teacher', label: 'Subject Teacher' },
        { value: 'Form Master / Mistress', label: 'Form Master / Mistress' },
        { value: 'Deputy Head / Vice Principal', label: 'Deputy Head / Vice Principal' },
        { value: 'Senior Master / Mistress', label: 'Senior Master / Mistress' },
        { value: 'Bursar / Accountant', label: 'Bursar / Accountant' },
        { value: 'School Librarian', label: 'School Librarian' },
      ];

  if (user?.role === 'super_admin') {
    roleOptions.unshift({ value: 'Headmaster / Principal', label: 'Headmaster / Principal' });
  }

  const StaffFormFields = ({ formData, setFormData, isEdit }) => (
    <>
      <div>
        <label className={labelCls}>Full Name *</label>
        <input type="text" required className={inputCls} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
      </div>
      <div>
        <label className={labelCls}>Role / Designation *</label>
        <div className="space-y-2">
          <select
            className={inputCls}
            value={formData.role_title}
            onChange={e => { if (e.target.value) setFormData({...formData, role_title: e.target.value}); }}
          >
            <option value="">Select Role Preset...</option>
            {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <input type="text" placeholder="Or specify custom role title..." className={inputCls} value={formData.role_title} onChange={e => setFormData({...formData, role_title: e.target.value})} />
        </div>
      </div>

      {/* Class assignment - always shown */}
      <div>
        <label className={labelCls}>Class Assignment {isPrimary ? '(Class Teacher)' : '(Optional)'}</label>
        <select className={inputCls} value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})}>
          <option value="">No Class Assignment</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Subject multi-select - SECONDARY ONLY */}
      {!isPrimary && subjects.length > 0 && (
        <div>
          <label className={labelCls}>
            <span className="flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5 text-teal-primary" />
              Subjects Taught (select all that apply)
            </span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-36 overflow-y-auto p-2 border border-line-border/50 rounded-lg bg-paper/50">
            {subjects.map(sub => {
              const isChecked = (formData.subject_ids || []).includes(sub.id);
              return (
                <label key={sub.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sage/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSubject(sub.id, formData, setFormData)}
                    className="rounded border-line-border text-teal-primary focus:ring-teal-primary cursor-pointer"
                  />
                  <span className="text-xs font-medium text-ink">{sub.name}</span>
                  {sub.code && <span className="text-[9px] text-ink/40 font-mono">{sub.code}</span>}
                </label>
              );
            })}
          </div>
          {(formData.subject_ids || []).length > 0 && (
            <p className="text-[10px] text-teal-primary font-semibold mt-1">{(formData.subject_ids || []).length} subject(s) selected</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" className={inputCls} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input type="text" placeholder="+2637..." className={inputCls} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        </div>
      </div>

      {!isEdit && (
        <div className="border-t border-line-border/20 pt-3">
          <p className="text-[10px] text-ink/50 font-sans mb-2">Login Credentials (leave blank to auto-generate)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Username</label>
              <input type="text" placeholder="Auto-generated if blank" className={inputCls} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" placeholder="Default: Password123!" className={inputCls} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="module-page staff-page p-8 max-w-7xl mx-auto space-y-8 font-sans animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Staff Roster</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {isPrimary ? 'Class teachers and administrative staff.' : 'Teaching faculty and administrative staff.'}
          </p>
        </div>
        <div className={`flex items-center space-x-3 transition-opacity ${selectionActive ? 'opacity-30 pointer-events-none' : ''}`}>
          {isPrincipal && (
            <>
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /><span>Export PDF</span>
              </button>
              <button
                onClick={() => openMsgModal('')}
                className="flex items-center space-x-2 px-4 py-2.5 bg-paper hover:bg-sage/10 text-ink border border-line-border/30 font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <Mail className="w-4 h-4 text-teal-primary" /><span>Broadcast</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /><span>Add Staff</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{error}</div>}

      {/* Charts Panel */}
      {staff.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Role Distribution */}
          <div className="glass-card rounded-2xl p-4 border border-line-border/30">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-teal-primary" />
              <h3 className="text-xs font-bold text-ink/70 uppercase tracking-wider">Role Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                  {roleData.map((entry, i) => <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Account Status */}
          <div className="glass-card rounded-2xl p-4 border border-line-border/30">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-teal-primary" />
              <h3 className="text-xs font-bold text-ink/70 uppercase tracking-wider">Account Status</h3>
            </div>
            <div className="space-y-2 mt-4">
              {statusData.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                  <span className="text-xs text-ink/70 flex-1">{s.name}</span>
                  <span className="text-sm font-bold text-ink">{s.value}</span>
                  <div className="w-20 h-1.5 bg-ink/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.value / staff.length) * 100}%`, background: s.fill }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="glass-card rounded-2xl p-4 border border-line-border/30">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-teal-primary" />
              <h3 className="text-xs font-bold text-ink/70 uppercase tracking-wider">Quick Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {[
                { label: 'Total Staff', value: staff.length },
                { label: 'Classes Assigned', value: staff.filter(s => s.class_id).length },
                { label: 'With Email', value: staff.filter(s => s.email).length },
                { label: 'With Phone', value: staff.filter(s => s.phone).length },
              ].map(stat => (
                <div key={stat.label} className="p-2.5 bg-sage/10 rounded-xl text-center">
                  <div className="text-xl font-display font-bold text-teal-primary">{stat.value}</div>
                  <div className="text-[9px] text-ink/50 font-bold uppercase tracking-wider mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection Action Bar */}
      {selectionActive && (
        <div className="bg-ink/95 backdrop-blur-md rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 animate-fadeIn shadow-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <span className="bg-teal-primary text-paper text-[11px] font-bold px-3 py-1 rounded-full font-mono">{selectedIds.length} selected</span>
            <span className="text-paper/70 text-xs font-sans">
              {selectedIds.length === 1
                ? filteredStaff.find(s => s.id === selectedIds[0])?.name
                : `${selectedIds.length} staff members`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length === 1 && (() => {
              const s = filteredStaff.find(m => m.id === selectedIds[0]);
              return s ? (
                <>
                  <button onClick={() => handleViewStaff(s)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-paper text-xs font-semibold rounded-xl transition-all cursor-pointer border border-white/15">
                    <Eye className="w-3.5 h-3.5" /><span>View</span>
                  </button>
                  <button onClick={() => { openEditModal(s); setSelectedIds([]); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-amber-400/20">
                    <Edit3 className="w-3.5 h-3.5" /><span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleStatus(s)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer border ${
                      s.status === 'deactivated'
                        ? 'bg-teal-primary/30 hover:bg-teal-primary/50 text-teal-300 border-teal-400/30'
                        : 'bg-orange-400/20 hover:bg-orange-400/30 text-orange-300 border-orange-400/20'
                    }`}
                  >
                    {s.status === 'deactivated' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    <span>{s.status === 'deactivated' ? 'Activate' : 'Suspend'}</span>
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-red-500/20">
                    <Trash2 className="w-3.5 h-3.5" /><span>Delete</span>
                  </button>
                </>
              ) : null;
            })()}
            {selectedIds.length > 1 && (
              <button onClick={handleBulkDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-red-500/20">
                <Trash2 className="w-3.5 h-3.5" /><span>Delete All ({selectedIds.length})</span>
              </button>
            )}
            <button onClick={() => setSelectedIds([])} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-paper/50 hover:text-paper text-xs font-semibold rounded-xl transition-all cursor-pointer">
              <X className="w-3.5 h-3.5" /><span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Role filter tabs */}
      <div className="flex flex-wrap gap-2 text-xs font-sans">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setRoleFilter(tab.key)}
            className={`px-4 py-2 rounded-xl font-semibold border transition-all cursor-pointer ${
              roleFilter === tab.key
                ? 'bg-teal-primary text-paper border-teal-primary'
                : 'bg-paper text-ink/60 border-line-border hover:border-teal-primary/50'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1.5 text-[9px] font-bold opacity-70">
                ({staff.filter(s => filterByRole(s.role_title, tab.key)).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Staff Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  onChange={() => {
                    if (selectedIds.length === filteredStaff.length && filteredStaff.length > 0) {
                      setSelectedIds([]);
                    } else {
                      setSelectedIds(filteredStaff.map(s => s.id));
                    }
                  }}
                  checked={filteredStaff.length > 0 && selectedIds.length === filteredStaff.length}
                  className="rounded border-line-border text-teal-primary focus:ring-teal-primary cursor-pointer"
                />
              </th>
              <th className="py-4 px-6">Name</th>
              <th className="py-4 px-6">Role / Title</th>
              <th className="py-4 px-6">Email</th>
              <th className="py-4 px-6">Phone</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm text-ink">
            {loading ? (
              <tr><td colSpan="7" className="py-12 text-center text-ink/40 text-xs">Loading staff data...</td></tr>
            ) : filteredStaff.map((s) => {
              const isSelected = selectedIds.includes(s.id);
              return (
                <tr
                  key={s.id}
                  onClick={() => setSelectedIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}
                  className={`transition-colors cursor-pointer ${isSelected ? 'bg-teal-primary/8 border-l-2 border-l-teal-primary' : 'hover:bg-sage/5 border-l-2 border-l-transparent'}`}
                >
                  <td className="py-4 px-4 text-center" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(s.id)}
                      className="rounded border-line-border text-teal-primary focus:ring-teal-primary cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-6 font-bold">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewStaff(s); }}
                      className="text-left text-teal-primary hover:text-teal-dark hover:underline font-bold cursor-pointer transition-colors"
                    >
                      {s.name}
                    </button>
                  </td>
                  <td className="py-4 px-6 text-ink/70">
                    <span className="font-semibold">{s.role_title || 'Teacher'}</span>
                    {s.class_name && <span className="block text-[10px] text-teal-primary font-bold">Class: {s.class_name}</span>}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs text-ink/70">{s.email || '-'}</td>
                  <td className="py-4 px-6 font-mono text-xs">{s.phone || '-'}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s.status === 'deactivated' ? 'bg-brick-critical/10 text-brick-critical' : 'bg-sage/40 text-teal-dark'}`}>
                      {s.status || 'active'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    {isSelected
                      ? <span className="text-[10px] font-semibold text-teal-primary">Selected</span>
                      : <span className="text-[11px] text-ink/25">click row</span>
                    }
                  </td>
                </tr>
              );
            })}
            {filteredStaff.length === 0 && !loading && (
              <tr><td colSpan="7" className="py-8 text-center text-ink/50 text-xs">No staff records match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Messaging Panel */}
      {(isPrincipal || isTeacher) && (
        <div className="glass-card rounded-2xl p-6 space-y-6 border border-line-border/30">
          <div className="flex items-center space-x-2 border-b border-line-border/25 pb-3">
            {isPrincipal ? (
              <><MessageSquare className="w-5 h-5 text-teal-primary" /><h3 className="text-lg font-display font-bold text-ink">Sent Teacher Communications</h3></>
            ) : (
              <><Inbox className="w-5 h-5 text-teal-primary" /><h3 className="text-lg font-display font-bold text-ink">Messages from Principal</h3></>
            )}
          </div>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {messages.map((m) => (
              <div key={m.id} className="p-4 rounded-xl bg-sage/5 border border-line-border/25 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-ink">{m.subject}</h4>
                    <p className="text-[10px] text-ink/50 font-sans mt-0.5">
                      {isPrincipal ? `To: ${m.recipient_name}` : `From: Principal (${m.sender_name})`}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-ink/40">{new Date(m.sent_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-ink/75 leading-relaxed bg-paper p-3 rounded-lg border border-line-border/10 whitespace-pre-line">{m.body}</p>
              </div>
            ))}
            {messages.length === 0 && <div className="text-center py-8 text-ink/40 text-xs">No messages to display.</div>}
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative my-4">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <h3 className="text-xl font-display font-bold text-ink">Add Staff Member</h3>
              <button onClick={() => setShowModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="mx-6 mt-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleAdd} className="space-y-4 text-sm font-sans p-6">
              <StaffFormFields formData={form} setFormData={setForm} isEdit={false} />
              {generatedCreds && (
                <div className="p-3 rounded-lg bg-teal-primary/10 border border-teal-primary/30 text-xs font-sans space-y-1">
                  <p className="font-bold text-teal-primary">Staff added! Share these login credentials:</p>
                  <p>Username: <span className="font-mono font-bold">{generatedCreds.username}</span></p>
                  <p>Password: <span className="font-mono font-bold">{generatedCreds.password}</span></p>
                  <button type="button" onClick={() => { setShowModal(false); setGeneratedCreds(null); }} className="mt-2 px-3 py-1 bg-teal-primary text-paper rounded-lg text-xs font-semibold cursor-pointer">Done</button>
                </div>
              )}
              <div className="pt-4 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer flex items-center space-x-2">
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{formLoading ? 'Adding...' : 'Add Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative my-4">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <h3 className="text-xl font-display font-bold text-ink">Edit Staff Profile</h3>
              <button onClick={() => { setShowEditModal(false); setEditStaff(null); }} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="mx-6 mt-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleEdit} className="space-y-4 text-sm font-sans p-6">
              <StaffFormFields formData={editForm} setFormData={setEditForm} isEdit={true} />
              <div className="pt-4 flex justify-end space-x-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditStaff(null); }} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer flex items-center space-x-2">
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{formLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEND MESSAGE MODAL */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowMsgModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4 flex items-center space-x-2">
              <Send className="w-5 h-5 text-teal-primary" />
              <span>{msgForm.recipient_id ? 'Send Direct Message to Teacher' : 'Broadcast Message to All Teachers'}</span>
            </h3>
            {msgError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{msgError}</div>}
            {msgSuccess && <div className="mb-4 p-3 rounded-lg bg-sage/35 border border-teal-primary/20 text-teal-dark font-semibold text-xs">{msgSuccess}</div>}
            <form onSubmit={handleSendMessage} className="space-y-4 text-sm font-sans">
              {msgForm.recipient_id ? (
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Recipient</label>
                  <input type="text" disabled className="w-full px-3 py-2 bg-sage/10 border border-line-border rounded-lg text-xs" value={staff.find(s => s.id === msgForm.recipient_id)?.name || ''} />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-teal-primary mb-1">Recipient Group</label>
                  <input type="text" disabled className="w-full px-3 py-2 bg-teal-primary/5 border border-teal-primary/20 text-teal-primary font-bold rounded-lg text-xs" value="All Teachers (Broadcast Alert)" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Subject / Header *</label>
                <input type="text" required placeholder="e.g. End of Term Staff Briefing" className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs font-semibold" value={msgForm.subject} onChange={e => setMsgForm({...msgForm, subject: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Message Body *</label>
                <textarea required rows={5} placeholder="Write your message here..." className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={msgForm.body} onChange={e => setMsgForm({...msgForm, body: e.target.value})} />
              </div>
              <div className="pt-4 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowMsgModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold text-ink/75 hover:bg-sage/10 cursor-pointer">Cancel</button>
                <button type="submit" disabled={msgLoading} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-xs font-semibold shadow-md cursor-pointer flex items-center space-x-2">
                  {msgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{msgForm.recipient_id ? 'Send Message' : 'Send Broadcast'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PrintReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="FACULTY & STAFF DIRECTORY REPORT"
        subtitle={`Official School Staff Roster - ${staff.length} Active Members`}
        schoolName="SchoolBase Academic Portal"
        summaryCards={reportKpis}
        columns={reportColumns}
        data={staff}
        userRole={user?.role === 'super_admin' ? 'Super Admin' : 'School Admin'}
      />

      {/* Staff Profile Detail Panel */}
      {viewStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm" onClick={() => setViewStaff(null)}>
          <div className="w-full max-w-md h-full bg-paper shadow-2xl overflow-y-auto animate-slideInRight" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-teal-primary to-teal-dark p-6 text-paper flex items-start justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-display font-bold mb-3">
                  {viewStaff.name?.charAt(0) || '?'}
                </div>
                <h3 className="text-xl font-display font-bold">{viewStaff.name}</h3>
                <p className="text-paper/70 text-sm mt-0.5">{viewStaff.role_title || 'Teacher'}</p>
                <span className={`mt-2 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${viewStaff.status === 'deactivated' ? 'bg-brick-critical/40 text-white' : 'bg-white/20 text-paper'}`}>
                  {viewStaff.status || 'Active'}
                </span>
              </div>
              <button onClick={() => setViewStaff(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {viewStaffLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-primary" /></div>
              ) : viewStaffProfile ? (
                <>
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Contact Information</h4>
                    <div className="space-y-2">
                      {viewStaff.email && (
                        <div className="flex items-center space-x-3 p-3 bg-sage/10 rounded-xl border border-line-border/25">
                          <AtSign className="w-4 h-4 text-teal-primary flex-shrink-0" />
                          <span className="text-xs font-mono text-ink">{viewStaff.email}</span>
                        </div>
                      )}
                      {viewStaff.phone && (
                        <div className="flex items-center space-x-3 p-3 bg-sage/10 rounded-xl border border-line-border/25">
                          <Phone className="w-4 h-4 text-teal-primary flex-shrink-0" />
                          <span className="text-xs font-mono text-ink">{viewStaff.phone}</span>
                        </div>
                      )}
                      {viewStaff.class_name && (
                        <div className="flex items-center space-x-3 p-3 bg-teal-primary/5 rounded-xl border border-teal-primary/20">
                          <BookOpen className="w-4 h-4 text-teal-primary flex-shrink-0" />
                          <div>
                            <span className="text-[10px] font-bold text-teal-primary block uppercase tracking-wider">Class Teacher</span>
                            <span className="text-xs font-bold text-ink">{viewStaff.class_name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {viewStaffProfile.staff?.username && isPrincipal && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Login Account</h4>
                      <div className="p-3 bg-ink/5 rounded-xl border border-line-border/25 font-mono text-xs space-y-1">
                        <div><span className="text-ink/50">Username: </span><span className="font-bold text-ink">{viewStaffProfile.staff.username}</span></div>
                        <div><span className="text-ink/50">Account: </span>
                          <span className={`font-bold ${viewStaffProfile.staff.account_status === 'active' ? 'text-teal-primary' : 'text-brick-critical'}`}>
                            {viewStaffProfile.staff.account_status || 'active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {viewStaffProfile.assignments?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Teaching Assignments ({viewStaffProfile.assignments.length})</h4>
                      <div className="space-y-1.5">
                        {viewStaffProfile.assignments.map((a, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-sage/5 rounded-lg border border-line-border/20 text-xs">
                            <span className="font-bold text-ink">{a.subject_name}</span>
                            <span className="text-ink/50 font-semibold">{a.class_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isPrincipal && (
                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => { setViewStaff(null); openMsgModal(viewStaff.id); }}
                        className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5" /><span>Send Message</span>
                      </button>
                      <button
                        onClick={() => { setViewStaff(null); openEditModal(viewStaff); }}
                        className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-amber-warning/20 hover:bg-amber-warning/30 text-amber-dark text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /><span>Edit Profile</span>
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
