const VARIANT_BY_STATUS = {
  Active: "badge-active",
  Verified: "badge-verified",
  "Under Review": "badge-review",
  Closed: "badge-closed",
  Flagged: "badge-flag",
};

export default function StatusBadge({ status }) {
  const variant = VARIANT_BY_STATUS[status] || "badge-closed";
  return <span className={`badge ${variant}`}>{status}</span>;
}
