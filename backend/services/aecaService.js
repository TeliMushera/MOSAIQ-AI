/**
 * MOSAIQ — AECA (Aggregated Evidence Correlation Analysis)
 * ---------------------------------------------------------------------------
 * AECA is the single investigation score shown in the UI.
 *
 * It does NOT invent a new formula. It simply ORGANIZES the two deterministic
 * engines this project already has into one number:
 *
 *   1. forensicRiskEngine.analyzeEvidence()  -> how risky is this ONE record?
 *   2. evidenceCorrelation.findRelatedEvidence() -> how strongly is it
 *                                                   connected to OTHER records?
 *
 * AECA score = 60% risk + 40% connection strength
 *
 *   risk_part       = risk_score                      (0-100, from engine 1)
 *   connection_part = average of the top 3 correlation
 *                     scores for this record          (0-100, from engine 2)
 *
 *   aeca_score = round(0.6 * risk_part + 0.4 * connection_part)
 *
 * Why this split: a record matters in an investigation both because it is
 * suspicious on its own AND because it ties other evidence together. Risk is
 * weighted higher because it is the primary signal; correlation supports it.
 *
 * No AI, no randomness. The same evidence always produces the same score.
 * ---------------------------------------------------------------------------
 */

const { analyzeEvidence } = require("./forensicRiskEngine");
const { findRelatedEvidence } = require("./evidenceCorrelation");

// Weights — kept as named constants so they are easy to point at and explain.
const RISK_WEIGHT = 0.6;
const CONNECTION_WEIGHT = 0.4;

// How many of the strongest connections feed the connection part of the score.
const TOP_CONNECTIONS_USED = 3;

/** AECA level bands — same bands the risk engine uses, applied server-side. */
function aecaLevel(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

/**
 * Average of the top N correlation scores. Returns 0 when nothing is related.
 * Averaging (instead of summing) keeps the value on a clean 0-100 scale.
 */
function connectionStrength(related) {
  if (!related || related.length === 0) return 0;
  const top = related.slice(0, TOP_CONNECTIONS_USED);
  const total = top.reduce((sum, r) => sum + r.correlation_score, 0);
  return Math.round(total / top.length);
}

/**
 * Calculates the AECA score for one evidence record.
 *
 * @param {object}   evidence     – the evidence record to score
 * @param {object[]} caseEvidence – all non-deleted evidence in the same case
 * @returns {{
 *   aeca_score: number,
 *   aeca_level: string,
 *   risk: object,
 *   connection_strength: number,
 *   related_count: number,
 *   related: object[],
 *   breakdown: Array<{ label: string, detail: string, points: number }>,
 *   integrity: { status: string, hash: string }
 * }}
 */
function calculateAECA(evidence, caseEvidence = []) {
  // ---- Part 1: risk of this single record (existing engine, unchanged) -----
  const risk = analyzeEvidence(evidence);

  // ---- Part 2: how connected it is (existing engine, unchanged) -----------
  const related = findRelatedEvidence(evidence, caseEvidence, { limit: 5 });
  const connection = connectionStrength(related);

  // ---- Combine -------------------------------------------------------------
  const riskPoints = Math.round(RISK_WEIGHT * risk.risk_score);
  const connectionPoints = Math.round(CONNECTION_WEIGHT * connection);
  const aeca_score = Math.min(100, riskPoints + connectionPoints);

  // ---- Human-readable breakdown shown under "Show details" ----------------
  const breakdown = [
    {
      label: "Forensic risk",
      detail: `Risk score ${risk.risk_score}/100 (${risk.risk_level}) weighted at ${RISK_WEIGHT * 100}%`,
      points: riskPoints,
    },
    {
      label: "Evidence connections",
      detail:
        related.length > 0
          ? `Average of the ${Math.min(related.length, TOP_CONNECTIONS_USED)} strongest ` +
            `connection${Math.min(related.length, TOP_CONNECTIONS_USED) === 1 ? "" : "s"} ` +
            `is ${connection}/100, weighted at ${CONNECTION_WEIGHT * 100}%`
          : "No related evidence found in this case",
      points: connectionPoints,
    },
  ];

  return {
    evidence_id: evidence.evidence_id,
    case_id: evidence.case_id,
    aeca_score,
    aeca_level: aecaLevel(aeca_score),

    // The two inputs, kept visible so the score is fully explainable
    risk,
    connection_strength: connection,
    related_count: related.length,
    related,

    breakdown,

    integrity: {
      status: evidence.integrity_status || "Unknown",
      hash: evidence.hash_sha256 || "",
    },
  };
}

/**
 * Lightweight AECA for many records at once — used by the investigation map so
 * every node can be coloured by its level without N separate requests.
 *
 * @param {object[]} caseEvidence – all non-deleted evidence in the case
 * @returns {Map<string, { aeca_score: number, aeca_level: string }>} keyed by evidence_id
 */
function calculateCaseAECA(caseEvidence = []) {
  const map = new Map();
  for (const ev of caseEvidence) {
    const { aeca_score, aeca_level } = calculateAECA(ev, caseEvidence);
    map.set(ev.evidence_id, { aeca_score, aeca_level });
  }
  return map;
}

module.exports = {
  calculateAECA,
  calculateCaseAECA,
  aecaLevel,
  RISK_WEIGHT,
  CONNECTION_WEIGHT,
};
