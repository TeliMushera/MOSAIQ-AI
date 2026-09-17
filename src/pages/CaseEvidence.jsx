import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import SearchFilterBar from "../components/common/SearchFilterBar";
import EvidenceTable from "../components/evidence/EvidenceTable";
import AddEvidenceModal from "../components/evidence/AddEvidenceModal";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import { fetchCaseEvidence } from "../api/cases";
import { fetchFilterOptions } from "../api/evidence";
import { deleteEvidence } from "../api/evidence";
import { IconPlus } from "../components/common/icons";

const SORTS = [
  { label: "Newest first", sort: "timestamp", order: "desc" },
  { label: "Oldest first", sort: "timestamp", order: "asc" },
  { label: "Evidence ID", sort: "evidence_id", order: "asc" },
];

export default function CaseEvidence() {
  const { caseInfo } = useOutletContext();
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState("");
  const [severity, setSeverity] = useState("");
  const [sortLabel, setSortLabel] = useState(SORTS[0].label);
  const [showAdd, setShowAdd] = useState(false);

  const [options, setOptions] = useState({ file_type: [], severity: [] });
  const [result, setResult] = useState({ data: [], pagination: { page: 1, total: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchFilterOptions().then(setOptions).catch(() => {});
  }, []);

  const sortObj = SORTS.find((s) => s.label === sortLabel) || SORTS[0];

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCaseEvidence(caseInfo.id, {
      search,
      file_type: fileType,
      severity,
      sort: sortObj.sort,
      order: sortObj.order,
      page,
      limit: 10,
    })
      .then(setResult)
      .catch(setError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseInfo.id, search, fileType, severity, sortObj.sort, sortObj.order, page]);

  useEffect(() => {
    setPage(1);
  }, [search, fileType, severity, sortLabel]);

  useEffect(load, [load]);

  const handleDelete = async (ev) => {
    try {
      await deleteEvidence(ev.id);
      load();
    } catch (err) {
      window.alert(`Could not delete evidence: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {result.pagination.total} evidence records collected for {caseInfo.name}.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <IconPlus width={14} height={14} />
          Add evidence
        </button>
      </div>

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search by evidence ID, filename, author, department, content…"
        filters={[
          {
            name: "fileType",
            label: "All file types",
            value: fileType,
            onChange: setFileType,
            options: options.file_type,
          },
          {
            name: "severity",
            label: "All severities",
            value: severity,
            onChange: setSeverity,
            options: options.severity,
          },
          {
            name: "sort",
            label: "Sort",
            value: sortLabel,
            onChange: setSortLabel,
            options: SORTS.map((s) => s.label),
          },
        ]}
      />

      <ErrorState error={error} onRetry={load} />

      {loading ? (
        <LoadingState label="Loading evidence…" />
      ) : (
        <EvidenceTable
          evidence={result.data}
          onDelete={handleDelete}
          pagination={{ ...result.pagination, onPageChange: setPage }}
        />
      )}

      {showAdd && (
        <AddEvidenceModal
          caseId={caseInfo.id}
          caseName={caseInfo.name}
          onClose={() => setShowAdd(false)}
          onEvidenceAdded={load}
        />
      )}
    </div>
  );
}
