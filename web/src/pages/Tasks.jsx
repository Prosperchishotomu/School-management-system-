import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  CalendarCheck, Calendar, BookOpen, AlertCircle, Plus,
  CheckCircle2, Trash2, CalendarDays, Loader2, RefreshCw,
  FolderOpen, Circle
} from 'lucide-react';
import SkeletonLoader from '../components/ui/SkeletonLoader';

const Tasks = () => {
  const { user, activeSchoolId } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    class_id: '',
    subject_id: '',
    title: '',
    description: '',
    due_date: ''
  });

  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const fetchTasks = () => {
    if (!activeSchoolId) return;
    setLoading(true);
    let path = `/schools/${activeSchoolId}/tasks`;
    const params = [];
    if (statusFilter) params.push(`status=${statusFilter}`);
    if (classFilter) params.push(`class_id=${classFilter}`);
    if (user?.role === 'teacher') params.push(`teacher_id=${user.id}`);
    
    if (params.length > 0) {
      path += '?' + params.join('&');
    }

    api.get(path)
      .then(res => {
        setTasks(res.data || []);
      })
      .catch(err => console.error('Error fetching tasks:', err))
      .finally(() => setLoading(false));
  };

  const fetchAssignments = () => {
    if (!activeSchoolId || user?.role !== 'teacher') return;
    setLoadingAssignments(true);
    api.get(`/schools/${activeSchoolId}/teaching-assignments?teacher_id=${user.id}`)
      .then(res => {
        setAssignments(res.data || []);
        if (res.data && res.data.length > 0) {
          setTaskForm(prev => ({
            ...prev,
            class_id: res.data[0].class_id,
            subject_id: res.data[0].subject_id
          }));
        }
      })
      .catch(err => console.error('Error fetching teaching assignments:', err))
      .finally(() => setLoadingAssignments(false));
  };

  // Fallbacks for admins if adding tasks
  const [adminClasses, setAdminClasses] = useState([]);
  const [adminSubjects, setAdminSubjects] = useState([]);
  useEffect(() => {
    if (activeSchoolId && user?.role !== 'teacher') {
      api.get(`/schools/${activeSchoolId}/classes`)
        .then(res => setAdminClasses(res.data || []));
      api.get(`/subjects`)
        .then(res => setAdminSubjects(res.data || []));
    }
  }, [activeSchoolId, user]);

  useEffect(() => {
    fetchTasks();
  }, [activeSchoolId, statusFilter, classFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [activeSchoolId]);

  const handleToggleStatus = (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'done' ? 'planned' : 'done';
    
    api.patch(`/schools/${activeSchoolId}/tasks/${taskId}`, { status: nextStatus })
      .then(() => {
        fetchTasks();
      })
      .catch(err => console.error('Error updating task status:', err));
  };

  const handleDeleteTask = (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task/lesson plan?')) return;
    
    api.delete(`/schools/${activeSchoolId}/tasks/${taskId}`)
      .then(() => {
        fetchTasks();
      })
      .catch(err => console.error('Error deleting task:', err));
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    setFormError('');
    if (!taskForm.title || !taskForm.due_date || !taskForm.class_id || !taskForm.subject_id) {
      setFormError('Please fill in all mandatory fields.');
      return;
    }

    setSavingTask(true);
    api.post(`/schools/${activeSchoolId}/tasks`, taskForm)
      .then(() => {
        setTaskForm({
          class_id: assignments[0]?.class_id || adminClasses[0]?.id || '',
          subject_id: assignments[0]?.subject_id || adminSubjects[0]?.id || '',
          title: '',
          description: '',
          due_date: ''
        });
        setShowAddForm(false);
        fetchTasks();
      })
      .catch(err => {
        setFormError(err.message || 'Failed to create task.');
      })
      .finally(() => setSavingTask(false));
  };

  const getStatusBadge = (status) => {
    if (status === 'done') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sage/20 text-teal-dark border border-teal-primary/10">
          <CheckCircle2 className="w-3 h-3" />
          <span>Completed</span>
        </span>
      );
    }
    if (status === 'overdue') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-brick-critical/10 text-brick-critical border border-brick-critical/10 animate-pulse">
          <AlertCircle className="w-3 h-3" />
          <span>Overdue</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-warning/10 text-amber-warning border border-amber-warning/10">
        <Calendar className="w-3 h-3" />
        <span>Planned</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b border-line-border/30 pb-5">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">Lesson Planner &amp; Tasks</h1>
          <p className="text-sm font-sans text-ink/55 mt-1">Schedule curriculum targets, organize classroom activities, and monitor due tasks.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchTasks}
            className="p-2.5 border border-line-border rounded-xl hover:bg-sage/10 transition-all cursor-pointer"
            title="Refresh Tasks"
          >
            <RefreshCw className="w-4 h-4 text-teal-primary" />
          </button>
          
          {(user?.role === 'teacher' || user?.role === 'super_admin') && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2.5 bg-teal-primary hover:bg-teal-dark text-white rounded-xl text-xs font-semibold cursor-pointer shadow flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Task Form modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm">
          <div className="w-full max-w-md bg-paper text-ink rounded-2xl shadow-2xl border border-line-border/30 p-6 animate-scaleIn">
            <h3 className="text-sm font-sans font-bold flex items-center space-x-2 border-b border-line-border/30 pb-3 mb-4 text-teal-primary">
              <CalendarCheck className="w-4 h-4" />
              <span>Create Lesson Plan / Task</span>
            </h3>

            {formError && (
              <div className="mb-4 p-2.5 bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-[11px] rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                {user?.role === 'teacher' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Target Class &amp; Subject</label>
                      <select
                        className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                        value={`${taskForm.class_id}|${taskForm.subject_id}`}
                        onChange={(e) => {
                          const [clsId, subId] = e.target.value.split('|');
                          setTaskForm({ ...taskForm, class_id: clsId, subject_id: subId });
                        }}
                      >
                        {assignments.map(a => (
                          <option key={a.id} value={`${a.class_id}|${a.subject_id}`}>{a.class_name} - {a.subject_name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Class</label>
                      <select
                        className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                        value={taskForm.class_id}
                        onChange={e => setTaskForm({ ...taskForm, class_id: e.target.value })}
                      >
                        <option value="">-- Class --</option>
                        {adminClasses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Subject</label>
                      <select
                        className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                        value={taskForm.subject_id}
                        onChange={e => setTaskForm({ ...taskForm, subject_id: e.target.value })}
                      >
                        <option value="">-- Subject --</option>
                        {adminSubjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Target Due Date</label>
                  <input
                    type="date"
                    required
                    className="w-full glass-input rounded-xl text-xs"
                    value={taskForm.due_date}
                    onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Task Title / Target</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduce Fraction Multiplication"
                  className="w-full glass-input rounded-xl text-xs"
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Write instructions, textbook exercises, or lesson plans..."
                  className="w-full glass-input rounded-xl text-xs"
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-line-border/30">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-line-border rounded-xl text-ink/65 hover:bg-sage/10 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="px-5 py-2 bg-teal-primary hover:bg-teal-dark text-white rounded-xl font-semibold cursor-pointer shadow flex items-center space-x-1.5"
                >
                  {savingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Plan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-ink/5 p-4 rounded-2xl">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-ink/60">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-line-border/50 text-ink text-xs font-sans rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-primary"
          >
            <option value="">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="done">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {user?.role !== 'teacher' && (
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-ink/60">Class Filter:</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-white border border-line-border/50 text-ink text-xs font-sans rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-primary"
            >
              <option value="">All Classes</option>
              {adminClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tasks List Content */}
      {loading ? (
        <SkeletonLoader type="table" rows={6} />
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 bg-ink/5 border border-line-border/25 rounded-2xl space-y-3">
          <FolderOpen className="w-12 h-12 text-teal-primary/40 mx-auto" />
          <h3 className="text-sm font-sans font-bold text-ink/70">No lesson plans or tasks found</h3>
          <p className="text-xs font-sans text-ink/45">Create a task plan above to get started with curriculum planning.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => {
            const isDone = task.status === 'done';
            return (
              <div 
                key={task.id} 
                className={`glass-panel p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                  task.status === 'overdue' 
                    ? 'border-brick-critical/20 bg-brick-critical/5' 
                    : isDone
                      ? 'border-line-border/10 bg-sage/5 opacity-70' 
                      : 'border-line-border/30 bg-white/70'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="block text-[9px] font-bold text-ink/40 uppercase tracking-wider font-mono">
                      {task.class_name} • {task.subject_name}
                    </span>
                    {getStatusBadge(task.status)}
                  </div>

                  <div className="flex items-start space-x-2">
                    <button
                      onClick={() => handleToggleStatus(task.id, task.status)}
                      className="mt-1 cursor-pointer focus:outline-none flex-shrink-0"
                      title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-primary" />
                      ) : (
                        <Circle className="w-4 h-4 text-ink/35 hover:text-teal-primary transition-colors" />
                      )}
                    </button>
                    <div>
                      <h4 className={`text-sm font-bold font-sans text-ink leading-snug ${isDone ? 'line-through text-ink/45' : ''}`}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className={`text-xs text-ink/65 mt-1 font-sans leading-relaxed ${isDone ? 'text-ink/40 line-through' : ''}`}>
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-line-border/20 pt-3 mt-4 flex justify-between items-center text-[10px] text-ink/50 font-sans">
                  <div className="flex items-center space-x-1 font-semibold">
                    <CalendarDays className="w-3.5 h-3.5 text-teal-primary" />
                    <span>Due: {task.due_date}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {user?.role !== 'parent' && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-lg hover:bg-brick-critical/10 text-brick-critical hover:text-brick-critical cursor-pointer transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tasks;
