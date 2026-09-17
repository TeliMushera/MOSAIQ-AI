/**
 * MOSAIQ Statistics Service
 *
 * Batch 1: getDashboardStats, getCaseStatistics (existing — unchanged), getCaseOverviewStats
 * Batch 2+3: getCaseStatistics extended with suspicious-window analysis and full analytics
 *
 * All statistics are derived from live MongoDB data.
 * No hardcoded values. No fake data.
 */

const Evidence = require("../models/Evidence");
const Case = require("../models/Case");
const { analyzeEvidence } = require("./forensicRiskEngine");

// ---------------------------------------------------------------------------
// Batch 2 — Suspicious Activity Window detector
// ---------------------------------------------------------------------------
// Events separated by more than this many minutes start a new window.
const SUSPICIOUS_WINDOW_GAP_MINUTES = 30;

/**
 * Groups an array of suspicious evidence records (sorted by timestamp) into
 * activity windows. Two consecutive events belong to the same window if the
 * gap between them is <= SUSPICIOUS_WINDOW_GAP_MINUTES.
 *
 * Each window uses the existing forensicRiskEngine to determine the
 * highest-risk event inside it.
 *
 * @param {object[]} suspiciousRecords – evidence docs with anomaly_type != "Normal",
 *                                       sorted ascending by timestamp.
 * @returns {object[]} array of window objects.
 */
function buildSuspiciousWindows(suspiciousRecords) {
  if (!suspiciousRecords || suspiciousRecords.length === 0) return [];

  const windows = [];
  let currentWindow = null;

  for (const ev of suspiciousRecords) {
    const ts = ev.timestamp ? new Date(ev.timestamp).getTime() : null;
    if (!ts || isNaN(ts)) continue; // skip malformed timestamps

    if (!currentWindow) {
      // Start first window
      currentWindow = {
        _events: [ev],
        _startMs: ts,
        _endMs: ts,
      };
    } else {
      const gapMinutes = (ts - currentWindow._endMs) / 60000;
      if (gapMinutes <= SUSPICIOUS_WINDOW_GAP_MINUTES) {
        // Extend current window
        currentWindow._events.push(ev);
        currentWindow._endMs = ts;
      } else {
        // Close the current window and start a new one
        windows.push(finalizeWindow(currentWindow));
        currentWindow = {
          _events: [ev],
          _startMs: ts,
          _endMs: ts,
        };
      }
    }
  }

  if (currentWindow) windows.push(finalizeWindow(currentWindow));
  return windows;
}

/**
 * Converts a raw window object (with _events, _startMs, _endMs) into the
 * public window shape used by the API and frontend.
 */
function finalizeWindow(raw) {
  const durationMinutes = Math.round((raw._endMs - raw._startMs) / 60000);
  let highestScore = 0;
  let highestLevel = "Low";

  for (const ev of raw._events) {
    const { risk_score, risk_level } = analyzeEvidence(ev);
    if (risk_score > highestScore) {
      highestScore = risk_score;
      highestLevel = risk_level;
    }
  }

  return {
    start_time: new Date(raw._startMs).toISOString(),
    end_time: new Date(raw._endMs).toISOString(),
    duration_minutes: durationMinutes,
    event_count: raw._events.length,
    suspicious_event_count: raw._events.length,
    highest_risk_score: highestScore,
    risk_level: highestLevel,
    event_ids: raw._events.map((e) => e.evidence_id),
  };
}

// ---------------------------------------------------------------------------
// Batch 1 — Dashboard stats (unchanged)
// ---------------------------------------------------------------------------
async function getDashboardStats() {
  const [totalCases, totalEvidence, processedEvidence, verifiedEvidence] = await Promise.all([
    Case.countDocuments({ isDeleted: false }),
    Evidence.countDocuments({ isDeleted: false }),
    Evidence.countDocuments({ isDeleted: false, processing_status: "Completed" }),
    Evidence.countDocuments({ isDeleted: false, integrity_status: "Verified" }),
  ]);

  return { totalCases, totalEvidence, processedEvidence, verifiedEvidence };
}

// ---------------------------------------------------------------------------
// Batch 1+2+3 — Full case investigation statistics
// ---------------------------------------------------------------------------
/**
 * Returns ALL case investigation statistics for the CaseInvestigation page.
 *
 * Existing fields (preserved exactly — CaseInvestigation.jsx depends on them):
 *   totalEvents, suspiciousEvents, normalEvents, users, evidenceSources,
 *   verifiedEvidence, byType, bySeverity, byAnomalyType, timeline
 *
 * New Batch 2 fields:
 *   criticalEvents, suspiciousWindows, suspiciousWindowCount,
 *   longestSuspiciousWindow, peakSuspiciousTime, timelineRisk,
 *   riskDistribution, investigationSummary
 *
 * New Batch 3 fields:
 *   byIntegrity, byAuthor, byDepartment, bySource
 *   (timeline is extended with suspicious_count per day)
 */
async function getCaseStatistics(caseId) {
  const match = { case_id: caseId, isDeleted: false };

  // ---- Run all MongoDB aggregations in parallel ----
  const [
    byTypeRaw,
    bySeverityRaw,
    byAnomalyRaw,
    byIntegrityRaw,
    byAuthorRaw,
    byDepartmentRaw,
    bySourceRaw,
    timelineRaw,
    totals,
  ] = await Promise.all([
    // Evidence type distribution (Batch 3)
    Evidence.aggregate([{ $match: match }, { $group: { _id: "$file_type", count: { $sum: 1 } } }]),
    // Severity distribution (Batch 3)
    Evidence.aggregate([{ $match: match }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    // Anomaly type distribution (Batch 3)
    Evidence.aggregate([{ $match: match }, { $group: { _id: "$anomaly_type", count: { $sum: 1 } } }]),
    // Integrity distribution (Batch 3)
    Evidence.aggregate([{ $match: match }, { $group: { _id: "$integrity_status", count: { $sum: 1 } } }]),
    // Author activity — top 20 (Batch 3)
    Evidence.aggregate([
      { $match: match },
      { $group: { _id: "$author", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    // Department activity (Batch 3)
    Evidence.aggregate([
      { $match: match },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    // Source activity (Batch 3)
    Evidence.aggregate([
      { $match: match },
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    // Timeline: events per day + suspicious events per day (extends Batch 1 timeline)
    Evidence.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 },
          suspicious_count: {
            $sum: {
              $cond: [{ $ne: ["$anomaly_type", "Normal"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // Global totals (Batch 1)
    Evidence.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          users: { $addToSet: "$author" },
          sources: { $addToSet: "$source" },
          verified: {
            $sum: { $cond: [{ $eq: ["$integrity_status", "Verified"] }, 1, 0] },
          },
          suspicious: {
            $sum: { $cond: [{ $ne: ["$anomaly_type", "Normal"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  // ---- Helper: array of {_id, count} → plain object map ----
  const toMap = (rows) =>
    rows.reduce((acc, r) => {
      if (r._id || r._id === 0) acc[r._id] = r.count;
      return acc;
    }, {});

  const t = totals[0] || { total: 0, users: [], sources: [], verified: 0, suspicious: 0 };

  // ---- Batch 2+3: risk engine pass — fetch all evidence for in-memory processing ----
  // One query for all case evidence (sorted by timestamp for window detection)
  const allEvidence = await Evidence.find(match).sort({ timestamp: 1 }).lean();

  // Run the existing forensic risk engine on every evidence record
  const riskResults = allEvidence.map((ev) => ({
    ...analyzeEvidence(ev),
    evidence_id: ev.evidence_id,
    anomaly_type: ev.anomaly_type,
    timestamp: ev.timestamp,
  }));

  // ---- Risk distribution (Batch 3) ----
  const riskDistribution = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  let totalRiskScore = 0;
  let highestScore = 0;
  let highestLevel = "Low";

  for (const r of riskResults) {
    riskDistribution[r.risk_level] = (riskDistribution[r.risk_level] || 0) + 1;
    totalRiskScore += r.risk_score;
    if (r.risk_score > highestScore) {
      highestScore = r.risk_score;
      highestLevel = r.risk_level;
    }
  }

  const avgScore =
    riskResults.length > 0 ? Math.round(totalRiskScore / riskResults.length) : 0;

  // ---- Critical events (Batch 2) — based on risk_level from the engine ----
  const criticalEvents = riskDistribution.Critical || 0;

  // ---- Suspicious activity windows (Batch 2) ----
  const suspiciousRecords = allEvidence.filter(
    (ev) => ev.anomaly_type && ev.anomaly_type.toLowerCase() !== "normal"
  );
  const suspiciousWindows = buildSuspiciousWindows(suspiciousRecords);
  const suspiciousWindowCount = suspiciousWindows.length;

  // ---- Longest suspicious window (Batch 2) ----
  let longestSuspiciousWindow = null;
  if (suspiciousWindows.length > 0) {
    longestSuspiciousWindow = suspiciousWindows.reduce((longest, w) =>
      w.duration_minutes > longest.duration_minutes ? w : longest
    );
  }

  // ---- Peak suspicious activity (Batch 2) ----
  // Group suspicious events by day; find the day with the most suspicious events
  let peakSuspiciousTime = null;
  if (suspiciousRecords.length > 0) {
    const dayCounts = {};
    for (const ev of suspiciousRecords) {
      if (!ev.timestamp) continue;
      const day = new Date(ev.timestamp).toISOString().slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    // Pick the day with the highest count; ties broken by earliest date (deterministic)
    const peakDay = Object.entries(dayCounts).sort((a, b) =>
      b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])
    )[0];
    if (peakDay) {
      peakSuspiciousTime = {
        timestamp: peakDay[0],
        suspicious_event_count: peakDay[1],
      };
    }
  }

  // ---- Timeline risk (Batch 2) ----
  const timelineRisk = {
    highest_score: highestScore,
    highest_level: highestLevel,
    average_score: avgScore,
  };

  // ---- Build the extended timeline with suspicious_count (Batch 3) ----
  // Keep backward-compatible [MM-DD, count] pairs AND add the richer format
  const timelineCompact = timelineRaw.map((r) => [r._id.slice(5), r.count]); // existing shape
  const timelineDetailed = timelineRaw.map((r) => ({
    date: r._id,
    count: r.count,
    suspicious_count: r.suspicious_count || 0,
  }));

  // ---- Author / department / source arrays (Batch 3) ----
  const byAuthor = byAuthorRaw
    .filter((r) => r._id) // skip null/empty authors
    .map((r) => ({ author: r._id, count: r.count }));

  const byDepartment = byDepartmentRaw
    .filter((r) => r._id)
    .map((r) => ({ department: r._id, count: r.count }));

  const bySource = bySourceRaw
    .filter((r) => r._id)
    .map((r) => ({ source: r._id, count: r.count }));

  // ---- Investigation summary (Batch 3) ----
  const investigationSummary = {
    totalEvidence: t.total,
    suspiciousEvents: t.suspicious,
    normalEvents: t.total - t.suspicious,
    criticalEvents,
    highestRiskScore: highestScore,
    highestRiskLevel: highestLevel,
    suspiciousWindowCount,
  };

  // ---- Return full response (existing fields preserved, new fields added) ----
  return {
    // ---- Existing Batch 1 fields (DO NOT remove — frontend depends on them) ----
    totalEvents: t.total,
    suspiciousEvents: t.suspicious,
    normalEvents: t.total - t.suspicious,
    users: t.users.length,
    evidenceSources: t.sources.length,
    verifiedEvidence: t.verified,
    byType: toMap(byTypeRaw),
    bySeverity: toMap(bySeverityRaw),
    byAnomalyType: toMap(byAnomalyRaw),
    timeline: timelineCompact, // existing [MM-DD, count] shape used by CaseInvestigation.jsx

    // ---- New Batch 3 distributions ----
    byIntegrity: toMap(byIntegrityRaw),
    byAuthor,
    byDepartment,
    bySource,
    timelineDetailed, // richer timeline for new frontend sections

    // ---- New Batch 2+3 risk fields ----
    riskDistribution,
    criticalEvents,
    timelineRisk,

    // ---- New Batch 2 suspicious window fields ----
    suspiciousWindows,
    suspiciousWindowCount,
    longestSuspiciousWindow,
    peakSuspiciousTime,

    // ---- New Batch 3 investigation summary ----
    investigationSummary,
  };
}

// ---------------------------------------------------------------------------
// Batch 1 — Case overview stats (unchanged)
// ---------------------------------------------------------------------------
async function getCaseOverviewStats(caseId) {
  const match = { case_id: caseId, isDeleted: false };
  const [byType, verifiedCount, totalCount, recent] = await Promise.all([
    Evidence.aggregate([{ $match: match }, { $group: { _id: "$file_type", count: { $sum: 1 } } }]),
    Evidence.countDocuments({ ...match, integrity_status: "Verified" }),
    Evidence.countDocuments(match),
    Evidence.find(match).sort({ timestamp: -1 }).limit(6).lean(),
  ]);

  const typeMap = byType.reduce((acc, r) => {
    acc[r._id || "Unknown"] = r.count;
    return acc;
  }, {});

  return {
    totalEvidence: totalCount,
    byType: typeMap,
    verifiedEvidence: verifiedCount,
    recentEvidence: recent,
  };
}

module.exports = { getDashboardStats, getCaseStatistics, getCaseOverviewStats };
