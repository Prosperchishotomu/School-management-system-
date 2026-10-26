/**
 * Utility functions for date-determined academic terms.
 * Rule: Date determines the active term always across the system.
 */

/**
 * Determines the current academic term based on current date.
 * If today falls between start_date and end_date of a term, that term is active.
 * If today is during holiday/break, resolves to the upcoming term or most recent term.
 *
 * @param {Array} terms - List of term objects
 * @param {Date|string} [currentDate] - Date to evaluate (defaults to now)
 * @returns {Object|null}
 */
export function getCurrentTerm(terms = [], currentDate = new Date()) {
  if (!Array.isArray(terms) || terms.length === 0) return null;

  const targetDate = new Date(currentDate);
  const targetTime = targetDate.getTime();

  // 1. Check exact match: currentDate is between start_date and end_date
  for (const term of terms) {
    if (!term.start_date || !term.end_date) continue;
    const start = new Date(term.start_date).getTime();
    const end = new Date(term.end_date).getTime();
    // Allow end date until 23:59:59
    const endOfDay = end + 24 * 60 * 60 * 1000 - 1;

    if (targetTime >= start && targetTime <= endOfDay) {
      return {
        ...term,
        is_active_by_date: true,
        is_holiday: false,
        status: 'active'
      };
    }
  }

  // 2. If no exact match (school break/holiday), find the nearest upcoming term
  const futureTerms = terms
    .filter(t => t.start_date && new Date(t.start_date).getTime() > targetTime)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  if (futureTerms.length > 0) {
    return {
      ...futureTerms[0],
      is_active_by_date: false,
      is_holiday: true,
      status: 'upcoming'
    };
  }

  // 3. Fallback to latest concluded term or flagged current term
  const flagged = terms.find(t => t.is_current || t.is_active || t.status === 'active');
  if (flagged) return flagged;

  return terms[terms.length - 1];
}

/**
 * Checks whether a specific date falls within a given term.
 */
export function isDateInTerm(term, date = new Date()) {
  if (!term || !term.start_date || !term.end_date) return false;
  const time = new Date(date).getTime();
  const start = new Date(term.start_date).getTime();
  const end = new Date(term.end_date).getTime() + 24 * 60 * 60 * 1000 - 1;
  return time >= start && time <= end;
}

/**
 * Formats a term's display label cleanly (e.g. "Term 3 2026").
 */
export function formatTermName(term) {
  if (!term) return 'Current Term';
  const name = term.name || term.term_name || `Term ${term.term_number || 1}`;
  const cleanName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const year = term.year || (term.start_date ? new Date(term.start_date).getFullYear() : '');
  return year ? `${cleanName} (${year})` : cleanName;
}
