import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { UserCheck, Plus, X, Loader2, Mail, Send, MessageSquare, Inbox } from 'lucide-react';

const Staff = () => {
  const { activeSchoolId, user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role_title: '', class_id: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');

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

  const isPrincipal = user?.role === 'school_admin';
  const isTeacher = user?.role === 'teacher';

  const fetchStaff = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/staff`)
      .then(res => { setStaff(res.data || []); setError(''); })
      .catch(() => setError('Failed to load staff roster.'))
      .finally(() => setLoading(false));
  };

  const fetchClasses = () => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}/classes`)
      .then(res => { setClasses(res.data || []); })
      .catch(() => {});
  };

  const fetchMessages = () => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}/teacher-messages`)
      .then(res => { setMessages(res.data || []); })
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
    try {
      await api.post(`/schools/${activeSchoolId}/staff`, form);
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', role_title: '', class_id: '' });
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
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

      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
              <th className="py-4 px-6">Name</th>
              <th className="py-4 px-6">Role / Title</th>
              <th className="py-4 px-6">Email</th>
              <th className="py-4 px-6">Phone</th>
              {isPrincipal && <th className="py-4 px-6 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
            {loading ? (
              <tr><td colSpan={isPrincipal ? "5" : "4"} className="py-12 text-center text-ink/40 text-xs">Loading staff data...</td></tr>
            ) : staff.map((s) => (
              <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                <td className="py-4 px-6 font-bold">{s.name}</td>
                <td className="py-4 px-6 text-ink/70">{s.role_title || '—'}</td>
                <td className="py-4 px-6 font-mono text-xs text-ink/70">{s.email || '—'}</td>
                <td className="py-4 px-6 font-mono text-xs numeric-data">{s.phone || '—'}</td>
                {isPrincipal && (
                  <td className="py-4 px-6 text-right">
                    <div className="inline-flex items-center space-x-2 justify-end">
                      {s.role_title?.toLowerCase().includes('teacher') && (
                        <button
                          onClick={() => openMsgModal(s.id)}
                          className="p-1.5 hover:bg-teal-primary/10 text-teal-primary rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1"
                          title={`Send message to ${s.name}`}
                        >
                          <Mail className="w-4 h-4" />
                          <span className="text-[10px] font-semibold">Message</span>
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1.5 hover:bg-amber-warning/10 text-amber-warning rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1"
                        title="Edit Staff Member"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 hover:bg-brick-critical/10 text-brick-critical rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1"
                        title="Delete Staff Member"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Delete</span>
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {staff.length === 0 && !loading && (
              <tr><td colSpan={isPrincipal ? "5" : "4"} className="py-8 text-center text-ink/50 text-xs">No staff records added yet.</td></tr>
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
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Add Staff Member</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleAdd} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Full Name *</label>
                <input type="text" required className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Role / Title</label>
                <input type="text" placeholder="e.g. Grade 1 Class Teacher" className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={form.role_title} onChange={e => setForm({...form, role_title: e.target.value})} />
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
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => { setShowEditModal(false); setEditStaff(null); }} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-display font-bold text-ink border-b border-line-border/30 pb-3 mb-4">Edit Staff Profile</h3>
            {formError && <div className="mb-4 p-3 rounded-lg bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{formError}</div>}
            <form onSubmit={handleEdit} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Full Name *</label>
                <input type="text" required className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Role / Title</label>
                <input type="text" placeholder="e.g. Grade 1 Class Teacher" className="w-full px-3 py-2 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary text-xs" value={editForm.role_title} onChange={e => setEditForm({...editForm, role_title: e.target.value})} />
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
    </div>
  );
};

export default Staff;