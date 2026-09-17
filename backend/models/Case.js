const mongoose = require("mongoose");

const CaseSchema = new mongoose.Schema(
  {
    case_id: { type: String, required: true, unique: true, index: true },
    case_name: { type: String, required: true },
    case_type: { type: String, default: "" },
    description: { type: String, default: "" },
    status: { type: String, default: "Active" }, // Active | Closed
    lead: { type: String, default: "" },
    opened: { type: String, default: "" }, // stored as YYYY-MM-DD for simplicity
    evidence_count: { type: Number, default: 0 },

    // ---- People involved in this case, with their role ---------------------
    // Roles are FREE TEXT and come entirely from the data. The platform never
    // assumes a case has a victim, a suspect, or any other particular role:
    // one case may hold "Victim" / "Person of Interest", another
    // "Complainant" / "Suspected Account", another "Account Holder".
    //
    // A person only needs an entry here to be given a role label. Anyone who
    // appears on evidence but is missing from this list still shows on the
    // investigation map, just without a role.
    people: {
      type: [
        {
          _id: false,
          name: { type: String, required: true },
          role: { type: String, default: "" },
        },
      ],
      default: [],
    },

    // Optional free-text incident details, used to build the case summary.
    // Both are plain data — no format is imposed and neither is required.
    incident_date: { type: String, default: "" }, // e.g. "2026-03-11"
    incident_location: { type: String, default: "" },

    // Soft-delete / recycle bin support
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

CaseSchema.index({ case_name: "text", description: "text", case_type: "text" });

module.exports = mongoose.model("Case", CaseSchema);
