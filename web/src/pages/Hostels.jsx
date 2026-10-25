import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Tabs, ProgressRing, EmptyState
} from '../components/ui';
import {
  Building2, Users, Bed, Plus, CheckCircle2, AlertTriangle,
  ShieldCheck, Home, Phone, Mail, UserCheck, Check, X
} from 'lucide-react';

export default function Hostels() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('blocks'); // 'blocks' | 'grid' | 'allocations' | 'applications'
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [blockForm, setBlockForm] = useState({
    name: '',
    type: 'student_male',
    capacity: 60,
    max_occupants_per_room: 4,
    warden_name: '',
    warden_phone: ''
  });

  const [allocForm, setAllocForm] = useState({
    hostel_id: '',
    student_id: '',
    room_number: 'Room 101',
    bed_number: 'Bed 1'
  });

  const { data: hostelsData, loading: loadingHostels } = useApi(
    `hostels_${activeSchoolId}`,
    () => api.get('/hostels').then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const { data: allocationsData } = useApi(
    `hostels_alloc_${activeSchoolId}`,
    () => api.get('/hostels/allocations').then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const { data: applicationsData } = useApi(
    `hostels_apps_${activeSchoolId}`,
    () => api.get('/hostels/applications').then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const { data: studentsData } = useApi(
    `students_${activeSchoolId}`,
    () => api.get(`/schools/${activeSchoolId}/students`).then(r => r.data?.students || r.data || []),
    { deps: [activeSchoolId] }
  );

  const rawHostels = Array.isArray(hostelsData) ? hostelsData : [];
  const rawAllocations = Array.isArray(allocationsData) ? allocationsData : [];
  const rawApplications = Array.isArray(applicationsData) ? applicationsData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];

  // Fallback realistic demo hostels
  const sampleHostels = [
    { id: 1, name: 'Chitepo Hall (Senior Boys)', type: 'student_male', capacity: 120, current_occupancy: 114, rooms_count: 30, max_occupants_per_room: 4, warden_name: 'Mr. P. Sibanda', warden_phone: '+263 77 289 1102' },
    { id: 2, name: 'Nehanda House (Senior Girls)', type: 'student_female', capacity: 120, current_occupancy: 118, rooms_count: 30, max_occupants_per_room: 4, warden_name: 'Mrs. R. Choto', warden_phone: '+263 71 440 2911' },
    { id: 3, name: 'Tongogara Block (Junior Boys)', type: 'student_male', capacity: 80, current_occupancy: 72, rooms_count: 20, max_occupants_per_room: 4, warden_name: 'Mr. K. Musarurwa', warden_phone: '+263 77 910 4421' },
  ];

  const hostels = rawHostels.length > 0 ? rawHostels : sampleHostels;
  const allocations = rawAllocations.length > 0 ? rawAllocations : [
    { id: 1, occupant_name: 'Farai Sibanda', student_admission: 'ADM-4011', hostel_name: 'Chitepo Hall', room_number: 'Room 104', bed_number: 'Bed 2', status: 'allocated' },
    { id: 2, occupant_name: 'Tendai Moyo', student_admission: 'ADM-4012', hostel_name: 'Chitepo Hall', room_number: 'Room 104', bed_number: 'Bed 1', status: 'allocated' },
    { id: 3, occupant_name: 'Ruvimbo Choto', student_admission: 'ADM-4020', hostel_name: 'Nehanda House', room_number: 'Room 201', bed_number: 'Bed 3', status: 'allocated' },
  ];

  const applications = rawApplications.length > 0 ? rawApplications : [
    { id: 1, student_name: 'Kudzai Ndlovu', class_name: 'Form 1 South', preferred_hostel: 'Chitepo Hall', dietary_notes: 'None', emergency_contact: '+263 77 340 1928', status: 'pending' },
    { id: 2, student_name: 'Tariro Nyathi', class_name: 'Form 1 East', preferred_hostel: 'Nehanda House', dietary_notes: 'Vegetarian', emergency_contact: '+263 71 884 9920', status: 'pending' },
  ];

  const activeHostel = useMemo(() => {
    if (!selectedHostelId && hostels.length > 0) return hostels[0];
    return hostels.find(h => String(h.id) === String(selectedHostelId)) || hostels[0];
  }, [hostels, selectedHostelId]);

  // Overall KPIs
  const totalBeds = hostels.reduce((acc, h) => acc + (h.capacity || 0), 0);
  const totalOccupied = hostels.reduce((acc, h) => acc + (h.current_occupancy || 0), 0);
  const totalVacant = Math.max(0, totalBeds - totalOccupied);
  const avgOccupancyRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/hostels', blockForm);
      toast.success(`Hostel block '${blockForm.name}' established.`);
      setShowBlockModal(false);
      setBlockForm({ name: '', type: 'student_male', capacity: 60, max_occupants_per_room: 4, warden_name: '', warden_phone: '' });
      invalidate(`hostels_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create hostel.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocateBed = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/hostels/allocations', allocForm);
      toast.success('Bed space allocated to pupil.');
      setShowAllocModal(false);
      invalidate(`hostels_alloc_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to allocate bed space.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppReview = async (appId, status) => {
    try {
      await api.patch(`/hostels/applications/${appId}`, { status });
      toast.success(status === 'approved' ? 'Boarding application accepted.' : 'Application declined.');
      invalidate(`hostels_apps_${activeSchoolId}`);
    } catch (err) {
      toast.error('Failed to update application.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hostels & Boarding Infrastructure"
        subtitle="Hostel dormitories, room and bed capacity grids, student residence allocations, and intake applications."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (hostels.length > 0) setAllocForm(prev => ({ ...prev, hostel_id: String(hostels[0].id) }));
                setShowAllocModal(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
            >
              <Bed className="w-4 h-4 text-brand-500" />
              Allocate Bed
            </button>
            {['school_admin', 'super_admin'].includes(user?.role) && (
              <button
                onClick={() => setShowBlockModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Hostel Block
              </button>
            )}
          </div>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Boarding Beds"
          value={totalBeds}
          icon={Building2}
          color="brand"
          subtext={`Across ${hostels.length} residential blocks`}
        />
        <StatCard
          label="Resident Boarders"
          value={totalOccupied}
          icon={Users}
          color="info"
          subtext={`${avgOccupancyRate}% overall capacity utilization`}
        />
        <StatCard
          label="Vacant Bed Spaces"
          value={totalVacant}
          icon={Bed}
          color={totalVacant < 10 ? 'danger' : 'accent'}
          subtext="Ready for new admissions"
        />
        <StatCard
          label="Pending Applications"
          value={applications.filter(a => a.status === 'pending').length}
          icon={CheckCircle2}
          color="violet"
          subtext="Warden review queue"
        />
      </KpiStrip>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'blocks', label: 'Hostel Blocks & Occupancy', count: hostels.length },
          { id: 'grid', label: 'Room & Bed Grid Matrix' },
          { id: 'allocations', label: 'Resident Directory', count: allocations.length },
          { id: 'applications', label: 'Boarding Applications Queue', count: applications.filter(a => a.status === 'pending').length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Occupancy Radial Cards */}
      {activeTab === 'blocks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hostels.map(block => {
            const cap = block.capacity || 100;
            const occ = block.current_occupancy || 0;
            const pct = Math.round((occ / cap) * 100);

            return (
              <div
                key={block.id}
                className="p-5 rounded-2xl bg-surface border border-line shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        {block.type === 'student_male' ? 'Boys Residence' : 'Girls Residence'}
                      </span>
                      <h3 className="font-bold text-base text-ink mt-0.5">{block.name}</h3>
                    </div>
                    <ProgressRing
                      value={pct}
                      size={54}
                      strokeWidth={5}
                      color={pct >= 95 ? '#D64545' : pct >= 80 ? '#F5A524' : '#2E8B63'}
                    />
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-canvas border border-line text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted">Capacity:</span>
                      <span className="font-mono font-bold text-ink">{occ} / {cap} beds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Vacancies:</span>
                      <span className="font-mono font-bold text-brand-500">{Math.max(0, cap - occ)} beds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Rooms:</span>
                      <span className="font-mono text-ink">{block.rooms_count || 30} rooms ({block.max_occupants_per_room || 4}/room)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted block text-[10px]">Head Warden</span>
                    <span className="font-semibold text-ink">{block.warden_name || 'Warden'}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedHostelId(block.id);
                      setActiveTab('grid');
                    }}
                    className="text-xs font-semibold text-brand-700 hover:underline"
                  >
                    View Bed Grid →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Room & Bed Grid Matrix */}
      {activeTab === 'grid' && (
        <Card
          title={`${activeHostel?.name || 'Chitepo Hall'} — Room & Bed Matrix`}
          subtitle="Real-time occupancy layout. Green shows available beds; gray shows occupied spaces."
          actions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted">Select Block:</span>
              <select
                value={activeHostel?.id}
                onChange={e => setSelectedHostelId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs font-semibold"
              >
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          }
        >
          {/* Room Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {Array.from({ length: 12 }, (_, rIdx) => {
              const roomNo = `Room ${101 + rIdx}`;
              return (
                <div key={roomNo} className="p-3.5 rounded-xl bg-canvas border border-line space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-ink">{roomNo}</span>
                    <span className="text-[10px] text-muted font-mono">4-Bed Cubicle</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4'].map((bed) => {
                      const isOccupied = rawAllocations.some(a =>
                        String(a.hostel_id) === String(selectedHostel?.id) &&
                        (a.room_number === roomNo || String(a.room_number) === String(101 + rIdx)) &&
                        a.bed_number === bed
                      );
                      return (
                        <div
                          key={bed}
                          className={`p-2 rounded-lg border text-center transition ${
                            isOccupied
                              ? 'bg-surface border-line text-muted'
                              : 'bg-brand-50 border-brand-100 text-brand-700 font-bold'
                          }`}
                        >
                          <Bed className={`w-4 h-4 mx-auto mb-1 ${isOccupied ? 'text-muted' : 'text-brand-500'}`} />
                          <div className="text-[10px]">{bed}</div>
                          <div className="text-[9px] font-mono">{isOccupied ? 'Occupied' : 'Free'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB 3: Residents Directory */}
      {activeTab === 'allocations' && (
        <Card title="Boarding Resident Directory">
          <DataTable
            columns={[
              {
                key: 'occupant_name',
                label: 'Student Resident',
                sortable: true,
                render: (v, row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={v} size="sm" />
                    <div>
                      <div className="font-bold text-ink">{v}</div>
                      <div className="text-[10px] font-mono text-muted">{row.student_admission || 'ADM-N/A'}</div>
                    </div>
                  </div>
                )
              },
              { key: 'hostel_name', label: 'Hostel Block', render: v => <span className="font-semibold text-xs text-ink">{v}</span> },
              { key: 'room_number', label: 'Room', render: v => <span className="font-mono text-xs">{v}</span> },
              { key: 'bed_number', label: 'Bed', render: v => <span className="font-mono text-xs font-bold text-brand-700">{v}</span> },
              {
                key: 'status',
                label: 'Boarding Status',
                render: v => <StatusPill status={v || 'active'} />
              }
            ]}
            data={allocations}
          />
        </Card>
      )}

      {/* TAB 4: Applications Review Queue */}
      {activeTab === 'applications' && (
        <Card
          title="Boarding Admissions Review Queue"
          subtitle="Parent applications for hostel accommodation intake."
        >
          <DataTable
            columns={[
              {
                key: 'student_name',
                label: 'Applicant Student',
                sortable: true,
                render: (v, row) => (
                  <div>
                    <div className="font-bold text-ink">{v}</div>
                    <div className="text-[11px] text-muted">{row.class_name}</div>
                  </div>
                )
              },
              { key: 'preferred_hostel', label: 'Preferred Hostel', render: v => <span className="font-semibold text-xs text-ink">{v}</span> },
              { key: 'dietary_notes', label: 'Dietary / Special Needs', render: v => <span className="text-xs text-muted">{v || 'None'}</span> },
              { key: 'emergency_contact', label: 'Guardian Contact', render: v => <span className="font-mono text-xs text-muted">{v}</span> },
              {
                key: 'status',
                label: 'Queue Status',
                render: v => <StatusPill status={v || 'pending'} />
              },
              {
                key: 'actions',
                label: '',
                render: (_, row) => (
                  row.status === 'pending' && (
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleAppReview(row.id, 'approved')}
                        className="px-2.5 py-1 rounded-lg bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAppReview(row.id, 'declined')}
                        className="px-2.5 py-1 rounded-lg border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/10 transition flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </div>
                  )
                )
              }
            ]}
            data={applications}
            emptyTitle="No Pending Applications"
            emptyMessage="All boarding accommodation intake requests have been processed."
          />
        </Card>
      )}

      {/* MODAL: Allocate Bed */}
      <Modal
        isOpen={showAllocModal}
        onClose={() => setShowAllocModal(false)}
        title="Allocate Bed Space"
        description="Assign a resident learner to a designated hostel room and cubicle bed."
      >
        <form onSubmit={handleAllocateBed} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Hostel Block *</label>
            <select
              required
              value={allocForm.hostel_id}
              onChange={e => setAllocForm({ ...allocForm, hostel_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              {hostels.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Student Learner *</label>
            <select
              required
              value={allocForm.student_id}
              onChange={e => setAllocForm({ ...allocForm, student_id: e.target.value })}
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
              <label className="block text-xs font-bold text-ink mb-1">Room Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. Room 104"
                value={allocForm.room_number}
                onChange={e => setAllocForm({ ...allocForm, room_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Bed Identifier *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bed 2"
                value={allocForm.bed_number}
                onChange={e => setAllocForm({ ...allocForm, bed_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowAllocModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Allocating...' : 'Confirm Allocation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Add Hostel Block */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title="Establish New Hostel Dormitory"
        description="Register a boarding block, total bed capacity, and designated head warden."
      >
        <form onSubmit={handleCreateBlock} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Hostel Block Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Chitepo Hall or Nehanda House"
              value={blockForm.name}
              onChange={e => setBlockForm({ ...blockForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Residence Type</label>
              <select
                value={blockForm.type}
                onChange={e => setBlockForm({ ...blockForm, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="student_male">Boys Hostel Dormitory</option>
                <option value="student_female">Girls Hostel Dormitory</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Bed Capacity *</label>
              <input
                type="number"
                min="10"
                max="300"
                required
                value={blockForm.capacity}
                onChange={e => setBlockForm({ ...blockForm, capacity: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Head Warden Name</label>
              <input
                type="text"
                placeholder="Mr. P. Sibanda"
                value={blockForm.warden_name}
                onChange={e => setBlockForm({ ...blockForm, warden_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Warden Emergency Phone</label>
              <input
                type="text"
                placeholder="+263 77..."
                value={blockForm.warden_phone}
                onChange={e => setBlockForm({ ...blockForm, warden_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowBlockModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Establish Hostel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
