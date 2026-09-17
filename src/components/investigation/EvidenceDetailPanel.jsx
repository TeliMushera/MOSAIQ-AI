import { useEffect, useState } from "react";
import AecaScore from "./AecaScore";
import { fetchEvidenceAECA } from "../../api/investigation";
import { runInvestigationInsight } from "../../api/evidence";

/**
 * EvidenceDetailPanel
 * ---------------------------------------------------------------------------
 * What an investigator sees when they click one piece of evidence.
 *
 * The screen stays deliberately simple:
 *   - what the evidence is
 *   - its AECA score and level
 *   - what other evidence it connects to
 *   - the AI investigation insight (on request)
 *
 * Everything technical — hash, integrity, score maths, correlation reasons —
 * is hidden behind a single "Show details" toggle.
 * ---------------------------------------------------------------------------
 */

function fmtTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export default function EvidenceDetailPanel({ node, onSelectEvidence }) {
  const [aeca, setAeca] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showDetails, setShowDetails] = useState(false);

  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const evidenceId = node.evidenceId;

  // Reset everything whenever a different evidence node is selected.
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setAeca(null);
    setShowDetails(false);
    setInsight(null);

    fetchEvidenceAECA(evidenceId)
      .then((data) => {
        if (!cancelled) setAeca(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [evidenceId]);

  const handleInsight = async () => {
    setInsightLoading(true);
    try {
      const res = await runInvestigationInsight(evidenceId);
      setInsight(res.insight);
    } catch (err) {
      setInsight({ status: "error", message: err.message });
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <div className="detail-panel">
      {/* ---------- Header ---------- */}
      <div className="detail-head">
        <span className="detail-kind">Evidence</span>
        <h3 className="mono">{evidenceId}</h3>
        <div className="detail-tags">
          <span className="chip">{node.evidenceType}</span>
          <span className="chip">{node.person}</span>
          {node.personRole && <span className="chip">{node.personRole}</span>}
        </div>
      </div>

      {/* ---------- The plain facts ---------- */}
      <dl className="detail-facts">
        <div>
          <dt>Type</dt>
          <dd>{node.evidenceType}</dd>
        </div>
        <div>
          <dt>Person</dt>
          <dd>
            {node.person}
            {node.personRole ? ` (${node.personRole})` : ""}
          </dd>
        </div>
        {node.relatedPerson && (
          <div>
            <dt>Other party</dt>
            <dd>
              {node.relatedPerson}
              {node.relatedPersonRole ? ` (${node.relatedPersonRole})` : ""}
            </dd>
          </div>
        )}
        {node.place && (
          <div>
            <dt>Place</dt>
            <dd>{node.place}</dd>
          </div>
        )}
        <div>
          <dt>Date / time</dt>
          <dd className="mono">{fmtTime(node.timestamp)}</dd>
        </div>
      </dl>

      <div className="detail-content">{node.summary || "No content recorded."}</div>

      {/* ---------- AECA ---------- */}
      {loading && <p className="muted">Calculating AECA score…</p>}
      {error && <p className="muted">Could not load the AECA score: {error.message}</p>}

      {aeca && (
        <>
          <AecaScore score={aeca.aeca_score} level={aeca.aeca_level} />

          {/* ---------- Related evidence ---------- */}
          <div className="detail-section">
            <h4>Related evidence</h4>
            {aeca.related.length === 0 ? (
              <p className="muted">No related evidence found in this case.</p>
            ) : (
              <ul className="related-list">
                {aeca.related.map((r) => (
                  <li key={r.evidence_id}>
                    <button
                      className="related-item"
                      onClick={() => onSelectEvidence(r.evidence_id)}
                    >
                      <span className="mono related-id">{r.evidence_id}</span>
                      <span className="related-why">{r.reasons[0]}</span>
                      <span className="related-score">{r.correlation_score}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- AI insight ---------- */}
          <div className="detail-section">
            <h4>AI investigation insight</h4>

            {!insight && (
              <button
                className="btn btn-sm btn-primary"
                onClick={handleInsight}
                disabled={insightLoading}
              >
                {insightLoading ? "Analysing…" : "Generate insight"}
              </button>
            )}

            {insight && insight.status === "error" && (
              <p className="muted">{insight.message}</p>
            )}

            {insight && insight.status === "completed" && (
              <div className="insight-box">
                {/* One short paragraph describing what the records show. */}
                {insight.observed_pattern && (
                  <p className="insight-line">{insight.observed_pattern}</p>
                )}

                {/* Factual bullets drawn from the actual evidence. */}
                {insight.evidence_pattern?.length > 0 && (
                  <>
                    <p className="insight-heading">Evidence pattern</p>
                    <ul className="insight-list">
                      {insight.evidence_pattern.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}

                {aeca && (
                  <p className="insight-aeca">
                    <span className="insight-heading">AECA</span>
                    <span className={`lvl-${aeca.aeca_level.toLowerCase()}`}>
                      {aeca.aeca_score}/100 — {aeca.aeca_level}
                    </span>
                  </p>
                )}

                <p className="insight-note">
                  Generated locally by Ollama from the case and evidence data above.
                  This describes an observed pattern only. AECA measures how strongly
                  records relate to each other — it is not a statement about guilt.
                </p>
              </div>
            )}

          </div>

          {/* ---------- Everything technical, hidden by default ---------- */}
          <button
            className="btn btn-sm btn-ghost details-toggle"
            onClick={() => setShowDetails((s) => !s)}
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>

          {showDetails && (
            <div className="tech-details">
              {/* Score breakdown */}
              <h4>Score breakdown</h4>
              <table className="mini-table">
                <tbody>
                  {aeca.breakdown.map((b) => (
                    <tr key={b.label}>
                      <td>
                        <strong>{b.label}</strong>
                        <div className="muted small">{b.detail}</div>
                      </td>
                      <td className="mono num">+{b.points}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>
                      <strong>AECA score</strong>
                    </td>
                    <td className="mono num">{aeca.aeca_score}</td>
                  </tr>
                </tbody>
              </table>

              {/* Forensic risk */}
              <h4>Forensic risk factors</h4>
              <p className="muted small">
                Risk score {aeca.risk.risk_score}/100 — {aeca.risk.risk_level}
              </p>
              <ul className="reason-list">
                {aeca.risk.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>

              {/* Correlation factors */}
              <h4>Correlation factors</h4>
              {aeca.related.length === 0 ? (
                <p className="muted small">Nothing correlated with this record.</p>
              ) : (
                <ul className="reason-list">
                  {aeca.related.map((r) => (
                    <li key={r.evidence_id}>
                      <span className="mono">{r.evidence_id}</span> — score{" "}
                      {r.correlation_score}: {r.reasons.join("; ")}
                    </li>
                  ))}
                </ul>
              )}

              {/* Integrity */}
              <h4>Integrity</h4>
              <p
                className={
                  aeca.integrity.status === "Verified" ? "ok-text small" : "bad-text small"
                }
              >
                {aeca.integrity.status === "Verified"
                  ? "Hash matches the original record. Integrity confirmed."
                  : `Integrity status: ${aeca.integrity.status}. This record does not match its original hash.`}
              </p>

              <h4>SHA-256 hash</h4>
              <div className="hash-box mono">{aeca.integrity.hash || "—"}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
