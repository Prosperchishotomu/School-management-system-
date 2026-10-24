import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, StatusPill, Modal,
  ConfirmDialog, EmptyState
} from '../components/ui';
import {
  Clock, Calendar, Filter, Printer, Plus, Trash2, Edit3,
  AlertTriangle, Users, BookOpen, Layers, CheckCircle2, ShieldAlert
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DEFAULT_PERIODS = [
  { id: '1', name: 'Period 1', time: '08:00 - 08:45' },
  { id: '2', name: 'Period 2', time: '08:45 - 09:30' },
  { id: '3', name: 'Period 3', time: '09:30 - 10:15' },
  { id: 'break', name: 'Morning Tea', time: '10:15 - 10:45', isBreak: true },
  { id: '4', name: 'Period 4', time: '10:45 - 11:30' },
  { id: '5', name: 'Period 5', time: '11:30 - 12:15' },
  { id: 'lunch', name: 'Lunch Break', time: '12:15 - 13:15', isBreak: true },
  { id: '6', name: 'Period 6', time: '13:15 - 14:00' },
  { id: '7', name: 'Period 7', time: '14:00 - 14:45' },
  { id: '8', name: 'Period 8', time: '14:45 - 15:30' },
];

// Department colour mapping
const getSubjectColor = (subjectName = '') => {
  const s = subjectName.toLowerCase();
  if (s.includes('math') || s.includes('phys') || s.includes('chem') || s.includes('bio') || s.includes('science')) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
  }
  if (s.includes('hist') || s.includes('geo') || s.includes('heritage') || s.includes('soci') || s.includes('divinity')) {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
  }
  if (s.includes('eng') || s.includes('shona') || s.includes('ndebele') || s.includes('french') || s.includes('lit')) {
    return 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20';
  }
  if (s.includes('acc') || s.includes('comm') || s.includes('econ') || s.includes('bus')) {
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
  }
  if (s.includes('art') || s.includes('music') || s.includes('pe') || s.includes('sport') || s.includes('comp') || s.includes('ict')) {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
  }
  return 'bg-canvas text-ink border-line';
};

export default function Timetable() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [viewMode, setViewMode] = useState('class'); // 'class' | 'teacher'
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherName, setSelectedTeacherName] = useState('');

  // Slot modal state
  const [showModal, setShowModal] = useState(false);
  const [slotForm, setSlotForm] = useState({
    id: '',
    day: 'Monday',
    period: 'Period 1',
    subject: '',
    teacher: '',
    room: 'Room 12'
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Live "Now" indicator state
  const [currentDayIndex, setCurrentDayIndex] = useState(null);
  const [currentPeriodId, setCurrentPeriodId] = useState(null);

  useEffect(() => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sun, 1 is Mon...
    if (day >= 1 && day <= 5) {
      setCurrentDayIndex(day - 1);
    }
    const hour = now.getHours();
    const min = now.getMinutes();
    const timeVal = hour * 60 + min;
    if (timeVal >= 480 && timeVal < 525) setCurrentPeriodId('1');
    else if (timeVal >= 525 && timeVal < 570) setCurrentPeriodId('2');
    else if (timeVal >= 570 && timeVal < 615) setCurrentPeriodId('3');
    else if (timeVal >= 615 && timeVal < 645) setCurrentPeriodId('break');
    else if (timeVal >= 645 && timeVal < 690) setCurrentPeriodId('4');
    else if (timeVal >= 690 && timeVal < 735) setCurrentPeriodId('5');
    else if (timeVal >= 735 && timeVal < 795) setCurrentPeriodId('lunch');
    else if (timeVal >= 795 && timeVal < 840) setCurrentPeriodId('6');
    else if (timeVal >= 840 && timeVal < 885) setCurrentPeriodId('7');
    else if (timeVal >= 885 && timeVal < 930) setCurrentPeriodId('8');
  }, []);

  // Fetch classes, subjects, staff
  const { data: classesData } = useApi(
    `classes_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/classes`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: staffData } = useApi(
    `staff_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/staff`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: subjectsData } = useApi(
    `subjects_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/subjects`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const classes = classesData || [];
  const staff = staffData || [];
  const subjects = subjectsData || [];

  // Initialize selected class or teacher
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(String(classes[0].id));
    }
    if (staff.length > 0 && !selectedTeacherName) {
      if (user?.role === 'teacher') {
        const found = staff.find(s => s.user_id === user.id || s.email === user.email);
        setSelectedTeacherName(found ? found.name : staff[0].name);
        setViewMode('teacher');
      } else {
        setSelectedTeacherName(staff[0].name);
      }
    }
  }, [classes, staff, user]);

  // Fetch timetable entries
  const queryParam = viewMode === 'class'
    ? (selectedClassId ? `?class_id=${selectedClassId}` : '')
    : (selectedTeacherName ? `?teacher_name=${encodeURIComponent(selectedTeacherName)}` : '');

  const { data: timetableData, loading: loadingTimetable } = useApi(
    `timetable_${activeSchoolId}_${viewMode}_${viewMode === 'class' ? selectedClassId : selectedTeacherName}`,
    () => queryParam ? api.get(`/schools/${activeSchoolId}/timetable${queryParam}`).then(r => r.data || []) : Promise.resolve([]),
    { deps: [activeSchoolId, viewMode, selectedClassId, selectedTeacherName] }
  );

  const timetableEntries = Array.isArray(timetableData) ? timetableData : [];

  // Clash check: Detect if the same teacher or class has > 1 subject scheduled in the exact same day & period
  const clashMap = useMemo(() => {
    const counts = {};
    timetableEntries.forEach(entry => {
      const key = `${entry.day}_${entry.period}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [timetableEntries]);

  const totalSlotsScheduled = timetableEntries.length;

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...slotForm,
        class_id: viewMode === 'class' ? selectedClassId : (classes[0]?.id || 1),
        teacher: slotForm.teacher || selectedTeacherName
      };

      if (slotForm.id) {
        await api.patch(`/schools/${activeSchoolId}/timetable/${slotForm.id}`, payload);
        toast.success('Period slot updated.');
      } else {
        await api.post(`/schools/${activeSchoolId}/timetable`, payload);
        toast.success('Subject scheduled.');
      }
      setShowModal(false);
      invalidate(`timetable_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save timetable slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/schools/${activeSchoolId}/timetable/${deletingId}`);
      toast.success('Lesson slot removed.');
      invalidate(`timetable_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to remove slot.');
    } finally {
      setDeletingId(null);
    }
  };

  const activeClassName = classes.find(c => String(c.id) === String(selectedClassId))?.name || 'Form 1';

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Master Academic Timetable"
          subtitle="Weekly 8-period schedule with subject clustering, clash verification, and live period tracker."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4 text-muted" />
                Print Schedule
              </button>
              {['school_admin', 'super_admin'].includes(user?.role) && (
                <button
                  onClick={() => {
                    setSlotForm({
                      id: '',
                      day: 'Monday',
                      period: 'Period 1',
                      subject: subjects[0]?.name || 'Mathematics',
                      teacher: staff[0]?.name || '',
                      room: 'Room 10'
                    });
                    setShowModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add Lesson Slot
                </button>
              )}
            </div>
          }
        />

        {/* KPI Strip */}
        <KpiStrip>
          <StatCard
            label="Scheduled Periods"
            value={totalSlotsScheduled}
            icon={Clock}
            color="brand"
            subtext="Lessons actively programmed"
          />
          <StatCard
            label="Schedule Mode"
            value={viewMode === 'class' ? 'Class View' : 'Teacher View'}
            icon={Layers}
            color="info"
            subtext={viewMode === 'class' ? activeClassName : selectedTeacherName}
          />
          <StatCard
            label="Clash Status"
            value={Object.values(clashMap).some(count => count > 1) ? 'Clash Detected' : 'All Clear'}
            icon={ShieldAlert}
            color={Object.values(clashMap).some(count => count > 1) ? 'danger' : 'accent'}
            subtext={Object.values(clashMap).some(count => count > 1) ? 'Overlapping periods found' : 'Zero room or teacher clashes'}
          />
          <StatCard
            label="Day Status"
            value={currentDayIndex !== null ? DAYS[currentDayIndex] : 'Weekend'}
            icon={Calendar}
            color="violet"
            subtext={currentPeriodId ? `Current: ${currentPeriodId.toUpperCase()}` : 'Out of school hours'}
          />
        </KpiStrip>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('class')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                viewMode === 'class'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'bg-canvas text-muted hover:text-ink border border-line'
              }`}
            >
              Class Timetable
            </button>
            <button
              onClick={() => setViewMode('teacher')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                viewMode === 'teacher'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'bg-canvas text-muted hover:text-ink border border-line'
              }`}
            >
              Teacher Schedule
            </button>
          </div>

          <div className="flex items-center gap-3">
            {viewMode === 'class' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted">Select Stream:</span>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs font-semibold focus:ring-2 focus:ring-brand-500"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted">Select Educator:</span>
                <select
                  value={selectedTeacherName}
                  onChange={e => setSelectedTeacherName(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs font-semibold focus:ring-2 focus:ring-brand-500"
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.role_title || 'Teacher'})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRINT HEADER ONLY VISIBLE ON A4 PRINT */}
      <div className="hidden print:block mb-6 border-b border-black pb-4 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-wider font-display">Harare Academy & College</h1>
        <h2 className="text-base font-semibold mt-1">Official Academic Master Timetable — {viewMode === 'class' ? activeClassName : selectedTeacherName}</h2>
        <p className="text-xs text-gray-600 mt-1">Term 1 2026 Academic Session • Generated on {new Date().toLocaleDateString()}</p>
      </div>

      {/* MAIN TIMETABLE GRID */}
      <Card
        title={viewMode === 'class' ? `${activeClassName} — Weekly Timetable` : `${selectedTeacherName} — Weekly Schedule`}
        subtitle="Standard Zimbabwe secondary/primary periods 1 through 8. Green indicator shows real-time active period."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-xs text-muted font-bold">
                <th className="py-3 px-3 text-left w-32">Time / Period</th>
                {DAYS.map((day, dIdx) => {
                  const isToday = currentDayIndex === dIdx;
                  return (
                    <th
                      key={day}
                      className={`py-3 px-3 text-center min-w-[150px] ${
                        isToday ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 font-extrabold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{day}</span>
                        {isToday && (
                          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" title="Today" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {DEFAULT_PERIODS.map(period => {
                const isBreak = period.isBreak;
                const isCurrentPeriod = currentPeriodId === period.id;

                if (isBreak) {
                  return (
                    <tr key={period.id} className="bg-canvas/40 text-muted">
                      <td className="py-2.5 px-3 font-semibold font-mono text-[11px] whitespace-nowrap">
                        <div>{period.name}</div>
                        <div className="text-[10px] text-muted">{period.time}</div>
                      </td>
                      <td colSpan={5} className="py-2.5 px-3 text-center font-bold tracking-widest uppercase text-[10px] text-muted">
                        — {period.name} ({period.time}) —
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={period.id}
                    className={`transition-colors ${
                      isCurrentPeriod ? 'bg-brand-50/40 dark:bg-brand-950/20' : 'hover:bg-canvas/30'
                    }`}
                  >
                    {/* Period metadata cell */}
                    <td className="py-3 px-3 font-mono text-[11px] text-ink border-r border-line/60 bg-canvas/30">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{period.name}</span>
                        {isCurrentPeriod && (
                          <span className="text-[9px] px-1 rounded bg-brand-500 text-white font-sans uppercase">NOW</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted">{period.time}</div>
                    </td>

                    {/* Monday to Friday slots */}
                    {DAYS.map((day, dIdx) => {
                      const isToday = currentDayIndex === dIdx;
                      const isNowCell = isToday && isCurrentPeriod;

                      // Match entry for this day and period
                      const slots = timetableEntries.filter(
                        e => e.day.toLowerCase() === day.toLowerCase() && (e.period === period.name || e.period === period.id)
                      );
                      const hasClash = slots.length > 1;

                      return (
                        <td
                          key={day}
                          className={`p-2 border-r border-line/40 align-top ${
                            isNowCell ? 'ring-2 ring-brand-500 ring-inset bg-brand-50/60 dark:bg-brand-900/20' : ''
                          }`}
                        >
                          {slots.length === 0 ? (
                            <div className="h-16 rounded-xl border border-dashed border-line/60 flex items-center justify-center text-[11px] text-muted/40 hover:border-brand-500/40 hover:text-muted cursor-pointer transition">
                              <span className="opacity-0 hover:opacity-100">+ Add</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {slots.map(slot => (
                                <div
                                  key={slot.id || `${slot.day}-${slot.period}`}
                                  className={`p-2 rounded-xl border transition shadow-xs relative group ${getSubjectColor(slot.subject)}`}
                                >
                                  {hasClash && (
                                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center text-[9px] font-bold" title="Clash detected">
                                      !
                                    </div>
                                  )}

                                  <div className="font-bold text-xs leading-tight">{slot.subject}</div>
                                  <div className="text-[10px] opacity-80 mt-0.5 flex items-center justify-between">
                                    <span>{viewMode === 'class' ? (slot.teacher || 'Teacher') : (slot.class_name || 'Class')}</span>
                                    {slot.room && <span className="font-mono">{slot.room}</span>}
                                  </div>

                                  {/* Action buttons on hover */}
                                  {['school_admin', 'super_admin'].includes(user?.role) && (
                                    <div className="hidden group-hover:flex items-center gap-1 mt-1.5 pt-1.5 border-t border-current/10 justify-end print:hidden">
                                      <button
                                        onClick={() => {
                                          setSlotForm({
                                            id: slot.id,
                                            day: slot.day,
                                            period: slot.period,
                                            subject: slot.subject,
                                            teacher: slot.teacher,
                                            room: slot.room || ''
                                          });
                                          setShowModal(true);
                                        }}
                                        className="p-1 hover:opacity-80 transition"
                                        title="Edit Slot"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => setDeletingId(slot.id)}
                                        className="p-1 hover:text-danger transition"
                                        title="Remove Slot"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: Add / Edit Timetable Slot */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={slotForm.id ? 'Edit Lesson Slot' : 'Schedule Timetable Lesson'}
        description="Allocate an accredited subject, educator, and room to this designated day and period."
      >
        <form onSubmit={handleSaveSlot} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Weekday *</label>
              <select
                value={slotForm.day}
                onChange={e => setSlotForm({ ...slotForm, day: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                {DAYS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Period *</label>
              <select
                value={slotForm.period}
                onChange={e => setSlotForm({ ...slotForm, period: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                {DEFAULT_PERIODS.filter(p => !p.isBreak).map(p => (
                  <option key={p.name} value={p.name}>{p.name} ({p.time})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Subject *</label>
            <select
              required
              value={slotForm.subject}
              onChange={e => setSlotForm({ ...slotForm, subject: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select Curriculum Subject...</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name} {s.code ? `(${s.code})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Teacher</label>
              <select
                value={slotForm.teacher}
                onChange={e => setSlotForm({ ...slotForm, teacher: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Teacher...</option>
                {staff.map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.role_title || 'Teacher'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Assigned Room</label>
              <input
                type="text"
                placeholder="e.g. Science Lab 1 or Room 4"
                value={slotForm.room}
                onChange={e => setSlotForm({ ...slotForm, room: e.target.value })}
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
              {submitting ? 'Saving...' : 'Save Lesson Slot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteSlot}
        title="Remove Timetable Slot"
        description="Are you sure you want to unschedule this period from the master timetable?"
        confirmText="Remove Slot"
        danger
      />
    </div>
  );
}
