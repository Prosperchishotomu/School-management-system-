import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  GraduationCap,
  Save,
  Filter,
  Loader2,
  CheckCircle2
} from 'lucide-react';

// NOTE: Grades.jsx represents ongoing coursework/CATs (raw individual assessment marks recorded by teachers).
// For formal term-end reports or published report cards, see Results.jsx.
const Grades = () => {
  const { activeSchoolId, user } = useAuth();
  
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [term, setTerm] = useState('2026-T1');
  const [subject, setSubject] = useState('Mathematics');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [assessmentType, setAssessmentType] = useState('test');
  const [assessmentName, setAssessmentName] = useState('Test 1');
  const [customAssessmentName, setCustomAssessmentName] = useState('');
  const [showCustomName, setShowCustomName] = useState(false);
  const [sortBy, setSortBy] = useState('alphabetical');
  const [weight, setWeight] = useState(1.00);
  
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({}); // { student_id: score }
  
  const [classesLoading, setClassesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const isReadOnly = user?.role === 'school_admin' || user?.role === 'super_admin';

  const finalAssName = assessmentName === 'custom' ? customAssessmentName.trim() : assessmentName;

  const [subjectsList, setSubjectsList] = useState([]);

  // Fetch classes and registered subjects
  useEffect(() => {
    if (!activeSchoolId) return;
    setClassesLoading(true);
    Promise.all([
      api.get(`/schools/${activeSchoolId}/classes`).catch(() => ({ data: [] })),
      api.get(`/schools/${activeSchoolId}/subjects`).catch(() => ({ data: [] }))
    ]).then(([clsRes, subRes]) => {
      if (clsRes.data) {
        setClasses(clsRes.data);
        if (clsRes.data.length > 0) setSelectedClass(clsRes.data[0].id);
      }
      if (subRes.data && subRes.data.length > 0) {
        setSubjectsList(subRes.data);
        setSubject(subRes.data[0].name);
      }
    }).catch(err => console.error('Error fetching classes/subjects:', err))
    .finally(() => setClassesLoading(false));
  }, [activeSchoolId]);

  // Fetch student grades sheet when filters change
  useEffect(() => {
    if (!activeSchoolId || !selectedClass || !term) return;
    setLoading(true);
    setMessage({ type: '', text: '' });

    api.get(`/schools/${activeSchoolId}/classes/${selectedClass}/grades?term=${term}`)
      .then(res => {
        const rawList = Array.isArray(res.data) 
          ? res.data 
          : (res.data?.averaged_grades || res.data?.raw_grades || []);
        
        const studentMap = {};
        rawList.forEach(item => {
          const stId = item.student_id || item.id;
          if (!stId) return;
          if (!studentMap[stId]) {
            studentMap[stId] = {
              student_id: stId,
              id: stId,
              first_name: item.first_name || '',
              last_name: item.last_name || '',
              admission_number: item.admission_number || '',
              grades: []
            };
          }
          if (Array.isArray(item.scores)) {
            studentMap[stId].grades.push(...item.scores);
          } else if (item.subject) {
            studentMap[stId].grades.push(item);
          }
        });

        const uniqueStudents = Object.values(studentMap);
        setStudents(uniqueStudents);
        
        const initialScores = {};
        uniqueStudents.forEach(item => {
          const stId = item.student_id || item.id;
          const gradesArr = Array.isArray(item.scores) ? item.scores : (item.grades || []);
          const matchedGrade = gradesArr.find(
            g => (g.subject === subject || g.subject_name === subject) && 
            (g.assessment_type === assessmentType || !assessmentType)
          );
          initialScores[stId] = matchedGrade ? matchedGrade.grade_value : '';
        });
        setScores(initialScores);
      })
      .catch(err => {
        console.error('Error fetching grades:', err);
        setStudents([]);
        setMessage({ type: 'error', text: 'Failed to fetch grades sheet.' });
      })
      .finally(() => setLoading(false));
  }, [activeSchoolId, selectedClass, term, subject, assessmentType, assessmentName, customAssessmentName]);

  const handleScoreChange = (studentId, value) => {
    if (isReadOnly) return;
    setScores(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaveLoading(true);
    setMessage({ type: '', text: '' });

    const safeStudents = Array.isArray(students) ? students : [];
    const records = safeStudents.map(s => ({
      student_id: s.student_id || s.id,
      grade_value: scores[s.student_id || s.id] === '' ? 0 : Number(scores[s.student_id || s.id]),
      comments: null
    }));

    try {
      const res = await api.post(`/schools/${activeSchoolId}/classes/${selectedClass}/grades/batch`, {
        subject,
        assessment_type: assessmentType,
        term,
        weight: Number(weight),
        entries: records
      });
      if (res.data) {
        setMessage({ type: 'success', text: 'Grades entries saved successfully.' });
      }
    } catch (err) {
      console.error('Error saving grades:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save grades.' });
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Grades Registry</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Record student scores for term assessments and exams.</p>
        </div>
      </div>

      {/* Configuration filters bar */}
      <div className="glass-card rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
        <div className="flex flex-col space-y-1">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Class</label>
          <select
            disabled={classesLoading}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2"
          >
            {classesLoading ? (
              <option>Loading...</option>
            ) : (
              classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Term</label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2"
          >
            <option value="2026-T1">Term 1 2026</option>
            <option value="2026-T2">Term 2 2026</option>
            <option value="2026-T3">Term 3 2026</option>
          </select>
        </div>

        <div className="flex flex-col space-y-1 relative">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Subject (Auto-suggest)</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setShowSubjectDropdown(true);
            }}
            onFocus={() => setShowSubjectDropdown(true)}
            placeholder="Type subject name..."
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-teal-primary"
          />
          {showSubjectDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-paper border border-line-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
              {(subjectsList.length > 0 ? subjectsList : [
                { name: 'Mathematics', code: 'MTH' },
                { name: 'English Language', code: 'ENG' },
                { name: 'Shona', code: 'SNA' },
                { name: 'Ndebele', code: 'NDB' },
                { name: 'Combined Science', code: 'CSC' },
                { name: 'Heritage Studies', code: 'HST' },
                { name: 'Geography', code: 'GEO' },
                { name: 'History', code: 'HIS' },
                { name: 'Physics', code: 'PHY' },
                { name: 'Chemistry', code: 'CHM' },
                { name: 'Biology', code: 'BIO' },
                { name: 'Accounting', code: 'ACC' },
                { name: 'Business Studies', code: 'BST' },
                { name: 'Computer Science', code: 'CSC' }
              ]).filter(s => s.name.toLowerCase().includes((subject || '').toLowerCase())).length > 0 ? (
                (subjectsList.length > 0 ? subjectsList : [
                  { name: 'Mathematics', code: 'MTH' },
                  { name: 'English Language', code: 'ENG' },
                  { name: 'Shona', code: 'SNA' },
                  { name: 'Ndebele', code: 'NDB' },
                  { name: 'Combined Science', code: 'CSC' },
                  { name: 'Heritage Studies', code: 'HST' },
                  { name: 'Geography', code: 'GEO' },
                  { name: 'History', code: 'HIS' },
                  { name: 'Physics', code: 'PHY' },
                  { name: 'Chemistry', code: 'CHM' },
                  { name: 'Biology', code: 'BIO' },
                  { name: 'Accounting', code: 'ACC' },
                  { name: 'Business Studies', code: 'BST' },
                  { name: 'Computer Science', code: 'CSC' }
                ])
                .filter(s => s.name.toLowerCase().includes((subject || '').toLowerCase()))
                .map(s => (
                  <button
                    key={s.id || s.code || s.name}
                    type="button"
                    onClick={() => {
                      setSubject(s.name);
                      setShowSubjectDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-sans hover:bg-teal-primary/10 hover:text-teal-dark flex justify-between items-center transition-colors cursor-pointer"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-[10px] text-ink/40 font-mono">{s.code}</span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-[11px] text-ink/50 italic">
                  No registered curriculum subject matching "{subject}". Select from listed subjects.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Assessment Type</label>
          <select
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value)}
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2"
          >
            <option value="test">Mid-Term Test</option>
            <option value="exam">Final Term Exam</option>
            <option value="coursework">Coursework Project</option>
          </select>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Assessment Name</label>
          <select
            value={assessmentName}
            onChange={(e) => {
              setAssessmentName(e.target.value);
              setShowCustomName(e.target.value === 'custom');
            }}
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-semibold"
          >
            <option value="Test 1">Test 1</option>
            <option value="Test 2">Test 2</option>
            <option value="Test 3">Test 3</option>
            <option value="Quiz 1">Quiz 1</option>
            <option value="Quiz 2">Quiz 2</option>
            <option value="Assignment 1">Assignment 1</option>
            <option value="Assignment 2">Assignment 2</option>
            <option value="Project 1">Project 1</option>
            <option value="custom">+ Custom...</option>
          </select>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Sort Pupils By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary font-semibold"
          >
            <option value="alphabetical">Alphabetical Name</option>
            <option value="performance-desc">Performance (High → Low)</option>
            <option value="performance-asc">Performance (Low → High)</option>
          </select>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Weight Multiplier</label>
          <input
            type="number"
            step="0.05"
            min="0.1"
            max="1.0"
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 font-mono numeric-data"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {showCustomName && (
        <div className="glass-card rounded-2xl p-4 max-w-sm animate-fadeIn flex flex-col space-y-1 border border-line-border/30 bg-sage/5">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Enter Custom Assessment Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Practical Test 1"
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 focus:outline-none focus:border-teal-primary"
            value={customAssessmentName}
            onChange={(e) => setCustomAssessmentName(e.target.value)}
            disabled={isReadOnly}
          />
        </div>
      )}

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-sage/30 text-teal-dark border border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border border-brick-critical/20'
        }`}>
          <span>{message.text}</span>
        </div>
      )}

      {/* Grades Sheet Entry Table */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30 animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                  <th className="py-4 px-6">Student Name</th>
                  <th className="py-4 px-6 text-right">Raw Mark (%)</th>
                  <th className="py-4 px-6 text-center">Unified Subject Avg</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-ink/40 text-xs">
                      Loading grades sheet data...
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const list = Array.isArray(students) ? [...students] : [];
                    if (sortBy === 'performance-desc') {
                      list.sort((a, b) => {
                        const sA = scores[a.student_id] !== '' && scores[a.student_id] !== undefined ? Number(scores[a.student_id]) : -1;
                        const sB = scores[b.student_id] !== '' && scores[b.student_id] !== undefined ? Number(scores[b.student_id]) : -1;
                        return sB - sA;
                      });
                    } else if (sortBy === 'performance-asc') {
                      list.sort((a, b) => {
                        const sA = scores[a.student_id] !== '' && scores[a.student_id] !== undefined ? Number(scores[a.student_id]) : 999;
                        const sB = scores[b.student_id] !== '' && scores[b.student_id] !== undefined ? Number(scores[b.student_id]) : 999;
                        return sA - sB;
                      });
                    } else {
                      list.sort((a, b) => {
                        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                        return nameA.localeCompare(nameB);
                      });
                    }
                    return list.map((student) => {
                      const subjectGrades = (student.grades || []).filter(g => g.subject === subject);
                      const totalW = subjectGrades.reduce((sum, g) => sum + (parseFloat(g.weight) || 1), 0);
                      const weightedSum = subjectGrades.reduce((sum, g) => sum + ((parseFloat(g.grade_value) || 0) * (parseFloat(g.weight) || 1)), 0);
                      const subjectAvg = totalW > 0 ? (weightedSum / totalW).toFixed(1) : null;
                      const countTests = subjectGrades.length;

                      return (
                        <tr key={student.student_id} className="hover:bg-sage/5 transition-colors">
                          <td className="py-4 px-6 font-bold">{student.first_name} {student.last_name}</td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center space-x-2 justify-end w-32">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0"
                                className="w-20 px-3 py-1.5 border border-line-border rounded-lg text-right text-xs font-mono numeric-data disabled:opacity-60 disabled:cursor-not-allowed"
                                value={scores[student.student_id] !== undefined ? scores[student.student_id] : ''}
                                onChange={(e) => handleScoreChange(student.student_id, e.target.value)}
                                disabled={isReadOnly}
                              />
                              <span className="text-xs font-semibold text-ink/50">%</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {subjectAvg !== null ? (
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-teal-primary/10 text-teal-primary border border-teal-primary/20">
                                {subjectAvg}% <span className="text-[9px] text-ink/50 font-sans">({countTests} {countTests === 1 ? 'test' : 'tests'})</span>
                              </span>
                            ) : (
                              <span className="text-xs text-ink/35 font-mono">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider ${
                              scores[student.student_id] !== '' ? 'text-teal-primary' : 'text-ink/35'
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{scores[student.student_id] !== '' ? 'Entered' : 'Missing'}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
                {students.length === 0 && !loading && (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-ink/50 text-xs">
                      No students found in this class scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {students.length > 0 && !loading && !isReadOnly && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveLoading}
              className="flex items-center space-x-2 px-6 py-3 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-lg hover:shadow-teal-primary/25 transition-all cursor-pointer"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Grades...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Grades</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Grades;