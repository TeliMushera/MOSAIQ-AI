# MOSAIQ — Digital Forensics Investigation Platform

A simple, case-based digital investigation dashboard. It answers one question:

> **What happened, who is involved, and what evidence is connected?**

**Stack:** React 19 + Vite frontend · Node + Express backend · MongoDB (Mongoose) ·
Ollama for local AI. No other frameworks, no vector database, no RAG.

```
┌───────────────┐    REST/JSON    ┌────────────────┐   Mongoose   ┌─────────┐
│   frontend    │ ──────────────▶ │    backend     │ ───────────▶ │ MongoDB │
│ React + Vite  │ ◀────────────── │ Express (5000) │ ◀─────────── │         │
│    (5173)     │                 └───────┬────────┘              └─────────┘
└───────────────┘                         │ HTTP
                                  ┌───────▼────────┐
                                  │ Ollama (11434) │  local AI, no API key
                                  └────────────────┘
```

---

## 1. The idea in one paragraph

A case contains **people**, and each person has **evidence** (messages, calls,
emails, social media, locations, files). The **investigation map** draws that
structure as a graph so the relationships are visible at a glance. Every piece
of evidence gets an **AECA score** telling the investigator how much attention
it deserves. The screen stays simple; everything technical hides behind a
single **"Show details"** button.

The user journey is one straight line:

```
Cases → Select case → Investigation Map → Click person/evidence
      → AECA score → Related evidence → AI insight → Show details
```

---

## 2. Running it

### Prerequisites

- Node.js 18+
- MongoDB — local (`mongodb://127.0.0.1:27017`) or a free Atlas cluster
- *(Optional)* [Ollama](https://ollama.com) for the AI insight feature

### Backend

```bash
cd backend
cp .env.example .env       # edit MONGODB_URI if you use Atlas
npm install
npm run seed               # loads CASE-001 (safe to re-run)
npm run dev                # API on http://localhost:5000
```

`AUTO_SEED=true` in `.env` also loads the case on first boot when the evidence
collection is empty, so `npm run seed` is optional the first time.

Check it: <http://localhost:5000/api/health> → `{"status":"ok","db":"connected"}`

### Frontend

In a second terminal, from the project root:

```bash
npm install
npm run dev                # http://localhost:5173
```

### Ollama (optional)

```bash
ollama serve
ollama pull qwen2.5:3b
```

Without Ollama everything still works — the AI insight button just reports that
the local AI is unavailable. Nothing else is affected.

---

## 3. The demo cases

Two fictional cases ship with MOSAIQ. They exist to prove the platform is
**case-agnostic** — the second one required no code change of any kind.

**CASE-001: Suspicious Death Investigation** — 17 records, four people.

| Person | Role | Evidence |
|---|---|---|
| Maya Rao | Victim | Messages, a draft complaint, a location log, a personal record |
| Dev Kapoor | Person of Interest | Threatening messages, calls, a location near the flat, a hostile post, a tampered browser history |
| Nikhil Bose | Witness | Stairwell location, a witness message, an email to building management |
| Priya Nair | Contact | The victim's last call, a safety warning, a social media report |

**CASE-002: Online Harassment Complaint** — 10 records, three people, and a
completely different vocabulary. There is **no victim role at all**.

| Person | Role | Evidence |
|---|---|---|
| Arjun Sethi | Complainant | A platform report, a screenshot folder, a message |
| Account @nightfall_77 | Suspected Account | Posts, a direct message, login records |
| Neha Varma | Witness | A social media reply, a platform acknowledgement |

Both live in `backend/seed/` as plain JavaScript objects. Adding a third case
means adding one file and listing it in `seed/seedInvestigation.js` — nothing
else changes.

---

## 3b. Why MOSAIQ is case-agnostic

This is the central design rule: **the code contains no knowledge of any
particular kind of investigation.** There is no branch anywhere on a case type,
a role name, a person's name or an evidence type.

| Thing | Where it comes from |
|---|---|
| People and their roles | `case.people[]` in the database — free text |
| Case summary sentence | Composed at runtime from the roles, evidence types and dates the case actually has |
| Evidence types | Read off the records; any string works |
| Evidence node captions | Built from each record's own `person`, `related_person`, `place` and `timestamp` |
| AECA | Severity, anomaly, integrity and correlation — no case-type input |
| AI insight | The case, its people and its evidence are put in the prompt; the model describes only what it is given |

**Nothing is assumed to exist.** A case with no roles shows no roles and never
invents one. A case with no evidence says so. An evidence type the codebase has
never seen — `Login`, `Transaction`, `Biometric Badge Swipe` — renders normally.

Roles are **data, not code**. `Maya Rao` appears as the victim because the
database row says `role: "Victim"`, not because anything in the code mentions
her or knows what a suspicious death is.

---

## 4. AECA — the investigation score

**AECA** (Aggregated Evidence Correlation Analysis) is the one number the whole
UI revolves around. It is not a new invention: it combines the two deterministic
engines the project already had.

```
AECA = 60% × forensic risk  +  40% × connection strength
```

| Input | Where it comes from | What it measures |
|---|---|---|
| Forensic risk (0–100) | `services/forensicRiskEngine.js` | Severity + anomaly type + integrity status of *this one* record |
| Connection strength (0–100) | `services/evidenceCorrelation.js` | Average of this record's 3 strongest correlation scores |

**Levels:** 0–29 Low · 30–59 Medium · 60–79 High · 80–100 Critical

Risk is weighted higher because it is the primary signal; correlation supports
it. A record matters both because it is suspicious *on its own* and because it
*ties other evidence together*.

Everything is deterministic — no AI, no randomness. The same evidence always
produces the same score, and `services/aecaService.js` returns a labelled
breakdown so every point is accounted for on screen.

**Worked example — EV-001007 (the tampered browser history):**

```
Forensic risk         Risk 80/100 (Critical) weighted at 60%   → +48
Evidence connections  Top-3 average 30/100 weighted at 40%     → +12
                                                    AECA score = 60  (High)
```

A person's score is the **highest AECA among their evidence** — the strongest
single signal attached to them, never a conclusion about them.

---

## 5. The investigation map

The centrepiece, in `src/components/graph/InvestigationMap.jsx`.

It is **plain SVG with a fixed layout** — deliberately no graph library and no
physics simulation. That means no extra dependency to install, the same case
always draws the same picture, and the positioning is simple trigonometry.

```
                    CASE            centre
                  /  |   \
            Person Person Person    even ring around the case
             / | \    |      | \
           Ev Ev Ev   Ev     Ev Ev  fanned inside each person's own slice
```

**Layout rule:** each person gets an equal slice of the circle
(360° ÷ number of people). The person sits on the middle of their slice and
their evidence fans across that same slice further out — so one person's
evidence can never drift into another's area. People with more than four items
use two rings.

**Line types:**

| Line | Meaning |
|---|---|
| Solid grey | Case → person, person → evidence |
| Dashed amber | Two evidence items correlate (score ≥ 40) |
| Dotted blue | Two people were in contact |

**Interaction:** click a person to see their evidence · click evidence to open
it · hover to highlight connections and dim everything else · drag to pan ·
buttons to zoom.

Node colour always shows the AECA level: green Low, amber Medium, red High/Critical.

---

## 6. Project structure

```
backend/
  services/
    forensicRiskEngine.js     risk score for one record        (pre-existing)
    evidenceCorrelation.js    how strongly two records relate  (pre-existing)
    aecaService.js            combines the two into AECA       <- new
    investigationGraph.js     builds the map's nodes + links   <- new
    aiForensicAnalyzer.js     Ollama insights                  (pre-existing)
    hashService.js            real SHA-256                     (pre-existing)
    caseNarrative.js          data-driven case summary         <- new
  seed/
    investigationCase.js      CASE-001 dataset (data only)
    harassmentCase.js         CASE-002 dataset (data only)     <- new
    seedInvestigation.js      loads every dataset listed
  routes/
    cases.js                  + GET /:caseId/graph             <- new endpoint
    evidence.js               + GET /:evidenceId/aeca          <- new endpoint

src/
  components/
    graph/InvestigationMap.jsx             the SVG map
    investigation/AecaScore.jsx            the score block        <- new
    investigation/EvidenceDetailPanel.jsx  details + Show details <- new
  pages/
    Cases.jsx                 the case list (front door)
    CaseInvestigation.jsx     the main screen                  <- rewritten
    CaseEvidence.jsx          flat evidence table
    EvidenceDetails.jsx       one evidence record              <- rewritten
  api/
    investigation.js          graph + AECA calls               <- new
```

### Key API endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/cases` | All cases |
| `GET` | `/api/cases/:caseId/graph` | **The investigation map**: nodes, links, people, stats |
| `GET` | `/api/cases/:caseId/evidence` | Case evidence (search / filter / paginate) |
| `GET` | `/api/evidence/:evidenceId/aeca` | **AECA score** + breakdown + related + integrity |
| `POST` | `/api/evidence/:evidenceId/investigation-insight` | AI insight from Ollama |
| `GET` | `/api/evidence/:evidenceId/related` | Correlated evidence |

---

## 7. The AI layer

Ollama runs locally (`qwen2.5:3b` by default). It is a **general digital
forensics summariser**, not a summariser for any one kind of case.

It receives the case name, type and description, the people and their roles,
the selected evidence with its timestamps, places, anomaly, severity and
integrity, the correlated records with their correlation reasons, and the AECA
score. It then describes what those records show. Because everything in the
prompt is read from the database, the wording adapts to the case by itself.

**Output format** — deliberately short:

```
AI Investigation Insight

[One short paragraph describing the observed pattern.]

Evidence pattern
 • [fact drawn from the actual records]
 • [fact drawn from the actual records]

AECA  60/100 — High
```

**What it must not do**, enforced in the system prompt:

- **No next steps.** It reports the observed pattern only. It never recommends,
  suggests or implies an action, review or line of enquiry. (The old
  "Investigation considerations" field has been removed entirely.)
- **No guilt.** It never states or implies that anyone is responsible for
  anything.
- **No misreading AECA.** The prompt states that AECA measures how strongly
  records relate to each other, not a probability that someone did something.

If Ollama is not running, the feature returns a clear message and nothing else
breaks.

### The "Could not reach the MOSAIQ backend" error

That message came from the frontend's network-error handler, but the backend
was fine. The cause was a **missing timeout**:

`callOllama()` had no timeout, so a slow or cold model could keep the browser's
request open past Node's `requestTimeout` (300s by default). Node then
**destroys the socket**, which the browser sees as a network failure — hence a
message blaming the backend.

Two small fixes, no rewrite:

1. `services/aiForensicAnalyzer.js` — the Ollama call now uses
   `AbortSignal.timeout(OLLAMA_TIMEOUT_MS)` (default 90s), so the backend
   always returns real JSON with a readable message instead of hanging.
2. `server.js` — the server's `requestTimeout` is raised to 10 minutes, safely
   above the Ollama timeout, so Node can never kill the socket first.

Raise `OLLAMA_TIMEOUT_MS` in `backend/.env` if your machine needs longer.

---

## 8. Design decisions worth knowing

- **AECA doesn't invent maths.** It is a weighted combination of two engines
  that already existed. Every point is shown in the breakdown.
- **The map is hand-drawn SVG.** No library added. Deterministic and explainable.
- **The score is calculated server-side**, never in the browser, so the UI can
  never disagree with the API.
- **One detail panel, two places.** The map's side panel and the full evidence
  page render the same `EvidenceDetailPanel` component.
- **Complexity is hidden, not deleted.** Hashes, integrity checks, correlation
  reasons and score maths all still run — they live behind "Show details".
- **Old records still work.** `evidence_type` / `person` fall back to
  `file_type` / `author`, so anything seeded before the restructure still loads.
- **No case-specific logic.** No file outside `backend/seed/` mentions a person,
  a crime type or a role. Roles, evidence types and summary wording are all data.

### What was removed from the UI

The stats-heavy screens (dashboard, per-case overview, donut and bar charts,
the global investigation statistics page) were removed so the map is the focus.
The backend `statisticsService.js` and `GET /api/cases/:caseId/statistics` are
untouched if you ever want them back.

The original corporate-documents dataset is still importable with
`npm run seed:legacy-csv`, but note it also defines a `CASE-001`, which would
collide with the investigation case.
