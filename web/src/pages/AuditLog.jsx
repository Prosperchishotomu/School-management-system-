import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useApi } from '../data';
import {
  PageHeader, KpiStrip, StatCard, Card, DataTable, StatusPill,
  Avatar, Modal, Drawer, FilterChips, EmptyState
} from '../components/ui';
import {
  ShieldCheck, Search, Filter, Calendar, Clock, User,
  FileText, ArrowRight, Eye, Printer, Shield, AlertTriangle
} from 'lucide-react';

const ENTITIES = [
  { id: '', label: 'All Entities' },
  { id: 'payment', label: 'Finance & Payments' },
  { id: 'grade', label: 'Marks & Grades' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'student', label: 'Students' },
  { id: 'user', label: 'User Security' },
  { id: 'exeat', label: 'Boarding Exeat' },
];

export default function AuditLog() {
  const { activeSchoolId, user } = useAuth();
  const toast = useToast();

  const [entityFilter, setEntityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: logsData, loading } = useApi(
    `audit_logs_${activeSchoolId}_${entityFilter}`,
    () => {
      const url = activeSchoolId
        ? `/schools/${activeSchoolId}/activity?limit=50`
        : `/admin/audit-log?limit=50`;
      return api.get(url).then(r => r.data?.data || r.data || []).catch(() => []);
    },
    { deps: [activeSchoolId, entityFilter] }
  );

  const rawLogs = Array.isArray(logsData) ? logsData : [];

  const logs = rawLogs.filter(l => {
    const matchesEntity = !entityFilter || l.entity === entityFilter || l.entity_type === entityFilter;
    const matchesSearch = !searchQuery ||
      l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEntity && matchesSearch;
  });

  // KPIs
  const totalEvents = logs.length;
  const financeEvents = logs.filter(l => l.entity === 'payment' || l.action?.includes('PAYMENT')).length;
  const academicEvents = logs.filter(l => l.entity === 'grade' || l.action?.includes('MARK')).length;
  const securityEvents = logs.filter(l => l.entity === 'user' || l.action?.includes('PASSWORD') || l.action?.includes('AUTH')).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable System Audit Trail"
        subtitle="Forensic operational log of all financial disbursements, mark alterations, attendance registers, and user authentication events."
        actions={
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4 text-muted" />
            Print Audit Log
          </button>
        }
      />

      {/* KPI Strip */}
      <KpiStrip>
        <StatCard
          label="Total Audited Events"
          value={totalEvents}
          icon={ShieldCheck}
          color="brand"
          subtext="Append-only tamperproof log"
        />
        <StatCard
          label="Financial Mutations"
          value={financeEvents}
          icon={Shield}
          color="info"
          subtext="Receipts, fees, invoice adjustments"
        />
        <StatCard
          label="Academic & Grade Edits"
          value={academicEvents}
          icon={FileText}
          color="accent"
          subtext="Supervised mark changes"
        />
        <StatCard
          label="Security & Auth Actions"
          value={securityEvents}
          icon={AlertTriangle}
          color="violet"
          subtext="Role changes & credential resets"
        />
      </KpiStrip>

      {/* Filter Chips and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <FilterChips
          chips={ENTITIES}
          selected={entityFilter}
          onChange={setEntityFilter}
        />

        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by actor, action..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs focus:ring-2 focus:ring-brand-500 w-64"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <Card title="Activity & Mutation Ledger">
        <DataTable
          columns={[
            {
              key: 'action',
              label: 'Action Event',
              sortable: true,
              render: (v, row) => (
                <div>
                  <div className="font-mono font-bold text-xs text-ink">{v || row.event_type || 'ACTIVITY'}</div>
                  <div className="text-[10px] text-muted capitalize mt-0.5">{row.entity || row.entity_type || 'General'}</div>
                </div>
              )
            },
            {
              key: 'actor',
              label: 'Actor / User',
              sortable: true,
              render: (_, row) => (
                <div className="flex items-center gap-2">
                  <Avatar name={row.actor_name || row.user_name || 'Staff'} size="sm" />
                  <div>
                    <div className="font-semibold text-xs text-ink">{row.actor_name || row.user_name || 'System Operator'}</div>
                    <div className="text-[10px] font-mono text-muted">{row.actor_role || row.user_role || 'Staff'}</div>
                  </div>
                </div>
              )
            },
            {
              key: 'timestamp',
              label: 'Timestamp',
              sortable: true,
              render: (_, row) => {
                const date = row.created_at || row.timestamp;
                return (
                  <div>
                    <span className="font-mono text-xs block text-ink">
                      {date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                    </span>
                    <span className="text-[10px] text-muted">
                      {date ? new Date(date).toLocaleDateString() : 'Today'}
                    </span>
                  </div>
                );
              }
            },
            {
              key: 'ip_address',
              label: 'IP Origin',
              render: v => <span className="font-mono text-xs text-muted">{v || '—'}</span>
            },
            {
              key: 'actions',
              label: '',
              render: (_, row) => (
                <button
                  onClick={() => setSelectedLog(row)}
                  className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold hover:bg-canvas transition flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5 text-muted" />
                  Diff View
                </button>
              )
            }
          ]}
          data={logs}
          emptyTitle="No Audit Events Recorded"
          emptyMessage="No mutation logs match the selected filter."
        />
      </Card>

      {/* Diff View Drawer */}
      <Drawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `Audit Event: ${selectedLog.action || 'Activity'}` : 'Audit Record'}
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Actor:</span>
                <span className="font-bold text-ink">{selectedLog.actor_name || selectedLog.user_name || 'System Operator'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Entity:</span>
                <span className="font-mono uppercase text-ink">{selectedLog.entity || 'General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Recorded:</span>
                <span className="font-mono text-ink">{new Date(selectedLog.created_at || Date.now()).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">IP Address:</span>
                <span className="font-mono text-ink">{selectedLog.ip_address || '—'}</span>
              </div>
            </div>

            {/* Old vs New Value Diff Inspection */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">State Diff Inspection</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Old State */}
                <div className="p-3.5 rounded-xl bg-danger/5 border border-danger/20">
                  <span className="text-[10px] font-bold uppercase text-danger block mb-2">Previous State (Before)</span>
                  <pre className="text-xs font-mono text-ink overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.old_value ? JSON.stringify(selectedLog.old_value, null, 2) : 'null (New Record)'}
                  </pre>
                </div>

                {/* New State */}
                <div className="p-3.5 rounded-xl bg-brand-50/40 border border-brand-100">
                  <span className="text-[10px] font-bold uppercase text-brand-700 block mb-2">Updated State (After)</span>
                  <pre className="text-xs font-mono text-ink overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.new_value ? JSON.stringify(selectedLog.new_value, null, 2) : 'Record Purged'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}