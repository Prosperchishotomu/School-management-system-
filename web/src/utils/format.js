/**
 * format.js — Single source of truth for all formatting across SchoolBase
 * All numbers, money values, percentages, and dates displayed in the UI go through here.
 */

/**
 * Format currency with Zimbabwe multi-currency support (USD, ZiG, ZAR)
 * @param {number|string} amount
 * @param {string} currency - 'USD' | 'ZWG' | 'ZiG' | 'ZAR'
 * @param {object} options - { compact: boolean, showSign: boolean }
 */
export function money(amount, currency = 'USD', options = {}) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return '-';

  const curr = (currency || 'USD').toUpperCase();
  const symbolMap = {
    USD: 'US$',
    ZWG: 'ZiG',
    ZIG: 'ZiG',
    ZAR: 'R'
  };
  const prefix = symbolMap[curr] || curr;

  if (options.compact && Math.abs(num) >= 1000) {
    return `${prefix} ${compact(num)}`;
  }

  const formattedNum = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${prefix} ${formattedNum}`;
}

/**
 * Format percentage with uniform precision
 * @param {number|string} value - 0-100 percentage number
 * @param {number} decimals
 */
export function pct(value, decimals = 1) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '-';
  return `${num.toFixed(decimals)}%`;
}

/**
 * Format compact numbers for charts/badges (e.g. 1.2k, 3.4M)
 * @param {number} num
 */
export function compact(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const abs = Math.abs(num);
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

/**
 * Relative time helper (e.g. "2 min ago", "yesterday", "in 3 days")
 * @param {string|Date} dateInput
 */
export function relativeTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'yesterday';
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Date range formatting (e.g. "12 Jan – 24 Mar 2026")
 * @param {string|Date} start
 * @param {string|Date} end
 */
export function dateRange(start, end) {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  if (isNaN(s.getTime())) return '';

  const sStr = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (!e || isNaN(e.getTime())) return sStr;
  const eStr = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${sStr} – ${eStr}`;
}

/**
 * ZIMSEC Grade and descriptor formatting
 * @param {string} grade - 'A' | 'B' | 'C' | 'D' | 'E' | 'U' | 'A*'
 */
export function gradeLabel(grade) {
  if (!grade) return '-';
  const g = String(grade).toUpperCase().trim();
  const descriptors = {
    'A*': 'Distinction',
    'A': 'Distinction',
    'B': 'Merit',
    'C': 'Credit (Pass)',
    'D': 'Pass',
    'E': 'Subsidiary Pass',
    'U': 'Ungraded'
  };
  return descriptors[g] || g;
}

/**
 * Ordinal ranking helper (1st, 2nd, 3rd, 4th, ...)
 * @param {number} n
 */
export function ordinal(n) {
  const num = parseInt(n, 10);
  if (isNaN(num)) return '-';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}
