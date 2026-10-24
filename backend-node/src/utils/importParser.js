/**
 * importParser.js
 * Robust pure-JavaScript parser for CSV, TSV, and tabular text (extracted from Excel/PDFs).
 * No external runtime dependencies required.
 */

// Delimiter detection
function detectDelimiter(firstLine) {
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';') && (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length) return ';';
  if (firstLine.includes('|')) return '|';
  return ',';
}

/**
 * Parses RFC-4180 CSV / TSV text into an array of row arrays.
 */
function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.length > 0 && currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Push remainder
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Fallback parser for space-delimited tabular rows (e.g. copied from PDFs)
 */
function parseSpaceDelimited(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map(line => line.split(/\s{2,}|\t/).map(s => s.trim()).filter(Boolean));
}

// Canonical header aliases
const HEADER_ALIASES = {
  // Students
  admission_number: ['admission_number', 'admission_no', 'adm_no', 'adm_number', 'reg_no', 'student_id', 'id_number', 'roll_no'],
  first_name: ['first_name', 'firstname', 'given_name', 'forename'],
  last_name: ['last_name', 'lastname', 'surname', 'family_name'],
  name: ['name', 'full_name', 'student_name', 'staff_name', 'teacher_name'],
  gender: ['gender', 'sex'],
  date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'birthdate'],
  class_name: ['class_name', 'class', 'grade', 'form', 'stream', 'assigned_class', 'class_id'],
  guardian_name: ['guardian_name', 'guardian', 'parent_name', 'parent', 'father_name', 'mother_name', 'next_of_kin'],
  guardian_phone: ['guardian_phone', 'parent_phone', 'guardian_mobile', 'emergency_contact'],
  guardian_email: ['guardian_email', 'parent_email'],

  // Staff / Teachers
  role_title: ['role_title', 'role', 'title', 'designation', 'position', 'job_title'],
  email: ['email', 'email_address', 'mail', 'user_email'],
  phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'contact'],
  subjects: ['subjects', 'subjects_taught', 'teaching_subjects', 'subject'],

  // Subjects
  code: ['code', 'subject_code', 'subj_code', 'course_code'],
  category: ['category', 'department', 'dept', 'learning_area', 'type'],
  level: ['level', 'phase', 'stage']
};

function normalizeHeader(rawHeader) {
  if (!rawHeader) return '';
  const cleaned = String(rawHeader).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(cleaned) || aliases.includes(rawHeader.toLowerCase().trim())) {
      return canonical;
    }
  }
  return cleaned;
}

/**
 * Main parse function
 * Takes raw string input (CSV, TSV, or copy-pasted table text)
 * Returns { headers: string[], rows: object[], rawCount: number }
 */
function parseTableData(rawText) {
  if (!rawText || !rawText.trim()) {
    return { headers: [], rows: [], rawCount: 0 };
  }

  const cleanText = rawText.trim();
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const delimiter = detectDelimiter(firstLine);

  let matrix = parseDelimited(cleanText, delimiter);
  if (matrix.length <= 1 || matrix[0].length === 1) {
    // Attempt multi-space splitting if standard delimiter produced 1 column
    const spaceMatrix = parseSpaceDelimited(cleanText);
    if (spaceMatrix.length > 1 && spaceMatrix[0].length > 1) {
      matrix = spaceMatrix;
    }
  }

  if (matrix.length === 0) {
    return { headers: [], rows: [], rawCount: 0 };
  }

  const rawHeaders = matrix[0];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  const parsedRows = [];
  for (let r = 1; r < matrix.length; r++) {
    const rowCells = matrix[r];
    const rowObj = {};
    let hasData = false;

    for (let c = 0; c < normalizedHeaders.length; c++) {
      const key = normalizedHeaders[c] || `col_${c}`;
      const val = rowCells[c] !== undefined ? String(rowCells[c]).trim() : '';
      if (val) hasData = true;
      rowObj[key] = val;
    }

    if (hasData) {
      // Split full name if first_name / last_name are missing
      if (rowObj.name && !rowObj.first_name) {
        const parts = rowObj.name.split(/\s+/);
        rowObj.first_name = parts[0] || '';
        rowObj.last_name = parts.slice(1).join(' ') || (parts[0] ? 'Student' : '');
      }
      parsedRows.push(rowObj);
    }
  }

  return {
    rawHeaders,
    headers: normalizedHeaders,
    rows: parsedRows,
    rawCount: parsedRows.length
  };
}

module.exports = {
  parseTableData,
  normalizeHeader,
  detectDelimiter
};
