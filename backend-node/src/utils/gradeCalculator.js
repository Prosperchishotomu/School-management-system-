/**
 * Zimbabwe Assessment & Grading Engine
 * Comprehensive grading models:
 * 1. Primary ECD - Grade 3: Total marks sum, descending position ranking.
 * 2. Primary Grade 4 - 7: Max 6 subjects, 1-9 units per subject (total 6 to 54 units), best student scores 6 units (Rank 1), worst scores 54 units.
 * 3. Ordinary Level (Form 1 - 4): No max subjects, symbols A, B, C, D, E, U.
 * 4. Advanced Level (Form 5 - 6 / Lower 6 & Upper 6): No max subjects, 5-point scale: A=5, B=4, C=3, D=2, E=1, O=0, F=0.
 */

/**
 * Primary School (Grades 4-7) Units mapping (1 to 9 units)
 * Range: 1 (best) to 9 (worst)
 */
function calculatePrimaryUnits(markPercentage) {
  const mark = parseFloat(markPercentage || 0);
  if (mark >= 80) return { units: 1, grade: '1', grade_symbol: 'Unit 1', descriptor: 'Distinction', is_pass: true };
  if (mark >= 70) return { units: 2, grade: '2', grade_symbol: 'Unit 2', descriptor: 'Merit', is_pass: true };
  if (mark >= 60) return { units: 3, grade: '3', grade_symbol: 'Unit 3', descriptor: 'Credit', is_pass: true };
  if (mark >= 50) return { units: 4, grade: '4', grade_symbol: 'Unit 4', descriptor: 'Satisfactory', is_pass: true };
  if (mark >= 45) return { units: 5, grade: '5', grade_symbol: 'Unit 5', descriptor: 'Marginal Pass', is_pass: true };
  if (mark >= 40) return { units: 6, grade: '6', grade_symbol: 'Unit 6', descriptor: 'Bare Pass', is_pass: true };
  if (mark >= 35) return { units: 7, grade: '7', grade_symbol: 'Unit 7', descriptor: 'Unsatisfactory', is_pass: false };
  if (mark >= 30) return { units: 8, grade: '8', grade_symbol: 'Unit 8', descriptor: 'Poor', is_pass: false };
  return { units: 9, grade: '9', grade_symbol: 'Unit 9', descriptor: 'Very Poor', is_pass: false };
}

/**
 * ECD to Grade 3 Descriptor mapping
 */
function calculateECDGrade(markPercentage) {
  // In Zimbabwean primary schools, all primary levels use units (1 to 9)
  return calculatePrimaryUnits(markPercentage);
}

/**
 * ZIMSEC O-Level Grade (Symbols: A, B, C, D, E, U)
 * Passes: A, B, C
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
 * ZIMSEC A-Level Grade (5-Point Scale):
 * A = 5 points
 * B = 4 points
 * C = 3 points
 * D = 2 points
 * E = 1 point
 * O = 0 points (Subsidiary)
 * F = 0 points (Fail)
 */
function calculateZimsecAGrade(markPercentage, scaleType = '5_point') {
  const mark = parseFloat(markPercentage || 0);
  const is10Pt = scaleType === '10_point' || scaleType === 10;

  if (mark >= 70) {
    return { grade: 'A', points: is10Pt ? 10 : 5, is_pass: true, remark: 'Distinction' };
  }
  if (mark >= 60) {
    return { grade: 'B', points: is10Pt ? 8 : 4, is_pass: true, remark: 'Merit' };
  }
  if (mark >= 50) {
    return { grade: 'C', points: is10Pt ? 6 : 3, is_pass: true, remark: 'Credit' };
  }
  if (mark >= 45) {
    return { grade: 'D', points: is10Pt ? 4 : 2, is_pass: true, remark: 'Subsidiary Pass' };
  }
  if (mark >= 40) {
    return { grade: 'E', points: is10Pt ? 2 : 1, is_pass: true, remark: 'Pass' };
  }
  if (mark >= 35) {
    return { grade: 'O', points: 0, is_pass: false, remark: 'Subsidiary' };
  }
  return { grade: 'F', points: 0, is_pass: false, remark: 'Fail' };
}

/**
 * Determine Level Category:
 * - 'primary_g4_g7' (Primary school - Units only 1 to 9)
 * - 'o_level' (Secondary Forms 1-4)
 * - 'a_level' (High School Forms 5-6)
 */
function determineLevelCategory(className = '', levelValue = null, schoolType = 'primary') {
  const nameStr = String(className || '').trim().toLowerCase();
  const levelStr = String(levelValue || '').trim().toLowerCase();
  const levelNum = parseInt(levelValue, 10);

  // A-Level detection: Form 5, Form 6, Lower 6, Upper 6, L6, U6
  if (
    /form\s*[5-6]\b|lower\s*6|upper\s*6|\bl6\b|\bu6\b|advanced/i.test(nameStr) ||
    levelNum === 12 || levelNum === 13 || levelNum === 14 || levelNum === 15
  ) {
    return 'a_level';
  }

  // O-Level detection: Form 1 to Form 4
  if (
    /form\s*[1-4]\b|ordinary/i.test(nameStr) ||
    (levelNum >= 8 && levelNum <= 11) ||
    (levelStr.includes('sec') && !/grade/i.test(nameStr))
  ) {
    return 'o_level';
  }

  // All Primary classes (Grade 1 to 7, Primary, ECD) use units only!
  return 'primary_g4_g7';
}

/**
 * Process a single student's subjects according to level category
 */
function processStudentSubjects(rawSubjects = [], levelCategory = 'primary_g4_g7') {
  if (!Array.isArray(rawSubjects)) rawSubjects = [];

  const count = rawSubjects.length;
  if (count === 0) {
    return {
      formattedSubjects: [],
      countedSubjects: [],
      overallPercentage: 0,
      totalUnits: 0,
      totalPoints: 0,
      totalMarks: 0,
      passesCount: 0,
      grade: '—',
      grade_symbol: '—',
      passStatus: 'ungraded'
    };
  }

  let totalMarkSum = 0;

  const formattedSubjects = rawSubjects.map(sub => {
    const avg = parseFloat(sub.subject_avg ?? sub.average ?? sub.mark ?? 0);
    totalMarkSum += avg;

    if (levelCategory === 'primary_g4_g7' || levelCategory === 'ecd_to_g3' || levelCategory === 'primary') {
      const calc = calculatePrimaryUnits(avg);
      return {
        subject_id: sub.subject_id || sub.subject || sub.code,
        subject_name: sub.subject_name || sub.subject || sub.name || 'Subject',
        average: parseFloat(avg.toFixed(1)),
        grade: String(calc.units),
        grade_symbol: `Unit ${calc.units}`,
        units: calc.units,
        descriptor: calc.descriptor,
        is_pass: calc.is_pass
      };
    } else if (levelCategory === 'ecd_to_g3') {
      const calc = calculateECDGrade(avg);
      return {
        subject_id: sub.subject_id || sub.subject || sub.code,
        subject_name: sub.subject_name || sub.subject || sub.name || 'Subject',
        average: parseFloat(avg.toFixed(1)),
        grade: calc.grade,
        descriptor: calc.descriptor,
        is_pass: calc.is_pass
      };
    } else if (levelCategory === 'a_level') {
      const calc = calculateZimsecAGrade(avg, '5_point');
      return {
        subject_id: sub.subject_id || sub.subject || sub.code,
        subject_name: sub.subject_name || sub.subject || sub.name || 'Subject',
        average: parseFloat(avg.toFixed(1)),
        grade: calc.grade,
        points: calc.points,
        remark: calc.remark,
        is_pass: calc.is_pass
      };
    } else {
      // O-Level
      const calc = calculateZimsecOGrade(avg);
      return {
        subject_id: sub.subject_id || sub.subject || sub.code,
        subject_name: sub.subject_name || sub.subject || sub.name || 'Subject',
        average: parseFloat(avg.toFixed(1)),
        grade: calc.grade,
        remark: calc.remark,
        is_pass: calc.is_pass
      };
    }
  });

  const overallPercentage = parseFloat((totalMarkSum / count).toFixed(1));

  if (levelCategory === 'primary_g4_g7' || levelCategory === 'ecd_to_g3' || levelCategory === 'primary') {
    // Sort subjects by units ascending (1 is best, 9 is worst)
    const sortedByUnits = [...formattedSubjects].sort((a, b) => a.units - b.units);
    // Count best subjects (up to 6)
    const bestSubjects = sortedByUnits.slice(0, Math.min(6, sortedByUnits.length));
    const totalUnits = bestSubjects.reduce((acc, s) => acc + s.units, 0);
    const overallUnit = calculatePrimaryUnits(overallPercentage).units;

    return {
      formattedSubjects,
      countedSubjects: bestSubjects,
      overallPercentage,
      totalUnits, // Lower units = better rank (e.g. 6 units is highest distinction)
      totalMarks: parseFloat(totalMarkSum.toFixed(1)),
      passesCount: formattedSubjects.filter(s => s.is_pass).length,
      grade: String(overallUnit),
      grade_symbol: `Unit ${overallUnit}`,
      passStatus: overallUnit <= 6 ? 'pass' : 'fail'
    };
  } else if (levelCategory === 'a_level') {
    // No maximum number of subjects
    const totalPoints = formattedSubjects.reduce((acc, s) => acc + s.points, 0);
    const passesCount = formattedSubjects.filter(s => s.is_pass).length;
    return {
      formattedSubjects,
      countedSubjects: formattedSubjects,
      overallPercentage,
      totalPoints, // A=5, B=4, C=3, D=2, E=1, O=0, F=0
      totalMarks: parseFloat(totalMarkSum.toFixed(1)),
      passesCount,
      grade: calculateZimsecAGrade(overallPercentage, '5_point').grade,
      passStatus: passesCount >= 2 ? 'pass' : 'fail'
    };
  } else {
    // O-Level: No maximum number of subjects
    const passesCount = formattedSubjects.filter(s => s.is_pass).length;
    return {
      formattedSubjects,
      countedSubjects: formattedSubjects,
      overallPercentage,
      totalMarks: parseFloat(totalMarkSum.toFixed(1)),
      passesCount,
      grade: calculateZimsecOGrade(overallPercentage).grade,
      passStatus: passesCount >= 5 ? 'pass' : 'fail'
    };
  }
}


function rankStudentResults(studentList = [], levelCategory = 'primary_g4_g7') {
  const graded = [];
  const ungraded = [];

  studentList.forEach(st => {
    const hasSubjects = Array.isArray(st.subjects) && st.subjects.length > 0;
    const hasMarks = (st.total_marks !== undefined && st.total_marks > 0) || (st.overall_percentage !== undefined && st.overall_percentage > 0);
    if (hasSubjects || hasMarks) {
      graded.push(st);
    } else {
      ungraded.push(st);
    }
  });

  const sortedGraded = [...graded].sort((a, b) => {
    if (levelCategory === 'primary_g4_g7' || levelCategory === 'primary' || levelCategory === 'ecd_to_g3') {
      if (a.total_units !== b.total_units && a.total_units !== undefined && b.total_units !== undefined) {
        return a.total_units - b.total_units; // Ascending: 6 units is best!
      }
      return (b.overall_percentage || 0) - (a.overall_percentage || 0); // Descending % tie-break
    } else if (levelCategory === 'a_level') {
      if (a.total_points !== b.total_points) {
        return (b.total_points || 0) - (a.total_points || 0); // Descending points: highest points is best!
      }
      return (b.overall_percentage || 0) - (a.overall_percentage || 0);
    } else {
      // O-Level
      if (a.overall_percentage !== b.overall_percentage) {
        return (b.overall_percentage || 0) - (a.overall_percentage || 0); // Descending %
      }
      return (b.passes_count || 0) - (a.passes_count || 0);
    }
  });

  const totalGraded = sortedGraded.length;
  sortedGraded.forEach((item, idx) => {
    item.rank = idx + 1;
    item.position = idx + 1;
    item.class_total = totalGraded;
    item.form_rank = idx + 1;
    item.form_total = totalGraded;
  });

  ungraded.forEach(item => {
    item.rank = null;
    item.position = '—';
    item.class_total = totalGraded;
    item.form_rank = null;
    item.form_total = totalGraded;
  });

  return [...sortedGraded, ...ungraded];
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
 * Calculate Best 6 O-Level Points (A=1, B=2, C=3, D=4, E=5, U=6)
 */
function calculateBestOLevelPoints(subjectResults, options = {}) {
  const bestCount = options.best_count || 6;
  const mandatoryCodes = (options.mandatory_subject_codes || ['ENG', 'ENG1', 'ENGLISH']).map(c => c.toUpperCase());

  if (!Array.isArray(subjectResults) || subjectResults.length === 0) {
    return { total_points: 0, subjects_counted: 0, passes_count: 0, passed_mandatory: false };
  }

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
 * Calculate Best 3 A-Level Points (A=5, B=4, C=3, D=2, E=1, O=0, F=0)
 */
function calculateBestALevelPoints(subjectResults, options = {}) {
  const bestCount = options.best_count || 3;
  const scaleType = options.scale_type || '5_point';

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

  mainSubjects.sort((a, b) => b.points - a.points);
  const selected = mainSubjects.slice(0, bestCount);

  const totalPoints = selected.reduce((sum, item) => sum + item.points, 0);

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
  calculateECDGrade,
  calculateECDCompetence,
  determineLevelCategory,
  processStudentSubjects,
  rankStudentResults,
  calculateBestOLevelPoints,
  calculateBestALevelPoints,
  computeWeightedTotal
};
