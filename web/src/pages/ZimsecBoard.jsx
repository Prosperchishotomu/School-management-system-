import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { Award, FileSpreadsheet, Hash, Download, Upload, CheckCircle2, Clock, Plus, Users } from 'lucide-react';

export default function ZimsecBoard() {
  const { activeSchoolId } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ session_year: new Date().getFullYear(), exam_series: 'November', center_no: '', board_id: '' });
  const [boards, setBoards] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [sbaData, setSbaData] = useState(null);
  const [schoolType, setSchoolType] = useState('combined');

  useEffect(() => {
    if (!activeSchoolId) return;
    Promise.all([api.get(`/schools/${activeSchoolId}`), api.get('/exam-boards')])
      .then(([schoolRes, boardsRes]) => {
        setSchoolType(String(schoolRes.data?.school_type || 'combined').toLowerCase());
        const availableBoards = Array.isArray(boardsRes.data) ? boardsRes.data : [];
        setBoards(availableBoards);
        setFormData(current => ({ ...current, board_id: current.board_id || availableBoards[0]?.id || '' }));
      })
      .catch(() => {
        setSchoolType('combined');
        setBoards([]);
        toast.error('Unable to load examination reference data.');
      });
    fetchEntries();
  }, [activeSchoolId]);

  useEffect(() => {
    if (schoolType === 'primary' && formData.exam_series === 'June') {
      setFormData(current => ({ ...current, exam_series: 'November' }));
    }
  }, [schoolType, formData.exam_series]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/schools/${activeSchoolId}/exam-entries`);
      setEntries(res.data || []);
    } catch (err) {
      toast.error('Failed to load exam entry batches.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (e) => {
    e.preventDefault();
    if (!formData.board_id) {
      toast.error('Select an examination board before creating a batch.');
      return;
    }
    try {
      await api.post(`/schools/${activeSchoolId}/exam-entries`, formData);
      toast.success('ZIMSEC/Cambridge Exam Entry batch initialized.');
      setShowModal(false);
      fetchEntries();
    } catch (err) {
      toast.error(err?.message || 'Failed to create entry batch.');
    }
  };

  const handleAssignCandidateNumbers = async (entryId) => {
    try {
      const res = await api.post(`/exam-entries/${entryId}/assign-candidate-numbers`, { start_number: 1001 });
      toast.success(res.data?.message || 'Candidate numbers generated.');
      fetchEntries();
    } catch (err) {
      toast.error('Failed to assign candidate numbers.');
    }
  };

  const handleExportSba = async (entryId) => {
    try {
      const res = await api.get(`/exam-entries/${entryId}/sba-export`);
      setSbaData(res.data);
      toast.success('Generated School-Based Assessment (SBA/CA) export.');
    } catch (err) {
      toast.error('Failed to generate SBA export.');
    }
  };

  const handleSubmitBatch = async (entryId) => {
    try {
      const res = await api.post(`/exam-entries/${entryId}/submit`);
      toast.success(res.data?.message || 'Submitted for Maker-Checker dual approval.');
      fetchEntries();
    } catch (err) {
      toast.error('Submission failed.');
    }
  };

  return (
    <div className="module-page zimsec-page p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/50 via-sky-900/40 to-slate-900 p-6 rounded-3xl border border-sky-500/20 backdrop-blur-md shadow-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <Award className="w-8 h-8 text-sky-400" />
            ZIMSEC & Board Examination Portal
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Center Candidate Registration, SBA Mark Exports & Official Examination Result Imports
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-sky-900/40 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Candidate Entry Batch
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 backdrop-blur-xl shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-sky-400">Loading exam entry batches...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-4 px-4">Series & Year</th>
                  <th className="py-4 px-4">Center No</th>
                  <th className="py-4 px-4">Board</th>
                  <th className="py-4 px-4">Candidates</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-slate-800/40">
                    <td className="py-4 px-4 font-bold text-white">{e.exam_series} {e.session_year}</td>
                    <td className="py-4 px-4 font-mono text-sky-400">{e.center_no}</td>
                    <td className="py-4 px-4">{e.board_name || 'ZIMSEC'}</td>
                    <td className="py-4 px-4 font-semibold">{e.total_candidates || 0} Registered</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        e.status === 'submitted' || e.status === 'results_imported' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        e.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleAssignCandidateNumbers(e.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs rounded-lg border border-sky-500/30 flex items-center gap-1"
                        >
                          <Hash className="w-3 h-3" /> Auto Nos
                        </button>
                        <button
                          onClick={() => handleExportSba(e.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs rounded-lg border border-emerald-500/30 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> SBA Export
                        </button>
                        {e.status === 'draft' && (
                          <button
                            onClick={() => handleSubmitBatch(e.id)}
                            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg"
                          >
                            Submit Approval
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan="6" className="text-center py-10 text-slate-500">No examination entry batches created yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SBA Preview Overlay */}
      {sbaData && (
        <div className="p-6 bg-slate-900 border border-emerald-500/30 rounded-3xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-emerald-400">School-Based Assessment (SBA) Marks File</h3>
            <button onClick={() => setSbaData(null)} className="text-xs text-slate-400 hover:text-white">Close Preview</button>
          </div>
          <pre className="p-4 bg-slate-950 rounded-2xl text-xs font-mono text-emerald-300 overflow-x-auto max-h-60 border border-slate-800">
            {JSON.stringify(sbaData, null, 2)}
          </pre>
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold text-white">Create Exam Entry Batch</h2>
            <form onSubmit={handleCreateEntry} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Center Number</label>
                <input type="text" required value={formData.center_no} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setFormData({...formData, center_no: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Examination Board</label>
                <select required value={formData.board_id} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setFormData({...formData, board_id: e.target.value})}>
                  <option value="">Select board</option>
                  {boards.map(board => <option key={board.id} value={board.id}>{board.name}{board.code ? ` (${board.code})` : ''}</option>)}
                </select>
                {!boards.length && <p className="mt-1 text-xs text-amber-300">No active examination boards are configured.</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Session Year</label>
                <input type="number" required value={formData.session_year} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setFormData({...formData, session_year: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Exam Series</label>
                <select value={formData.exam_series} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setFormData({...formData, exam_series: e.target.value})}>
                  <option value="November">November (Main Sitting)</option>
                  {schoolType !== 'primary' && <option value="June">June (Mid-year Sitting)</option>}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-sky-600 text-white rounded-xl">Create Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
