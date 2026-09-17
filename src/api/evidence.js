import { apiGet, apiPost, apiDelete, toQueryString } from "./client";
import { adaptEvidence, adaptEvidenceList } from "./adapters";

// Returns { data: adaptedEvidence[], pagination }
export async function fetchEvidence(params = {}) {
  const qs = toQueryString(params);
  const res = await apiGet(`/evidence${qs}`);
  return { data: adaptEvidenceList(res.data), pagination: res.pagination };
}

export async function fetchEvidenceById(evidenceId) {
  const data = await apiGet(`/evidence/${encodeURIComponent(evidenceId)}`);
  return adaptEvidence(data);
}

export async function fetchFilterOptions() {
  return apiGet("/evidence/filter-options");
}

export async function createManualEvidence(payload) {
  const data = await apiPost("/evidence", payload);
  return adaptEvidence(data);
}

export async function uploadEvidenceFile({ file, case_id, case_name, author, department, source }) {
  const form = new FormData();
  form.append("file", file);
  form.append("case_id", case_id);
  if (case_name) form.append("case_name", case_name);
  if (author) form.append("author", author);
  if (department) form.append("department", department);
  if (source) form.append("source", source);
  const data = await apiPost("/evidence/upload", form);
  return adaptEvidence(data);
}

export async function deleteEvidence(evidenceId) {
  return apiDelete(`/evidence/${encodeURIComponent(evidenceId)}`);
}

export async function fetchEvidenceAnalysis(evidenceId) {
  return apiGet(`/evidence/${encodeURIComponent(evidenceId)}/analysis`);
}

export async function runAIAnalysis(evidenceId) {
  return apiPost(`/evidence/${encodeURIComponent(evidenceId)}/ai-analysis`, {});
}

export async function reverifyIntegrity(evidenceId) {
  return apiPost(`/evidence/${encodeURIComponent(evidenceId)}/reverify-integrity`, {});
}

export async function fetchRelatedEvidence(evidenceId) {
  return apiGet(`/evidence/${encodeURIComponent(evidenceId)}/related`);
}

export async function runInvestigationInsight(evidenceId) {
  return apiPost(`/evidence/${encodeURIComponent(evidenceId)}/investigation-insight`, {});
}
