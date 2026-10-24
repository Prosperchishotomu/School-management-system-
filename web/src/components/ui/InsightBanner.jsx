import React from 'react';
import { AlertCircle, AlertTriangle, Info, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * InsightBanner — Rule-based operational insights engine banner (Section 5.9).
 * Displays ranked anomalies, threshold alerts, and actionable recommendations.
 */
export default function InsightBanner({
  insights = [],
  onDismiss = null,
  className = ''
}) {
  if (!insights || insights.length === 0) return null;

  const topInsight = insights[0];

  const severityThemes = {
    critical: {
      border: 'border-red-200 dark:border-red-900/40',
      bg: 'bg-red-50/80 dark:bg-red-950/20',
      text: 'text-danger',
      icon: AlertCircle
    },
    warning: {
      border: 'border-amber-200 dark:border-amber-900/40',
      bg: 'bg-amber-50/80 dark:bg-amber-950/20',
      text: 'text-accent',
      icon: AlertTriangle
    },
    info: {
      border: 'border-brand-200 dark:border-brand-900/40',
      bg: 'bg-brand-50/80 dark:bg-brand-950/20',
      text: 'text-brand-700 dark:text-brand-400',
      icon: Info
    }
  };

  const theme = severityThemes[topInsight.severity] || severityThemes.info;
  const Icon = theme.icon;

  return (
    <div
      role="region"
      aria-label="System Insights"
      className={`rounded-2xl border ${theme.border} ${theme.bg} p-4 mb-6 transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-1.5 rounded-xl bg-white/60 dark:bg-black/20 ${theme.text} shrink-0 mt-0.5`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-sm text-ink tracking-tight">
                Operational Insight:
              </span>
              {topInsight.metric && (
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/30 ${theme.text}`}>
                  {topInsight.metric}
                </span>
              )}
            </div>
            <p className="text-xs text-ink/80 mt-1 leading-relaxed max-w-3xl">
              {topInsight.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {topInsight.href && (
            <Link
              to={topInsight.href}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-surface border border-line shadow-xs hover:border-brand-500 text-ink transition-colors"
            >
              <span>{topInsight.actionLabel || 'Investigate'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted" />
            </Link>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(topInsight.id)}
              aria-label="Dismiss insight"
              className="p-1 text-muted hover:text-ink rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
