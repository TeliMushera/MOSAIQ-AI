import { useCallback, useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import InvestigationMap from "../components/graph/InvestigationMap";
import AecaScore from "../components/investigation/AecaScore";
import EvidenceDetailPanel from "../components/investigation/EvidenceDetailPanel";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import { fetchCaseGraph } from "../api/investigation";

/**
 * CaseInvestigation — the main screen of MOSAIQ.
 * ---------------------------------------------------------------------------
 * It answers one question: what happened, who is involved, and what evidence
 * is connected?
 *
 *   Case summary
 *     -> Investigation map (the centrepiece)
 *       -> click a person   -> their evidence
 *       -> click evidence   -> AECA score, related evidence, AI insight
 *                              and "Show details" for the technical layer
 * ---------------------------------------------------------------------------
 */

export default function CaseInvestigation() {
  const { caseInfo } = useOutletContext();
  const navigate = useNavigate();

  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The currently clicked node. null means "nothing selected — show the case".
  const [selected, setSelected] = useState(null);
  const [showConnections, setShowConnections] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCaseGraph(caseInfo.id)
      .then((data) => {
        setGraph(data);
        setSelected(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [caseInfo.id]);

  useEffect(load, [load]);

  /** Select a node by its evidence id — used by the "related evidence" links. */
  const selectEvidenceById = (evidenceId) => {
    const node = graph?.nodes.find(
      (n) => n.type === "evidence" && n.evidenceId === evidenceId
    );
    if (node) setSelected(node);
  };

  /** Select a person by name — used by the people list in the side panel. */
  const selectPersonByName = (name) => {
    const node = graph?.nodes.find((n) => n.type === "person" && n.label === name);
    if (node) setSelected(node);
  };

  if (loading) return <LoadingState label="Building the investigation map…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!graph) return null;

  const { stats, people } = graph;

  // Evidence belonging to the selected person, for the side panel.
  const personEvidence =
    selected?.type === "person"
      ? graph.nodes.filter((n) => n.type === "evidence" && n.person === selected.label)
      : [];

  return (
    <div className="investigation">
      {/* ================= 1. Case summary ================================== */}
      <div className="case-summary">
        <div className="case-summary-left">
          <h4 className="case-summary-title">Case summary</h4>

          {/* The summary sentence is composed by the backend from this case's
              own data — roles (typed in, or inferred from the evidence when
              they weren't), evidence types and dates. A case with no evidence
              yet produces different wording automatically, with no change
              here. */}
          <p className="case-summary-text">
            {graph.summary?.headline || caseInfo.description}
          </p>

          {/* Role chips appear for every person who has a role — typed in or
              inferred. Nobody is assumed to have one before their evidence
              says so. */}
          {graph.summary?.roles?.length > 0 && (
            <div className="role-chips">
              {graph.summary.roles.map((r) => (
                <button
                  key={r.name}
                  className="role-chip"
                  onClick={() => selectPersonByName(r.name)}
                  title={`Show ${r.name} on the map`}
                >
                  <span className="role-chip-role">{r.role}</span>
                  <span className="role-chip-name">{r.name}</span>
                </button>
              ))}
            </div>
          )}

          <p className="case-summary-meta">
            {caseInfo.type ? `${caseInfo.type} · ` : ""}
            {stats.peopleCount} people · {stats.evidenceCount} evidence items ·{" "}
            {stats.connectionCount} connections found
          </p>
        </div>

        <AecaScore
          score={stats.caseAecaScore}
          level={stats.caseAecaLevel}
          label="Highest AECA in case"
        />
      </div>

      {/* ================= 2. The map + the side panel ====================== */}
      <div className="investigation-body">
        <div className="panel map-panel">
          <div className="panel-header">
            <span>Investigation map</span>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showConnections}
                onChange={(e) => setShowConnections(e.target.checked)}
              />
              Show evidence connections
            </label>
          </div>

          <InvestigationMap
            graph={graph}
            selectedId={selected?.id || null}
            onSelect={setSelected}
            showConnections={showConnections}
          />
        </div>

        {/* ---- Side panel: changes with what you clicked ---- */}
        <div className="panel side-panel">
          <div className="panel-header">
            <span>
              {selected?.type === "evidence"
                ? "Evidence"
                : selected?.type === "person"
                ? "Person"
                : "Case"}
            </span>
            {selected && (
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>
                Clear
              </button>
            )}
          </div>

          <div className="panel-body side-panel-body">
            {/* ---- Nothing selected: the case itself ---- */}
            {(!selected || selected.type === "case") && (
              <div className="detail-panel">
                <div className="detail-head">
                  <span className="detail-kind">Case</span>
                  <h3 className="mono">{caseInfo.id}</h3>
                </div>

                <p className="detail-content">{caseInfo.description}</p>

                <dl className="detail-facts">
                  <div>
                    <dt>Type</dt>
                    <dd>{caseInfo.type}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{caseInfo.status}</dd>
                  </div>
                  <div>
                    <dt>Lead</dt>
                    <dd>{caseInfo.leadInvestigator}</dd>
                  </div>
                  <div>
                    <dt>Opened</dt>
                    <dd className="mono">{caseInfo.opened}</dd>
                  </div>
                </dl>

                <div className="detail-section">
                  <h4>People involved</h4>
                  <ul className="people-list">
                    {people.map((p) => (
                      <li key={p.id}>
                        <button
                          className="people-item"
                          onClick={() => selectPersonByName(p.label)}
                        >
                          <span className="people-name">{p.label}</span>
                          <span className="people-count">
                            {p.role
                              ? p.role
                              : `${p.evidenceCount} item${p.evidenceCount === 1 ? "" : "s"}`}
                          </span>
                          <span className={`people-level lvl-${p.aecaLevel.toLowerCase()}`}>
                            {p.aecaScore}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="muted small">Click any node on the map to explore it.</p>
              </div>
            )}

            {/* ---- A person is selected ---- */}
            {selected?.type === "person" && (
              <div className="detail-panel">
                <div className="detail-head">
                  <span className="detail-kind">Person</span>
                  <h3>{selected.label}</h3>
                  {/* Shown whenever this person has a role — typed in or inferred. */}
                  {selected.role && <p className="person-role">{selected.role}</p>}
                </div>

                <p className="person-stat">
                  {selected.evidenceCount} connected evidence item
                  {selected.evidenceCount === 1 ? "" : "s"}
                </p>

                {/* The evidence types this person actually has, read off their
                    records. No type is assumed to be present. */}
                {selected.evidenceTypes?.length > 0 && (
                  <p className="person-types">
                    {selected.evidenceTypes.map((t) => t.type).join(" · ")}
                  </p>
                )}

                <AecaScore
                  score={selected.aecaScore}
                  level={selected.aecaLevel}
                  label="Highest AECA for this person"
                />

                <div className="detail-section">
                  <h4>Evidence connected to {selected.label}</h4>
                  <ul className="related-list">
                    {personEvidence.map((ev) => (
                      <li key={ev.id}>
                        <button className="related-item" onClick={() => setSelected(ev)}>
                          <span className="mono related-id">{ev.evidenceId}</span>
                          <span className="related-why">{ev.evidenceType}</span>
                          <span className={`related-score lvl-${ev.aecaLevel.toLowerCase()}`}>
                            {ev.aecaScore}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="muted small">
                  A person's score is the highest AECA score among their evidence. AECA
                  reflects the strength of relationships among the available evidence
                  and case entities. It is a prioritisation score, not a statement
                  about what anyone did.
                </p>
              </div>
            )}

            {/* ---- An evidence item is selected ---- */}
            {selected?.type === "evidence" && (
              <>
                <EvidenceDetailPanel
                  node={selected}
                  onSelectEvidence={selectEvidenceById}
                />
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={() =>
                    navigate(`/cases/${caseInfo.id}/evidence/${selected.evidenceId}`)
                  }
                >
                  Open full evidence record
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
