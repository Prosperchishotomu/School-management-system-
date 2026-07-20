import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  FileText,
  Lock,
  Unlock,
  Printer,
  Loader2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

// NOTE: Results.jsx represents formal term-end report cards and published, aggregated results/ranks.
// For ongoing coursework or individual assessment mark entries, see Grades.jsx.
const Results = () => {
  const { activeSchoolId, user } = useAuth();
  const isParent = user?.role === 'parent';
  
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [term, setTerm] = useState('2026-T1');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(true);
  const [publishLoading, setPublishLoading] = useState(false);
  
  const [message, setMessage] = useState({ type: '', text: '' });

  // Parent states
  const [kids, setKids] = useState([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [kidProfile, setKidProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch classes (for admins/teachers)
  useEffect(() => {
    if (!activeSchoolId || isParent) return;
    setClassesLoading(true);
    api.get(`/schools/${activeSchoolId}/classes`)
      .then(res => {
        if (res.data) {
          setClasses(res.data);
          if (res.data.length > 0) setSelectedClass(res.data[0].id);
        }
      })
      .catch(err => console.error('Error fetching classes:', err))
      .finally(() => setClassesLoading(false));
  }, [activeSchoolId, isParent]);

  // Fetch parent's children (for parents)
  useEffect(() => {
    if (!activeSchoolId || !isParent) return;
    api.get(`/schools/${activeSchoolId}/students`)
      .then(res => {
        if (res.data) {
          setKids(res.data);
          if (res.data.length > 0) setSelectedKidId(res.data[0].id);
        }
      })
      .catch(err => console.error('Error fetching children:', err));
  }, [activeSchoolId, isParent]);

  const fetchResults = () => {
    if (isParent) return;
    if (!activeSchoolId || !selectedClass || !term) return;
    setLoading(true);
    setMessage({ type: '', text: '' });

    api.get(`/schools/${activeSchoolId}/classes/${selectedClass}/results?term=${term}`)
      .then(res => {
        if (res.data) {
          setResults(res.data);
        }
      })
      .catch(err => {
        console.error('Error fetching results:', err);
        setResults([]);
        setMessage({ type: 'error', text: 'No grades are recorded yet for rank calculation.' });
      })
      .finally(() => setLoading(false));
  };

  // Fetch child profile & term ranks (runs for both parent view and admin drill-down view)
  useEffect(() => {
    if (!activeSchoolId || !selectedKidId) return;
    setProfileLoading(true);
    setLoading(true);
    setKidProfile(null);
    setResults([]);

    const loadParentKidDetails = async () => {
      try {
        const profRes = await api.get(`/schools/${activeSchoolId}/students/${selectedKidId}/profile`);
        setKidProfile(profRes.data);

        const classId = profRes.data?.student?.class_id;
        if (classId) {
          const resultsRes = await api.get(`/schools/${activeSchoolId}/classes/${classId}/results?term=${term}`);
          setResults(resultsRes.data || []);
        }
      } catch (err) {
        console.error('Error loading kid profile details:', err);
      } finally {
        setProfileLoading(false);
        setLoading(false);
      }
    };
    loadParentKidDetails();
  }, [activeSchoolId, isParent, selectedKidId, term]);

  // Fetch results when class/term changes
  useEffect(() => {
    fetchResults();
  }, [activeSchoolId, selectedClass, term]);

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to lock and publish Term results? This locks all grade entry sheets.')) {
      return;
    }
    
    setPublishLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await api.post(`/schools/${activeSchoolId}/results/publish`, {
        class_id: selectedClass,
        term
      });
      if (res.data) {
        setMessage({ type: 'success', text: 'Results computed, locked, and published.' });
        fetchResults(); // Reload
      }
    } catch (err) {
      console.error('Error publishing results:', err);
      setMessage({ type: 'error', text: err.message || 'Publishing results failed.' });
    } finally {
      setPublishLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost/backend/api/v1';
    const exportUrl = `${apiBase}/schools/${activeSchoolId}/classes/${selectedClass}/results/export?term=${term}&token=${sessionStorage.getItem('schoolbase_token')}`;
    window.open(exportUrl, '_blank');
  };

  const isPublished = results.some(r => r.status === 'published');

  // Resolve selected kid details
  const kidRank = results.find(r => String(r.student_id) === String(selectedKidId));
  const activeKidName = isParent 
    ? (kids.find(k => String(k.id) === String(selectedKidId)) ? `${kids.find(k => String(k.id) === String(selectedKidId)).first_name} ${kids.find(k => String(k.id) === String(selectedKidId)).last_name}` : '') 
    : (kidProfile?.student ? `${kidProfile.student.first_name} ${kidProfile.student.last_name}` : '');

  if (isParent || selectedKidId) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn printable-area">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-line-border/30 pb-4 non-printable">
          <div>
            <h2 className="text-3xl font-display font-bold text-ink">Report Cards</h2>
            <p className="text-sm font-sans text-ink/60 mt-1">Review official term report cards and grade rankings for your child.</p>
          </div>
          <div className="flex items-center space-x-2">
            {!isParent && (
              <button
                onClick={() => {
                  setSelectedKidId('');
                  setKidProfile(null);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-colors cursor-pointer non-printable mr-2"
              >
                <span>← Back to Mark List</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3.5 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-colors cursor-pointer non-printable"
            >
              <Printer className="w-3.5 h-3.5 text-teal-primary" />
              <span>Print Report Card</span>
            </button>
          </div>
        </div>

        {/* Parent Selectors Bar */}
        {isParent && (
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-start non-printable">
          <div className="flex flex-col space-y-1 w-full sm:w-48">
            <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Select Child (Ward)</label>
            <select
              value={selectedKidId}
              onChange={(e) => setSelectedKidId(e.target.value)}
              className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 font-bold text-teal-dark animate-fadeIn"
            >
              {kids.map(k => (
                <option key={k.id} value={k.id}>{k.first_name} {k.last_name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1 w-full sm:w-48">
            <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Academic Term</label>
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

          {kidProfile?.student?.class_name && (
            <div className="sm:ml-auto flex items-center space-x-1.5 text-xs text-teal-dark bg-sage/35 border border-teal-primary/20 px-3 py-2 rounded-xl mt-4 sm:mt-0 font-sans font-bold">
              <span>Class Assigned: {kidProfile.student.class_name}</span>
            </div>
          )}
          </div>
        )}

        {/* Main printable report card container */}
        <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30 shadow-sm print:border-none print:shadow-none bg-white p-6 sm:p-8 space-y-8">
          
          {/* Printable Report Card Header */}
          <div className="text-center space-y-2 border-b border-line-border pb-6 pt-2">
            <h1 className="text-3xl font-display font-bold text-ink">{user?.school_name || 'Harare Primary School'}</h1>
            <p className="text-xs font-sans uppercase tracking-widest text-ink/60 font-bold">Official Student Termly Report Card</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left max-w-3xl mx-auto pt-6 text-xs text-ink/70">
              <div>
                <span className="block text-[9px] font-bold text-ink/45 uppercase tracking-wider">Student Name</span>
                <span className="text-sm font-bold text-ink">{activeKidName || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-ink/45 uppercase tracking-wider">Admission Number</span>
                <span className="text-sm font-mono font-bold text-ink">{kidProfile?.student?.admission_number || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-ink/45 uppercase tracking-wider">Grade / Class</span>
                <span className="text-sm font-bold text-ink">{kidProfile?.student?.class_name || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* Ranks dashboard block */}
          {kidRank ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-sage/10 p-4 border border-line-border/30 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Class Rank</span>
                <div className="mt-2">
                  <h4 className="text-xl font-bold font-mono text-teal-dark">
                    {kidRank.rank} <span className="text-[10px] text-ink/40 font-normal">of {kidRank.class_total}</span>
                  </h4>
                </div>
              </div>
              <div className="bg-sage/10 p-4 border border-line-border/30 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Form Position</span>
                <div className="mt-2">
                  <h4 className="text-xl font-bold font-mono text-teal-primary">
                    {kidRank.form_rank || '—'} <span className="text-[10px] text-ink/40 font-normal">of {kidRank.form_total || '—'}</span>
                  </h4>
                </div>
              </div>
              <div className="bg-sage/10 p-4 border border-line-border/30 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Term Average</span>
                <div className="mt-2">
                  <h4 className="text-xl font-bold font-mono text-ink">{kidRank.overall_percentage}%</h4>
                </div>
              </div>
              <div className="bg-sage/10 p-4 border border-line-border/30 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Grade Status</span>
                <div className="mt-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    kidRank.pass_status === 'pass' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
                  }`}>
                    {kidRank.pass_status} ({kidRank.grade})
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-warning/15 border border-amber-warning/30 rounded-xl text-xs text-amber-warning font-semibold">
              ⚠️ Official ranks and averages have not yet been locked/published for this term.
            </div>
          )}

          {/* Subject grades table */}
          <div className="border border-line-border/35 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sage/15 border-b border-line-border/30 text-[10px] font-sans font-bold text-ink/70 uppercase tracking-wider">
                  <th className="py-3 px-5">Subject</th>
                  <th className="py-3 px-5">Assessment Type</th>
                  <th className="py-3 px-5 text-right">Marks / Grade Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/20 text-xs font-sans text-ink">
                {profileLoading ? (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-ink/40">
                      Loading grades list...
                    </td>
                  </tr>
                ) : kidProfile?.grades_summary?.filter(g => g.term === term).map((g, idx) => (
                  <tr key={idx} className="hover:bg-sage/5">
                    <td className="py-3 px-5 font-bold">{g.subject}</td>
                    <td className="py-3 px-5 capitalize text-ink/60">{g.assessment_type}</td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-teal-primary text-sm">{g.grade_value}</td>
                  </tr>
                ))}
                {(!kidProfile?.grades_summary || kidProfile.grades_summary.filter(g => g.term === term).length === 0) && !profileLoading && (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-ink/45 italic">
                      No grades recorded for this term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn printable-area">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4 non-printable">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Results Ledger</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Review computed grade ranks, pass ratios, and lock term logs.</p>
        </div>
        <div className="flex items-center space-x-2">
          {results.length > 0 && (
            <>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3.5 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-teal-primary" />
                <span>Print Slips</span>
              </button>
              {(user?.role === 'school_admin' || user?.role === 'super_admin') && (
                <button
                  onClick={handleExport}
                  className="flex items-center space-x-1.5 px-3.5 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-primary" strokeWidth={2.5} />
                  <span>Export CSV</span>
                </button>
              )}
            </>
          )}
          {user?.role === 'school_admin' && results.length > 0 && !isPublished && (
            <button
              onClick={handlePublish}
              disabled={publishLoading}
              className="flex items-center space-x-1.5 px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {publishLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>Publish & Lock</span>
            </button>
          )}
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-start non-printable">
        <div className="flex flex-col space-y-1 w-full sm:w-48">
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

        <div className="flex flex-col space-y-1 w-full sm:w-48">
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

        {isPublished && (
          <div className="sm:ml-auto flex items-center space-x-1.5 text-xs text-teal-dark bg-sage/35 border border-teal-primary/20 px-3 py-2 rounded-xl mt-4 sm:mt-0 font-sans font-bold">
            <Lock className="w-3.5 h-3.5 text-teal-primary" />
            <span>Grade entries locked. Results published.</span>
          </div>
        )}
        {!isPublished && results.length > 0 && (
          <div className="sm:ml-auto flex items-center space-x-1.5 text-xs text-amber-warning bg-amber-warning/5 border border-amber-warning/20 px-3 py-2 rounded-xl mt-4 sm:mt-0 font-sans font-bold">
            <Unlock className="w-3.5 h-3.5 text-amber-warning" />
            <span>Draft results. Open for grading.</span>
          </div>
        )}
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 non-printable ${
          message.type === 'success' ? 'bg-sage/30 text-teal-dark border border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border border-brick-critical/20'
        }`}>
          <span>{message.text}</span>
        </div>
      )}

      {/* Results Printable Ledger Report Card Grid */}
      <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30 shadow-sm print:border-none print:shadow-none bg-white">
        
        {/* Printable Report Header */}
        <div className="hidden print:block text-center space-y-2 border-b border-line-border pb-6 pt-4">
          <h1 className="text-3xl font-display font-bold text-ink">{user?.school_name || 'SchoolBase Primary'}</h1>
          <p className="text-xs font-sans uppercase tracking-widest text-ink/60">Official Consolidated Marksheet Ledger</p>
          <p className="text-xs font-sans text-ink/75 font-semibold">
            Class: {classes.find(c => String(c.id) === String(selectedClass))?.name || ''} | Term: {term}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                <th className="py-4 px-6 text-center w-36">Class Position</th>
                <th className="py-4 px-6 text-center w-36">Form Position</th>
                <th className="py-4 px-6">Student Name</th>
                <th className="py-4 px-6 text-center">Term Avg (%)</th>
                <th className="py-4 px-6 text-center">Assigned Grade</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
              {loading ? (
                <tr className="non-printable">
                  <td colSpan="6" className="py-12 text-center text-ink/40 text-xs">
                    Computing marks ledger averages...
                  </td>
                </tr>
              ) : (
                results.map((res, idx) => (
                  <tr key={idx} className="hover:bg-sage/5 transition-colors">
                    <td className="py-4 px-6 text-center font-mono font-bold text-teal-dark numeric-data">
                      {res.rank} <span className="text-[10px] text-ink/45 font-normal">of {res.class_total || results.length}</span>
                    </td>
                    <td className="py-4 px-6 text-center font-mono font-bold text-teal-primary/80 numeric-data">
                      {res.form_rank || '—'} <span className="text-[10px] text-ink/45 font-normal">of {res.form_total || '—'}</span>
                    </td>
                    <td className="py-4 px-6 font-bold">{res.student_name || `${res.first_name} ${res.last_name}`}</td>
                    <td className="py-4 px-6 text-center font-mono font-bold numeric-data">{res.overall_percentage}%</td>
                    <td className="py-4 px-6 text-center font-mono font-bold text-teal-primary">{res.grade}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        res.pass_status === 'pass' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
                      }`}>
                        {res.pass_status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right pr-6">
                      <button
                        onClick={() => setSelectedKidId(res.student_id)}
                        className="px-2.5 py-1 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-dark font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                      >
                        View Report Card
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {results.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-ink/50 text-xs">
                    No results calculated. Enter scores in Grades registry first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Results;