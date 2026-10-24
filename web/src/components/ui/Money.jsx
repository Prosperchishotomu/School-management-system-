import React from 'react';
import { money } from '../../utils/format';

/**
 * Money component: Renders tabular numbers, base USD with currency conversion badge if desired.
 */
export default function Money({
  amount = 0,
  currency = 'USD',
  showEquivalent = false,
  fxRate = null,
  equivalentCurrency = 'ZiG',
  compact = false,
  className = ''
}) {
  const formatted = money(amount, currency, { compact });

  let equiv = null;
  if (showEquivalent && fxRate && amount) {
    const converted = Number(amount) * Number(fxRate);
    equiv = money(converted, equivalentCurrency, { compact: true });
  }

  return (
    <span className={`inline-flex items-baseline gap-1.5 font-mono tabular-nums whitespace-nowrap ${className}`}>
      <span>{formatted}</span>
      {equiv && (
        <span className="text-[10px] text-muted font-sans bg-line/50 dark:bg-line/20 px-1.5 py-0.5 rounded">
          ≈ {equiv}
        </span>
      )}
    </span>
  );
}
