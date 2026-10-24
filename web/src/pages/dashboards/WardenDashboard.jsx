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
  const schoolId = activeSchoolId || user?.school_id || 'HARAREPR';

  const { data: boarding } = useApi(
    `warden_boarding_${schoolId}`,
    () => api.get(`/schools/${schoolId}/boarding/overview`)
  );

  const hostels = boarding?.hostels || [
    { name: 'Chitepo Boys Hall', occupied: 120, capacity: 140, occupancy_pct: 86 },
    { name: 'Kaguvi Girls Hall', occupied: 115, capacity: 140, occupancy_pct: 82 }
  ];

  const currentlyOut = boarding?.currently_out || [
    { exeat_id: 'EX-01', student_name: 'Farai Ncube', class_name: 'Form 4 Delta', destination: 'Bulawayo', expected_return: 'Sun 17:00' },
    { exeat_id: 'EX-02', student_name: 'Blessing Gumbo', class_name: 'Lower 6 Sciences', destination: 'Harare CBD', expected_return: 'Sat 18:00' },
    { exeat_id: 'EX-03', student_name: 'Tinashe Moyo', class_name: 'Form 3 Gamma', destination: 'Chitungwiza', expected_return: 'Sun 16:30' }
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-950 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-wider text-brand-100 uppercase px-2 py-0.5 rounded-full bg-white/10 block w-fit mb-1.5">
            Boarding & Gate Operations
          </span>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
            Warden & Gate Desk
          </h1>
          <p className="text-xs md:text-sm text-brand-100/90 mt-1 max-w-xl">
            235 boarders in residence. 14 students currently off campus on active exeat passes.
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
          value="235"
          sublabel="84% campus occupancy"
          icon={Building2}
          iconColor="brand"
          to="/hostels"
        />

        <StatCard
          title="Currently Out"
          value={String(currentlyOut.length)}
          sublabel="Gate passes active"
          icon={Clock}
          iconColor="accent"
          to="/boarding/exeats"
        />

        <StatCard
          title="Pending Exeats"
          value="6 Requests"
          sublabel="Awaiting warden sign-off"
          icon={Users}
          iconColor="info"
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
        {hostels.map(h => (
          <Card
            key={h.name}
            title={h.name}
            subtitle={`${h.occupied} of ${h.capacity} beds allocated`}
            action={<StatusPill status="present" label="Operational" />}
          >
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-xs text-muted block">Current Capacity</span>
                <span className="text-3xl font-bold font-display text-ink tabular-nums">
                  {h.occupied} / {h.capacity}
                </span>
                <span className="text-[11px] text-muted block mt-1">
                  {h.capacity - h.occupied} beds vacant for allocation
                </span>
              </div>
              <ProgressRing value={h.occupancy_pct} size={90} color="brand" />
            </div>
          </Card>
        ))}
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
      </Card>
    </div>
  );
}
