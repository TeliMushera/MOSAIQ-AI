import { useEffect, useState, useCallback } from "react";
import SearchFilterBar from "../components/common/SearchFilterBar";
import EvidenceTable from "../components/evidence/EvidenceTable";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import { fetchEvidence, fetchFilterOptions, deleteEvidence } from "../api/evidence";
import { fetchCases } from "../api/cases";

const SORTS = [
  { label: "Newest first", sort: "timestamp", order: "desc" },
  { label: "Oldest first", sort: "timestamp", order: "asc" },
  { label: "Evidence ID", sort: "evidence_id", order: "asc" },
];

export default function GlobalEvidence() {
  const [search, setSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState("");
  const [fileType, setFileType] = useState("");
  const [severity, setSeverity] = useState("");
  const [sortLabel, setSortLabel] = useState(SORTS[0].label);
  const [page, setPage] = useState(1);

  const [cases, setCases] = useState([]);
  const [options, setOptions] = useState({ file_type: [], severity: [] });
  const [result, setResult] = useState({ data: [], pagination: { page: 1, total: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCases().then(setCases).catch(() => {});
    fetchFilterOptions().then(setOptions).catch(() => {});
  }, []);

  const sortObj = SORTS.find((s) => s.label === sortLabel) || SORTS[0];
  const caseNameById = Object.fromEntries(cases.map((c) => [c.id, c.name]));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchEvidence({
      search,
      case_id: caseFilter,
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
  }, [search, caseFilter, fileType, severity, sortObj.sort, sortObj.order, page]);

  useEffect(() => {
    setPage(1);
  }, [search, caseFilter, fileType, severity, sortLabel]);

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
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Evidence</h1>
          <p className="page-sub">
            All evidence collected across every case. Open a case to work within its own
            evidence set.
          </p>
        </div>
      </div>

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search by evidence ID, filename, author, department, content…"
        filters={[
          {
            name: "case",
            label: "All cases",
            value: caseFilter,
            onChange: setCaseFilter,
            options: cases.map((c) => c.id),
          },
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
          { name: "sort", label: "Sort", value: sortLabel, onChange: setSortLabel, options: SORTS.map((s) => s.label) },
        ]}
      />

      {caseFilter && (
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 10 }}>
          Filtered to {caseNameById[caseFilter] || caseFilter}
        </p>
      )}

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
    </div>
  );
}
