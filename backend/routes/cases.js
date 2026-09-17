const express = require("express");
const Case = require("../models/Case");
const Evidence = require("../models/Evidence");
const { asyncHandler } = require("../middleware/errorHandler");
const { getCaseStatistics, getCaseOverviewStats } = require("../services/statisticsService");
const { analyzeEvidence } = require("../services/forensicRiskEngine");
const { buildInvestigationGraph } = require("../services/investigationGraph");
const { buildEvidenceQuery, buildSort, paginate } = require("./_evidenceQuery");

const router = express.Router();

async function nextCaseId() {
  const last = await Case.find({}).sort({ case_id: -1 }).limit(1).lean();
  let nextNum = 1;
  if (last.length > 0) {
    const match = last[0].case_id.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `CASE-${String(nextNum).padStart(3, "0")}`;
}

// GET /api/cases  -> all non-deleted cases, with live evidence_count
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const cases = await Case.find({ isDeleted: false }).sort({ created_at: -1 }).lean();
    const counts = await Evidence.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$case_id", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    const enriched = cases.map((c) => ({ ...c, evidence_count: countMap[c.case_id] ?? c.evidence_count }));
    res.json(enriched);
  })
);

// POST /api/cases -> create a case
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      case_name,
      case_type,
      description,
      lead,
      status,
      opened,
      people,
      incident_date,
      incident_location,
    } = req.body;

    if (!case_name || !case_name.trim()) {
      const err = new Error("case_name is required");
      err.status = 400;
      throw err;
    }

    const case_id = await nextCaseId();

    // people arrives as an array of { name, role }. Drop any row where the
    // name was left blank (e.g. an empty row still open in the form).
    const cleanPeople = Array.isArray(people)
      ? people
          .filter((p) => p && p.name && p.name.trim())
          .map((p) => ({ name: p.name.trim(), role: (p.role || "").trim() }))
      : [];

    const created = await Case.create({
      case_id,
      case_name: case_name.trim(),
      case_type: case_type || "",
      description: description || "",
      lead: lead || "",
      status: status || "Active",
      opened: opened || new Date().toISOString().slice(0, 10),
      people: cleanPeople,
      incident_date: incident_date || "",
      incident_location: incident_location || "",
      evidence_count: 0,
    });

    res.status(201).json(created);
  })
);

// GET /api/cases/:caseId -> single case
router.get(
  "/:caseId",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({ case_id: req.params.caseId, isDeleted: false }).lean();
    if (!caseDoc) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }
    const evidence_count = await Evidence.countDocuments({
      case_id: caseDoc.case_id,
      isDeleted: false,
    });
    res.json({ ...caseDoc, evidence_count });
  })
);

// PUT /api/cases/:caseId -> update a case
router.put(
  "/:caseId",
  asyncHandler(async (req, res) => {
    const allowed = ["case_name", "case_type", "description", "status", "lead", "opened"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const updated = await Case.findOneAndUpdate(
      { case_id: req.params.caseId, isDeleted: false },
      update,
      { new: true, runValidators: true }
    );

    if (!updated) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }

    res.json(updated);
  })
);

// DELETE /api/cases/:caseId -> soft delete (moves to recycle bin), cascades to its evidence
router.delete(
  "/:caseId",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({ case_id: req.params.caseId, isDeleted: false });
    if (!caseDoc) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }

    caseDoc.isDeleted = true;
    caseDoc.deletedAt = new Date();
    await caseDoc.save();

    const cascade = await Evidence.updateMany(
      { case_id: caseDoc.case_id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );

    res.json({
      message: `Case ${caseDoc.case_id} moved to recycle bin.`,
      case: caseDoc,
      evidenceMoved: cascade.modifiedCount,
    });
  })
);

// GET /api/cases/:caseId/graph -> the investigation map (Case -> People -> Evidence)
router.get(
  "/:caseId/graph",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({ case_id: req.params.caseId, isDeleted: false }).lean();
    if (!caseDoc) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }

    const caseEvidence = await Evidence.find({
      case_id: caseDoc.case_id,
      isDeleted: false,
    })
      .sort({ timestamp: 1 })
      .lean();

    const graph = buildInvestigationGraph(caseDoc, caseEvidence);

    res.json({
      case: {
        case_id: caseDoc.case_id,
        case_name: caseDoc.case_name,
        case_type: caseDoc.case_type,
        description: caseDoc.description,
        status: caseDoc.status,
        lead: caseDoc.lead,
        opened: caseDoc.opened,
      },
      ...graph,
    });
  })
);

// GET /api/cases/:caseId/evidence -> evidence scoped to one case (search/filter/sort/paginate)
router.get(
  "/:caseId/evidence",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({ case_id: req.params.caseId, isDeleted: false }).lean();
    if (!caseDoc) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }

    const query = buildEvidenceQuery({ ...req.query, case_id: req.params.caseId });
    const sort = buildSort(req.query);
    const { page, limit, skip } = paginate(req.query);

    const [data, total] = await Promise.all([
      Evidence.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Evidence.countDocuments(query),
    ]);

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

// GET /api/cases/:caseId/statistics -> investigation stats for one case
router.get(
  "/:caseId/statistics",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({ case_id: req.params.caseId, isDeleted: false }).lean();
    if (!caseDoc) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }
    const stats = await getCaseStatistics(req.params.caseId);
    res.json(stats);
  })
);

// GET /api/cases/:caseId/overview -> overview-tab stats + recent evidence
router.get(
  "/:caseId/overview",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({ case_id: req.params.caseId, isDeleted: false }).lean();
    if (!caseDoc) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }
    const stats = await getCaseOverviewStats(req.params.caseId);
    res.json(stats);
  })
);

// GET /api/cases/:caseId/analysis -> forensic risk summary for all evidence in a case
router.get(
  "/:caseId/analysis",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({
      case_id: req.params.caseId,
      isDeleted: false,
    }).lean();

    if (!caseDoc) {
      const err = new Error(`Case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }

    const evidence = await Evidence.find({
      case_id: req.params.caseId,
      isDeleted: false,
    }).lean();

    if (evidence.length === 0) {
      return res.json({
        case_id: caseDoc.case_id,
        total_evidence: 0,
        low_risk: 0,
        medium_risk: 0,
        high_risk: 0,
        critical_risk: 0,
        average_risk_score: 0,
        highest_risk_evidence: null,
        items: [],
      });
    }

    const items = evidence.map((ev) => {
      const analysis = analyzeEvidence(ev);
      return {
        evidence_id: ev.evidence_id,
        file_name: ev.file_name,
        ...analysis,
      };
    });

    const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    let totalScore = 0;
    let highestRisk = items[0];

    for (const item of items) {
      counts[item.risk_level] = (counts[item.risk_level] || 0) + 1;
      totalScore += item.risk_score;
      if (item.risk_score > highestRisk.risk_score) highestRisk = item;
    }

    res.json({
      case_id: caseDoc.case_id,
      total_evidence: items.length,
      low_risk: counts.Low || 0,
      medium_risk: counts.Medium || 0,
      high_risk: counts.High || 0,
      critical_risk: counts.Critical || 0,
      average_risk_score: Math.round(totalScore / items.length),
      highest_risk_evidence: highestRisk,
      items,
    });
  })
);

module.exports = router;
