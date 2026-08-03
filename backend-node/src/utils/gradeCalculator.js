function calculatePrimaryUnits(markPercentage) {
  const mark = parseFloat(markPercentage || 0);
  if (mark >= 80) return { units: 1, grade: '1' };
  if (mark >= 70) return { units: 2, grade: '2' };
  if (mark >= 60) return { units: 3, grade: '3' };
  if (mark >= 50) return { units: 4, grade: '4' };
  if (mark >= 45) return { units: 5, grade: '5' };
  if (mark >= 40) return { units: 6, grade: '6' };
  if (mark >= 35) return { units: 7, grade: '7' };
  if (mark >= 30) return { units: 8, grade: '8' };
  return { units: 9, grade: '9' };
}

function calculateALevelPoints(markPercentage) {
  const mark = parseFloat(markPercentage || 0);
  if (mark >= 80) return { points: 5, grade: 'A' };
  if (mark >= 70) return { points: 4, grade: 'B' };
  if (mark >= 60) return { points: 3, grade: 'C' };
  if (mark >= 50) return { points: 2, grade: 'D' };
  if (mark >= 40) return { points: 1, grade: 'E' };
  if (mark >= 35) return { points: 0, grade: 'O' };
  return { points: 0, grade: 'F' };
}

module.exports = {
  calculatePrimaryUnits,
  calculateALevelPoints
};
