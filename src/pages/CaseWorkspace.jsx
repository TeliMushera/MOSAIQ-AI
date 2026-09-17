import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { fetchCase, deleteCase } from "../api/cases";
import StatusBadge from "../components/common/StatusBadge";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import { IconTrash } from "../components/common/icons";

export default function CaseWorkspace() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseInfo, setCaseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchCase(caseId)
      .then(setCaseInfo)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(load, [caseId]);

  const handleDeleteCase = async () => {
    if (!window.confirm(`Move case ${caseId} to the recycle bin? Its evidence will move too.`)) return;
    setDeleting(true);
    try {
      await deleteCase(caseId);
      navigate("/cases");
    } catch (err) {
      window.alert(`Could not delete case: ${err.message}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <LoadingState label="Loading case…" />
      </div>
    );
  }

  if (error || !caseInfo) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={load} />
        {!error && (
          <div className="empty-state">
            <h3>Case not found</h3>
            <p>No case exists with ID "{caseId}".</p>
          </div>
        )}
      </div>
    );
  }

  // Two views only: the map, and the flat evidence list behind it.
  const tabs = [
    { to: `/cases/${caseId}`, label: "Investigation", end: true },
    { to: `/cases/${caseId}/evidence`, label: "Evidence" },
  ];

  return (
    <div className="page">
      <div className="case-header">
        <div className="case-header-top">
          <div>
            <div className="case-header-id">{caseInfo.id}</div>
            <h1>{caseInfo.name}</h1>
            <span className="case-type">{caseInfo.type}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBadge status={caseInfo.status} />
            <button className="btn btn-sm btn-danger" onClick={handleDeleteCase} disabled={deleting}>
              <IconTrash width={13} height={13} />
              {deleting ? "Deleting…" : "Delete case"}
            </button>
          </div>
        </div>
      </div>

      <div className="tab-row">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => "tab-item" + (isActive ? " active" : "")}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ caseInfo }} />
    </div>
  );
}
