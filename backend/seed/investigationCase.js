/**
 * MOSAIQ — Fictional demo case dataset
 * ---------------------------------------------------------------------------
 * CASE-001: Suspicious Death Investigation
 *
 * Everything below is INVENTED for demonstration purposes. No real people,
 * phone numbers, accounts or events are represented.
 *
 * The dataset is deliberately small and readable so the whole investigation
 * can be followed by eye and explained out loud:
 *
 *   Victim        : Maya Rao — found dead at her flat on 12 March
 *   Person A      : Dev Kapoor  — ex-partner, sent threatening messages
 *   Person B      : Nikhil Bose — neighbour, placed near the flat that night
 *   Person C      : Priya Nair  — friend, last person the victim called
 *
 * The evidence is shaped so the correlation engine has real work to do:
 * several records share a person, a source or a timestamp window, which is
 * exactly what produces the lines on the investigation map.
 * ---------------------------------------------------------------------------
 */

const CASE = {
  case_id: "CASE-001",
  case_name: "Suspicious Death Investigation",
  case_type: "Suspicious Death",
  description:
    "Maya Rao was found dead at her flat on the morning of 12 March. The death is being " +
    "treated as suspicious. This case collects the digital evidence recovered from her " +
    "phone, laptop and accounts, together with records belonging to three people who were " +
    "in contact with her in the days before.",
  lead: "Insp. A. Fernandes",
  opened: "2026-03-12",
  status: "Active",

  // Roles are DATA, not code. MOSAIQ never assumes a case has a victim — this
  // case happens to declare one, so the UI shows one. A case that declares no
  // roles simply displays none.
  people: [
    { name: "Maya Rao", role: "Victim" },
    { name: "Dev Kapoor", role: "Person of Interest" },
    { name: "Nikhil Bose", role: "Witness" },
    { name: "Priya Nair", role: "Contact" },
  ],

  incident_date: "2026-03-11",
  incident_location: "Ashwin Residency, Block C, Flat 402",
};

/**
 * Evidence records.
 *
 * Only the investigation-facing fields are written here. The importer fills in
 * the forensic fields (hash, file name, size) so nothing has to be typed twice.
 */
const EVIDENCE = [
  // ===== Dev Kapoor — ex-partner ==========================================
  {
    evidence_id: "EV-001001",
    evidence_type: "Message",
    person: "Dev Kapoor",
    related_person: "Maya Rao",
    timestamp: "2026-03-09 21:42:00",
    source: "Phone Extraction — Handset H-02",
    content:
      "You cannot just cut me off like this. I will come to the flat whether you want it or not.",
    anomaly_type: "Threatening Message",
    severity: "High",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001002",
    evidence_type: "Message",
    person: "Dev Kapoor",
    related_person: "Maya Rao",
    timestamp: "2026-03-09 21:55:00",
    source: "Phone Extraction — Handset H-02",
    content:
      "Answer me. You will regret ignoring me. I know you are home.",
    anomaly_type: "Threatening Message",
    severity: "High",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001003",
    evidence_type: "Call",
    person: "Dev Kapoor",
    related_person: "Maya Rao",
    timestamp: "2026-03-11 22:10:00",
    source: "Telecom Records — Provider CDR",
    content:
      "Outgoing call to the victim's number. Duration 4 seconds. Not answered.",
    anomaly_type: "Repeated Contact Attempt",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001004",
    evidence_type: "Call",
    person: "Dev Kapoor",
    related_person: "Maya Rao",
    timestamp: "2026-03-11 22:14:00",
    source: "Telecom Records — Provider CDR",
    content:
      "Outgoing call to the victim's number. Duration 2 seconds. Not answered.",
    anomaly_type: "Repeated Contact Attempt",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001005",
    evidence_type: "Location",
    person: "Dev Kapoor",
    related_person: "",
    place: "Ashwin Residency, Block C — victim's building",
    timestamp: "2026-03-11 22:35:00",
    source: "Handset GPS Log — Handset H-02",
    content:
      "Handset recorded within approximately 80 metres of the victim's building. " +
      "Device remained in the area for around 25 minutes.",
    anomaly_type: "Presence Near Scene",
    severity: "High",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001006",
    evidence_type: "Social Media",
    person: "Dev Kapoor",
    related_person: "Maya Rao",
    timestamp: "2026-03-10 18:05:00",
    source: "Account Export — Social Platform SP-1",
    content:
      "Public post: \"Some people forget who stood by them. It will not stay forgotten.\"",
    anomaly_type: "Hostile Public Post",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001007",
    evidence_type: "File",
    person: "Dev Kapoor",
    related_person: "",
    timestamp: "2026-03-11 23:40:00",
    source: "Laptop Image — Device L-04",
    content:
      "Browser history export showing searches about building entry points and CCTV " +
      "blind spots, recorded shortly after the handset left the area.",
    anomaly_type: "Suspicious Search Activity",
    severity: "Critical",
    // Deliberately tampered so the integrity check has something to catch.
    integrity_status: "Integrity Failed",
  },

  // ===== Nikhil Bose — neighbour ==========================================
  {
    evidence_id: "EV-001008",
    evidence_type: "Location",
    person: "Nikhil Bose",
    related_person: "",
    place: "Ashwin Residency, Block C — stairwell",
    timestamp: "2026-03-11 22:38:00",
    source: "Handset GPS Log — Handset H-05",
    content:
      "Handset recorded in the building stairwell. Resident of the floor below the victim.",
    anomaly_type: "Presence Near Scene",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001009",
    evidence_type: "Message",
    person: "Nikhil Bose",
    related_person: "Priya Nair",
    timestamp: "2026-03-11 23:02:00",
    source: "Phone Extraction — Handset H-05",
    content:
      "Heard shouting from the flat upstairs around eleven. Sounded like an argument. " +
      "Should I call someone?",
    anomaly_type: "Witness Account",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001010",
    evidence_type: "Email",
    person: "Nikhil Bose",
    related_person: "",
    timestamp: "2026-03-12 08:20:00",
    source: "Mailbox Export — Account MB-03",
    content:
      "Email to the building management reporting a disturbance on the night of 11 March " +
      "and requesting the stairwell camera footage be preserved.",
    anomaly_type: "Normal",
    severity: "Low",
    integrity_status: "Verified",
  },

  // ===== Priya Nair — friend ==============================================
  {
    evidence_id: "EV-001011",
    evidence_type: "Call",
    person: "Priya Nair",
    related_person: "Maya Rao",
    timestamp: "2026-03-11 21:50:00",
    source: "Telecom Records — Provider CDR",
    content:
      "Incoming call from the victim. Duration 11 minutes. Last known call made by the victim.",
    anomaly_type: "Last Contact",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001012",
    evidence_type: "Message",
    person: "Priya Nair",
    related_person: "Maya Rao",
    timestamp: "2026-03-11 22:05:00",
    source: "Phone Extraction — Handset H-07",
    content:
      "Lock the door and do not let him in. Call me if he turns up. I can come over.",
    anomaly_type: "Concern For Safety",
    severity: "Medium",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001013",
    evidence_type: "Social Media",
    person: "Priya Nair",
    related_person: "Dev Kapoor",
    timestamp: "2026-03-10 19:30:00",
    source: "Account Export — Social Platform SP-1",
    content:
      "Direct message reporting that Dev Kapoor's public post appeared to be aimed at the victim.",
    anomaly_type: "Normal",
    severity: "Low",
    integrity_status: "Verified",
  },

  // ===== Maya Rao — victim ================================================
  {
    evidence_id: "EV-001014",
    evidence_type: "Message",
    person: "Maya Rao",
    related_person: "Dev Kapoor",
    timestamp: "2026-03-09 21:48:00",
    source: "Phone Extraction — Handset H-01",
    content:
      "Stop messaging me. I have asked you three times. I do not want you at my flat.",
    anomaly_type: "Harassment Reported",
    severity: "High",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001015",
    evidence_type: "Email",
    person: "Maya Rao",
    related_person: "",
    timestamp: "2026-03-10 09:15:00",
    source: "Mailbox Export — Account MB-01",
    content:
      "Draft complaint to building security describing repeated unwanted visits and asking " +
      "that one named visitor not be allowed past the gate. The draft was never sent.",
    anomaly_type: "Harassment Reported",
    severity: "High",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001016",
    evidence_type: "Location",
    person: "Maya Rao",
    related_person: "",
    place: "Ashwin Residency, Block C — Flat 402",
    timestamp: "2026-03-11 22:30:00",
    source: "Handset GPS Log — Handset H-01",
    content:
      "Victim's handset stationary at the home address. No further movement recorded after this point.",
    anomaly_type: "Normal",
    severity: "Low",
    integrity_status: "Verified",
  },
  {
    evidence_id: "EV-001017",
    evidence_type: "File",
    person: "Maya Rao",
    related_person: "",
    timestamp: "2026-03-08 20:00:00",
    source: "Laptop Image — Device L-01",
    content:
      "Personal note listing dates and times of unwanted visits and calls over the previous " +
      "three weeks, kept as a running record.",
    anomaly_type: "Harassment Reported",
    severity: "Medium",
    integrity_status: "Verified",
  },
];

module.exports = { CASE, EVIDENCE };
