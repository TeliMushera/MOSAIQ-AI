import { NavLink } from "react-router-dom";
import {
  IconFolder,
  IconEvidence,
  IconSettings,
  IconTrash,
} from "../common/icons";

const NAV_ITEMS = [
  { to: "/cases", label: "Cases", icon: IconFolder },
  { to: "/evidence", label: "All evidence", icon: IconEvidence },
  { to: "/recycle-bin", label: "Recycle bin", icon: IconTrash },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="mark">M</div>
        <div>
          <div className="brand-name">MOSAIQ</div>
          <div className="brand-sub">DIGITAL FORENSICS</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              "sidebar-link" + (isActive ? " active" : "")
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        MOSAIQ v0.2 — Prototype
        <br />
        Connected to live backend
      </div>
    </aside>
  );
}
