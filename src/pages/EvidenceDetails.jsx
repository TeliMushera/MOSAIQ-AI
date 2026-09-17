import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import EvidenceDetailPanel from "../components/investigation/EvidenceDetailPanel";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import { fetchEvidenceById, deleteEvidence } from "../api/evidence";

/**
 * EvidenceDetails — the full-page view of one evidence record.
 *
 * It reuses the exact same EvidenceDetailPanel the investigation map uses, so
 * the evidence looks and behaves identically whether it is opened from the
 * map or from the evidence table. One component, one place to change.
 */
export default function EvidenceDetails() {
  const { caseId, evidenceId } = useParams();
  const navigate = useNavigate();

  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchEvidenceById(evidenceId)
      .then(setEvidence)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [evidenceId]);

  useEffect(load, [load]);

  const handleDelete = async () => {
    if (!window.confirm(`Move evidence ${evidenceId} to the recycle bin?`)) return;
    try {
      await deleteEvidence(evidenceId);
      navigate(`/cases/${caseId}/evidence`);
    } catch (err) {
      window.alert(`Could not delete evidence: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <LoadingState label="Loading evidence…" />
      </div>
    );
  }

  if (error || !evidence) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={load} />
      </div>
    );
  }

  // The detail panel speaks the graph's node shape, so map the record onto it.
  const node = {
    evidenceId: evidence.id,
    evidenceType: evidence.type,
    person: evidence.person,
    relatedPerson: evidence.relatedPerson,
    timestamp: evidence.timestamp,
    summary: evidence.content,
  };

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/cases">Cases</Link>
        <span>/</span>
        <Link to={`/cases/${caseId}`}>{caseId}</Link>
        <span>/</span>
        <Link to={`/cases/${caseId}/evidence`}>Evidence</Link>
        <span>/</span>
        <span className="mono">{evidence.id}</span>
      </div>

      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div>
          <h1>{evidence.id}</h1>
          <p className="muted">
            {evidence.type} · {evidence.person}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate(`/cases/${caseId}`)}
          >
            View on investigation map
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="panel evidence-page-panel">
        <div className="panel-body">
          <EvidenceDetailPanel
            node={node}
            onSelectEvidence={(id) => navigate(`/cases/${caseId}/evidence/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
