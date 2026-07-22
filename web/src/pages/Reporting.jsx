import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { 
  FileBarChart2, Download, TrendingUp, AlertTriangle, Users, 
  Landmark, ShieldCheck, CheckCircle2, AlertCircle, MessageSquare, 
  Award, User, RefreshCw, HardDrive, Loader2
} from 'lucide-react';

const Reporting = () => {
  const { user, activeSchoolId } = useAuth();
  
  // Super Admin stats
  const [platformReports, setPlatformReports] = useState(null);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformError, setPlatformError] = useState('');

  // Predictive Intelligence & Data Science stats
  const [predictiveData, setPredictiveData] = useState(null);
  const [predictiveLoading, setPredictiveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'data_science'
  
  // Principal annotations/comments state
  const [comments, setComments] = useState([]);
  const [commentForm, setCommentForm] = useState({ report_type: 'attendance', comment: '', ref_id: '' });
  const [commentSaving, setCommentSaving] = useState(false);

  // Determine current viewing school context
  const currentSchoolId = activeSchoolId || (user?.role === 'super_admin' ? null : user?.school_id);

  // 1. Fetch Platform stats (Super Admin Overview)
  const fetchPlatformData = useCallback(() => {
    setPlatformLoading(true);
    setPlatformError('');
    api.get('/admin/system-reports')
      .then(res => setPlatformReports(res.data || null))
      .catch(() => setPlatformError('Failed to fetch platform metrics.'))
      .finally(() => setPlatformLoading(false));
  }, []);

  // 2. Fetch School specific stats (Principal Audit View)
  const fetchSchoolData = useCallback((schoolId) => {
    if (!schoolId) return;
    setSchoolLoading(true);
    setSchoolError('');
    
    // Fetch extended dashboard stats
    api.get(`/schools/${schoolId}/dashboard/extended`)
      .then(res => {
        setSchoolStats(res.data);
      })
      .catch(() => setSchoolError('Could not retrieve detailed school analytics.'))
      .finally(() => setSchoolLoading(false));
      
    // Fetch predictive data science stats
    setPredictiveLoading(true);
    api.get('/analytics/predictive')
      .then(res => setPredictiveData(res.data))
      .catch(() => {})
      .finally(() => setPredictiveLoading(false));

    // Fetch comments
    api.get(`/schools/${schoolId}/comments`)
      .then(res => setComments(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role === 'super_admin' && !activeSchoolId) {
      fetchPlatformData();
    } else if (currentSchoolId) {
      fetchSchoolData(currentSchoolId);
    }
  }, [user, activeSchoolId, currentSchoolId, fetchPlatformData, fetchSchoolData]);

  // Handle saving principal comments
  const handleSaveComment = async (e) => {
    e.preventDefault();
    if (!currentSchoolId || !commentForm.comment.trim()) return;
    
    setCommentSaving(true);
    try {
      await api.post(`/schools/${currentSchoolId}/comments`, {
        report_type: commentForm.report_type,
        comment: commentForm.comment,
        ref_id: commentForm.ref_id ? commentForm.ref_id : null
      });
      setCommentForm({ ...commentForm, comment: '', ref_id: '' });
      // Refresh school data to pull new comments
      fetchSchoolData(currentSchoolId);
    } catch (err) {
      alert(err.message || 'Failed to submit annotation comment.');
    } finally {
      setCommentSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Render Super Admin cross-tenant technical reports
  if (user?.role === 'super_admin' && !activeSchoolId) {
    const schools = platformReports?.schools_metrics || [];
    const dbStats = platformReports?.db_stats || [];
    const totalUsers = schools.reduce((acc, s) => acc + (s.user_count || 0), 0);
    const totalSchools = schools.length;

    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn printable-area">
        <div className="flex justify-between items-center border-b border-line-border/30 pb-4 non-printable">
          <div>
            <h2 className="text-3xl font-display font-bold text-ink">System Reporting Desk</h2>
            <p className="text-sm font-sans text-ink/60 mt-1">Platform technical diagnostics, tenant user counts, and database status.</p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-teal-primary" />
            <span>Export PDF diagnostics</span>
          </button>
        </div>

        {platformError && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{platformError}</div>}

        {/* Technical KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 non-printable">
          <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Registered Tenants</span>
              <p className="text-2xl font-display font-bold text-ink mt-1 numeric-data">{totalSchools} schools</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-primary" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Active Logged Users</span>
              <p className="text-2xl font-display font-bold text-ink mt-1 numeric-data">{totalUsers} accounts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-ink/5 flex items-center justify-center">
              <Users className="w-5 h-5 text-ink/50" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">API Average Latency</span>
              <p className="text-2xl font-display font-bold text-teal-primary mt-1 numeric-data">{platformReports?.api_latency || '42ms'}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-primary" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">System Core Uptime</span>
              <p className="text-2xl font-display font-bold text-teal-primary mt-1 numeric-data">{platformReports?.uptime || '99.98%'}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sage/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-teal-dark" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tenant Resource Allocations & Quotas Table */}
          <div className="glass-card rounded-2xl p-6 space-y-4 lg:col-span-2 bg-white border border-line-border/30">
            <h3 className="text-sm font-sans font-bold text-ink border-b border-line-border/30 pb-3 flex items-center space-x-2">
              <Users className="w-4 h-4 text-teal-primary"/>
              <span>Tenant Resource &amp; Quota Allocations</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="bg-ink/5 text-ink/50 uppercase tracking-wider font-bold text-[9px]">
                    <th className="py-2.5 px-4">School Details</th>
                    <th className="py-2.5 px-4 text-center">User Allocation</th>
                    <th className="py-2.5 px-4 text-center">License Type</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border/10 text-ink">
                  {platformLoading ? (
                    <tr><td colSpan="4" className="py-8 text-center text-ink/40">Loading metrics...</td></tr>
                  ) : schools.length > 0 ? (
                    schools.map((s, idx) => {
                      const max = s.license_max_users || 100;
                      const pct = Math.min(100, Math.round(((s.user_count || 0) * 100) / max));
                      return (
                        <tr key={idx} className="hover:bg-sage/5 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-ink">{s.school_name}</p>
                            <p className="text-[10px] font-mono text-ink/50 mt-0.5">{s.school_code}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-xs font-semibold">{s.user_count} / {max}</span>
                              <div className="w-24 h-1.5 bg-ink/5 rounded-full mt-1.5 overflow-hidden">
                                <div className="h-full bg-teal-primary" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center uppercase font-bold text-teal-primary text-[10px]">{s.license_plan || 'none'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              s.school_status === 'active' ? 'bg-sage/40 text-teal-dark' : 'bg-brick-critical/10 text-brick-critical'
                            }`}>{s.school_status}</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="4" className="py-8 text-center text-ink/40">No school tenants found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Subscription & Revenue Forecasts */}
          <div className="glass-card rounded-2xl p-6 space-y-4 bg-white border border-line-border/30">
            <h3 className="text-sm font-sans font-bold text-ink border-b border-line-border/30 pb-3 flex items-center space-x-2">
              <Landmark className="w-4 h-4 text-teal-primary"/>
              <span>Subscription &amp; Revenue Forecasts</span>
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-sage/5 border border-line-border/10 rounded-xl">
                  <span className="text-[10px] text-ink/50 uppercase font-bold">Basic Plans</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-sm font-bold text-ink">{schools.filter(s => s.license_plan === 'basic' && s.school_status === 'active').length} active</span>
                    <span className="font-mono text-xs text-teal-primary font-bold">${schools.filter(s => s.license_plan === 'basic' && s.school_status === 'active').length * 150}</span>
                  </div>
                </div>
                <div className="p-3 bg-sage/5 border border-line-border/10 rounded-xl">
                  <span className="text-[10px] text-ink/50 uppercase font-bold">Full Plans</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-sm font-bold text-ink">{schools.filter(s => s.license_plan === 'full' && s.school_status === 'active').length} active</span>
                    <span className="font-mono text-xs text-teal-primary font-bold">${schools.filter(s => s.license_plan === 'full' && s.school_status === 'active').length * 400}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-line-border/30 pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-ink/60 font-medium">Monthly Recurring Revenue (MRR)</span>
                  <span className="font-mono font-bold text-teal-primary text-sm">
                    ${(schools.filter(s => s.license_plan === 'basic' && s.school_status === 'active').length * 150) + 
                      (schools.filter(s => s.license_plan === 'full' && s.school_status === 'active').length * 400)} / mo
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-ink/60 font-medium">Annual Run Rate (ARR)</span>
                  <span className="font-mono font-bold text-teal-primary text-sm">
                    ${((schools.filter(s => s.license_plan === 'basic' && s.school_status === 'active').length * 150) + 
                       (schools.filter(s => s.license_plan === 'full' && s.school_status === 'active').length * 400)) * 12} / yr
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-ink/40 leading-relaxed italic">
                * Projections are dynamically calculated using active basic license seats ($150/mo) and full license seats ($400/mo). Excludes dynamic user count overage metrics.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render School Admin (Principal) Audit & Reporting Dashboard
  const kpis = schoolStats?.kpis || {};
  const attendanceDetail = schoolStats?.attendance_detail || [];
  const gradeAverages = schoolStats?.grade_averages || [];
  const topStudents = schoolStats?.top_students || [];
  const bottomStudents = schoolStats?.bottom_students || [];
  const feeBreakdown = schoolStats?.fee_breakdown || [];
  const staffActivity = schoolStats?.staff_activity || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn printable-area">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4 non-printable">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">School Audit &amp; Performance Desk</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">
            {user?.role === 'super_admin' ? `Auditing Tenant school database records.` : `Principal portal for unified school oversight.`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchSchoolData(currentSchoolId)}
            className="p-2 border border-line-border rounded-xl hover:bg-sage/10 text-ink/75 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 border border-line-border rounded-xl text-xs font-semibold hover:bg-sage/10 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-teal-primary" />
            <span>Export School Report</span>
          </button>
        </div>
      </div>

      {schoolError && <div className="p-4 rounded-xl bg-brick-critical/10 border border-brick-critical/20 text-brick-critical text-sm">{schoolError}</div>}

      {schoolLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-teal-primary" />
          <p className="text-xs text-ink/50 font-sans">Compiling records and grading metrics...</p>
        </div>
      ) : (
        <>
          {/* KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Attendance Rate</span>
                <p className="text-2xl font-display font-bold text-ink mt-1 numeric-data">{kpis.attendance_today_pct || 0}%</p>
                <span className="text-[9px] text-ink/40 mt-1 block">Active date cycle today</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-teal-primary" />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Fees Collected</span>
                <p className="text-2xl font-display font-bold text-ink mt-1 numeric-data">{kpis.fees_collected_pct || 0}%</p>
                <span className="text-[9px] text-ink/40 mt-1 block">Term billing target clear</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Landmark className="w-5 h-5 text-purple-700" />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Registers Checked</span>
                <p className="text-2xl font-display font-bold text-ink mt-1 numeric-data">{kpis.registers_submitted || 0} / {kpis.total_classes || 0}</p>
                <span className="text-[9px] text-ink/40 mt-1 block">{kpis.registers_pending || 0} class registers missing</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-primary" />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider">Active Open Incidents</span>
                <p className="text-2xl font-display font-bold text-brick-critical mt-1 numeric-data">{kpis.open_incidents || 0}</p>
                <span className="text-[9px] text-ink/40 mt-1 block">Requires principal resolution</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brick-critical/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-brick-critical" />
              </div>
            </div>
          </div>

          {/* Attendance Registry & Drill Down (Principal Check who marked & % present) */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-teal-primary" />
              <span>Register Marking Submission &amp; Attention Drill-Down</span>
            </h3>
            
            <div className="overflow-x-auto border border-line-border/30 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-sage/10 border-b border-line-border font-bold text-ink/75 uppercase tracking-wider">
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Marked By (Teacher)</th>
                    <th className="py-3 px-4 text-center">Present / Total</th>
                    <th className="py-3 px-4 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                  {attendanceDetail.map((cls) => (
                    <tr key={cls.id} className="hover:bg-sage/5 transition-colors text-xs">
                      <td className="py-3 px-4 font-bold text-teal-dark">{cls.name}</td>
                      <td className="py-3 px-4 text-ink/60">{cls.grade_level}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          cls.status === 'submitted' ? 'bg-sage/35 text-teal-dark' : 'bg-amber-warning/10 text-amber-warning'
                        }`}>
                          {cls.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-ink/75">{cls.marked_by || 'Not Marked'}</td>
                      <td className="py-3 px-4 text-center font-mono">{cls.total > 0 ? `${cls.present} / ${cls.total}` : '0 / 0'}</td>
                      <td className="py-3 px-4 text-right font-bold font-mono">
                        <span className={cls.total > 0 && cls.pct < 80 ? 'text-brick-critical' : 'text-teal-primary'}>
                          {cls.pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {attendanceDetail.length === 0 && (
                    <tr><td colSpan="6" className="py-6 text-center text-ink/40">No classes registered at this school.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Academic & Rankings Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Class Grade Averages */}
            <div className="glass-card rounded-2xl p-6 space-y-4 lg:col-span-2">
              <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
                <FileBarChart2 className="w-4 h-4 text-teal-primary" />
                <span>Class Academic Performances (Current Term)</span>
              </h3>
              
              <div className="overflow-x-auto border border-line-border/30 rounded-xl max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sage/10 border-b border-line-border font-bold text-ink/75 uppercase tracking-wider">
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Students Graded</th>
                      <th className="py-3 px-4 text-right">Average Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                    {gradeAverages.map((g, idx) => (
                      <tr key={idx} className="hover:bg-sage/5 transition-colors text-xs">
                        <td className="py-2.5 px-4 font-bold text-ink">{g.class_name}</td>
                        <td className="py-2.5 px-4 text-ink/70 font-semibold">{g.subject}</td>
                        <td className="py-2.5 px-4 text-center font-mono">{g.student_count}</td>
                        <td className="py-2.5 px-4 text-right font-bold font-mono text-teal-primary">{g.avg_score}%</td>
                      </tr>
                    ))}
                    {gradeAverages.length === 0 && (
                      <tr><td colSpan="4" className="py-8 text-center text-ink/40">No academic grades catalogued for this term.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top / Bottom Students Rankings */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
                <Award className="w-4 h-4 text-teal-primary" />
                <span>School Performance Leaderboard</span>
              </h3>
              
              <div className="space-y-4 text-xs">
                {/* Top 3 */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-teal-primary uppercase tracking-wider">Top Performers</span>
                  <div className="divide-y divide-line-border/10 bg-sage/5 border border-line-border/20 rounded-xl p-2.5">
                    {topStudents.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between items-center">
                        <div className="truncate pr-1">
                          <p className="font-bold text-ink truncate">{s.student_name}</p>
                          <p className="text-[9px] text-ink/40 font-mono">{s.class_name}</p>
                        </div>
                        <span className="font-bold text-teal-primary font-mono">{s.avg_score}%</span>
                      </div>
                    ))}
                    {topStudents.length === 0 && <p className="text-center text-ink/40 py-2">No records found.</p>}
                  </div>
                </div>

                {/* Bottom 3 */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-brick-critical uppercase tracking-wider">Unsatisfactory/Attention Required</span>
                  <div className="divide-y divide-line-border/10 bg-brick-critical/5 border border-brick-critical/10 rounded-xl p-2.5">
                    {bottomStudents.slice(0, 3).map((s, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between items-center">
                        <div className="truncate pr-1">
                          <p className="font-bold text-ink truncate">{s.student_name}</p>
                          <p className="text-[9px] text-ink/40 font-mono">{s.class_name}</p>
                        </div>
                        <span className="font-bold text-brick-critical font-mono">{s.avg_score}%</span>
                      </div>
                    ))}
                    {bottomStudents.length === 0 && <p className="text-center text-ink/40 py-2">No records found.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fees Collection breakdown & Staff Roster logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fee Collection by Class */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-purple-700" />
                <span>Class Fee Collections Summary</span>
              </h3>
              
              <div className="overflow-x-auto border border-line-border/30 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-purple-50 border-b border-line-border font-bold text-purple-900/75 uppercase tracking-wider">
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4 text-right">Target Billed</th>
                      <th className="py-3 px-4 text-right">Collected</th>
                      <th className="py-3 px-4 text-right">Unpaid / Partial Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                    {feeBreakdown.map((f, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/20 transition-colors text-xs">
                        <td className="py-2.5 px-4 font-bold">{f.class_name}</td>
                        <td className="py-2.5 px-4 text-right font-mono">${parseFloat(f.total_due || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-teal-primary font-bold">${parseFloat(f.total_paid || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-brick-critical font-bold">{parseInt(f.unpaid || 0) + parseInt(f.partial || 0)} Students</td>
                      </tr>
                    ))}
                    {feeBreakdown.length === 0 && (
                      <tr><td colSpan="4" className="py-6 text-center text-ink/40">No fee structures built for this term.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Staff Audit & Submissions Logs */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-primary" />
                <span>Staff Activity &amp; Roster Compliance Logs</span>
              </h3>

              <div className="overflow-x-auto border border-line-border/30 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sage/10 border-b border-line-border font-bold text-ink/75 uppercase tracking-wider">
                      <th className="py-3 px-4">Staff Name</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4 text-center">Registers Marked Today</th>
                      <th className="py-3 px-4 text-right">Last Login Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-border/50 text-sm font-sans text-ink">
                    {staffActivity.map((st, idx) => (
                      <tr key={idx} className="hover:bg-sage/5 transition-colors text-xs">
                        <td className="py-2.5 px-4 font-bold">{st.name}</td>
                        <td className="py-2.5 px-4 font-mono">{st.username}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-teal-primary">{st.registers_today || 0}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-ink/65">{st.last_login ? new Date(st.last_login).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Annotations & Comment Log Box (Principal Feedback) */}
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h3 className="text-sm font-sans font-bold text-ink flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-teal-primary" />
              <span>Principal Comments &amp; Academic Report Annotations</span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Comment submission form */}
              <div>
                <form onSubmit={handleSaveComment} className="space-y-4 p-4 bg-sage/5 border border-line-border/20 rounded-2xl text-xs font-sans">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">Add Principal Annotation</h4>
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-ink/65 mb-1">Report Category</label>
                    <select 
                      className="w-full glass-input rounded-lg text-xs"
                      value={commentForm.report_type}
                      onChange={e => setCommentForm({ ...commentForm, report_type: e.target.value })}
                    >
                      <option value="attendance">Register Marking / Presence</option>
                      <option value="grades">Exam / Academic Performance</option>
                      <option value="fees">Fees &amp; Financials</option>
                      <option value="general">General Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-ink/65 mb-1">Specific Class Reference (Optional)</label>
                    <select 
                      className="w-full glass-input rounded-lg text-xs"
                      value={commentForm.ref_id}
                      onChange={e => setCommentForm({ ...commentForm, ref_id: e.target.value })}
                    >
                      <option value="">No specific class reference...</option>
                      {attendanceDetail.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-ink/65 mb-1">Comment / Direction</label>
                    <textarea 
                      required 
                      rows={3} 
                      placeholder="Leave instructions, congratulations, or corrections here..." 
                      className="w-full glass-input rounded-lg text-xs" 
                      value={commentForm.comment}
                      onChange={e => setCommentForm({ ...commentForm, comment: e.target.value })}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={commentSaving}
                    className="w-full py-2 bg-teal-primary hover:bg-teal-dark text-paper font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {commentSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Annotation</span>
                  </button>
                </form>
              </div>

              {/* Feed of recent comments */}
              <div className="lg:col-span-2 space-y-3">
                <h4 className="text-xs font-bold text-ink/60 uppercase tracking-wider">Historical Principal Annotation Stream</h4>
                
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {comments.map((c, idx) => (
                    <div key={idx} className="p-3 bg-white border border-line-border/20 rounded-xl space-y-2 shadow-sm text-xs">
                      <div className="flex justify-between items-center">
                        <span className="px-2 py-0.5 bg-teal-primary/10 text-teal-primary text-[8px] uppercase tracking-wider font-bold rounded-full">
                          {c.report_type}
                        </span>
                        <span className="text-[10px] text-ink/40 font-mono">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-sans text-ink font-medium text-xs leading-relaxed italic">
                        "{c.comment}"
                      </p>
                      <div className="flex items-center space-x-1.5 text-[10px] text-ink/50 border-t border-line-border/10 pt-2 font-semibold">
                        <User className="w-3 h-3 text-teal-primary" />
                        <span>Signed: <b>{c.author}</b></span>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <div className="h-40 border border-dashed border-line-border/30 rounded-xl flex items-center justify-center text-xs text-ink/40">
                      No report annotations logged yet. Leave one on the left.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reporting;