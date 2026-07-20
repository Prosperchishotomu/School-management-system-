import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Plus, X, Loader2, Clock, Trash2, Calendar, Edit3 } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const Timetable = () => {
  const { activeSchoolId, user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Curriculum subjects list
  const [subjects, setSubjects] = useState([]);
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState('');

  // Timeslots (periods) state
  const [periodsList, setPeriodsList] = useState([
    '07:30–08:10', '08:10–08:50', '08:50–09:30', '09:30–10:10', 'BREAK', '10:30–11:10', '11:10–11:50', '11:50–12:30', '12:30–13:10'
  ]);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [showManagePeriods, setShowManagePeriods] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editSlot, setEditSlot] = useState({ day: '', period: '', subject: '', teacher: '', id: '' });
  const [slotLoading, setSlotLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canEdit = user?.role === 'super_admin';

  useEffect(() => {
    if (!activeSchoolId) return;
    api.get(`/schools/${activeSchoolId}/classes`)
      .then(res => {
        setClasses(res.data || []);
        if (res.data?.length > 0) setSelectedClass(String(res.data[0].id));
      })
      .catch(() => {});

    api.get(`/schools/${activeSchoolId}/subjects`)
      .then(res => {
        setSubjects(res.data || []);
      })
      .catch(() => {});
  }, [activeSchoolId]);

  // Load class specific timeslots from localstorage or fallbacks
  useEffect(() => {
    if (!activeSchoolId || !selectedClass) return;
    const key = `schoolbase_periods_${activeSchoolId}_${selectedClass}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setPeriodsList(JSON.parse(saved));
      } catch (e) {
        // Fallback
      }
    } else {
      setPeriodsList([
        '07:30–08:10', '08:10–08:50', '08:50–09:30', '09:30–10:10', 'BREAK', '10:30–11:10', '11:10–11:50', '11:50–12:30', '12:30–13:10'
      ]);
    }
  }, [activeSchoolId, selectedClass]);

  const fetchTimetable = () => {
    if (!activeSchoolId || !selectedClass) return;
    setLoading(true);
    api.get(`/schools/${activeSchoolId}/timetable?class_id=${selectedClass}`)
      .then(res => { setTimetable(res.data || []); setError(''); })
      .catch(() => setError('Could not load timetable.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTimetable(); }, [activeSchoolId, selectedClass]);

  const slotMap = {};
  timetable.forEach(slot => {
    slotMap[`${slot.day}-${slot.period}`] = slot;
  });

  const currentClassObj = classes.find(c => String(c.id) === selectedClass);
  const classTeacher = currentClassObj?.teacher_name || '';

  const handleSlotClick = (day, period) => {
    if (!canEdit) return;
    if (period === 'BREAK') return;
    const existing = slotMap[`${day}-${period}`];
    
    // Check if existing subject is from curriculum
    const subjectInList = subjects.some(s => s.name === existing?.subject);
    const isCustom = existing?.subject && !subjectInList;
    
    setIsCustomSubject(!!isCustom);
    setCustomSubjectName(isCustom ? existing.subject : '');
    
    setEditSlot({ 
      day, 
      period, 
      subject: existing?.subject || '', 
      teacher: classTeacher || 'Unassigned', 
      id: existing?.id || '' 
    });
    setShowModal(true);
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    setSlotLoading(true);
    try {
      const finalSubject = isCustomSubject ? customSubjectName.trim() : editSlot.subject;
      if (!finalSubject) {
        throw new Error('Subject name is required.');
      }
      const slotId = editSlot.id || `${selectedClass}-${editSlot.day}-${editSlot.period}`.replace(/[: –]/g, '_');
      await api.put(`/schools/${activeSchoolId}/timetable/${slotId}`, {
        class_id: selectedClass,
        day: editSlot.day,
        period: editSlot.period,
        subject: finalSubject,
        teacher: classTeacher || 'Unassigned'
      });
      setShowModal(false);
      fetchTimetable();
    } catch (err) {
      alert(err.message || 'Failed to save slot.');
    } finally {
      setSlotLoading(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!editSlot.id) return;
    if (!window.confirm('Are you sure you want to delete this timetable slot?')) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/schools/${activeSchoolId}/timetable/${editSlot.id}`);
      setShowModal(false);
      fetchTimetable();
    } catch (err) {
      alert(err.message || 'Failed to delete slot.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Add a timeslot
  const handleAddPeriod = (e) => {
    e.preventDefault();
    const p = newPeriodName.trim();
    if (!p) return;
    if (periodsList.includes(p)) {
      alert('Timeslot already exists.');
      return;
    }
    const updated = [...periodsList, p].sort((a, b) => {
      if (a === 'BREAK') return -1;
      if (b === 'BREAK') return 1;
      return a.localeCompare(b);
    });
    setPeriodsList(updated);
    localStorage.setItem(`schoolbase_periods_${activeSchoolId}_${selectedClass}`, JSON.stringify(updated));
    setNewPeriodName('');
  };

  // Delete a timeslot
  const handleDeletePeriod = (periodToDelete) => {
    if (!window.confirm(`Delete the timeslot "${periodToDelete}"? Scheduled entries in this slot will remain in database but hidden from view.`)) return;
    const updated = periodsList.filter(p => p !== periodToDelete);
    setPeriodsList(updated);
    localStorage.setItem(`schoolbase_periods_${activeSchoolId}_${selectedClass}`, JSON.stringify(updated));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, day, period) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      const finalSubject = dragData.subject;
      if (!finalSubject) return;

      const existing = slotMap[`${day}-${period}`];
      const slotId = existing?.id || `${selectedClass}-${day}-${period}`.replace(/[: –]/g, '_');

      await api.put(`/schools/${activeSchoolId}/timetable/${slotId}`, {
        class_id: selectedClass,
        day: day,
        period: period,
        subject: finalSubject,
        teacher: classTeacher || 'Unassigned'
      });
      fetchTimetable();
    } catch (err) {
      alert(err.message || 'Failed to assign dropped subject.');
    }
  };

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <AlertTriangle className="w-16 h-16 text-amber-warning mb-4" />
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 font-sans text-sm">Select a school from the sidebar switcher to load class timetables.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-full mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Timetable Manager</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {canEdit ? 'Add, remove, or edit subjects, teachers, and customized timeslots per class.' : 'View weekly class schedules.'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {canEdit && (
            <button
              onClick={() => setShowManagePeriods(!showManagePeriods)}
              className="flex items-center space-x-2 px-4 py-2 border border-line-border/30 hover:bg-sage/10 text-ink text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-teal-primary" />
              <span>{showManagePeriods ? 'Hide Timeslots Panel' : 'Manage Timeslots'}</span>
            </button>
          )}
          
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-ink/50 uppercase tracking-wider font-sans">Class:</span>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="bg-paper border border-line-border text-ink text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-sans font-semibold">
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{error}</div>}

      {/* Timeslots Editor Panel */}
      {canEdit && showManagePeriods && (
        <div className="glass-card rounded-2xl p-5 border border-line-border/30 bg-sage/5 space-y-4 max-w-2xl animate-slideDown">
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center space-x-2">
            <Clock className="w-4 h-4 text-teal-primary" />
            <span>Timetable Timeslots Management</span>
          </h3>
          <p className="text-xs text-ink/60 font-sans">Customize the periods / timeslots configuration for <b>{classes.find(c => String(c.id) === selectedClass)?.name}</b>.</p>
          
          <form onSubmit={handleAddPeriod} className="flex gap-2 max-w-md">
            <input
              type="text"
              required
              placeholder="e.g. 13:10–13:50 or BREAK"
              className="flex-1 px-3 py-1.5 border border-line-border bg-paper rounded-lg text-xs focus:outline-none"
              value={newPeriodName}
              onChange={e => setNewPeriodName(e.target.value)}
            />
            <button type="submit" className="px-3.5 py-1.5 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer">
              + Add Period
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {periodsList.map(p => (
              <span key={p} className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-paper border border-line-border/30 rounded-xl text-xs font-mono">
                <span className="text-ink/80">{p}</span>
                <button
                  type="button"
                  onClick={() => handleDeletePeriod(p)}
                  className="text-brick-critical/50 hover:text-brick-critical transition-colors cursor-pointer"
                  title="Remove this slot"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Draggable Subjects Palette */}
      {canEdit && (
        <div className="glass-card rounded-2xl p-5 border border-line-border/30 space-y-3 animate-fadeIn">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-teal-primary" />
            <span>Subject Palette (Drag &amp; Drop to Grid)</span>
          </h3>
          <p className="text-xs text-ink/65">Drag a subject badge from this panel and drop it into a timeslot cell on the grid below to schedule it instantly.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {subjects.map(sub => (
              <div
                key={sub.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ subject: sub.name, id: sub.id }));
                }}
                className="cursor-grab active:cursor-grabbing px-3 py-2 bg-white border border-teal-primary/20 hover:border-teal-primary text-teal-primary text-xs font-semibold rounded-xl shadow-sm flex items-center space-x-1.5 transition-all hover:shadow"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{sub.name}</span>
              </div>
            ))}
            {subjects.length === 0 && (
              <span className="text-xs text-ink/40">No subjects registered for this school.</span>
            )}
          </div>
        </div>
      )}

      {/* Timetable grid */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-sage/20 border-b border-line-border">
                <th className="py-4 px-6 text-left text-[10px] font-sans font-bold text-ink/60 uppercase tracking-wider w-36">Period</th>
                {DAYS.map(d => (
                  <th key={d} className="py-4 px-6 text-center text-[10px] font-sans font-bold text-ink/60 uppercase tracking-wider">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/50">
              {periodsList.map((period) => (
                <tr key={period} className={period === 'BREAK' ? 'bg-sage/10' : 'hover:bg-sage/5'}>
                  <td className="py-3 px-6 text-xs font-mono numeric-data text-ink/70 whitespace-nowrap border-r border-line-border/20 bg-sage/5">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-teal-primary/50" />
                      <span className="font-semibold">{period}</span>
                    </div>
                  </td>
                  {DAYS.map(day => {
                    if (period === 'BREAK') {
                      return <td key={day} className="py-3 px-6 text-center text-xs font-sans text-ink/40 italic bg-sage/5">Break</td>;
                    }
                    const slot = slotMap[`${day}-${period}`];
                    return (
                      <td 
                        key={day} 
                        className="py-3 px-4 text-center"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day, period)}
                      >
                        <div
                          onClick={() => handleSlotClick(day, period)}
                          className={`min-h-[60px] rounded-xl border transition-all flex flex-col items-center justify-center p-2 ${
                            canEdit ? 'cursor-pointer hover:border-teal-primary/50 hover:bg-teal-primary/5' : ''
                          } ${slot ? 'border-teal-primary/20 bg-teal-primary/5' : 'border-line-border/30 bg-transparent'}`}
                        >
                          {slot ? (
                            <>
                              <span className="text-xs font-bold text-ink leading-snug">{slot.subject}</span>
                              <span className="text-[10px] text-ink/50 mt-1 font-sans leading-none">{slot.teacher}</span>
                            </>
                          ) : (
                            canEdit && <span className="text-[10px] text-ink/20 font-bold">+ Assign</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {periodsList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-ink/40 font-sans">
                    No periods defined. Add some timeslots above to construct the timetable grid.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Slot Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-2xl shadow-2xl p-6 border border-line-border/30 relative">
            <button onClick={() => setShowModal(false)} className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-display font-bold text-ink mb-1">Edit Timetable Slot</h3>
            <p className="text-xs text-ink/50 font-mono mb-4">{editSlot.day} · {editSlot.period}</p>
            <form onSubmit={handleSaveSlot} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Subject Name *</label>
                <select
                  value={isCustomSubject ? 'custom' : editSlot.subject}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomSubject(true);
                      setEditSlot({ ...editSlot, subject: '' });
                    } else {
                      setIsCustomSubject(false);
                      setEditSlot({ ...editSlot, subject: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-line-border rounded-lg text-xs bg-paper text-ink focus:outline-none focus:border-teal-primary font-sans"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.name}>{sub.name} ({sub.code})</option>
                  ))}
                  <option value="custom">+ Create custom subject...</option>
                </select>
              </div>

              {isCustomSubject && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Custom Subject Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Environmental Science"
                    className="w-full px-3 py-2 border border-line-border rounded-lg text-xs bg-paper text-ink focus:outline-none focus:border-teal-primary"
                    value={customSubjectName}
                    onChange={e => setCustomSubjectName(e.target.value)}
                  />
                </div>
              )}

              <div className="p-3 bg-sage/5 border border-line-border/30 rounded-xl space-y-1">
                <span className="text-[10px] font-sans font-bold text-ink/40 uppercase tracking-wider block">Assigned Class Teacher</span>
                <span className="text-xs font-semibold text-teal-primary block">
                  {classTeacher ? classTeacher : 'Unassigned (set in Staff Roster)'}
                </span>
                <p className="text-[9px] text-ink/40 font-sans">Class teachers are automatically assigned based on class schedules.</p>
              </div>
              <div className="pt-2 flex justify-between items-center">
                {editSlot.id ? (
                  <button type="button" onClick={handleDeleteSlot} disabled={deleteLoading} className="inline-flex items-center space-x-1 px-3 py-2 border border-brick-critical/30 bg-brick-critical/5 hover:bg-brick-critical/10 text-brick-critical rounded-xl text-xs font-semibold cursor-pointer">
                    {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Delete</span>
                  </button>
                ) : <div />}
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-line-border rounded-xl text-xs font-semibold cursor-pointer">Cancel</button>
                  <button type="submit" disabled={slotLoading} className="px-4 py-2 bg-teal-primary text-paper rounded-xl text-xs font-semibold cursor-pointer flex items-center space-x-2">
                    {slotLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetable;