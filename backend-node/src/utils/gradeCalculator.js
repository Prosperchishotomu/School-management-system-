/**
 * Zimbabwe Assessment & Grading Engine
 * Aligned with §2.4, §2.5, §9 of Zimbabwe School Management Specification
 */

/**
 * ZIMSEC O-Level Grade & Points mapping
 * Points: 1 (A), 2 (B), 3 (C), 4 (D), 5 (E), 6 (U)
 * Pass grade: C or better (points <= 3)
 */
function calculateZimsecOGrade(markPercentage) {
  const mark = parseFloat(markPercentage || 0);
  if (mark >= 75) return { grade: 'A', points: 1, is_pass: true, remark: 'Distinction' };
  if (mark >= 65) return { grade: 'B', points: 2, is_pass: true, remark: 'Merit' };
  if (mark >= 50) return { grade: 'C', points: 3, is_pass: true, remark: 'Credit / Pass' };
  if (mark >= 45) return { grade: 'D', points: 4, is_pass: false, remark: 'Sub-credit' };
  if (mark >= 40) return { grade: 'E', points: 5, is_pass: false, remark: 'Poor' };
  return { grade: 'U', points: 6, is_pass: false, remark: 'Ungraded' };
}

/**
 * ZIMSEC A-Level Grade & Points mapping
 * Supports standard 10-point scale (A=10, B=8, C=6, D=4, E=2, U=0)
 * and alternative 5-point scale (A=5, B=4, C=3, D=2, E=1, U=0)
 */
function calculateZimsecAGrade(markPercentage, scaleType = '10_point') {
  const mark = parseFloat(markPercentage || 0);
  const is10Pt = scaleType === '10_point' || scaleType === 10;

  if (mark >= 70) {
    return { grade: 'A', points: is10Pt ? 10 : 5, is_pass: true, remark: 'Distinction' };
  }
  if (mark >= 60) {
    return { grade: 'B', points: is10Pt ? 8 : 4, is_pass: true, remark: 'Merit' };
  }
  if (mark >= 50) {
    return { grade: 'C', points: is10Pt ? 6 : 3, is_pass: true, remark: 'Credit / Pass' };
  }
  if (mark >= 45) {
    return { grade: 'D', points: is10Pt ? 4 : 2, is_pass: true, remark: 'Subsidiary Pass' };
  }
  if (mark >= 40) {
    return { grade: 'E', points: is10Pt ? 2 : 1, is_pass: true, remark: 'Bare Pass' };
  }
  return { grade: 'U', points: 0, is_pass: false, remark: 'Ungraded' };
}

/**
 * Primary School (Grades 1-7) Percentage & Descriptors
 */
function calculatePrimaryUnits(markPercentage) {
  const mark = parseFloat(markPercentage || 0);
  if (mark >= 80) return { units: 1, grade: '1', descriptor: 'Distinction', is_pass: true };
  if (mark >= 70) return { units: 2, grade: '2', descriptor: 'Merit', is_pass: true };
  if (mark >= 60) return { units: 3, grade: '3', descriptor: 'Credit', is_pass: true };
  if (mark >= 50) return { units: 4, grade: '4', descriptor: 'Satisfactory', is_pass: true };
  if (mark >= 45) return { units: 5, grade: '5', descriptor: 'Marginal Pass', is_pass: true };
  if (mark >= 40) return { units: 6, grade: '6', descriptor: 'Bare Pass', is_pass: true };
  if (mark >= 35) return { units: 7, grade: '7', descriptor: 'Unsatisfactory', is_pass: false };
  if (mark >= 30) return { units: 8, grade: '8', descriptor: 'Poor', is_pass: false };
  return { units: 9, grade: '9', descriptor: 'Very Poor', is_pass: false };
}

/**
 * ECD descriptive competence checklist (no numerical ranks)
 */
function calculateECDCompetence(rating) {
  const map = {
    above_expected: { code: 'AE', label: 'Above expected level', rankable: false },
    at_expected:    { code: 'EE', label: 'At expected level', rankable: false },
    approaching:    { code: 'AP', label: 'Approaching expected level', rankable: false },
    not_yet:        { code: 'NY', label: 'Not yet at expected level', rankable: false }
  };
  return map[rating] || { code: 'EE', label: 'At expected level', rankable: false };
}

/**
 * Calculate Best 6 O-Level Points (Lower points is better in O-Level: A=1, U=6)
 * Enforces mandatory inclusion of configured subjects (e.g. English Language)
 */
function calculateBestOLevelPoints(subjectResults, options = {}) {
  const bestCount = options.best_count || 6;
  const mandatoryCodes = (options.mandatory_subject_codes || ['ENG', 'ENG1', 'ENGLISH']).map(c => c.toUpperCase());

  if (!Array.isArray(subjectResults) || subjectResults.length === 0) {
    return { total_points: 0, subjects_counted: 0, passes_count: 0, passed_mandatory: false };
  }

  // Map each subject result with its points
  const mapped = subjectResults.map(s => {
    const code = String(s.code || s.subject_code || '').toUpperCase();
    const mark = parseFloat(s.mark ?? s.marks_obtained ?? 0);
    const gradInfo = calculateZimsecOGrade(mark);
    const points = s.points !== undefined && s.points !== null ? parseInt(s.points) : gradInfo.points;
    const isPass = s.grade ? ['A', 'B', 'C'].includes(String(s.grade).toUpperCase()) : gradInfo.is_pass;
    return {
      ...s,
      code,
      mark,
      grade: s.grade || gradInfo.grade,
      points,
      is_pass: isPass,
      is_mandatory: mandatoryCodes.includes(code)
    };
  });

  const mandatoryIncluded = [];
  const others = [];

  for (const item of mapped) {
    if (item.is_mandatory && !mandatoryIncluded.some(m => m.code === item.code)) {
      mandatoryIncluded.push(item);
    } else {
      others.push(item);
    }
  }

  // Sort others by points ascending (1 is best, 6 is worst)
  others.sort((a, b) => a.points - b.points);

  const selected = [...mandatoryIncluded];
  const remainingSlots = Math.max(0, bestCount - selected.length);
  selected.push(...others.slice(0, remainingSlots));

  const totalPoints = selected.reduce((sum, item) => sum + item.points, 0);
  const totalPasses = mapped.filter(item => item.is_pass).length;
  const passedMandatory = mandatoryIncluded.length > 0 && mandatoryIncluded.every(m => m.is_pass);

  return {
    total_points: totalPoints,
    subjects_counted: selected.length,
    selected_subjects: selected,
    passes_count: totalPasses,
    meets_form5_entry: totalPasses >= 5 && passedMandatory,
    passed_mandatory: passedMandatory
  };
}

/**
 * Calculate Best 3 A-Level Points (Higher points is better: A=10, B=8, C=6, D=4, E=2, U=0)
 * General Paper is compulsory subsidiary.
 */
function calculateBestALevelPoints(subjectResults, options = {}) {
  const bestCount = options.best_count || 3;
  const scaleType = options.scale_type || '10_point';
  const includeGeneralPaper = options.include_general_paper !== false;

  if (!Array.isArray(subjectResults) || subjectResults.length === 0) {
    return { total_points: 0, subjects_counted: 0, general_paper_passed: false };
  }

  const mapped = subjectResults.map(s => {
    const code = String(s.code || s.subject_code || '').toUpperCase();
    const mark = parseFloat(s.mark ?? s.marks_obtained ?? 0);
    const gradInfo = calculateZimsecAGrade(mark, scaleType);
    const points = s.points !== undefined && s.points !== null ? parseInt(s.points) : gradInfo.points;
    const isGP = code === 'GP' || code === 'GENERAL PAPER' || s.is_subsidiary;
    return {
      ...s,
      code,
      mark,
      grade: s.grade || gradInfo.grade,
      points,
      is_gp: isGP
    };
  });

  const gpSubject = mapped.find(m => m.is_gp);
  const mainSubjects = mapped.filter(m => !m.is_gp);

  // Sort main subjects descending by points (10 is best, 0 is worst)
  mainSubjects.sort((a, b) => b.points - a.points);
  const selected = mainSubjects.slice(0, bestCount);

  let totalPoints = selected.reduce((sum, item) => sum + item.points, 0);

  return {
    total_points: totalPoints,
    subjects_counted: selected.length,
    selected_subjects: selected,
    general_paper: gpSubject || null,
    general_paper_passed: gpSubject ? ['A', 'B', 'C', 'D', 'E'].includes(String(gpSubject.grade).toUpperCase()) : false
  };
}

/**
 * Validate and calculate weighted mark across exam components
 * Enforces SUM(weight_pct) === 100
 */
function computeWeightedTotal(componentsWithMarks) {
  if (!Array.isArray(componentsWithMarks) || componentsWithMarks.length === 0) {
    return { valid: false, error: 'No components provided.', total_mark: 0 };
  }

  const totalWeight = componentsWithMarks.reduce((sum, c) => sum + parseFloat(c.weight_pct || 0), 0);
  if (Math.abs(totalWeight - 100.0) > 0.01) {
    return {
      valid: false,
      error: `Component weights sum to ${totalWeight.toFixed(2)}%, but must equal exactly 100%.`,
      total_mark: 0
    };
  }

  let weightedMark = 0;
  for (const c of componentsWithMarks) {
    const mark = c.is_absent ? 0 : parseFloat(c.mark || 0);
    const maxMarks = parseFloat(c.max_marks || 100.0);
    const weight = parseFloat(c.weight_pct || 0);
    weightedMark += (mark / maxMarks) * weight;
  }

  return {
    valid: true,
    total_weight: totalWeight,
    total_mark: Math.round(weightedMark * 100) / 100
  };
}

module.exports = {
  calculateZimsecOGrade,
  calculateZimsecAGrade,
  calculatePrimaryUnits,
  calculateECDCompetence,
  calculateBestOLevelPoints,
  calculateBestALevelPoints,
  computeWeightedTotal
};
