import React from 'react';

/**
 * Tabs — Navigation / view switcher with accessible keyboard support.
 */
export default function Tabs({
  tabs = [], // [{ id: 'overview', label: 'Overview', icon: Icon, count: 12 }, ...]
  activeTab,
  onChange,
  variant = 'pills', // 'pills' | 'underline'
  className = ''
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 overflow-x-auto select-none ${
        variant === 'underline'
          ? 'border-b border-line pb-px'
          : 'bg-canvas/80 dark:bg-canvas/40 p-1 rounded-xl border border-line/60'
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-brand-700 text-brand-700 dark:border-brand-500 dark:text-brand-400'
                  : 'border-transparent text-muted hover:text-ink hover:border-line'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-brand-100 text-brand-900 dark:bg-brand-900/60' : 'bg-line text-muted'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              isActive
                ? 'bg-surface text-ink shadow-xs dark:bg-surface dark:text-brand-400'
                : 'text-muted hover:text-ink hover:bg-surface/50'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60' : 'bg-line/70 text-muted'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
