import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * CollapsibleList Component
 * Automatically truncates lists with > 10 items and provides a clean toggle button.
 * Preserves clean table/list aesthetics across all pages.
 */
export default function CollapsibleList({
  items = [],
  renderItem,
  threshold = 10,
  className = '',
  itemContainerClassName = 'space-y-2',
  emptyMessage = 'No items found.'
}) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) {
    return <p className="text-xs text-ink/40 py-4 text-center italic">{emptyMessage}</p>;
  }

  const visibleItems = expanded || items.length <= threshold ? items : items.slice(0, threshold);
  const hiddenCount = items.length - threshold;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className={itemContainerClassName}>
        {visibleItems.map((item, index) => renderItem(item, index))}
      </div>

      {items.length > threshold && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-paper hover:bg-sage/10 text-teal-primary text-xs font-semibold rounded-lg border border-line-border/40 transition-colors shadow-xs cursor-pointer"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show less (collapsing to {threshold} items)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Show all {items.length} records ({hiddenCount} more hidden)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
