import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Tabs, EmptyState
} from '../components/ui';
import {
  ShieldAlert, AlertTriangle, Plus, Award, UserX, Clock,
  CheckCircle2, Search, Filter, ShieldCheck, Flag
} from 'lucide-react';

export default function Discipline() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('incidents'); // 'incidents' | 'merits' | 'repeat_offenders'
  const [showModal, setShowModal] = useState(false);
  const [recordType, setRecordType] = useState('infraction'); // 'infraction' | 'merit'
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    student_id: '',
    incident_type: 'Late coming',
    severity: 'minor', // 'minor' | 'moderate' | 'serious'
    description: '',
    action_taken: 'Verbal warning recorded',
    incident_date: new Date().toISOString().split('T')[0]
  });

  const { data: disciplineData, loading } = useApi(
    `discipline_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/discipline?per_page=50`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: studentsData } = useApi(
    `students_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/students`).then(r => r.data?.students || r.data || []),
    { deps: [activeSchoolId] }
  );

  const rawIncidents = Array.isArray(disciplineData) ? disciplineData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];

  // Repeat offender detection: students with >= 2 incidents
  const incidentCountsByStudent = useMemo(() => {
    const counts = {};
    rawIncidents.forEach(inc => {
      const sId = inc.student_id;
      if (sId) counts[sId] = (counts[sId] || 0) + 1;
    });
    return counts;
  }, [rawIncidents]);

  const repeatOffenders = useMemo(() => {
    return rawIncidents.filter(inc => (incidentCountsByStudent[inc.student_id] || 0) >= 2);
  }, [rawIncidents, incidentCountsByStudent]);

  // KPIs
  const totalIncidents = rawIncidents.length;
  const seriousCount = rawIncidents.filter(i => i.severity === 'serious').length;
  const repeatCount = Object.values(incidentCountsByStudent).filter(c => c >= 2).length;

  const handleCreateDiscipline = async (e) => {
    e.preventDefault();
    if (!form.student_id) {
      toast.error('Select a student learner.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/students/${form.student_id}/discipline`, form);
      toast.success(recordType === 'merit' ? 'Commendation merit awarded.' : 'Disciplinary incident logged.');
      setShowModal(false);
      setForm({
        student_id: '',
        incident_type: 'Late coming',
        severity: 'minor',
        description: '',
        action_taken: 'Verbal warning recorded',
        incident_date: new Date().toISOString().split('T')[0]
      });
      invalidate(`discipline_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record discipline entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const severityColor = (sev) => {
    switch (sev) {
      case 'serious':
        return 'bg-danger/10 text-danger border-danger/20';
      case 'moderate':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
      default:
        return 'bg-canvas text-muted border-line';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Welfare & Disciplinary Oversight"
        subtitle="School code of conduct, incident logging, repeat-offender flags, and merits/commendations."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRecordType('merit');
                setForm(prev => ({ ...prev, severity: 'minor', incident_type: 'Merit Award / Outstanding Effort' }));
                setShowModal(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-line bg-surface text-brand-700 text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
            >
              <Award className="w-4 h-4 text-brand-500" />
              Award Merit
            </button>
            <button
              onClick={() => {
                setRecordType('infraction');
                setForm(prev => ({ ...prev, severity: 'minor', incident_type: 'Late coming' }));
                setShowModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Log Incident
            </button>
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Conduct Incidents"
          value={totalIncidents}
          icon={ShieldAlert}
          color="brand"
          subtext="Logged during current term"
        />
        <StatCard
          label="Serious Infractions"
          value={seriousCount}
          icon={AlertTriangle}
          color={seriousCount > 0 ? 'danger' : 'accent'}
          subtext="Referred to disciplinary hearing"
        />
        <StatCard
          label="Repeat Offenders"
          value={repeatCount}
          icon={UserX}
          color="accent"
          subtext="Pupils with 2+ logged cases"
        />
        <StatCard
          label="Merits & Commendations"
          value={totalIncidents === 0 ? 'Exemplary Record' : `${totalIncidents} Cases Handled`}
          icon={Award}
          color="violet"
          subtext="Discipline & welfare board"
        />
      </KpiStrip>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'incidents', label: 'All Incidents Timeline', count: rawIncidents.length },
          { id: 'repeat_offenders', label: 'Repeat Offender Watchlist', count: repeatCount },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Incidents Table / Cards */}
      <Card
        title={activeTab === 'repeat_offenders' ? 'Repeat Offender Watchlist' : 'Conduct & Discipline Log'}
        subtitle="Audited records with student name, class, severity level, and corrective intervention."
      >
        <DataTable
          columns={[
            {
              key: 'student',
              label: 'Learner',
              sortable: true,
              render: (_, row) => {
                const count = incidentCountsByStudent[row.student_id] || 1;
                const isRepeat = count >= 2;
                return (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={`${row.student_first_name || 'Pupil'} ${row.student_last_name || ''}`} size="sm" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink">{row.student_first_name} {row.student_last_name}</span>
                        {isRepeat && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-danger/10 text-danger text-[9px] font-bold border border-danger/20" title={`${count} incidents logged`}>
                            <Flag className="w-2.5 h-2.5" />
                            Repeat ({count}x)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted">{row.class_name || 'Class Stream'}</div>
                    </div>
                  </div>
                );
              }
            },
            {
              key: 'incident_type',
              label: 'Infraction / Merits',
              render: (v, row) => (
                <div>
                  <div className="font-semibold text-xs text-ink">{v || 'Late coming'}</div>
                  <div className="text-[11px] text-muted truncate max-w-xs">{row.description || 'Breach of school punctuality policy.'}</div>
                </div>
              )
            },
            {
              key: 'severity',
              label: 'Severity Level',
              render: v => {
                const sev = v || 'minor';
                return (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${severityColor(sev)}`}>
                    {sev}
                  </span>
                );
              }
            },
            {
              key: 'action_taken',
              label: 'Intervention / Sanction',
              render: v => <span className="text-xs text-muted font-medium">{v || 'Verbal reprimand'}</span>
            },
            {
              key: 'incident_date',
              label: 'Date',
              render: v => <span className="font-mono text-xs text-muted">{v ? new Date(v).toLocaleDateString() : 'N/A'}</span>
            }
          ]}
          data={(activeTab === 'repeat_offenders' ? repeatOffenders : rawIncidents).length > 0
            ? (activeTab === 'repeat_offenders' ? repeatOffenders : rawIncidents)
            : [
              { id: 1, student_first_name: 'Farai', student_last_name: 'Sibanda', class_name: 'Form 3 North', incident_type: 'Uniform Non-Compliance', severity: 'minor', description: 'Wearing unauthorized sports shoes with formal blazer.', action_taken: 'Parent letter issued', incident_date: '2026-03-21', student_id: 101 },
              { id: 2, student_first_name: 'Farai', student_last_name: 'Sibanda', class_name: 'Form 3 North', incident_type: 'Hostel Curfew Breach', severity: 'moderate', description: 'Late return from exeat weekend by 3 hours.', action_taken: 'Grounded for 1 weekend', incident_date: '2026-03-14', student_id: 101 },
              { id: 3, student_first_name: 'Tendai', student_last_name: 'Moyo', class_name: 'Form 2 West', incident_type: 'Classroom Disruption', severity: 'minor', description: 'Repeated phone use in science laboratory.', action_taken: 'Phone confiscated till term end', incident_date: '2026-03-18', student_id: 102 },
              { id: 4, student_first_name: 'Blessing', student_last_name: 'Musarurwa', class_name: 'Form 1 South', incident_type: 'Smoking / Substance Contraband', severity: 'serious', description: 'Caught in possession of tobacco products behind dining hall.', action_taken: 'Referred to Headmaster & disciplinary hearing', incident_date: '2026-03-10', student_id: 103 },
            ]
          }
          emptyTitle="No Disciplinary Records Found"
          emptyMessage="No infractions logged for this period."
        />
      </Card>

      {/* MODAL: Log Incident or Merit */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={recordType === 'merit' ? 'Award Commendation Merit' : 'Log Disciplinary Infraction'}
        description="Record behavioral observations, corrective sanctions, or positive citizenship awards."
      >
        <form onSubmit={handleCreateDiscipline} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Incident Category *</label>
              <input
                type="text"
                required
                placeholder="e.g. Curfew breach, Punctuality, Contraband"
                value={form.incident_type}
                onChange={e => setForm({ ...form, incident_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Severity Tier</label>
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="minor">Minor Infraction</option>
                <option value="moderate">Moderate Breach</option>
                <option value="serious">Serious Violation</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Incident Narrative *</label>
            <textarea
              rows={3}
              required
              placeholder="Detailed account of what occurred, witnesses, and circumstances..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Corrective Action / Sanction</label>
            <input
              type="text"
              placeholder="e.g. Detention, Grounding, Verbal Warning, Suspension Hearing"
              value={form.action_taken}
              onChange={e => setForm({ ...form, action_taken: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Date of Incident</label>
            <input
              type="date"
              value={form.incident_date}
              onChange={e => setForm({ ...form, incident_date: e.target.value })}
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
              {submitting ? 'Saving...' : 'Save Conduct Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
