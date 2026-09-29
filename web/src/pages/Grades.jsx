import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import {
  Save, Loader2, CheckCircle2, Plus, X, BarChart3, BookOpen
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';

// NOTE: Grades.jsx = Marks Ledger (teacher records marks per student, per subject, per assessment)
// For formal term-end published reports, see Results.jsx.

const getCurrentTerm = () => {
  const m = new Date().getMonth();
  const y = new Date().getFullYear();
  if (m <= 3) return `${y}-T1`;
  if (m <= 7) return `${y}-T2`;
  return `${y}-T3`;
};

const getGrade = (mark) => {
  if (mark === '' || mark === null || mark === undefined) return '';
  const n = Number(mark);
  if (n >= 80) return 'A';
  if (n >= 70) return 'B';
  if (n >= 60) return 'C';
  if (n >= 50) return 'D';
  if (n >= 40) return 'E';
  return 'F';
};

const gradeColor = (grade) => {
  switch (grade) {
    case 'A': return 'text-teal-primary bg-teal-primary/10';
    case 'B': return 'text-blue-600 bg-blue-50';
    case 'C': return 'text-amber-600 bg-amber-50';
    case 'D': return 'text-orange-600 bg-orange-50';
    case 'E': return 'text-red-500 bg-red-50';
    case 'F': return 'text-red-700 bg-red-100';
    default:   return 'text-ink/30 bg-ink/5';
  }
};

const Grades = () => {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const isReadOnly = user?.role === 'school_admin' || user?.role === 'super_admin';

  const [classes,   setClasses]   = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [students,  setStudents]  = useState([]);

  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [term,            setTerm]            = useState(getCurrentTerm());

  // Assessments are loaded from the teacher's saved ledger; start empty.
  const [columns, setColumns]     = useState([]);
  const [newColName, setNewColName] = useState('');
  const [showNewCol, setShowNewCol] = useState(false);

  // Marks grid: { [studentId]: { [colName]: mark } }
  const [marks, setMarks]         = useState({});

  const [loadingSetup, setLoadingSetup]   = useState(true);
  const [loadingGrid,  setLoadingGrid]    = useState(false);
  const [saving,       setSaving]         = useState(false);
  const [saveMsg,      setSaveMsg]        = useState({ type: '', text: '' });

  // Load classes and subjects on mount
  useEffect(() => {
    if (!activeSchoolId) return;
    setLoadingSetup(true);
    Promise.all([
      api.get(`/schools/${activeSchoolId}/classes`).catch(() => ({ data: [] })),
      api.get(`/schools/${activeSchoolId}/subjects`).catch(() =>
        api.get('/subjects').catch(() => ({ data: [] }))
      )
    ]).then(([clsRes, subRes]) => {
      const cls = clsRes.data || [];
      const sub = subRes.data || [];
      setClasses(cls);
      setSubjects(sub);
      if (cls.length > 0) setSelectedClass(String(cls[0].id));
      if (sub.length > 0) setSelectedSubject(sub[0].name);
    }).finally(() => setLoadingSetup(false));
  }, [activeSchoolId]);

  // Load students when class selected
  const fetchStudents = useCallback(() => {
    if (!activeSchoolId || !selectedClass) return;
    setLoadingGrid(true);
    api.get(`/schools/${activeSchoolId}/students?class_id=${selectedClass}&per_page=200`)
      .then(res => {
        const list = (res.data || []).map(s => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`.trim(),
          admission: s.admission_number,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(list);
        // Initialise marks grid
        const initial = {};
        list.forEach(s => {
          initial[s.id] = {};
          columns.forEach(col => { initial[s.id][col] = ''; });
        });
        setMarks(initial);
      })
      .catch(() => { setStudents([]); })
      .finally(() => setLoadingGrid(false));
  }, [activeSchoolId, selectedClass]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // When columns change, add new column slots to marks
  useEffect(() => {
    setMarks(prev => {
      const next = { ...prev };
      students.forEach(s => {
        if (!next[s.id]) next[s.id] = {};
        columns.forEach(col => {
          if (next[s.id][col] === undefined) next[s.id][col] = '';
        });
      });
      return next;
    });
  }, [columns, students]);

  const handleMarkChange = (studentId, col, val) => {
    if (isReadOnly) return;
    const n = val === '' ? '' : Math.min(100, Math.max(0, Number(val)));
    setMarks(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [col]: n === '' ? '' : String(n) }
    }));
  };

  const addColumn = () => {
    const name = newColName.trim();
    if (!name) return;
    if (columns.includes(name)) { toast.warning('An assessment with this name already exists.'); return; }
    setColumns(prev => [...prev, name]);
    setNewColName('');
    setShowNewCol(false);
  };

  const removeColumn = (col) => {
    if (columns.length === 1) { toast.warning('At least one assessment column is required.'); return; }
    setColumns(prev => prev.filter(c => c !== col));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!selectedClass || !selectedSubject) {
      setSaveMsg({ type: 'error', text: 'Please select a class and subject before saving.' });
      return;
    }
    setSaving(true);
    setSaveMsg({ type: '', text: '' });

    // Build entries: one record per student per column
    const entries = [];
    students.forEach(s => {
      columns.forEach(col => {
        const val = marks[s.id]?.[col];
        if (val !== '' && val !== undefined) {
          entries.push({
            student_id: s.id,
            grade_value: Number(val),
            assessment_name: col,
            comments: null,
          });
        }
      });
    });

    try {
      await api.post(`/schools/${activeSchoolId}/classes/${selectedClass}/grades/batch`, {
        subject: selectedSubject,
        assessment_type: 'test',
        term,
        weight: 1.0,
        entries,
      });
      setSaveMsg({ type: 'success', text: `Marks saved successfully for ${selectedSubject} - ${term}. (${entries.length} records)` });
      toast.success('Marks ledger saved.');
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message || 'Failed to save marks.' });
    } finally {
      setSaving(false);
    }
  };

  // Chart: class performance per column
  const chartData = columns.map(col => {
    const vals = students.map(s => {
      const v = marks[s.id]?.[col];
      return v !== '' && v !== undefined ? Number(v) : null;
    }).filter(v => v !== null);
    const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
    return { name: col, avg: Number(avg), count: vals.length };
  });

  const classAvg = (() => {
    const all = students.flatMap(s =>
      columns.map(col => marks[s.id]?.[col]).filter(v => v !== '' && v !== undefined).map(Number)
    );
    return all.length > 0 ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1) : null;
  })();

  const enteredCount = students.filter(s =>
    columns.some(col => marks[s.id]?.[col] !== '' && marks[s.id]?.[col] !== undefined)
  ).length;

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-teal-primary/10 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-teal-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 text-sm">Select a school from the sidebar to access the marks ledger.</p>
      </div>
    );
  }

  return (
    <div className="module-page grades-page p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">

      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Marks Ledger</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            Record and manage student assessment marks by class, subject, and term.
            {isReadOnly && <span className="ml-2 text-amber-600 font-semibold">(View Only)</span>}
          </p>
        </div>
        {!isReadOnly && (
          <div className="text-xs font-sans text-ink/50">
            {enteredCount}/{students.length} students have marks entered
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border border-line-border/30">
        <div>
          <label className="text-[10px] font-bold text-ink/50 uppercase tracking-wider block mb-1">Class</label>
          {loadingSetup ? (
            <div className="w-full h-9 bg-ink/5 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full bg-paper border border-line-border text-ink text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-semibold"
            >
              <option value="">Select Class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="text-[10px] font-bold text-ink/50 uppercase tracking-wider block mb-1">Subject</label>
          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="w-full bg-paper border border-line-border text-ink text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-semibold"
          >
            <option value="">Select Subject...</option>
            {subjects.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-ink/50 uppercase tracking-wider block mb-1">Term</label>
          <select
            value={term}
            onChange={e => setTerm(e.target.value)}
            className="w-full bg-paper border border-line-border text-ink text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-semibold"
          >
            {[1, 2, 3].map(t => {
              const y = new Date().getFullYear();
              return <option key={`${y}-T${t}`} value={`${y}-T${t}`}>Term {t} {y}</option>;
            })}
            {[1, 2, 3].map(t => {
              const y = new Date().getFullYear() - 1;
              return <option key={`${y}-T${t}`} value={`${y}-T${t}`}>Term {t} {y}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Status message */}
      {saveMsg.text && (
        <div className={`p-4 rounded-xl text-sm font-sans border ${saveMsg.type === 'success' ? 'bg-sage/30 text-teal-dark border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border-brick-critical/20'}`}>
          {saveMsg.text}
        </div>
      )}

      {/* Marks Grid */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
          {/* Column header controls */}
          <div className="flex items-center justify-between px-5 py-3 bg-sage/10 border-b border-line-border/30">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-primary" />
              <span className="text-xs font-bold text-ink/70 uppercase tracking-wider">
                {selectedSubject || 'Select Subject'} - {selectedClass ? classes.find(c => String(c.id) === String(selectedClass))?.name || 'Class' : 'Class'}
              </span>
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                {showNewCol ? (
                  <div className="flex items-center gap-2 animate-fadeIn">
                    <input
                      type="text"
                      value={newColName}
                      onChange={e => setNewColName(e.target.value)}
                      placeholder="e.g. Test 2"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColumn(); } }}
                      className="text-xs px-2.5 py-1.5 border border-line-border rounded-lg focus:outline-none focus:border-teal-primary w-28"
                      autoFocus
                    />
                    <button type="button" onClick={addColumn} className="text-xs px-2.5 py-1.5 bg-teal-primary text-paper rounded-lg font-semibold cursor-pointer">Add</button>
                    <button type="button" onClick={() => { setShowNewCol(false); setNewColName(''); }} className="text-xs px-2 py-1.5 text-ink/50 hover:text-ink cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewCol(true)}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-primary rounded-xl font-semibold cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Assessment
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-sage/10 border-b border-line-border text-xs font-bold text-ink/70 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-sage/10 z-10 min-w-[180px]">Student</th>
                  <th className="py-3 px-3 text-center text-ink/40 font-mono text-[9px]">Reg. No.</th>
                  {columns.map(col => (
                    <th key={col} className="py-3 px-3 text-center min-w-[100px]">
                      <div className="flex items-center justify-center gap-1">
                        <span>{col}</span>
                        {!isReadOnly && columns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColumn(col)}
                            className="text-ink/20 hover:text-brick-critical cursor-pointer ml-0.5"
                            title={`Remove ${col}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center">Average</th>
                  <th className="py-3 px-4 text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/40 text-sm font-sans text-ink">
                {loadingGrid ? (
                  <tr><td colSpan={columns.length + 4} className="py-12 text-center text-ink/40 text-xs">Loading students...</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={columns.length + 4} className="py-12 text-center text-ink/40 text-xs">
                    {selectedClass ? 'No students in this class.' : 'Select a class to load students.'}
                  </td></tr>
                ) : students.map((s, idx) => {
                  const studentMarks = columns.map(col => {
                    const v = marks[s.id]?.[col];
                    return v !== '' && v !== undefined ? Number(v) : null;
                  });
                  const entered = studentMarks.filter(v => v !== null);
                  const avg = entered.length > 0 ? (entered.reduce((a, b) => a + b, 0) / entered.length).toFixed(1) : null;
                  const grade = avg !== null ? getGrade(Number(avg)) : '';

                  return (
                    <tr key={s.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-paper' : 'bg-sage/5'} hover:bg-teal-primary/5`}>
                      <td className="py-3 px-4 font-bold sticky left-0 bg-inherit">{s.name}</td>
                      <td className="py-3 px-3 text-center font-mono text-[10px] text-ink/40">{s.admission}</td>
                      {columns.map(col => (
                        <td key={col} className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            placeholder="--"
                            disabled={isReadOnly}
                            value={marks[s.id]?.[col] ?? ''}
                            onChange={e => handleMarkChange(s.id, col, e.target.value)}
                            className={`w-16 text-center px-2 py-1.5 border rounded-lg text-xs font-mono transition-colors focus:outline-none ${
                              isReadOnly
                                ? 'bg-ink/5 border-transparent cursor-not-allowed text-ink/60'
                                : 'border-line-border focus:border-teal-primary bg-paper hover:border-teal-primary/50'
                            }`}
                          />
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center">
                        {avg !== null
                          ? <span className="font-mono font-bold text-sm">{avg}<span className="text-[9px] font-sans text-ink/40">%</span></span>
                          : <span className="text-ink/25 text-xs">-</span>
                        }
                      </td>
                      <td className="py-3 px-4 text-center">
                        {grade
                          ? <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${gradeColor(grade)}`}>{grade}</span>
                          : <span className="text-ink/20 text-xs">-</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          {students.length > 0 && (
            <div className="px-5 py-3 bg-sage/5 border-t border-line-border/30 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs font-sans">
                <span className="text-ink/50">{students.length} students</span>
                <span className="text-teal-primary font-bold">{enteredCount} with marks entered</span>
                {classAvg && <span className="font-bold text-ink">Class Average: <span className="font-mono text-teal-primary">{classAvg}%</span></span>}
              </div>
              {!isReadOnly && (
                <button
                  type="submit"
                  disabled={saving || !selectedClass || !selectedSubject}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Marks'}
                </button>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Performance Chart */}
      {students.length > 0 && chartData.some(d => d.count > 0) && (
        <div className="glass-card rounded-2xl p-6 border border-line-border/30">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-teal-primary" />
            <h3 className="text-base font-display font-bold text-ink">Class Performance by Assessment</h3>
            {selectedSubject && <span className="text-xs text-ink/50 font-mono">{selectedSubject}</span>}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(val) => [`${val}%`, 'Class Average']}
              />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.avg >= 50 ? '#2a9d8f' : '#e76f51'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-sans text-ink/50">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-primary inline-block" />Pass (50%+)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brick-critical inline-block" />Below pass</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Grades;
