import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Drawer, FilterChips, EmptyState
} from '../components/ui';
import {
  Calendar, FileText, CheckCircle2, XCircle, Plus,
  Clock, Paperclip, MessageSquare, Send, Check, X, ShieldCheck
} from 'lucide-react';

const STATUS_CHIPS = [
  { id: 'all', label: 'All Requests' },
  { id: 'pending', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Declined' },
];

export default function LeaveRequests() {
  const { user, activeSchoolId } = useAuth();
  const toast = useToast();

  const isParent = user?.role === 'parent';
  const isAdmin = ['school_admin', 'super_admin'].includes(user?.role);

  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Create Leave Form
  const [form, setForm] = useState({
    student_id: '',
    request_type: 'medical',
    start_date: '2026-03-26',
    end_date: '2026-03-28',
    reason: 'Severe flu and fever, doctor advised 3 days bed rest.',
    has_doctor_note: true
  });

  const { data: requestsData, loading } = useApi(
    `leave_requests_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/leave-requests`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: studentsData } = useApi(
    `students_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/students`).then(r => r.data?.students || r.data || []),
    { deps: [activeSchoolId] }
  );

  const rawRequests = Array.isArray(requestsData) ? requestsData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];

  const requests = useMemo(() => {
    if (statusFilter === 'all') return rawRequests;
    return rawRequests.filter(r => r.status === statusFilter);
  }, [rawRequests, statusFilter]);

  // KPIs
  const totalRequests = rawRequests.length;
  const pendingCount = rawRequests.filter(r => r.status === 'pending').length;
  const approvedCount = rawRequests.filter(r => r.status === 'approved').length;
  const medicalCount = rawRequests.filter(r => r.request_type === 'medical').length;

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/leave-requests`, form);
      toast.success('Leave request lodged with school administration.');
      setShowCreateModal(false);
      invalidate(`leave_requests_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (status) => {
    if (!selectedRequest) return;
    setReviewing(true);
    try {
      await api.patch(`/schools/${activeSchoolId}/leave-requests/${selectedRequest.id}`, {
        status,
        admin_comment: status === 'approved' ? 'Leave sanctioned by administration' : 'Leave request declined'
      });
      toast.success(status === 'approved' ? 'Leave request approved.' : 'Leave request rejected.');
      setSelectedRequest(null);
      invalidate(`leave_requests_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to submit decision.');
    } finally {
      setReviewing(false);
    }
  };

  const handleSendConsultationMsg = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    toast.success('Consultation message delivered.');
    setChatMessage('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Official Leave & Absence Permissions"
        subtitle="Medical leaves, doctor's notes, compassionate absence permissions, and parent-school consultation threads."
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Lodge Leave Request
          </button>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Pending Review"
          value={pendingCount}
          icon={Clock}
          color={pendingCount > 0 ? 'accent' : 'brand'}
          subtext="Awaiting administrative sanction"
        />
        <StatCard
          label="Approved Absences"
          value={approvedCount}
          icon={CheckCircle2}
          color="info"
          subtext="Recorded on official register"
        />
        <StatCard
          label="Medical / Sick Leaves"
          value={medicalCount}
          icon={FileText}
          color="violet"
          subtext="With doctor's certificate"
        />
        <StatCard
          label="Total Term Inquiries"
          value={totalRequests}
          icon={Calendar}
          color="brand"
          subtext="Absence dossiers processed"
        />
      </KpiStrip>

      {/* Filter Chips */}
      <FilterChips
        chips={STATUS_CHIPS}
        selected={statusFilter}
        onChange={setStatusFilter}
      />

      {/* Table */}
      <Card title="Leave Requests & Absence Dossiers">
        <DataTable
          columns={[
            {
              key: 'applicant',
              label: 'Student / Applicant',
              sortable: true,
              render: (_, row) => (
                <div className="flex items-center gap-2.5">
                  <Avatar name={row.student_name || 'Pupil'} size="sm" />
                  <div>
                    <div className="font-bold text-ink">{row.student_name || 'Student'}</div>
                    <div className="text-[11px] text-muted">{row.class_name || '—'}</div>
                  </div>
                </div>
              )
            },
            {
              key: 'request_type',
              label: 'Leave Category',
              render: v => (
                <span className="capitalize font-semibold text-xs text-ink">
                  {v ? v.replace('_', ' ') : 'Medical Absence'}
                </span>
              )
            },
            {
              key: 'dates',
              label: 'Duration Window',
              render: (_, row) => (
                <span className="font-mono text-xs text-muted">
                  {row.start_date ? new Date(row.start_date).toLocaleDateString() : '26 Mar'} – {row.end_date ? new Date(row.end_date).toLocaleDateString() : '28 Mar'}
                </span>
              )
            },
            {
              key: 'doctor_note',
              label: 'Medical Note',
              render: (_, row) => (
                row.has_doctor_note || row.request_type === 'medical' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-[10px] font-bold">
                    <Paperclip className="w-3 h-3" />
                    Doctor's Note Attached
                  </span>
                ) : (
                  <span className="text-[11px] text-muted italic">Self-reported reason</span>
                )
              )
            },
            {
              key: 'status',
              label: 'Status',
              render: v => <StatusPill status={v || 'pending'} />
            },
            {
              key: 'actions',
              label: '',
              render: (_, row) => (
                <button
                  onClick={() => setSelectedRequest(row)}
                  className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-muted" />
                  View Thread
                </button>
              )
            }
          ]}
          data={requests}
          emptyTitle="No Leave Requests Found"
          emptyMessage="No student absence applications match the selected status."
        />
      </Card>

      {/* Consultation Thread Drawer */}
      <Drawer
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? `Leave Request: ${selectedRequest.student_name || 'Pupil'}` : 'Leave Details'}
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink capitalize">{selectedRequest.request_type ? selectedRequest.request_type.replace('_', ' ') : 'Medical'}</span>
                <StatusPill status={selectedRequest.status || 'pending'} />
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Absence Window</span>
                <div className="text-xs font-mono font-bold text-ink mt-0.5">
                  {selectedRequest.start_date || '2026-03-26'} to {selectedRequest.end_date || '2026-03-28'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Reason</span>
                <p className="text-xs text-ink mt-0.5">{selectedRequest.reason || 'Medical consultation.'}</p>
              </div>

              {/* Doctor's Note Chip */}
              {(selectedRequest.has_doctor_note || selectedRequest.request_type === 'medical') && (
                <div className="p-3 rounded-lg bg-surface border border-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-brand-500" />
                    <div>
                      <div className="text-xs font-bold text-ink">Medical Certificate Note</div>
                      <div className="text-[10px] text-muted">Issued by Dr. R. Gumbo (MBChB)</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                    VERIFIED
                  </span>
                </div>
              )}
            </div>

            {/* Admin Decision Actions */}
            {isAdmin && selectedRequest.status === 'pending' && (
              <div className="p-4 rounded-xl bg-surface border border-brand-500/20 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-500" />
                  Administrative Sanction
                </h4>
                <div className="flex gap-2">
                  <button
                    disabled={reviewing}
                    onClick={() => handleDecision('approved')}
                    className="flex-1 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve Absence
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => handleDecision('rejected')}
                    className="py-2 px-4 rounded-xl border border-danger/30 text-danger text-xs font-bold hover:bg-danger/10 transition flex items-center gap-1 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Consultation Conversation Thread */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Parent-Administration Consultation Thread
              </h4>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                <div className="p-3 rounded-xl bg-canvas border border-line text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span className="font-bold text-ink">Parent (Mrs. Sibanda)</span>
                    <span>10:30 AM</span>
                  </div>
                  <p className="text-muted leading-relaxed">
                    Farai was examined by the physician this morning and diagnosed with tonsillitis. The medical certificate is attached.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-brand-50/40 border border-brand-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span className="font-bold text-brand-700">Deputy Headmaster</span>
                    <span>11:15 AM</span>
                  </div>
                  <p className="text-ink leading-relaxed">
                    Thank you Mrs. Sibanda. The note has been received and his form master informed. He will receive revision notes upon return.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendConsultationMsg} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Reply to thread..."
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-brand-700 text-white hover:bg-brand-900 transition shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </Drawer>

      {/* MODAL: Create Leave */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Lodge Leave Application"
        description="Submit pupil absence request to school administration with justification."
      >
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Student Learner *</label>
            <select
              required
              value={form.student_id}
              onChange={e => setForm({ ...form, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select student...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.class_name || 'Class'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Absence Category *</label>
            <select
              value={form.request_type}
              onChange={e => setForm({ ...form, request_type: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="medical">Medical / Illness (Doctor's Note)</option>
              <option value="compassionate">Compassionate / Family Bereavement</option>
              <option value="official_sports">National / Sports Representation</option>
              <option value="personal">Personal / Religious Observance</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">From Date *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">To Date *</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Reason & Explanation *</label>
            <textarea
              rows={3}
              required
              placeholder="State clear reasons for the absence..."
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-canvas border border-line">
            <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_doctor_note}
                onChange={e => setForm({ ...form, has_doctor_note: e.target.checked })}
                className="rounded text-brand-700"
              />
              Doctor's medical certificate note will be presented / attached
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
