/**
 * Imports the MOSAIQ - Documents.csv dataset into MongoDB.
 *
 * - Preserves every field from the CSV exactly (evidence IDs, case IDs,
 *   timestamps, hashes, etc.) — nothing is fabricated or overwritten.
 * - Derives the 3 cases (CASE-001/002/003) from the dataset itself.
 * - Safe to re-run: uses upserts keyed on evidence_id / case_id, so running
 *   it again will not create duplicates.
 *
 * Usage:
 *   node seed/importData.js
 *   npm run seed
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Case = require("../models/Case");
const Evidence = require("../models/Evidence");

const CSV_PATH = path.join(__dirname, "MOSAIQ_-_Documents.csv");

// Static case metadata not present in the documents CSV (type/description/
// lead/opened date) — matches the case briefs supplied with the project.
const CASE_META = {
  "CASE-001": {
    case_type: "Confidential File Leak",
    description:
      "An employee is suspected of accessing and sharing a confidential company file without permission.",
    lead: "A. Fernandes",
    opened: "2026-07-02",
    status: "Active",
  },
  "CASE-002": {
    case_type: "Suspicious Account Login",
    description: "An employee's account shows a login from an unfamiliar IP address or device.",
    lead: "S. Menon",
    opened: "2026-07-18",
    status: "Active",
  },
  "CASE-003": {
    case_type: "Unauthorized File Access",
    description:
      "An employee is suspected of accessing internal company files that are not related to their work.",
    lead: "R. Iyer",
    opened: "2026-08-01",
    status: "Active",
  },
};

function parseTimestamp(raw) {
  // CSV format: "2026-08-01 9:15:00" -> normalize to a real Date
  const iso = raw.trim().replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function importData({ closeConnectionAfter = true } = {}) {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Dataset not found at ${CSV_PATH}`);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`[seed] parsed ${rows.length} evidence rows from MOSAIQ_-_Documents.csv`);

  // --- Cases ---
  const caseIds = [...new Set(rows.map((r) => r.case_id))];
  for (const case_id of caseIds) {
    const firstRow = rows.find((r) => r.case_id === case_id);
    const meta = CASE_META[case_id] || {};
    const evidenceCountForCase = rows.filter((r) => r.case_id === case_id).length;

    await Case.findOneAndUpdate(
      { case_id },
      {
        case_id,
        case_name: firstRow.case_name,
        case_type: meta.case_type || "General Investigation",
        description: meta.description || "",
        status: meta.status || "Active",
        lead: meta.lead || "Unassigned",
        opened: meta.opened || parseTimestamp(firstRow.timestamp).toISOString().slice(0, 10),
        evidence_count: evidenceCountForCase,
        isDeleted: false,
        deletedAt: null,
      },
      { upsert: true, new: true }
    );
  }
  console.log(`[seed] upserted ${caseIds.length} cases: ${caseIds.join(", ")}`);

  // --- Evidence ---
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const doc = {
      evidence_id: row.evidence_id,
      case_id: row.case_id,
      case_name: row.case_name,
      timestamp: parseTimestamp(row.timestamp),
      file_name: row.file_name,
      file_type: row.file_type,
      author: row.author,
      department: row.department,
      content: row.content,
      source: row.source,
      file_size_kb: Number(row.file_size_kb) || 0,
      anomaly_type: row.anomaly_type,
      severity: row.severity,
      hash_sha256: row.hash_sha256,
      integrity_status: row.integrity_status,
      processing_status: "Completed",
      processing_message: "Imported from MOSAIQ - Documents.csv dataset.",
      extracted_text: row.content,
      isDeleted: false,
      deletedAt: null,
    };

    const result = await Evidence.findOneAndUpdate(
      { evidence_id: row.evidence_id },
      doc,
      { upsert: true, new: false, setDefaultsOnInsert: true }
    );
    if (result) updated += 1;
    else created += 1;
  }

  console.log(`[seed] evidence import complete — created: ${created}, updated: ${updated}`);
  console.log("[seed] done.");

  if (closeConnectionAfter) {
    await mongoose.connection.close();
  }
}

// Allow running directly: `node seed/importData.js`
if (require.main === module) {
  (async () => {
    await connectDB();
    await importData();
    process.exit(0);
  })().catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
}

module.exports = { importData };
