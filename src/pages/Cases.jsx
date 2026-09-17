import { useEffect, useState } from "react";
import CaseCard from "../components/cases/CaseCard";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import { fetchCases, createCase, deleteCase } from "../api/cases";
import { IconPlus } from "../components/common/icons";

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const emptyForm = {
    name: "",
    type: "",
    description: "",
    lead: "",
    incident_date: "",
    incident_location: "",
    // Role is left blank on purpose — MOSAIQ works it out from the evidence
    // once records start coming in, rather than asking the investigator to
    // guess who the witness or the person of interest is before anything has
    // been uploaded.
    people: [{ name: "", role: "" }],
  };
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const updatePerson = (index, field, value) => {
    setForm((f) => ({
      ...f,
      people: f.people.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }));
  };
  const addPersonRow = () =>
    setForm((f) => ({ ...f, people: [...f.people, { name: "", role: "" }] }));
  const removePersonRow = (index) =>
    setForm((f) => ({ ...f, people: f.people.filter((_, i) => i !== index) }));

  const load = () => {
    setLoading(true);
    setError(null);
    fetchCases()
      .then(setCases)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setCreateError("Case name is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createCase(form);
      setCases((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm(emptyForm);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (caseId) => {
    const prev = cases;
    setCases((c) => c.filter((x) => x.id !== caseId));
    try {
      await deleteCase(caseId);
    } catch (err) {
      setCases(prev);
      window.alert(`Could not delete case: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Cases</h1>
          <p className="page-sub">
            Every investigation in MOSAIQ is organized as its own case, with its own evidence set.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <IconPlus width={15} height={15} />
          Create new case
        </button>
      </div>

      <ErrorState error={error} onRetry={load} />

      {loading ? (
        <LoadingState label="Loading cases…" />
      ) : cases.length === 0 ? (
        <div className="empty-state">
          <h3>No cases yet</h3>
          <p>Create your first case to start collecting evidence.</p>
        </div>
      ) : (
        <div className="case-grid">
          {cases.map((c) => (
            <CaseCard key={c.id} caseInfo={c} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => !creating && setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create new case</h3>
              <button className="close-btn" onClick={() => setShowCreate(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Case name</label>
                <input
                  type="text"
                  placeholder="e.g. Project Halcyon"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Case type</label>
                <input
                  type="text"
                  placeholder="e.g. Unauthorized data transfer"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Lead investigator</label>
                <input
                  type="text"
                  placeholder="e.g. A. Fernandes"
                  value={form.lead}
                  onChange={(e) => setForm({ ...form, lead: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea
                  placeholder="Briefly describe what triggered this investigation…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Incident date (optional)</label>
                <input
                  type="date"
                  value={form.incident_date}
                  onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Incident location (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Riverside Office, 3rd Floor"
                  value={form.incident_location}
                  onChange={(e) => setForm({ ...form, incident_location: e.target.value })}
                />
              </div>

              {/* People involved — just names. MOSAIQ infers each person's
                  role (Victim, Person of Interest, Witness, Contact…) from
                  their evidence once it's added, so nobody has to know or
                  guess who's who before the evidence says so. Naming someone
                  here is only needed if they should appear on the map before
                  any evidence of theirs has been uploaded yet; anyone who
                  already appears on evidence is picked up automatically. */}
              <div className="form-field">
                <label>People involved (optional)</label>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -4, marginBottom: 8 }}>
                  Roles are worked out automatically from the evidence — you don't need to
                  assign them here.
                </p>
                {form.people.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Name, e.g. Ritika Sharma"
                      value={p.name}
                      onChange={(e) => updatePerson(i, "name", e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {form.people.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removePersonRow(i)}
                        title="Remove this person"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-ghost" onClick={addPersonRow}>
                  + Add person
                </button>
              </div>
              {createError && <p style={{ fontSize: 12, color: "var(--flag)" }}>{createError}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create case"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
