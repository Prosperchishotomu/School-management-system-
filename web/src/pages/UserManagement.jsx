import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Users, Plus, X, Loader2, Shield, Trash2, KeyRound, AlertTriangle } from 'lucide-react';

const ROLE_STYLES = {
  school_admin: 'bg-purple-100 text-purple-700',
  teacher:      'bg-teal-100 text-teal-700',
  parent:       'bg-amber-100 text-amber-700',
  super_admin:  'bg-red-100 text-red-700',
};

const UserManagement = () => {
  const { activeSchoolId, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    username: '', email: '', password: '', role: 'teacher',
    name: '', phone: '', class_id: '', student_id: '', relation: 'Father'
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Password reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser]           = useState(null);
  const [resetPassword, setResetPassword]   = useState('');
  const [resetLoading, setResetLoading]     = useState(false);
  const [resetError, setResetError]         = useState('');
  const [resetSuccess, setResetSuccess]     = useState('');

  const fetchUsers = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/users?role=${roleFilter}`)
      .then(res => { setUsers(res.data || []); setError(''); })
      .catch(() => { setUsers([]); setError('Could not load users.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [activeSchoolId, roleFilter]);

  // Fetch support data for class/student selectors
  useEffect(() => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}/classes`)
      .then(res => setClasses(res.data || []))
      .catch(() => {});
    
    // Fetch students list (simplified, no pagination, for link dropdown)
    api.get(`/schools/${activeSchoolId}/students?per_page=1000`)
      .then(res => setStudents(res.data || []))
      .catch(() => {});
  }, [activeSchoolId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post(`/schools/${activeSchoolId}/users`, form);
      setShowModal(false);
      setForm({
        username: '', email: '', password: '', role: 'teacher',
        name: '', phone: '', class_id: '', student_id: '', relation: 'Father'
      });
      fetchUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to create user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user account? They will not be able to log in.')) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/users/${id}`);
      fetchUsers();
    } catch {}
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError(''); setResetSuccess('');
    if (resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }
    setResetLoading(true);
    try {
      await api.post(`/schools/${activeSchoolId}/users/${resetUser.id}/reset-password`, {
        password: resetPassword
      });
      setResetSuccess('Password reset successfully!');
      setResetPassword('');
      setTimeout(() => { setShowResetModal(false); setResetSuccess(''); }, 1500);
    } catch (err) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <AlertTriangle className="w-16 h-16 text-amber-warning mb-4" />
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 font-sans text-sm">Select a school from the sidebar switcher to manage its user profiles.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">User &amp; Role Management</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Manage logins, roles, and profiles for school accounts.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /><span>Add User</span>
        </button>
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{error}</div>}

      {/* Role filter chips */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-2">
        {['', 'super_admin', 'school_admin', 'teacher', 'parent'].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-semibold transition-all cursor-pointer ${roleFilter === r ? 'bg-teal-primary text-paper shadow' : 'bg-ink/5 text-ink/60 hover:bg-ink/10'}`}>
            {r === '' ? 'All Roles' : r.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-6">Name</th>
              <th className="py-4 px-6">Username</th>
              <th className="py-4 px-6">Contact Email / Phone</th>
              <th className="py-4 px-6 text-center">Role</th>
              <th className="py-4 px-6 text-center">Status</th>
              <th className="py-4 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
            {loading ? (
              <tr><td colSpan="6" className="py-12 text-center text-xs text-ink/40">Loading users...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-sage/5 transition-colors">
                <td className="py-4 px-6 font-bold">{u.name}</td>
                <td className="py-4 px-6 font-mono text-xs text-ink/70">{u.username}</td>
                <td className="py-4 px-6">
                  <div className="flex flex-col text-xs font-mono">
                    <span className="text-ink/80">{u.email || '—'}</span>
                    <span className="text-ink/40">{u.phone || '—'}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${ROLE_STYLES[u.role] || 'bg-ink/10 text-ink'}`}>
                    <Shield className="w-2.5 h-2.5" />
                    <span className="capitalize">{u.role?.replace('_', ' ')}</span>
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${u.is_active ? 'bg-sage/35 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex justify-end items-center space-x-3">
                    {u.is_active && (
                      <button
                        onClick={() => { setResetUser(u); setShowResetModal(true); setResetError(''); setResetSuccess(''); }}
                        className="text-ink/30 hover:text-teal-primary transition-colors cursor-pointer"
                        title="Reset User Password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                    )}
                    {u.is_active && (u.role !== 'school_admin' || user?.role === 'super_admin') && u.id !== user?.id && (
                      <button onClick={() => handleDeactivate(u.id)} className="text-ink/30 hover:text-brick-critical transition-colors cursor-pointer" title="Deactivate user">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr><td colSpan="6" className="py-8 text-center text-ink/50 text-xs">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Add New User</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 text-brick-critical text-xs">{formError}</div>}
            
            <form onSubmit={handleCreate} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Full Name *</label>
                <input required type="text" placeholder="e.g. John Doe" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Username *</label>
                  <input required type="text" placeholder="e.g. jdoe" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Role *</label>
                  <select required className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="teacher">Teacher</option>
                    <option value="parent">Parent / Guardian</option>
                    <option value="school_admin">School Admin</option>
                    {user?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Email *</label>
                  <input required type="email" placeholder="e.g. jdoe@school.com" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Phone Number *</label>
                  <input required type="text" placeholder="e.g. +26377000000" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>

              {/* Teacher fields */}
              {form.role === 'teacher' && (
                <div>
                  <label className="block text-xs font-semibold text-brick-critical mb-1">Assigned Class * (Mandatory)</label>
                  <select required className="w-full px-3 py-2 border border-brick-critical/40 bg-brick-critical/5 rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})}>
                    <option value="">Select Class...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Parent fields */}
              {form.role === 'parent' && (
                <div className="space-y-4 p-3 rounded-lg bg-amber-warning/5 border border-amber-warning/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink/70 mb-1">Relation to Student *</label>
                      <select required className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none" value={form.relation} onChange={e => setForm({...form, relation: e.target.value})}>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Guardian</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink/70 mb-1">Link to Student *</label>
                      <select required className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none" value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})}>
                        <option value="">Select Child...</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Initial Password *</label>
                <input required type="password" minLength={8} className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                <p className="text-[10px] text-ink/40 mt-1">Min 8 characters. User should change this on first login.</p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer font-sans">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2 font-sans">
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create User</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowResetModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4 flex items-center space-x-1.5">
              <KeyRound className="w-4 h-4 text-teal-primary" />
              <span>Reset User Password</span>
            </h3>
            <p className="text-xs text-ink/65 mb-4 font-sans">Set a new secure password for user: <b>{resetUser?.username}</b></p>
            
            {resetError && <div className="mb-4 p-2.5 bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs rounded-lg">{resetError}</div>}
            {resetSuccess && <div className="mb-4 p-2.5 bg-sage/35 border border-teal-primary/20 text-teal-dark font-semibold text-xs rounded-lg">{resetSuccess}</div>}

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">New Password *</label>
                <input required type="password" minLength={8} placeholder="Minimum 8 characters" className="w-full px-3 py-2 border border-line-border rounded-lg text-xs focus:outline-none focus:border-teal-primary" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowResetModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={resetLoading} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2">
                  {resetLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Change Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;