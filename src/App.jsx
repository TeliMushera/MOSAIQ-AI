import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Cases from "./pages/Cases";
import CaseWorkspace from "./pages/CaseWorkspace";
import CaseInvestigation from "./pages/CaseInvestigation";
import CaseEvidence from "./pages/CaseEvidence";
import EvidenceDetails from "./pages/EvidenceDetails";
import GlobalEvidence from "./pages/GlobalEvidence";
import RecycleBin from "./pages/RecycleBin";
import Settings from "./pages/Settings";

/**
 * MOSAIQ routes.
 *
 * The whole application is one short path:
 *
 *   Cases -> a case -> the investigation map -> a person or evidence
 *
 * The evidence table and the recycle bin sit beside that path as supporting
 * screens. There is no separate dashboard: the investigation map IS the
 * dashboard.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* The case list is the front door. */}
        <Route path="/" element={<Navigate to="/cases" replace />} />
        <Route path="/cases" element={<Cases />} />

        <Route path="/cases/:caseId" element={<CaseWorkspace />}>
          {/* The investigation map is the default view of a case. */}
          <Route index element={<CaseInvestigation />} />
          <Route path="evidence" element={<CaseEvidence />} />
        </Route>

        <Route path="/cases/:caseId/evidence/:evidenceId" element={<EvidenceDetails />} />

        <Route path="/evidence" element={<GlobalEvidence />} />
        <Route path="/recycle-bin" element={<RecycleBin />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
