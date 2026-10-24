import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Modal, Tabs, FilterChips, EmptyState
} from '../components/ui';
import {
  CalendarCheck, Calendar, BookOpen, AlertCircle, Plus,
  CheckCircle2, Trash2, LayoutGrid, List, Clock, Flag, Check
} from 'lucide-react';

export default function Tasks() {
  const { user, activeSchoolId } = useAuth();
  const toast = useToast();

  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [taskForm, setTaskForm] = useState({
    class_id: '',
    subject: 'Mathematics',
    title: '',
    description: '',
    priority: 'medium', // 'low' | 'medium' | 'high'
    due_date: '2026-03-30',
    status: 'pending' // 'pending' | 'in_progress' | 'completed'
  });

  const { data: tasksData, loading } = useApi(
    `tasks_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/tasks`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: classesData } = useApi(
    `classes_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/classes`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const rawTasks = Array.isArray(tasksData) ? tasksData : [];
  const classes = Array.isArray(classesData) ? classesData : [];

  // Fallback demo tasks if backend table is empty
  const sampleTasks = [
    { id: 1, title: 'CALA Task 2: Linear Programming Project', subject: 'Mathematics', class_name: 'Form 3 North', due_date: '2026-03-27', priority: 'high', status: 'pending', description: 'Formulate real-world boundary inequalities for poultry feed formulation.' },
    { id: 2, title: 'Heritage Studies Essay: The Great Zimbabwe Architecture', subject: 'Heritage Studies', class_name: 'Form 2 West', due_date: '2026-03-29', priority: 'medium', status: 'pending', description: '500-word analysis of dry-stone wall construction.' },
    { id: 3, title: 'Science Lab Report: Titration of Hydrochloric Acid', subject: 'Physical Science', class_name: 'Form 4 East', due_date: '2026-03-24', priority: 'high', status: 'in_progress', description: 'Submit experimental write-up and indicator observation table.' },
    { id: 4, title: 'English Literature Character Analysis: Animal Farm', subject: 'English Language', class_name: 'Form 1 South', due_date: '2026-03-20', priority: 'low', status: 'completed', description: 'Comprehension exercise pages 45 to 48.' },
  ];

  const tasks = rawTasks.length > 0 ? rawTasks : sampleTasks;

  // KPIs
  const totalTasks = tasks.length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/tasks`, taskForm);
      toast.success('Curriculum assignment published to learners.');
      setShowModal(false);
      setTaskForm({ class_id: '', subject: 'Mathematics', title: '', description: '', priority: 'medium', due_date: '2026-03-30', status: 'pending' });
      invalidate(`tasks_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await api.patch(`/schools/${activeSchoolId}/tasks/${task.id}`, { status: newStatus });
      toast.success(`Task marked as ${newStatus.replace('_', ' ')}.`);
      invalidate(`tasks_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to update task status.');
    }
  };

  const priorityBadge = (pri) => {
    switch (pri) {
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/10 text-danger border border-danger/20">HIGH PRIORITY</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-canvas text-muted border border-line">NORMAL</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Tasks, CALA & Assignments"
        subtitle="Manage student homework submissions, Continuous Assessment Learning Activities, and project deadlines."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-line rounded-xl overflow-hidden bg-surface">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 transition ${viewMode === 'kanban' ? 'bg-canvas text-brand-700' : 'text-muted hover:text-ink'}`}
                title="Kanban Board View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition ${viewMode === 'list' ? 'bg-canvas text-brand-700' : 'text-muted hover:text-ink'}`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => {
                if (classes.length > 0) setTaskForm(prev => ({ ...prev, class_id: String(classes[0].id) }));
                setShowModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Assign Task
            </button>
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Active Tasks"
          value={totalTasks}
          icon={CalendarCheck}
          color="brand"
          subtext="Published assignments"
        />
        <StatCard
          label="Pending Submission"
          value={pendingCount}
          icon={Clock}
          color="accent"
          subtext="Due within current cycle"
        />
        <StatCard
          label="In Progress / Submitting"
          value={inProgressCount}
          icon={BookOpen}
          color="info"
          subtext="Under learner review"
        />
        <StatCard
          label="Completed & Graded"
          value={completedCount}
          icon={CheckCircle2}
          color="violet"
          subtext="Marks posted to gradebook"
        />
      </KpiStrip>

      {/* KANBAN OR LIST VIEW */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Column 1: Pending */}
          <div className="p-4 rounded-2xl bg-canvas/60 border border-line space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">To Do / Pending</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface border border-line text-ink">
                {tasks.filter(t => t.status === 'pending').length}
              </span>
            </div>

            <div className="space-y-3">
              {tasks.filter(t => t.status === 'pending').map(t => (
                <div key={t.id} className="p-4 rounded-xl bg-surface border border-line shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-ink">{t.title}</span>
                    {priorityBadge(t.priority)}
                  </div>
                  <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">{t.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-line/60">
                    <span className="font-semibold text-ink">{t.class_name || 'Form 3'}</span>
                    <span className="font-mono text-brand-700 font-bold">Due: {new Date(t.due_date).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => handleStatusChange(t, 'in_progress')}
                    className="w-full py-1.5 rounded-lg border border-line text-[11px] font-semibold text-muted hover:text-ink hover:bg-canvas transition"
                  >
                    Move to In Progress →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="p-4 rounded-2xl bg-canvas/60 border border-line space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">In Progress / Submissions</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface border border-line text-ink">
                {tasks.filter(t => t.status === 'in_progress').length}
              </span>
            </div>

            <div className="space-y-3">
              {tasks.filter(t => t.status === 'in_progress').map(t => (
                <div key={t.id} className="p-4 rounded-xl bg-surface border border-brand-500/30 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-ink">{t.title}</span>
                    {priorityBadge(t.priority)}
                  </div>
                  <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">{t.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-line/60">
                    <span className="font-semibold text-ink">{t.class_name || 'Form 4'}</span>
                    <span className="font-mono text-brand-700 font-bold">Due: {new Date(t.due_date).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => handleStatusChange(t, 'completed')}
                    className="w-full py-1.5 rounded-lg bg-brand-700 text-white text-[11px] font-semibold hover:bg-brand-900 transition flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Complete & Grade
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="p-4 rounded-2xl bg-canvas/60 border border-line space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Completed & Graded</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface border border-line text-ink">
                {tasks.filter(t => t.status === 'completed').length}
              </span>
            </div>

            <div className="space-y-3">
              {tasks.filter(t => t.status === 'completed').map(t => (
                <div key={t.id} className="p-4 rounded-xl bg-surface border border-line opacity-80 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-ink line-through">{t.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-100">
                      GRADED
                    </span>
                  </div>
                  <div className="text-[10px] text-muted">{t.subject} • {t.class_name || 'Form 1'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Card title="Task & Homework Master List">
          <DataTable
            columns={[
              {
                key: 'title',
                label: 'Task Assignment',
                sortable: true,
                render: (v, row) => (
                  <div>
                    <div className="font-bold text-ink">{v}</div>
                    <div className="text-[11px] text-muted">{row.subject} • {row.class_name || 'Form 3'}</div>
                  </div>
                )
              },
              {
                key: 'priority',
                label: 'Priority',
                render: v => priorityBadge(v)
              },
              {
                key: 'due_date',
                label: 'Deadline Due',
                sortable: true,
                render: v => <span className="font-mono text-xs font-bold text-ink">{new Date(v).toLocaleDateString()}</span>
              },
              {
                key: 'status',
                label: 'Progress',
                render: v => <StatusPill status={v === 'completed' ? 'active' : v === 'in_progress' ? 'pending' : 'draft'} />
              }
            ]}
            data={tasks}
          />
        </Card>
      )}

      {/* MODAL: Assign Task */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Publish Assignment or CALA Project"
        description="Deliver a homework task, practical project, or assignment to student class rolls."
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Assignment Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. CALA Component 2: Ecological Field Study"
              value={taskForm.title}
              onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Target Class *</label>
              <select
                required
                value={taskForm.class_id}
                onChange={e => setTaskForm({ ...taskForm, class_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Subject</label>
              <input
                type="text"
                placeholder="Mathematics, Heritage, etc."
                value={taskForm.subject}
                onChange={e => setTaskForm({ ...taskForm, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Priority Level</label>
              <select
                value={taskForm.priority}
                onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="low">Normal</option>
                <option value="medium">Medium</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Submission Deadline *</label>
              <input
                type="date"
                required
                value={taskForm.due_date}
                onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Detailed Instructions</label>
            <textarea
              rows={3}
              placeholder="Outline project parameters, deliverables, and rubric criteria..."
              value={taskForm.description}
              onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
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
              {submitting ? 'Publishing...' : 'Publish Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
