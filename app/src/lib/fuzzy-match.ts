/**
 * Fuzzy organization name matching.
 *
 * Normalizes company names then computes similarity using Levenshtein distance.
 * Designed for MSP use: handles periods, apostrophes, common suffixes (Inc, LLC),
 * and company name variations across different tools.
 *
 * Example matches:
 *   "J.B. Dawson" ↔ "JB Dawson"         → 1.00 (exact after normalization)
 *   "JB Dawson LLC" ↔ "JB Dawson"       → 1.00 (suffix stripped)
 *   "JB Dawson" ↔ "JB Dawson and Sons"  → 0.50 (rejected — below threshold)
 */

/** Normalize a company name for comparison */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "") // "J.B." → "JB"
    .replace(/['']/g, "") // "O'Brien" → "OBrien"
    .replace(/&/g, "and") // "Tom & Jerry" → "Tom and Jerry"
    .replace(
      /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|llp|pllc|lp|group|holdings|enterprises|services|solutions|technologies|technology|tech)\b\.?/gi,
      ""
    )
    .replace(/[^a-z0-9\s]/g, "") // remove remaining punctuation
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/** Levenshtein distance between two strings (O(m*n) time, O(n) space) */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/** Similarity score 0.0–1.0 (1.0 = exact match) */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshtein(a, b) / maxLen;
}

export interface MatchCandidate {
  id: string;
  name: string;
}

export interface MatchResult {
  companyId: string;
  companyName: string;
  score: number;
  isConfident: boolean;
}

const MIN_SIMILARITY = 0.9;
const MIN_GAP_TO_SECOND = 0.1;

/**
 * Find the best match for an external org name against local companies.
 * Returns null if no confident match is found.
 */
export function findBestMatch(
  externalName: string,
  candidates: MatchCandidate[]
): MatchResult | null {
  const normalizedExternal = normalizeName(externalName);
  if (!normalizedExternal) return null;

  const scored = candidates
    .map((c) => ({
      companyId: c.id,
      companyName: c.name,
      normalizedName: normalizeName(c.name),
    }))
    .filter((c) => c.normalizedName.length > 0)
    .map((c) => ({
      ...c,
      score: similarity(normalizedExternal, c.normalizedName),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const best = scored[0];
  if (best.score < MIN_SIMILARITY) return null;

  const secondBest = scored.length > 1 ? scored[1].score : 0;
  const gap = best.score - secondBest;
  const isConfident = gap >= MIN_GAP_TO_SECOND;

  return {
    companyId: best.companyId,
    companyName: best.companyName,
    score: best.score,
    isConfident,
  };
}

/**
 * Batch match: match multiple external orgs against local companies.
 * Returns auto-matched, suggested (not confident), and unmatched orgs.
 */
export function batchMatch(
  externalOrgs: Array<{ id: string; name: string }>,
  candidates: MatchCandidate[]
): {
  matched: Array<{
    externalId: string;
    externalName: string;
    companyId: string;
    companyName: string;
    score: number;
  }>;
  suggested: Array<{
    externalId: string;
    externalName: string;
    companyId: string;
    companyName: string;
    score: number;
  }>;
  unmatched: Array<{ externalId: string; externalName: string }>;
} {
  const matched: Array<{
    externalId: string;
    externalName: string;
    companyId: string;
    companyName: string;
    score: number;
  }> = [];
  const suggested: Array<{
    externalId: string;
    externalName: string;
    companyId: string;
    companyName: string;
    score: number;
  }> = [];
  const unmatched: Array<{ externalId: string; externalName: string }> = [];

  for (const org of externalOrgs) {
    const result = findBestMatch(org.name, candidates);
    if (!result) {
      unmatched.push({ externalId: org.id, externalName: org.name });
    } else if (result.isConfident) {
      matched.push({
        externalId: org.id,
        externalName: org.name,
        companyId: result.companyId,
        companyName: result.companyName,
        score: result.score,
      });
    } else {
      suggested.push({
        externalId: org.id,
        externalName: org.name,
        companyId: result.companyId,
        companyName: result.companyName,
        score: result.score,
      });
    }
  }

  return { matched, suggested, unmatched };
}
