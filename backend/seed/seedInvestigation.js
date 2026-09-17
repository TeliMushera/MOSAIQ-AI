/**
 * MOSAIQ — Seeder for the fictional investigation case
 * ---------------------------------------------------------------------------
 * Loads CASE-001 (Suspicious Death Investigation) from investigationCase.js
 * into MongoDB.
 *
 * - Safe to re-run: upserts keyed on case_id / evidence_id, so nothing is
 *   duplicated.
 * - Fills in the forensic fields the investigation data does not spell out:
 *   a real SHA-256 hash (computed with the project's own hashService), a file
 *   name and a size. Nothing is random — the same record always produces the
 *   same hash.
 *
 * Usage:
 *   node seed/seedInvestigation.js
 *   npm run seed
 * ---------------------------------------------------------------------------
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Case = require("../models/Case");
const Evidence = require("../models/Evidence");
const { sha256 } = require("../services/hashService");
// Every dataset in this list is loaded. Adding a new case to MOSAIQ means
// adding a file here — no code anywhere else changes.
const DATASETS = [require("./investigationCase"), require("./harassmentCase")];

/** "2026-03-11 22:35:00" -> Date */
function parseTimestamp(raw) {
  const d = new Date(String(raw).trim().replace(" ", "T"));
  return isNaN(d.getTime()) ? new Date() : d;
}

/** A readable file name derived from the evidence type, e.g. EV-001001_message.json */
function fileNameFor(ev) {
  const slug = (ev.evidence_type || "file").toLowerCase().replace(/\s+/g, "_");
  return `${ev.evidence_id}_${slug}.json`;
}

/** File format label the existing evidence table expects. */
function formatFor(ev) {
  switch (ev.evidence_type) {
    case "Message":
    case "Social Media":
      return "Chat Export";
    case "Call":
      return "Call Record";
    case "Email":
      return "Email";
    case "Location":
      return "GPS Log";
    default:
      return "File";
  }
}

async function seedOne({ CASE, EVIDENCE }) {
  // ---- Case ---------------------------------------------------------------
  await Case.findOneAndUpdate(
    { case_id: CASE.case_id },
    {
      ...CASE,
      evidence_count: EVIDENCE.length,
      isDeleted: false,
      deletedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`[seed] upserted case ${CASE.case_id} — ${CASE.case_name}`);

  // ---- Evidence -----------------------------------------------------------
  for (const ev of EVIDENCE) {
    const content = ev.content || "";

    // A real, deterministic SHA-256 over the record's identifying content.
    // Re-running the seeder therefore never changes an existing hash.
    const hash = sha256(`${ev.evidence_id}|${ev.timestamp}|${content}`);

    await Evidence.findOneAndUpdate(
      { evidence_id: ev.evidence_id },
      {
        evidence_id: ev.evidence_id,
        case_id: CASE.case_id,
        case_name: CASE.case_name,
        timestamp: parseTimestamp(ev.timestamp),

        // Investigation fields
        evidence_type: ev.evidence_type,
        person: ev.person,
        related_person: ev.related_person || "",
        place: ev.place || "",

        // Forensic / compatibility fields
        file_name: fileNameFor(ev),
        file_type: formatFor(ev),
        author: ev.person,
        department: ev.evidence_type,
        content,
        extracted_text: content,
        source: ev.source,
        file_size_kb: Math.max(1, Math.round(Buffer.byteLength(content, "utf-8") / 1024)),
        anomaly_type: ev.anomaly_type || "Normal",
        severity: ev.severity || "Low",
        hash_sha256: hash,
        integrity_status: ev.integrity_status || "Verified",

        processing_status: "Completed",
        processing_message: "Loaded from the fictional demonstration dataset.",

        isDeleted: false,
        deletedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`[seed] upserted ${EVIDENCE.length} evidence records for ${CASE.case_id}`);
}

async function seedInvestigation({ closeConnectionAfter = true } = {}) {
  for (const dataset of DATASETS) {
    await seedOne(dataset);
  }

  console.log("[seed] done.");

  if (closeConnectionAfter) {
    await mongoose.connection.close();
  }
}

// Allow running directly: `node seed/seedInvestigation.js`
if (require.main === module) {
  connectDB()
    .then(() => seedInvestigation())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] failed:", err);
      process.exit(1);
    });
}

module.exports = { seedInvestigation };
