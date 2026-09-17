import { apiGet, apiPost, apiDelete } from "./client";
import { adaptCaseList, adaptEvidenceList } from "./adapters";

export async function fetchDeletedCases() {
  const data = await apiGet("/recycle-bin/cases");
  return adaptCaseList(data);
}

export async function restoreCase(caseId) {
  return apiPost(`/recycle-bin/cases/${encodeURIComponent(caseId)}/restore`, {});
}

export async function permanentlyDeleteCase(caseId) {
  return apiDelete(`/recycle-bin/cases/${encodeURIComponent(caseId)}`);
}

export async function fetchDeletedEvidence() {
  const data = await apiGet("/recycle-bin/evidence");
  return adaptEvidenceList(data);
}

export async function restoreEvidence(evidenceId) {
  return apiPost(`/recycle-bin/evidence/${encodeURIComponent(evidenceId)}/restore`, {});
}

export async function permanentlyDeleteEvidence(evidenceId) {
  return apiDelete(`/recycle-bin/evidence/${encodeURIComponent(evidenceId)}`);
}
