const express = require("express");
const Case = require("../models/Case");
const Evidence = require("../models/Evidence");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

// GET /api/recycle-bin/cases -> deleted cases
router.get(
  "/cases",
  asyncHandler(async (req, res) => {
    const cases = await Case.find({ isDeleted: true }).sort({ deletedAt: -1 }).lean();
    res.json(cases);
  })
);

// POST /api/recycle-bin/cases/:caseId/restore -> restore a deleted case (and its evidence)
router.post(
  "/cases/:caseId/restore",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOne({ case_id: req.params.caseId, isDeleted: true });
    if (!caseDoc) {
      const err = new Error(`Deleted case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }
    caseDoc.isDeleted = false;
    caseDoc.deletedAt = null;
    await caseDoc.save();

    const cascade = await Evidence.updateMany(
      { case_id: caseDoc.case_id, isDeleted: true },
      { isDeleted: false, deletedAt: null }
    );

    res.json({
      message: `Case ${caseDoc.case_id} restored.`,
      case: caseDoc,
      evidenceRestored: cascade.modifiedCount,
    });
  })
);

// DELETE /api/recycle-bin/cases/:caseId -> permanently delete a case and its evidence
router.delete(
  "/cases/:caseId",
  asyncHandler(async (req, res) => {
    const caseDoc = await Case.findOneAndDelete({ case_id: req.params.caseId, isDeleted: true });
    if (!caseDoc) {
      const err = new Error(`Deleted case not found: ${req.params.caseId}`);
      err.status = 404;
      throw err;
    }
    const cascade = await Evidence.deleteMany({ case_id: caseDoc.case_id, isDeleted: true });
    res.json({
      message: `Case ${caseDoc.case_id} permanently deleted.`,
      evidencePermanentlyDeleted: cascade.deletedCount,
    });
  })
);

// GET /api/recycle-bin/evidence -> deleted evidence (optionally ?case_id=)
router.get(
  "/evidence",
  asyncHandler(async (req, res) => {
    const query = { isDeleted: true };
    if (req.query.case_id) query.case_id = req.query.case_id;
    const evidence = await Evidence.find(query).sort({ deletedAt: -1 }).lean();
    res.json(evidence);
  })
);

// POST /api/recycle-bin/evidence/:evidenceId/restore -> restore a deleted evidence record
router.post(
  "/evidence/:evidenceId/restore",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOne({ evidence_id: req.params.evidenceId, isDeleted: true });
    if (!ev) {
      const err = new Error(`Deleted evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }
    ev.isDeleted = false;
    ev.deletedAt = null;
    await ev.save();
    res.json({ message: `Evidence ${ev.evidence_id} restored.`, evidence: ev });
  })
);

// DELETE /api/recycle-bin/evidence/:evidenceId -> permanently delete an evidence record
router.delete(
  "/evidence/:evidenceId",
  asyncHandler(async (req, res) => {
    const ev = await Evidence.findOneAndDelete({ evidence_id: req.params.evidenceId, isDeleted: true });
    if (!ev) {
      const err = new Error(`Deleted evidence not found: ${req.params.evidenceId}`);
      err.status = 404;
      throw err;
    }
    res.json({ message: `Evidence ${ev.evidence_id} permanently deleted.` });
  })
);

module.exports = router;
