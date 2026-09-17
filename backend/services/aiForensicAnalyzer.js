/**
 * MOSAIQ AI Forensic Analyzer — Batch 2 (Ollama / local)
 *
 * Sends extracted evidence content to a locally running Ollama instance and
 * returns a structured forensic assessment:
 *
 *   { status, severity, anomaly_type, indicators, reasons, analyzed_at }
 *
 * Uses Node 20 built-in fetch — no extra packages required.
 * No API key needed — Ollama runs entirely on the local machine.
 *
 * Configuration (environment variables — all optional):
 *   OLLAMA_BASE_URL  — Base URL of the Ollama API
 *                      Default: http://localhost:11434
 *   OLLAMA_MODEL     — Model to use
 *                      Default: qwen2.5:3b
 *
 * If Ollama is unreachable, the service returns status="error" with a clear
 * message. No other part of the application is affected.
 */

// Maximum characters of extracted text sent to the AI.
// Preserves start + end of long documents; never modifies the stored record.
const MAX_CONTENT_CHARS = 3000;

// Valid values the AI is allowed to return (guards against hallucinated values)
const VALID_SEVERITIES = ["Low", "Medium", "High", "Critical"];
const VALID_ANOMALY_TYPES = [
  "Normal",
  "Confidential File Access",
  "Unauthorized Document Access",
  "Unknown IP",
  "Unusual Login",
  "Other",
];

// ---------------------------------------------------------------------------
// Content truncation — preserve beginning AND end so context is not lost
// ---------------------------------------------------------------------------
function truncateContent(text, maxChars) {
  if (!text || text.length <= maxChars) return text || "";
  const half = Math.floor(maxChars / 2);
  const start = text.slice(0, half);
  const end = text.slice(-half);
  return `${start}\n\n[... content truncated for analysis ...]\n\n${end}`;
}

// ---------------------------------------------------------------------------
// Build the system + user prompt
// ---------------------------------------------------------------------------
function buildPrompt(content, metadata) {
  const metaStr = metadata
    ? `File name: ${metadata.file_name || "unknown"}\nFile type: ${metadata.file_type || "unknown"}\nAuthor: ${metadata.author || "unknown"}\nDepartment: ${metadata.department || "unknown"}\nSource: ${metadata.source || "unknown"}`
    : "";

  const truncated = truncateContent(content, MAX_CONTENT_CHARS);
  const wasLong = content && content.length > MAX_CONTENT_CHARS;

  return {
    system: `You are a digital forensic analyst assistant for the MOSAIQ investigation platform.
Your task is to analyze the content of uploaded evidence files and produce a structured forensic assessment.

Rules:
- Base your analysis ONLY on the provided content and metadata.
- Do NOT invent facts, events, or activities not present in the content.
- Do NOT treat common words (password, login, employee, confidential) as automatic proof of wrongdoing without supporting context.
- If the content is benign, say so clearly. Return severity "Low" and anomaly_type "Normal".
- Be concise and factual. This is for a forensic investigation platform.
- Return ONLY valid JSON, no markdown, no code fences.

Severity scale:
- Low: routine, no suspicious indicators
- Medium: some potentially sensitive content, worth noting but not alarming
- High: clearly sensitive/suspicious content, possible policy violation or data risk
- Critical: strong indicators of a serious incident (exfiltration, unauthorized access, tampering)

Anomaly types (choose the most appropriate, or "Normal" if none apply):
Normal, Confidential File Access, Unauthorized Document Access, Unknown IP, Unusual Login, Other`,

    user: `Analyze the following evidence file and return a JSON object with exactly these fields:
{
  "severity": "Low | Medium | High | Critical",
  "anomaly_type": "Normal | Confidential File Access | Unauthorized Document Access | Unknown IP | Unusual Login | Other",
  "indicators": ["string", ...],
  "reasons": ["string", ...]
}

File metadata:
${metaStr}
${wasLong ? "\nNote: The content below is a truncated portion of the full document." : ""}

Evidence content:
${truncated || "(no extracted text available)"}`,
  };
}

// ---------------------------------------------------------------------------
// Extract a JSON object from a string that may contain surrounding prose.
// Tries strict parse first, then scans for the first { ... } block.
// ---------------------------------------------------------------------------
function extractJSON(text) {
  // 1. Strip markdown code fences and try a direct parse
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }

  // 2. Find the first '{' and the last '}' and try to parse that substring
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  throw new Error("Could not extract a valid JSON object from the model response");
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * @param {string} content       - Extracted text from the evidence file
 * @param {object} [metadata]    - Optional evidence metadata (file_name, file_type, etc.)
 * @returns {Promise<object>}    - AI analysis result
 */
async function analyzeContentWithAI(content, metadata = {}) {
  const ollamaBase = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";

  const { system, user } = buildPrompt(content, metadata);

  let raw;
  try {
    const response = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,   // get a single complete JSON response
        options: {
          temperature: 0.1,  // near-deterministic output
          num_predict: 600,
        },
        format: "json",  // ask Ollama to constrain output to JSON (supported by most models)
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      // Common case: Ollama is running but the model is not pulled yet
      throw new Error(`Ollama returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    // Ollama /api/chat (non-streaming) returns { message: { role, content }, done: true, ... }
    raw = data?.message?.content || "";
  } catch (err) {
    // Covers ECONNREFUSED (Ollama not running), timeout, HTTP errors, etc.
    console.error("[aiForensicAnalyzer] Ollama call failed:", err.message);
    const isConnectionError =
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("fetch failed") ||
      err.message.includes("ENOTFOUND");
    return {
      status: "error",
      message: isConnectionError
        ? "Local AI service is unavailable. Make sure Ollama is running at http://localhost:11434."
        : `AI analysis failed: ${err.message}`,
      severity: null,
      anomaly_type: null,
      indicators: [],
      reasons: [],
      analyzed_at: new Date().toISOString(),
    };
  }

  try {
    const parsedJSON = extractJSON(raw);

    // Validate and sanitize using the existing parseAIResponse logic
    const severity = VALID_SEVERITIES.includes(parsedJSON.severity) ? parsedJSON.severity : "Low";
    const anomaly_type = VALID_ANOMALY_TYPES.includes(parsedJSON.anomaly_type)
      ? parsedJSON.anomaly_type
      : "Normal";
    const indicators = Array.isArray(parsedJSON.indicators)
      ? parsedJSON.indicators.filter((s) => typeof s === "string").slice(0, 10)
      : [];
    const reasons = Array.isArray(parsedJSON.reasons)
      ? parsedJSON.reasons.filter((s) => typeof s === "string").slice(0, 10)
      : [];

    return {
      status: "completed",
      message: `AI analysis completed successfully (model: ${model}).`,
      severity,
      anomaly_type,
      indicators,
      reasons,
      analyzed_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[aiForensicAnalyzer] Failed to parse model response:", err.message, "\nRaw:", raw);
    return {
      status: "error",
      message: `Model returned an unreadable response: ${err.message}`,
      severity: null,
      anomaly_type: null,
      indicators: [],
      reasons: [],
      analyzed_at: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Batch 4 — Investigation Insight
// ---------------------------------------------------------------------------
// Shared helper: make a single call to Ollama with given messages + format
async function callOllama(messages, maxTokens = 800) {
  const ollamaBase = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";

  // ---- Timeout -------------------------------------------------------------
  // Without this the fetch waits indefinitely. A local model loading for the
  // first time can easily run past Node's own 5-minute requestTimeout, at
  // which point Node destroys the browser's socket and the frontend reports
  // "Could not reach the MOSAIQ backend" even though the backend is fine.
  // Aborting here means the backend ALWAYS answers with proper JSON instead.
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 90000);

  let response;
  try {
    response = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.1, num_predict: maxTokens },
        format: "json",
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(
        `Ollama did not respond within ${Math.round(timeoutMs / 1000)}s. ` +
          `The model may still be loading — try again, or raise OLLAMA_TIMEOUT_MS.`
      );
    }
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Ollama returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return { raw: data?.message?.content || "", model };
}

/**
 * Generates a short investigation insight for one evidence record.
 * ---------------------------------------------------------------------------
 * This is a GENERAL digital-forensics summariser, not a summariser for any one
 * kind of investigation. It is given the case, its people and their roles, the
 * selected evidence and its correlated neighbours — all read from the database
 * — and asked to describe what those records show.
 *
 * There is no branching on case type, role name, person name or evidence type
 * anywhere in this function. Whatever the case contains is what the model is
 * told about, so the wording adapts to the case by itself.
 *
 * It describes the OBSERVED PATTERN only. It does not recommend next steps and
 * it does not assert guilt.
 *
 * @param {object}   sourceEvidence  – the selected record (plus its risk fields)
 * @param {object[]} relatedEvidence – correlated records from findRelatedEvidence
 * @param {object}   context         – { caseDoc, people, aeca } (all optional)
 */
async function generateInvestigationInsight(sourceEvidence, relatedEvidence, context = {}) {
  const { caseDoc = {}, people = [], aeca = null } = context;

  // ---- Describe one evidence record using only the fields it actually has --
  function summariseEvidence(ev, label) {
    const lines = [`${label}: ${ev.evidence_id || "?"}`];
    const add = (key, value) => {
      if (value !== undefined && value !== null && value !== "") {
        lines.push(`  ${key}: ${value}`);
      }
    };
    add("Evidence type", ev.evidence_type || ev.file_type);
    add("Person", ev.person || ev.author);
    add("Other party", ev.related_person);
    add("Place", ev.place);
    add("Timestamp", ev.timestamp ? new Date(ev.timestamp).toISOString() : "");
    add("Source", ev.source);
    add("Anomaly", ev.anomaly_type);
    add("Severity", ev.severity);
    add("Integrity", ev.integrity_status);
    add("Risk score", ev.risk_score != null ? `${ev.risk_score}/100` : "");
    add("Content", ev.content ? truncateContent(ev.content, 400) : "");
    return lines.join("\n");
  }

  // ---- Case context: only the parts that exist ----------------------------
  const caseLines = [];
  if (caseDoc.case_name) caseLines.push(`Case name: ${caseDoc.case_name}`);
  if (caseDoc.case_type) caseLines.push(`Case type: ${caseDoc.case_type}`);
  if (caseDoc.description) {
    caseLines.push(`Case description: ${truncateContent(caseDoc.description, 500)}`);
  }
  if (caseDoc.incident_date) caseLines.push(`Reported incident date: ${caseDoc.incident_date}`);
  if (caseDoc.incident_location) caseLines.push(`Incident location: ${caseDoc.incident_location}`);

  // People and roles, straight from the case. If the case declares no roles,
  // this block is simply absent and the model is told nothing about roles.
  const peopleLines = people
    .map((p) => {
      const bits = [`- ${p.label || p.name}`];
      if (p.role) bits.push(`role: ${p.role}`);
      if (p.evidenceCount != null) bits.push(`${p.evidenceCount} evidence item(s)`);
      if (Array.isArray(p.evidenceTypes) && p.evidenceTypes.length) {
        bits.push(`types: ${p.evidenceTypes.map((t) => t.type).join(", ")}`);
      }
      if (p.aecaScore != null) bits.push(`AECA ${p.aecaScore}/100`);
      return bits.join(" | ");
    })
    .join("\n");

  const sourceSummary = summariseEvidence(sourceEvidence, "Selected evidence");
  const relatedSummaries = relatedEvidence
    .map((r, i) => {
      const summary = summariseEvidence(r, `Related evidence ${i + 1}`);
      return `${summary}\n  Correlation score: ${r.correlation_score}\n  Correlation reasons: ${r.reasons.join("; ")}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a digital forensics analyst assistant for the MOSAIQ investigation platform.

MOSAIQ is a GENERAL investigation platform. A case may be any kind of investigation whatsoever. Never assume what kind of case this is — describe only what the supplied records show.

Rules:
- Base every statement ONLY on the supplied case, people and evidence data.
- Do NOT invent people, events, times, places or relationships that are not in the data.
- Refer to people by the names and roles given. If no role is given for someone, do not invent one.
- Describe the OBSERVED PATTERN in the evidence. Report what the records show.
- Do NOT recommend, suggest or imply any next step, action, review, check or line of enquiry.
- Do NOT state or imply that anyone is guilty, responsible for, or committed anything.
- AECA is an evidence-association and prioritisation score. It measures how strongly records relate to each other, NOT probability of guilt. Never describe it as a likelihood that someone did something.
- Be brief and factual.
- Return ONLY valid JSON with no markdown fences.`;

  const userPrompt = `${caseLines.length ? `CASE\n${caseLines.join("\n")}\n\n` : ""}${
    peopleLines ? `PEOPLE IN THIS CASE\n${peopleLines}\n\n` : ""
  }${sourceSummary}
${aeca ? `  AECA score: ${aeca.aeca_score}/100 (${aeca.aeca_level})` : ""}

${
  relatedEvidence.length > 0
    ? `RELATED EVIDENCE (${relatedEvidence.length} record(s)):\n\n${relatedSummaries}`
    : "No related evidence was found for this record."
}

Return a JSON object with exactly these fields:
{
  "observed_pattern": "One short paragraph (2-3 sentences) describing what these specific records show. Name the people and evidence types actually present. State facts only.",
  "evidence_pattern": ["A specific fact drawn from the records above", "Another specific fact", "Another specific fact"],
  "related_evidence_ids": ["EV-XXXXXX"]
}

"evidence_pattern" must contain 2 to 4 short factual bullet points taken from the records above. Each must mention concrete detail (a name, an evidence type, a time, a place or a score). Do not repeat generic sentences. Do not recommend anything. Do not state guilt.`;

  let raw;
  let model;
  try {
    ({ raw, model } = await callOllama(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      500
    ));
  } catch (err) {
    console.error("[aiForensicAnalyzer] Investigation insight call failed:", err.message);
    const isConn =
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("fetch failed") ||
      err.message.includes("ENOTFOUND");
    return {
      status: "error",
      message: isConn
        ? `Local AI service is unavailable. Make sure Ollama is running at ${
            process.env.OLLAMA_BASE_URL || "http://localhost:11434"
          }.`
        : err.message,
      observed_pattern: null,
      evidence_pattern: [],
      related_evidence_ids: [],
      analyzed_at: new Date().toISOString(),
    };
  }

  try {
    const parsed = extractJSON(raw);

    const observed_pattern =
      typeof parsed.observed_pattern === "string" ? parsed.observed_pattern.slice(0, 700) : "";

    // Accept the odd shape drift from a small local model without failing.
    const rawPattern = Array.isArray(parsed.evidence_pattern)
      ? parsed.evidence_pattern
      : Array.isArray(parsed.relationship_reasons)
        ? parsed.relationship_reasons
        : [];

    const evidence_pattern = rawPattern
      .filter((s) => typeof s === "string" && s.trim())
      .slice(0, 4);

    const related_evidence_ids = Array.isArray(parsed.related_evidence_ids)
      ? parsed.related_evidence_ids.filter((s) => typeof s === "string").slice(0, 20)
      : [];

    return {
      status: "completed",
      message: `Investigation insight generated (model: ${model}).`,
      observed_pattern,
      evidence_pattern,
      related_evidence_ids,
      analyzed_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[aiForensicAnalyzer] Failed to parse insight response:", err.message, "\nRaw:", raw);
    return {
      status: "error",
      message: `AI returned an unreadable response: ${err.message}`,
      observed_pattern: null,
      evidence_pattern: [],
      related_evidence_ids: [],
      analyzed_at: new Date().toISOString(),
    };
  }
}


module.exports = { analyzeContentWithAI, generateInvestigationInsight };
