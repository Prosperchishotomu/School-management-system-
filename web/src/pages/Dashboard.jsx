import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import {
  Users, CheckCircle, AlertCircle, DollarSign, Calendar, BookOpen,
  Shield, MessageSquare, Clock, TrendingUp, TrendingDown, Loader2,
  ChevronRight, ChevronDown, Send, AlertTriangle, Activity, Bell,
  UserCheck, UserX, FileText, Star, Flag, X, Search, GraduationCap, Eye
} from 'lucide-react';
import { MiniBarChart } from '../components/charts/MiniBarChart';
import { MiniDonutChart } from '../components/charts/MiniDonutChart';
import DrillDownModal from '../components/ui/DrillDownModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pctColor = (pct) => {
  if (pct >= 85) return 'text-teal-primary';
  if (pct >= 60) return 'text-amber-warning';
  return 'text-brick-critical';
};

const pctBarColor = (pct) => {
  if (pct >= 85) return 'bg-teal-primary';
  if (pct >= 60) return 'bg-amber-warning';
  return 'bg-brick-critical';
};

const AnimatedCount = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }
    const isDecimal = value % 1 !== 0;
    let start = 0;
    const end = value;
    if (start === end) return;

    const duration = 1000; // ms
    const increment = end > start ? 1 : -1;
    const stepTime = Math.max(Math.floor(duration / Math.abs(end - start)), 20);
    
    let current = start;
    const timer = setInterval(() => {
      if (isDecimal) {
        current += (end - current) * 0.15;
        if (Math.abs(end - current) < 0.1) {
          setDisplayValue(end);
          clearInterval(timer);
        } else {
          setDisplayValue(parseFloat(current.toFixed(1)));
        }
      } else {
        current += Math.ceil((end - current) / 8) * increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
          setDisplayValue(end);
          clearInterval(timer);
        } else {
          setDisplayValue(current);
        }
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue}</>;
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, suffix = '', icon: Icon, sublabel, trend, color = 'teal' }) => {
  const colorMap = {
    teal:  { bg: 'bg-teal-primary/10', ic: 'text-teal-primary', val: 'text-ink' },
    amber: { bg: 'bg-amber-warning/10', ic: 'text-amber-warning', val: 'text-amber-warning' },
    red:   { bg: 'bg-brick-critical/10', ic: 'text-brick-critical', val: 'text-brick-critical' },
    green: { bg: 'bg-teal-primary/10', ic: 'text-teal-primary', val: 'text-teal-primary' },
  };
  const c = colorMap[color] || colorMap.teal;
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col justify-between min-h-[130px]">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider leading-tight pr-2">{label}</span>
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${c.ic}`} style={{ width: 18, height: 18 }} />
        </div>
      </div>
      <div>
        <h4 className={`text-3xl font-display font-bold numeric-data ${c.val}`}>
          {typeof value === 'number' ? <AnimatedCount value={value} /> : (value ?? '—')}{suffix}
        </h4>
        {sublabel && <p className="text-[10px] font-sans text-ink/50 mt-1">{sublabel}</p>}
      </div>
    </div>
  );
};

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex flex-wrap gap-3 items-start justify-between mb-5">
    <div className="flex items-center space-x-3">
      <div className="w-9 h-9 rounded-xl bg-teal-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-teal-primary" />
      </div>
      <div>
        <h2 className="text-base font-sans font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-[11px] text-ink/50 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ─── Comment Modal ─────────────────────────────────────────────────────────────
const CommentModal = ({ open, onClose, onSubmit, title, saving }) => {
  const [text, setText] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text); setText('');
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(28,37,48,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-display font-bold text-ink flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-teal-primary"/><span>{title}</span>
          </h3>
          <button onClick={onClose} className="text-ink/50 hover:text-ink cursor-pointer"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            autoFocus rows={4} required
            placeholder="Write your comment or note..."
            className="w-full glass-input rounded-xl text-sm resize-none p-3"
            value={text} onChange={e => setText(e.target.value)}
          />
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-line-border rounded-xl text-sm text-ink/70 hover:bg-sage/10 cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving || !text.trim()} className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper rounded-xl text-sm font-semibold cursor-pointer flex items-center space-x-2 disabled:opacity-50">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
              <Send className="w-3.5 h-3.5"/><span>Post Comment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Attendance Section ────────────────────────────────────────────────────────
const AttendanceSection = ({ data, schoolId, onCommentPosted }) => {
  const [drillClass, setDrillClass]     = useState(null);
  const [drillStudents, setDrillStudents] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [commentFor, setCommentFor]     = useState(null);
  const [saving, setSaving]             = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const openDrill = async (cls) => {
    setDrillClass(cls);
    setDrillLoading(true);
    try {
      const res = await api.get(`/schools/${schoolId}/classes/${cls.id}/attendance?date=${today}`);
      setDrillStudents(res.data?.records || []);
    } catch { setDrillStudents([]); }
    finally { setDrillLoading(false); }
  };

  const handleComment = async (text) => {
    setSaving(true);
    try {
      await api.post(`/schools/${schoolId}/comments`, {
        report_type: 'attendance', ref_id: commentFor?.id, ref_date: today, comment: text
      });
      setCommentFor(null); onCommentPosted();
    } catch { } finally { setSaving(false); }
  };

  return (
    <section className="space-y-4">
      <SectionHeader icon={UserCheck} title="Attendance Command View"
        subtitle={`Register status for ${today} — click any class to see full pupil list`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map(cls => (
          <div key={cls.id} className={`glass-card rounded-2xl p-5 flex flex-col space-y-3 border-l-4 transition-all hover:shadow-md ${
            cls.status === 'submitted' ? 'border-teal-primary/50' : 'border-amber-warning/50'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-sans font-bold text-sm text-ink">{cls.name}</h3>
                <p className="text-[10px] text-ink/50 mt-0.5">Grade {cls.grade_level}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                cls.status === 'submitted' ? 'bg-sage/40 text-teal-dark' : 'bg-amber-warning/10 text-amber-warning'
              }`}>{cls.status}</span>
            </div>

            {cls.status === 'submitted' ? (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-sans font-semibold text-ink/60">
                    <span>Presence</span>
                    <span className={`font-bold text-xs ${pctColor(cls.pct)}`}>{cls.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-line-border/40">
                    <div className={`h-1.5 rounded-full ${pctBarColor(cls.pct)}`} style={{ width: `${cls.pct}%` }}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-sans">
                  <div className="bg-sage/15 rounded-lg p-2 text-center">
                    <p className="text-teal-primary font-bold text-lg numeric-data">{cls.present}</p>
                    <p className="text-ink/50">Present</p>
                  </div>
                  <div className="bg-brick-critical/5 rounded-lg p-2 text-center">
                    <p className="text-brick-critical font-bold text-lg numeric-data">{cls.absent}</p>
                    <p className="text-ink/50">Absent</p>
                  </div>
                </div>
                <div className="text-[9px] text-ink/45 font-sans">
                  Marked by <span className="font-bold text-ink/70">{cls.marked_by || 'Unknown'}</span>
                  {cls.marked_at && ` at ${cls.marked_at.split(' ')[1]?.substring(0,5)}`}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-amber-warning font-sans font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0"/>
                <span>Register not yet submitted</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setCommentFor(cls)} className="text-[10px] font-semibold text-teal-primary hover:text-teal-dark flex items-center space-x-1 cursor-pointer">
                <MessageSquare className="w-3 h-3"/><span>Comment</span>
              </button>
              {cls.status === 'submitted' && (
                <button onClick={() => openDrill(cls)} className="text-[10px] font-semibold text-teal-primary hover:text-teal-dark flex items-center space-x-1 cursor-pointer">
                  <span>View Pupils</span><ChevronRight className="w-3 h-3"/>
                </button>
              )}
            </div>
          </div>
        ))}
        {!data.length && (
          <div className="col-span-full glass-card rounded-2xl py-10 text-center text-xs text-ink/40 font-sans">No classes configured.</div>
        )}
      </div>

      {/* Drill-down modal */}
      <DrillDownModal
        open={!!drillClass} onClose={() => { setDrillClass(null); setDrillStudents([]); }}
        title={drillClass?.name} subtitle={`Attendance detail — ${today}`}
      >
        {drillLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-primary"/></div>
        ) : (
          <div className="space-y-1.5">
            {drillStudents.length === 0 && <p className="text-xs text-ink/50 py-4 text-center">No attendance records found.</p>}
            {drillStudents.map((s, i) => (
              <div key={i} className={`flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-sans ${
                s.status === 'present' ? 'bg-sage/15' : s.status === 'absent' ? 'bg-brick-critical/5' : 'bg-amber-warning/5'
              }`}>
                <span className="font-semibold text-ink">{s.student_name || `Student #${s.student_id}`}</span>
                <span className={`uppercase text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  s.status === 'present' ? 'bg-sage/40 text-teal-dark' :
                  s.status === 'absent'  ? 'bg-brick-critical/10 text-brick-critical' :
                  'bg-amber-warning/10 text-amber-warning'
                }`}>{s.status}</span>
              </div>
            ))}
          </div>
        )}
      </DrillDownModal>

      {/* Comment Modal */}
      <CommentModal
        open={!!commentFor} onClose={() => setCommentFor(null)}
        title={`Comment on ${commentFor?.name} Attendance`}
        onSubmit={handleComment} saving={saving}
      />
    </section>
  );
};

// ─── Grade Performance Section ─────────────────────────────────────────────────
const GradesSection = ({ data, topStudents, bottomStudents, schoolId, onCommentPosted }) => {
  // Transform flat array to per-class chart data
  const byClass = {};
  (data || []).forEach(row => {
    if (!byClass[row.class_name]) byClass[row.class_name] = [];
    byClass[row.class_name].push({ subject: row.subject, avg: parseFloat(row.avg_score) });
  });

  const [commentFor, setCommentFor] = useState(null);
  const [saving, setSaving]         = useState(false);

  const handleComment = async (text) => {
    setSaving(true);
    try {
      await api.post(`/schools/${schoolId}/comments`, { report_type: 'grades', comment: text });
      setCommentFor(null); onCommentPosted();
    } catch { } finally { setSaving(false); }
  };

  return (
    <section className="space-y-4">
      <SectionHeader icon={BookOpen} title="Academic Performance"
        subtitle="Average scores per class per subject — current term"
      />
      {Object.keys(byClass).length === 0 && (
        <div className="glass-card rounded-2xl py-10 text-center text-xs text-ink/40 font-sans">No grade data recorded yet.</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(byClass).map(([className, subjects]) => (
          <div key={className} className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-ink">{className}</h3>
              <button onClick={() => setCommentFor(className)} className="text-[10px] font-semibold text-teal-primary hover:text-teal-dark flex items-center space-x-1 cursor-pointer">
                <MessageSquare className="w-3 h-3"/><span>Comment</span>
              </button>
            </div>
            <MiniBarChart data={subjects} xKey="subject" yKey="avg" height={160} />
            {/* Subject score pills */}
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <span key={s.subject} className={`text-[10px] font-semibold px-2 py-1 rounded-lg font-mono ${
                  s.avg >= 70 ? 'bg-sage/25 text-teal-dark' : s.avg >= 50 ? 'bg-amber-warning/10 text-amber-warning' : 'bg-brick-critical/10 text-brick-critical'
                }`}>{s.subject}: <strong>{s.avg}</strong></span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Top & Bottom Students grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Top Performers */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-dark flex items-center space-x-1.5">
            <Star className="w-4 h-4 text-teal-primary animate-pulse" />
            <span>Top Performing Students</span>
          </h3>
          <div className="space-y-2">
            {(topStudents || []).map((s, idx) => (
              <div key={s.id || idx} className="flex justify-between items-center py-2.5 px-3 bg-sage/10 rounded-xl border border-line-border/20">
                <div>
                  <p className="text-xs font-bold text-ink">{s.name}</p>
                  <p className="text-[9px] text-ink/50 mt-0.5">{s.class_name}</p>
                </div>
                <span className="text-xs font-mono font-bold text-teal-primary bg-paper px-2 py-0.5 rounded-lg border border-line-border/40">
                  {s.avg_grade}%
                </span>
              </div>
            ))}
            {(!topStudents || topStudents.length === 0) && (
              <p className="text-xs text-ink/40 text-center py-4">No academic data to rank top performing pupils.</p>
            )}
          </div>
        </div>

        {/* Support required */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brick-critical flex items-center space-x-1.5">
            <Flag className="w-4 h-4 text-brick-critical" />
            <span>Academic Support Target List</span>
          </h3>
          <div className="space-y-2">
            {(bottomStudents || []).map((s, idx) => (
              <div key={s.id || idx} className="flex justify-between items-center py-2.5 px-3 bg-brick-critical/5 rounded-xl border border-line-border/20">
                <div>
                  <p className="text-xs font-bold text-ink">{s.name}</p>
                  <p className="text-[9px] text-ink/50 mt-0.5">{s.class_name}</p>
                </div>
                <span className="text-xs font-mono font-bold text-brick-critical bg-paper px-2 py-0.5 rounded-lg border border-line-border/40">
                  {s.avg_grade}%
                </span>
              </div>
            ))}
            {(!bottomStudents || bottomStudents.length === 0) && (
              <p className="text-xs text-ink/40 text-center py-4">No academic data to rank support targets.</p>
            )}
          </div>
        </div>
      </div>

      <CommentModal open={!!commentFor} onClose={() => setCommentFor(null)}
        title={`Comment on ${commentFor} Grades`}
        onSubmit={handleComment} saving={saving}
      />
    </section>
  );
};

// ─── Fee Section ───────────────────────────────────────────────────────────────
const FeeSection = ({ donut, breakdown, schoolId, onCommentPosted }) => {
  const donutData = donut ? [
    { name: 'Paid',    value: parseInt(donut.paid) },
    { name: 'Partial', value: parseInt(donut.partial) },
    { name: 'Unpaid',  value: parseInt(donut.unpaid) },
  ] : [];

  const [commentFor, setCommentFor] = useState(false);
  const [saving, setSaving]         = useState(false);

  const handleComment = async (text) => {
    setSaving(true);
    try {
      await api.post(`/schools/${schoolId}/comments`, { report_type: 'fee', comment: text });
      setCommentFor(false); onCommentPosted();
    } catch { } finally { setSaving(false); }
  };

  return (
    <section className="space-y-4">
      <SectionHeader icon={DollarSign} title="Fee Collection Overview"
        subtitle="School-wide payment status breakdown"
        action={
          <button onClick={() => setCommentFor(true)} className="text-[10px] font-semibold text-teal-primary hover:text-teal-dark flex items-center space-x-1 cursor-pointer">
            <MessageSquare className="w-3 h-3"/><span>Add Comment</span>
          </button>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs font-bold text-ink/60 mb-3">Overall Payment Status</h3>
          <MiniDonutChart data={donutData} nameKey="name" valueKey="value" height={220} />
        </div>
        <div className="glass-card rounded-2xl p-5 lg:col-span-2 space-y-3">
          <h3 className="text-xs font-bold text-ink/60 mb-4">Collection Rate per Class</h3>
          {(breakdown || []).map(cls => (
            <div key={cls.class_name} className="space-y-1.5">
              <div className="flex justify-between text-xs font-sans">
                <span className="font-semibold text-ink">{cls.class_name}</span>
                <span className={`font-bold numeric-data ${pctColor(parseFloat(cls.collection_pct))}`}>
                  {parseFloat(cls.collection_pct || 0).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-line-border/30 rounded-full">
                <div
                  className={`h-2 rounded-full transition-all ${pctBarColor(parseFloat(cls.collection_pct))}`}
                  style={{ width: `${Math.min(100, parseFloat(cls.collection_pct || 0))}%` }}
                />
              </div>
              <div className="flex space-x-3 text-[9px] text-ink/50 font-sans">
                <span>✅ Paid: <b>{cls.fully_paid}</b></span>
                <span>⚠️ Partial: <b>{cls.partial}</b></span>
                <span>❌ Unpaid: <b>{cls.unpaid}</b></span>
              </div>
            </div>
          ))}
          {!breakdown?.length && <p className="text-xs text-ink/40 py-4 text-center">No fee records found.</p>}
        </div>
      </div>

      <CommentModal open={commentFor} onClose={() => setCommentFor(false)}
        title="Comment on Fee Collection Report" onSubmit={handleComment} saving={saving}
      />
    </section>
  );
};

// ─── Staff Activity ────────────────────────────────────────────────────────────
const StaffSection = ({ data, schoolId, onRefresh }) => {
  const [reminding, setReminding] = useState(null);
  const [reminderSent, setReminderSent] = useState({});

  const sendReminder = async (staff) => {
    setReminding(staff.username);
    try {
      await api.post(`/schools/${schoolId}/staff/remind`, { username: staff.username, name: staff.name });
      setReminderSent(prev => ({ ...prev, [staff.username]: true }));
    } catch { /* silently fail — endpoint may not exist yet */ } finally { setReminding(null); }
  };

  return (
  <section className="space-y-4">
    <SectionHeader icon={Activity} title="Staff Activity Monitor"
      subtitle="Teacher engagement and today's activity status"
    />
    <div className="glass-card rounded-2xl overflow-hidden">
      <table className="w-full text-left text-xs font-sans">
        <thead className="bg-ink/5 border-b border-line-border/30">
          <tr className="text-ink/50 uppercase tracking-wider font-bold text-[10px]">
            <th className="px-5 py-3">Staff Member</th>
            <th className="px-5 py-3">Role</th>
            <th className="px-5 py-3">Last Login</th>
            <th className="px-5 py-3 text-center">Registers Today</th>
            <th className="px-5 py-3 text-center">Grades Entered</th>
            <th className="px-5 py-3 text-center">Status</th>
            <th className="px-5 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-border/20">
          {(data || []).map((st, i) => {
            const active = st.last_login && new Date(st.last_login) > new Date(Date.now() - 86400000);
            return (
              <tr key={i} className="hover:bg-sage/5 transition-colors">
                <td className="px-5 py-3.5 font-semibold text-ink">{st.name}</td>
                <td className="px-5 py-3.5 capitalize text-ink/60">{st.role?.replace('_', ' ')}</td>
                <td className="px-5 py-3.5 text-ink/50 font-mono text-[10px]">
                  {st.last_login ? new Date(st.last_login).toLocaleString('en-ZW', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-block min-w-[24px] text-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    parseInt(st.registers_today) > 0 ? 'bg-sage/40 text-teal-dark' : 'bg-ink/5 text-ink/40'
                  }`}>{st.registers_today ?? 0}</span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-block min-w-[24px] text-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    parseInt(st.grades_today) > 0 ? 'bg-sage/40 text-teal-dark' : 'bg-ink/5 text-ink/40'
                  }`}>{st.grades_today ?? 0}</span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    active ? 'bg-sage/40 text-teal-dark' : 'bg-ink/5 text-ink/40'
                  }`}>{active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  {!active && (
                    reminderSent[st.username] ? (
                      <span className="text-[9px] text-teal-primary font-bold">✓ Sent</span>
                    ) : (
                      <button
                        onClick={() => sendReminder(st)}
                        disabled={reminding === st.username}
                        className="text-[10px] font-semibold text-amber-warning hover:text-amber-warning/80 flex items-center space-x-1 mx-auto cursor-pointer disabled:opacity-50"
                      >
                        {reminding === st.username ? <Loader2 className="w-3 h-3 animate-spin"/> : <Bell className="w-3 h-3"/>}
                        <span>Remind</span>
                      </button>
                    )
                  )}
                </td>
              </tr>
            );
          })}
          {!data?.length && (
            <tr><td colSpan={7} className="px-5 py-8 text-center text-ink/40">No staff records found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
  );
};

// ─── Overdue Teacher Tasks ───────────────────────────────────────────────────
const OverdueTasksSection = ({ data }) => {
  return (
    <section className="space-y-4">
      <SectionHeader icon={AlertTriangle} title="Overdue Teacher Tasks"
        subtitle="Uncompleted task plans that have crossed their due date"
      />
      <div className="glass-card rounded-2xl overflow-hidden p-5 bg-brick-critical/5 border border-brick-critical/10">
        {data && data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((task) => (
              <div key={task.id} className="p-4 bg-white/70 border border-brick-critical/20 rounded-xl flex flex-col justify-between space-y-2 shadow-sm animate-fadeIn">
                <div>
                  <div className="flex justify-between items-center text-[10px] text-ink/40 font-mono font-bold uppercase">
                    <span>{task.class_name} • {task.subject_name}</span>
                    <span className="text-brick-critical font-sans">Overdue</span>
                  </div>
                  <h4 className="text-xs font-bold text-ink mt-1.5">{task.title}</h4>
                  {task.description && (
                    <p className="text-[11px] text-ink/65 mt-1 leading-relaxed">{task.description}</p>
                  )}
                </div>
                <div className="border-t border-line-border/20 pt-2 flex justify-between items-center text-[10px] text-ink/40">
                  <span>Assigned Teacher: <strong>{task.teacher_name || 'Unassigned'}</strong></span>
                  <span className="text-brick-critical font-bold">Due: {task.due_date}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-ink/55 text-xs py-4 font-semibold">No overdue teacher tasks found. All classroom planning targets are on schedule!</p>
        )}
      </div>
    </section>
  );
};

// ─── Upcoming Exams ────────────────────────────────────────────────────────────
const ExamsSection = ({ data, schoolId, onCommentPosted }) => {
  const [commentFor, setCommentFor] = useState(null);
  const [saving, setSaving]         = useState(false);

  const handleComment = async (text) => {
    setSaving(true);
    try {
      await api.post(`/schools/${schoolId}/comments`, { report_type: 'exam', ref_id: commentFor?.id, comment: text });
      setCommentFor(null); onCommentPosted();
    } catch { } finally { setSaving(false); }
  };

  return (
    <section className="space-y-4">
      <SectionHeader icon={Calendar} title="Upcoming Exams (Next 7 Days)"
        subtitle="Scheduled assessments and exam invigilator assignments"
      />
      {!data?.length ? (
        <div className="glass-card rounded-2xl py-10 text-center text-xs text-ink/40 font-sans">No exams scheduled in the next 7 days.</div>
      ) : (
        <div className="space-y-3">
          {data.map((exam, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-teal-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-teal-primary">{new Date(exam.exam_date).toLocaleDateString('en', { month: 'short' })}</span>
                  <span className="text-lg font-display font-bold text-teal-primary numeric-data leading-tight">{new Date(exam.exam_date).getDate()}</span>
                </div>
                <div>
                  <h4 className="font-sans font-bold text-sm text-ink">{exam.subject} — {exam.class_name}</h4>
                  <div className="text-[10px] text-ink/50 mt-0.5 space-y-0.5">
                    <p>{exam.start_time} – {exam.end_time} {exam.exam_type && <span className="capitalize ml-1 font-semibold text-ink/60">({exam.exam_type})</span>}</p>
                    {exam.venue && <p>📍 <span className="font-medium">{exam.venue}</span></p>}
                    {exam.invigilator && <p>👤 Invigilator: <span className="font-medium">{exam.invigilator}</span></p>}
                  </div>
                </div>
              </div>
              <button onClick={() => setCommentFor(exam)} className="text-[10px] font-semibold text-teal-primary hover:text-teal-dark flex items-center space-x-1 cursor-pointer flex-shrink-0">
                <MessageSquare className="w-3 h-3"/><span>Remark</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <CommentModal open={!!commentFor} onClose={() => setCommentFor(null)}
        title={`Principal Remark on ${commentFor?.subject} Exam`}
        onSubmit={handleComment} saving={saving}
      />
    </section>
  );
};

// ─── Discipline Feed ───────────────────────────────────────────────────────────
const DisciplineSection = ({ data, schoolId, onCommentPosted, onRefresh }) => {
  const severityStyle = {
    minor:    'bg-amber-warning/10 text-amber-warning',
    moderate: 'bg-amber-warning/20 text-amber-warning',
    serious:  'bg-brick-critical/10 text-brick-critical',
    resolved: 'bg-sage/30 text-teal-dark',
  };
  const [commentFor, setCommentFor] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [actioning, setActioning]   = useState(null);

  const handleComment = async (text) => {
    setSaving(true);
    try {
      await api.post(`/schools/${schoolId}/comments`, { report_type: 'discipline', ref_id: commentFor?.id, comment: text });
      setCommentFor(null); onCommentPosted();
    } catch { } finally { setSaving(false); }
  };

  const handleAction = async (inc, newStatus) => {
    setActioning(inc.id);
    try {
      await api.patch(`/schools/${schoolId}/discipline/${inc.id}`, { status: newStatus });
      onRefresh();
    } catch { } finally { setActioning(null); }
  };

  return (
    <section className="space-y-4">
      <SectionHeader icon={Shield} title="Discipline Incidents Feed"
        subtitle="Recent incidents — escalate, close or add a principal note"
      />
      {!data?.length ? (
        <div className="glass-card rounded-2xl py-10 text-center text-xs text-ink/40 font-sans">
          <CheckCircle className="w-8 h-8 text-teal-primary/30 mx-auto mb-2"/>
          No discipline incidents on record.
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-ink/5 border-b border-line-border/30">
              <tr className="text-ink/50 uppercase tracking-wider font-bold text-[10px]">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Class</th>
                <th className="px-5 py-3">Incident</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/20">
              {data.map((inc, i) => (
                <tr key={i} className="hover:bg-sage/5">
                  <td className="px-5 py-3.5 font-semibold text-ink">{inc.student_name}</td>
                  <td className="px-5 py-3.5 text-ink/60">{inc.class_name}</td>
                  <td className="px-5 py-3.5 text-ink/70 max-w-[180px] truncate" title={inc.description}>{inc.description}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${severityStyle[inc.severity] || severityStyle.minor}`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      inc.status === 'resolved' ? 'bg-sage/40 text-teal-dark' :
                      inc.status === 'escalated' ? 'bg-brick-critical/20 text-brick-critical' :
                      'bg-amber-warning/10 text-amber-warning'
                    }`}>{inc.status}</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[10px] text-ink/50">{inc.incident_date}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button onClick={() => setCommentFor(inc)} className="text-[10px] font-semibold text-teal-primary hover:text-teal-dark flex items-center space-x-0.5 cursor-pointer">
                        <MessageSquare className="w-3 h-3"/><span>Note</span>
                      </button>
                      {inc.status !== 'escalated' && (
                        <button
                          onClick={() => handleAction(inc, 'escalated')}
                          disabled={actioning === inc.id}
                          className="text-[10px] font-semibold text-brick-critical hover:text-brick-critical/80 flex items-center space-x-0.5 cursor-pointer disabled:opacity-50"
                        >
                          <Flag className="w-3 h-3"/><span>Escalate</span>
                        </button>
                      )}
                      {inc.status !== 'resolved' && (
                        <button
                          onClick={() => handleAction(inc, 'resolved')}
                          disabled={actioning === inc.id}
                          className="text-[10px] font-semibold text-teal-primary hover:text-teal-dark flex items-center space-x-0.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle className="w-3 h-3"/><span>Close</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CommentModal open={!!commentFor} onClose={() => setCommentFor(null)}
        title={`Escalation Note — ${commentFor?.student_name}`}
        onSubmit={handleComment} saving={saving}
      />
    </section>
  );
};

// ─── Recent Comments Log ───────────────────────────────────────────────────────
const CommentsLog = ({ data }) => (
  <section className="space-y-4">
    <SectionHeader icon={MessageSquare} title="Principal's Comment Log"
      subtitle="All your annotations across attendance, grades, exams and discipline"
    />
    {!data?.length ? (
      <div className="glass-card rounded-2xl py-10 text-center text-xs text-ink/40 font-sans">No comments yet.</div>
    ) : (
      <div className="space-y-3">
        {data.map((c, i) => (
          <div key={i} className="glass-card rounded-2xl p-4 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-teal-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageSquare className="w-4 h-4 text-teal-primary"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  c.report_type === 'attendance' ? 'bg-sage/30 text-teal-dark' :
                  c.report_type === 'grades'     ? 'bg-teal-primary/10 text-teal-primary' :
                  c.report_type === 'exam'       ? 'bg-amber-warning/10 text-amber-warning' :
                  c.report_type === 'discipline' ? 'bg-brick-critical/10 text-brick-critical' :
                  'bg-ink/5 text-ink/60'
                }`}>{c.report_type}</span>
                <span className="text-[10px] font-mono text-ink/40">{c.created_at}</span>
              </div>
              <p className="text-sm text-ink/80 font-sans leading-relaxed">{c.comment}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);
  // ─── Student Performance Breakdown ───────────────────────────────────────────
const StudentPerformanceBreakdown = ({ schoolId, defaultClassId = null }) => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(defaultClassId || '');
  const [gradesData, setGradesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drillStudent, setDrillStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('average-desc');

  // Fetch classes
  useEffect(() => {
    if (!schoolId) return;
    api.get(`/schools/${schoolId}/classes`)
      .then(res => {
        setClasses(res.data || []);
        if (res.data?.length > 0 && !defaultClassId) {
          setSelectedClass(String(res.data[0].id));
        }
      })
      .catch(() => {});
  }, [schoolId, defaultClassId]);

  // Fetch grades data for selected class
  useEffect(() => {
    if (!schoolId || !selectedClass) return;
    setLoading(true);
    api.get(`/schools/${schoolId}/classes/${selectedClass}/grades`)
      .then(res => {
        setGradesData(res.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [schoolId, selectedClass]);

  // Compute student averages and subject averages
  const computedStudents = (gradesData || []).map(student => {
    const studentGrades = student.grades || [];
    let sum = 0;
    let count = 0;
    const subjectAverages = {};

    studentGrades.forEach(g => {
      const val = parseFloat(g.grade_value);
      if (!isNaN(val)) {
        sum += val;
        count++;
        if (!subjectAverages[g.subject]) subjectAverages[g.subject] = { sum: 0, count: 0 };
        subjectAverages[g.subject].sum += val;
        subjectAverages[g.subject].count++;
      }
    });

    const average = count > 0 ? Math.round(sum / count) : null;
    const subjectsList = Object.entries(subjectAverages).map(([sub, info]) => ({
      subject: sub,
      avg: Math.round(info.sum / info.count)
    }));

    return {
      ...student,
      average,
      subjectsList
    };
  });

  // Filter students by search query
  const filteredStudents = computedStudents.filter(s => {
    const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || (s.admission_number || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'average-desc') {
      const avgA = a.average !== null ? a.average : -1;
      const avgB = b.average !== null ? b.average : -1;
      return avgB - avgA;
    }
    if (sortBy === 'average-asc') {
      const avgA = a.average !== null ? a.average : 999;
      const avgB = b.average !== null ? b.average : 999;
      return avgA - avgB;
    }
    // Alphabetical
    const nameA = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
    const nameB = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const getScoreBadgeColor = (score) => {
    if (score >= 75) return 'bg-sage/40 text-teal-dark border border-teal-primary/20';
    if (score >= 50) return 'bg-amber-warning/10 text-amber-warning border border-amber-warning/25';
    return 'bg-brick-critical/15 text-brick-critical border border-brick-critical/20';
  };

  const currentClassObj = classes.find(c => String(c.id) === selectedClass);

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-line-border/30 animate-fadeIn">
      {/* Component Header */}
      <div className="p-5 border-b border-line-border/30 bg-sage/5 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
            <GraduationCap className="w-5 h-5 text-teal-primary" />
            <span>Student Performance Breakdown</span>
          </h3>
          <p className="text-[10px] text-ink/50 mt-0.5">Subject averages and individual test drill-downs</p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Class Select Dropdown (hidden/disabled if defaultClassId is provided e.g. for teachers) */}
          {!defaultClassId && (
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="bg-paper border border-line-border text-ink text-[11px] font-sans font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-primary"
            >
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink/40 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search pupil name..."
              className="pl-8 pr-3 py-1.5 border border-line-border bg-paper text-ink text-[11px] font-sans rounded-xl focus:outline-none focus:border-teal-primary w-40"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Sort selection */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-paper border border-line-border text-ink text-[11px] font-sans font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-primary"
          >
            <option value="average-desc">Rank: High → Low</option>
            <option value="average-asc">Rank: Low → High</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Roster list table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-teal-primary" />
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs font-sans text-ink">
            <thead>
              <tr className="bg-sage/10 border-b border-line-border text-ink/60 font-bold uppercase tracking-wider">
                <th className="py-3 px-5">Adm #</th>
                <th className="py-3 px-5">Student Name</th>
                <th className="py-3 px-5">Subject Performance Averages</th>
                <th className="py-3 px-5 text-center">Overall Average</th>
                <th className="py-3 px-5 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-border/30">
              {sortedStudents.map(s => (
                <tr key={s.student_id} className="hover:bg-sage/5 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-semibold text-ink/65">{s.admission_number}</td>
                  <td className="py-3.5 px-5 font-bold text-ink">{s.first_name} {s.last_name}</td>
                  <td className="py-3.5 px-5">
                    <div className="flex flex-wrap gap-1.5">
                      {s.subjectsList?.map((sub) => (
                        <span
                          key={sub.subject}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getScoreBadgeColor(sub.avg)}`}
                        >
                          {sub.subject}: {sub.avg}%
                        </span>
                      ))}
                      {!s.subjectsList?.length && <span className="text-[10px] text-ink/40 italic">No grades entered</span>}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    {s.average !== null ? (
                      <span className={`inline-block min-w-[36px] font-bold px-2.5 py-1 rounded-lg text-xs ${getScoreBadgeColor(s.average)}`}>
                        {s.average}%
                      </span>
                    ) : (
                      <span className="text-ink/35 font-mono">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right pr-6">
                    <button
                      onClick={() => setDrillStudent(s)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-dark rounded-xl text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-teal-primary" />
                      <span>Drill Down</span>
                    </button>
                  </td>
                </tr>
              ))}
              {sortedStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-ink/40">
                    No matching student performance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Drill Down Overlay Modal */}
      {drillStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl border border-line-border/30 p-6 relative animate-scaleUp">
            <button
              onClick={() => setDrillStudent(null)}
              className="absolute right-4 top-4 text-ink/50 hover:text-ink cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <h3 className="text-xl font-display font-bold text-ink">
                {drillStudent.first_name} {drillStudent.last_name}'s Grade Book
              </h3>
              <p className="text-xs text-ink/50 font-mono mt-0.5">
                Admission: {drillStudent.admission_number} | Class: {currentClassObj?.name || 'Assigned Class'}
              </p>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-sage/10 border border-line-border/20 rounded-xl">
                <span className="text-[10px] font-bold text-ink/40 uppercase block">Overall Average</span>
                <span className="text-xl font-display font-bold text-teal-primary mt-1 block">
                  {drillStudent.average !== null ? `${drillStudent.average}%` : '—'}
                </span>
              </div>
              <div className="p-3 bg-sage/10 border border-line-border/20 rounded-xl">
                <span className="text-[10px] font-bold text-ink/40 uppercase block">Total Assessments</span>
                <span className="text-xl font-display font-bold text-teal-primary mt-1 block">
                  {drillStudent.grades?.length || 0} Entries
                </span>
              </div>
              <div className="p-3 bg-sage/10 border border-line-border/20 rounded-xl">
                <span className="text-[10px] font-bold text-ink/40 uppercase block">Highest Grade</span>
                <span className="text-xl font-display font-bold text-teal-primary mt-1 block">
                  {drillStudent.grades?.length > 0 
                    ? `${Math.max(...drillStudent.grades.map(g => parseFloat(g.grade_value) || 0))}%`
                    : '—'}
                </span>
              </div>
              <div className="p-3 bg-sage/10 border border-line-border/20 rounded-xl">
                <span className="text-[10px] font-bold text-ink/40 uppercase block">Lowest Grade</span>
                <span className="text-xl font-display font-bold text-teal-primary mt-1 block">
                  {drillStudent.grades?.length > 0 
                    ? `${Math.min(...drillStudent.grades.map(g => parseFloat(g.grade_value) || 0))}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Individual test list */}
            <div className="border border-line-border/30 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs font-sans text-ink border-collapse">
                <thead className="bg-ink/5 border-b border-line-border/30 sticky top-0">
                  <tr className="text-ink/50 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Test/Assessment Name</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-center">Weight</th>
                    <th className="py-2.5 px-4 text-right pr-4">Score (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border/25">
                  {(drillStudent.grades || []).map((grade) => (
                    <tr key={grade.id} className="hover:bg-sage/5 transition-colors">
                      <td className="py-3 px-4 font-bold text-ink">{grade.subject}</td>
                      <td className="py-3 px-4 text-ink/70 font-semibold">{grade.assessment_name || 'Test 1'}</td>
                      <td className="py-3 px-4 capitalize text-ink/50">{grade.assessment_type}</td>
                      <td className="py-3 px-4 text-center font-mono text-ink/50">x{grade.weight}</td>
                      <td className="py-3 px-4 text-right pr-4">
                        <div className="flex items-center justify-end space-x-2">
                          <span className="font-bold font-mono">{grade.grade_value}%</span>
                          <div className="w-16 h-1.5 bg-line-border/40 rounded-full hidden sm:block">
                            <div 
                              className={`h-1.5 rounded-full ${
                                grade.grade_value >= 75 ? 'bg-teal-primary' :
                                grade.grade_value >= 50 ? 'bg-amber-warning' : 'bg-brick-critical'
                              }`} 
                              style={{ width: `${grade.grade_value}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!drillStudent.grades || drillStudent.grades.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink/40">
                        No raw marks entries found for this student.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer buttons */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDrillStudent(null)}
                className="px-4 py-2 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Close Grade Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Teacher Dashboard View ──────────────────────────────────────────────────
const TeacherDashboardView = ({ schoolId }) => {
  const navigate = useNavigate();
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState({ present: 0, absent: 0, late: 0, unmarked: 0, rate: 100 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    const loadTeacherData = async () => {
      setLoading(true);
      try {
        const classRes = await api.get(`/schools/${schoolId}/classes`);
        const assignedClass = classRes.data?.[0];
        if (assignedClass) {
          setCls(assignedClass);
          
          const todayStr = new Date().toISOString().split('T')[0];
          const [studentsRes, timetableRes, annRes, incidentsRes, gradesRes, attendanceRes] = await Promise.all([
            api.get(`/schools/${schoolId}/students?class_id=${assignedClass.id}`).catch(() => ({ data: [] })),
            api.get(`/schools/${schoolId}/timetable?class_id=${assignedClass.id}`).catch(() => ({ data: [] })),
            api.get(`/schools/${schoolId}/announcements?class_id=${assignedClass.id}`).catch(() => ({ data: [] })),
            api.get(`/schools/${schoolId}/discipline`).catch(() => ({ data: [] })),
            api.get(`/schools/${schoolId}/classes/${assignedClass.id}/grades`).catch(() => ({ data: [] })),
            api.get(`/schools/${schoolId}/classes/${assignedClass.id}/attendance?date=${todayStr}`).catch(() => ({ data: { records: [] } }))
          ]);
          
          const studentsList = studentsRes.data || [];
          setStudents(studentsList);
          setTimetable(timetableRes.data || []);
          setAnnouncements(annRes.data || []);
          setIncidents(incidentsRes.data || []);
          setGrades(gradesRes.data || []);

          const attRecords = attendanceRes.data?.records || [];
          const totalInClass = studentsList.length;
          const presentCount = attRecords.filter(r => r.status === 'present').length;
          const absentCount = attRecords.filter(r => r.status === 'absent').length;
          const lateCount = attRecords.filter(r => r.status === 'late').length;
          const unmarkedCount = Math.max(0, totalInClass - (presentCount + absentCount + lateCount));
          const attendanceRate = totalInClass > 0 ? Math.round(((presentCount + lateCount) / totalInClass) * 100) : 100;
          
          setAttendance({
            present: presentCount,
            absent: absentCount,
            late: lateCount,
            unmarked: unmarkedCount,
            rate: attendanceRate
          });
        }
      } catch (ex) {
        setErr('Error loading teacher dashboard data: ' + ex.message);
      } finally {
        setLoading(false);
      }
    };
    loadTeacherData();
  }, [schoolId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-primary mb-2" />
        <p className="text-xs text-ink/50 font-sans">Loading teacher portal data...</p>
      </div>
    );
  }

  const totalPupils = students.length;
  const openIncidentsCount = incidents.filter(i => i.status === 'open').length;

  let classAvg = 0;
  const subjectMap = {};
  let totalGradesCount = 0;
  let sum = 0;

  if (grades.length > 0) {
    grades.forEach(student => {
      const studentGrades = student.grades || [];
      studentGrades.forEach(g => {
        const val = parseFloat(g.grade_value);
        if (!isNaN(val)) {
          sum += val;
          totalGradesCount += 1;
          if (!subjectMap[g.subject]) subjectMap[g.subject] = { sum: 0, count: 0 };
          subjectMap[g.subject].sum += val;
          subjectMap[g.subject].count += 1;
        }
      });
    });
    if (totalGradesCount > 0) {
      classAvg = Math.round(sum / totalGradesCount);
    }
  }
  const subjectChartData = Object.entries(subjectMap).map(([subject, info]) => ({
    subject,
    avg: Math.round(info.sum / info.count)
  }));

  const attendanceDonutData = [
    { name: 'Present', value: attendance.present },
    { name: 'Late', value: attendance.late },
    { name: 'Absent', value: attendance.absent },
    { name: 'Unmarked', value: attendance.unmarked }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="glass-card rounded-3xl p-6 bg-gradient-to-r from-teal-primary/10 to-teal-dark/5 border border-teal-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">
            {cls?.teacher_name ? `Welcome ${cls.teacher_name}` : 'Welcome back, Class Teacher'}
          </h2>
          <p className="text-sm font-sans text-ink/65 mt-1">
            {cls ? `You are assigned to ${cls.name} (Grade ${cls.grade_level} Stream ${cls.stream})` : 'No class currently assigned to your profile.'}
          </p>
        </div>
        {cls && (
          <div className="bg-teal-primary text-paper px-4 py-2 rounded-xl text-xs font-semibold font-sans tracking-wide uppercase">
            Class Roster: {totalPupils} Pupils
          </div>
        )}
      </div>

      {err && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs font-sans">{err}</div>}

      {cls ? (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Class Pupils" value={totalPupils} icon={Users} />
            <KpiCard label="Attendance Today" value={attendance.rate} icon={UserCheck} suffix="%" color={attendance.rate >= 85 ? 'green' : 'amber'} />
            <KpiCard label="Class Average" value={grades.length > 0 ? classAvg : null} icon={Star} suffix="%" color={classAvg >= 70 ? 'green' : classAvg >= 50 ? 'amber' : 'red'} />
            <KpiCard label="Open Incident Flags" value={openIncidentsCount} icon={Shield} color={openIncidentsCount > 0 ? 'red' : 'teal'} />
          </div>

          {/* Quick Actions Panel */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-xs font-sans font-bold text-ink/60 uppercase tracking-wider mb-4">Quick Console Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/attendance')}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-dark font-sans font-bold text-xs rounded-xl border border-teal-primary/20 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-teal-primary" />
                <span>Mark Attendance</span>
              </button>
              <button
                onClick={() => navigate('/grades')}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-dark font-sans font-bold text-xs rounded-xl border border-teal-primary/20 transition-all cursor-pointer"
              >
                <Star className="w-4 h-4 text-teal-primary" />
                <span>Record Grades</span>
              </button>
              <button
                onClick={() => navigate('/timetable')}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-dark font-sans font-bold text-xs rounded-xl border border-teal-primary/20 transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-teal-primary" />
                <span>View Timetable</span>
              </button>
              <button
                onClick={() => navigate('/discipline')}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-teal-primary/10 hover:bg-teal-primary/20 text-teal-dark font-sans font-bold text-xs rounded-xl border border-teal-primary/20 transition-all cursor-pointer"
              >
                <Shield className="w-4 h-4 text-teal-primary" />
                <span>Escalate Incident</span>
              </button>
            </div>
          </div>

          {/* Visual Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-5 lg:col-span-2">
              <h3 className="text-xs font-sans font-bold text-ink/60 uppercase tracking-wider mb-4">Class Subject Performance Averages</h3>
              {subjectChartData.length > 0 ? (
                <MiniBarChart data={subjectChartData} xKey="subject" yKey="avg" height={180} />
              ) : (
                <div className="h-[180px] flex items-center justify-center text-xs text-ink/40 italic">No academic assessments entered for this class.</div>
              )}
            </div>
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-xs font-sans font-bold text-ink/60 uppercase tracking-wider mb-4 font-display">Attendance Distribution</h3>
              {attendanceDonutData.length > 0 ? (
                <MiniDonutChart data={attendanceDonutData} nameKey="name" valueKey="value" height={180} />
              ) : (
                <div className="h-[180px] flex items-center justify-center text-xs text-ink/40 italic">No register taken today.</div>
              )}
            </div>
          </div>

          {/* Pupil Academic Performance Breakdown */}
          <StudentPerformanceBreakdown schoolId={schoolId} defaultClassId={cls.id} />

          {/* Roster and Timetable Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Pupil directory */}
              <div className="glass-card rounded-2xl border border-line-border/30 overflow-hidden">
                <div className="p-5 border-b border-line-border/30 bg-sage/5 flex justify-between items-center">
                  <h3 className="font-sans font-bold text-sm text-ink">Class Pupils Directory</h3>
                  <span className="text-[10px] bg-teal-primary/10 text-teal-primary px-2.5 py-0.5 rounded-full font-bold uppercase">{cls.name}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border text-ink/60 font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-5">Adm #</th>
                        <th className="py-3.5 px-5">Student Name</th>
                        <th className="py-3.5 px-5">Gender</th>
                        <th className="py-3.5 px-5">Nationality</th>
                        <th className="py-3.5 px-5 text-right">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/30">
                      {students.map(s => (
                        <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                          <td className="py-3 px-5 font-mono font-semibold text-ink/65">{s.admission_number}</td>
                          <td className="py-3 px-5 font-bold">{s.first_name} {s.last_name}</td>
                          <td className="py-3 px-5 capitalize text-ink/75">{s.gender}</td>
                          <td className="py-3 px-5 text-ink/65">{s.nationality || '—'}</td>
                          <td className="py-3 px-5 text-right">
                            <button
                              onClick={() => navigate(`/students/${s.id}`)}
                              className="text-teal-primary hover:underline font-bold cursor-pointer"
                            >
                              View Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-ink/45">No pupils registered in your class yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Class schedules */}
              <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
                <div className="border-b border-line-border/30 pb-3 flex justify-between items-center">
                  <h3 className="font-sans font-bold text-sm text-ink">Weekly Class Schedule</h3>
                  <span className="text-[10px] text-ink/50 font-mono">Curriculum Slots</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                    const dayLessons = timetable.filter(t => t.day === day);
                    return (
                      <div key={day} className="bg-sage/10 rounded-xl p-3 border border-line-border/30 space-y-3">
                        <h4 className="font-sans font-bold text-xs border-b border-line-border/40 pb-1.5 text-teal-dark">{day}</h4>
                        <div className="space-y-2">
                          {dayLessons.map(l => (
                            <div key={l.id} className="bg-paper border border-line-border/20 rounded-lg p-2 text-[10px] hover:shadow-sm transition-shadow">
                              <p className="font-bold text-ink/80">{l.subject}</p>
                              <p className="text-[9px] text-ink/50 mt-0.5">{l.period}</p>
                            </div>
                          ))}
                          {dayLessons.length === 0 && (
                            <p className="text-[9px] text-ink/40 italic py-2">No periods</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar widgets */}
            <div className="space-y-8">
              {/* Announcements list */}
              <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
                <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                  <Bell className="w-4.5 h-4.5 text-teal-primary" /><span>Portal Announcements</span>
                </h3>
                <div className="space-y-3">
                  {announcements.map((ann, i) => (
                    <div key={i} className="bg-sage/10 rounded-xl p-3 border border-line-border/35 space-y-1">
                      <h4 className="font-sans font-bold text-xs text-ink">{ann.title}</h4>
                      <p className="text-[10px] text-ink/65 leading-relaxed">{ann.content}</p>
                      <span className="block text-[8px] font-mono text-ink/40 mt-1">{new Date(ann.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {announcements.length === 0 && (
                    <p className="text-xs text-ink/40 italic py-4 text-center">No announcements issued for this class.</p>
                  )}
                </div>
              </div>

              {/* Discipline flags */}
              <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
                <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                  <Shield className="w-4.5 h-4.5 text-brick-critical" /><span>Discipline Monitoring Flags</span>
                </h3>
                <div className="space-y-2.5">
                  {incidents.filter(i => i.status === 'open').map((inc, i) => (
                    <div key={i} className="bg-brick-critical/5 rounded-xl p-3 border border-brick-critical/15 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[10px] text-ink">{inc.student_name}</span>
                        <span className="text-[8px] uppercase font-bold text-brick-critical bg-brick-critical/10 px-1.5 py-0.5 rounded">{inc.severity}</span>
                      </div>
                      <p className="text-[9px] text-ink/65 leading-relaxed">{inc.description}</p>
                    </div>
                  ))}
                  {incidents.filter(i => i.status === 'open').length === 0 && (
                    <p className="text-xs text-ink/40 italic py-4 text-center">All class discipline records clean.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card rounded-2xl p-8 text-center text-xs text-ink/50 font-sans">
          No class assigned to your staff profile. Contact system admin to assign your grade level.
        </div>
      )}
    </div>
  );
};

// ─── Parent Dashboard View ────────────────────────────────────────────────────
const ParentDashboardView = ({ schoolId }) => {
  const [kids, setKids] = useState([]);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [profile, setProfile] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingKids, setLoadingKids] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [err, setErr] = useState('');
  
  // Library search
  const [libSearch, setLibSearch] = useState('');
  const [libBooks, setLibBooks] = useState([]);
  const [searchingLib, setSearchingLib] = useState(false);

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
    
    const fetchKidDetails = async () => {
      try {
        const profRes = await api.get(`/schools/${schoolId}/students/${selectedKidId}/profile`);
        setProfile(profRes.data);
        
        const classId = profRes.data?.student?.class_id;
        if (classId) {
          const [ttRes, annRes] = await Promise.all([
            api.get(`/schools/${schoolId}/timetable?class_id=${classId}`),
            api.get(`/schools/${schoolId}/announcements?class_id=${classId}`)
          ]);
          setTimetable(ttRes.data || []);
          setAnnouncements(annRes.data || []);
        } else {
          // General school announcements
          const annRes = await api.get(`/schools/${schoolId}/announcements`);
          setAnnouncements(annRes.data || []);
          setTimetable([]);
        }
      } catch (ex) {
        console.error(ex);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchKidDetails();
  }, [schoolId, selectedKidId]);

  // Handle library search
  const handleLibSearch = (term) => {
    setLibSearch(term);
    if (!term) { setLibBooks([]); return; }
    setSearchingLib(true);
    api.get(`/schools/${schoolId}/library?search=${encodeURIComponent(term)}&per_page=5`)
      .then(res => setLibBooks(res.data || []))
      .catch(() => setLibBooks([]))
      .finally(() => setSearchingLib(false));
  };

  if (loadingKids) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-primary mb-2" />
        <p className="text-xs text-ink/50 font-sans">Locating linked student profiles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Kid Selector Header */}
      <div className="glass-card rounded-3xl p-6 bg-gradient-to-r from-teal-500/10 to-teal-600/5 border border-teal-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">Welcome back, Parent / Guardian!</h2>
          <p className="text-sm font-sans text-ink/65 mt-1">Review notices, tuition balances, and timetables for your kids.</p>
        </div>
        {kids.length > 1 && (
          <div className="flex items-center space-x-3 bg-paper p-1.5 rounded-2xl border border-line-border/30">
            <span className="text-xs font-bold text-ink/60 pl-3">Select Ward:</span>
            <div className="flex space-x-1">
              {kids.map(k => (
                <button
                  key={k.id}
                  onClick={() => setSelectedKidId(k.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedKidId === k.id ? 'bg-teal-primary text-paper shadow-sm' : 'text-ink/60 hover:bg-sage/10'}`}
                >
                  {k.first_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {err && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-xs">{err}</div>}

      {kids.length === 0 ? (
        <div className="p-12 text-center glass-card rounded-2xl border border-line-border/30">
          <p className="text-sm text-ink/55">No student profile is currently linked to your guardian account. Please contact the school registry to map your National ID card to your children's files.</p>
        </div>
      ) : loadingProfile || !profile ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary mb-2" />
          <p className="text-xs text-ink/50 font-sans">Retrieving report cards and billing details...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Columns */}
          <div className="lg:col-span-2 space-y-8">
            {/* Student Overview Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Profile details */}
              <div className="glass-card rounded-2xl p-5 border border-line-border/30 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Student Profile</span>
                  <h4 className="text-lg font-bold text-ink mt-2">{profile.student?.first_name} {profile.student?.last_name}</h4>
                  <p className="text-xs text-ink/60 mt-0.5">Adm #: <span className="font-mono">{profile.student?.admission_number}</span></p>
                  <p className="text-xs text-ink/60 mt-0.5">Class: <span className="font-semibold text-teal-dark">{profile.student?.class_name || 'Unassigned'}</span></p>
                </div>
                <div className="mt-4 pt-3 border-t border-line-border/20 flex justify-between items-center text-[10px] font-sans">
                  <span className="text-ink/50">Status</span>
                  <span className="bg-sage/40 text-teal-dark px-2.5 py-0.5 rounded-full font-bold uppercase">{profile.student?.status}</span>
                </div>
              </div>

              {/* Fee collection card */}
              <div className="glass-card rounded-2xl p-5 border border-line-border/30 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Fees &amp; Invoicing</span>
                  {profile.fee_summary ? (
                    <div className="mt-2">
                      <h4 className="text-2xl font-display font-bold text-brick-critical numeric-data">
                        ${(parseFloat(profile.fee_summary.amount_due) - parseFloat(profile.fee_summary.amount_paid)).toFixed(2)}
                      </h4>
                      <p className="text-[10px] text-ink/50 mt-1">Outstanding Balance for {profile.fee_summary.term}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-ink/40 mt-2">No active billing record for this term</p>
                  )}
                </div>
                {profile.fee_summary && (
                  <div className="pt-3 border-t border-line-border/20 flex justify-between items-center text-[10px]">
                    <span className="text-ink/50 font-sans">Term Budget</span>
                    <span className="font-bold font-mono text-ink/80">${parseFloat(profile.fee_summary.amount_due).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Attendance Card */}
              <div className="glass-card rounded-2xl p-5 border border-line-border/30 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider">Class Attendance</span>
                  <div className="mt-2">
                    <h4 className="text-2xl font-display font-bold text-teal-primary">{profile.attendance_summary?.percentage}%</h4>
                    <p className="text-[10px] text-ink/50 mt-1">{profile.attendance_summary?.present} present / {profile.attendance_summary?.absent} absent days</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-line-border/20 flex justify-between items-center text-[10px]">
                  <span className="text-ink/50 font-sans">Total Ledger Days</span>
                  <span className="font-bold font-mono text-ink/80">{profile.attendance_summary?.total_days} days</span>
                </div>
              </div>
            </div>

            {/* School Timetable */}
            <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
              <div className="border-b border-line-border/30 pb-3">
                <h3 className="font-sans font-bold text-sm text-ink">Class Schedule (Weekly Timetable)</h3>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                  const dayLessons = timetable.filter(t => t.day_of_week === day);
                  return (
                    <div key={day} className="bg-sage/10 rounded-xl p-3 border border-line-border/30 space-y-3">
                      <h4 className="font-sans font-bold text-xs border-b border-line-border/40 pb-1.5 text-teal-dark">{day}</h4>
                      <div className="space-y-2">
                        {dayLessons.map(l => (
                          <div key={l.id} className="bg-paper border border-line-border/20 rounded-lg p-2 text-[10px]">
                            <p className="font-bold text-ink/80">{l.subject_name || l.subject_id}</p>
                            <p className="text-[9px] text-ink/50 mt-0.5">{l.start_time.substring(0,5)} - {l.end_time.substring(0,5)}</p>
                          </div>
                        ))}
                        {dayLessons.length === 0 && (
                          <p className="text-[9px] text-ink/40 italic py-2">No classes</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Academic performance and grades */}
            <div className="glass-card rounded-2xl border border-line-border/30 overflow-hidden">
              <div className="p-5 border-b border-line-border/30 bg-sage/5">
                <h3 className="font-sans font-bold text-sm text-ink">Recent Subject Grades &amp; Assessments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                  <thead>
                    <tr className="bg-sage/10 border-b border-line-border text-ink/60 font-bold uppercase tracking-wider">
                      <th className="py-3 px-5">Subject</th>
                      <th className="py-3 px-5">Term</th>
                      <th className="py-3 px-5">Assessment Type</th>
                      <th className="py-3 px-5 text-right">Grade Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/30">
                    {profile.grades_summary?.map((g, idx) => (
                      <tr key={idx} className="hover:bg-sage/5 transition-colors">
                        <td className="py-3 px-5 font-bold">{g.subject}</td>
                        <td className="py-3 px-5 text-ink/75 font-mono">{g.term}</td>
                        <td className="py-3 px-5 capitalize text-ink/65">{g.assessment_type}</td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-teal-primary text-sm">{g.grade_value}</td>
                      </tr>
                    ))}
                    {(!profile.grades_summary || profile.grades_summary.length === 0) && (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-ink/45">No grades posted for this student yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fees Payments Ledger */}
            {profile.fee_summary && (
              <div className="glass-card rounded-2xl border border-line-border/30 overflow-hidden">
                <div className="p-5 border-b border-line-border/30 bg-sage/5">
                  <h3 className="font-sans font-bold text-sm text-ink">Recent Invoice Payment Receipts</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border text-ink/60 font-bold uppercase tracking-wider">
                        <th className="py-3 px-5">Payment Date</th>
                        <th className="py-3 px-5">Reference/TxID</th>
                        <th className="py-3 px-5 text-right">Amount Settled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/30">
                      {profile.fee_history?.map((p, idx) => (
                        <tr key={idx} className="hover:bg-sage/5 transition-colors">
                          <td className="py-3 px-5 font-mono text-ink/65">{new Date(p.payment_date).toLocaleDateString()}</td>
                          <td className="py-3 px-5 font-mono font-bold text-ink/85">{p.reference}</td>
                          <td className="py-3 px-5 text-right font-bold text-teal-dark font-mono">${parseFloat(p.amount_paid).toFixed(2)}</td>
                        </tr>
                      ))}
                      {(!profile.fee_history || profile.fee_history.length === 0) && (
                        <tr>
                          <td colSpan="3" className="py-8 text-center text-ink/45">No payment history found for this term.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column sidebar */}
          <div className="space-y-8">
            {/* Class announcements */}
            <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
              <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                <Bell className="w-4.5 h-4.5 text-teal-primary" /><span>Notices &amp; Announcements</span>
              </h3>
              <div className="space-y-3.5">
                {announcements.map(ann => (
                  <div key={ann.id} className="bg-sage/10 rounded-xl p-3.5 border-l-4 border-teal-primary/40 space-y-1">
                    <div className="flex justify-between text-[9px] font-sans text-ink/50">
                      <span className="font-bold text-teal-dark">{ann.class_name ? `Class notice: ${ann.class_name}` : 'General School Notice'}</span>
                      <span className="font-mono">{new Date(ann.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-sans font-bold text-xs text-ink/90 mt-0.5">{ann.title}</h4>
                    <p className="text-[10px] text-ink/65 mt-1 leading-relaxed">{ann.content}</p>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <p className="text-xs text-ink/40 italic text-center py-4">No recent announcements from class teacher</p>
                )}
              </div>
            </div>

            {/* Administration Feedback Bulletin */}
            <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
              <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                <MessageSquare className="w-4.5 h-4.5 text-teal-primary" />
                <span>Principal &amp; Admin Bulletin</span>
              </h3>
              <div className="space-y-3.5">
                {profile.comments?.map(comm => (
                  <div key={comm.id} className="bg-teal-primary/[0.02] border-l-4 border-teal-primary/60 rounded-xl p-3.5 space-y-1.5 shadow-sm">
                    <div className="flex justify-between text-[9px] font-sans text-ink/50">
                      <span className="font-bold text-teal-dark uppercase tracking-wider">
                        {comm.report_type?.replace('_', ' ')} Review
                      </span>
                      <span className="font-mono">{new Date(comm.created_at).toLocaleDateString()}</span>
                    </div>
                    <blockquote className="text-[11px] text-ink/80 italic font-medium leading-relaxed">
                      "{comm.comment}"
                    </blockquote>
                    <div className="text-[9px] font-sans text-ink/40 text-right font-semibold">
                      — {comm.author_full_name} (Principal / Registrar)
                    </div>
                  </div>
                ))}
                {(!profile.comments || profile.comments.length === 0) && (
                  <p className="text-xs text-ink/40 italic text-center py-4">No recent remarks posted by principal</p>
                )}
              </div>
              <div className="border-t border-line-border/30 pt-3 flex justify-between items-center text-[10px]">
                <span className="text-ink/50">Questions?</span>
                <a
                  href="mailto:registrar@schoolbase.co.zw?subject=Clarification%20Request"
                  className="text-teal-primary hover:underline font-bold"
                >
                  Contact Registry →
                </a>
              </div>
            </div>

            {/* Discipline Feed (VIEW-ONLY for parent) */}
            <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
              <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                <Shield className="w-4.5 h-4.5 text-brick-critical" /><span>Discipline Records (View-Only)</span>
              </h3>
              <div className="space-y-3">
                {profile.discipline_history?.map((inc, idx) => (
                  <div key={idx} className="bg-rose-500/5 rounded-xl p-3 border border-rose-500/10 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-semibold text-ink/50">
                      <span className="font-bold text-ink/70">{inc.incident_type}</span>
                      <span className="font-mono">{inc.incident_date}</span>
                    </div>
                    <p className="text-[10px] text-ink/75">{inc.description}</p>
                    {inc.action_taken && <p className="text-[9px] text-ink/50 italic">Action: {inc.action_taken}</p>}
                    <div className="flex justify-between items-center text-[9px] pt-1">
                      <span className="bg-brick-critical/10 text-brick-critical px-2 py-0.5 rounded-full font-bold uppercase">{inc.severity}</span>
                      <span className={`font-bold uppercase ${inc.status === 'resolved' ? 'text-teal-primary' : 'text-amber-warning'}`}>{inc.status}</span>
                    </div>
                  </div>
                ))}
                {(!profile.discipline_history || profile.discipline_history.length === 0) && (
                  <p className="text-xs text-ink/40 italic text-center py-4">Excellent! No discipline incidents reported.</p>
                )}
              </div>
            </div>

            {/* Quick Library Catalog search */}
            <div className="glass-card rounded-2xl border border-line-border/30 p-5 space-y-4">
              <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                <BookOpen className="w-4.5 h-4.5 text-teal-primary" /><span>Library Catalog Lookup</span>
              </h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink/40" />
                <input
                  type="text"
                  placeholder="Search book title or author..."
                  className="w-full pl-9 pr-3 py-2 border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary bg-paper/50"
                  value={libSearch}
                  onChange={e => handleLibSearch(e.target.value)}
                />
              </div>
              {searchingLib ? (
                <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-teal-primary" /></div>
              ) : (
                <div className="space-y-2">
                  {libBooks.map(b => (
                    <div key={b.id} className="bg-sage/10 rounded-xl p-2.5 border border-line-border/20 flex justify-between items-center">
                      <div>
                        <h4 className="font-sans font-bold text-[11px] text-ink">{b.title}</h4>
                        <p className="text-[9px] text-ink/50 mt-0.5">By {b.author || 'Unknown'}</p>
                      </div>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${b.copies_available > 0 ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'}`}>
                        {b.copies_available > 0 ? 'Available' : 'Out'}
                      </span>
                    </div>
                  ))}
                  {libBooks.length === 0 && libSearch && (
                    <p className="text-[10px] text-ink/40 text-center italic py-2">No matching books found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard Component ─────────────────────────────────────────────────
const Dashboard = () => {
  const { activeSchoolId, user } = useAuth();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = useCallback(() => {
    if (!activeSchoolId) return;
    
    // Parents and Teachers do not need overall school metrics data
    if (user?.role === 'parent' || user?.role === 'teacher') {
      setLoading(false);
      return;
    }

    setLoading(true);
    api.get(`/schools/${activeSchoolId}/dashboard/extended`)
      .then(res => { setData(res.data); setError(''); })
      .catch(err => {
        console.error('Dashboard error:', err);
        setError('Failed to load dashboard. Check backend connectivity.');
      })
      .finally(() => setLoading(false));
  }, [activeSchoolId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!activeSchoolId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <AlertTriangle className="w-16 h-16 text-amber-warning mb-4" />
        <h2 className="text-2xl font-display font-bold text-ink">No Active School Selected</h2>
        <p className="text-ink/60 max-w-md mt-2 font-sans text-sm">Select a school from the sidebar to load the portal.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-10 h-10 animate-spin text-teal-primary mb-4"/>
        <p className="text-xs font-sans text-ink/50">Loading school portal…</p>
      </div>
    );
  }

  const kpis  = data?.kpis  || {};
  const today = new Date().toLocaleDateString('en-ZW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getHeaderTitle = () => {
    if (user?.role === 'super_admin') return "Super Admin View — Principal Hub";
    if (user?.role === 'teacher') return "Teacher's Console";
    if (user?.role === 'parent') return "Parent Portal";
    return "Principal's Command Hub";
  };

  const getHeaderSubtitle = () => {
    if (user?.role === 'teacher') return "Class schedules, grades registers, and student activity overview";
    if (user?.role === 'parent') return "Access your child's academic progress, attendance ledger, and notices";
    return "Unified school operations view — drill down to any detail";
  };

  return (
    <div className="min-h-screen px-6 md:px-8 py-8 max-w-7xl mx-auto space-y-10 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-wrap gap-4 justify-between items-start border-b border-line-border/30 pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">{getHeaderTitle()}</h1>
          <p className="text-sm font-sans text-ink/55 mt-1">{getHeaderSubtitle()}</p>
        </div>
        <div className="flex items-center space-x-2 bg-sage/30 px-3 py-1.5 rounded-xl border border-line-border/40 text-teal-dark font-sans text-xs font-semibold">
          <Calendar className="w-4 h-4 text-teal-primary" /><span>{today}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm font-sans">{error} (Some sections may show placeholder data)</div>
      )}

      {/* Conditional Dashboard Rendering based on User Role */}
      {user?.role === 'teacher' ? (
        <TeacherDashboardView schoolId={activeSchoolId} />
      ) : user?.role === 'parent' ? (
        <ParentDashboardView schoolId={activeSchoolId} />
      ) : (
        <>
          {user?.role === 'school_admin' && data?.license?.warning && (
            <div className="p-4 rounded-xl bg-amber-warning/15 border border-amber-warning/30 text-amber-warning flex items-center space-x-3 text-xs font-sans font-bold animate-pulse">
              <AlertTriangle className="w-5 h-5 text-amber-warning flex-shrink-0" />
              <span>Notice: Your school access license is expiring on {new Date(data.license.expires_at).toLocaleDateString()} ({data.license.days_left} days remaining). Please contact system admin to renew.</span>
            </div>
          )}

          {/* ── Section 1: KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            <KpiCard label="Total Students"      value={kpis.total_students}      icon={Users}    />
            <KpiCard label="Total Teachers"      value={kpis.total_staff}         icon={UserCheck} />
            <KpiCard label="Attendance Today"    value={kpis.attendance_today_pct} icon={UserCheck} suffix="%" color={kpis.attendance_today_pct >= 85 ? 'green' : 'amber'} />
            <KpiCard label="Registers Submitted" value={kpis.registers_submitted}  icon={FileText}
              sublabel={`${kpis.registers_pending ?? 0} pending`}
              color={kpis.registers_pending > 0 ? 'amber' : 'teal'}
            />
            <KpiCard label="Fees Collected"      value={kpis.fees_collected_pct}   icon={DollarSign} suffix="%" color={kpis.fees_collected_pct >= 80 ? 'green' : 'amber'} />
            <KpiCard label="Exams This Week"     value={kpis.upcoming_exams}       icon={BookOpen}  />
            <KpiCard label="Open Incidents"      value={kpis.open_incidents}       icon={Shield}  color={kpis.open_incidents > 0 ? 'red' : 'teal'} />
          </div>

          {/* ── Section 2: Attendance ── */}
          <AttendanceSection data={data?.attendance_detail || []} schoolId={activeSchoolId} onCommentPosted={fetchData} />

          {/* ── Section 3: Academic Performance ── */}
          <GradesSection
            data={data?.grade_averages || []}
            topStudents={data?.top_students || []}
            bottomStudents={data?.bottom_students || []}
            schoolId={activeSchoolId}
            onCommentPosted={fetchData}
          />

          {/* ── Academic Performance Drill-down ── */}
          <StudentPerformanceBreakdown schoolId={activeSchoolId} />

          {/* ── Section 4: Fee Collection ── */}
          <FeeSection donut={data?.fee_donut} breakdown={data?.fee_breakdown || []} schoolId={activeSchoolId} onCommentPosted={fetchData} />

          {/* ── Section 5: Staff Activity ── */}
          <StaffSection data={data?.staff_activity || []} schoolId={activeSchoolId} onRefresh={fetchData} />

          {/* ── Section 5.5: Overdue Tasks ── */}
          <OverdueTasksSection data={data?.overdue_tasks || []} />

          {/* ── Section 6: Upcoming Exams ── */}
          <ExamsSection data={data?.upcoming_exams || []} schoolId={activeSchoolId} onCommentPosted={fetchData} />

          {/* ── Section 7: Discipline Feed ── */}
          <DisciplineSection data={data?.discipline_feed || []} schoolId={activeSchoolId} onCommentPosted={fetchData} onRefresh={fetchData} />

          {/* ── Section 8: Principal's Comments Log ── */}
          <CommentsLog data={data?.recent_comments || []} />
        </>
      )}

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  );
};
export default Dashboard;