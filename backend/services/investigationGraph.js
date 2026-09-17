/**
 * MOSAIQ — Investigation Graph Builder
 * ---------------------------------------------------------------------------
 * Turns the evidence of one case into a simple relationship graph:
 *
 *        CASE
 *          |
 *      +---+---+
 *      |       |
 *   Person A  Person B
 *      |       |
 *  Message   Call   ...
 *
 * Three node types only:
 *   case     – one per graph, the root
 *   person   – every distinct person appearing in the case evidence
 *   evidence – every evidence record, attached to the person it belongs to
 *
 * Three link types only:
 *   owns       case   -> person    (this person appears in this case)
 *   has        person -> evidence  (this evidence belongs to this person)
 *   correlated evidence <-> evidence (the correlation engine says they relate)
 *   contact    person <-> person   (they appear together on the same evidence)
 *
 * The heavy lifting is done by services this project already has:
 *   - aecaService        -> node scores / levels
 *   - evidenceCorrelation -> the evidence-to-evidence links
 *
 * No layout maths here. The backend returns the STRUCTURE; the React component
 * decides where to draw each node. That keeps both sides simple.
 * ---------------------------------------------------------------------------
 */

const { scoreCorrelation } = require("./evidenceCorrelation");
const { calculateCaseAECA, aecaLevel } = require("./aecaService");
const {
  buildCaseSummary,
  buildEvidenceCaption,
  buildRoleLookup,
  roleFor,
} = require("./caseNarrative");

// Two evidence nodes are only joined by a line when their correlation reaches
// this score. Keeps the map readable instead of a hairball of faint links.
const LINK_THRESHOLD = 40;

// Safety cap so an unusually large case cannot render thousands of lines.
const MAX_EVIDENCE_LINKS = 60;

/** The person an evidence record belongs to (new field, old field, or unknown). */
function ownerOf(ev) {
  const name = (ev.person || ev.author || "").trim();
  return name || "Unknown";
}

/** Stable node id for a person, so links can reference it. */
function personId(name) {
  return `person:${name.toLowerCase()}`;
}

/**
 * Builds the full investigation graph for one case.
 *
 * @param {object}   caseDoc      – the Case document
 * @param {object[]} caseEvidence – all non-deleted evidence for that case
 * @returns {{ nodes: object[], links: object[], people: object[], stats: object }}
 */
function buildInvestigationGraph(caseDoc, caseEvidence = []) {
  const nodes = [];
  const links = [];

  // AECA score for every evidence record, computed once and reused.
  const aecaMap = calculateCaseAECA(caseEvidence);

  // Person -> role. A role typed into the case wins; everyone else's role is
  // inferred from their evidence (see roleInference.js), so a case with no
  // declared people still gets a role on every person the map shows.
  const roleLookup = buildRoleLookup(caseDoc, caseEvidence);

  // The data-driven case summary paragraph shown above the map.
  const summary = buildCaseSummary(caseDoc, caseEvidence);

  // ---- 1. Root: the case ---------------------------------------------------
  const caseNodeId = `case:${caseDoc.case_id}`;
  nodes.push({
    id: caseNodeId,
    type: "case",
    label: caseDoc.case_name,
    caseId: caseDoc.case_id,
    caseType: caseDoc.case_type,
    description: caseDoc.description,
    evidenceCount: caseEvidence.length,
  });

  // ---- 2. People -----------------------------------------------------------
  // Group the evidence by its owner. One person node per distinct name.
  const byPerson = new Map();

  // Anyone the case declares gets a node even if no evidence is attached yet,
  // so a person of interest with nothing on file is still visible on the map.
  for (const p of caseDoc?.people || []) {
    if (p?.name) byPerson.set(p.name, []);
  }

  for (const ev of caseEvidence) {
    const name = ownerOf(ev);
    if (!byPerson.has(name)) byPerson.set(name, []);
    byPerson.get(name).push(ev);
  }

  const people = [];

  for (const [name, items] of byPerson) {
    // A person's AECA score is the highest score among their evidence — the
    // strongest single signal attached to them. Simple and defensible.
    const scores = items.map((ev) => aecaMap.get(ev.evidence_id)?.aeca_score ?? 0);
    const topScore = scores.length ? Math.max(...scores) : 0;

    const id = personId(name);

    // Which kinds of evidence this person actually has, most common first.
    // Read off the records — never a fixed list of expected types.
    const typeCounts = new Map();
    for (const ev of items) {
      const t = ev.evidence_type || ev.file_type || "Evidence";
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
    const evidenceTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    const person = {
      id,
      type: "person",
      label: name,
      // Role comes from the case data. "" when the case declares none, and
      // the UI then shows no role label at all rather than inventing one.
      role: roleFor(name, roleLookup),
      evidenceCount: items.length,
      evidenceTypes,
      aecaScore: topScore,
      aecaLevel: aecaLevel(topScore),
      evidenceIds: items.map((ev) => ev.evidence_id),
    };

    nodes.push(person);
    people.push(person);

    // Case -> person
    links.push({ source: caseNodeId, target: id, type: "owns" });
  }

  // ---- 3. Evidence ---------------------------------------------------------
  for (const ev of caseEvidence) {
    const aeca = aecaMap.get(ev.evidence_id) || { aeca_score: 0, aeca_level: "Low" };
    const owner = ownerOf(ev);
    const id = `evidence:${ev.evidence_id}`;

    // Short caption built from the record's own fields, e.g.
    //   CALL / "<person> -> <other party>" / "14 Mar, 10:42 PM"
    const caption = buildEvidenceCaption(ev);

    nodes.push({
      id,
      type: "evidence",
      label: ev.evidence_id,
      evidenceId: ev.evidence_id,
      evidenceType: ev.evidence_type || ev.file_type || "File",
      person: owner,
      personRole: roleFor(owner, roleLookup),
      relatedPerson: ev.related_person || "",
      relatedPersonRole: roleFor(ev.related_person, roleLookup),
      place: ev.place || "",

      // Pre-built display strings so the map does no formatting itself.
      caption: caption.subtitle,
      captionTime: caption.time,
      timestamp: ev.timestamp,
      summary: ev.content || "",
      severity: ev.severity || "Low",
      anomalyType: ev.anomaly_type || "Normal",
      integrity: ev.integrity_status || "Unknown",
      aecaScore: aeca.aeca_score,
      aecaLevel: aeca.aeca_level,
    });

    // Person -> evidence
    links.push({ source: personId(owner), target: id, type: "has" });
  }

  // ---- 4. Evidence <-> evidence correlation links -------------------------
  // Compare every pair once (i < j) using the EXISTING correlation engine.
  const evidenceLinks = [];

  for (let i = 0; i < caseEvidence.length; i++) {
    for (let j = i + 1; j < caseEvidence.length; j++) {
      const a = caseEvidence[i];
      const b = caseEvidence[j];
      const { correlation_score, reasons } = scoreCorrelation(a, b);

      if (correlation_score >= LINK_THRESHOLD) {
        evidenceLinks.push({
          source: `evidence:${a.evidence_id}`,
          target: `evidence:${b.evidence_id}`,
          type: "correlated",
          score: correlation_score,
          reasons,
        });
      }
    }
  }

  // Keep only the strongest links so the map stays readable.
  evidenceLinks.sort((x, y) => y.score - x.score);
  links.push(...evidenceLinks.slice(0, MAX_EVIDENCE_LINKS));

  // ---- 5. Person <-> person contact links --------------------------------
  // Two people are connected when one appears as the "other party" on the
  // other's evidence (e.g. A sent a message to B).
  const contactSeen = new Set();

  for (const ev of caseEvidence) {
    const from = ownerOf(ev);
    const to = (ev.related_person || "").trim();
    if (!to || to === from || !byPerson.has(to)) continue;

    // Undirected: store the pair in a fixed order so A-B and B-A are one link.
    const key = [from, to].sort().join("||");
    if (contactSeen.has(key)) continue;
    contactSeen.add(key);

    links.push({
      source: personId(from),
      target: personId(to),
      type: "contact",
    });
  }

  // ---- 6. Small summary the UI shows above the map ------------------------
  const levelCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const { aeca_level } of aecaMap.values()) {
    if (levelCounts[aeca_level] !== undefined) levelCounts[aeca_level] += 1;
  }

  const caseScores = [...aecaMap.values()].map((v) => v.aeca_score);
  const caseAeca = caseScores.length ? Math.max(...caseScores) : 0;

  return {
    nodes,
    links,
    summary,
    people: people.sort((a, b) => b.aecaScore - a.aecaScore),
    stats: {
      peopleCount: people.length,
      evidenceCount: caseEvidence.length,
      connectionCount: evidenceLinks.length,
      levelCounts,
      caseAecaScore: caseAeca,
      caseAecaLevel: aecaLevel(caseAeca),
    },
  };
}

module.exports = { buildInvestigationGraph, LINK_THRESHOLD, ownerOf };
