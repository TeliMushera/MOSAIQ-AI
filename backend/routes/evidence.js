const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const Evidence = require("../models/Evidence");
const { asyncHandler } = require("../middleware/errorHandler");
const { buildEvidenceQuery, buildSort, paginate } = require("./_evidenceQuery");
const { processUploadedFile } = require("../services/evidenceProcessor");
const { sha256 } = require("../services/hashService");
const { analyzeEvidence } = require("../services/forensicRiskEngine");
const { analyzeContentWithAI, generateInvestigationInsight } = require("../services/aiForensicAnalyzer");
const { findRelatedEvidence } = require("../services/evidenceCorrelation");
const { calculateAECA } = require("../services/aecaService");
const Case = require("../models/Case");
const { buildInvestigationGraph } = require("../services/investigationGraph");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB, generous for a demo
});

async function nextEvidenceId() {
  const last = await Evidence.find({}).sort({ evidence_id: -1 }).limit(1).lean();
  let nextNum = 1;
  if (last.length > 0) {
    const match = last[0].evidence_id.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `EV-${String(nextNum).padStart(6, "0")}`;
}

// GET /api/evidence -> paginated/searchable/filterable/sortable evidence list
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = buildEvidenceQuery(req.query);
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

// GET /api/evidence/filter-options -> distinct values to populate filter dropdowns
router.get(
  "/filter-options",
  asyncHandler(async (req, res) => {
    const match = { isDeleted: false };
    const [file_type, department, source, anomaly_type, severity, integrity_status, author] = await Promise.all([
      Evidence.distinct("file_type", match),
      Evidence.distinct("department", match),
      Evidence.distinct("source", match),
      Evidence.distinct("anomaly_type", match),
      Evidence.distinct("severity", match),
      Evidence.distinct("integrity_status", match),
      Evidence.distinct("author", match),
    ]);
    res.json({
      file_type: file_type.filter(Boolean).sort(),
      department: department.filter(Boolean).sort(),
      source: source.filter(Boolean).sort(),
      anomaly_type: anomaly_type.filter(Boolean).sort(),
      severity: severity.filter(Boolean).sort(),
      integrity_status: integrity_status.filter(Boolean).sort(),
      author: author.filter(Boolean).sort(),
    });
  })
);

// POST /api/evidence -> manual evidence entry
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      case_id,
      case_name,
      file_type,
      author,
      department,
      timestamp,
      source,
      anomaly_type,
      severity,
      content,
      file_name,
      evidence_type,
      person,
      related_person,
      place,
    } = req.body;

    if (!case_id) {
      const err = new Error("case_id is required");
      err.status = 400;
      throw err;
    }

    const evidence_id = await nextEvidenceId();
    const contentText = content || "";
    const hash_sha256 = sha256(`${evidence_id}|${contentText}|${Date.now()}`);

    const created = await Evidence.create({
      evidence_id,
      case_id,
      case_name: case_name || "",
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      file_name: file_name || `${evidence_id}_manual_entry.txt`,
      file_type: file_type || evidence_type || "File",
      evidence_type: evidence_type || file_type || "File",
      person: person || author || "",
      related_person: related_person || "",
      place: place || "",
      author: author || person || "",
      department: department || "",
      content: contentText,
      source: source || "Manual Entry",
      file_size_kb: Math.max(1, Math.round(Buffer.byteLength(contentText, "utf-8") / 1024)),
      anomaly_type: anomaly_type || "Normal",
      severity: severity || "Low",
      hash_sha256,
      integrity_status: "Verified",
      processing_status: "Completed",
      processing_message: "Manually entered evidence record.",
      extracted_text: contentText,
    });

    res.status(201).json(created);
  })
);

// POST /api/evidence/upload -> real file upload + processing pipeline
router.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { case_id, case_name, author, department, source } = req.body;

    if (!req.file) {
      const err = new Error("No file was uploaded. Attach a file under field name 'file'.");
      err.status = 400;
      throw err;
    }
    if (!case_id) {
      const err = new Error("case_id is required");
      err.status = 400;
      throw err;
    }

    const result = await processUploadedFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
    });

    // Persist the raw file bytes to disk for the demo/audit trail.
    const evidence_id = await nextEvidenceId();
    const safeName = `${evidence_id}_${req.file.originalname}`.replace(/[^\w.\-]/g, "_");
    const storedPath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(storedPath, req.file.buffer);

    const created = await Evidence.create({
      evidence_id,
      case_id,
      case_name: case_name || "",
      timestamp: new Date(),
      file_name: req.file.originalname,
      file_type: result.file_type,
      author: author || "",
      department: department || "",
      content: result.extracted_text.slice(0, 2000),
      source: source || "Manual Upload",
      file_size_kb: result.file_size_kb,
      anomaly_type: "Normal",
      severity: "Low",
      hash_sha256: result.hash_sha256,
      integrity_status: result.integrity_status,
      processing_status: result.processing_status,
      processing_message: result.processing_message,
      metadata: result.metadata,
      extracted_text: result.extracted_text,
      stored_file_path: path.relative(path.join(__dirname, ".."), storedPath),
    });

    res.status(201).json(created);
  })
);

// POST /api/evidence/:evidenceId/ai-analysis
// Sends the evidence's extracted text to the AI analyzer, saves the result
// on the evidence record, then re-runs the Batch 1 risk engine using the
// AI-determined severity + anomaly_type so the score reflects AI findings.
router.post(
  "/:evidenceId/ai-analysis",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({
      evidence_id: req.params.evidenceId,
      isDeleted: false,
    });

    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }

    // Use stored extracted_text; fall back to content field
    const textForAI = ev.extracted_text || ev.content || "";

    const aiResult = await analyzeContentWithAI(textForAI, {
      file_name: ev.file_name,
      file_type: ev.file_type,
      author: ev.author,
      department: ev.department,
      source: ev.source,
    });

    // Persist the AI result to the evidence record
    ev.ai_analysis = {
      status: aiResult.status,
      message: aiResult.message,
      severity: aiResult.severity,
      anomaly_type: aiResult.anomaly_type,
      indicators: aiResult.indicators || [],
      reasons: aiResult.reasons || [],
      analyzed_at: aiResult.analyzed_at ? new Date(aiResult.analyzed_at) : new Date(),
    };

    // If AI produced valid severity/anomaly, update the evidence fields so
    // the existing Batch 1 risk engine uses them in all subsequent /analysis calls.
    if (aiResult.status === "completed" && aiResult.severity) {
      ev.severity = aiResult.severity;
      if (aiResult.anomaly_type) ev.anomaly_type = aiResult.anomaly_type;
    }

    await ev.save();

    // Run Batch 1 risk engine with the (potentially updated) evidence
    const riskAnalysis = analyzeEvidence(ev.toObject ? ev.toObject() : ev);

    res.json({
      evidence_id: ev.evidence_id,
      ai_analysis: ev.ai_analysis,
      risk_score: riskAnalysis.risk_score,
      risk_level: riskAnalysis.risk_level,
      risk_reasons: riskAnalysis.reasons,
      ai_powered: aiResult.status === "completed",
    });
  })
);

// POST /api/evidence/:evidenceId/reverify-integrity
// Reads the ORIGINAL stored file from disk, recomputes SHA-256, and
// compares it to the hash recorded at upload time. No AI involved.
router.post(
  "/:evidenceId/reverify-integrity",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({
      evidence_id: req.params.evidenceId,
      isDeleted: false,
    });

    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }

    if (!ev.stored_file_path) {
      return res.json({
        integrity_status: "Cannot verify",
        original_hash: ev.hash_sha256 || "",
        current_hash: null,
        changed: null,
        message:
          "No uploaded file is stored for this evidence record. " +
          "Integrity re-verification is only available for file uploads (not manual entries or seeded records).",
      });
    }

    // Build absolute path from the relative stored_file_path
    const absPath = path.join(__dirname, "..", ev.stored_file_path);

    if (!fs.existsSync(absPath)) {
      return res.json({
        integrity_status: "File not found",
        original_hash: ev.hash_sha256 || "",
        current_hash: null,
        changed: null,
        message: `The stored file could not be located at the expected path. It may have been moved or deleted.`,
      });
    }

    const fileBuffer = fs.readFileSync(absPath);
    const currentHash = sha256(fileBuffer);
    const originalHash = ev.hash_sha256 || "";
    const changed = currentHash !== originalHash;

    // If tampered, update the integrity_status on the evidence record
    if (changed) {
      ev.integrity_status = "Integrity Failed";
      await ev.save();
    } else if (ev.integrity_status !== "Verified") {
      // If someone manually set a bad status, re-verify restores it
      ev.integrity_status = "Verified";
      await ev.save();
    }

    res.json({
      integrity_status: changed ? "Integrity Failed" : "Verified",
      original_hash: originalHash,
      current_hash: currentHash,
      changed,
      message: changed
        ? "⚠ The current file does not match the original SHA-256 hash. Possible modification or tampering detected."
        : "✓ The current file matches the original SHA-256 hash. Integrity confirmed.",
    });
  })
);

// GET /api/evidence/:evidenceId/related -> top correlated evidence from the same case
router.get(
  "/:evidenceId/related",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({
      evidence_id: req.params.evidenceId,
      isDeleted: false,
    }).lean();

    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }

    // Fetch all non-deleted evidence for the same case
    const caseEvidence = await Evidence.find({
      case_id: ev.case_id,
      isDeleted: false,
    }).lean();

    const related = findRelatedEvidence(ev, caseEvidence);

    res.json({
      evidence_id: ev.evidence_id,
      case_id: ev.case_id,
      related,
    });
  })
);

// POST /api/evidence/:evidenceId/investigation-insight -> AI insight across correlated evidence
router.post(
  "/:evidenceId/investigation-insight",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({
      evidence_id: req.params.evidenceId,
      isDeleted: false,
    }).lean();

    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }

    // Fetch all non-deleted evidence for the same case and find correlations
    const caseEvidence = await Evidence.find({
      case_id: ev.case_id,
      isDeleted: false,
    }).lean();

    const related = findRelatedEvidence(ev, caseEvidence);

    // Attach risk scores to source evidence for the AI prompt
    const sourceWithRisk = { ...ev, ...analyzeEvidence(ev) };

    // ---- Case context ------------------------------------------------------
    // The AI is told about the case, its declared people and their roles, and
    // this record's AECA score. All of it is read from the database, so the
    // insight adapts to whatever kind of case this is.
    const caseDoc = await Case.findOne({ case_id: ev.case_id, isDeleted: false }).lean();
    const graph = caseDoc ? buildInvestigationGraph(caseDoc, caseEvidence) : null;
    const aeca = calculateAECA(ev, caseEvidence);

    const insight = await generateInvestigationInsight(sourceWithRisk, related, {
      caseDoc: caseDoc || {},
      people: graph ? graph.people : [],
      aeca,
    });

    res.json({
      evidence_id: ev.evidence_id,
      case_id: ev.case_id,
      related_count: related.length,
      aeca: { aeca_score: aeca.aeca_score, aeca_level: aeca.aeca_level },
      insight,
    });
  })
);

// GET /api/evidence/:evidenceId/aeca -> the AECA investigation score + full breakdown
router.get(
  "/:evidenceId/aeca",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({
      evidence_id: req.params.evidenceId,
      isDeleted: false,
    }).lean();

    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }

    // AECA needs the rest of the case to measure how connected this record is.
    const caseEvidence = await Evidence.find({
      case_id: ev.case_id,
      isDeleted: false,
    }).lean();

    res.json(calculateAECA(ev, caseEvidence));
  })
);

// GET /api/evidence/:evidenceId/analysis -> forensic risk analysis for one evidence record
router.get(
  "/:evidenceId/analysis",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({
      evidence_id: req.params.evidenceId,
      isDeleted: false,
    }).lean();

    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }

    const analysis = analyzeEvidence(ev);

    res.json({
      evidence_id: ev.evidence_id,
      case_id: ev.case_id,
      file_name: ev.file_name,
      ...analysis,
    });
  })
);

// GET /api/evidence/:evidenceId -> single evidence record
router.get(
  "/:evidenceId",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({ evidence_id: req.params.evidenceId, isDeleted: false }).lean();
    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }
    res.json(ev);
  })
);

// DELETE /api/evidence/:evidenceId -> soft delete (moves to recycle bin)
router.delete(
  "/:evidenceId",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({ evidence_id: req.params.evidenceId, isDeleted: false });
    if (!ev) {
      const err = new Error(`Evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }
    ev.isDeleted = true;
    ev.deletedAt = new Date();
    await ev.save();
    res.json({ message: `Evidence ${ev.evidence_id} moved to recycle bin.`, evidence: ev });
  })
);

module.exports = router;
