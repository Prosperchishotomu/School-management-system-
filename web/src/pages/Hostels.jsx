import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  ShieldCheck, Home, Phone, Mail, UserCheck, Check, X,
  Trophy, Sparkles, Award
} from 'lucide-react';

export default function Hostels() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'blocks';
  const setActiveTab = (tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showHouseModal, setShowHouseModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms with clean initial states (no hardcoded capacities or numbers)
  const [blockForm, setBlockForm] = useState({
    name: '',
    type: 'student_male',
    capacity: '',
    max_occupants_per_room: '',
    warden_name: '',
    warden_phone: ''
  });

  const [allocForm, setAllocForm] = useState({
    hostel_id: '',
    student_id: '',
    room_number: '',
    bed_number: ''
  });

  const [houseForm, setHouseForm] = useState({
    name: '',
    color: '#3B82F6'
  });

  const [pointsForm, setPointsForm] = useState({
    house_id: '',
    student_id: '',
    points: '',
    reason: '',
    category: 'sports'
  });

  const { data: hostelsData, loading: loadingHostels } = useApi(
    `hostels_${activeSchoolId}`,
    () => api.get('/hostels').then(r => r.data || []).catch(() => []),
    { deps: [activeSchoolId] }
  );

  const { data: housesData } = useApi(
    `houses_${activeSchoolId}`,
    () => api.get('/houses').then(r => r.data?.data || r.data || []).catch(() => []),
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
  const houses = Array.isArray(housesData) ? housesData : [];

  const hostels = rawHostels;
  const allocations = rawAllocations;
  const applications = rawApplications;

  const activeHostel = useMemo(() => {
    if (!selectedHostelId && hostels.length > 0) return hostels[0];
    return hostels.find(h => String(h.id) === String(selectedHostelId)) || null;
  }, [hostels, selectedHostelId]);

  // Overall Boarding KPIs
  const totalBeds = hostels.reduce((acc, h) => acc + (parseInt(h.capacity) || 0), 0);
  const totalOccupied = hostels.reduce((acc, h) => acc + (parseInt(h.current_occupancy) || 0), 0);
  const totalVacant = Math.max(0, totalBeds - totalOccupied);
  const avgOccupancyRate = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  // Inter-House Competition KPIs
  const totalHousePoints = houses.reduce((acc, h) => acc + (parseInt(h.total_points) || 0), 0);
  const totalHouseStudents = houses.reduce((acc, h) => acc + (parseInt(h.total_students) || 0), 0);
  const leadingHouse = houses.length > 0
    ? [...houses].sort((a, b) => (parseInt(b.total_points) || 0) - (parseInt(a.total_points) || 0))[0]
    : null;

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/hostels', blockForm);
      toast.success(`Hostel block '${blockForm.name}' established.`);
      setShowBlockModal(false);
      setBlockForm({ name: '', type: 'student_male', capacity: '', max_occupants_per_room: '', warden_name: '', warden_phone: '' });
      invalidate(`hostels_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create hostel.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateHouse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/houses', houseForm);
      toast.success(`House '${houseForm.name}' created.`);
      setShowHouseModal(false);
      setHouseForm({ name: '', color: '#3B82F6' });
      invalidate(`houses_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create house.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAwardPoints = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/houses/points', pointsForm);
      toast.success(`Points recorded successfully.`);
      setShowPointsModal(false);
      setPointsForm({ house_id: '', student_id: '', points: '', reason: '', category: 'sports' });
      invalidate(`houses_${activeSchoolId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record house points.');
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
      setAllocForm({ hostel_id: '', student_id: '', room_number: '', bed_number: '' });
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

      {/* KPI Strip - Context aware for Points vs Boarding */}
      {activeTab === 'points' ? (
        <KpiStrip>
          <StatCard
            label="Established Houses"
            value={houses.length}
            icon={Trophy}
            color="brand"
            subtext={houses.length > 0 ? `${houses.length} inter-house teams` : "No houses registered yet"}
          />
          <StatCard
            label="Championship Leader"
            value={leadingHouse ? leadingHouse.name : "—"}
            icon={Award}
            color={leadingHouse && (parseInt(leadingHouse.total_points) || 0) > 0 ? "accent" : "neutral"}
            subtext={leadingHouse ? `${leadingHouse.total_points || 0} cumulative pts` : "Awaiting first tournament"}
          />
          <StatCard
            label="Total Points Awarded"
            value={totalHousePoints}
            icon={Sparkles}
            color="info"
            subtext="Across sports, academics, & conduct"
          />
          <StatCard
            label="House Membership"
            value={totalHouseStudents}
            icon={Users}
            color="violet"
            subtext="Learners assigned to houses"
          />
        </KpiStrip>
      ) : (
        <KpiStrip>
          <StatCard
            label="Total Boarding Beds"
            value={totalBeds}
            icon={Building2}
            color="brand"
            subtext={hostels.length > 0 ? `Across ${hostels.length} residential blocks` : "No hostel blocks established"}
          />
          <StatCard
            label="Resident Boarders"
            value={totalOccupied}
            icon={Users}
            color="info"
            subtext={totalBeds > 0 ? `${avgOccupancyRate}% capacity utilization` : "0% occupancy"}
          />
          <StatCard
            label="Vacant Bed Spaces"
            value={totalVacant}
            icon={Bed}
            color={totalBeds === 0 ? "neutral" : (totalVacant < 5 ? "warning" : "accent")}
            subtext={totalBeds > 0 ? "Ready for new admissions" : "No beds configured"}
          />
          <StatCard
            label="Pending Applications"
            value={applications.filter(a => a.status === 'pending').length}
            icon={CheckCircle2}
            color="violet"
            subtext="Warden review queue"
          />
        </KpiStrip>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'blocks', label: 'Hostel Blocks & Occupancy', count: hostels.length },
          { id: 'grid', label: 'Room & Bed Grid Matrix' },
          { id: 'allocations', label: 'Resident Directory', count: allocations.length },
          { id: 'applications', label: 'Boarding Applications Queue', count: applications.filter(a => a.status === 'pending').length },
          { id: 'points', label: 'House Points', count: houses.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Occupancy Radial Cards */}
      {activeTab === 'blocks' && (
        hostels.length === 0 ? (
          <EmptyState
            title="No Hostel Blocks Configured"
            subtitle="Register hostel dormitories to track bed capacities, warden assignments, and room allocations."
            action={
              ['school_admin', 'super_admin'].includes(user?.role) && (
                <button
                  onClick={() => setShowBlockModal(true)}
                  className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs mx-auto mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Establish First Hostel
                </button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hostels.map(block => {
              const cap = parseInt(block.capacity) || 0;
              const occ = parseInt(block.current_occupancy) || 0;
              const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;

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
                        <span className="font-mono font-bold text-ink">{occ} / {cap > 0 ? `${cap} beds` : 'Unspecified'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Vacancies:</span>
                        <span className="font-mono font-bold text-brand-500">{cap > 0 ? `${Math.max(0, cap - occ)} beds` : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Rooms:</span>
                        <span className="font-mono text-ink">
                          {block.rooms_count ? `${block.rooms_count} rooms` : 'Configured rooms'} {block.max_occupants_per_room ? `(${block.max_occupants_per_room}/room)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-muted block text-[10px]">Head Warden</span>
                      <span className="font-semibold text-ink">{block.warden_name || 'Unassigned'}</span>
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
        )
      )}

      {/* TAB 2: Room & Bed Grid Matrix */}
      {activeTab === 'grid' && (
        !activeHostel ? (
          <EmptyState
            title="No Hostel Selected"
            subtitle="Please create or select a hostel block to view the room and bed distribution."
            action={
              ['school_admin', 'super_admin'].includes(user?.role) && (
                <button
                  onClick={() => setShowBlockModal(true)}
                  className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs mx-auto mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Hostel Block
                </button>
              )
            }
          />
        ) : (
          <Card
            title={`${activeHostel.name} — Room & Bed Matrix`}
            subtitle="Real-time occupancy layout. Green indicates available beds; neutral indicates occupied spaces."
            actions={
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted">Select Block:</span>
                <select
                  value={activeHostel.id}
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
            {(() => {
              const hostelAllocations = rawAllocations.filter(a => String(a.hostel_id) === String(activeHostel.id));
              // Collect all distinct rooms from allocations, or dynamic rooms if rooms_count is configured
              const distinctAllocatedRooms = Array.from(new Set(hostelAllocations.map(a => a.room_number).filter(Boolean)));
              const roomCount = parseInt(activeHostel.rooms_count) || (distinctAllocatedRooms.length > 0 ? distinctAllocatedRooms.length : (activeHostel.capacity ? Math.ceil(activeHostel.capacity / (activeHostel.max_occupants_per_room || 4)) : 0));
              
              if (roomCount === 0 && distinctAllocatedRooms.length === 0) {
                return (
                  <EmptyState
                    title="No Rooms Configured"
                    subtitle={`No rooms recorded for ${activeHostel.name}. Allocate a bed space or configure rooms.`}
                    action={
                      <button
                        onClick={() => {
                          setAllocForm(prev => ({ ...prev, hostel_id: String(activeHostel.id) }));
                          setShowAllocModal(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs mx-auto mt-2"
                      >
                        <Bed className="w-4 h-4" />
                        Allocate First Bed
                      </button>
                    }
                  />
                );
              }

              const rooms = distinctAllocatedRooms.length > 0 
                ? distinctAllocatedRooms 
                : Array.from({ length: Math.min(roomCount, 24) }, (_, rIdx) => `Room ${101 + rIdx}`);

              const bedsPerRoom = parseInt(activeHostel.max_occupants_per_room) || 4;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                  {rooms.map((roomNo) => {
                    const roomAllocations = hostelAllocations.filter(a => a.room_number === roomNo);
                    return (
                      <div key={roomNo} className="p-3.5 rounded-xl bg-canvas border border-line space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-ink">{roomNo}</span>
                          <span className="text-[10px] text-muted font-mono">{roomAllocations.length} / {bedsPerRoom} beds</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: bedsPerRoom }, (_, bIdx) => {
                            const bedName = `Bed ${bIdx + 1}`;
                            const alloc = roomAllocations.find(a => a.bed_number === bedName || a.bed_number === String(bIdx + 1));
                            const isOccupied = !!alloc;
                            return (
                              <div
                                key={bedName}
                                title={isOccupied ? `Occupied by: ${alloc.occupant_name || 'Student'}` : 'Available'}
                                className={`p-2 rounded-lg border text-center transition ${
                                  isOccupied
                                    ? 'bg-surface border-line text-muted'
                                    : 'bg-brand-50 border-brand-100 text-brand-700 font-bold'
                                }`}
                              >
                                <Bed className={`w-4 h-4 mx-auto mb-1 ${isOccupied ? 'text-muted' : 'text-brand-500'}`} />
                                <div className="text-[10px]">{bedName}</div>
                                <div className="text-[9px] font-mono">{isOccupied ? 'Occupied' : 'Free'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        )
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

      {/* TAB 5: House Points Standings */}
      {activeTab === 'points' && (
        <Card
          title="Inter-House Competition & Merits Shield"
          subtitle="Real-time house points tally for sporting competitions, academic challenges, and disciplinary conduct."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (houses.length > 0) setPointsForm(prev => ({ ...prev, house_id: String(houses[0].id) }));
                  setShowPointsModal(true);
                }}
                disabled={houses.length === 0}
                className="px-3.5 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Award / Deduct Points
              </button>
              {['school_admin', 'super_admin'].includes(user?.role) && (
                <button
                  onClick={() => setShowHouseModal(true)}
                  className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add House
                </button>
              )}
            </div>
          }
        >
          {houses.length === 0 ? (
            <EmptyState
              title="No Houses Configured"
              subtitle="Configure school houses (e.g., Chaminuka, Zambezi, Great Zimbabwe) to begin tracking house points and inter-house competitions."
              action={
                ['school_admin', 'super_admin'].includes(user?.role) && (
                  <button
                    onClick={() => setShowHouseModal(true)}
                    className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-900 transition flex items-center gap-1.5 shadow-xs mx-auto mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Configure First House
                  </button>
                )
              }
            />
          ) : (
            <div className="space-y-6">
              {/* Podium / Top Houses */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {houses.slice(0, 3).map((house, idx) => (
                  <div
                    key={house.id}
                    className="p-4 rounded-2xl bg-canvas border border-line flex items-center justify-between shadow-2xs relative overflow-hidden"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5"
                      style={{ backgroundColor: house.color || '#3B82F6' }}
                    />
                    <div className="pl-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          Rank #{idx + 1}
                        </span>
                        {idx === 0 && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      <h4 className="font-bold text-sm text-ink mt-0.5">{house.name}</h4>
                      <p className="text-[11px] text-muted">{house.total_students || 0} students assigned</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xl font-extrabold text-ink">
                        {house.total_points || 0}
                      </span>
                      <span className="text-[10px] text-muted block uppercase font-bold">pts</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Full Standings Table */}
              <DataTable
                columns={[
                  {
                    key: 'rank',
                    label: 'Rank',
                    render: (_, __, idx) => (
                      <span className="font-mono font-bold text-xs text-ink">#{idx + 1}</span>
                    )
                  },
                  {
                    key: 'name',
                    label: 'House Name',
                    sortable: true,
                    render: (v, row) => (
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: row.color || '#3B82F6' }}
                        />
                        <div>
                          <div className="font-bold text-ink">{v}</div>
                          <div className="text-[10px] text-muted">{row.house_master_name ? `House Master: ${row.house_master_name}` : 'No Master Assigned'}</div>
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'total_students',
                    label: 'Assigned Students',
                    sortable: true,
                    render: v => <span className="font-mono text-xs">{v || 0}</span>
                  },
                  {
                    key: 'total_points',
                    label: 'Total Tally',
                    sortable: true,
                    render: v => (
                      <span className="font-mono font-bold text-sm text-brand-700">
                        {v || 0} pts
                      </span>
                    )
                  },
                  {
                    key: 'actions',
                    label: '',
                    render: (_, row) => (
                      <button
                        onClick={() => {
                          setPointsForm(prev => ({ ...prev, house_id: String(row.id) }));
                          setShowPointsModal(true);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1"
                      >
                        <Award className="w-3.5 h-3.5 text-muted" />
                        Record Points
                      </button>
                    )
                  }
                ]}
                data={houses}
              />
            </div>
          )}
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
                min="1"
                required
                placeholder="Total bed spaces"
                value={blockForm.capacity}
                onChange={e => setBlockForm({ ...blockForm, capacity: e.target.value === '' ? '' : parseInt(e.target.value) || '' })}
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

      {/* MODAL: Add House */}
      <Modal
        isOpen={showHouseModal}
        onClose={() => setShowHouseModal(false)}
        title="Create School House"
        description="Establish an inter-house competition house (e.g. Chaminuka, Zambezi, Great Zimbabwe)."
      >
        <form onSubmit={handleCreateHouse} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">House Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Chaminuka House"
              value={houseForm.name}
              onChange={e => setHouseForm({ ...houseForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink mb-1">House Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={houseForm.color}
                onChange={e => setHouseForm({ ...houseForm, color: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-line p-0.5 bg-surface"
              />
              <span className="font-mono text-xs text-muted uppercase">{houseForm.color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowHouseModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create House'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Award / Deduct Points */}
      <Modal
        isOpen={showPointsModal}
        onClose={() => setShowPointsModal(false)}
        title="Record House Points"
        description="Award merit points or log penalty deductions for inter-house events."
      >
        <form onSubmit={handleAwardPoints} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">Select House *</label>
            <select
              required
              value={pointsForm.house_id}
              onChange={e => setPointsForm({ ...pointsForm, house_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select house...</option>
              {houses.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Points Delta (+ or -) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 10 or -5"
                value={pointsForm.points}
                onChange={e => setPointsForm({ ...pointsForm, points: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 font-mono"
              />
              <span className="text-[10px] text-muted">Use negative numbers to deduct points</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1">Category</label>
              <select
                value={pointsForm.category}
                onChange={e => setPointsForm({ ...pointsForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
              >
                <option value="sports">Inter-House Sports</option>
                <option value="academics">Academic Quiz / Debate</option>
                <option value="arts">Music & Drama</option>
                <option value="conduct">Discipline & Conduct</option>
                <option value="general">General Campus Merits</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Contributing Student (Optional)</label>
            <select
              value={pointsForm.student_id}
              onChange={e => setPointsForm({ ...pointsForm, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Whole House / General Activity</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Reason / Citation *</label>
            <input
              type="text"
              required
              placeholder="e.g. 1st place in 100m Athletics Inter-House Sprint"
              value={pointsForm.reason}
              onChange={e => setPointsForm({ ...pointsForm, reason: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowPointsModal(false)}
              className="px-4 py-2 rounded-xl border border-line text-xs font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-900 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record House Points'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
