import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import StatusBadge from "../components/common/StatusBadge";
import { IconRestore, IconTrash } from "../components/common/icons";
import {
  fetchDeletedCases,
  fetchDeletedEvidence,
  restoreCase,
  restoreEvidence,
  permanentlyDeleteCase,
  permanentlyDeleteEvidence,
} from "../api/recycleBin";

export default function RecycleBin() {
  const [tab, setTab] = useState("cases"); // "cases" | "evidence"
  const [cases, setCases] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchDeletedCases(), fetchDeletedEvidence()])
      .then(([c, e]) => {
        setCases(c);
        setEvidence(e);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRestoreCase = async (id) => {
    try {
      await restoreCase(id);
      load();
    } catch (err) {
      window.alert(`Could not restore case: ${err.message}`);
    }
  };

  const handlePermanentCase = async (id) => {
    if (!window.confirm(`Permanently delete case ${id} and all of its evidence? This cannot be undone.`))
      return;
    try {
      await permanentlyDeleteCase(id);
      load();
    } catch (err) {
      window.alert(`Could not permanently delete case: ${err.message}`);
    }
  };

  const handleRestoreEvidence = async (id) => {
    try {
      await restoreEvidence(id);
      load();
    } catch (err) {
      window.alert(`Could not restore evidence: ${err.message}`);
    }
  };

  const handlePermanentEvidence = async (id) => {
    if (!window.confirm(`Permanently delete evidence ${id}? This cannot be undone.`)) return;
    try {
      await permanentlyDeleteEvidence(id);
      load();
    } catch (err) {
      window.alert(`Could not permanently delete evidence: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Recycle bin</h1>
          <p className="page-sub">
            Deleted cases and evidence are kept here until you restore them or delete them
            permanently.
          </p>
        </div>
      </div>

      <div className="recycle-tab-row">
        <button
          className={`btn btn-sm ${tab === "cases" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("cases")}
        >
          Deleted cases ({cases.length})
        </button>
        <button
          className={`btn btn-sm ${tab === "evidence" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("evidence")}
        >
          Deleted evidence ({evidence.length})
        </button>
      </div>

      <ErrorState error={error} onRetry={load} />

      {loading ? (
        <LoadingState label="Loading recycle bin…" />
      ) : tab === "cases" ? (
        cases.length === 0 ? (
          <div className="empty-state">
            <h3>No deleted cases</h3>
            <p>Cases you delete will show up here until restored or permanently removed.</p>
          </div>
        ) : (
          <div className="panel">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Evidence count</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id}>
                      <td className="cell-id">{c.id}</td>
                      <td>{c.name}</td>
                      <td className="cell-muted">{c.type}</td>
                      <td className="cell-mono">{c.evidenceCount}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleRestoreCase(c.id)}
                          >
                            <IconRestore width={13} height={13} />
                            Restore
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handlePermanentCase(c.id)}
                          >
                            <IconTrash width={13} height={13} />
                            Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : evidence.length === 0 ? (
        <div className="empty-state">
          <h3>No deleted evidence</h3>
          <p>Evidence you delete will show up here until restored or permanently removed.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Evidence ID</th>
                  <th>Case ID</th>
                  <th>File name</th>
                  <th>Author</th>
                  <th>Timestamp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((ev) => (
                  <tr key={ev.id}>
                    <td className="cell-id">{ev.id}</td>
                    <td
                      className="cell-mono row-link"
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/cases/${ev.caseId}`)}
                    >
                      {ev.caseId}
                    </td>
                    <td className="cell-muted">{ev.fileName}</td>
                    <td className="cell-muted">{ev.user}</td>
                    <td className="cell-mono">{ev.timestamp}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleRestoreEvidence(ev.id)}
                        >
                          <IconRestore width={13} height={13} />
                          Restore
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handlePermanentEvidence(ev.id)}
                        >
                          <IconTrash width={13} height={13} />
                          Delete forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
