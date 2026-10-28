import React from 'react';

/**
 * StatusPill — Centralized status-to-color mapping across all modules.
 * Ensures consistent visual semantics:
 * - Green/Brand: paid, present, active, approved, published, enrolled, returned, resolved, low
 * - Accent/Amber: pending, partial, late, submitted, draft, medium, checked_out
 * - Red/Danger: overdue, absent, suspended, rejected, failed, flagged, critical, high
 * - Info/Blue: info, registered, excused, open, in_progress
 * - Violet: secondary, exam sitting, merit
 */
const STATUS_CONFIG = {
  // Financial
  paid:      { label: 'Paid', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  partial:   { label: 'Partial', color: 'bg-amber-100 text-accent dark:bg-amber-950/40 dark:text-amber-400' },
  unpaid:    { label: 'Unpaid', color: 'bg-amber-100 text-accent dark:bg-amber-950/40 dark:text-amber-400' },
  overdue:   { label: 'Overdue', color: 'bg-red-100 text-danger dark:bg-red-950/40 dark:text-red-400' },
  refunded:  { label: 'Refunded', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300' },

  // Attendance
  present:   { label: 'Present', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  absent:    { label: 'Absent', color: 'bg-red-100 text-danger dark:bg-red-950/40 dark:text-red-400' },
  late:      { label: 'Late', color: 'bg-amber-100 text-accent dark:bg-amber-950/40 dark:text-amber-400' },
  excused:   { label: 'Excused', color: 'bg-blue-100 text-info dark:bg-blue-950/40 dark:text-blue-400' },

  // People / Accounts
  active:      { label: 'Active', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  enrolled:    { label: 'Enrolled', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  transferred: { label: 'Transferred', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  finished:    { label: 'Finished', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' },
  graduated:   { label: 'Graduated', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' },
  dropped:     { label: 'Dropped', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  dropped_out: { label: 'Dropped Out', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  inactive:    { label: 'Inactive', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
  suspended:   { label: 'Suspended', color: 'bg-red-100 text-danger dark:bg-red-950/40 dark:text-red-400' },
  withdrawn:   { label: 'Withdrawn', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },

  // Workflow / Exeat / Approvals
  pending:   { label: 'Pending', color: 'bg-amber-100 text-accent dark:bg-amber-950/40 dark:text-amber-400' },
  approved:  { label: 'Approved', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  rejected:  { label: 'Rejected', color: 'bg-red-100 text-danger dark:bg-red-950/40 dark:text-red-400' },
  checked_out: { label: 'Checked Out', color: 'bg-amber-100 text-accent dark:bg-amber-950/40 dark:text-amber-400' },
  returned:  { label: 'Returned', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  flagged:   { label: 'Flagged Mismatch', color: 'bg-red-100 text-danger dark:bg-red-950/40 dark:text-red-400' },

  // Academic Publications
  draft:     { label: 'Draft', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-info dark:bg-blue-950/40 dark:text-blue-400' },
  published: { label: 'Published', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  revision_requested: { label: 'Revision Requested', color: 'bg-amber-100 text-accent dark:bg-amber-950/40 dark:text-amber-400' },

  // Tasks / Incidents
  open:        { label: 'Open', color: 'bg-blue-100 text-info dark:bg-blue-950/40 dark:text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-info dark:bg-blue-950/40 dark:text-blue-400' },
  resolved:    { label: 'Resolved', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' },
  closed:      { label: 'Closed', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },

  // Priority
  critical:    { label: 'Critical', color: 'bg-red-100 text-danger dark:bg-red-950/40 dark:text-red-400' },
  high:        { label: 'High', color: 'bg-red-100 text-danger dark:bg-red-950/40 dark:text-red-400' },
  medium:      { label: 'Medium', color: 'bg-amber-100 text-accent dark:bg-amber-950/40 dark:text-amber-400' },
  low:         { label: 'Low', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-500' }
};

export default function StatusPill({ status, label = null, size = 'md', className = '' }) {
  if (!status) return null;
  const key = String(status).toLowerCase().trim().replace(/[\s-]+/g, '_');
  const conf = STATUS_CONFIG[key] || {
    label: status.replace(/_/g, ' '),
    color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
  };

  const displayText = label || conf.label;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full leading-none whitespace-nowrap transition-colors ${conf.color} ${sizeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span>{displayText}</span>
    </span>
  );
}
