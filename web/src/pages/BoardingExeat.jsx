import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, invalidate } from '../data/apiHooks';
import { api } from '../utils/api';
import {
  PageHeader,
  KpiStrip,
  StatCard,
  Card,
  Tabs,
  StatusPill,
  Modal,
  EmptyState,
  Skeleton
} from '../components/ui';
import {
  Building2, Users, Clock, AlertTriangle, CheckCircle2,
  Plus, ArrowRight, ShieldCheck, LogOut, LogIn, Flag
} from 'lucide-react';

export default function BoardingExeat() {
  const { user, activeSchoolId } = useAuth();
  const toast = useToast();
  const schoolId = activeSchoolId || user?.school_id || '';

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: '',
    exeat_type: 'weekend',
    departure_date: new Date().toISOString().slice(0, 10),
    expected_return: '',
    destination: '',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Exeats
  const { data: exeatsData, loading, refetch } = useApi(
    `boarding_exeats_${schoolId}`,
    () => api.get(`/schools/${schoolId}/exeats`)
  );

  // Fetch real hostel and resident boarder capacity
  const { data: hostelsData } = useApi(
    `hostels_${schoolId}`,
    () => api.get('/hostels').then(r => r.data || []).catch(() => [])
  );
  const { data: allocationsData } = useApi(
    `hostels_alloc_${schoolId}`,
    () => api.get('/hostels/allocations').then(r => r.data || []).catch(() => [])
  );

  const hostels = Array.isArray(hostelsData) ? hostelsData : [];
  const allocations = Array.isArray(allocationsData) ? allocationsData : [];
  const totalBeds = hostels.reduce((acc, h) => acc + (parseInt(h.capacity) || 0), 0);
  const totalBoarders = allocations.length > 0 
    ? allocations.length 
    : hostels.reduce((acc, h) => acc + (parseInt(h.current_occupancy) || 0), 0);
  const occRate = totalBeds > 0 ? Math.round((totalBoarders / totalBeds) * 100) : 0;

  const exeats = useMemo(() => {
    if (!exeatsData) return [];
    return Array.isArray(exeatsData) ? exeatsData : (exeatsData.data || []);
  }, [exeatsData]);

  // Group into Kanban columns
  const kanbanColumns = [
    { id: 'pending', label: 'Pending Review', color: 'accent' },
    { id: 'approved', label: 'Approved (Awaiting Gate)', color: 'info' },
    { id: 'checked_out', label: 'Currently Out of School', color: 'accent' },
    { id: 'returned', label: 'Returned & Checked In', color: 'brand' },
    { id: 'flagged', label: 'Reconciliation Flags', color: 'danger' }
  ];

  const grouped = useMemo(() => {
    const map = { pending: [], approved: [], checked_out: [], returned: [], flagged: [] };
    exeats.forEach(ex => {
      const st = ex.status || 'pending';
      if (map[st]) map[st].push(ex);
      else map.pending.push(ex);
    });
    return map;
  }, [exeats]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/exeats/${id}/approve`, { status: 'approved' });
      toast.success('Exeat pass approved for gate checkout.');
      invalidate([`boarding_exeats_${schoolId}`, `boarding_overview_${schoolId}`, `summary_${schoolId}`]);
      refetch();
    } catch (err) {
      toast.error(err?.message || 'Approval failed.');
    }
  };

  const handleCheckOut = async (id) => {
    try {
      await api.post(`/exeats/${id}/check-out`);
      toast.success('Student checked out through main gate.');
      invalidate([`boarding_exeats_${schoolId}`, `boarding_overview_${schoolId}`, `summary_${schoolId}`]);
      refetch();
    } catch (err) {
      toast.error(err?.message || 'Check out failed.');
    }
  };

  const handleCheckIn = async (id) => {
    try {
      await api.post(`/exeats/${id}/check-in`);
      toast.success('Student verified and checked back into hostel residence.');
      invalidate([`boarding_exeats_${schoolId}`, `boarding_overview_${schoolId}`, `summary_${schoolId}`]);
      refetch();
    } catch (err) {
      toast.error(err?.message || 'Check in failed.');
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/schools/${schoolId}/exeats`, form);
      toast.success('Exeat pass requested.');
      setRequestModalOpen(false);
      invalidate([`boarding_exeats_${schoolId}`, `summary_${schoolId}`]);
      refetch();
    } catch (err) {
      toast.error(err?.message || 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hostels & Exeat Gate Board"
        subtitle="Boarding permissions, live off-campus accountability & attendance-gate reconciliation"
        actions={
          <button
            onClick={() => setRequestModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Request Exeat Pass
          </button>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Boarders In Residence"
          value={String(totalBoarders)}
          sublabel={totalBeds > 0 ? `Dormitory occupancy ${occRate}% (${totalBeds} beds total)` : "No residential dormitories configured"}
          icon={Building2}
          iconColor="brand"
        />

        <StatCard
          title="Currently Off-Campus"
          value={String(grouped.checked_out.length)}
          sublabel="Gate passes currently active"
          icon={Clock}
          iconColor="accent"
        />

        <StatCard
          title="Pending Approvals"
          value={String(grouped.pending.length)}
          sublabel="Awaiting warden review"
          icon={Users}
          iconColor="info"
        />

        <StatCard
          title="Attendance Flags"
          value={String(grouped.flagged.length)}
          sublabel="Gate vs class roll discrepancies"
          icon={AlertTriangle}
          iconColor="danger"
        />
      </KpiStrip>

      {/* Kanban Pipeline Board (Section 4) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {kanbanColumns.map(col => {
          const items = grouped[col.id] || [];

          return (
            <div key={col.id} className="glass-card p-3 flex flex-col min-w-[220px] bg-canvas/60">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-line">
                <span className="font-display font-bold text-xs text-ink truncate">
                  {col.label}
                </span>
                <span className="font-mono text-xs font-bold px-1.5 py-0.2 rounded-full bg-line text-ink">
                  {items.length}
                </span>
              </div>

              {/* Cards in column */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-muted text-[11px]">
                    No passes
                  </div>
                ) : (
                  items.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-surface border border-line shadow-xs space-y-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-ink">
                          {item.student_name || 'Boarder'}
                        </div>
                        <div className="text-[10px] text-muted font-mono">
                          {item.class_name || 'Class'} • {item.destination || 'Home'}
                        </div>
                      </div>

                      <div className="text-[11px] text-muted space-y-0.5 border-t border-line/60 pt-1.5">
                        <div className="flex justify-between">
                          <span>Return:</span>
                          <span className="font-mono font-medium text-ink">{item.expected_return}</span>
                        </div>
                      </div>

                      {/* Action buttons based on stage */}
                      <div className="pt-1 flex items-center justify-end gap-1">
                        {col.id === 'pending' && (
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-brand-700 text-white font-semibold text-[11px] hover:bg-brand-900 transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {col.id === 'approved' && (
                          <button
                            onClick={() => handleCheckOut(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-accent text-brand-950 font-bold text-[11px] hover:bg-amber-400 transition-colors cursor-pointer"
                          >
                            Gate Check-Out
                          </button>
                        )}
                        {col.id === 'checked_out' && (
                          <button
                            onClick={() => handleCheckIn(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-brand-500 text-white font-semibold text-[11px] hover:bg-brand-700 transition-colors cursor-pointer"
                          >
                            Check In Gate
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Request Exeat Modal */}
      <Modal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request Exeat Pass"
        subtitle="Official weekend or medical departure authorization"
        footer={
          <>
            <button onClick={() => setRequestModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleCreateRequest}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-ink block mb-1">Pass Classification</label>
            <select
              value={form.exeat_type}
              onChange={e => setForm({ ...form, exeat_type: e.target.value })}
              className="glass-input w-full"
            >
              <option value="weekend">Weekend Family Exeat</option>
              <option value="medical">Medical / Hospital Appointment</option>
              <option value="emergency">Family Compassionate Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">Departure Date</label>
              <input
                type="date"
                required
                value={form.departure_date}
                onChange={e => setForm({ ...form, departure_date: e.target.value })}
                className="glass-input w-full font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-ink block mb-1">Expected Return</label>
              <input
                type="text"
                required
                value={form.expected_return}
                onChange={e => setForm({ ...form, expected_return: e.target.value })}
                placeholder="e.g. Sunday 17:00"
                className="glass-input w-full font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">Destination Address *</label>
            <input
              type="text"
              required
              value={form.destination}
              onChange={e => setForm({ ...form, destination: e.target.value })}
              placeholder="e.g. 14 Josiah Chinamano Ave, Harare"
              className="glass-input w-full"
            />
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">Reason for Leave</label>
            <textarea
              rows={2}
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              placeholder="Provide reason for exeat authorization..."
              className="glass-input w-full"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
