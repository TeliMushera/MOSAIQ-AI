// ---------------------------------------------------------------------------
// Adapters: backend document shape -> the shape the existing UI components
// already expect (the same shape mockData.js used to produce). Keeping this
// mapping in one place means pages/components below don't need to change
// their JSX just because the backend field names differ from the mock data.
// ---------------------------------------------------------------------------

function pad(num, size) {
  return String(num).padStart(size, "0");
}

function formatTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1, 2);
  const dd = pad(d.getDate(), 2);
  const hh = pad(d.getHours(), 2);
  const min = pad(d.getMinutes(), 2);
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// Case: backend { case_id, case_name, case_type, description, status, lead,
// opened, evidence_count } -> UI { id, name, type, description, status,
// evidenceCount, opened, leadInvestigator }
export function adaptCase(c) {
  if (!c) return null;
  return {
    id: c.case_id,
    name: c.case_name,
    type: c.case_type,
    description: c.description,
    status: c.status,
    evidenceCount: c.evidence_count ?? 0,
    opened: c.opened,
    leadInvestigator: c.lead,
    deletedAt: c.deletedAt,
  };
}

// Evidence: backend document -> the shape the UI uses.
//
// `type` is the INVESTIGATION type (Message, Call, Email, Social Media,
// Location, File) and `person` is who the evidence belongs to. Older records
// that predate those fields fall back to file_type and author, so nothing
// already in the database breaks.
export function adaptEvidence(ev) {
  if (!ev) return null;
  const timestamp = formatTimestamp(ev.timestamp);
  return {
    id: ev.evidence_id,
    caseId: ev.case_id,
    caseName: ev.case_name,
    timestamp,
    type: ev.evidence_type || ev.file_type || "File",
    person: ev.person || ev.author || "Unknown",
    relatedPerson: ev.related_person || "",
    place: ev.place || "",
    user: ev.person || ev.author,
    activity: ev.content,
    content: ev.content,
    source: ev.source,
    department: ev.department,
    ipAddress: ev.department, // dataset has no IP data; department shown in that column instead
    status: ev.integrity_status,
    fileName: ev.file_name,
    format: ev.file_type,
    fileSize: `${ev.file_size_kb ?? 0} KB`,
    uploadedDate: formatTimestamp(ev.created_at || ev.timestamp),
    sha256: ev.hash_sha256,
    integrity: ev.integrity_status,
    anomalyType: ev.anomaly_type,
    severity: ev.severity,
    processingStatus: ev.processing_status,
    processingMessage: ev.processing_message,
    extracted: {
      fileName: ev.file_name,
      author: ev.author,
      createdDate: timestamp,
      modifiedDate: formatTimestamp(ev.updated_at || ev.timestamp),
      text: ev.extracted_text || ev.content || "No text was extracted for this record.",
    },
  };
}

export function adaptEvidenceList(list) {
  return (list || []).map(adaptEvidence);
}

export function adaptCaseList(list) {
  return (list || []).map(adaptCase);
}
