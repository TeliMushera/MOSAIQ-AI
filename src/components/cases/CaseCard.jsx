import { useNavigate } from "react-router-dom";
import StatusBadge from "../common/StatusBadge";
import { IconChevronRight, IconTrash } from "../common/icons";

export default function CaseCard({ caseInfo, onDelete }) {
  const navigate = useNavigate();
  const { id, name, type, description, status, evidenceCount } = caseInfo;

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (window.confirm(`Move case ${id} — "${name}" — to the recycle bin? Its evidence will move too.`)) {
      onDelete(id);
    }
  };

  return (
    <div className="case-card">
      <div className="case-card-tab">
        <span className="case-card-id">{id}</span>
        <StatusBadge status={status} />
      </div>
      <div className="case-card-body">
        <div>
          <h3>{name}</h3>
          <span className="case-type">{type}</span>
        </div>
        <p className="case-desc">{description}</p>
        <div className="case-card-footer">
          <span className="case-evidence-count">
            Evidence: <strong>{evidenceCount}</strong>
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {onDelete && (
              <button
                className="btn btn-sm btn-danger"
                title="Delete case"
                onClick={handleDelete}
              >
                <IconTrash width={13} height={13} />
              </button>
            )}
            <button
              className="btn btn-sm btn-primary"
              onClick={() => navigate(`/cases/${id}`)}
            >
              Open case
              <IconChevronRight width={14} height={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
