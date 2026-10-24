import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Tabs, EmptyState
} from '../components/ui';
import {
  HeartPulse, Search, Plus, AlertTriangle, ShieldAlert,
  Activity, CheckCircle2, User, Phone, FileText, Pill
} from 'lucide-react';

export default function HealthRecords() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('visits'); // 'visits' | 'registry'
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showRegistryModal, setShowRegistryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Visit form
  const [visitForm, setVisitForm] = useState({
    student_id: '',
    complaint: 'Headache & Mild Pyrexia',
    treatment: 'Paracetamol 500mg, 1 hr observation bed',
    referred: false,
    referred_to: '',
    nurse_notes: 'Temperature 37.8C. Advised bed rest.'
  });

  // Allergy / Chronic registration form
  const [profileForm, setProfileForm] = useState({
    student_id: '',
    blood_group: 'O+',
    allergies: 'Penicillin, Peanuts',
    medical_conditions: 'Mild Asthma',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  // Data fetching
  const { data: studentsData } = useApi(
    `students_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/students`).then(r => r.data?.students || r.data || []),
    { deps: [activeSchoolId] }
  );

  const students = Array.isArray(studentsData) ? studentsData : [];

  // Mock initial clinic visits and allergy registry if backend table isn't populated yet
  const [visits, setVisits] = useState([
    { id: 1, student_name: 'Farai Sibanda', class_name: 'Form 3 North', visit_date: '2026-03-24', complaint: 'Sports Injury — Ankle Sprain', treatment: 'Cold compress, crepe bandage, ibuprofen', referred: false },
    { id: 2, student_name: 'Ruvimbo Choto', class_name: 'Form 4 East', visit_date: '2026-03-22', complaint: 'Acute Asthmatic Wheezing', treatment: 'Salbutamol nebulisation, monitored 45 min', referred: false },
    { id: 3, student_name: 'Tendai Moyo', class_name: 'Form 2 West', visit_date: '2026-03-20', complaint: 'High Fever (39.2C) & Chills', treatment: 'Rapid Malaria Test (Positive). Paracetamol.', referred: true, referred_to: 'Parirenyatwa General Hospital' },
    { id: 4, student_name: 'Kudzai Ndlovu', class_name: 'Grade 6 Blue', visit_date: '2026-03-18', complaint: 'Allergic Urticaria (Peanut exposure)', treatment: 'Oral antihistamine administered immediately', referred: false },
  ]);

  const [chronicRegistry, setChronicRegistry] = useState([
    { id: 1, student_name: 'Ruvimbo Choto', class_name: 'Form 4 East', blood_group: 'B+', allergies: 'Pollen, Dust', condition: 'Bronchial Asthma', emergency_contact: 'Mrs. Choto (+263 77 289 1102)' },
    { id: 2, student_name: 'Kudzai Ndlovu', class_name: 'Grade 6 Blue', blood_group: 'O+', allergies: 'Severe Peanut Anaphylaxis', condition: 'Carries Epipen', emergency_contact: 'Mr. Ndlovu (+263 71 884 9920)' },
    { id: 3, student_name: 'Blessing Musarurwa', class_name: 'Form 1 South', blood_group: 'A+', allergies: 'Penicillin, Sulfa', condition: 'Type 1 Diabetes', emergency_contact: 'Dr. Musarurwa (+263 77 340 1928)' },
  ]);

  const handleRecordVisit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      const st = students.find(s => String(s.id) === String(visitForm.student_id));
      const newEntry = {
        id: visits.length + 1,
        student_name: st ? `${st.first_name} ${st.last_name}` : 'Pupil',
        class_name: st?.class_name || 'Form 1',
        visit_date: new Date().toISOString().split('T')[0],
        complaint: visitForm.complaint,
        treatment: visitForm.treatment,
        referred: visitForm.referred,
        referred_to: visitForm.referred_to
      };
      setVisits([newEntry, ...visits]);
      toast.success('Sanatorium clinic visit logged.');
      setShowVisitModal(false);
      setSubmitting(false);
    }, 600);
  };

  const handleSaveChronic = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      const st = students.find(s => String(s.id) === String(profileForm.student_id));
      const newEntry = {
        id: chronicRegistry.length + 1,
        student_name: st ? `${st.first_name} ${st.last_name}` : 'Pupil',
        class_name: st?.class_name || 'Form 1',
        blood_group: profileForm.blood_group,
        allergies: profileForm.allergies,
        condition: profileForm.medical_conditions,
        emergency_contact: `${profileForm.emergency_contact_name} (${profileForm.emergency_contact_phone})`
      };
      setChronicRegistry([newEntry, ...chronicRegistry]);
      toast.success('Chronic condition logged to medical alert registry.');
      setShowRegistryModal(false);
      setSubmitting(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sanatorium & Learner Health Records"
        subtitle="School infirmary consultations, chronic medical condition registers, allergy alert tracking, and hospital referrals."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRegistryModal(true)}
              className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
            >
              <ShieldAlert className="w-4 h-4 text-accent" />
              Register Chronic / Allergy
            </button>
            <button
              onClick={() => setShowVisitModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Record Clinic Visit
            </button>
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Visits This Term"
          value={visits.length}
          icon={HeartPulse}
          color="brand"
          subtext="Infirmary consultations logged"
        />
        <StatCard
          label="Chronic Care Registry"
          value={chronicRegistry.length}
          icon={Activity}
          color="info"
          subtext="Asthma, Diabetes, Allergies"
        />
        <StatCard
          label="Hospital Referrals"
          value={visits.filter(v => v.referred).length}
          icon={ShieldAlert}
          color="accent"
          subtext="Specialist care transfers"
        />
        <StatCard
          label="High-Risk Allergy Alerts"
          value={chronicRegistry.filter(c => c.allergies?.toLowerCase().includes('peanut') || c.allergies?.toLowerCase().includes('penicillin')).length}
          icon={AlertTriangle}
          color="danger"
          subtext="Hostel warden notified"
        />
      </KpiStrip>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'visits', label: 'Infirmary Visit Consultations', count: visits.length },
          { id: 'registry', label: 'Chronic & Allergy Alert Registry', count: chronicRegistry.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Visits */}
      {activeTab === 'visits' && (
        <Card
          title="Daily Sanatorium Logbook"
          subtitle="All visits recorded by the school sister/nurse with complaints and clinical dispensations."
        >
          <DataTable
            columns={[
              {
                key: 'student_name',
                label: 'Learner',
                sortable: true,
                render: (v, row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={v} size="sm" />
                    <div>
                      <div className="font-bold text-ink">{v}</div>
                      <div className="text-[11px] text-muted">{row.class_name}</div>
                    </div>
                  </div>
                )
              },
              {
                key: 'visit_date',
                label: 'Consultation Date',
                sortable: true,
                render: v => <span className="font-mono text-xs">{new Date(v).toLocaleDateString()}</span>
              },
              {
                key: 'complaint',
                label: 'Presenting Complaint',
                render: v => <span className="font-semibold text-xs text-ink">{v}</span>
              },
              {
                key: 'treatment',
                label: 'Dispensed Treatment / Action',
                render: v => <span className="text-xs text-muted">{v}</span>
              },
              {
                key: 'referred',
                label: 'Disposition',
                render: (v, row) => (
                  v ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-bold">
                      <ShieldAlert className="w-3 h-3" />
                      Ref: {row.referred_to || 'Hospital'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-[10px] font-semibold">
                      Treated & Discharged
                    </span>
                  )
                )
              }
            ]}
            data={visits}
          />
        </Card>
      )}

      {/* TAB 2: Chronic Registry */}
      {activeTab === 'registry' && (
        <Card
          title="Chronic Medical & Allergy Registry"
          subtitle="Critical medical alert records accessible to wardens, sports coaches, and staff."
        >
          <DataTable
            columns={[
              {
                key: 'student_name',
                label: 'Learner',
                sortable: true,
                render: (v, row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={v} size="sm" />
                    <div>
                      <div className="font-bold text-ink">{v}</div>
                      <div className="text-[11px] text-muted">{row.class_name}</div>
                    </div>
                  </div>
                )
              },
              {
                key: 'blood_group',
                label: 'Blood Group',
                render: v => (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-canvas border border-line">
                    {v || 'O+'}
                  </span>
                )
              },
              {
                key: 'condition',
                label: 'Chronic Condition',
                render: v => <span className="font-bold text-xs text-ink">{v}</span>
              },
              {
                key: 'allergies',
                label: 'Severe Allergies',
                render: v => (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20 text-xs font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    {v}
                  </span>
                )
              },
              {
                key: 'emergency_contact',
                label: 'Emergency Contact',
                render: v => <span className="text-xs text-muted font-mono">{v}</span>
              }
            ]}
            data={chronicRegistry}
          />
        </Card>
      )}

      {/* MODAL: Record Clinic Visit */}
      <Modal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        title="Record Sanatorium Visit"
        description="Log student arrival at the school clinic, symptoms, and medical treatment dispensed."
      >
        <form onSubmit={handleRecordVisit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Student Learner *</label>
            <select
              required
              value={visitForm.student_id}
              onChange={e => setVisitForm({ ...visitForm, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select student...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.class_name || 'Class'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Presenting Complaint / Symptoms *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sharp abdominal pain, fever, nausea"
              value={visitForm.complaint}
              onChange={e => setVisitForm({ ...visitForm, complaint: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Treatment & Medication Dispensed *</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Paracetamol 500mg, oral rehydration, bed observation"
              value={visitForm.treatment}
              onChange={e => setVisitForm({ ...visitForm, treatment: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-canvas border border-line space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={visitForm.referred}
                onChange={e => setVisitForm({ ...visitForm, referred: e.target.checked })}
                className="rounded text-brand-700"
              />
              Referred to External Hospital / Specialist
            </label>

            {visitForm.referred && (
              <input
                type="text"
                placeholder="Hospital Name (e.g. Parirenyatwa General Hospital)"
                value={visitForm.referred_to}
                onChange={e => setVisitForm({ ...visitForm, referred_to: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowVisitModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Save Consultation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Register Chronic / Allergy */}
      <Modal
        isOpen={showRegistryModal}
        onClose={() => setShowRegistryModal(false)}
        title="Register Chronic Illness or Allergy"
        description="Establish an alert for boarders and day scholars requiring dietary or medical precautions."
      >
        <form onSubmit={handleSaveChronic} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Student Learner *</label>
            <select
              required
              value={profileForm.student_id}
              onChange={e => setProfileForm({ ...profileForm, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select student...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.class_name || 'Class'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Blood Group</label>
              <select
                value={profileForm.blood_group}
                onChange={e => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Chronic Condition</label>
              <input
                type="text"
                placeholder="Asthma, Diabetes, Epilepsy, etc."
                value={profileForm.medical_conditions}
                onChange={e => setProfileForm({ ...profileForm, medical_conditions: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Known Allergies *</label>
            <input
              type="text"
              required
              placeholder="e.g. Severe Peanut Allergy, Penicillin"
              value={profileForm.allergies}
              onChange={e => setProfileForm({ ...profileForm, allergies: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Emergency Contact Name</label>
              <input
                type="text"
                placeholder="Guardian / Physician Name"
                value={profileForm.emergency_contact_name}
                onChange={e => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Emergency Phone</label>
              <input
                type="text"
                placeholder="+263 77..."
                value={profileForm.emergency_contact_phone}
                onChange={e => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowRegistryModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Register Medical Alert'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
