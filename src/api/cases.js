import { apiGet, apiPost, apiPut, apiDelete, toQueryString } from "./client";
import { adaptCase, adaptCaseList, adaptEvidenceList } from "./adapters";

export async function fetchCases() {
  const data = await apiGet("/cases");
  return adaptCaseList(data);
}

export async function fetchCase(caseId) {
  const data = await apiGet(`/cases/${encodeURIComponent(caseId)}`);
  return adaptCase(data);
}

export async function createCase({
  name,
  type,
  description,
  lead,
  opened,
  status,
  people,
  incident_date,
  incident_location,
}) {
  const data = await apiPost("/cases", {
    case_name: name,
    case_type: type,
    description,
    lead,
    opened,
    status,
    people,
    incident_date,
    incident_location,
  });
  return adaptCase(data);
}

export async function updateCase(caseId, updates) {
  const data = await apiPut(`/cases/${encodeURIComponent(caseId)}`, updates);
  return adaptCase(data);
}

export async function deleteCase(caseId) {
  return apiDelete(`/cases/${encodeURIComponent(caseId)}`);
}

// Returns { data: adaptedEvidence[], pagination } for evidence scoped to a case.
export async function fetchCaseEvidence(caseId, params = {}) {
  const qs = toQueryString(params);
  const res = await apiGet(`/cases/${encodeURIComponent(caseId)}/evidence${qs}`);
  return { data: adaptEvidenceList(res.data), pagination: res.pagination };
}

export async function fetchCaseStatistics(caseId) {
  return apiGet(`/cases/${encodeURIComponent(caseId)}/statistics`);
}
