/**
 * MOSAIQ — Second fictional demo case
 * ---------------------------------------------------------------------------
 * CASE-002: Online Harassment Complaint
 *
 * This case exists to demonstrate that MOSAIQ is case-agnostic. It shares NO
 * code path with CASE-001 and required NO change to the frontend, the graph
 * builder, the AECA service or the AI prompt.
 *
 * It differs from CASE-001 in every way the platform might have been tempted
 * to hard-code:
 *
 *   - different case type          (Online Harassment, not Suspicious Death)
 *   - completely different roles   (Complainant / Suspected Account /
 *                                   Platform Contact — there is NO victim)
 *   - different evidence types     (mostly Social Media and Login records;
 *                                   no calls at all)
 *   - a different number of people and a different timeframe
 *
 * Everything is invented. No real people, accounts or platforms.
 * ---------------------------------------------------------------------------
 */

const CASE = {
  case_id: "CASE-002",
  case_name: "Online Harassment Complaint",
  case_type: "Online Harassment",
  description:
    "Arjun Sethi reported sustained harassment from an anonymous account across two " +
    "social platforms over three weeks in April. This case collects the reported posts " +
    "and messages, the platform's account records, and the login activity supplied by " +
    "the platform in response to a preservation request.",
  lead: "Sgt. R. Iyer",
  opened: "2026-04-22",
  status: "Active",

  // Note: no "Victim" role anywhere. This case uses an entirely different
  // vocabulary, and the platform adapts without any code change.
  people: [
    { name: "Arjun Sethi", role: "Complainant" },
    { name: "Account @nightfall_77", role: "Suspected Account" },
    { name: "Neha Varma", role: "Witness" },
  ],

  incident_date: "2026-04-18",
  incident_location: "",
};

const EVIDENCE = [
  // ===== The reported account =============================================
  {
    evidence_id: "EV-002001",
    evidence_type: "Social Media",
    person: "Account @nightfall_77",
    related_person: "Arjun Sethi",
    timestamp: "2026-04-02 23:15:00",
    source: "Account Export — Social Platform SP-2",
    content:
      "Public reply directed at the complainant containing repeated personal insults " +
      "and a reference to his workplace.",
    anomaly_type: "Harassing Content",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-002002",
    evidence_type: "Social Media",
    person: "Account @nightfall_77",
    related_person: "Arjun Sethi",
    timestamp: "2026-04-11 22:48:00",
    source: "Account Export — Social Platform SP-2",
    content:
      "Post naming the complainant's employer and street, reposted four times within " +
      "the same hour.",
    anomaly_type: "Doxxing Indicator",
    severity: "High",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-002003",
    evidence_type: "Message",
    person: "Account @nightfall_77",
    related_person: "Arjun Sethi",
    timestamp: "2026-04-18 21:30:00",
    source: "Account Export — Social Platform SP-2",
    content:
      "Direct message stating that the sender knows where the complainant works and " +
      "will keep posting until he deletes his account.",
    anomaly_type: "Threatening Message",
    severity: "High",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-002004",
    evidence_type: "Login",
    person: "Account @nightfall_77",
    related_person: "",
    timestamp: "2026-04-18 21:26:00",
    source: "Platform Records — Preservation Response PR-11",
    content:
      "Account sign-in from an IP range that does not match any earlier session for " +
      "this account, four minutes before the message above was sent.",
    anomaly_type: "Unusual Login",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-002005",
    evidence_type: "Login",
    person: "Account @nightfall_77",
    related_person: "",
    timestamp: "2026-04-11 22:41:00",
    source: "Platform Records — Preservation Response PR-11",
    content:
      "Account sign-in recorded seven minutes before the reposting activity on the " +
      "same evening.",
    anomaly_type: "Unusual Login",
    severity: "Low",
    integrity_status: "Verified",
  },

  // ===== The complainant ==================================================
  {
    evidence_id: "EV-002006",
    evidence_type: "Email",
    person: "Arjun Sethi",
    related_person: "",
    timestamp: "2026-04-19 09:15:00",
    source: "Mailbox Export — Account MB-21",
    content:
      "Report submitted to the platform's trust and safety team listing the account " +
      "handle and six post URLs, with a request that the records be preserved.",
    anomaly_type: "Normal",
    severity: "Low",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-002007",
    evidence_type: "File",
    person: "Arjun Sethi",
    related_person: "",
    timestamp: "2026-04-20 10:02:00",
    source: "Device Image — Device D-09",
    content:
      "Folder of dated screenshots covering the reported posts, kept as a running " +
      "record from 2 April onward.",
    anomaly_type: "Normal",
    severity: "Low",
    // Deliberately inconsistent so the integrity layer has something to report
    // in this case too, exactly as it does in CASE-001.
    integrity_status: "Integrity Failed",
  },
  {
    evidence_id: "EV-002008",
    evidence_type: "Message",
    person: "Arjun Sethi",
    related_person: "Neha Varma",
    timestamp: "2026-04-12 08:10:00",
    source: "Phone Extraction — Handset H-21",
    content:
      "Message describing the previous night's posts and asking whether she had also " +
      "seen them appear on her feed.",
    anomaly_type: "Normal",
    severity: "Low",
    integrity_status: "Verified",
  },

  // ===== The witness ======================================================
  {
    evidence_id: "EV-002009",
    evidence_type: "Social Media",
    person: "Neha Varma",
    related_person: "Arjun Sethi",
    timestamp: "2026-04-12 08:44:00",
    source: "Account Export — Social Platform SP-2",
    content:
      "Reply confirming she saw the reposted content and had reported it separately " +
      "from her own account.",
    anomaly_type: "Witness Account",
    severity: "Low",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-002010",
    evidence_type: "Email",
    person: "Neha Varma",
    related_person: "",
    timestamp: "2026-04-13 17:25:00",
    source: "Mailbox Export — Account MB-22",
    content:
      "Automated acknowledgement from the platform confirming her separate report of " +
      "the same account was received.",
    anomaly_type: "Normal",
    severity: "Low",
    integrity_status: "Verified",
  },
];

module.exports = { CASE, EVIDENCE };
