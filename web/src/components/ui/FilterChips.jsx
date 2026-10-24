import React from 'react';

/**
 * FilterChips — Filter chip group for quick filtering (e.g. class, status, category)
 * Easily wired to useUrlFilters or local state.
 */
export default function FilterChips({
  options = null,
  chips = null,
  value = undefined,
  selected = undefined,
  onChange,
  className = ''
}) {
  const activeValue = value !== undefined ? value : selected;
  const rawList = options || chips || [];

  const uniqueOptions = React.useMemo(() => {
    const seen = new Set();
    const result = [];
    rawList.forEach((item) => {
      if (!item) return;
      const opt = typeof item === 'string'
        ? { value: item, label: item }
        : {
            ...item,
            value: item.value !== undefined ? item.value : (item.id !== undefined ? item.id : ''),
            label: item.label || item.name || String(item.value ?? item.id ?? '')
          };
      const k = String(opt.value);
      if (!seen.has(k)) {
        seen.add(k);
        result.push(opt);
      }
    });
    return result;
  }, [rawList]);

  return (
    <div className={`flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 text-xs select-none ${className}`}>
      {uniqueOptions.map((opt, idx) => {
        const isSelected = activeValue === opt.value;
        return (
          <button
            key={`${opt.value}-${idx}`}
            type="button"
            onClick={() => onChange && onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
              isSelected
                ? 'bg-brand-700 text-white shadow-sm font-semibold'
                : 'bg-surface text-muted hover:text-ink hover:bg-brand-50 border border-line'
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-line text-muted'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
