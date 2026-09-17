/**
 * MOSAIQ Forensic Risk Engine — Batch 1
 *
 * Calculates a deterministic, explainable forensic risk score from an
 * existing Evidence document. Receives a plain evidence object (from
 * Mongoose .lean() or a full document) and returns:
 *
 *   { risk_score, risk_level, reasons }
 *
 * No external API calls. No randomness. No fabricated data.
 * The same input always produces the same output.
 */

// ---------------------------------------------------------------------------
// Scoring tables
// ---------------------------------------------------------------------------

const SEVERITY_SCORES = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
};

const ANOMALY_SCORE = 25; // applied when anomaly_type !== "Normal" (and is non-empty)

const INTEGRITY_ISSUE_SCORE = 25; // applied when integrity_status is NOT "Verified"

const MAX_SCORE = 100;

// ---------------------------------------------------------------------------
// Risk level bands (applied server-side, never hardcoded on the client)
// ---------------------------------------------------------------------------

function riskLevel(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * @param {object} evidence – a MongoDB Evidence document (lean or full).
 * @returns {{ risk_score: number, risk_level: string, reasons: string[] }}
 */
function analyzeEvidence(evidence) {
  let score = 0;
  const reasons = [];

  // ---- 1. SEVERITY --------------------------------------------------------
  const rawSeverity = (evidence.severity || "").trim().toLowerCase();
  const severityPoints = SEVERITY_SCORES[rawSeverity] ?? 0;

  if (severityPoints > 0) {
    // Display the original (title-cased) value in the reason string.
    const displaySeverity =
      rawSeverity.charAt(0).toUpperCase() + rawSeverity.slice(1);
    score += severityPoints;
    reasons.push(`${displaySeverity} severity (+${severityPoints})`);
  }

  // ---- 2. ANOMALY ---------------------------------------------------------
  const rawAnomaly = (evidence.anomaly_type || "").trim();
  const isAnomalous =
    rawAnomaly !== "" && rawAnomaly.toLowerCase() !== "normal";

  if (isAnomalous) {
    score += ANOMALY_SCORE;
    reasons.push(`Suspicious anomaly detected: "${rawAnomaly}" (+${ANOMALY_SCORE})`);
  }

  // ---- 3. INTEGRITY -------------------------------------------------------
  const rawIntegrity = (evidence.integrity_status || "").trim().toLowerCase();
  const hasIntegrityIssue =
    rawIntegrity !== "" && rawIntegrity !== "verified";

  if (hasIntegrityIssue) {
    score += INTEGRITY_ISSUE_SCORE;
    const displayIntegrity =
      evidence.integrity_status.trim();
    reasons.push(
      `Integrity issue detected: status is "${displayIntegrity}" (+${INTEGRITY_ISSUE_SCORE})`
    );
  }

  // ---- Cap & finalise -----------------------------------------------------
  score = Math.min(score, MAX_SCORE);

  if (reasons.length === 0) {
    reasons.push("No significant forensic risk indicators detected");
  }

  return {
    risk_score: score,
    risk_level: riskLevel(score),
    reasons,
  };
}

module.exports = { analyzeEvidence };
