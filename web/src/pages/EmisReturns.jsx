import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { FileBarChart2, ShieldCheck, CheckCircle2, XCircle, FileSpreadsheet, Send, RefreshCw, UserCheck } from 'lucide-react';

export default function EmisReturns() {
  const { activeSchoolId } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('approvals');
  const [approvals, setApprovals] = useState([]);
  const [emisReport, setEmisReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeSchoolId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'approvals') {
        const res = await api.get(`/schools/${activeSchoolId}/approvals`);
        setApprovals(res.data || []);
      } else if (activeTab === 'enrolment') {
        const res = await api.get(`/schools/${activeSchoolId}/reports/emis/enrolment`);
        setEmisReport(res.data);
      }
    } catch (err) {
      addToast('Failed to load EMIS returns data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await api.post(`/approvals/${id}/approve`);
      addToast(res.data?.message || 'Approved successfully.', 'success');
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error?.message || 'Approval failed.', 'error');
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await api.post(`/approvals/${id}/reject`, { reason: 'Admin rejected request' });
      addToast(res.data?.message || 'Request rejected.', 'success');
      fetchData();
    } catch (err) {
      addToast('Rejection failed.', 'error');
    }
  };

  return (
    <div className="module-page emis-page p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-rose-900/50 via-pink-900/40 to-slate-900 p-6 rounded-3xl border border-rose-500/20 backdrop-blur-md shadow-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <FileBarChart2 className="w-8 h-8 text-rose-400" />
            EMIS Statutory Returns & Dual-Approvals
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            MoPSE Official Statutory Returns, Admission Register & Maker-Checker Action Queue
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 ${
            activeTab === 'approvals' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-slate-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Maker-Checker Approvals Queue
        </button>
        <button
          onClick={() => setActiveTab('enrolment')}
          className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 ${
            activeTab === 'enrolment' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-slate-400'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> MoPSE Enrolment Return
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 backdrop-blur-xl shadow-xl">
        {activeTab === 'approvals' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-4 px-4">Action Type</th>
                  <th className="py-4 px-4">Requested By</th>
                  <th className="py-4 px-4">Details</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Checker Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
                {approvals.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="py-4 px-4 font-bold text-rose-300">{a.action_type}</td>
                    <td className="py-4 px-4 font-semibold text-white">{a.requester_name}</td>
                    <td className="py-4 px-4 max-w-xs text-xs font-mono text-slate-300 truncate">
                      {a.payload}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold border border-amber-500/30">
                        {a.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(a.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(a.id)}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-lg flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {approvals.length === 0 && (
                  <tr><td colSpan="5" className="text-center py-10 text-slate-500">No pending dual-approval requests in queue.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            {emisReport ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 text-center">
                    <span className="text-xs text-slate-400">Total Male Students</span>
                    <h3 className="text-2xl font-bold text-blue-400">{emisReport.summary?.total_male || 0}</h3>
                  </div>
                  <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 text-center">
                    <span className="text-xs text-slate-400">Total Female Students</span>
                    <h3 className="text-2xl font-bold text-pink-400">{emisReport.summary?.total_female || 0}</h3>
                  </div>
                  <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700 text-center">
                    <span className="text-xs text-slate-400">Grand Enrolment Total</span>
                    <h3 className="text-2xl font-bold text-emerald-400">{emisReport.summary?.grand_total || 0}</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Male</th>
                        <th className="py-3 px-4">Female</th>
                        <th className="py-3 px-4">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {emisReport.by_class?.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-bold text-white">{c.class_name}</td>
                          <td className="py-3 px-4 text-blue-300 font-mono">{c.male_count}</td>
                          <td className="py-3 px-4 text-pink-300 font-mono">{c.female_count}</td>
                          <td className="py-3 px-4 font-bold text-emerald-400 font-mono">{c.total_enrolled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500">Loading MoPSE enrolment return summary...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
