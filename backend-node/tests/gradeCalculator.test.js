const {
  calculateZimsecOGrade,
  calculateZimsecAGrade,
  calculatePrimaryUnits,
  calculateECDCompetence,
  calculateBestOLevelPoints,
  calculateBestALevelPoints,
  computeWeightedTotal
} = require('../src/utils/gradeCalculator');

describe('Zimbabwe Assessment & Points Engine', () => {
  describe('ZIMSEC O-Level Grade & Points', () => {
    test('maps marks to A-U grades and 1-6 points', () => {
      expect(calculateZimsecOGrade(85)).toEqual({ grade: 'A', points: 1, is_pass: true, remark: 'Distinction' });
      expect(calculateZimsecOGrade(68)).toEqual({ grade: 'B', points: 2, is_pass: true, remark: 'Merit' });
      expect(calculateZimsecOGrade(52)).toEqual({ grade: 'C', points: 3, is_pass: true, remark: 'Credit / Pass' });
      expect(calculateZimsecOGrade(46)).toEqual({ grade: 'D', points: 4, is_pass: false, remark: 'Sub-credit' });
      expect(calculateZimsecOGrade(42)).toEqual({ grade: 'E', points: 5, is_pass: false, remark: 'Poor' });
      expect(calculateZimsecOGrade(30)).toEqual({ grade: 'U', points: 6, is_pass: false, remark: 'Ungraded' });
    });

    test('computes Best-6 O-Level points with mandatory English', () => {
      const results = [
        { code: 'ENG', mark: 76 },  // A (1) -> mandatory
        { code: 'MATH', mark: 80 }, // A (1)
        { code: 'SCI', mark: 67 },  // B (2)
        { code: 'HIST', mark: 55 }, // C (3)
        { code: 'GEO', mark: 52 },  // C (3)
        { code: 'COMM', mark: 66 }, // B (2)
        { code: 'SHONA', mark: 48 }, // D (4) - excluded
        { code: 'AGRI', mark: 41 }   // E (5) - excluded
      ];

      const calculation = calculateBestOLevelPoints(results, { best_count: 6, mandatory_subject_codes: ['ENG'] });
      expect(calculation.subjects_counted).toBe(6);
      expect(calculation.total_points).toBe(1 + 1 + 2 + 2 + 3 + 3); // 12 points
      expect(calculation.passes_count).toBe(6);
      expect(calculation.meets_form5_entry).toBe(true);
      expect(calculation.passed_mandatory).toBe(true);
    });
  });

  describe('ZIMSEC A-Level Grade & 10-Point Scale', () => {
    test('maps A-Level marks on 10-point scale', () => {
      expect(calculateZimsecAGrade(78, '10_point')).toEqual({ grade: 'A', points: 10, is_pass: true, remark: 'Distinction' });
      expect(calculateZimsecAGrade(62, '10_point')).toEqual({ grade: 'B', points: 8, is_pass: true, remark: 'Merit' });
      expect(calculateZimsecAGrade(54, '10_point')).toEqual({ grade: 'C', points: 6, is_pass: true, remark: 'Credit / Pass' });
      expect(calculateZimsecAGrade(47, '10_point')).toEqual({ grade: 'D', points: 4, is_pass: true, remark: 'Subsidiary Pass' });
      expect(calculateZimsecAGrade(41, '10_point')).toEqual({ grade: 'E', points: 2, is_pass: true, remark: 'Bare Pass' });
      expect(calculateZimsecAGrade(25, '10_point')).toEqual({ grade: 'U', points: 0, is_pass: false, remark: 'Ungraded' });
    });

    test('computes Best-3 A-Level points with General Paper subsidiary', () => {
      const results = [
        { code: 'MATH', mark: 75 }, // A (10)
        { code: 'PHYS', mark: 65 }, // B (8)
        { code: 'CHEM', mark: 58 }, // C (6)
        { code: 'COMP', mark: 45 }, // D (4) - excluded from best 3
        { code: 'GP', mark: 60 }    // General Paper subsidiary
      ];

      const calculation = calculateBestALevelPoints(results, { best_count: 3, scale_type: '10_point' });
      expect(calculation.subjects_counted).toBe(3);
      expect(calculation.total_points).toBe(10 + 8 + 6); // 24 points
      expect(calculation.general_paper_passed).toBe(true);
    });
  });

  describe('ECD Checklist Assessment', () => {
    test('ensures ECD results are unranked and descriptive', () => {
      const result = calculateECDCompetence('at_expected');
      expect(result.rankable).toBe(false);
      expect(result.label).toBe('At expected level');
    });
  });

  describe('CA Component Weight Verification', () => {
    test('rejects component weights not summing to 100', () => {
      const components = [
        { name: 'Tests', weight_pct: 20, max_marks: 50, mark: 40 },
        { name: 'Project', weight_pct: 30, max_marks: 100, mark: 80 }
      ]; // Sum = 50%
      const res = computeWeightedTotal(components);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/must equal exactly 100%/i);
    });

    test('correctly calculates weighted mark when weights sum to 100', () => {
      const components = [
        { name: 'Tests', weight_pct: 20, max_marks: 50, mark: 40 },       // (40/50)*20 = 16
        { name: 'Project/SBA', weight_pct: 30, max_marks: 100, mark: 90 }, // (90/100)*30 = 27
        { name: 'Exam', weight_pct: 50, max_marks: 100, mark: 80 }         // (80/100)*50 = 40
      ]; // Sum = 100%
      const res = computeWeightedTotal(components);
      expect(res.valid).toBe(true);
      expect(res.total_mark).toBe(16 + 27 + 40); // 83
    });
  });
});
