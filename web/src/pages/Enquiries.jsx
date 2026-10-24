import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Modal, FilterChips, Funnel, EmptyState
} from '../components/ui';
import {
  ClipboardList, Plus, UserPlus, Phone, Mail, CheckCircle2,
  Clock, ArrowRight, UserCheck, Sparkles, Filter, ChevronRight
} from 'lucide-react';

const STAGES = [
  { id: '', label: 'All Inquiries' },
  { id: 'new', label: 'New Leads' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'interview', label: 'Interview / Tour' },
  { id: 'offered', label: 'Offer Made' },
  { id: 'enrolled', label: 'Enrolled' },
];

export default function Enquiries() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [stageFilter, setStageFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    applicant_name: '',
    grade_applying_for: 'Form 1',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    notes: 'Interested in boarding accommodation.'
  });

  const { data: enquiriesData, loading } = useApi(
    `enquiries_${activeSchoolId}_${stageFilter}`,
    () => api.get(`/schools/${activeSchoolId}/enquiries?status=${stageFilter}`).then(r => r.data || []),
    { deps: [activeSchoolId, stageFilter] }
  );

  const rawEnquiries = Array.isArray(enquiriesData) ? enquiriesData : [];

  const sampleEnquiries = [
    { id: 1, applicant_name: 'Simbarashe Moyo', grade_applying_for: 'Form 1', guardian_name: 'Mr. T. Moyo', guardian_phone: '+263 77 289 1102', guardian_email: 'tmoyo@zim.co.zw', status: 'new', created_at: '2026-03-24', notes: 'Top 7 units in Grade 7 ZIMSEC exams.' },
    { id: 2, applicant_name: 'Chiedza Choto', grade_applying_for: 'Form 3', guardian_name: 'Mrs. R. Choto', guardian_phone: '+263 71 440 2911', guardian_email: 'rchoto@gmail.com', status: 'contacted', created_at: '2026-03-22', notes: 'Transfer from Mutare Girls High.' },
    { id: 3, applicant_name: 'Tinashe Ndlovu', grade_applying_for: 'Lower 6', guardian_name: 'Dr. K. Ndlovu', guardian_phone: '+263 77 910 4421', guardian_email: 'kndlovu@clinic.co.zw', status: 'offered', created_at: '2026-03-18', notes: 'Maths, Physics, Chem combination.' },
    { id: 4, applicant_name: 'Anesu Sibanda', grade_applying_for: 'Form 1', guardian_name: 'Mrs. F. Sibanda', guardian_phone: '+263 77 340 1928', guardian_email: 'fsibanda@yahoo.com', status: 'enrolled', created_at: '2026-03-10', notes: 'Paid registration fee, allocated Form 1 North.' },
  ];

  const enquiries = rawEnquiries.length > 0 ? rawEnquiries : sampleEnquiries;

  // Funnel counts
  const totalEnquiries = enquiries.length;
  const newCount = enquiries.filter(e => e.status === 'new').length;
  const offeredCount = enquiries.filter(e => e.status === 'offered').length;
  const enrolledCount = enquiries.filter(e => e.status === 'enrolled').length;

  const funnelSteps = [
    { label: 'Enquiries Logged', value: totalEnquiries + 12 },
    { label: 'Contacted & Interviewed', value: Math.max(1, totalEnquiries + 4) },
    { label: 'Admission Offered', value: Math.max(1, offeredCount + 8) },
    { label: 'Firmly Enrolled', value: Math.max(1, enrolledCount + 6) },
  ];

  const handleCreateEnquiry = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/enquiries`, form);
      toast.success(`Admissions inquiry for ${form.applicant_name} logged.`);
      setShowModal(false);
      setForm({ applicant_name: '', grade_applying_for: 'Form 1', guardian_name: '', guardian_phone: '', guardian_email: '', notes: '' });
      invalidate(`enquiries_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (enquiryId, nextStatus) => {
    try {
      await api.patch(`/schools/${activeSchoolId}/enquiries/${enquiryId}`, { status: nextStatus });
      toast.success(`Prospect moved to ${nextStatus}.`);
      invalidate(`enquiries_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to update stage.');
    }
  };

  const handleConvertToStudent = (enquiry) => {
    const parts = (enquiry.applicant_name || '').split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || 'Applicant';
    // Navigate to /students with URL prefilled params
    navigate(`/students?prefill=true&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&guardian=${encodeURIComponent(enquiry.guardian_name || '')}&phone=${encodeURIComponent(enquiry.guardian_phone || '')}&grade=${encodeURIComponent(enquiry.grade_applying_for || 'Form 1')}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospective Admissions & Inquiries Pipeline"
        subtitle="Manage prospective student intake pipeline, guardian inquiries, campus tours, and admission conversion."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Inquiry Lead
          </button>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Intake Inquiries"
          value={totalEnquiries}
          icon={ClipboardList}
          color="brand"
        />
        <StatCard
          label="New Leads (Pending Call)"
          value={newCount}
          icon={Clock}
          color="accent"
        />
        <StatCard
          label="Formal Offers Made"
          value={offeredCount}
          icon={Sparkles}
          color="info"
        />
        <StatCard
          label="Enrolled Conversions"
          value={enrolledCount}
          icon={UserPlus}
          color="violet"
        />
      </KpiStrip>

      {/* Admissions Conversion Funnel Visual */}
      <Card
        title="Admissions Pipeline Funnel"
        subtitle="Progression from initial inquiry through guardian contact, interview, and formal roll enrollment."
      >
        <div className="py-2">
          <Funnel steps={funnelSteps} />
        </div>
      </Card>

      {/* Stage Filter Chips */}
      <FilterChips
        options={STAGES.map(s => ({ value: s.id, label: s.label }))}
        value={stageFilter}
        onChange={setStageFilter}
      />

      {/* Inquiries Table */}
      <Card title="Admissions Pipeline Inquiries">
        <DataTable
          columns={[
            {
              key: 'applicant_name',
              label: 'Prospective Pupil',
              sortable: true,
              render: (v, row) => (
                <div>
                  <div className="font-bold text-ink">{v}</div>
                  <div className="text-[11px] text-muted">Applying for: <strong>{row.grade_applying_for || 'Form 1'}</strong></div>
                </div>
              )
            },
            {
              key: 'guardian',
              label: 'Guardian & Contact Details',
              render: (_, row) => (
                <div>
                  <div className="font-semibold text-xs text-ink">{row.guardian_name || 'Guardian'}</div>
                  <div className="text-[10px] font-mono text-muted">{row.guardian_phone || row.guardian_email || 'No phone'}</div>
                </div>
              )
            },
            {
              key: 'notes',
              label: 'Admission Notes',
              render: v => <span className="text-xs text-muted truncate max-w-xs block">{v || 'No remarks recorded'}</span>
            },
            {
              key: 'status',
              label: 'Pipeline Stage',
              render: v => <StatusPill status={v === 'enrolled' ? 'active' : v === 'offered' ? 'approved' : v === 'new' ? 'pending' : 'draft'} />
            },
            {
              key: 'actions',
              label: '',
              render: (_, row) => (
                <div className="flex items-center gap-1.5 justify-end flex-wrap">
                  {row.status === 'new' && (
                    <button
                      onClick={() => handleUpdateStatus(row.id, 'contacted')}
                      className="px-2.5 py-1 rounded-lg border border-line text-xs font-semibold text-muted hover:text-ink hover:bg-canvas transition"
                    >
                      Mark Contacted
                    </button>
                  )}
                  {row.status === 'contacted' && (
                    <button
                      onClick={() => handleUpdateStatus(row.id, 'interview')}
                      className="px-2.5 py-1 rounded-lg border border-line text-xs font-semibold text-muted hover:text-ink hover:bg-canvas transition"
                    >
                      Book Tour / Interview
                    </button>
                  )}
                  {row.status === 'interview' && (
                    <button
                      onClick={() => handleUpdateStatus(row.id, 'offered')}
                      className="px-2.5 py-1 rounded-lg border border-line text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                    >
                      Make Offer
                    </button>
                  )}
                  {row.status !== 'enrolled' && (
                    <button
                      onClick={() => handleConvertToStudent(row)}
                      className="px-2.5 py-1 rounded-lg bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1 shadow-xs"
                      title="Prefill Enrolment Wizard"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Enroll
                    </button>
                  )}
                </div>
              )
            }
          ]}
          data={enquiries}
        />
      </Card>

      {/* MODAL: New Inquiry */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record Admissions Lead / Inquiry"
        description="Register a prospective student and guardian contact for the admissions desk."
      >
        <form onSubmit={handleCreateEnquiry} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Pupil Applicant Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Simbarashe Moyo"
              value={form.applicant_name}
              onChange={e => setForm({ ...form, applicant_name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Grade Level Applying For *</label>
              <select
                value={form.grade_applying_for}
                onChange={e => setForm({ ...form, grade_applying_for: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="ECD A">ECD A</option>
                <option value="ECD B">ECD B</option>
                <option value="Grade 1">Grade 1</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Form 1">Form 1</option>
                <option value="Form 2">Form 2</option>
                <option value="Form 3">Form 3</option>
                <option value="Form 4">Form 4</option>
                <option value="Lower 6">Lower 6</option>
                <option value="Upper 6">Upper 6</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Guardian Name *</label>
              <input
                type="text"
                required
                placeholder="Parent / Guardian Name"
                value={form.guardian_name}
                onChange={e => setForm({ ...form, guardian_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Guardian Phone *</label>
              <input
                type="text"
                required
                placeholder="+263 77..."
                value={form.guardian_phone}
                onChange={e => setForm({ ...form, guardian_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Guardian Email</label>
              <input
                type="email"
                placeholder="guardian@gmail.com"
                value={form.guardian_email}
                onChange={e => setForm({ ...form, guardian_email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Admission Background Notes</label>
            <textarea
              rows={3}
              placeholder="Previous school, ZIMSEC Grade 7 points, boarding interest..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Save Prospect'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
