import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { UserCheck, Plus, X, Loader2, Mail, Send, MessageSquare, Inbox, Edit3, Trash2, Printer, Eye, BookOpen, Phone, AtSign, Ban, CheckCircle2 } from 'lucide-react';

import PrintReportModal from '../components/PrintReportModal';

const Staff = () => {
  const { activeSchoolId, user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role_title: '', class_id: '', username: '', password: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [generatedCreds, setGeneratedCreds] = useState(null);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Bulk selection & PDF Modal states
  const [selectedIds, setSelectedIds] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);

  // Edit Staff state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role_title: '', class_id: '' });
  const [classes, setClasses] = useState([]);

  // Messaging state
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ recipient_id: '', subject: '', body: '' });
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [msgSuccess, setMsgSuccess] = useState('');

  // Staff detail view state
  const [viewStaff, setViewStaff] = useState(null);
  const [viewStaffProfile, setViewStaffProfile] = useState(null);
  const [viewStaffLoading, setViewStaffLoading] = useState(false);

  const handleViewStaff = async (s) => {
    setViewStaff(s);
    setViewStaffProfile(null);
    setViewStaffLoading(true);
    try {
      const res = await api.get(`/schools/${activeSchoolId}/staff/${s.id}`);
      setViewStaffProfile(res.data);
    } catch(e) {
      setViewStaffProfile({ staff: s, assignments: [], messages: [] });
    } finally {
      setViewStaffLoading(false);
    }
  };

  const isPrincipal = ['school_admin', 'super_admin'].includes(user?.role);
  const isTeacher = user?.role === 'teacher';

  const handleToggleStatus = async (staffMember) => {
    const nextStatus = staffMember.status === 'deactivated' ? 'active' : 'deactivated';
    try {
      await api.patch(`/schools/${activeSchoolId}/staff/${staffMember.id}`, {
        name: staffMember.name,
        email: staffMember.email,
        phone: staffMember.phone,
        role_title: staffMember.role_title,
        class_id: staffMember.class_id,
        status: nextStatus
      });
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to update staff status.');
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
  }, [activeSchoolId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setGeneratedCreds(null);
    try {
      const res = await api.post(`/schools/${activeSchoolId}/staff`, form);
      const data = res.data;
      // Show generated credentials if backend auto-generated them
      if (data?.generated_password) {
        setGeneratedCreds({ username: data.generated_username, password: data.generated_password });
      } else {
        setShowModal(false);
      }
      setForm({ name: '', email: '', phone: '', role_title: '', class_id: '', username: '', password: '' });
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
      class_id: s.class_id || ''
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.patch(`/schools/${activeSchoolId}/staff/${editStaff.id}`, editForm);
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
    if (!window.confirm('Are you sure you want to delete this staff member? This will also revoke their login account.')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/staff/${staffId}`);
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to delete staff member.');
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

  // Role filtering helper
  const filterByRole = (roleTitle, filterKey) => {
    if (!roleTitle) return filterKey === 'support';
    const t = roleTitle.toLowerCase();
    switch (filterKey) {
      case 'senior': return t.includes('senior') || t.includes('head of') || t.includes('hod');
      case 'hod':    return t.includes('head of') || t.includes('hod') || t.includes('department');
      case 'admin':  return t.includes('principal') || t.includes('headmaster') || t.includes('headmistress') || t.includes('deputy head') || t.includes('vice principal') || t.includes('bursar') || t.includes('librarian');
      case 'support': return t.includes('support') || t.includes('cleaner') || t.includes('security') || t.includes('driver') || t.includes('cook') || t.includes('catering');
      default:       return true;
    }
  };

  const filteredStaff = roleFilter === 'all'
    ? staff
    : staff.filter(s => filterByRole(s.role_title, roleFilter));

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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(staff.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteStaff = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently remove ${selectedIds.length} staff records and their associated login accounts?`)) return;
    try {
      await api.post(`/schools/${activeSchoolId}/staff/bulk-delete`, { staff_ids: selectedIds });
      setSelectedIds([]);
      fetchStaff();
    } catch (err) {
      alert(err.message || 'Failed to bulk delete staff records.');
    }
  };

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
    { label: 'Active Teachers', value: staff.filter(s => !s.status || s.status === 'active').length },
    { label: 'Deactivated Accounts', value: staff.filter(s => s.status === 'deactivated').length },
    { label: 'Classes Assigned', value: staff.filter(s => s.class_id).length }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Staff Roster</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">All teaching and administrative staff assigned to this school.</p>
        </div>
        <div className="flex items-center space-x-3">
          {isPrincipal && (
            <>
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Export PDF Report</span>
              </button>
              <button
                onClick={() => openMsgModal('')}
                className="flex items-center space-x-2 px-4 py-2.5 bg-paper hover:bg-sage/10 text-ink border border-line-border/30 font-sans font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <Mail className="w-4 h-4 text-teal-primary" /><span>Broadcast Message</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /><span>Add Staff</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans">{error}</div>}

      {/* Bulk Action Bar */}
      {isPrincipal && selectedIds.length > 0 && (
        <div className="bg-amber-warning/15 border border-amber-warning/30 rounded-2xl p-4 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-3 text-xs font-bold text-ink">
            <span className="bg-amber-warning/20 text-amber-dark px-3 py-1 rounded-full font-mono">{selectedIds.length} Selected</span>
            <span>Bulk Action: Remove selected faculty records and login user accounts.</span>
          </div>
          <button
            onClick={handleBulkDeleteStaff}
            className="flex items-center space-x-1.5 px-4 py-2 bg-brick-critical hover:bg-brick-critical/90 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Selected ({selectedIds.length})</span>
          </button>
        </div>
      )}

      {/* Role filter tabs */}
      <div className="flex flex-wrap gap-2 text-xs font-sans">
        {[
          { key: 'all',    label: 'All Staff' },
          { key: 'senior', label: 'Senior Teachers' },
          { key: 'hod',    label: 'Heads of Dept.' },
          { key: 'admin',  label: 'Administration' },
          { key: 'support',label: 'Support Staff' },
        ].map(tab => (
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

      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-6">Name</th>
              <th className="py-4 px-6">Role / Title</th>
              <th className="py-4 px-6">Email</th>
              <th className="py-4 px-6">Phone</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
            {loading ? (
              <tr><td colSpan="6" className="py-12 text-center text-ink/40 text-xs">Loading staff data...</td></tr>
            ) : filteredStaff.map((s) => (
              <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                <td className="py-4 px-6 font-bold">
                  <button
                    onClick={() => handleViewStaff(s)}
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
                <td className="py-4 px-6 font-mono text-xs numeric-data">{s.phone || '-'}</td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    s.status === 'deactivated' ? 'bg-brick-critical/10 text-brick-critical' : 'bg-sage/40 text-teal-dark'
                  }`}>
                    {s.status || 'active'}
                  </span>
                </td>
                <td className="py-4 px-6 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleViewStaff(s)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#e8f4f3] hover:bg-teal-primary/20 text-[#1b5e58] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border border-teal-primary/20"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => openEditModal(s)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#fdf6e7] hover:bg-amber-warning/25 text-[#925f0e] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border border-amber-warning/30"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleToggleStatus(s)}
                      title={s.status === 'deactivated' ? 'Activate Staff Member' : 'Suspend/Deactivate Staff Member'}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border ${
                        s.status === 'deactivated'
                          ? 'bg-teal-primary/15 text-teal-dark hover:bg-teal-primary/25 border-teal-primary/30'
                          : 'bg-[#fdf0e6] text-[#a84b00] hover:bg-orange-500/25 border-orange-500/30'
                      }`}
                    >
                      {s.status === 'deactivated' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      <span>{s.status === 'deactivated' ? 'Activate' : 'Suspend'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#fbeae8] hover:bg-brick-critical/20 text-[#9b2c2c] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs border border-brick-critical/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredStaff.length === 0 && !loading && (
              <tr><td colSpan="6" className="py-8 text-center text-ink/50 text-xs">No staff records match this filter.</td></tr>
            )}
          </tbody>
        </table>

      </div>

      {/* Messaging Panel at the bottom */}
      {(isPrincipal || isTeacher) && (
        <div className="glass-card rounded-2xl p-6 space-y-6 border border-line-border/30">
          <div className="flex items-center space-x-2 border-b border-line-border/25 pb-3">
            {isPrincipal ? (
              <>
                <MessageSquare className="w-5 h-5 text-teal-primary" />
                <h3 className="text-lg font-display font-bold text-ink">Sent Teacher Communications</h3>
              </>
            ) : (
              <>
                <Inbox className="w-5 h-5 text-teal-primary" />
                <h3 className="text-lg font-display font-bold text-ink">Messages from Principal</h3>
              </>
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
                <p className="text-xs font-sans text-ink/75 leading-relaxed bg-paper p-3 rounded-lg border border-line-border/10 whitespace-pre-line">{m.body}</p>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center py-8 text-ink/40 text-xs font-sans">No messages to display.</div>
            )}
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative my-4">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <h3 className="text-xl font-display font-bold text-ink">Add Staff Member</h3>
              <button onClick={() => setShowModal(false)} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="mx-6 mt-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleAdd} className="space-y-4 text-sm font-sans p-6">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Full Name *</label>
                <input type="text" required className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Role / Designation *</label>
                <div className="space-y-2">
                  <select
                    className="w-full px-3 py-2 border border-line-border rounded-lg bg-paper focus:outline-none focus:border-teal-primary text-xs"
                    onChange={e => {
                      if (e.target.value) setForm({...form, role_title: e.target.value});
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Administrative Preset...</option>
                    <option value="Headmaster / Principal">Headmaster / Principal</option>
                    <option value="Deputy Head / Vice Principal">Deputy Head / Vice Principal</option>
                    <option value="Form Master / Mistress">Form Master / Mistress</option>
                    <option value="Class Teacher">Class Teacher</option>
                    <option value="Subject Teacher">Subject Teacher</option>
                    <option value="Senior Master / Mistress">Senior Master / Mistress</option>
                    <option value="Bursar / Accountant">Bursar / Accountant</option>
                    <option value="School Librarian">School Librarian</option>
                  </select>
                  <input type="text" placeholder="Or specify custom role title..." className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.role_title} onChange={e => setForm({...form, role_title: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Class Assignment (If Teacher)</label>
                <select 
                  className="w-full px-3 py-2 border border-line-border rounded-lg bg-paper focus:outline-none focus:border-teal-primary text-xs" 
                  value={form.class_id} 
                  onChange={e => setForm({...form, class_id: e.target.value})}
                >
                  <option value="">No Class Assignment</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Email</label>
                  <input type="email" className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Phone</label>
                  <input type="text" placeholder="+2637..." className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>
              <div className="border-t border-line-border/20 pt-3">
                <p className="text-[10px] text-ink/50 font-sans mb-2">Login Credentials (leave blank to auto-generate)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Username</label>
                    <input type="text" placeholder="Auto-generated if blank" className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Password</label>
                    <input type="password" placeholder="Default: Password123!" className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                  </div>
                </div>
              </div>
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

      {/* Edit Staff Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 relative my-4">
            <div className="flex items-center justify-between p-6 border-b border-line-border/30">
              <h3 className="text-xl font-display font-bold text-ink">Edit Staff Profile</h3>
              <button onClick={() => { setShowEditModal(false); setEditStaff(null); }} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="mx-6 mt-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleEdit} className="space-y-4 text-sm font-sans p-6">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Full Name *</label>
                <input type="text" required className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Role / Designation *</label>
                <div className="space-y-2">
                  <select
                    className="w-full px-3 py-2 border border-line-border rounded-lg bg-paper focus:outline-none focus:border-teal-primary text-xs"
                    onChange={e => {
                      if (e.target.value) setEditForm({...editForm, role_title: e.target.value});
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Administrative Preset...</option>
                    <option value="Headmaster / Principal">Headmaster / Principal</option>
                    <option value="Deputy Head / Vice Principal">Deputy Head / Vice Principal</option>
                    <option value="Form Master / Mistress">Form Master / Mistress</option>
                    <option value="Class Teacher">Class Teacher</option>
                    <option value="Subject Teacher">Subject Teacher</option>
                    <option value="Senior Master / Mistress">Senior Master / Mistress</option>
                    <option value="Bursar / Accountant">Bursar / Accountant</option>
                    <option value="School Librarian">School Librarian</option>
                  </select>
                  <input type="text" placeholder="Or specify custom role title..." className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={editForm.role_title} onChange={e => setEditForm({...editForm, role_title: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Class Assignment</label>
                <select 
                  className="w-full px-3 py-2 border border-line-border rounded-lg bg-paper focus:outline-none focus:border-teal-primary text-xs" 
                  value={editForm.class_id} 
                  onChange={e => setEditForm({...editForm, class_id: e.target.value})}
                >
                  <option value="">No Class Assignment</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Email</label>
                  <input type="email" className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Phone</label>
                  <input type="text" placeholder="+2637..." className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
              </div>
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

      {/* Send Message Modal */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowMsgModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer">
              <X className="w-5 h-5" />
            </button>
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

      {/* Print / PDF Report Modal */}
      <PrintReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="FACULTY & STAFF DIRECTORY REPORT"
        subtitle={`Official School Staff Roster • ${staff.length} Active Members`}
        schoolName="SchoolBase Academic Portal"
        summaryCards={reportKpis}
        columns={reportColumns}
        data={staff}
        userRole={user?.role === 'super_admin' ? 'Super Admin' : 'School Admin'}
      />

      {/* Staff Profile Detail Modal */}
      {viewStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm" onClick={() => setViewStaff(null)}>
          <div
            className="w-full max-w-md h-full bg-paper shadow-2xl overflow-y-auto animate-slideInRight"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-gradient-to-br from-teal-primary to-teal-dark p-6 text-paper flex items-start justify-between">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-display font-bold mb-3">
                  {viewStaff.name?.charAt(0) || '?'}
                </div>
                <h3 className="text-xl font-display font-bold">{viewStaff.name}</h3>
                <p className="text-paper/70 text-sm mt-0.5">{viewStaff.role_title || 'Teacher'}</p>
                <span className={`mt-2 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  viewStaff.status === 'deactivated' ? 'bg-brick-critical/40 text-white' : 'bg-white/20 text-paper'
                }`}>
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
                  {/* Contact Info */}
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

                  {/* Account credentials */}
                  {viewStaffProfile.staff?.username && isPrincipal && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Login Account</h4>
                      <div className="p-3 bg-ink/5 rounded-xl border border-line-border/25 font-mono text-xs space-y-1">
                        <div><span className="text-ink/50">Username: </span><span className="font-bold text-ink">{viewStaffProfile.staff.username}</span></div>
                        <div><span className="text-ink/50">Role: </span><span className="font-bold text-ink capitalize">{viewStaffProfile.staff.user_role || 'teacher'}</span></div>
                        <div><span className="text-ink/50">Account: </span>
                          <span className={`font-bold ${viewStaffProfile.staff.account_status === 'active' ? 'text-teal-primary' : 'text-brick-critical'}`}>
                            {viewStaffProfile.staff.account_status || 'active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Teaching assignments */}
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

                  {/* Recent messages */}
                  {viewStaffProfile.messages?.length > 0 && isPrincipal && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-ink/40 uppercase tracking-wider">Recent Communications ({viewStaffProfile.messages.length})</h4>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {viewStaffProfile.messages.map((m, i) => (
                          <div key={i} className="p-2.5 bg-sage/5 rounded-lg border border-line-border/20 text-xs">
                            <p className="font-bold text-ink">{m.subject}</p>
                            <p className="text-ink/60 mt-0.5 line-clamp-2">{m.body}</p>
                            <p className="text-ink/30 mt-1">{m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  {isPrincipal && (
                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => { setViewStaff(null); openMsgModal(viewStaff.id); }}
                        className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send Message</span>
                      </button>
                      <button
                        onClick={() => { setViewStaff(null); openEditModal(viewStaff); }}
                        className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-amber-warning/20 hover:bg-amber-warning/30 text-amber-dark text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Profile</span>
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