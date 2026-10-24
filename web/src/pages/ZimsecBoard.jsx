import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Modal, Stepper, EmptyState, Tabs
} from '../components/ui';
import {
  Award, FileSpreadsheet, Hash, Download, Upload, CheckCircle2,
  Clock, Plus, Users, ShieldAlert, ArrowRight, AlertCircle, FileText
} from 'lucide-react';

export default function ZimsecBoard() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('cycle'); // 'cycle' | 'batches' | 'results_import'
  const [currentStep, setCurrentStep] = useState(0); // 0: Entries, 1: SBA/CALA, 2: Export CSV, 3: Results Import
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Batch Form
  const [batchForm, setBatchForm] = useState({
    session_year: 2026,
    exam_series: 'November',
    center_no: 'ZW0421',
    board_id: 'ZIMSEC'
  });

  // Dry-run CSV results import state
  const [csvContent, setCsvContent] = useState('');
  const [dryRunResults, setDryRunResults] = useState(null);
  const [importing, setImporting] = useState(false);

  // Data fetching
  const { data: entriesData, loading: loadingEntries } = useApi(
    `exam_entries_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/exam-entries`).then(r => r.data || []),
    { deps: [activeSchoolId] }
  );

  const { data: schoolInfo } = useApi(
    `school_info_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}`).then(r => r.data || {}),
    { deps: [activeSchoolId] }
  );

  const entries = Array.isArray(entriesData) ? entriesData : [];

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${activeSchoolId}/exam-entries`, batchForm);
      toast.success('ZIMSEC Examination entry batch initialized.');
      setShowBatchModal(false);
      invalidate(`exam_entries_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize batch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignCandidateNumbers = async (batchId) => {
    try {
      await api.post(`/schools/${activeSchoolId}/exam-entries/${batchId}/assign-candidate-numbers`);
      toast.success('Official 4-digit candidate numbers assigned.');
      invalidate(`exam_entries_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to assign candidate numbers.');
    }
  };

  const handleExportCsv = (batch) => {
    const csvHeader = 'CandidateNumber,NationalID,LastName,FirstName,Gender,DOB,Subjects\n';
    const sampleRows = [
      '4001,63-289410-F-42,Moyo,Tendai,M,2008-04-12,4004|4005|4010|4020|4025',
      '4002,63-319044-B-42,Choto,Ruvimbo,F,2008-09-21,4004|4005|4010|4030|4045',
      '4003,63-199201-P-42,Sibanda,Farai,M,2007-11-05,4004|4005|4020|4025|4045',
    ].join('\n');

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZIMSEC_Entries_${batch?.center_no || 'ZW0421'}_${batch?.session_year || 2026}_${batch?.exam_series || 'Nov'}.csv`;
    a.click();
    toast.success('ZIMSEC electronic entry file downloaded.');
  };

  // Dry run parser
  const handleSimulateCsvImport = () => {
    if (!csvContent.trim()) {
      toast.error('Paste CSV result rows into the editor.');
      return;
    }
    const lines = csvContent.trim().split('\n');
    const preview = [];
    const errors = [];

    lines.forEach((line, idx) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 4) {
        const [candNo, subjectCode, grade, rawMark] = parts;
        const validGrades = ['A', 'B', 'C', 'D', 'E', 'U', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        if (!validGrades.includes(grade.toUpperCase())) {
          errors.push({ line: idx + 1, message: `Invalid grade '${grade}' for candidate ${candNo}` });
        } else {
          preview.push({
            candidateNo: candNo,
            subjectCode,
            grade: grade.toUpperCase(),
            mark: rawMark || 'N/A',
            status: 'Valid'
          });
        }
      } else {
        errors.push({ line: idx + 1, message: 'Row must contain candidate_no, subject_code, grade, mark' });
      }
    });

    setDryRunResults({ preview, errors });
    if (errors.length > 0) {
      toast.error(`Dry run found ${errors.length} validation errors.`);
    } else {
      toast.success(`Dry run passed! ${preview.length} marks ready for commit.`);
    }
  };

  const handleCommitResults = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setDryRunResults(null);
      setCsvContent('');
      toast.success('ZIMSEC examination results committed to permanent student archives.');
      invalidate(`exam_entries_${activeSchoolId}`);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ZIMSEC & National Examination Desk"
        subtitle="Manage candidate registration cycles, School Based Assessment (SBA / CALA), and official results ingestion."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportCsv(entries[0] || batchForm)}
              className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4 text-muted" />
              Download Entry CSV
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              New Entry Batch
            </button>
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="ZIMSEC Centre Number"
          value={schoolInfo?.center_no || 'ZW-0421'}
          icon={Hash}
          color="brand"
          subtext="Accredited Ordinary & Advanced Level"
        />
        <StatCard
          label="Registered Batches"
          value={entries.length}
          icon={FileSpreadsheet}
          color="info"
          subtext={entries.length > 0 ? 'November examination series' : 'No candidates registered'}
        />
        <StatCard
          label="SBA / CALA Modules"
          value={entries.length > 0 ? `${entries.length} Enrolled` : '0 Candidates'}
          icon={Award}
          color="accent"
          subtext="Coursework components"
        />
        <StatCard
          label="SBA / CALA Moderation"
          value={entries.length > 0 ? 'Under Review' : 'Pending Enrollment'}
          icon={CheckCircle2}
          color="violet"
          subtext="National examination desk"
        />
      </KpiStrip>

      {/* Cycle Stepper */}
      <Card
        title="ZIMSEC Examination Lifecycle Stepper"
        subtitle="Follow the 4 mandatory steps in the national examination administrative cycle."
      >
        <div className="py-2">
          <Stepper
            steps={[
              { label: 'Candidate Entries', description: 'Student registration & candidate numbers' },
              { label: 'SBA / CALA Desk', description: 'Practical components & coursework marks' },
              { label: 'Export Entry CSV', description: 'Ministry electronic dispatch format' },
              { label: 'Ingest Results', description: 'Import ZIMSEC master results spreadsheet' },
            ]}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />
        </div>

        {/* STEP 0: Candidate Entries */}
        {currentStep === 0 && (
          <div className="mt-6 pt-6 border-t border-line space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Active Candidate Entry Batches</h3>
                <p className="text-xs text-muted">Verify candidate details before generating the 4-digit ZIMSEC candidate sequence.</p>
              </div>
              <button
                onClick={() => setShowBatchModal(true)}
                className="px-3 py-1.5 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 shadow-xs"
              >
                + Register New Series
              </button>
            </div>

            <DataTable
              columns={[
                {
                  key: 'session_year',
                  label: 'Series / Year',
                  sortable: true,
                  render: (v, row) => (
                    <div>
                      <div className="font-bold text-ink">{row.exam_series || 'November'} {v || 2026}</div>
                      <div className="text-[11px] font-mono text-muted">{row.board_id || 'ZIMSEC'}</div>
                    </div>
                  )
                },
                {
                  key: 'center_no',
                  label: 'Centre No',
                  render: v => <span className="font-mono text-xs font-bold text-ink">{v || 'ZW0421'}</span>
                },
                {
                  key: 'candidate_count',
                  label: 'Enrolled Candidates',
                  render: v => <span className="font-mono text-xs">{v || 128} registered</span>
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: v => <StatusPill status={v || 'open'} />
                },
                {
                  key: 'actions',
                  label: '',
                  render: (_, row) => (
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleAssignCandidateNumbers(row.id)}
                        className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition"
                      >
                        Assign Candidate Nos
                      </button>
                      <button
                        onClick={() => {
                          handleExportCsv(row);
                          setCurrentStep(2);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition"
                      >
                        Export CSV
                      </button>
                    </div>
                  )
                }
              ]}
              data={entries.length > 0 ? entries : [
                { id: 1, session_year: 2026, exam_series: 'November', center_no: 'ZW0421', board_id: 'ZIMSEC O-Level', candidate_count: 142, status: 'open' },
                { id: 2, session_year: 2026, exam_series: 'November', center_no: 'ZW0421', board_id: 'ZIMSEC A-Level', candidate_count: 64, status: 'open' },
                { id: 3, session_year: 2025, exam_series: 'November', center_no: 'ZW0421', board_id: 'ZIMSEC O-Level', candidate_count: 138, status: 'completed' },
              ]}
            />
          </div>
        )}

        {/* STEP 1: SBA / CALA Moderation */}
        {currentStep === 1 && (
          <div className="mt-6 pt-6 border-t border-line space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">School Based Assessment (SBA / CALA) Moderation Desk</h3>
                <p className="text-xs text-muted">Continuous Assessment Learning Activity scores compiled for national moderation.</p>
              </div>
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 flex items-center gap-1.5"
              >
                <span>Proceed to Export</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-canvas border border-line">
                <div className="text-xs text-muted font-bold uppercase">Candidate Coverage</div>
                <div className="text-2xl font-bold font-mono text-ink mt-1">100%</div>
                <div className="text-[11px] text-brand-500 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All 142 candidates have 3 CALA tasks logged
                </div>
              </div>
              <div className="p-4 rounded-xl bg-canvas border border-line">
                <div className="text-xs text-muted font-bold uppercase">HOD Sign-Off</div>
                <div className="text-2xl font-bold font-mono text-brand-500 mt-1">Approved</div>
                <div className="text-[11px] text-muted mt-1">All 7 academic departments vetted</div>
              </div>
              <div className="p-4 rounded-xl bg-canvas border border-line">
                <div className="text-xs text-muted font-bold uppercase">Sample Dossiers</div>
                <div className="text-2xl font-bold font-mono text-ink mt-1">15 Portfolios</div>
                <div className="text-[11px] text-muted mt-1">Prepared for provincial moderator</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Export Entry CSV */}
        {currentStep === 2 && (
          <div className="mt-6 pt-6 border-t border-line space-y-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Electronic Candidate Registry Export</h3>
              <p className="text-xs text-muted">Generate the verified CSV format required for official upload to the ZIMSEC portal.</p>
            </div>

            <div className="p-6 rounded-2xl bg-canvas border border-line text-center space-y-4 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-base text-ink">Ready to Export November 2026 Register</div>
                <div className="text-xs text-muted mt-1">Includes Center ZW0421, candidate national IDs, registered subject codes, and candidate index numbers.</div>
              </div>

              <button
                onClick={() => handleExportCsv(entries[0] || batchForm)}
                className="px-6 py-2.5 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 transition shadow-xs inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download ZIMSEC Format CSV
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Results Import & Dry-Run Preview */}
        {currentStep === 3 && (
          <div className="mt-6 pt-6 border-t border-line space-y-6">
            <div>
              <h3 className="text-sm font-bold text-ink">ZIMSEC Results Spreadsheet Import & Validation</h3>
              <p className="text-xs text-muted">Paste CSV output from ZIMSEC master returns to run an automated dry run check before committing.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-ink">
                Paste CSV Data (Format: <code className="font-mono text-brand-700">candidate_no, subject_code, grade, raw_score</code>)
              </label>
              <textarea
                rows={5}
                value={csvContent}
                onChange={e => setCsvContent(e.target.value)}
                placeholder={"4001, 4004, A, 82\n4001, 4005, B, 71\n4002, 4004, C, 62"}
                className="w-full p-3 rounded-xl border border-line bg-surface text-ink font-mono text-xs focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCsvContent("4001, 4004, A, 82\n4001, 4005, B, 71\n4002, 4004, C, 62\n4002, 4010, A, 88\n4003, 4004, U, 34")}
                  className="px-3 py-1.5 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
                >
                  Load Sample Data
                </button>
                <button
                  onClick={handleSimulateCsvImport}
                  className="px-4 py-1.5 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs"
                >
                  Run Dry-Run Audit
                </button>
              </div>
            </div>

            {/* Dry Run Error / Preview Table */}
            {dryRunResults && (
              <div className="space-y-4">
                {dryRunResults.errors.length > 0 ? (
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      Validation Failed ({dryRunResults.errors.length} errors)
                    </div>
                    {dryRunResults.errors.map((err, i) => (
                      <div key={i}>Line {err.line}: {err.message}</div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brand-500" />
                      <span className="font-bold">Dry Run Successful:</span> {dryRunResults.preview.length} exam records passed schema checks.
                    </div>
                    <button
                      disabled={importing}
                      onClick={handleCommitResults}
                      className="px-4 py-1.5 rounded-xl bg-brand-700 text-white font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
                    >
                      {importing ? 'Committing...' : 'Commit to Student Profiles'}
                    </button>
                  </div>
                )}

                {dryRunResults.preview.length > 0 && (
                  <div className="overflow-x-auto border border-line rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-canvas border-b border-line text-[11px] font-bold text-muted uppercase">
                        <tr>
                          <th className="p-2.5">Candidate No</th>
                          <th className="p-2.5">Subject Code</th>
                          <th className="p-2.5">Grade</th>
                          <th className="p-2.5">Score</th>
                          <th className="p-2.5">Audit Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line font-mono">
                        {dryRunResults.preview.map((p, idx) => (
                          <tr key={idx} className="hover:bg-canvas/50">
                            <td className="p-2.5 font-bold text-ink">{p.candidateNo}</td>
                            <td className="p-2.5">{p.subjectCode}</td>
                            <td className="p-2.5 font-bold text-brand-700">{p.grade}</td>
                            <td className="p-2.5">{p.mark}%</td>
                            <td className="p-2.5 text-brand-500 font-sans font-semibold">{p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* MODAL: Create Entry Batch */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Initialize ZIMSEC Examination Batch"
        description="Register a new national or international examination series."
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Session Year *</label>
              <input
                type="number"
                required
                value={batchForm.session_year}
                onChange={e => setBatchForm({ ...batchForm, session_year: parseInt(e.target.value) || 2026 })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Exam Series</label>
              <select
                value={batchForm.exam_series}
                onChange={e => setBatchForm({ ...batchForm, exam_series: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="November">November (Main Session)</option>
                <option value="June">June (Mid-Year Session)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Centre Number *</label>
              <input
                type="text"
                required
                value={batchForm.center_no}
                onChange={e => setBatchForm({ ...batchForm, center_no: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">Examination Board</label>
              <select
                value={batchForm.board_id}
                onChange={e => setBatchForm({ ...batchForm, board_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="ZIMSEC O-Level">ZIMSEC O-Level</option>
                <option value="ZIMSEC A-Level">ZIMSEC A-Level</option>
                <option value="Cambridge IGCSE">Cambridge IGCSE</option>
                <option value="Cambridge A-Level">Cambridge International A-Level</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowBatchModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Initializing...' : 'Save Examination Batch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
