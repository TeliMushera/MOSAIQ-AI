/**
 * MOSAIQ Evidence Correlation Service — Batch 4
 *
 * Finds evidence records within the same case that appear related to a
 * selected ("source") evidence record, based on shared observable attributes.
 *
 * This is SEPARATE from the Batch 1 forensic risk score.
 *
 *   Risk Score      = how risky/important is a single evidence record?
 *   Correlation Score = how strongly do TWO evidence records appear related?
 *
 * No AI is used here. The correlation is purely deterministic.
 * Same inputs always produce the same output.
 */

const { analyzeEvidence } = require("./forensicRiskEngine");

// ---------------------------------------------------------------------------
// Correlation scoring weights
// ---------------------------------------------------------------------------
const WEIGHTS = {
  sameAuthor:      30,
  sameDepartment:  15,
  sameSource:      15,
  sameAnomalyType: 20,
  closeTimestamp:  20, // within CLOSE_TIMESTAMP_MINUTES
  samePersonPair:  35, // same two people, either direction (A->B and B->A)
  sameRelatedPerson: 15, // different reporter/owner, but same "other party"
  samePlace:       15,
};

// Two events within this many minutes are considered "close in time"
const CLOSE_TIMESTAMP_MINUTES = 30;

// Maximum number of related evidence items to return
const DEFAULT_RELATED_LIMIT = 5;

// Minimum correlation score to be included in results
const MIN_CORRELATION_SCORE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when both values are non-empty strings and match
 * (case-insensitive, trimmed).
 */
function sameNonEmpty(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * Calculates the absolute time difference in minutes between two evidence
 * records. Returns null if either timestamp is missing/invalid.
 */
function timeDiffMinutes(tsA, tsB) {
  if (!tsA || !tsB) return null;
  const a = new Date(tsA).getTime();
  const b = new Date(tsB).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.abs(a - b) / 60000;
}

// ---------------------------------------------------------------------------
// Core correlation scorer
// ---------------------------------------------------------------------------

/**
 * Compares two evidence documents and returns a correlation score + reasons.
 *
 * @param {object} source  – the evidence the investigator is looking at
 * @param {object} other   – a candidate evidence record from the same case
 * @returns {{ correlation_score: number, reasons: string[] }}
 */
function scoreCorrelation(source, other) {
  let score = 0;
  const reasons = [];

  // 1. Same author
  if (sameNonEmpty(source.author, other.author)) {
    score += WEIGHTS.sameAuthor;
    reasons.push(`Same author: "${other.author}"`);
  }

  // 2. Same department
  if (sameNonEmpty(source.department, other.department)) {
    score += WEIGHTS.sameDepartment;
    reasons.push(`Same department: "${other.department}"`);
  }

  // 3. Same source
  if (sameNonEmpty(source.source, other.source)) {
    score += WEIGHTS.sameSource;
    reasons.push(`Same source: "${other.source}"`);
  }

  // 4. Same anomaly type (only when both are non-Normal — avoids flooding
  //    normal/routine records as "related" just because they share "Normal")
  const srcAnomaly = (source.anomaly_type || "").trim().toLowerCase();
  const othAnomaly = (other.anomaly_type || "").trim().toLowerCase();
  if (
    srcAnomaly &&
    othAnomaly &&
    srcAnomaly !== "normal" &&
    srcAnomaly === othAnomaly
  ) {
    score += WEIGHTS.sameAnomalyType;
    reasons.push(`Same anomaly type: "${other.anomaly_type}"`);
  }

  // 5. Close timestamp
  const diffMin = timeDiffMinutes(source.timestamp, other.timestamp);
  if (diffMin !== null && diffMin <= CLOSE_TIMESTAMP_MINUTES) {
    score += WEIGHTS.closeTimestamp;
    const minLabel = Math.round(diffMin);
    reasons.push(
      minLabel === 0
        ? "Events occurred at the same time"
        : `Events occurred within ${minLabel} minute${minLabel === 1 ? "" : "s"} of each other`
    );
  }

  // 6. Same pair of people, either direction — this is the strongest signal
  //    for the person-centric evidence model (person/related_person). Two
  //    records about "Dev -> Maya" and "Maya -> Dev" are the same exchange
  //    seen from both sides (e.g. two phones extracting the same thread),
  //    so this fires regardless of which side is "source" vs "related".
  const srcPerson = (source.person || source.author || "").trim().toLowerCase();
  const srcRelated = (source.related_person || "").trim().toLowerCase();
  const othPerson = (other.person || other.author || "").trim().toLowerCase();
  const othRelated = (other.related_person || "").trim().toLowerCase();

  const srcPair = [srcPerson, srcRelated].filter(Boolean).sort().join("||");
  const othPair = [othPerson, othRelated].filter(Boolean).sort().join("||");

  if (srcPair && srcRelated && othRelated && srcPair === othPair) {
    score += WEIGHTS.samePersonPair;
    reasons.push(`Same two people: "${source.person || source.author}" and "${srcRelated}"`);
  } else if (
    // 7. Same "other party" even when the owner differs — e.g. two different
    //    witnesses whose evidence both point at the same person of interest.
    srcRelated &&
    othRelated &&
    srcRelated === othRelated &&
    srcPerson !== othPerson
  ) {
    score += WEIGHTS.sameRelatedPerson;
    reasons.push(`Both concern: "${source.related_person}"`);
  }

  // 8. Same place
  if (sameNonEmpty(source.place, other.place)) {
    score += WEIGHTS.samePlace;
    reasons.push(`Same place: "${other.place}"`);
  }

  return {
    correlation_score: Math.min(score, 100),
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Finds the most strongly correlated evidence records for a given source
 * evidence item within the same case.
 *
 * @param {object}   sourceEvidence  – the MongoDB evidence document to correlate against
 * @param {object[]} caseEvidence    – all non-deleted evidence for the case (from MongoDB .lean())
 * @param {object}   [options]
 * @param {number}   [options.limit] – max results to return (default: DEFAULT_RELATED_LIMIT)
 * @returns {object[]} sorted array of related evidence with scores and reasons
 */
function findRelatedEvidence(sourceEvidence, caseEvidence, { limit = DEFAULT_RELATED_LIMIT } = {}) {
  if (!sourceEvidence || !caseEvidence || caseEvidence.length === 0) return [];

  const results = [];

  for (const candidate of caseEvidence) {
    // Skip the source record itself
    if (candidate.evidence_id === sourceEvidence.evidence_id) continue;

    const { correlation_score, reasons } = scoreCorrelation(sourceEvidence, candidate);

    if (correlation_score < MIN_CORRELATION_SCORE || reasons.length === 0) continue;

    // Include the Batch 1 risk score of the candidate for context
    const { risk_score, risk_level } = analyzeEvidence(candidate);

    results.push({
      evidence_id: candidate.evidence_id,
      file_name: candidate.file_name,
      file_type: candidate.file_type,
      author: candidate.author,
      department: candidate.department,
      source: candidate.source,
      anomaly_type: candidate.anomaly_type,
      severity: candidate.severity,
      timestamp: candidate.timestamp,
      risk_score,
      risk_level,
      correlation_score,
      reasons,
    });
  }

  // Sort: highest correlation first; ties broken by earliest timestamp (deterministic)
  results.sort((a, b) => {
    if (b.correlation_score !== a.correlation_score) {
      return b.correlation_score - a.correlation_score;
    }
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });

  return results.slice(0, limit);
}

module.exports = {
  findRelatedEvidence,
  scoreCorrelation,
  CLOSE_TIMESTAMP_MINUTES,
  DEFAULT_RELATED_LIMIT,
};
