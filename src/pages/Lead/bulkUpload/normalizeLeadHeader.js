import { BULK_LEAD_FIELDS } from './bulkLeadFields.js';

/**
 * Normalizes a raw column header string:
 * - lowercase & trimmed
 * - replaces underscores, dashes, dots, slashes, colons, brackets with space
 * - collapses repeated spaces
 */
export const normalizeHeader = (header) => {
  if (header == null) return '';
  return String(header)
    .toLowerCase()
    .trim()
    .replace(/[_\-./\\,:;[\]()#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

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

/**
 * Calculates string similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  const s1 = normalizeHeader(str1);
  const s2 = normalizeHeader(str2);
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // Check substring containment
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return minLen / maxLen;
  }

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLen;
}

/**
 * Matches a single header against known application fields using 3 levels:
 * Level 1: Exact normalized match
 * Level 2: Alias match
 * Level 3: Fuzzy matching with confidence score
 */
export const matchHeaderToField = (rawHeader) => {
  const norm = normalizeHeader(rawHeader);
  if (!norm) {
    return { targetFieldKey: null, confidence: 'none', score: 0 };
  }

  // Level 1: Exact key or label match
  for (const [key, fieldDef] of Object.entries(BULK_LEAD_FIELDS)) {
    if (norm === normalizeHeader(key) || norm === normalizeHeader(fieldDef.label)) {
      return { targetFieldKey: key, confidence: 'high', score: 1.0 };
    }
  }

  // Level 2: Exact alias match
  for (const [key, fieldDef] of Object.entries(BULK_LEAD_FIELDS)) {
    for (const alias of fieldDef.aliases) {
      if (norm === normalizeHeader(alias)) {
        return { targetFieldKey: key, confidence: 'high', score: 1.0 };
      }
    }
  }

  // Level 3: Fuzzy & token matching
  let bestFieldKey = null;
  let highestScore = 0;

  for (const [key, fieldDef] of Object.entries(BULK_LEAD_FIELDS)) {
    // Check against label
    const labelScore = calculateSimilarity(norm, fieldDef.label);
    if (labelScore > highestScore) {
      highestScore = labelScore;
      bestFieldKey = key;
    }

    // Check against aliases
    for (const alias of fieldDef.aliases) {
      const aliasScore = calculateSimilarity(norm, alias);
      if (aliasScore > highestScore) {
        highestScore = aliasScore;
        bestFieldKey = key;
      }
    }
  }

  if (highestScore >= 0.85) {
    return { targetFieldKey: bestFieldKey, confidence: 'high', score: highestScore };
  } else if (highestScore >= 0.65) {
    return { targetFieldKey: bestFieldKey, confidence: 'medium', score: highestScore };
  }

  return { targetFieldKey: null, confidence: 'none', score: highestScore };
};

/**
 * Automatically maps a list of headers extracted from a file.
 * Ensures no two headers map to the same field (highest score wins).
 * Returns array of { sourceHeader, targetFieldKey, confidence, score, sampleValues }
 */
export const autoMapHeaders = (rawHeaders, sampleRows = []) => {
  const matches = rawHeaders.map((header) => {
    const sampleValues = sampleRows
      .slice(0, 3)
      .map(row => row[header])
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '');

    const match = matchHeaderToField(header);
    return {
      sourceHeader: header,
      targetFieldKey: match.targetFieldKey,
      confidence: match.confidence,
      score: match.score,
      sampleValues: sampleValues.map(v => String(v).trim())
    };
  });

  // Resolve duplicate mappings: if multiple source headers mapped to same fieldKey,
  // keep the one with highest score and set others to null
  const usedKeys = new Map();
  matches.forEach((item) => {
    if (!item.targetFieldKey) return;
    const existing = usedKeys.get(item.targetFieldKey);
    if (!existing) {
      usedKeys.set(item.targetFieldKey, item);
    } else {
      if (item.score > existing.score) {
        existing.targetFieldKey = null;
        existing.confidence = 'none';
        usedKeys.set(item.targetFieldKey, item);
      } else {
        item.targetFieldKey = null;
        item.confidence = 'none';
      }
    }
  });

  return matches;
};
