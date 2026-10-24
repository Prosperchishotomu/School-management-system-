/**
 * Input Normalization Utilities
 * Enforces uniform formatting across all input sources (manual forms, Excel/CSV imports, API payloads)
 * to prevent duplicates caused by casing, extra whitespace, or formatting variations.
 */

function normalizeName(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Handle hyphenated names like Tendai-Rose
      return word
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
    })
    .join(' ');
}

function normalizeEmail(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}


function normalizePhone(str) {
  if (!str) return '';
  const s = String(str).trim().replace(/[\s\-\(\)\.]/g, '');
  if (!s) return '';
  
  // If Zimbabwe local format: 07XXXXXXXX or 024XXXXXXX
  if (s.startsWith('0') && s.length >= 9 && s.length <= 11) {
    return '+263' + s.slice(1);
  }
  
  // If 263 without +
  if (s.startsWith('263') && s.length >= 11) {
    return '+' + s;
  }
  
  // If already starts with +
  if (s.startsWith('+')) {
    return s;
  }
  
  return s;
}


function normalizeCode(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([-/])\s*/g, '$1');
}

function normalizeGender(str) {
  if (!str || typeof str !== 'string') return 'Male';
  const s = str.trim().toLowerCase();
  if (s.startsWith('f')) return 'Female';
  if (s.startsWith('m')) return 'Male';
  return 'Other';
}


function normalizeNationalId(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
}

module.exports = {
  normalizeName,
  normalizeEmail,
  normalizePhone,
  normalizeCode,
  normalizeGender,
  normalizeNationalId,
  normalizeText
};
