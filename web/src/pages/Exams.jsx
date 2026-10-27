import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Modal, ConfirmDialog, EmptyState
} from '../components/ui';
import {
  Calendar, Clock, MapPin, User, Plus, Trash2, Edit3,
  AlertTriangle, ShieldAlert, Award, FileSpreadsheet, CheckCircle2, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

export default function Exams() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [term, setTerm] = useState('Term 1');
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    id: '',
    class_id: '',
    subject: '',
    exam_date: new Date().toISOString().split('T')[0],
    start_time: '08:30',
    duration_minutes: '120',
    room: '',
    invigilator: ''
  });

  // Fetch school terms
  const { data: termsData } = useApi(
    `terms_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/terms`).then(r => r.data?.data || r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  // Fetch exams, classes, and academic analytics for pass rates
  const { data: examsData, loading: loadingExams } = useApi(
    `exams_${activeSchoolId}_${term}`,
    () => api.get(`/schools/${activeSchoolId}/exams?term=${encodeURIComponent(term)}`).then(r => r.data || []),
    { deps: [activeSchoolId, term] }
  );

  const { data: classesData } = useApi(
    `classes_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/classes`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: subjectsData } = useApi(
    `subjects_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/subjects`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: academicAnalytics } = useApi(
    `academics_analytics_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/analytics/academics?group=subject`).then(r => r.data?.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const terms = Array.isArray(termsData) ? termsData : [];
  const exams = Array.isArray(examsData) ? examsData : [];
  const classes = Array.isArray(classesData) ? classesData : [];
  const subjects = Array.isArray(subjectsData) ? subjectsData : [];
  const subjectPassRates = Array.isArray(academicAnalytics) ? academicAnalytics : [];

  // Clash Detection: Same room, same date, overlapping time window
  const clashes = useMemo(() => {
    const clashList = [];
    for (let i = 0; i < exams.length; i++) {
      for (let j = i + 1; j < exams.length; j++) {
        const a = exams[i];
        const b = exams[j];
        if (a.exam_date === b.exam_date && a.room && b.room && a.room.toLowerCase() === b.room.toLowerCase()) {
          clashList.push({
            id: `${a.id}-${b.id}`,
            date: a.exam_date,
            room: a.room,
            examA: `${a.subject} (${a.class_name || 'Class'})`,
            examB: `${b.subject} (${b.class_name || 'Class'})`,
          });
        }
      }
    }
    return clashList;
  }, [exams]);

  // Group exams by date for the calendar timeline
  const groupedExams = useMemo(() => {
    const groups = {};
    exams.forEach(ex => {
      const dateKey = ex.exam_date || 'Unscheduled';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(ex);
    });
    // Sort dates
    return Object.keys(groups).sort().map(d => ({ date: d, items: groups[d] }));
  }, [exams]);

  const handleSaveExam = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (form.id) {
        await api.patch(`/schools/${activeSchoolId}/exams/${form.id}`, form);
        toast.success('Exam session updated.');
      } else {
        await api.post(`/schools/${activeSchoolId}/exams`, { ...form, term });
        toast.success('Exam scheduled.');
      }
      setShowModal(false);
      invalidate(`exams_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/exams/${deletingId}`);
      toast.success('Exam session removed.');
      invalidate(`exams_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to remove exam.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examination Desk & Session Schedules"
        subtitle="Mid-term and end-of-term examination timetable, room clash auditing, and historical pass rate analytics."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={term}
              onChange={e => setTerm(e.target.value)}
              className="px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold focus:ring-2 focus:ring-brand-500"
            >
              {terms.length > 0 ? (
                terms.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))
              ) : (
                <>
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </>
              )}
            </select>

            {['school_admin', 'super_admin'].includes(user?.role) && (
              <button
                onClick={() => {
                  setForm({
                    id: '',
                    class_id: classes[0]?.id || '',
                    subject: '',
                    exam_date: new Date().toISOString().split('T')[0],
                    start_time: '08:30',
                    duration_minutes: '120',
                    room: '',
                    invigilator: ''
                  });
                  setShowModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Schedule Exam
              </button>
            )}
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Scheduled Papers"
          value={exams.length}
          icon={Calendar}
          color="brand"
          subtext={`Current session: ${term}`}
        />
        <StatCard
          label="Venues Utilized"
          value={new Set(exams.map(e => e.room).filter(Boolean)).size}
          icon={MapPin}
          color="info"
          subtext="Main Hall, Labs, Examination Blocks"
        />
        <StatCard
          label="Clash Audit Status"
          value={clashes.length > 0 ? `${clashes.length} Clashes` : 'Zero Clashes'}
          icon={ShieldAlert}
          color={clashes.length > 0 ? 'danger' : 'accent'}
          subtext={clashes.length > 0 ? 'Room/Time overlaps detected' : 'All venues safely partitioned'}
        />
        <StatCard
          label="Overall Pass Threshold"
          value="50% Credit"
          icon={Award}
          color="violet"
          subtext="ZIMSEC standard 5 'O' Levels"
        />
      </KpiStrip>

      {/* Clash Alert Banner */}
      {clashes.length > 0 && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">Exam Venue Clash Detected: </span>
            {clashes.map((c, i) => (
              <span key={c.id}>
                {c.examA} and {c.examB} are both booked for <strong>{c.room}</strong> on {c.date}
                {i < clashes.length - 1 ? '; ' : '.'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Calendar Timeline + Pass Rate Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Exam Calendar Timeline */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title="Exam Timeline & Timetable"
            subtitle="Chronological paper dates with venue, invigilator, and duration."
          >
            {groupedExams.length === 0 ? (
              <EmptyState
                title="No Exams Scheduled"
                description={`No examination papers configured for ${term}. Schedule an exam to generate student admissions.`}
                actionLabel="Schedule First Paper"
                onAction={() => setShowModal(true)}
              />
            ) : (
              <div className="space-y-6">
                {groupedExams.map(group => (
                  <div key={group.date} className="relative pl-6 border-l-2 border-brand-500/30 space-y-2">
                    <div className="absolute -left-2 top-0 w-3.5 h-3.5 rounded-full bg-brand-500 border-2 border-surface" />
                    <div className="text-xs font-bold font-mono text-brand-700 dark:text-brand-300">
                      {new Date(group.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>

                    <div className="space-y-2">
                      {group.items.map(item => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-canvas border border-line flex items-center justify-between hover:bg-surface hover:shadow-xs transition"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-ink">{item.subject}</span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface border border-line font-medium text-muted">
                                {item.class_name || `Class #${item.class_id}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted mt-1.5 font-mono">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-brand-500" />
                                {item.start_time || '08:30'} ({item.duration_minutes || 120} min)
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-accent" />
                                {item.room || 'Main Hall'}
                              </span>
                              {item.invigilator && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 text-muted" />
                                  {item.invigilator}
                                </span>
                              )}
                            </div>
                          </div>

                          {['school_admin', 'super_admin'].includes(user?.role) && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setForm(item);
                                  setShowModal(true);
                                }}
                                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface transition"
                                title="Edit Exam"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-surface transition"
                                title="Delete Exam"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Pass Rate Analytics by Subject */}
        <div className="lg:col-span-5 space-y-6">
          <Card
            title="Subject Pass Rate Benchmark"
            subtitle="Percentage of learners attaining Grade C (50%+) or higher across subjects."
          >
            {subjectPassRates.length === 0 ? (
              <EmptyState
                title="No Exam Results Recorded"
                subtitle="Pass rate benchmarks by subject will appear here once exam marks are captured in the gradebook."
                compact={true}
              />
            ) : (
              <>
                <div className="h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={subjectPassRates}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="subject" type="category" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip formatter={v => [`${v}%`, 'Pass Rate']} />
                      <ReferenceLine x={50} stroke="#D64545" strokeDasharray="3 3" label={{ value: 'Target 50%', fill: '#D64545', fontSize: 10 }} />
                      <Bar dataKey="pass_rate" fill="#2E8B63" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted mt-2 text-center">
                  Dashed red line denotes the 50% ministry credit cutoff.
                </p>
              </>
            )}
          </Card>

          <Card
            title="Examination Conduct Directives"
            subtitle="Ministry of Primary and Secondary Education standard code"
          >
            <ul className="text-xs text-muted space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <span>All candidate desks must be separated by a minimum of 1.25 meters.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <span>Invigilator logbooks must record seal integrity and attendance counts.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <span>Continuous Assessment Learning Activities (CALA / SBA) marks must be finalized prior to written examination dispatch.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* MODAL: Schedule Exam */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? 'Edit Exam Session' : 'Schedule Examination Paper'}
        description="Configure date, start time, classroom venue, and lead invigilator."
      >
        <form onSubmit={handleSaveExam} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Target Class *</label>
              <select
                required
                value={form.class_id}
                onChange={e => setForm({ ...form, class_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Subject Title *</label>
              <select
                required
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-medium"
              >
                <option value="">Select Curriculum Subject...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Exam Date *</label>
              <input
                type="date"
                required
                value={form.exam_date}
                onChange={e => setForm({ ...form, exam_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Duration (Min)</label>
              <input
                type="number"
                min="30"
                max="360"
                value={form.duration_minutes}
                onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Venue / Room *</label>
              <input
                type="text"
                required
                placeholder="Great Hall, Lab 2, etc."
                value={form.room}
                onChange={e => setForm({ ...form, room: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Invigilator</label>
              <input
                type="text"
                placeholder="Name of presiding teacher"
                value={form.invigilator}
                onChange={e => setForm({ ...form, invigilator: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
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
              {submitting ? 'Saving...' : 'Save Paper'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Remove Exam Schedule"
        description="Are you sure you want to remove this examination session?"
        confirmText="Remove Exam"
        danger
      />
    </div>
  );
}
