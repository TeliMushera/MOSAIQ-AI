const mongoose = require("mongoose");

const EvidenceSchema = new mongoose.Schema(
  {
    // ---- Fields preserved from the MOSAIQ - Documents.csv dataset ----
    evidence_id: { type: String, required: true, unique: true, index: true },
    case_id: { type: String, required: true, index: true },
    case_name: { type: String, default: "" },
    timestamp: { type: Date, required: true },
    file_name: { type: String, required: true },
    file_type: { type: String, default: "" }, // e.g. PDF, DOCX, XLSX, TXT, CSV, EML
    author: { type: String, default: "" },
    department: { type: String, default: "" },
    content: { type: String, default: "" },
    source: { type: String, default: "" },
    file_size_kb: { type: Number, default: 0 },
    anomaly_type: { type: String, default: "Normal" },
    severity: { type: String, default: "Low" }, // Low | High (per dataset) / Medium | Critical also supported
    hash_sha256: { type: String, default: "" },
    integrity_status: { type: String, default: "Verified" },

    // ---- Investigation fields (restructure) ----------------------------------
    // These describe the evidence the way an investigator thinks about it:
    // "what kind of digital trace is this, and which person does it belong to?"
    //
    // evidence_type : Message | Call | Email | Social Media | Location | File
    // person        : the person this evidence belongs to (the owner/sender).
    //                 Falls back to `author` for older/document-based records.
    // related_person: the other party involved (recipient, person called, etc.)
    // place         : plain-text place name, used by Location evidence.
    evidence_type:  { type: String, default: "File", index: true },
    person:         { type: String, default: "", index: true },
    related_person: { type: String, default: "" },
    place:          { type: String, default: "" },

    // ---- Normalized/backend-only fields ----
    processing_status: {
      type: String,
      enum: ["Uploaded", "Processing", "Completed", "Failed"],
      default: "Completed",
    },
    processing_message: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    extracted_text: { type: String, default: "" },
    stored_file_path: { type: String, default: "" }, // relative path under backend/uploads, if uploaded

    // ---- Batch 2: AI forensic analysis result (optional — null for seeded/old records) ----
    ai_analysis: {
      type: new mongoose.Schema(
        {
          status:       { type: String, default: "" }, // "completed" | "error" | "unavailable"
          message:      { type: String, default: "" },
          severity:     { type: String, default: null },
          anomaly_type: { type: String, default: null },
          indicators:   { type: [String], default: [] },
          reasons:      { type: [String], default: [] },
          analyzed_at:  { type: Date, default: null },
        },
        { _id: false }
      ),
      default: null,
    },

    // Soft-delete / recycle bin support
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

EvidenceSchema.index({
  evidence_id: "text",
  case_id: "text",
  case_name: "text",
  file_name: "text",
  author: "text",
  department: "text",
  content: "text",
  source: "text",
  anomaly_type: "text",
  person: "text",
  related_person: "text",
  evidence_type: "text",
});

module.exports = mongoose.model("Evidence", EvidenceSchema);
