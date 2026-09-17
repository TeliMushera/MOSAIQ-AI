/**
 * MOSAIQ — Case narrative
 * ---------------------------------------------------------------------------
 * Builds the short human-readable summary shown above the investigation map,
 * and the short caption shown on each evidence node.
 *
 * EVERYTHING HERE IS DATA-DRIVEN. There is deliberately no knowledge of any
 * particular kind of investigation in this file:
 *
 *   - no crime types are named or branched on
 *   - no role is assumed to exist ("victim", "suspect", "complainant" …)
 *   - no person's name appears anywhere in the code
 *   - no evidence type is assumed to be present
 *
 * The builder inspects what the case and its evidence ACTUALLY contain and
 * describes only that. A case with a victim gets a sentence mentioning the
 * victim; a case without one simply never produces that clause. The same code
 * therefore narrates a suspicious-death case, a harassment case and a
 * data-theft case without modification.
 * ---------------------------------------------------------------------------
 */

const { inferRoles } = require("./roleInference");

/** "2026-03-11T22:35:00Z" -> "11 Mar 2026". Returns "" for anything unusable. */
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-03-11T22:35:00Z" -> "11 Mar, 10:42 PM". Used on evidence nodes. */
function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
}

/** Joins a list in plain English: ["a","b","c"] -> "a, b and c". */
function joinList(items) {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * Builds a lookup of person name -> role.
 *
 * A DECLARED role (typed into the case's people list) always wins — that's
 * how a case can use its own vocabulary ("Complainant", "Suspected Account")
 * instead of the default one. Anyone left without a declared role gets one
 * INFERRED from their evidence instead, so nobody has to know in advance who
 * the witness or the person of interest is before the evidence says so.
 *
 * Matching is case-insensitive so evidence and the people list can differ in
 * capitalisation without silently losing a role.
 */
function buildRoleLookup(caseDoc, caseEvidence = []) {
  const lookup = new Map();
  for (const p of caseDoc?.people || []) {
    if (p?.name && p?.role) lookup.set(String(p.name).trim().toLowerCase(), p.role);
  }

  const inferred = inferRoles(caseEvidence);
  for (const [name, role] of inferred) {
    const key = String(name).trim().toLowerCase();
    if (!lookup.has(key)) lookup.set(key, role);
  }

  return lookup;
}

/** The role for a person, or "" when the case does not declare one. */
function roleFor(name, roleLookup) {
  return roleLookup.get(String(name || "").trim().toLowerCase()) || "";
}

/**
 * A short caption for one evidence record, built from its real fields.
 *
 * Produces whichever of these the data supports, in order of preference:
 *   "<person> -> <other>"   when there are two parties
 *   "<person>"              when there is only an owner
 *   "Ashwin Residency"      when it is a place-based record with no people
 *
 * Returns { title, subtitle, time } — the caller decides how to render them.
 */
function buildEvidenceCaption(ev) {
  const type = ev.evidence_type || ev.file_type || "Evidence";
  const person = (ev.person || ev.author || "").trim();
  const other = (ev.related_person || "").trim();
  const place = (ev.place || "").trim();

  let subtitle = "";
  if (person && other) subtitle = `${person} → ${other}`;
  else if (person && place) subtitle = `${person} · ${place}`;
  else if (person) subtitle = person;
  else if (place) subtitle = place;

  return {
    title: type,
    subtitle,
    time: formatDateTime(ev.timestamp),
  };
}

/**
 * Builds the case summary paragraph.
 *
 * The sentences are assembled from clauses that only appear when the matching
 * data exists, so the wording adapts to the case automatically.
 *
 * @param {object}   caseDoc      – the Case document
 * @param {object[]} caseEvidence – all non-deleted evidence in the case
 * @returns {{ headline: string, roles: Array<{name,role}>, facts: object }}
 */
function buildCaseSummary(caseDoc, caseEvidence = []) {
  const sentences = [];

  // ---- Who plays what part? -------------------------------------------------
  // A declared role (typed into the case) always wins; everyone else's role
  // is inferred from their evidence, so the summary reflects the same roles
  // the investigation map shows — nobody has to be labelled by hand first.
  const roleLookup = buildRoleLookup(caseDoc, caseEvidence);
  const named = new Map(); // lowercase name -> display name, preserving case
  for (const p of caseDoc?.people || []) {
    if (p?.name) named.set(String(p.name).trim().toLowerCase(), String(p.name).trim());
  }
  for (const ev of caseEvidence) {
    const owner = (ev.person || ev.author || "").trim();
    if (owner) named.set(owner.toLowerCase(), owner);
    const other = (ev.related_person || "").trim();
    if (other) named.set(other.toLowerCase(), other);
  }

  const declared = [];
  for (const [key, displayName] of named) {
    const role = roleLookup.get(key);
    if (role) declared.push({ name: displayName, role });
  }

  // Group by role so several people sharing a role read naturally.
  const byRole = new Map();
  for (const p of declared) {
    if (!byRole.has(p.role)) byRole.set(p.role, []);
    byRole.get(p.role).push(p.name);
  }

  // ---- Sentence 1: who is involved, by role -------------------------------
  // e.g. "<name> is recorded as the <role> in this case."
  // If the case declares no roles at all, this sentence is simply skipped.
  if (byRole.size > 0) {
    const clauses = [...byRole.entries()].map(([role, names]) => {
      const who = joinList(names);
      const plural = names.length > 1;
      return `${who} ${plural ? "are" : "is"} recorded as ${
        plural ? `${role}s` : `the ${role}`
      }`;
    });
    sentences.push(`${joinList(clauses)} in this case.`);
  }

  // ---- Sentence 2: what the case is and what it examines ------------------
  // The evidence types are read off the actual records, never assumed.
  const typeCounts = new Map();
  for (const ev of caseEvidence) {
    const t = ev.evidence_type || ev.file_type || "Evidence";
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }

  // Most common types first, so the summary leads with what dominates.
  const types = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t.toLowerCase());

  const caseType = (caseDoc?.case_type || "").trim();
  const subject = caseType ? `this ${caseType.toLowerCase()} investigation` : "this case";

  if (types.length > 0) {
    sentences.push(
      `The case examines ${caseEvidence.length} digital evidence ` +
        `record${caseEvidence.length === 1 ? "" : "s"} in ${subject}, covering ` +
        `${
          types.length > 4
            ? `${types.slice(0, 4).join(", ")} and other record types`
            : joinList(types)
        }.`
    );
  } else {
    sentences.push(`No digital evidence has been added to ${subject} yet.`);
  }

  // ---- Sentence 3: when ----------------------------------------------------
  // Prefer an explicitly recorded incident date; otherwise describe the span
  // the evidence itself covers. If neither exists, say nothing about time.
  const times = caseEvidence
    .map((ev) => new Date(ev.timestamp))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a - b);

  const incidentDate = formatDate(caseDoc?.incident_date);
  const firstSeen = times.length ? formatDate(times[0]) : "";
  const lastSeen = times.length ? formatDate(times[times.length - 1]) : "";

  if (incidentDate) {
    sentences.push(`The reported incident date is ${incidentDate}.`);
  } else if (firstSeen && lastSeen && firstSeen !== lastSeen) {
    sentences.push(`The records span ${firstSeen} to ${lastSeen}.`);
  } else if (firstSeen) {
    sentences.push(`The records are dated ${firstSeen}.`);
  }

  return {
    headline: sentences.join(" "),

    // The role list the UI renders as "<role>: <name>" style chips.
    // Empty when the case declares no roles — the UI then shows nothing.
    roles: declared.map((p) => ({ name: p.name, role: p.role })),

    facts: {
      caseType: caseDoc?.case_type || "",
      incidentDate: caseDoc?.incident_date || "",
      incidentLocation: caseDoc?.incident_location || "",
      evidenceTypes: [...typeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count })),
      firstRecord: times.length ? times[0].toISOString() : "",
      lastRecord: times.length ? times[times.length - 1].toISOString() : "",
    },
  };
}

module.exports = {
  buildCaseSummary,
  buildEvidenceCaption,
  buildRoleLookup,
  roleFor,
  formatDate,
  formatDateTime,
};
