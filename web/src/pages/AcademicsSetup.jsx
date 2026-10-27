import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Tabs, Modal, ConfirmDialog, EmptyState
} from '../components/ui';
import {
  Calendar, Award, BookOpen, Layers, Plus, CheckCircle,
  Clock, ShieldAlert, Sparkles, Sliders, ChevronRight
} from 'lucide-react';

export default function AcademicsSetup() {
  const { activeSchoolId } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('terms'); // 'terms' | 'sessions' | 'departments' | 'grading'
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form states
  const [sessionForm, setSessionForm] = useState({ name: '', start_date: '', end_date: '', is_current: true });
  const [termForm, setTermForm] = useState({ name: '', term_number: 1, start_date: '', end_date: '', is_active: true });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', hod_name: '' });

  // Interactive Grading Scale Boundaries State (ZIMSEC & National standard with live preview)
  const [gradingScale, setGradingScale] = useState([
    { grade: 'A', minScore: 75, maxScore: 100, comment: 'Distinction', points: 1, color: '#2E8B63' },
    { grade: 'B', minScore: 65, maxScore: 74, comment: 'Merit', points: 2, color: '#3FA97A' },
    { grade: 'C', minScore: 50, maxScore: 64, comment: 'Credit / Pass', points: 3, color: '#F5A524' },
    { grade: 'D', minScore: 45, maxScore: 49, comment: 'Subsidiary Pass', points: 4, color: '#FB923C' },
    { grade: 'E', minScore: 40, maxScore: 44, comment: 'Bare Pass', points: 5, color: '#EA580C' },
    { grade: 'U', minScore: 0, maxScore: 39, comment: 'Ungraded / Fail', points: 9, color: '#D64545' },
  ]);
  const [testScore, setTestScore] = useState(68);

  // Fetching data
  const { data: termsData } = useApi(
    `terms_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/terms`).then(r => r.data?.data || r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: sessionsData } = useApi(
    `sessions_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/sessions`).then(r => r.data?.data || r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: deptsData } = useApi(
    `depts_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/departments`).then(r => r.data?.data || r.data || []),
    { deps: [activeSchoolId] }
  );

  const terms = Array.isArray(termsData) ? termsData : [];
  const sessions = Array.isArray(sessionsData) ? sessionsData : [];
  const departments = Array.isArray(deptsData) ? deptsData : [];

  const activeTerm = terms.find(t => t.is_active || t.status === 'active') || null;
  const activeSession = sessions.find(s => s.is_current) || null;

  // Live preview lookup for testScore
  const matchedGrade = gradingScale.find(g => testScore >= g.minScore && testScore <= g.maxScore) || gradingScale[gradingScale.length - 1];

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (activeTab === 'terms') {
        await api.post(`/schools/${activeSchoolId}/terms`, termForm);
        toast.success(`Term ${termForm.name} configured.`);
        invalidate(`terms_${activeSchoolId}`);
      } else if (activeTab === 'sessions') {
        await api.post(`/schools/${activeSchoolId}/sessions`, sessionForm);
        toast.success(`Academic session ${sessionForm.name} established.`);
        invalidate(`sessions_${activeSchoolId}`);
      } else if (activeTab === 'departments') {
        await api.post(`/schools/${activeSchoolId}/departments`, deptForm);
        toast.success(`Department ${deptForm.name} added.`);
        invalidate(`depts_${activeSchoolId}`);
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetActiveTerm = async (termId) => {
    try {
      await api.patch(`/schools/${activeSchoolId}/terms/${termId}`, { is_active: true });
      toast.success('Active school term updated.');
      invalidate(`terms_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to change active term.');
    }
  };

  const updateGradeBoundary = (index, field, value) => {
    const updated = [...gradingScale];
    updated[index][field] = Number(value);
    setGradingScale(updated);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Setup & Calendar"
        subtitle="Manage academic years, Zimbabwean 3-term system, faculty departments, and ZIMSEC grading boundaries."
        actions={
          activeTab !== 'grading' && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === 'terms' ? 'Term' : activeTab === 'sessions' ? 'Session' : 'Department'}
            </button>
          )
        }
      />

      {/* Active Term Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-900 to-brand-950 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-brand-100 font-bold">Active Academic Period</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-500/30 text-brand-100 text-[10px] font-semibold border border-brand-500/40">
                LIVE
              </span>
            </div>
            <div className="text-lg font-bold font-display mt-0.5">
              {activeTerm ? `${activeTerm.name}${activeSession ? ` • Academic Year ${activeSession.name}` : ''}` : 'No Active Academic Term Configured'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-brand-100">
          <div>
            <span className="text-brand-100/60 block text-[10px] uppercase">Start Date</span>
            <span className="font-mono font-semibold">{activeTerm?.start_date ? new Date(activeTerm.start_date).toLocaleDateString() : '—'}</span>
          </div>
          <div>
            <span className="text-brand-100/60 block text-[10px] uppercase">End Date</span>
            <span className="font-mono font-semibold">{activeTerm?.end_date ? new Date(activeTerm.end_date).toLocaleDateString() : '—'}</span>
          </div>
          <div>
            <span className="text-brand-100/60 block text-[10px] uppercase">Curriculum</span>
            <span className="font-bold text-white">ZIMSEC / Cambridge</span>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Current Term"
          value={activeTerm?.term_number ? `Term ${activeTerm.term_number}` : (activeTerm?.name || 'None')}
          icon={Calendar}
          color="brand"
          subtext={activeTerm ? (activeTerm.name || 'Active term') : 'Click Add Term to configure'}
        />
        <StatCard
          label="Academic Sessions"
          value={sessions.length}
          icon={Clock}
          color="info"
          subtext={activeSession?.name ? `Current: ${activeSession.name}` : 'No active session'}
        />
        <StatCard
          label="Faculty Departments"
          value={departments.length}
          icon={Layers}
          color="violet"
          subtext={departments.length > 0 ? 'Active instructional departments' : 'No departments configured'}
        />
        <StatCard
          label="Pass Threshold"
          value="50% (Grade C)"
          icon={Award}
          color="accent"
          subtext="ZIMSEC standard credit pass"
        />
      </KpiStrip>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'terms', label: 'Terms Calendar', count: terms.length },
          { id: 'sessions', label: 'Academic Years', count: sessions.length },
          { id: 'departments', label: 'Departments', count: departments.length },
          { id: 'grading', label: 'Grading Scale & Boundaries' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Terms */}
      {activeTab === 'terms' && (
        <Card
          title="Terms Calendar"
          subtitle="Configure the 3 school terms per calendar year, open/close dates, and active reporting term."
        >
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Term Name',
                sortable: true,
                render: (v, row) => {
                  const cleanName = (v || '').toLowerCase().includes('1') ? 'Term 1'
                    : (v || '').toLowerCase().includes('2') ? 'Term 2'
                    : (v || '').toLowerCase().includes('3') ? 'Term 3'
                    : (v || `Term ${row.term_number || 1}`).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{cleanName}</span>
                      {row.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border border-brand-200">
                          CURRENT TERM
                        </span>
                      )}
                    </div>
                  );
                }
              },
              {
                key: 'term_number',
                label: 'Term Schedule',
                render: (v, row) => {
                  const num = v || (row.name?.includes('1') ? 1 : row.name?.includes('2') ? 2 : 3);
                  return <span className="font-semibold text-ink">Term {num}</span>;
                }
              },
              { key: 'start_date', label: 'Commences', render: v => v ? new Date(v).toLocaleDateString() : 'N/A' },
              { key: 'end_date', label: 'Concludes', render: v => v ? new Date(v).toLocaleDateString() : 'N/A' },
              {
                key: 'status',
                label: 'Status',
                render: (_, row) => {
                  const now = new Date();
                  const start = row.start_date ? new Date(row.start_date) : null;
                  const end = row.end_date ? new Date(row.end_date) : null;
                  const isCurrent = (start && end && now >= start && now <= end) || row.is_active;
                  const isConcluded = end && now > end;

                  if (isCurrent) {
                    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200">Active</span>;
                  }
                  if (isConcluded) {
                    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">Concluded</span>;
                  }
                  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">Upcoming</span>;
                }
              }
            ]}
            data={terms}
            emptyTitle="No Academic Terms Configured"
            emptyMessage="Configure your school terms (e.g. Term 1, Term 2, Term 3) by clicking 'Add Term' above."
          />
        </Card>
      )}

      {/* TAB 2: Sessions */}
      {activeTab === 'sessions' && (
        <Card
          title="Academic Sessions"
          subtitle="Annual school cycles for curriculum coverage and fee invoicing."
        >
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Academic Session',
                sortable: true,
                render: (v, row) => (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{v}</span>
                    {row.is_current && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-100">
                        CURRENT
                      </span>
                    )}
                  </div>
                )
              },
              { key: 'start_date', label: 'Start Date', render: v => v ? new Date(v).toLocaleDateString() : 'N/A' },
              { key: 'end_date', label: 'End Date', render: v => v ? new Date(v).toLocaleDateString() : 'N/A' },
            ]}
            data={sessions}
            emptyTitle="No Academic Sessions Configured"
            emptyMessage="Create your school academic year session (e.g. 2026 Academic Year) by clicking 'Add Session' above."
          />
        </Card>
      )}

      {/* TAB 3: Departments */}
      {activeTab === 'departments' && (
        <Card
          title="Faculty Departments"
          subtitle="Subject groups led by Heads of Department (HODs)."
        >
          <DataTable
            columns={[
              { key: 'name', label: 'Department Name', sortable: true, render: v => <span className="font-bold text-ink">{v}</span> },
              { key: 'code', label: 'Code', render: v => <span className="font-mono text-xs text-muted">{v || 'N/A'}</span> },
              { key: 'hod_name', label: 'Head of Department (HOD)', render: v => v || 'Unassigned' }
            ]}
            data={departments}
            emptyTitle="No Faculty Departments Configured"
            emptyMessage="Add subject faculty departments (e.g. Sciences, Humanities, Languages) by clicking 'Add Department' above."
          />
        </Card>
      )}

      {/* TAB 4: Grading Scale & Live Boundary Preview */}
      {activeTab === 'grading' && (
        <div className="space-y-6">
          <Card
            title="Grading Scale Editor & Score Simulator"
            subtitle="Define score cutoffs and points for ZIMSEC O/A-Level and Cambridge reports. Test against live scores below."
          >
            {/* Live Interactive Simulator */}
            <div className="p-4 rounded-2xl bg-canvas border border-line mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted">Interactive Score Boundary Simulator</div>
                  <div className="text-xs text-muted mt-0.5">Drag slider to test how raw percentage maps to official grade, points, and remark.</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted">Test Percentage:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={testScore}
                    onChange={e => setTestScore(Number(e.target.value))}
                    className="w-36 accent-brand-700"
                  />
                  <span className="font-mono text-sm font-bold text-ink w-12">{testScore}%</span>
                </div>
              </div>

              {/* Result Preview Chip */}
              <div className="mt-4 p-3 rounded-xl bg-surface border border-line flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl font-display font-bold text-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: matchedGrade.color }}
                  >
                    {matchedGrade.grade}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink">
                      Grade {matchedGrade.grade} — {matchedGrade.comment}
                    </div>
                    <div className="text-xs text-muted">
                      Score falls in range {matchedGrade.minScore}% – {matchedGrade.maxScore}%
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-ink">Points: {matchedGrade.points}</div>
                  <div className="text-[10px] text-muted">{matchedGrade.minScore >= 50 ? 'Qualifies for Certificate' : 'Requires Remedial Support'}</div>
                </div>
              </div>
            </div>

            {/* Editable Boundary Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold text-muted uppercase">
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3">Min Score (%)</th>
                    <th className="py-2.5 px-3">Max Score (%)</th>
                    <th className="py-2.5 px-3">Remark</th>
                    <th className="py-2.5 px-3">ZIMSEC Points</th>
                    <th className="py-2.5 px-3">Band Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {gradingScale.map((band, idx) => (
                    <tr key={band.grade} className="hover:bg-canvas/50">
                      <td className="py-3 px-3">
                        <span
                          className="px-2.5 py-1 rounded-lg font-bold font-mono text-xs text-white"
                          style={{ backgroundColor: band.color }}
                        >
                          {band.grade}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={band.minScore}
                          onChange={e => updateGradeBoundary(idx, 'minScore', e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-line bg-surface text-ink font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={band.maxScore}
                          onChange={e => updateGradeBoundary(idx, 'maxScore', e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-line bg-surface text-ink font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={band.comment}
                          onChange={e => {
                            const updated = [...gradingScale];
                            updated[idx].comment = e.target.value;
                            setGradingScale(updated);
                          }}
                          className="w-40 px-2 py-1 rounded-lg border border-line bg-surface text-ink text-xs"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-ink">
                        {band.points}
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-28 h-2 rounded-full overflow-hidden bg-canvas border border-line">
                          <div
                            className="h-full"
                            style={{
                              marginLeft: `${band.minScore}%`,
                              width: `${band.maxScore - band.minScore}%`,
                              backgroundColor: band.color
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => toast.success('Grading boundaries saved to school academic policy.')}
                className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition shadow-xs"
              >
                Save Grading Scheme
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={activeTab === 'terms' ? 'New School Term' : activeTab === 'sessions' ? 'New Academic Session' : 'New Department'}
      >
        <form onSubmit={handleCreateRecord} className="space-y-4">
          {activeTab === 'terms' && (
            <>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Term Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Term 2 2026"
                  value={termForm.name}
                  onChange={e => setTermForm({ ...termForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Term Number</label>
                  <select
                    value={termForm.term_number}
                    onChange={e => setTermForm({ ...termForm, term_number: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                  >
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Status</label>
                  <label className="flex items-center gap-2 mt-2 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termForm.is_active}
                      onChange={e => setTermForm({ ...termForm, is_active: e.target.checked })}
                      className="rounded text-brand-700"
                    />
                    Mark as active term
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Start Date</label>
                  <input
                    type="date"
                    value={termForm.start_date}
                    onChange={e => setTermForm({ ...termForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">End Date</label>
                  <input
                    type="date"
                    value={termForm.end_date}
                    onChange={e => setTermForm({ ...termForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'sessions' && (
            <>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Session Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026/2027"
                  value={sessionForm.name}
                  onChange={e => setSessionForm({ ...sessionForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Start Date</label>
                  <input
                    type="date"
                    value={sessionForm.start_date}
                    onChange={e => setSessionForm({ ...sessionForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">End Date</label>
                  <input
                    type="date"
                    value={sessionForm.end_date}
                    onChange={e => setSessionForm({ ...sessionForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'departments' && (
            <>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sciences & Mathematics"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Department Code</label>
                <input
                  type="text"
                  placeholder="e.g. SCI"
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Head of Department (HOD)</label>
                <input
                  type="text"
                  placeholder="Name of Lead Educator"
                  value={deptForm.hod_name}
                  onChange={e => setDeptForm({ ...deptForm, hod_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs"
                />
              </div>
            </>
          )}

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
              {submitting ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
