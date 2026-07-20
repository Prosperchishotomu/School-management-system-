import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { HeartPulse, Search, Save, Loader2, X, Plus } from 'lucide-react';

const HealthRecords = () => {
  const { activeSchoolId, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [healthRecord, setHealthRecord] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    blood_group: '',
    allergies: '',
    medical_conditions: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    confidential_notes: ''
  });

  const searchStudents = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingList(true);
    api.get(`/schools/${activeSchoolId}/students?search=${encodeURIComponent(searchQuery)}`)
      .then(res => {
        setStudents(res.data || []);
        setMessage({ type: '', text: '' });
      })
      .catch(err => {
        console.error(err);
        setMessage({ type: 'error', text: 'Error searching students.' });
      })
      .finally(() => setLoadingList(false));
  };

  const selectStudent = (student) => {
    setSelectedStudent(student);
    setLoadingRecord(true);
    setMessage({ type: '', text: '' });
    api.get(`/schools/${activeSchoolId}/students/${student.id}/health`)
      .then(res => {
        if (res.data) {
          setHealthRecord(res.data);
          setForm({
            blood_group: res.data.blood_group || '',
            allergies: res.data.allergies || '',
            medical_conditions: res.data.medical_conditions || '',
            emergency_contact_name: res.data.emergency_contact_name || '',
            emergency_contact_phone: res.data.emergency_contact_phone || '',
            confidential_notes: res.data.confidential_notes || ''
          });
        } else {
          setHealthRecord(null);
          setForm({
            blood_group: '',
            allergies: '',
            medical_conditions: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
            confidential_notes: ''
          });
        }
      })
      .catch(err => {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to load health records. Note: Health access might be restricted.' });
        setSelectedStudent(null);
      })
      .finally(() => setLoadingRecord(false));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    setMessage({ type: '', text: '' });

    api.put(`/schools/${activeSchoolId}/students/${selectedStudent.id}/health`, form)
      .then(res => {
        setMessage({ type: 'success', text: 'Health record saved successfully.' });
        setHealthRecord({ ...form });
      })
      .catch(err => {
        console.error(err);
        setMessage({ type: 'error', text: err.message || 'Failed to save health record.' });
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-line-border/30 pb-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink">Health Records</h2>
          <p className="text-sm font-sans text-ink/60 mt-1">Manage student immunization, allergies, and confidential medical conditions.</p>
        </div>
        <div className="flex items-center space-x-2 bg-brick-critical/10 px-3 py-1.5 rounded-lg border border-brick-critical/20">
          <HeartPulse className="w-4 h-4 text-brick-critical" />
          <span className="text-xs font-sans font-bold text-brick-critical">Restricted Access</span>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-sans flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-sage/30 text-teal-dark border border-teal-primary/20' : 'bg-brick-critical/10 text-brick-critical border border-brick-critical/20'
        }`}>
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-display font-bold text-ink mb-4">Search Student</h3>
            <form onSubmit={searchStudents} className="relative">
              <input
                type="text"
                placeholder="Enter student name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded-xl glass-input text-ink font-sans text-sm"
              />
              <button type="submit" className="absolute right-3 top-2.5">
                <Search className="w-4 h-4 text-ink/40" />
              </button>
            </form>

            <div className="mt-6 space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {loadingList ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-primary" />
                </div>
              ) : students.length > 0 ? (
                students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-150 flex items-center justify-between border ${
                      selectedStudent?.id === s.id
                        ? 'bg-teal-primary/10 border-teal-primary text-teal-dark'
                        : 'border-line-border/30 hover:bg-sage/10 text-ink'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold font-sans">{s.first_name} {s.last_name}</p>
                      <p className="text-[10px] text-ink/50 mt-0.5">Class: {s.class_name || 'Unassigned'}</p>
                    </div>
                    <HeartPulse className="w-3.5 h-3.5 opacity-45" />
                  </button>
                ))
              ) : searchQuery && (
                <p className="text-center text-xs text-ink/40 py-6">No students found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Record Editor Panel */}
        <div className="lg:col-span-2">
          {selectedStudent ? (
            <div className="glass-card rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-line-border/30 pb-4">
                <div>
                  <h3 className="text-xl font-display font-bold text-ink">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h3>
                  <p className="text-xs text-ink/50 mt-1 font-mono">Admission No: {selectedStudent.admission_number || `#${selectedStudent.id}`}</p>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-ink/40 hover:text-ink transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingRecord ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-primary" />
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-6 text-sm font-sans">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1.5">Blood Group</label>
                      <select
                        value={form.blood_group}
                        onChange={e => setForm({ ...form, blood_group: e.target.value })}
                        disabled={user?.role !== 'school_admin'}
                        className="w-full px-3.5 py-2.5 bg-paper border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      >
                        <option value="">Unknown</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1.5">Allergies</label>
                      <input
                        type="text"
                        placeholder="e.g. Penicillin, Peanuts"
                        value={form.allergies}
                        onChange={e => setForm({ ...form, allergies: e.target.value })}
                        disabled={user?.role !== 'school_admin'}
                        className="w-full px-3.5 py-2.5 bg-paper border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1.5">Emergency Contact Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Tendai Musoni (Father)"
                        value={form.emergency_contact_name}
                        onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })}
                        disabled={user?.role !== 'school_admin'}
                        className="w-full px-3.5 py-2.5 bg-paper border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink/75 mb-1.5">Emergency Contact Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. +263 77..."
                        value={form.emergency_contact_phone}
                        onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })}
                        disabled={user?.role !== 'school_admin'}
                        className="w-full px-3.5 py-2.5 bg-paper border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary font-mono numeric-data"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink/75 mb-1.5">Medical Conditions</label>
                    <textarea
                      rows="3"
                      placeholder="e.g. Asthma, Epilepsy..."
                      value={form.medical_conditions}
                      onChange={e => setForm({ ...form, medical_conditions: e.target.value })}
                      disabled={user?.role !== 'school_admin'}
                      className="w-full px-3.5 py-2.5 bg-paper border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink/75 mb-1.5">Confidential Medical Notes</label>
                    <textarea
                      rows="4"
                      placeholder="Only school admins and nurses can access these notes."
                      value={form.confidential_notes}
                      onChange={e => setForm({ ...form, confidential_notes: e.target.value })}
                      disabled={user?.role !== 'school_admin'}
                      className="w-full px-3.5 py-2.5 bg-paper border border-line-border rounded-xl text-xs focus:outline-none focus:border-teal-primary resize-none text-brick-critical font-medium"
                    />
                  </div>

                  {user?.role === 'school_admin' && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-teal-primary hover:bg-teal-dark text-paper font-sans font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>Save Health Record</span>
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center text-ink/40 text-sm flex flex-col items-center justify-center h-full min-h-[300px]">
              <HeartPulse className="w-12 h-12 text-ink/20 mb-3" />
              <p>Select a student from the search panel to view or update health records.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthRecords;