/**
 * Builds a MongoDB filter object for the Evidence collection from query
 * string params. Shared by both /api/evidence and /api/cases/:id/evidence
 * so filtering behaves identically everywhere.
 */
function buildEvidenceQuery(q = {}) {
  const query = { isDeleted: false };

  if (q.case_id) query.case_id = q.case_id;
  if (q.file_type) query.file_type = new RegExp(`^${escapeRegex(q.file_type)}$`, "i");
  if (q.author) query.author = new RegExp(escapeRegex(q.author), "i");
  if (q.department) query.department = new RegExp(escapeRegex(q.department), "i");
  if (q.source) query.source = new RegExp(escapeRegex(q.source), "i");
  if (q.anomaly_type) query.anomaly_type = new RegExp(`^${escapeRegex(q.anomaly_type)}$`, "i");
  if (q.severity) query.severity = new RegExp(`^${escapeRegex(q.severity)}$`, "i");
  if (q.integrity_status) query.integrity_status = new RegExp(`^${escapeRegex(q.integrity_status)}$`, "i");
  if (q.processing_status) query.processing_status = new RegExp(`^${escapeRegex(q.processing_status)}$`, "i");

  if (q.search && q.search.trim()) {
    const term = escapeRegex(q.search.trim());
    const rx = new RegExp(term, "i");
    query.$or = [
      { evidence_id: rx },
      { case_id: rx },
      { case_name: rx },
      { file_name: rx },
      { file_type: rx },
      { author: rx },
      { department: rx },
      { content: rx },
      { source: rx },
      { anomaly_type: rx },
      { severity: rx },
    ];
  }

  return query;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORTABLE_FIELDS = new Set([
  "timestamp",
  "evidence_id",
  "file_name",
  "severity",
  "file_type",
  "created_at",
]);

function buildSort(q = {}) {
  const field = SORTABLE_FIELDS.has(q.sort) ? q.sort : "timestamp";
  const order = q.order === "asc" ? 1 : -1;
  return { [field]: order };
}

function paginate(q = {}) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { buildEvidenceQuery, buildSort, paginate, escapeRegex };
