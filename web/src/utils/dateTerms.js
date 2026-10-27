export function getCurrentTerm(dateInput = new Date()) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const month = validDate.getMonth(); // 0 = Jan, 11 = Dec
  const year = validDate.getFullYear();

  let termNumber = 1;
  let termLabel = 'Term 1';

  if (month >= 8) {
    termNumber = 3;
    termLabel = 'Term 3';
  } else if (month >= 4) {
    termNumber = 2;
    termLabel = 'Term 2';
  } else {
    termNumber = 1;
    termLabel = 'Term 1';
  }

  return {
    name: termLabel,
    number: termNumber,
    year: year,
    label: `${termLabel}, ${year}`
  };
}

export function formatTermLabel(termInput) {
  if (!termInput) return 'Term 1';
  if (typeof termInput === 'string') {
    return termInput
      .replace(/_/g, ' ')
      .replace(/\bterm\s*(\d)\b/i, 'Term $1')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  if (typeof termInput === 'object') {
    const raw = termInput.name || termInput.term_name || `Term ${termInput.number || termInput.term_number || 1}`;
    return formatTermLabel(raw);
  }
  return String(termInput);
}

export function formatSchoolDate(dateInput = new Date()) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return validDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
