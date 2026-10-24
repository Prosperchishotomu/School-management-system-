import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, SlidersHorizontal, CheckSquare, Square } from 'lucide-react';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';

/**
 * DataTable — Core table component for all listings.
 * Sticky header, sortable, row click, bulk select, density toggle, skeleton/empty states, CSV export.
 */
export default function DataTable({
  columns = [], // [{ key, label, render, sortable, align: 'left'|'center'|'right' }]
  data = [],
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search filters.',
  onRowClick = null,
  selectable = false,
  selectedIds = [],
  onSelectionChange = null,
  idKey = 'id',
  csvExportName = 'export',
  actions = null,
  className = ''
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [density, setDensity] = useState('normal'); // 'normal' | 'dense'

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!data.length) return;
    const headers = columns.map(c => `"${c.label}"`).join(',');
    const rows = sortedData.map(row => {
      return columns.map(c => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${csvExportName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk selection
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) onSelectionChange([]);
    else onSelectionChange(data.map(d => d[idKey]));
  };

  const toggleSelectRow = (id, e) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const cellPadding = density === 'dense' ? 'py-2 px-3 text-xs' : 'py-3.5 px-4 text-sm';

  return (
    <div className={`glass-card overflow-hidden flex flex-col ${className}`}>
      {/* Table Toolbar */}
      <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3 flex-wrap bg-surface shrink-0">
        <div className="flex items-center gap-2">
          {selectable && selectedIds.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
              {selectedIds.length} selected
            </span>
          )}
          {actions}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Density toggle */}
          <button
            type="button"
            onClick={() => setDensity(d => d === 'normal' ? 'dense' : 'normal')}
            title={`Toggle density: currently ${density}`}
            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-canvas transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!data.length}
            title="Export CSV"
            className="p-1.5 text-muted hover:text-ink disabled:opacity-30 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table viewport */}
      <div className="overflow-x-auto flex-1">
        <table className="table-premium w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label="Select all rows"
                    className="cursor-pointer text-muted hover:text-ink"
                  >
                    {allSelected ? <CheckSquare className="w-4 h-4 text-brand-700" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
              )}

              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

                return (
                  <th
                    key={col.key}
                    className={`${alignClass} ${col.sortable ? 'cursor-pointer hover:text-ink' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="text-muted/60">
                          {isSorted ? (
                            sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-700" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-700" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {loading ? (
              <Skeleton variant="table-row" count={5} />
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <EmptyState title={emptyTitle} description={emptyDescription} compact={true} />
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => {
                const id = row[idKey] ?? idx;
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-950/20' : ''} ${
                      isSelected ? 'bg-brand-50/70 dark:bg-brand-950/30' : ''
                    }`}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-3" onClick={(e) => toggleSelectRow(id, e)}>
                        <button type="button" aria-label="Select row" className="cursor-pointer text-muted hover:text-ink">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-brand-700" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}

                    {columns.map((col) => {
                      const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                      const cellContent = col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-');

                      return (
                        <td key={col.key} className={`${cellPadding} ${alignClass}`}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
