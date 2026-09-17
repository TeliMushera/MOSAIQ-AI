/**
 * MOSAIQ — Role inference
 * ---------------------------------------------------------------------------
 * Works out what part a person plays in a case FROM THEIR EVIDENCE, so nobody
 * has to type "Ritika = Victim" into a form and hope they guessed right.
 *
 * The investigator never declares a role up front. Instead, for every person
 * who appears in the case evidence, this looks at:
 *
 *   - what THEIR OWN records say happened (did they send something hostile?
 *     do something that got flagged as suspicious? file a report about being
 *     harmed?)
 *   - what OTHER PEOPLE'S records say about them (are they the target of
 *     someone else's threatening message, doxxing post, harassment…?)
 *
 * …and turns that into one of four roles:
 *
 *   "Person of Interest" — their own actions are what got flagged
 *   "Victim"              — the evidence (theirs or someone else's) shows
 *                            harm directed at them
 *   "Witness"              — their own records describe something they saw,
 *                            not something that happened to or because of them
 *   "Contact"              — connected to the case (they show up on someone's
 *                            evidence, or have evidence of their own) but none
 *                            of the above applies
 *
 * This is a heuristic, not a verdict — it is exactly the kind of first pass an
 * investigator would want to sanity-check, and a case can still override any
 * one person's role explicitly (see caseNarrative.buildRoleLookup, which
 * always prefers a declared role over an inferred one). Nothing here assumes
 * a particular kind of crime; it only reasons about the SHAPE of a record
 * (whose name is on it, whether it describes an action or an account of one,
 * how severe it is) plus a small, extendable vocabulary of anomaly-type
 * keywords that show up across many kinds of investigations.
 * ---------------------------------------------------------------------------
 */

// Anomaly types matching this vocabulary describe a harmful ACT — a threat,
// an act of harassment, doxxing, stalking, abuse, fraud, theft. When a
// person's own record matches one of these (and isn't itself a "reported by"
// record — see REPORT_WORDS) it means they are the one who did it.
// When someone ELSE'S record matches one of these AND names this person as
// the related/other party, it means this person was on the receiving end.
const HARM_WORDS = /threat|harass|hostile|doxx|stalk|assault|abuse|theft|fraud|extort|intimidat/i;

// Anomaly types matching this vocabulary describe suspicious ACTIVITY that
// doesn't necessarily target a specific other person — unauthorized access,
// confidential file pulls, unexplained presence, irregular logins, unusual
// searches. A person's own record of this kind still makes them the one
// whose actions are in question.
const SUSPICIOUS_ACTIVITY_WORDS =
  /suspicious|unauthorized|unauthoris|confidential|unusual login|presence near scene|irregular/i;

// A record whose anomaly type contains one of these words is the OWNER
// recounting something — a report, complaint, or witnessed account — rather
// than describing their own hostile act. This is what separates "Ritika
// reports her laptop was stolen" (Victim) from "Dev sends a threatening
// message" (Person of Interest), even though both might otherwise match
// HARM_WORDS.
const ACCOUNT_WORDS = /report|witness|complain|statement/i;

function anomalyOf(ev) {
  return (ev.anomaly_type || "").trim();
}

function isHarmAct(ev) {
  const a = anomalyOf(ev);
  return HARM_WORDS.test(a) && !ACCOUNT_WORDS.test(a);
}

function isHarmAccount(ev) {
  const a = anomalyOf(ev);
  return HARM_WORDS.test(a) && ACCOUNT_WORDS.test(a);
}

function isSuspiciousActivity(ev) {
  const a = anomalyOf(ev);
  const severity = (ev.severity || "").trim().toLowerCase();
  // Unlike an explicit hostile act (a threat, a harassing message), things
  // like "presence near scene" or an unusual login only mean something on
  // their own once they're serious enough to have been marked High/Critical.
  // A Medium "presence near scene" — e.g. a neighbour who lives in the same
  // building — isn't by itself grounds to call someone a person of interest.
  return (
    SUSPICIOUS_ACTIVITY_WORDS.test(a) &&
    !ACCOUNT_WORDS.test(a) &&
    (severity === "high" || severity === "critical")
  );
}

function isWitnessAccount(ev) {
  const a = anomalyOf(ev);
  return /witness/i.test(a) || (ACCOUNT_WORDS.test(a) && !HARM_WORDS.test(a) && (ev.severity || "").toLowerCase() !== "high" && (ev.severity || "").toLowerCase() !== "critical");
}

function personOf(ev) {
  return (ev.person || ev.author || "").trim();
}

function relatedOf(ev) {
  return (ev.related_person || "").trim();
}

/**
 * Infers a role for every person who appears anywhere in the case evidence
 * (as an owner or as the "other party" on someone else's record).
 *
 * @param {object[]} caseEvidence
 * @returns {Map<string, string>} person name (as it actually appears on the
 *   evidence — matching is done case-insensitively by the caller) -> role
 */
function inferRoles(caseEvidence = []) {
  // Collect every distinct name and the evidence relevant to it.
  const ownEvidenceOf = new Map(); // name -> evidence[] where they are the owner
  const pointedAtOf = new Map(); // name -> evidence[] where they are the related_person

  const addTo = (map, name, ev) => {
    if (!name) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(ev);
  };

  for (const ev of caseEvidence) {
    addTo(ownEvidenceOf, personOf(ev), ev);
    addTo(pointedAtOf, relatedOf(ev), ev);
  }

  const allNames = new Set([...ownEvidenceOf.keys(), ...pointedAtOf.keys()]);
  const roles = new Map();

  for (const name of allNames) {
    const own = ownEvidenceOf.get(name) || [];
    const pointedAt = pointedAtOf.get(name) || [];

    // ---- 1. Person of Interest: their OWN actions are what's flagged -------
    // Either a harmful act they carried out, or suspicious activity of
    // theirs (unauthorized access, irregular presence, etc).
    const ownHarmAct = own.find(isHarmAct);
    const ownSuspicious = own.find(isSuspiciousActivity);
    if (ownHarmAct || ownSuspicious) {
      roles.set(name, "Person of Interest");
      continue;
    }

    // ---- 2. Victim: harm shows up pointed AT them, from either side -------
    // (a) someone else's record describes a harmful act with this person as
    //     the other party, or
    // (b) this person's own record is them recounting harm that reached them
    //     (a report/complaint whose anomaly type still names a harm word —
    //     e.g. "Theft Reported", "Harassment Reported").
    const targetedByOthers = pointedAt.find(isHarmAct);
    const selfReportedHarm = own.find(isHarmAccount);
    if (targetedByOthers || selfReportedHarm) {
      roles.set(name, "Victim");
      continue;
    }

    // ---- 3. Witness: their own record is an account of something they saw,
    // not something that happened to or because of them. -------------------
    if (own.some(isWitnessAccount)) {
      roles.set(name, "Witness");
      continue;
    }

    // ---- 4. Contact: connected to the case, nothing stronger applies. -----
    roles.set(name, "Contact");
  }

  return roles;
}

module.exports = { inferRoles };
