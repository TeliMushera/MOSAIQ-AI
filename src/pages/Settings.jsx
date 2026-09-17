import { IconSettings } from "../components/common/icons";

export default function Settings() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">Platform configuration for MOSAIQ.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body empty-state">
          <IconSettings width={28} height={28} />
          <h3 style={{ marginTop: 14 }}>Settings are coming in a later build</h3>
          <p>
            Account, workspace, and data-source configuration will live here once MOSAIQ is
            connected to a real backend and database.
          </p>
        </div>
      </div>
    </div>
  );
}
