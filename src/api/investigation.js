import { apiGet } from "./client";

/**
 * The investigation map for one case: { case, nodes, links, people, stats }.
 * The backend decides the structure; the map component decides the drawing.
 */
export async function fetchCaseGraph(caseId) {
  return apiGet(`/cases/${encodeURIComponent(caseId)}/graph`);
}

/**
 * The AECA investigation score for one evidence record, with the full
 * breakdown, the related evidence and the integrity information.
 */
export async function fetchEvidenceAECA(evidenceId) {
  return apiGet(`/evidence/${encodeURIComponent(evidenceId)}/aeca`);
}
