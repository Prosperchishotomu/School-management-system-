import React from 'react';

/**
 * Heatmap — Time x Group or Class x Weekday matrix.
 * Visual carries meaning for attendance patterns, marks distribution, or activity density.
 */
export default function Heatmap({
  rows = [], // ['Form 1A', 'Form 1B', 'Form 2A', ...]
  columns = [], // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  data = {}, // { 'Form 1A_Mon': 96, 'Form 1A_Tue': 88, ... }
  min = 0,
  max = 100,
  unit = '%',
  onCellClick = null,
  className = ''
}) {
  const getCellColor = (val) => {
    if (val === undefined || val === null) {
      return 'bg-canvas dark:bg-canvas/30 text-muted';
    }
    const score = Number(val);
    if (score >= 95) return 'bg-brand-700 text-white font-semibold';
    if (score >= 85) return 'bg-brand-500 text-white';
    if (score >= 75) return 'bg-brand-100 text-brand-900 dark:bg-brand-900/60 dark:text-brand-100';
    if (score >= 60) return 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100';
    return 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100';
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-xs select-none">
        <thead>
          <tr>
            <th className="p-2 text-left text-muted font-medium w-28 shrink-0">Class</th>
            {columns.map((col, idx) => (
              <th key={idx} className="p-2 text-center text-muted font-medium min-w-[50px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/40">
          {rows.map((row) => (
            <tr key={row} className="hover:bg-canvas/30 transition-colors">
              <td className="p-2 font-medium text-ink truncate max-w-[140px]" title={row}>
                {row}
              </td>
              {columns.map((col) => {
                const key = `${row}_${col}`;
                const val = data[key];
                const isClickable = Boolean(onCellClick && val !== undefined);
                return (
                  <td key={col} className="p-1 text-center">
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => onCellClick && onCellClick(row, col, val)}
                      title={`${row} - ${col}: ${val !== undefined ? `${val}${unit}` : 'No data'}`}
                      className={`w-full py-1.5 px-1 rounded-md text-[11px] font-mono tabular-nums transition-transform ${getCellColor(
                        val
                      )} ${isClickable ? 'cursor-pointer hover:scale-105 hover:ring-2 hover:ring-brand-500' : ''}`}
                    >
                      {val !== undefined ? `${Math.round(val)}${unit}` : '-'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
