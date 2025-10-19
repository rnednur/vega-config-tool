import type { DataField, FieldType, FieldStats } from '@/types';

/**
 * Infer field types from data rows
 */
export function inferFields(rows: Record<string, any>[]): DataField[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  const first = rows[0] || {};
  return Object.keys(first).map((name) => {
    const sampleValues = rows.slice(0, 100).map((r) => r[name]);
    const inferredType = inferFieldType(sampleValues);
    const stats = calculateFieldStats(sampleValues, inferredType);

    return {
      name,
      inferredType,
      stats,
    };
  });
}

/**
 * Infer the data type of a field from sample values
 */
export function inferFieldType(samples: any[]): FieldType {
  // Filter out null/undefined values
  const validSamples = samples.filter((v) => v != null);

  if (validSamples.length === 0) {
    return 'nominal';
  }

  // Check for numbers
  const nums = validSamples.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (nums.length > validSamples.length * 0.6) {
    return 'quantitative';
  }

  // Check for dates/temporal values
  const dateLike = validSamples.filter((v) => {
    if (v == null) return false;

    // Check if it's a Date object
    if (v instanceof Date) return true;

    // Check if it's a parseable date string
    const s = String(v);
    const t = Date.parse(s);
    return Number.isFinite(t) && /\d{4}[-/]\d{2}[-/]\d{2}/.test(s);
  });

  if (dateLike.length > validSamples.length * 0.6) {
    return 'temporal';
  }

  // Check if ordinal (limited unique values with potential ordering)
  const unique = new Set(validSamples.map(String));
  if (unique.size <= 20 && unique.size < validSamples.length * 0.5) {
    return 'ordinal';
  }

  // Default to nominal
  return 'nominal';
}

/**
 * Calculate statistics for a field
 */
export function calculateFieldStats(values: any[], type: FieldType): FieldStats {
  const validValues = values.filter((v) => v != null);
  const nulls = values.length - validValues.length;

  const stats: FieldStats = {
    nulls,
    unique: new Set(validValues.map(String)).size,
  };

  if (type === 'quantitative') {
    const nums = validValues.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (nums.length > 0) {
      stats.min = Math.min(...nums);
      stats.max = Math.max(...nums);
    }
  }

  // Calculate top values for categorical fields
  if (type === 'nominal' || type === 'ordinal') {
    const counts = new Map<string, number>();
    validValues.forEach((v) => {
      const key = String(v);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    stats.topValues = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  return stats;
}

/**
 * Resolve a field name from user input (fuzzy matching)
 */
export function resolveField(candidate: string, fields: DataField[]): DataField | undefined {
  const lower = candidate.toLowerCase().trim();

  // Exact match (case-sensitive)
  let match = fields.find((f) => f.name === candidate);
  if (match) return match;

  // Case-insensitive match
  match = fields.find((f) => f.name.toLowerCase() === lower);
  if (match) return match;

  // Contains match
  match = fields.find((f) => f.name.toLowerCase().includes(lower));
  if (match) return match;

  // Fuzzy match (simple levenshtein-like)
  const fuzzyMatches = fields
    .map((f) => ({ field: f, distance: levenshteinDistance(lower, f.name.toLowerCase()) }))
    .filter((m) => m.distance <= 3)
    .sort((a, b) => a.distance - b.distance);

  return fuzzyMatches[0]?.field;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
