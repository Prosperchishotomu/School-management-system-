import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2, Users, Bed, Plus, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Home
} from 'lucide-react';

const Hostels = () => {
  const { activeSchoolId } = useAuth();
  const [hostels, setHostels] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('blocks'); // 'blocks' | 'allocations'

  // New Hostel Block Form
  const [hostelForm, setHostelForm] = useState({
    name: '',
    type: 'student_male',
    capacity: 60,
    warden_name: ''
  });

  // Allocation Form
  const [allocForm, setAllocForm] = useState({
    hostel_id: '',
    occupant_type: 'student',
    occupant_id: '',
    room_number: '',
    bed_number: ''
  });

  const fetchData = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const [hostelsRes, allocsRes, studentsRes, staffRes] = await Promise.all([
        api.get('/hostels'),
        api.get('/hostels/allocations'),
        api.get(`/schools/${activeSchoolId}/students`),
        api.get(`/schools/${activeSchoolId}/staff`)
      ]);

      setHostels(hostelsRes.data || []);
      setAllocations(allocsRes.data || []);
      setStudents(studentsRes.data || []);
      setStaff(staffRes.data || []);

      if (hostelsRes.data?.length > 0) {
        setAllocForm(prev => ({ ...prev, hostel_id: hostelsRes.data[0].id }));
      }
      if (studentsRes.data?.length > 0) {
        setAllocForm(prev => ({ ...prev, occupant_id: studentsRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load hostels and accommodation records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSchoolId]);

  const handleCreateHostel = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/hostels', hostelForm);
      setMessage({ type: 'success', text: `Hostel block '${hostelForm.name}' created successfully.` });
      setHostelForm({ name: '', type: 'student_male', capacity: 60, warden_name: '' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create hostel.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/hostels/allocate', allocForm);
      setMessage({ type: 'success', text: 'Accommodation room/bed allocated successfully.' });
      setAllocForm(prev => ({ ...prev, room_number: '', bed_number: '' }));
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to allocate accommodation.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Hostels &amp; Staff Accommodation Desk</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Manage boarding houses, student dormitories, and teacher residential staff quarters.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-line-border/20">
        <button
          onClick={() => setActiveTab('blocks')}
          className={`flex items-center space-x-2 px-5 py-3 border-b-2 font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'blocks' ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/50 hover:text-ink'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Hostels &amp; Housing Blocks ({hostels.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`flex items-center space-x-2 px-5 py-3 border-b-2 font-sans font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'allocations' ? 'border-teal-primary text-teal-primary' : 'border-transparent text-ink/50 hover:text-ink'
          }`}
        >
          <Bed className="w-4 h-4" />
          <span>Room &amp; Bed Allocations ({allocations.length})</span>
        </button>
      </div>

      {/* Message alerts */}
      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 border ${
          message.type === 'success' ? 'bg-sage/20 text-teal-dark border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border-brick-critical/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-teal-primary" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-primary" />
        </div>
      ) : (
        <>
          {activeTab === 'blocks' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add Hostel Form */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 h-fit space-y-4">
                <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                  <Home className="w-4 h-4 text-teal-primary" />
                  <span>Register Hostel / Housing Block</span>
                </h3>

                <form onSubmit={handleCreateHostel} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Building / Block Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Falcon House (Boys Dorm)"
                      className="w-full glass-input rounded-xl text-xs"
                      value={hostelForm.name}
                      onChange={e => setHostelForm({ ...hostelForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Accommodation Type</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={hostelForm.type}
                      onChange={e => setHostelForm({ ...hostelForm, type: e.target.value })}
                    >
                      <option value="student_male">Student Boys Dormitory</option>
                      <option value="student_female">Student Girls Dormitory</option>
                      <option value="staff_housing">Teacher &amp; Staff Residential Quarters</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Capacity (Max Beds / Units)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      className="w-full glass-input rounded-xl text-xs"
                      value={hostelForm.capacity}
                      onChange={e => setHostelForm({ ...hostelForm, capacity: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Warden / House Master Contact</label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. C. Mutasa"
                      className="w-full glass-input rounded-xl text-xs"
                      value={hostelForm.warden_name}
                      onChange={e => setHostelForm({ ...hostelForm, warden_name: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Register Building Block</span>
                  </button>
                </form>
              </div>

              {/* Hostels List */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {hostels.map(h => (
                  <div key={h.id} className="glass-panel p-5 rounded-2xl border border-line-border/30 hover:shadow-lg transition-all space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-sans font-bold text-base text-ink">{h.name}</h4>
                        <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          h.type === 'staff_housing' ? 'bg-amber-500/10 text-amber-600' : 'bg-teal-primary/10 text-teal-primary'
                        } uppercase`}>
                          {h.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-teal-primary/10 flex items-center justify-center text-teal-primary font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs border-t border-line-border/20 pt-3">
                      <div>
                        <span className="text-[10px] text-ink/50 uppercase font-bold">Current Occupancy</span>
                        <p className="font-bold text-ink numeric-data mt-0.5">{h.current_occupants || 0} / {h.capacity} occupants</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink/50 uppercase font-bold">Warden / House Master</span>
                        <p className="font-semibold text-teal-dark mt-0.5">{h.warden_name || 'Unassigned'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'allocations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Allocation Form */}
              <div className="glass-panel p-6 rounded-2xl border border-line-border/30 h-fit space-y-4">
                <h3 className="font-sans font-bold text-sm text-ink flex items-center space-x-2">
                  <Bed className="w-4 h-4 text-teal-primary" />
                  <span>Allocate Room / Bed Space</span>
                </h3>

                <form onSubmit={handleAllocate} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Building Block</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={allocForm.hostel_id}
                      onChange={e => setAllocForm({ ...allocForm, hostel_id: e.target.value })}
                    >
                      {hostels.map(h => (
                        <option key={h.id} value={h.id}>{h.name} ({h.type})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Occupant Role</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={allocForm.occupant_type}
                      onChange={e => {
                        const type = e.target.value;
                        const firstId = type === 'student' ? (students[0]?.id || '') : (staff[0]?.id || '');
                        setAllocForm({ ...allocForm, occupant_type: type, occupant_id: firstId });
                      }}
                    >
                      <option value="student">Student (Boarder)</option>
                      <option value="staff">Teacher / Staff Resident</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Select Occupant</label>
                    <select
                      className="w-full glass-input rounded-xl text-xs bg-paper font-semibold"
                      value={allocForm.occupant_id}
                      onChange={e => setAllocForm({ ...allocForm, occupant_id: e.target.value })}
                    >
                      {allocForm.occupant_type === 'student'
                        ? students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number || s.id})</option>)
                        : staff.map(st => <option key={st.id} value={st.id}>{st.name} ({st.role_title || 'Staff'})</option>)
                      }
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Room No. *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Room 12B"
                        className="w-full glass-input rounded-xl text-xs"
                        value={allocForm.room_number}
                        onChange={e => setAllocForm({ ...allocForm, room_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-1">Bed No.</label>
                      <input
                        type="text"
                        placeholder="e.g. Bed 1"
                        className="w-full glass-input rounded-xl text-xs"
                        value={allocForm.bed_number}
                        onChange={e => setAllocForm({ ...allocForm, bed_number: e.target.value })}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-teal-primary hover:bg-teal-dark disabled:bg-teal-primary/40 text-paper rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Assign Accommodation</span>
                  </button>
                </form>
              </div>

              {/* Allocations Table */}
              <div className="lg:col-span-2 glass-panel rounded-2xl border border-line-border/30 overflow-hidden h-fit">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-sans text-ink">
                    <thead>
                      <tr className="bg-sage/10 border-b border-line-border/30 text-ink/60 font-bold uppercase tracking-wider">
                        <th className="py-3 px-5">Hostel / Quarters</th>
                        <th className="py-3 px-5">Occupant Name</th>
                        <th className="py-3 px-5">Role</th>
                        <th className="py-3 px-5">Room &amp; Bed Space</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-border/20">
                      {allocations.map(a => (
                        <tr key={a.id} className="hover:bg-sage/5 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-ink">{a.hostel_name}</td>
                          <td className="py-3.5 px-5 font-semibold text-teal-dark">{a.occupant_name || a.occupant_id}</td>
                          <td className="py-3.5 px-5">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              a.occupant_type === 'staff' ? 'bg-amber-500/10 text-amber-600' : 'bg-teal-primary/10 text-teal-primary'
                            }`}>
                              {a.occupant_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-mono font-bold text-ink">{a.room_number} {a.bed_number ? `(${a.bed_number})` : ''}</td>
                        </tr>
                      ))}
                      {allocations.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-ink/40">
                            No accommodation allocations registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Hostels;
