import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  CalendarCheck,
  ChevronRight,
  Filter,
  CheckCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
  UserMinus,
  AlertCircle,
  AlertTriangle,
  FileText,
  Download
} from 'lucide-react';

// Helper to get Monday of a given date
const getMonday = (d) => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(dt.setDate(diff));
  return mon.toISOString().split('T')[0];
};

// ─── Attendance Reports View for School Admin ─────────────────────────────────
const AttendanceReports = ({ schoolId }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async (startOfWeek) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/schools/${schoolId}/attendance/weekly-reports?week_start=${startOfWeek}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching weekly reports:', err);
      setError('Failed to fetch attendance intelligence reports.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchReports(weekStart);
  }, [weekStart, fetchReports]);

  const handleDateChange = (e) => {
    const d = e.target.value;
    setSelectedDate(d);
    const mon = getMonday(d);
    setWeekStart(mon);
  };

  const getWeekRangeLabel = () => {
    if (!data?.week_start) return 'Selected Week';
    const start = new Date(data.week_start);
    const end = new Date(data.week_end);
    return `${start.toLocaleDateString('en-ZW', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-ZW', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-teal-primary mb-4" />
        <p className="text-xs font-sans text-ink/50">Compiling data science reports & patterns...</p>
      </div>
    );
  }

  // Calculate high-level stats
  const classesList = data?.classes || [];
  const totalClasses = classesList.length;
  const totalEnrolled = classesList.reduce((acc, c) => acc + c.student_count, 0);
  
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;
  classesList.forEach(c => {
    totalPresent += c.present;
    totalAbsent += c.absent;
    totalLate += c.late;
    totalExcused += c.excused;
  });
  const totalDaysMarked = totalPresent + totalAbsent + totalLate + totalExcused;
  const schoolWideRate = totalDaysMarked > 0 ? Math.round(((totalPresent + totalLate) / totalDaysMarked) * 1000) / 10 : 100;
  
  // Identify volatile classes (> 5% standard deviation)
  const volatileClassesCount = classesList.filter(c => c.volatility > 5.0).length;

  // Volatility consistency label helper
  const getVolatilityLabel = (v) => {
    if (v <= 2.0) return { label: 'Excellent Consistency', color: 'text-teal-primary bg-teal-primary/10 border-teal-primary/20' };
    if (v <= 5.0) return { label: 'Stable Presence', color: 'text-teal-dark bg-sage/30 border-teal-dark/10' };
    return { label: 'High Volatility', color: 'text-brick-critical bg-brick-critical/10 border-brick-critical/20' };
  };

  // Compile Data Science Insights Text
  const generateInsights = () => {
    const insights = [];
    
    // 1. Weekly slump check
    const dailyList = data?.daily_trends || [];
    if (dailyList.length > 0) {
      const sortedDaily = [...dailyList].sort((a, b) => a.rate - b.rate);
      const worstDay = sortedDaily[0];
      
      insights.push({
        type: 'slump',
        text: `Weekly Slump Alert: Presence reaches its lowest on ${worstDay.day} at ${worstDay.rate}%. Consider scheduling high-engagement activities on this day.`,
        severity: worstDay.rate < 90 ? 'critical' : 'warning'
      });
    }

    // 2. Reason factor check
    const reasons = data?.absence_reasons || {};
    const totalReasons = Object.values(reasons).reduce((a, b) => a + b, 0);
    if (totalReasons > 0) {
      const reasonEntries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
      const primaryReason = reasonEntries[0];
      const pct = Math.round((primaryReason[1] / totalReasons) * 100);
      if (primaryReason[0] === 'sick') {
        insights.push({
          type: 'health',
          text: `Health Index Flag: Sick-leave is the dominant absence driver, accounting for ${pct}% of weekly absences. Consider checking sanitary guidelines or seasonal warnings.`,
          severity: pct > 40 ? 'warning' : 'info'
        });
      } else if (primaryReason[0] === 'family') {
        insights.push({
          type: 'social',
          text: `Social Factors Flag: Family engagements and travel contribute to ${pct}% of missed school days. Review school calendar mappings to avoid holiday overlays.`,
          severity: 'info'
        });
      }
    }

    // 3. Volatility anomaly check
    const highlyVolatile = classesList.filter(c => c.volatility > 7.0);
    if (highlyVolatile.length > 0) {
      insights.push({
        type: 'anomaly',
        text: `Anomalous Behavior: ${highlyVolatile.map(c => c.class_name).join(', ')} exhibit extreme attendance fluctuations (volatility > 7% Std Dev), suggesting erratic attendance schedules or marking inconsistencies.`,
        severity: 'critical'
      });
    }

    return insights;
  };

  const insightsList = generateInsights();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-line-border/30 pb-5 gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Attendance Intelligence</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Compiled week-end dashboards, anomaly detection and patterns reports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-paper border border-line-border rounded-xl px-3 py-2">
            <span className="text-xs font-sans font-bold text-ink/50 uppercase">Select Week:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="text-xs font-sans text-ink bg-transparent border-none focus:outline-none"
            />
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center space-x-2 px-4 py-2 border border-line-border hover:bg-ink/5 text-ink text-xs font-sans font-bold rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-ink/75" />
            <span>Export Report PDF</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans">{error}</div>
      )}

      {/* KPI Stats Board */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-line-border/35 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink/45">School Presence Rate</span>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-display font-bold text-ink numeric-data">{schoolWideRate}%</span>
            {data?.prev_week_rate !== null && (
              <span className={`flex items-center text-[10px] font-bold ${
                schoolWideRate >= data.prev_week_rate ? 'text-teal-primary' : 'text-brick-critical'
              }`}>
                {schoolWideRate >= data.prev_week_rate ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {Math.abs(Math.round((schoolWideRate - data.prev_week_rate) * 10) / 10)}%
              </span>
            )}
          </div>
          <span className="text-[9px] text-ink/40 mt-1 block">Week: {getWeekRangeLabel()}</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/35 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink/45">Consistency Index</span>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-display font-bold text-ink numeric-data">{totalClasses - volatileClassesCount} <span className="text-xs font-sans font-normal text-ink/50">/ {totalClasses}</span></span>
          </div>
          <span className="text-[9px] text-ink/40 mt-1 block">Classes with &lt;5% Volatility</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/35 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink/45">Support Required</span>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-display font-bold text-brick-critical numeric-data">{data?.chronic_absentees?.length || 0}</span>
          </div>
          <span className="text-[9px] text-ink/40 mt-1 block">Students with attendance &lt; 85%</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-line-border/35 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink/45">Expected Pupil-Days</span>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-display font-bold text-ink numeric-data">{totalDaysMarked}</span>
          </div>
          <span className="text-[9px] text-ink/40 mt-1 block">Across {totalEnrolled} active pupils</span>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend (Bar visual) */}
        <div className="glass-card rounded-2xl p-5 border border-line-border/35 lg:col-span-2 space-y-4">
          <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
            <Activity className="w-4 h-4 text-teal-primary" />
            <span>Weekly Presence Vector</span>
          </h3>
          <div className="h-[200px] flex items-end justify-between px-4 pt-6 border-b border-line-border/30 pb-1">
            {data?.daily_trends?.map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1 group">
                <div className="relative w-full flex justify-center">
                  <span className="absolute -top-6 text-[10px] font-mono font-bold text-ink opacity-0 group-hover:opacity-100 transition-opacity bg-sage px-2 py-0.5 rounded shadow">{d.rate}%</span>
                  <div 
                    style={{ height: `${d.rate * 1.5}px` }}
                    className={`w-8 rounded-t-lg transition-all duration-500 shadow-sm ${
                      d.rate >= 95 ? 'bg-teal-primary/75 group-hover:bg-teal-primary' :
                      d.rate >= 90 ? 'bg-teal-dark/65 group-hover:bg-teal-dark' : 'bg-brick-critical/60 group-hover:bg-brick-critical'
                    }`}
                  />
                </div>
                <span className="text-[9px] uppercase tracking-wider font-bold text-ink/50 mt-2 font-mono">{d.day.substring(0, 3)}</span>
              </div>
            ))}
            {(!data?.daily_trends || data.daily_trends.length === 0) && (
              <div className="w-full h-full flex items-center justify-center text-xs italic text-ink/40">No weekly daily records mapped.</div>
            )}
          </div>
        </div>

        {/* Absence Reasons text categorization */}
        <div className="glass-card rounded-2xl p-5 border border-line-border/35 space-y-4">
          <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-warning" />
            <span>Absence Driver Breakdown</span>
          </h3>
          
          <div className="space-y-3 pt-2">
            {Object.entries(data?.absence_reasons || {}).map(([key, val]) => {
              const total = Object.values(data?.absence_reasons || {}).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              const colorClass = 
                key === 'sick' ? 'bg-teal-primary' :
                key === 'family' ? 'bg-teal-dark' :
                key === 'transport' ? 'bg-amber-warning' :
                key === 'truant' ? 'bg-brick-critical' : 'bg-ink/30';
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs font-sans">
                    <span className="capitalize text-ink/75 font-semibold">{key} reasons</span>
                    <span className="font-mono font-bold text-ink">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-ink/5 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${colorClass}`} />
                  </div>
                </div>
              );
            })}
            {Object.values(data?.absence_reasons || {}).reduce((a, b) => a + b, 0) === 0 && (
              <div className="text-center text-xs italic text-ink/40 py-10">No absence reasons mapped this week.</div>
            )}
          </div>
        </div>
      </div>

      {/* Volatility & Class Reports Table */}
      <div className="glass-card rounded-2xl border border-line-border/35 overflow-hidden">
        <div className="px-5 py-4 border-b border-line-border/30 bg-sage/10">
          <h3 className="font-sans font-bold text-sm text-ink">Class Attendance Consistency & Analytics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-sage/20 border-b border-line-border text-[10px] font-bold text-ink/75 uppercase tracking-wider">
                <th className="py-3 px-5">Class Grade Name</th>
                <th className="py-3 px-5 text-center">Pupils Enrolled</th>
                <th className="py-3 px-5 text-center">Weekly Presence</th>
                <th className="py-3 px-5 text-center">Volatility (Daily Std Dev)</th>
                <th className="py-3 px-5">Volatility Category</th>
                <th className="py-3 px-5 text-right">Details (P/A/L/E)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/50 text-xs text-ink">
              {classesList.map((c) => {
                const volMeta = getVolatilityLabel(c.volatility);
                return (
                  <tr key={c.class_id} className="hover:bg-sage/5 transition-colors">
                    <td className="py-3 px-5 font-bold text-sm">{c.class_name}</td>
                    <td className="py-3 px-5 text-center font-mono font-bold text-ink/70">{c.student_count}</td>
                    <td className="py-3 px-5 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        <span className={`font-mono font-bold text-xs ${c.rate >= 95 ? 'text-teal-primary' : c.rate >= 90 ? 'text-teal-dark' : 'text-brick-critical'}`}>{c.rate}%</span>
                        <div className="w-12 h-1 bg-ink/5 rounded-full overflow-hidden hidden sm:block">
                          <div style={{ width: `${c.rate}%` }} className={`h-full rounded-full ${c.rate >= 95 ? 'bg-teal-primary' : c.rate >= 90 ? 'bg-teal-dark' : 'bg-brick-critical'}`} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-center font-mono font-bold text-ink/60">±{c.volatility}%</td>
                    <td className="py-3 px-5">
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${volMeta.color}`}>{volMeta.label}</span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[10px] text-ink/50">
                      <span className="text-teal-primary font-bold">{c.present}</span>
                      <span> / </span>
                      <span className="text-brick-critical font-bold">{c.absent}</span>
                      <span> / </span>
                      <span className="text-amber-warning font-bold">{c.late}</span>
                      <span> / </span>
                      <span className="text-ink/70">{c.excused}</span>
                    </td>
                  </tr>
                );
              })}
              {classesList.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-10 text-center italic text-ink/40">No classes registered at this school.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Anomaly & Chronic Absentee Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Science AI Insights */}
        <div className="glass-card rounded-2xl p-5 border border-line-border/35 space-y-4">
          <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
            <Activity className="w-4.5 h-4.5 text-teal-primary" /><span>Compiled Statistical Insights</span>
          </h3>
          <div className="space-y-3">
            {insightsList.map((ins, idx) => (
              <div key={idx} className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
                ins.severity === 'critical' ? 'bg-brick-critical/5 border-brick-critical/15 text-brick-critical' :
                ins.severity === 'warning' ? 'bg-amber-warning/5 border-amber-warning/20 text-amber-dark' : 'bg-teal-primary/5 border-teal-primary/15 text-teal-dark'
              }`}>
                {ins.severity === 'critical' ? (
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-brick-critical" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <p className="font-sans leading-relaxed">{ins.text}</p>
              </div>
            ))}
            {insightsList.length === 0 && (
              <p className="text-xs text-ink/40 italic py-6 text-center">No anomalies or significant patterns detected this week. Attendance levels are stable.</p>
            )}
          </div>
        </div>

        {/* Chronic Absentees Roster */}
        <div className="glass-card rounded-2xl p-5 border border-line-border/35 space-y-4">
          <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
            <UserMinus className="w-4.5 h-4.5 text-brick-critical" /><span>Chronic Absentees / Attendance Risk</span>
          </h3>
          <div className="space-y-2">
            {data?.chronic_absentees?.map((s, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-ink/5 rounded-xl border border-line-border/30">
                <div>
                  <span className="font-bold text-xs text-ink block">{s.student_name}</span>
                  <span className="text-[10px] text-ink/50 block font-sans">{s.class_name} • Mapped absences: {s.absent_days} days</span>
                </div>
                <span className="font-mono font-bold text-xs bg-brick-critical/10 text-brick-critical px-2.5 py-1 rounded-lg">
                  {s.attendance_rate}% Rate
                </span>
              </div>
            ))}
            {(!data?.chronic_absentees || data.chronic_absentees.length === 0) && (
              <p className="text-xs text-ink/40 italic py-6 text-center">No chronically absent students listed for this period.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Default Daily Register Grid (Super Admins, Teachers) ─────────────────────
const AttendanceRegister = () => {
  const { activeSchoolId, user } = useAuth();
  const isSchoolAdmin = user?.role === 'school_admin';
  
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!activeSchoolId) return;
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
  }, [activeSchoolId]);

  useEffect(() => {
    if (!activeSchoolId || !selectedClass || !date) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    api.get(`/schools/${activeSchoolId}/classes/${selectedClass}/attendance?date=${date}`)
      .then(res => {
        if (res.data) {
          const allStuds = res.data.students || [];
          const records = res.data.records || [];
          setStudents(allStuds);
          
          const initialAtt = {};
          const initialRem = {};
          
          const recordMap = {};
          records.forEach(r => {
            recordMap[r.student_id] = r;
          });

          allStuds.forEach(item => {
            const match = recordMap[item.student_id];
            initialAtt[item.student_id] = match ? (match.status || 'present') : 'present';
            initialRem[item.student_id] = match ? (match.remarks || '') : '';
          });
          setAttendance(initialAtt);
          setRemarks(initialRem);
        }
      })
      .catch(err => {
        console.error('Error fetching attendance register:', err);
        setMessage({ type: 'error', text: 'Failed to fetch register.' });
      })
      .finally(() => setLoading(false));
  }, [activeSchoolId, selectedClass, date]);

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleRemarkChange = (studentId, val) => {
    setRemarks(prev => ({
      ...prev,
      [studentId]: val
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setMessage({ type: '', text: '' });

    const payload = students.map(s => ({
      student_id: s.student_id,
      status: attendance[s.student_id],
      remarks: remarks[s.student_id]
    }));

    try {
      const res = await api.post(`/schools/${activeSchoolId}/classes/${selectedClass}/attendance`, {
        date: date,
        records: payload
      });
      if (res.data) {
        setMessage({ type: 'success', text: 'Attendance register saved successfully.' });
      }
    } catch (err) {
      console.error('Error saving register:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save register.' });
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Daily Register</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Take and review attendance registers per class.</p>
        </div>
      </div>

      {/* Filter and Date selectors */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-teal-primary" />
          <span className="text-xs font-sans font-bold text-ink/60 uppercase">Filter</span>
          <select
            disabled={classesLoading}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-teal-primary"
          >
            {classesLoading ? (
              <option>Loading classes...</option>
            ) : (
              classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <label className="text-xs font-sans font-bold text-ink/60 uppercase">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-line-border rounded-xl text-xs font-sans text-ink bg-paper focus:outline-none focus:border-teal-primary"
          />
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-sage/30 text-teal-dark border border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border border-brick-critical/20'
        }`}>
          <span>{message.text}</span>
        </div>
      )}

      {/* Register List */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sage/20 border-b border-line-border text-xs font-sans font-bold text-ink/75 uppercase tracking-wider">
                  <th className="py-4 px-6">Student Name</th>
                  <th className="py-4 px-6 text-center">Register Status</th>
                  <th className="py-4 px-6">Remarks / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-ink/40 text-xs">
                      Loading class register data...
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.student_id} className="hover:bg-sage/5 transition-colors">
                      <td className="py-4 px-6 font-bold">{student.student_name || `Student #${student.student_id}`}</td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-flex rounded-xl bg-sage/25 p-1 border border-line-border/40">
                          {['present', 'absent', 'late', 'excused'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={isSchoolAdmin}
                              onClick={() => handleStatusChange(student.student_id, status)}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                                isSchoolAdmin ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                attendance[student.student_id] === status
                                  ? status === 'present' ? 'bg-teal-primary text-paper shadow-sm' :
                                    status === 'absent' ? 'bg-brick-critical text-paper shadow-sm' :
                                      status === 'late' ? 'bg-amber-warning text-paper shadow-sm' :
                                        'bg-ink/65 text-paper shadow-sm'
                                  : 'text-ink/60 hover:text-ink hover:bg-white/40'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <input
                          type="text"
                          disabled={isSchoolAdmin}
                          placeholder={isSchoolAdmin ? "No remarks added" : "Add remark (e.g. sick note)"}
                          value={remarks[student.student_id] || ''}
                          onChange={(e) => handleRemarkChange(student.student_id, e.target.value)}
                          className="w-full px-3 py-1.5 border border-line-border/50 rounded-lg text-xs bg-white/35 focus:outline-none focus:border-teal-primary font-sans disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </td>
                    </tr>
                  ))
                )}
                {students.length === 0 && !loading && (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-ink/50 text-xs">
                      No students registered in this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {students.length > 0 && !loading && !isSchoolAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveLoading}
              className="flex items-center space-x-2 px-6 py-3 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-lg hover:shadow-teal-primary/25 transition-all cursor-pointer"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Register...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Submit Register</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

// ─── Parent / Guardian Attendance View ─────────────────────────────────────────
const ParentAttendanceView = ({ schoolId }) => {
  const [kids, setKids] = useState([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [profile, setProfile] = useState(null);
  const [loadingKids, setLoadingKids] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [err, setErr] = useState('');

  // Fetch children list on mount
  useEffect(() => {
    setLoadingKids(true);
    api.get(`/schools/${schoolId}/students`)
      .then(res => {
        setKids(res.data || []);
        if (res.data?.length > 0) {
          setSelectedKidId(res.data[0].id);
        }
      })
      .catch(() => setErr('Failed to fetch linked children.'))
      .finally(() => setLoadingKids(false));
  }, [schoolId]);

  // Fetch selected kid details
  useEffect(() => {
    if (!selectedKidId) return;
    setLoadingProfile(true);
    api.get(`/schools/${schoolId}/students/${selectedKidId}/profile`)
      .then(res => setProfile(res.data))
      .catch(() => setErr('Failed to fetch attendance details.'))
      .finally(() => setLoadingProfile(false));
  }, [schoolId, selectedKidId]);

  if (loadingKids) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-primary mb-2" />
        <p className="text-xs text-ink/50 font-sans">Locating linked student profiles...</p>
      </div>
    );
  }

  const activeKidName = kids.find(k => String(k.id) === String(selectedKidId)) ? 
    `${kids.find(k => String(k.id) === String(selectedKidId)).first_name} ${kids.find(k => String(k.id) === String(selectedKidId)).last_name}` : '';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Attendance Log</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Monitor daily class presence logs and tutor reports for your ward.</p>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-start">
        <div className="flex flex-col space-y-1 w-full sm:w-48">
          <label className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Select Child (Ward)</label>
          <select
            value={selectedKidId}
            onChange={(e) => setSelectedKidId(e.target.value)}
            className="w-full bg-paper border border-line-border text-ink text-xs font-sans rounded-xl px-3 py-2 font-bold text-teal-dark"
          >
            {kids.map(k => (
              <option key={k.id} value={k.id}>{k.first_name} {k.last_name}</option>
            ))}
          </select>
        </div>
        {profile?.student?.class_name && (
          <div className="sm:ml-auto flex items-center space-x-1.5 text-xs text-teal-dark bg-sage/35 border border-teal-primary/20 px-3 py-2 rounded-xl mt-4 sm:mt-0 font-sans font-bold animate-fadeIn">
            <span>Class: {profile.student.class_name}</span>
          </div>
        )}
      </div>

      {err && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{err}</div>}

      {kids.length === 0 ? (
        <div className="p-12 text-center glass-card rounded-2xl border border-line-border/30">
          <p className="text-sm text-ink/55 font-sans">No student profile is currently linked to your guardian account.</p>
        </div>
      ) : loadingProfile || !profile ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary mb-2" />
          <p className="text-xs text-ink/50 font-sans">Retrieving check-in entries...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI summaries */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 border border-line-border/25 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Attendance Rate</span>
              <h4 className="text-2xl font-display font-bold text-teal-primary mt-2">{profile.attendance_summary?.percentage}%</h4>
            </div>
            <div className="bg-white p-5 border border-line-border/25 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Days Present</span>
              <h4 className="text-2xl font-display font-bold text-teal-dark mt-2">{profile.attendance_summary?.present} days</h4>
            </div>
            <div className="bg-white p-5 border border-line-border/25 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Days Absent</span>
              <h4 className="text-2xl font-display font-bold text-brick-critical mt-2">{profile.attendance_summary?.absent} days</h4>
            </div>
            <div className="bg-white p-5 border border-line-border/25 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Total Active Days</span>
              <h4 className="text-2xl font-display font-bold text-ink mt-2">{profile.attendance_summary?.total_days} days</h4>
            </div>
          </div>

          {/* Daily list */}
          <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30 shadow-sm bg-white">
            <div className="p-5 border-b border-line-border/30 bg-sage/5">
              <h3 className="font-sans font-bold text-sm text-ink">Daily Check-In Roster for {activeKidName}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                <thead>
                  <tr className="bg-sage/10 border-b border-line-border text-ink/60 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-6 w-48">Date</th>
                    <th className="py-3.5 px-6 w-36 text-center">Status</th>
                    <th className="py-3.5 px-6">Tutor Remarks / Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border/20">
                  {profile.attendance_list?.map((att, idx) => (
                    <tr key={idx} className="hover:bg-sage/5 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-ink/75 font-semibold">{new Date(att.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td className="py-3.5 px-6 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          att.status === 'present' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
                        }`}>
                          {att.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-ink/65 italic font-medium">{att.remarks || '—'}</td>
                    </tr>
                  ))}
                  {(!profile.attendance_list || profile.attendance_list.length === 0) && (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-ink/45 italic">No attendance records logged for this student yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Controller Router ───────────────────────────────────────────────────
const Attendance = () => {
  const { user, activeSchoolId } = useAuth();
  const isSchoolAdmin = user?.role === 'school_admin';

  if (user?.role === 'parent') {
    return <ParentAttendanceView schoolId={activeSchoolId} />;
  }
  if (isSchoolAdmin) {
    return <AttendanceReports schoolId={activeSchoolId} />;
  }
  return <AttendanceRegister />;
};

export default Attendance;