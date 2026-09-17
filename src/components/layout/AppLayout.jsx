import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-col">
        <Header />
        <Outlet />
      </div>
    </div>
  );
}
