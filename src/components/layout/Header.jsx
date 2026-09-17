import { useLocation, useParams } from "react-router-dom";

const ROUTE_LABELS = {
  cases: "Cases",
  evidence: "Evidence",
  settings: "Settings",
  "recycle-bin": "Recycle bin",
};

function buildCrumbs(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Cases" }];

  const crumbs = [];
  if (parts[0] === "cases" && parts[1]) {
    crumbs.push({ label: "Cases", to: "/cases" });
    crumbs.push({ label: parts[1] });
    if (parts[2]) {
      crumbs.push({ label: ROUTE_LABELS[parts[2]] || parts[2] });
    }
    if (parts[3] && parts[2] === "evidence") {
      crumbs.push({ label: parts[3] });
    }
  } else {
    crumbs.push({ label: ROUTE_LABELS[parts[0]] || parts[0] });
  }
  return crumbs;
}

export default function Header() {
  const location = useLocation();
  useParams();
  const crumbs = buildCrumbs(location.pathname);

  return (
    <header className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? "crumb-current" : ""}>
              {c.label}
            </span>
          </span>
        ))}
      </div>
      <div className="topbar-right">
        <div className="topbar-badge">
          <span className="dot" />
          Connected — live backend
        </div>
        <div className="topbar-user">IV</div>
      </div>
    </header>
  );
}
