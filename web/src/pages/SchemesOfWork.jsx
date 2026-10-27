import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Modal, Drawer, EmptyState, Tabs
} from '../components/ui';
import {
  FileText, CheckCircle2, Clock, AlertTriangle, Plus, Send,
  Eye, BookOpen, UserCheck, MessageSquare, Printer, Check, X
} from 'lucide-react';
import { STANDARD_SUBJECTS } from '../data/standardSubjects';

export default function SchemesOfWork() {
  const { user, activeSchoolId } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('schemes'); // 'schemes' | 'plans'
  const [showModal, setShowModal] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [hodComments, setHodComments] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Form state
  const [form, setForm] = useState({
    subject: 'Mathematics',
    class_level: 'Form 1',
    term: 'Term 1 2026',
    week_number: 1,
    topic: '',
    objectives: '',
    competencies: '',
    resources: 'Textbook, Geometrical Set, Graph Paper',
    evaluation_remarks: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: schemesData, loading: loadingSchemes } = useApi(
    `schemes_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/schemes`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: plansData } = useApi(
    `lesson_plans_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/lesson-plans`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: classesData } = useApi(
    `classes_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/classes`).then(r => r.data || r || []),
    { deps: [activeSchoolId] }
  );

  const { data: subjectsData } = useApi(
    `subjects_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/subjects`).then(r => r.data || r || []),
    { deps: [activeSchoolId] }
  );

  const availableClasses = Array.isArray(classesData) ? classesData : [];
  const availableSubjects = Array.isArray(subjectsData) ? subjectsData : [];

  const schemes = Array.isArray(schemesData) ? schemesData : [];
  const lessonPlans = Array.isArray(plansData) ? plansData : [];

  const isHodOrAdmin = ['school_admin', 'super_admin', 'hod'].includes(user?.role);

  // KPIs
  const totalSchemes = schemes.length;
  const approvedCount = schemes.filter(s => s.status === 'approved').length;
  const pendingCount = schemes.filter(s => s.status === 'submitted' || s.status === 'pending').length;
  const revisionCount = schemes.filter(s => s.status === 'revision_requested' || s.status === 'rejected').length;

  const handleCreateScheme = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        class_id: form.class_id || form.class_level,
        subject_id: form.subject_id || form.subject,
        term_id: form.term_id || 1,
        SOM: form.resources,
        evaluation: form.evaluation_remarks
      };
      if (activeTab === 'schemes') {
        await api.post(`/schools/${activeSchoolId}/schemes`, payload);
        toast.success(`Scheme for Week ${form.week_number} recorded.`);
        invalidate(`schemes_${activeSchoolId}`);
      } else {
        await api.post(`/schools/${activeSchoolId}/lesson-plans`, payload);
        toast.success('Lesson plan created.');
        invalidate(`lesson_plans_${activeSchoolId}`);
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save scheme.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitToHod = async (schemeId) => {
    try {
      await api.post(`/schemes/${schemeId}/submit`);
      toast.success('Scheme submitted to HOD for vetting.');
      invalidate(`schemes_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to submit scheme.');
    }
  };

  const handleHodReview = async (status) => {
    if (!selectedScheme) return;
    setSubmittingReview(true);
    try {
      await api.post(`/schemes/${selectedScheme.id}/review`, {
        status,
        comments: hodComments || (status === 'approved' ? 'Approved by HOD' : 'Revision needed')
      });
      toast.success(status === 'approved' ? 'Scheme approved.' : 'Revision requested.');
      setSelectedScheme(null);
      setHodComments('');
      invalidate(`schemes_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to submit HOD review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schemes of Work & Pedagogical Records"
        subtitle="Weekly curriculum coverage, competency benchmarks, and Head of Department (HOD) vetting workflow."
        actions={
          <button
            onClick={() => {
              setForm({
                subject: 'Mathematics',
                class_level: 'Form 1',
                term: 'Term 1 2026',
                week_number: schemes.length + 1,
                topic: '',
                objectives: '',
                competencies: '',
                resources: 'Textbook, Worksheets',
                evaluation_remarks: ''
              });
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === 'schemes' ? 'Weekly Scheme' : 'Lesson Plan'}
          </button>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Weekly Schemes"
          value={totalSchemes}
          icon={FileText}
          color="brand"
          subtext="Curriculum syllabus tracks"
        />
        <StatCard
          label="HOD Approved"
          value={approvedCount}
          icon={CheckCircle2}
          color="info"
          subtext={`${totalSchemes > 0 ? Math.round((approvedCount / totalSchemes) * 100) : 0}% compliance rate`}
        />
        <StatCard
          label="Pending Review"
          value={pendingCount}
          icon={Clock}
          color="accent"
          subtext="Awaiting departmental sign-off"
        />
        <StatCard
          label="Revisions Requested"
          value={revisionCount}
          icon={AlertTriangle}
          color={revisionCount > 0 ? 'danger' : 'violet'}
          subtext={revisionCount > 0 ? 'Action required by educator' : 'All clear'}
        />
      </KpiStrip>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'schemes', label: 'Weekly Schemes of Work', count: schemes.length },
          { id: 'plans', label: 'Detailed Lesson Plans', count: lessonPlans.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Weekly Schemes Timeline */}
      {activeTab === 'schemes' && (
        <Card
          title="Curriculum Coverage Timeline"
          subtitle="Weeks 1 to 13 term breakdown with objectives, learner competencies, and supervisory status."
        >
          <DataTable
            columns={[
              {
                key: 'week_number',
                label: 'Week',
                sortable: true,
                render: v => <span className="font-mono font-bold text-xs text-ink">Week {v || 1}</span>
              },
              {
                key: 'topic',
                label: 'Topic & Core Sub-Skills',
                sortable: true,
                render: (v, row) => (
                  <div>
                    <div className="font-bold text-ink">{v || 'Algebraic Expressions & Factorisation'}</div>
                    <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                      <span>{row.subject || 'Mathematics'}</span>
                      <span>•</span>
                      <span>{row.class_level || 'Form 1'}</span>
                    </div>
                  </div>
                )
              },
              {
                key: 'objectives',
                label: 'Learning Objectives',
                render: v => (
                  <p className="text-xs text-muted max-w-xs truncate" title={v}>
                    {v || 'No learning objectives specified.'}
                  </p>
                )
              },
              {
                key: 'status',
                label: 'HOD Status',
                render: v => {
                  const s = v || 'draft';
                  return <StatusPill status={s === 'revision_requested' ? 'declined' : s} />;
                }
              },
              {
                key: 'actions',
                label: '',
                render: (_, row) => (
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setSelectedScheme(row)}
                      className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-muted" />
                      View Dossier
                    </button>

                    {row.status === 'draft' && (
                      <button
                        onClick={() => handleSubmitToHod(row.id)}
                        className="px-2.5 py-1 rounded-lg bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit
                      </button>
                    )}
                  </div>
                )
              }
            ]}
            data={schemes}
            emptyState={
              <EmptyState
                title="No Schemes of Work"
                description="Click '+ New Scheme of Work' to establish curriculum topics and pedagogical plans."
                compact={true}
              />
            }
          />
        </Card>
      )}

      {/* TAB 2: Lesson Plans */}
      {activeTab === 'plans' && (
        <Card
          title="Daily Lesson Plans"
          subtitle="Micro-pedagogical plans with teacher introduction, guided practice, and learner activities."
        >
          <DataTable
            columns={[
              {
                key: 'title',
                label: 'Lesson Title',
                sortable: true,
                render: (v, row) => (
                  <div>
                    <div className="font-bold text-ink">{v || 'Untitled Lesson'}</div>
                    <div className="text-[11px] text-muted">{row.subject || 'Subject'} • {row.duration || '45 mins'}</div>
                  </div>
                )
              },
              { key: 'date', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              {
                key: 'status',
                label: 'Status',
                render: v => <StatusPill status={v || 'approved'} />
              }
            ]}
            data={lessonPlans}
            emptyState={
              <EmptyState
                title="No Lesson Plans"
                description="Daily lesson plans recorded by subject teachers will appear here."
                compact={true}
              />
            }
          />
        </Card>
      )}

      {/* HOD Review & Dossier Drawer */}
      <Drawer
        isOpen={!!selectedScheme}
        onClose={() => setSelectedScheme(null)}
        title={selectedScheme ? `Scheme of Work — Week ${selectedScheme.week_number}` : 'Scheme Details'}
      >
        {selectedScheme && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">{selectedScheme.subject} ({selectedScheme.class_level})</span>
                <StatusPill status={selectedScheme.status || 'draft'} />
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Curriculum Topic</span>
                <div className="text-sm font-bold text-ink mt-0.5">{selectedScheme.topic}</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Specific Learning Objectives</h4>
              <p className="text-xs text-ink leading-relaxed p-3 rounded-xl bg-canvas border border-line">
                {selectedScheme.objectives || 'None specified.'}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Resources & Teaching Aids</h4>
              <p className="text-xs text-ink leading-relaxed p-3 rounded-xl bg-canvas border border-line">
                {selectedScheme.resources || 'None specified.'}
              </p>
            </div>

            {/* HOD Review Section */}
            {isHodOrAdmin && (
              <div className="p-4 rounded-xl border border-brand-500/30 bg-brand-50/20 dark:bg-brand-950/20 space-y-3">
                <h4 className="text-xs font-bold text-ink flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-brand-500" />
                  Head of Department (HOD) Assessment
                </h4>

                <textarea
                  rows={3}
                  value={hodComments}
                  onChange={e => setHodComments(e.target.value)}
                  placeholder="Enter supervisory remarks, praise, or required syllabus adjustments..."
                  className="w-full p-2.5 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
                />

                <div className="flex gap-2">
                  <button
                    disabled={submittingReview}
                    onClick={() => handleHodReview('approved')}
                    className="flex-1 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve Scheme
                  </button>
                  <button
                    disabled={submittingReview}
                    onClick={() => handleHodReview('revision_requested')}
                    className="py-2 px-3 rounded-xl border border-danger/30 text-danger text-xs font-bold hover:bg-danger/10 transition flex items-center gap-1 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Request Revision
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* MODAL: Add Scheme */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Weekly Scheme of Work"
        description="Establish weekly topic coverage, objectives, and pedagogical resources."
      >
        <form onSubmit={handleCreateScheme} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Subject *</label>
              <select
                required
                value={form.subject}
                onChange={e => {
                  const sel = (availableSubjects.length > 0 ? availableSubjects : STANDARD_SUBJECTS).find(s => s.name === e.target.value || s.id === e.target.value);
                  setForm({ ...form, subject: e.target.value, subject_id: sel?.id || e.target.value });
                }}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
              >
                <option value="">Select Curriculum Subject...</option>
                {(availableSubjects.length > 0 ? availableSubjects : STANDARD_SUBJECTS).map(s => (
                  <option key={s.id || s.name} value={s.name || s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Class Level</label>
              {availableClasses.length > 0 ? (
                <select
                  value={form.class_level}
                  onChange={e => {
                    const sel = availableClasses.find(c => c.name === e.target.value || c.id === e.target.value);
                    setForm({ ...form, class_level: e.target.value, class_id: sel?.id || e.target.value });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
                >
                  {availableClasses.map(c => (
                    <option key={c.id || c.name} value={c.name || c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={form.class_level}
                  onChange={e => setForm({ ...form, class_level: e.target.value, class_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Term Week #</label>
              <input
                type="number"
                min="1"
                max="14"
                required
                value={form.week_number}
                onChange={e => setForm({ ...form, week_number: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Topic Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Simultaneous Equations & Graphical Solutions"
              value={form.topic}
              onChange={e => setForm({ ...form, topic: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Learning Objectives *</label>
            <textarea
              rows={3}
              required
              placeholder="What will pupils know and be able to demonstrate by the end of this week?"
              value={form.objectives}
              onChange={e => setForm({ ...form, objectives: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Resources & Materials</label>
            <input
              type="text"
              value={form.resources}
              onChange={e => setForm({ ...form, resources: e.target.value })}
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
              {submitting ? 'Saving...' : 'Save Scheme'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
