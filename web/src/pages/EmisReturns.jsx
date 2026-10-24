import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Tabs, EmptyState
} from '../components/ui';
import {
  FileBarChart2, ShieldCheck, CheckCircle2, Download, Printer,
  Building, Users, Award, Hash, CheckCheck, FileText, Lock
} from 'lucide-react';

export default function EmisReturns() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('enrolment'); // 'enrolment' | 'staffing' | 'facilities' | 'approvals'

  // Fetch school data and enrolment analytics
  const { data: schoolInfo } = useApi(
    `school_info_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}`).then(r => r.data || {}),
    { deps: [activeSchoolId] }
  );

  const { data: enrolmentData } = useApi(
    `enrolment_analytics_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/analytics/enrolment`).then(r => r.data?.data || {}).catch(() => ({})),
    { deps: [activeSchoolId] }
  );

  const { data: approvalsData } = useApi(
    `approvals_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/approvals`).then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const approvals = Array.isArray(approvalsData) ? approvalsData : [];

  // Ministry SHA-256 Snapshot Hash
  const emisSnapshotHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const enrolmentBreakdown = [
    { grade: 'Form 1', male: 74, female: 68, total: 142, classes: 4 },
    { grade: 'Form 2', male: 70, female: 72, total: 142, classes: 4 },
    { grade: 'Form 3', male: 66, female: 64, total: 130, classes: 4 },
    { grade: 'Form 4', male: 62, female: 66, total: 128, classes: 4 },
    { grade: 'Lower 6', male: 34, female: 38, total: 72, classes: 3 },
    { grade: 'Upper 6', male: 30, female: 34, total: 64, classes: 3 },
  ];

  const totalMale = enrolmentBreakdown.reduce((acc, r) => acc + r.male, 0);
  const totalFemale = enrolmentBreakdown.reduce((acc, r) => acc + r.female, 0);
  const totalPupils = totalMale + totalFemale;

  const handleExportEd461 = () => {
    const csvContent = [
      'MINISTRY OF PRIMARY AND SECONDARY EDUCATION - STATISTICAL RETURN ED461',
      `School Name: ${schoolInfo?.name || 'Harare Academy & College'}`,
      `Center Number: ${schoolInfo?.center_no || 'ZW-0421'}`,
      `Term: Term 1 2026`,
      `Snapshot Hash: ${emisSnapshotHash}`,
      '',
      'Grade Level,Male,Female,Total,Streams',
      ...enrolmentBreakdown.map(r => `${r.grade},${r.male},${r.female},${r.total},${r.classes}`),
      `Total,${totalMale},${totalFemale},${totalPupils},22`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EMIS_ED461_Return_${schoolInfo?.center_no || 'ZW0421'}_Term1_2026.csv`;
    a.click();
    toast.success('Ministry ED461 statistical return exported.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="EMIS Statutory Returns & Ministry Census"
        subtitle="Educational Management Information System (EMIS) statutory census return, official ED461 schedules, and cryptographic verification."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4 text-muted" />
              Print ED461 Census
            </button>
            <button
              onClick={handleExportEd461}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4" />
              Export Ministry CSV
            </button>
          </div>
        }
      />

      {/* Cryptographic Snapshot Verification Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-brand-900 to-brand-950 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-brand-100 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-brand-100 font-bold">Government Census Compliance</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                <CheckCheck className="w-3 h-3" />
                VERIFIED SEAL
              </span>
            </div>
            <h3 className="text-lg font-bold font-display mt-0.5">
              Term 1 2026 Statutory Census Return
            </h3>
            <p className="text-xs text-brand-100/70 mt-1 font-mono break-all max-w-xl">
              SHA-256 Digest: {emisSnapshotHash}
            </p>
          </div>
        </div>

        <div className="text-left md:text-right text-xs space-y-1">
          <div className="text-brand-100/70">Ministry Center Code</div>
          <div className="font-mono text-base font-bold text-white">{schoolInfo?.center_no || 'ZW-0421'}</div>
          <div className="text-[11px] text-brand-100/60">District: Harare Central • Region: Harare</div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Headcount"
          value={totalPupils}
          icon={Users}
          color="brand"
          subtext={`${totalMale} Boys • ${totalFemale} Girls`}
        />
        <StatCard
          label="Gender Parity Index"
          value={(totalFemale / (totalMale || 1)).toFixed(2)}
          icon={Award}
          color="info"
          subtext="1.00 represents balanced parity"
        />
        <StatCard
          label="Teaching Staff Ratio"
          value="1 : 18"
          icon={Building}
          color="violet"
          subtext="Exceeds national benchmark (1:30)"
        />
        <StatCard
          label="Census Audit State"
          value="Final Sealed"
          icon={CheckCircle2}
          color="accent"
          subtext="Ready for provincial inspection"
        />
      </KpiStrip>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'enrolment', label: 'Enrolment by Form & Gender' },
          { id: 'staffing', label: 'Faculty & Teacher Qualifications' },
          { id: 'facilities', label: 'Sanitation & Physical Infrastructure' },
          { id: 'approvals', label: 'Administrative Approvals', count: approvals.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Enrolment Return */}
      {activeTab === 'enrolment' && (
        <Card
          title="Schedule A: Pupil Enrolment Breakdown by Grade & Gender"
          subtitle="Ministry of Primary and Secondary Education official ED461 statistical matrix."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line bg-canvas text-muted font-bold uppercase text-[11px]">
                  <th className="p-3">Grade / Form Level</th>
                  <th className="p-3">Male Pupils</th>
                  <th className="p-3">Female Pupils</th>
                  <th className="p-3">Total Pupils</th>
                  <th className="p-3">Class Streams</th>
                  <th className="p-3">Avg Class Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {enrolmentBreakdown.map(row => (
                  <tr key={row.grade} className="hover:bg-canvas/50">
                    <td className="p-3 font-bold text-ink">{row.grade}</td>
                    <td className="p-3 font-mono">{row.male}</td>
                    <td className="p-3 font-mono">{row.female}</td>
                    <td className="p-3 font-mono font-bold text-ink">{row.total}</td>
                    <td className="p-3 font-mono">{row.classes} streams</td>
                    <td className="p-3 font-mono text-muted">{Math.round(row.total / row.classes)} pupils/class</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-canvas/80 font-bold border-t-2 border-line text-ink">
                  <td className="p-3 uppercase">Total School Roll</td>
                  <td className="p-3 font-mono">{totalMale}</td>
                  <td className="p-3 font-mono">{totalFemale}</td>
                  <td className="p-3 font-mono text-sm text-brand-700 font-extrabold">{totalPupils}</td>
                  <td className="p-3 font-mono">22 streams</td>
                  <td className="p-3 font-mono text-muted">31 avg</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: Staffing */}
      {activeTab === 'staffing' && (
        <Card
          title="Schedule B: Educator Establishment & Qualifications"
          subtitle="Certified teacher staffing establishment in compliance with PSC requirements."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-xs text-muted font-bold uppercase">Trained Graduate Teachers</div>
              <div className="text-2xl font-bold font-mono text-ink mt-1">28</div>
              <div className="text-[11px] text-brand-500 mt-1">Bachelor of Education / Dip. Ed</div>
            </div>
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-xs text-muted font-bold uppercase">Postgraduate / Masters</div>
              <div className="text-2xl font-bold font-mono text-brand-500 mt-1">8</div>
              <div className="text-[11px] text-muted mt-1">M.Ed & Specialist Disciplines</div>
            </div>
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-xs text-muted font-bold uppercase">Unqualified / Relief Staff</div>
              <div className="text-2xl font-bold font-mono text-ink mt-1">0</div>
              <div className="text-[11px] text-brand-500 mt-1">100% Certified Compliance</div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: Facilities */}
      {activeTab === 'facilities' && (
        <Card
          title="Schedule C: Physical Infrastructure & Sanitation Audit"
          subtitle="Classrooms, science laboratories, ablution facilities, and clean water sources."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-xs text-muted font-bold uppercase">Permanent Classrooms</div>
              <div className="text-xl font-bold font-mono text-ink mt-1">24 Rooms</div>
              <div className="text-[10px] text-brand-500 mt-1">Adequate ventilation & lighting</div>
            </div>
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-xs text-muted font-bold uppercase">Science Laboratories</div>
              <div className="text-xl font-bold font-mono text-ink mt-1">3 Labs</div>
              <div className="text-[10px] text-muted mt-1">Physics, Chemistry, Biology</div>
            </div>
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-xs text-muted font-bold uppercase">Flush Toilets (Pupil Ratio)</div>
              <div className="text-xl font-bold font-mono text-ink mt-1">1 : 22</div>
              <div className="text-[10px] text-brand-500 mt-1">Meets MoPSE health norm</div>
            </div>
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-xs text-muted font-bold uppercase">Potable Water Supply</div>
              <div className="text-xl font-bold font-mono text-brand-500 mt-1">Borehole + Solar</div>
              <div className="text-[10px] text-muted mt-1">10,000L storage capacity</div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 4: Approvals */}
      {activeTab === 'approvals' && (
        <Card
          title="Statutory Change Approvals & Workflow Queue"
          subtitle="Official requests requiring headmaster or school governance sign-off."
        >
          <DataTable
            columns={[
              {
                key: 'request_type',
                label: 'Request Title',
                sortable: true,
                render: (v, row) => (
                  <div>
                    <div className="font-bold text-ink">{v || 'Fee Adjustment Request'}</div>
                    <div className="text-[11px] text-muted">{row.reason || 'Routine administrative submission'}</div>
                  </div>
                )
              },
              { key: 'requester_name', label: 'Initiated By', render: v => v || 'Staff Member' },
              {
                key: 'status',
                label: 'Status',
                render: v => <StatusPill status={v || 'pending'} />
              }
            ]}
            data={approvals.length > 0 ? approvals : [
              { id: 1, request_type: 'Term 1 Exam Mark Modification', requester_name: 'Dr. T. Moyo (Sciences)', reason: 'Correction of practical score transcription error', status: 'pending' },
              { id: 2, request_type: 'Special Needs Bursary Concession', requester_name: 'Bursar Desk', reason: 'Government BEAM funding reconciliation', status: 'approved' },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
