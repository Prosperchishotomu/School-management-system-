import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../data/apiHooks';
import { api } from '../../utils/api';
import {
  StatCard,
  KpiStrip,
  Card,
  ProgressRing,
  StatusPill,
  EmptyState
} from '../../components/ui';
import {
  Building2, Users, AlertTriangle, Clock, ShieldCheck,
  CheckCircle2, ArrowRight
} from 'lucide-react';

export default function WardenDashboard() {
  const { user, activeSchoolId } = useAuth();
  const navigate = useNavigate();
  const schoolId = activeSchoolId || user?.school_id || '';

  const { data: summaryData } = useApi(
    `warden_summary_${schoolId}`,
    () => api.get(`/schools/${schoolId}/dashboard/summary?role=warden`)
  );

  const { data: boarding } = useApi(
    `warden_boarding_${schoolId}`,
    () => api.get(`/schools/${schoolId}/boarding/overview`)
  );

  const wardenData = summaryData?.data?.role_specific || {};
  const hostels = boarding?.hostels || [];
  const currentlyOut = boarding?.currently_out || [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 bg-surface border border-line text-ink shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-wider text-brand-700 dark:text-brand-300 uppercase px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 block w-fit mb-1.5">
            Boarding & Gate Operations
          </span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-ink tracking-tight">
            Warden & Gate Desk
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1 max-w-xl">
            {wardenData.total_boarders ?? 0} boarders registered. {wardenData.out_of_school_now ?? currentlyOut.length} students currently off campus on active exeat passes.
          </p>
        </div>

        <button
          onClick={() => navigate('/boarding/exeats')}
          className="btn-primary shrink-0"
        >
          Check In / Out Gate
        </button>
      </div>

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          title="Total Boarders"
          value={String(wardenData.total_boarders ?? 0)}
          sublabel={`${wardenData.occupancy_pct ?? 0}% campus occupancy`}
          icon={Building2}
          iconColor="brand"
          to="/hostels"
        />

        <StatCard
          title="Currently Out"
          value={String(wardenData.out_of_school_now ?? currentlyOut.length)}
          sublabel="Gate passes active"
          icon={Clock}
          iconColor="accent"
          to="/boarding/exeats"
        />

        <StatCard
          title="Pending Exeats"
          value={String(wardenData.pending_exeats ?? 0)}
          sublabel="Awaiting review"
          icon={AlertTriangle}
          iconColor={wardenData.pending_exeats > 0 ? "accent" : "brand"}
          to="/boarding/exeats"
        />

        <StatCard
          title="Gate Reconciliations"
          value="0 Discrepancies"
          sublabel="Attendance & gate in sync"
          icon={ShieldCheck}
          iconColor="brand"
          to="/boarding/exeats"
        />
      </KpiStrip>

      {/* Hostel Occupancy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hostels.length === 0 ? (
          <Card title="Hostel Allocation Overview" className="md:col-span-2">
            <div className="p-8 text-center text-xs text-muted">
              No hostel buildings registered yet. Add hostel facilities to monitor room capacity and bed occupancy.
            </div>
          </Card>
        ) : (
          hostels.map(h => (
            <Card
              key={h.name}
              title={h.name}
              subtitle={`${h.occupied || 0} of ${h.capacity || 0} beds allocated`}
              action={<StatusPill status="present" label="Operational" />}
              to="/hostels"
            >
              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-xs text-muted block">Current Capacity</span>
                  <span className="text-3xl font-bold font-display text-ink tabular-nums">
                    {h.occupied || 0} / {h.capacity || 0}
                  </span>
                  <span className="text-[11px] text-muted block mt-1">
                    {Math.max(0, (h.capacity || 0) - (h.occupied || 0))} beds vacant for allocation
                  </span>
                </div>
                <ProgressRing value={h.occupancy_pct || 0} size={90} color="brand" />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Currently Out Live Board */}
      <Card
        title="Active Gate Exeat Board"
        subtitle="Students currently outside school bounds"
        action={
          <button
            onClick={() => navigate('/boarding/exeats')}
            className="text-xs text-brand-700 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
          >
            Manage Pipeline →
          </button>
        }
      >
        {currentlyOut.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No students currently logged out on active exeat passes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-muted uppercase text-[11px]">
                  <th className="py-2.5 text-left">Student</th>
                  <th className="py-2.5 text-left">Class</th>
                  <th className="py-2.5 text-left">Destination</th>
                  <th className="py-2.5 text-right">Expected Return</th>
                  <th className="py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {currentlyOut.map(item => (
                  <tr key={item.exeat_id} className="hover:bg-canvas/40 transition-colors">
                    <td className="py-2.5 font-semibold text-ink">{item.student_name}</td>
                    <td className="py-2.5 text-muted">{item.class_name}</td>
                    <td className="py-2.5 text-muted">{item.destination}</td>
                    <td className="py-2.5 text-right font-mono font-medium">{item.expected_return}</td>
                    <td className="py-2.5 text-center">
                      <StatusPill status="pending" label="Checked Out" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
