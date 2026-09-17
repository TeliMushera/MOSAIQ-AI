import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "../common/StatusBadge";
import { IconTrash } from "../common/icons";

const PAGE_SIZE = 10;

// If `pagination` is supplied ({ page, limit, total, totalPages, onPageChange })
// the table is driven by server-side pagination and `evidence` is just the
// current page of rows. Otherwise it falls back to client-side pagination
// over the full `evidence` array (used by in-page search results lists).
export default function EvidenceTable({ evidence, onDelete, pagination }) {
  const [localPage, setLocalPage] = useState(1);
  const navigate = useNavigate();

  const serverDriven = Boolean(pagination);
  const pageCount = serverDriven
    ? Math.max(1, pagination.totalPages)
    : Math.max(1, Math.ceil(evidence.length / PAGE_SIZE));
  const clampedPage = serverDriven ? pagination.page : Math.min(localPage, pageCount);
  const total = serverDriven ? pagination.total : evidence.length;
  const limit = serverDriven ? pagination.limit : PAGE_SIZE;

  const visible = useMemo(() => {
    if (serverDriven) return evidence;
    const start = (clampedPage - 1) * PAGE_SIZE;
    return evidence.slice(start, start + PAGE_SIZE);
  }, [evidence, clampedPage, serverDriven]);

  const goToPage = (p) => {
    if (serverDriven) pagination.onPageChange(p);
    else setLocalPage(p);
  };

  const openEvidence = (ev) => {
    navigate(`/cases/${ev.caseId}/evidence/${ev.id}`);
  };

  const handleDelete = (e, ev) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (window.confirm(`Move evidence ${ev.id} — "${ev.fileName}" — to the recycle bin?`)) {
      onDelete(ev);
    }
  };

  if (evidence.length === 0) {
    return (
      <div className="empty-state">
        <h3>No evidence matches these filters</h3>
        <p>Try a different keyword or clear a filter to widen the results.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Evidence ID</th>
              <th>Type</th>
              <th>Person</th>
              <th>Date / time</th>
              <th>Content</th>
              <th>Source</th>
              <th>Integrity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((ev) => (
              <tr key={ev.id} onClick={() => openEvidence(ev)} style={{ cursor: "pointer" }}>
                <td className="cell-id">{ev.id}</td>
                <td>
                  <span className="chip chip-sm">{ev.type}</span>
                </td>
                <td className="cell-muted">
                  <span className="cell-truncate cell-truncate-sm" title={ev.person}>
                    {ev.person || "—"}
                  </span>
                </td>
                <td className="cell-mono">{ev.timestamp}</td>
                <td className="cell-muted">
                  <span className="cell-truncate" title={ev.content}>
                    {ev.content}
                  </span>
                </td>
                <td className="cell-muted">
                  <span className="cell-truncate cell-truncate-sm" title={ev.source}>
                    {ev.source}
                  </span>
                </td>
                <td>
                  <StatusBadge status={ev.status} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-sm btn-ghost row-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEvidence(ev);
                      }}
                    >
                      View
                    </button>
                    {onDelete && (
                      <button
                        className="btn btn-sm btn-danger"
                        title="Delete evidence"
                        onClick={(e) => handleDelete(e, ev)}
                      >
                        <IconTrash width={13} height={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          Showing {(clampedPage - 1) * limit + 1}–
          {Math.min(clampedPage * limit, total)} of {total} records
        </span>
        <div className="pager">
          <button disabled={clampedPage === 1} onClick={() => goToPage(clampedPage - 1)}>
            ‹
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1)
            .slice(Math.max(0, clampedPage - 3), Math.max(0, clampedPage - 3) + 5)
            .map((p) => (
              <button
                key={p}
                className={p === clampedPage ? "active" : ""}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}
          <button disabled={clampedPage === pageCount} onClick={() => goToPage(clampedPage + 1)}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
