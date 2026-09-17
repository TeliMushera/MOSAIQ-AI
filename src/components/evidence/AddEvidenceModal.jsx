import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProcessingSteps from "./ProcessingSteps";

import { uploadEvidenceFile, createManualEvidence } from "../../api/evidence";
import { IconUpload, IconEdit, IconFile } from "../common/icons";

// Stages: choose -> upload | manual -> processing -> complete | failed
// File formats the backend parsers can actually read.
const SUPPORTED_UPLOAD_FORMATS = ["PDF", "DOC", "DOCX", "TXT", "CSV", "EML"];

// The steps the backend runs on an uploaded file, shown as a progress list.
const PROCESSING_STEPS = [
  "Evidence uploaded",
  "Evidence type identified",
  "Evidence processed",
  "Text/metadata extracted",
  "SHA-256 hash generated",
  "Evidence normalized",
  "Evidence stored",
];

export default function AddEvidenceModal({ caseId, caseName, onClose, onEvidenceAdded }) {
  const [mode, setMode] = useState(null); // "upload" | "manual"
  const [stage, setStage] = useState("choose");
  const [fileName, setFileName] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [manualForm, setManualForm] = useState({
    title: "",
    evidence_type: "Message",
    person: "",
    related_person: "",
    place: "",
    timestamp: "",
    anomaly_type: "",
    severity: "Low",
    source: "",
    author: "",
    department: "",
    content: "",
  });
    const [uploadMeta, setUploadMeta] = useState({ author: "", department: "" });
  const [createdEvidence, setCreatedEvidence] = useState(null);
  const [failMessage, setFailMessage] = useState("");
  const timerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // Animates the step list while the real API request is in flight, then
  // resolves to "complete" or "failed" once the backend responds.
  const runWithAnimatedSteps = (name, apiCall) => {
    setFileName(name);
    setStage("processing");
    setCurrentStep(0);
    setFailMessage("");

    let step = 0;
    const totalAnimatedSteps = PROCESSING_STEPS.length - 1; // hold the last step for the real result
    timerRef.current = setInterval(() => {
      step += 1;
      if (step <= totalAnimatedSteps) setCurrentStep(step);
    }, 380);

    apiCall
      .then((evidence) => {
        clearInterval(timerRef.current);
        setCurrentStep(PROCESSING_STEPS.length);
        setCreatedEvidence(evidence);
        if (evidence.processingStatus === "Failed") {
          setFailMessage(evidence.processingMessage || "Processing failed.");
          setStage("failed");
        } else {
          setStage("complete");
        }
        onEvidenceAdded && onEvidenceAdded();
      })
      .catch((err) => {
        clearInterval(timerRef.current);
        setCurrentStep(PROCESSING_STEPS.length);
        setFailMessage(err.message);
        setStage("failed");
      });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    runWithAnimatedSteps(
      file.name,
      uploadEvidenceFile({
        file,
        case_id: caseId,
        case_name: caseName,
        author: uploadMeta.author,
        department: uploadMeta.department,
      })
    );
  };

  const handleManualSubmit = () => {
    const name = manualForm.title.trim() || "manual_entry.txt";
    runWithAnimatedSteps(
      name,
      createManualEvidence({
        case_id: caseId,
        case_name: caseName,
        evidence_type: manualForm.evidence_type,
        // "person" is who the evidence belongs to (the owner/sender). Falls
        // back to author for anyone still using the old field.
        person: manualForm.person || manualForm.author,
        related_person: manualForm.related_person,
        place: manualForm.place,
        timestamp: manualForm.timestamp || undefined, // blank -> backend uses now()
        anomaly_type: manualForm.anomaly_type || "Normal",
        severity: manualForm.severity,
        author: manualForm.author,
        department: manualForm.department,
        content: manualForm.content,
        file_name: name,
        file_type: "TXT",
        source: manualForm.source || "Manual Entry",
      })
    );
  };

  const handleViewEvidence = () => {
    onClose();
    if (createdEvidence) navigate(`/cases/${caseId}/evidence/${createdEvidence.id}`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add evidence</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {stage === "choose" && (
            <>
              <div className="upload-choice">
                <button
                  className={`choice-card ${mode === "upload" ? "selected" : ""}`}
                  onClick={() => setMode("upload")}
                >
                  <IconUpload />
                  <div className="choice-title" style={{ marginTop: 8 }}>
                    Upload file
                  </div>
                  <div className="choice-sub">PDF, DOC, DOCX, TXT, CSV, EML</div>
                </button>
                <button
                  className={`choice-card ${mode === "manual" ? "selected" : ""}`}
                  onClick={() => setMode("manual")}
                >
                  <IconEdit />
                  <div className="choice-title" style={{ marginTop: 8 }}>
                    Manual entry
                  </div>
                  <div className="choice-sub">Log evidence details by hand</div>
                </button>
              </div>

              {mode === "upload" && (
                <div>
                  <div className="form-field">
                    <label>Author (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. R. Sharma"
                      value={uploadMeta.author}
                      onChange={(e) => setUploadMeta({ ...uploadMeta, author: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Department (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering"
                      value={uploadMeta.department}
                      onChange={(e) => setUploadMeta({ ...uploadMeta, department: e.target.value })}
                    />
                  </div>
                  <label className="dropzone" style={{ display: "block", cursor: "pointer" }}>
                    <IconFile width={22} height={22} />
                    <div style={{ marginTop: 8 }}>Click to select a file to upload</div>
                    <div className="format-chip-row">
                      {SUPPORTED_UPLOAD_FORMATS.map((f) => (
                        <span className="format-chip" key={f}>
                          {f}
                        </span>
                      ))}
                    </div>
                    <input type="file" hidden onChange={handleFileSelect} />
                  </label>
                </div>
              )}

              {mode === "manual" && (
                <div>
                  <div className="form-field">
                    <label>Evidence title / file name</label>
                    <input
                      type="text"
                      placeholder="e.g. interview_note_r_sharma.txt"
                      value={manualForm.title}
                      onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Evidence type</label>
                    <select
                      value={manualForm.evidence_type}
                      onChange={(e) => setManualForm({ ...manualForm, evidence_type: e.target.value })}
                    >
                      <option>Message</option>
                      <option>Call</option>
                      <option>Location</option>
                      <option>Document</option>
                      <option>Social Media</option>
                      <option>Statement</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Person (who this evidence belongs to)</label>
                    <input
                      type="text"
                      placeholder="e.g. Karan Mehta"
                      value={manualForm.person}
                      onChange={(e) => setManualForm({ ...manualForm, person: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Related person (optional — the other party, e.g. who they called/messaged)</label>
                    <input
                      type="text"
                      placeholder="e.g. Rohit Dave"
                      value={manualForm.related_person}
                      onChange={(e) => setManualForm({ ...manualForm, related_person: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Place (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 3rd Floor Pantry"
                      value={manualForm.place}
                      onChange={(e) => setManualForm({ ...manualForm, place: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Date & time</label>
                    <input
                      type="datetime-local"
                      value={manualForm.timestamp}
                      onChange={(e) => setManualForm({ ...manualForm, timestamp: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Anomaly / flag type (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Suspicious Message"
                      value={manualForm.anomaly_type}
                      onChange={(e) => setManualForm({ ...manualForm, anomaly_type: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Severity</label>
                    <select
                      value={manualForm.severity}
                      onChange={(e) => setManualForm({ ...manualForm, severity: e.target.value })}
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Source (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Phone Extraction — Handset K-09"
                      value={manualForm.source}
                      onChange={(e) => setManualForm({ ...manualForm, source: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Notes / content</label>
                    <textarea
                      placeholder="Describe what this evidence record captures…"
                      value={manualForm.content}
                      onChange={(e) => setManualForm({ ...manualForm, content: e.target.value })}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={handleManualSubmit}>
                    Add evidence record
                  </button>
                </div>
              )}
            </>
          )}

          {stage === "processing" && (
            <div>
              <div className="extracted-field" style={{ marginBottom: 16 }}>
                <span className="f-label">Evidence file</span>
                <span className="mono">{fileName}</span>
              </div>
              <ProcessingSteps steps={PROCESSING_STEPS} currentStep={currentStep} />
            </div>
          )}

          {stage === "complete" && (
            <div>
              <div className="extracted-field" style={{ marginBottom: 16 }}>
                <span className="f-label">Evidence file</span>
                <span className="mono">{fileName}</span>
              </div>
              <ProcessingSteps steps={PROCESSING_STEPS} currentStep={PROCESSING_STEPS.length} />
              <div
                style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  background: "var(--verified-soft)",
                  color: "var(--verified)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Processing complete — SHA-256: {createdEvidence?.sha256?.slice(0, 16)}…
              </div>
            </div>
          )}

          {stage === "failed" && (
            <div>
              <div className="extracted-field" style={{ marginBottom: 16 }}>
                <span className="f-label">Evidence file</span>
                <span className="mono">{fileName}</span>
              </div>
              <ProcessingSteps steps={PROCESSING_STEPS} currentStep={PROCESSING_STEPS.length} />
              <div className="error-state" style={{ marginTop: 16, marginBottom: 0 }}>
                {failMessage}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {stage === "complete" ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-primary" onClick={handleViewEvidence}>
                View evidence
              </button>
            </>
          ) : stage === "failed" ? (
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
