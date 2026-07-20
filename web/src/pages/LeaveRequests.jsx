import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar, Clipboard, FileText, CheckCircle2, XCircle, Plus,
  AlertTriangle, Loader2, Sparkles, UserCheck, MessageSquare, Check, X
} from 'lucide-react';

const LeaveRequests = () => {
  const { user, activeSchoolId } = useAuth();
  
  const [requests, setRequests] = useState([]);
  const [children, setChildren] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Create Request Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    student_id: '',
    request_type: 'student_absence',
    hostel_name: 'Falcon House',
    start_date: '',
    end_date: '',
    reason: ''
  });

  // Review Modal State
  const [reviewRequest, setReviewRequest] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchData = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.get(`/schools/${activeSchoolId}/leave-requests`);
      setRequests(res.data || []);

      if (user?.role === 'parent') {
        const childRes = await api.get(`/schools/${activeSchoolId}/students`);
        const list = childRes.data?.data || childRes.data || [];
        setChildren(list);
        if (list.length > 0) {
          setForm(prev => ({ ...prev, student_id: list[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to fetch leave requests ledger.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSchoolId]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.start_date || !form.end_date || !form.reason.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const reqType = user?.role === 'parent' ? form.request_type : 'staff_leave';
      const payload = {
        request_type: reqType,
        student_id: user?.role === 'parent' ? form.student_id : null,
        hostel_name: reqType === 'exeat_pass' ? form.hostel_name : null,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason
      };

      const res = await api.post(`/schools/${activeSchoolId}/leave-requests`, payload);
      if (res.data) {
        setMessage({ type: 'success', text: 'Absence/Leave request submitted successfully.' });
        setShowCreateModal(false);
        setForm(prev => ({ ...prev, reason: '', start_date: '', end_date: '', request_type: 'student_absence', hostel_name: 'Falcon House' }));
        fetchData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit leave request.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (status) => {
    if (!reviewRequest) return;
    setReviewing(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post(`/schools/${activeSchoolId}/leave-requests/${reviewRequest.id}/review`, {
        status,
        reviewer_comment: reviewComment
      });
      setMessage({ type: 'success', text: `Request #${reviewRequest.id} has been marked as ${status}.` });
      setReviewRequest(null);
      setReviewComment('');
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit review decision.' });
    } finally {
      setReviewing(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'approved') return 'bg-sage/45 text-teal-dark border border-teal-primary/20';
    if (status === 'rejected') return 'bg-brick-critical/15 text-brick-critical border border-brick-critical/20';
    return 'bg-amber-warning/15 text-amber-warning border border-amber-warning/20';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Absences & Leave Requests</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {user?.role === 'parent' ? 'Notify the school of student sick leaves or family emergencies.' :
             user?.role === 'teacher' ? 'Apply for personal leave or check active notifications.' :
             'Review and manage staff leaves and pupil absence requests.'}
          </p>
        </div>

        {/* Submit Request Button */}
        {(user?.role === 'parent' || user?.role === 'teacher') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{user?.role === 'parent' ? 'Notify Pupil Absence' : 'Apply for Leave'}</span>
          </button>
        )}
      </div>

      {/* Global Alerts */}
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
        <div className="glass-panel border border-line-border/30 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans text-ink">
              <thead>
                <tr className="bg-sage/10 border-b border-line-border/30 text-ink/65 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-5">ID</th>
                  <th className="py-3.5 px-5">Request Type</th>
                  <th className="py-3.5 px-5">Target Name</th>
                  <th className="py-3.5 px-5">Duration Dates</th>
                  <th className="py-3.5 px-5">Reason</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  {(user?.role === 'school_admin' || user?.role === 'super_admin') && <th className="py-3.5 px-5 text-right pr-6">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/20">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-sage/5 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-ink/50">{r.id}</td>
                    <td className="py-3.5 px-5 capitalize font-semibold text-teal-dark">
                      {r.request_type.replace('_', ' ')}
                      {r.hostel_name && <span className="text-[10px] text-ink/50 font-normal block font-sans">({r.hostel_name})</span>}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-ink">
                      {r.request_type === 'student_absence' 
                        ? `${r.first_name || ''} ${r.last_name || 'Pupil'}` 
                        : (r.staff_name || 'Teacher')}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-ink/75">
                      {r.start_date} to {r.end_date}
                    </td>
                    <td className="py-3.5 px-5 max-w-xs truncate text-ink/80" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    {(user?.role === 'school_admin' || user?.role === 'super_admin') && (
                      <td className="py-3.5 px-5 text-right pr-6">
                        {r.status === 'pending' ? (
                          <button
                            onClick={() => setReviewRequest(r)}
                            className="px-2.5 py-1 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-dark font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-[10px] text-ink/40 font-semibold italic">Reviewed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink/40">
                      No absence or leave requests recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6 relative animate-scaleUp">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="mb-6 flex items-center space-x-2 text-teal-primary">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-lg font-display font-bold text-ink">
                {user?.role === 'parent' ? 'Notify Pupil Absence' : 'Apply for Personal Leave'}
              </h3>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {user?.role === 'parent' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Select Child</label>
                      <select
                        className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                        value={form.student_id}
                        onChange={e => setForm({ ...form, student_id: e.target.value })}
                      >
                        {children.map(c => (
                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Request Type</label>
                      <select
                        className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                        value={form.request_type}
                        onChange={e => setForm({ ...form, request_type: e.target.value })}
                      >
                        <option value="student_absence">Day Absence</option>
                        <option value="exeat_pass">Boarding Exeat</option>
                      </select>
                    </div>
                  </div>

                  {form.request_type === 'exeat_pass' && (
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Student Hostel / Dorm *</label>
                      <select
                        className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                        value={form.hostel_name}
                        onChange={e => setForm({ ...form, hostel_name: e.target.value })}
                      >
                        <option value="Falcon House">Falcon House</option>
                        <option value="Peterhouse Hostel">Peterhouse Hostel</option>
                        <option value="Arundel Dorm">Arundel Dorm</option>
                        <option value="Charter House">Charter House</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full glass-input rounded-xl text-xs font-mono"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full glass-input rounded-xl text-xs font-mono"
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Justification Reason *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="State the reasons for leave/absence clearly..."
                  className="w-full glass-input rounded-xl text-xs p-3"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Submit Request</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Review Request Modal */}
      {reviewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-md glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6 relative animate-scaleUp">
            <button
              onClick={() => setReviewRequest(null)}
              className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="mb-6 flex items-center space-x-2 text-teal-primary">
              <UserCheck className="w-5 h-5" />
              <h3 className="text-lg font-display font-bold text-ink">Review Request #{reviewRequest.id}</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-sage/5 rounded-xl border border-line-border/20 text-xs font-sans text-ink space-y-2">
                <p><strong>Applicant:</strong> {reviewRequest.request_type === 'student_absence' ? `${reviewRequest.first_name} ${reviewRequest.last_name}` : reviewRequest.staff_name}</p>
                <p><strong>Type:</strong> <span className="capitalize">{reviewRequest.request_type.replace('_', ' ')}</span></p>
                {reviewRequest.hostel_name && <p><strong>Hostel:</strong> {reviewRequest.hostel_name}</p>}
                <p><strong>Duration:</strong> {reviewRequest.start_date} to {reviewRequest.end_date}</p>
                <p><strong>Reason:</strong> "{reviewRequest.reason}"</p>
              </div>

              <div>
                <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Review Comment (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Enter feedback or validation remarks..."
                  className="w-full glass-input rounded-xl text-xs p-3"
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => handleReviewSubmit('rejected')}
                  disabled={reviewing}
                  className="py-2.5 bg-brick-critical hover:bg-brick-critical/90 disabled:bg-brick-critical/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Reject Request</span>
                </button>
                <button
                  onClick={() => handleReviewSubmit('approved')}
                  disabled={reviewing}
                  className="py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve Request</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequests;
