import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { Home, Award, LogOut, LogIn, CheckCircle, Clock, Plus, Shield, Trophy } from 'lucide-react';

export default function BoardingExeat() {
  const { activeSchoolId, user } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('exeats');
  const [exeats, setExeats] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showExeatModal, setShowExeatModal] = useState(false);
  const [exeatForm, setExeatForm] = useState({ exeat_type: 'weekend', departure_date: '', expected_return_date: '' });

  useEffect(() => {
    fetchData();
  }, [activeSchoolId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'exeats') {
        const res = await api.get(`/schools/${activeSchoolId}/exeats`);
        setExeats(res.data || []);
      } else {
        const res = await api.get(`/schools/${activeSchoolId}/houses`);
        setHouses(res.data || []);
      }
    } catch (err) {
      addToast('Failed to load boarding data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExeat = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/schools/${activeSchoolId}/exeats`, exeatForm);
      addToast('Exeat pass requested successfully.', 'success');
      setShowExeatModal(false);
      fetchData();
    } catch (err) {
      addToast('Failed to request exeat pass.', 'error');
    }
  };

  const handleApproveExeat = async (id, status) => {
    try {
      await api.post(`/exeats/${id}/approve`, { status, comments: 'Approved by Warden' });
      addToast(`Exeat pass ${status}.`, 'success');
      fetchData();
    } catch (err) {
      addToast('Exeat approval error.', 'error');
    }
  };

  const handleCheckOut = async (id) => {
    try {
      await api.post(`/exeats/${id}/check-out`);
      addToast('Student checked out at gate.', 'success');
      fetchData();
    } catch (err) {
      addToast('Gate check-out failed.', 'error');
    }
  };

  const handleCheckIn = async (id) => {
    try {
      await api.post(`/exeats/${id}/check-in`);
      addToast('Student checked in back to hostel.', 'success');
      fetchData();
    } catch (err) {
      addToast('Gate check-in failed.', 'error');
    }
  };

  return (
    <div className="module-page boarding-page p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-900/50 via-orange-900/40 to-slate-900 p-6 rounded-3xl border border-amber-500/20 backdrop-blur-md shadow-2xl">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <Home className="w-8 h-8 text-amber-400" />
            Boarding Houses & Gate Exeat Control
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Hostel Allocations, Exeat Pass Approvals, Warden Gate Check-Out/In & House Points Leaderboard
          </p>
        </div>
        <button
          onClick={() => setShowExeatModal(true)}
          className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-medium rounded-xl shadow-lg shadow-amber-900/40 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Request Exeat Pass
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('exeats')}
          className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 ${
            activeTab === 'exeats' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400'
          }`}
        >
          <LogOut className="w-4 h-4" /> Exeat Gate Control
        </button>
        <button
          onClick={() => setActiveTab('houses')}
          className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 ${
            activeTab === 'houses' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400'
          }`}
        >
          <Trophy className="w-4 h-4" /> Houses & Points Leaderboard
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 backdrop-blur-xl shadow-xl">
        {activeTab === 'exeats' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-4 px-4">Student</th>
                  <th className="py-4 px-4">Type & Destination</th>
                  <th className="py-4 px-4">Departure & Return</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Gate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
                {exeats.map(ex => (
                  <tr key={ex.id} className="hover:bg-slate-800/40">
                    <td className="py-4 px-4">
                      <div className="font-bold text-white">{ex.first_name} {ex.last_name}</div>
                      <div className="text-xs text-amber-400 font-mono">{ex.admission_no} ({ex.class_name})</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-100 uppercase text-xs">{ex.exeat_type}</div>
                      <div className="text-xs text-slate-400">{ex.destination || 'Home'}</div>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono">
                      <div>Dep: {ex.departure_date?.slice(0, 10)}</div>
                      <div className="text-slate-400">Ret: {ex.expected_return_date?.slice(0, 10)}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        ex.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        ex.status === 'checked_out' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                        ex.status === 'returned' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {ex.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        {ex.status === 'pending' && ['boarding_master', 'head', 'school_admin'].includes(user?.role) && (
                          <button onClick={() => handleApproveExeat(ex.id, 'approved')} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs">
                            Approve
                          </button>
                        )}
                        {ex.status === 'approved' && (
                          <button onClick={() => handleCheckOut(ex.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center gap-1">
                            <LogOut className="w-3 h-3" /> Gate Out
                          </button>
                        )}
                        {ex.status === 'checked_out' && (
                          <button onClick={() => handleCheckIn(ex.id)} className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs flex items-center gap-1">
                            <LogIn className="w-3 h-3" /> Gate Return
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {exeats.length === 0 && (
                  <tr><td colSpan="5" className="text-center py-10 text-slate-500">No exeat pass requests recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {houses.map(h => (
              <div key={h.id} className="p-6 bg-slate-800/50 rounded-3xl border border-amber-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">{h.name} House</h3>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: h.color || '#F59E0B' }} />
                </div>
                <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Points</span>
                  <span className="text-2xl font-black text-amber-400">{h.total_points || 0} pts</span>
                </div>
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>Enrolled Boarders:</span>
                  <span className="font-bold text-white">{h.total_students || 0} students</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showExeatModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold text-white">Request Exeat Pass</h2>
            <form onSubmit={handleCreateExeat} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Student ID / Admission No</label>
                <input type="text" required placeholder="ST1001" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setExeatForm({...exeatForm, student_id: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Destination</label>
                <input type="text" placeholder="Harare / Bulawayo Home" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setExeatForm({...exeatForm, destination: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Departure Date</label>
                <input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setExeatForm({...exeatForm, departure_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Expected Return Date</label>
                <input type="date" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" onChange={e => setExeatForm({...exeatForm, expected_return_date: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowExeatModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-amber-600 text-white rounded-xl">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
