/**
 * Polynomische Regression (2. Grades)
 */
import { CONFIG } from './config.js';

/**
 * Berechnet die Koeffizienten für eine polynomische Regression 2. Grades
 * @param {Array} points - Array von Punkten mit Jahr und Note
 * @returns {Object|null} - {a, b, c} für ax² + bx + c = y oder null bei Fehler
 */
export function polynomialRegression(points) {
  const n = points.length;
  if (n < CONFIG.REGRESSION.MIN_POINTS) {
    return null;
  }
  
  const x = points.map(p => Number(p.Jahr));
  const y = points.map(p => Number(p.Note));
  
  // Berechne Summen für Normalgleichungen
  let sumX = 0, sumY = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumXY = 0, sumX2Y = 0;
  
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    const xi2 = xi * xi;
    sumX += xi;
    sumY += yi;
    sumX2 += xi2;
    sumX3 += xi2 * xi;
    sumX4 += xi2 * xi2;
    sumXY += xi * yi;
    sumX2Y += xi2 * yi;
  }
  
  // Normalgleichungen für ax² + bx + c = y:
  // n*c + sumX*b + sumX2*a = sumY
  // sumX*c + sumX2*b + sumX3*a = sumXY
  // sumX2*c + sumX3*b + sumX4*a = sumX2Y
  
  // Löse mit Gauss-Elimination
  const matrix = [
    [n, sumX, sumX2, sumY],
    [sumX, sumX2, sumX3, sumXY],
    [sumX2, sumX3, sumX4, sumX2Y]
  ];
  
  // Forward elimination
  for (let i = 0; i < 2; i++) {
    if (Math.abs(matrix[i][i]) < CONFIG.REGRESSION.SINGULARITY_THRESHOLD) {
      return null; // Singular matrix
    }
    for (let k = i + 1; k < 3; k++) {
      const factor = matrix[k][i] / matrix[i][i];
      for (let j = i; j < 4; j++) {
        matrix[k][j] -= factor * matrix[i][j];
      }
    }
  }
  
  // Back substitution
  if (Math.abs(matrix[2][2]) < CONFIG.REGRESSION.SINGULARITY_THRESHOLD) {
    return null; // Singular matrix
  }
  
  const a = matrix[2][3] / matrix[2][2]; // Koeffizient für x²
  if (Math.abs(matrix[1][1]) < CONFIG.REGRESSION.SINGULARITY_THRESHOLD) {
    return null;
  }
  const b = (matrix[1][3] - matrix[1][2] * a) / matrix[1][1]; // Koeffizient für x
  if (Math.abs(matrix[0][0]) < CONFIG.REGRESSION.SINGULARITY_THRESHOLD) {
    return null;
  }
  const c = (matrix[0][3] - matrix[0][2] * a - matrix[0][1] * b) / matrix[0][0]; // Konstanter Term
  
  // Prüfe auf gültige Werte
  if (!isFinite(a) || !isFinite(b) || !isFinite(c)) {
    return null;
  }
  
  return { a, b, c };
}

/**
 * Generiert Regressionspunkte für eine Band
 * @param {Object} coeffs - Regressionskoeffizienten {a, b, c}
 * @param {Array} rangeYears - Array von Jahren
 * @param {number} firstYear - Erstes Jahr mit Album
 * @param {number} lastYear - Letztes Jahr mit Album
 * @param {number} domainMinY - Minimale Y-Domain
 * @param {number} domainMaxY - Maximale Y-Domain
 * @returns {Array} - Array von Regressionspunkten
 */
export function generateRegressionPoints(coeffs, rangeYears, firstYear, lastYear, domainMinY, domainMaxY) {
  return rangeYears
    .filter(jahr => {
      const jahrNum = Number(jahr);
      return jahrNum >= firstYear && jahrNum <= lastYear;
    })
    .map(jahr => {
      const jahrNum = Number(jahr);
      const note = coeffs.a * jahrNum * jahrNum + coeffs.b * jahrNum + coeffs.c;
      return {
        Jahr: jahr,
        Note: note,
        Band: null // Wird später gesetzt
      };
    })
    .filter(p => {
      return isFinite(p.Note) && p.Note >= domainMinY && p.Note <= domainMaxY;
    });
}
