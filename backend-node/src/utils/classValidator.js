/**
 * Class and Stream Validation Utilities
 * Enforces strict institutional guidelines for Primary, Secondary, High School,
 * Combined/Mixed institutions, and Stream policies (streamed vs unstreamed single-cohorts).
 */

function validateClassForSchool(className, school, streamParam = null) {
  if (!className || typeof className !== 'string') {
    return { valid: false, error: 'Class name cannot be empty.' };
  }
  const clean = className.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  if (lower === 'none' || lower === '-' || lower === 'null' || lower === 'undefined') {
    return { valid: false, error: `Invalid class identifier '${clean}'. A valid grade or form cohort is required.` };
  }

  const schoolType = (school?.school_type || 'secondary').toLowerCase();
  const hasAlevel = Boolean(school?.has_alevel || schoolType === 'high_school' || schoolType === 'a_level');
  const hasStreams = school?.has_streams !== 0 && school?.has_streams !== false;

  const isPrimaryPattern = /^(ecd(\s*[ab])?|grade\s*[1-7]|infant|junior|standard\s*\d)/i.test(lower);
  const isSecondaryPattern = /^(form\s*[1-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b|o[\s-]*level|a[\s-]*level)/i.test(lower);

  // 1. Strict School Type Enforcement (Primary vs Secondary/High School vs Combined)
  if (schoolType === 'primary') {
    if (isSecondaryPattern) {
      return {
        valid: false,
        error: `Cannot register secondary class '${clean}' into Primary School '${school?.name || ''}'. Primary institutions only permit ECD and Grade 1 to Grade 7 cohorts.`
      };
    }
  } else if (schoolType === 'secondary' || schoolType === 'high_school') {
    if (isPrimaryPattern) {
      return {
        valid: false,
        error: `Cannot register primary grade '${clean}' into ${schoolType === 'high_school' ? 'High School' : 'Secondary School'} '${school?.name || ''}'. Primary grades (ECD, Grade 1-7) are strictly prohibited in secondary institutions.`
      };
    }
    if (!hasAlevel && (/form\s*[5-6]|lower\s*6|upper\s*6|\bl6\b|\bu6\b/i.test(lower))) {
      return {
        valid: false,
        error: `Ordinary level secondary schools offer Form 1 to Form 4 only. Form 5 and Form 6 (Advanced Level) '${clean}' are not available for Ordinary Level institutions.`
      };
    }
  }

  // 2. Stream Policy Enforcement (Streams vs Single-Cohort)
  const hasStreamInName = /(?:\s+[a-z]|\s+(east|west|north|south|red|blue|green|yellow|gold|silver|commercials|sciences|arts|humanities|tech))$/i.test(clean) ||
                          /^(form\s*\d[a-z]|grade\s*\d[a-z])/i.test(clean);
  const hasStreamExplicit = Boolean(streamParam && streamParam.trim() && streamParam.trim().toLowerCase() !== 'none');

  if (!hasStreams && (hasStreamInName || hasStreamExplicit)) {
    return {
      valid: false,
      error: `School '${school?.name || ''}' is configured without streams (single-cohort per grade/form). Streamed class '${clean}' is not accepted. Please use standard unstreamed class names (e.g. 'Form 1', 'Grade 7').`
    };
  }

  // Extract canonical grade level and stream
  let gradeLevel = clean;
  let stream = streamParam ? streamParam.trim() : null;
  const match = clean.match(/^(Grade\s*\d+|Form\s*\d+|Lower\s*6|Upper\s*6|ECD\s*[AB])(?:\s+(.+)|([A-Z]))?$/i);
  if (match) {
    gradeLevel = match[1];
    if (!stream) {
      stream = match[2] || match[3] || null;
    }
  }

  const resolvedLevel = isPrimaryPattern
    ? 'Primary'
    : (lower.includes('lower 6') || lower.includes('upper 6') || lower.includes('form 5') || lower.includes('form 6'))
      ? 'High School'
      : 'Secondary';

  return {
    valid: true,
    cleanName: clean,
    gradeLevel,
    stream,
    level: resolvedLevel,
    isSecondary: isSecondaryPattern
  };
}

module.exports = {
  validateClassForSchool
};
