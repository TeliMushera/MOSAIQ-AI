import { useMemo, useRef, useState } from "react";

/**
 * InvestigationMap — the visual centrepiece of MOSAIQ.
 * ---------------------------------------------------------------------------
 * Draws the relationship graph the backend returns:
 *
 *        CASE  (centre)
 *          |
 *       PEOPLE  (ring around the case)
 *          |
 *      EVIDENCE  (fanned out behind each person)
 *
 * Deliberately built with plain SVG and a fixed, deterministic layout instead
 * of a graph library or a physics simulation:
 *
 *   - no extra dependency to install or explain
 *   - the same case always draws the same picture
 *   - the positioning is simple trigonometry, easy to talk through
 *
 * Layout rule:
 *   Each person gets an equal slice of the circle (360° / number of people).
 *   The person sits at the middle of their slice. Their evidence is fanned
 *   out across that same slice, further from the centre — so one person's
 *   evidence can never drift into another person's area.
 * ---------------------------------------------------------------------------
 */

// ---- Canvas -----------------------------------------------------------------
const VIEW_W = 1100;
const VIEW_H = 1000;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

// ---- Ring radii -------------------------------------------------------------
const PERSON_RADIUS = 195; // distance from case to person
const EVIDENCE_RING_A = 345; // inner evidence ring
const EVIDENCE_RING_B = 435; // outer ring, used when a person has many items

// A person's evidence fans across this share of their slice (0-1).
// Below 1 so there is always a visible gap between neighbouring people.
const SLICE_FILL = 0.78;

// ---- Node sizes -------------------------------------------------------------
const CASE_W = 200;
const CASE_H = 58;
const PERSON_R = 30;
const EV_W = 76;
const EV_H = 30;

// ---- Colours by AECA level (reuses the app's existing palette) --------------
const LEVEL_COLOUR = {
  Low: "#4fae9b",
  Medium: "#e0a239",
  High: "#d16660",
  Critical: "#e5514a",
};

// Short tag drawn inside each evidence node.
// Known types get a compact abbreviation purely so the label fits the node;
// ANY other type still works and simply falls back to its own uppercased name.
// Nothing here restricts which evidence types a case may contain.
const TYPE_ABBREVIATIONS = {
  Message: "MSG",
  "Social Media": "SOCIAL",
  Location: "GEO",
  Transaction: "TXN",
  Document: "DOC",
};

function levelColour(level) {
  return LEVEL_COLOUR[level] || LEVEL_COLOUR.Low;
}

function typeTag(type) {
  if (!type) return "EVIDENCE";
  if (TYPE_ABBREVIATIONS[type]) return TYPE_ABBREVIATIONS[type];
  // Unknown type: use it as-is, shortened only if it would overflow the node.
  const upper = type.toUpperCase();
  return upper.length <= 8 ? upper : `${upper.slice(0, 7)}…`;
}

// ---------------------------------------------------------------------------
// Layout — pure maths, no state. Given the graph, returns a position per node.
// ---------------------------------------------------------------------------
function layoutGraph(graph) {
  const positions = new Map();
  if (!graph || !graph.nodes) return positions;

  const caseNode = graph.nodes.find((n) => n.type === "case");
  const people = graph.nodes.filter((n) => n.type === "person");
  const evidence = graph.nodes.filter((n) => n.type === "evidence");

  // 1. The case sits dead centre.
  if (caseNode) positions.set(caseNode.id, { x: CX, y: CY });

  if (people.length === 0) return positions;

  // 2. People are spread evenly around the case.
  const slice = (Math.PI * 2) / people.length;
  // Start at the top of the circle so the layout looks intentional.
  const startAngle = -Math.PI / 2;

  const personAngle = new Map();

  people.forEach((person, i) => {
    const angle = startAngle + i * slice;
    personAngle.set(person.id, angle);
    positions.set(person.id, {
      x: CX + Math.cos(angle) * PERSON_RADIUS,
      y: CY + Math.sin(angle) * PERSON_RADIUS,
    });
  });

  // 3. Evidence fans out inside its owner's slice.
  const byOwner = new Map();
  for (const ev of evidence) {
    const ownerId = `person:${(ev.person || "Unknown").toLowerCase()}`;
    if (!byOwner.has(ownerId)) byOwner.set(ownerId, []);
    byOwner.get(ownerId).push(ev);
  }

  for (const [ownerId, items] of byOwner) {
    const centreAngle = personAngle.get(ownerId);
    if (centreAngle === undefined) continue;

    // Use two rings once a person has more than four items, so nodes never
    // crowd each other however lopsided the case is.
    const useTwoRings = items.length > 4;
    const rings = useTwoRings
      ? [
          { radius: EVIDENCE_RING_A, items: items.filter((_, i) => i % 2 === 0) },
          { radius: EVIDENCE_RING_B, items: items.filter((_, i) => i % 2 === 1) },
        ]
      : [{ radius: EVIDENCE_RING_A, items }];

    const span = slice * SLICE_FILL;

    for (const ring of rings) {
      const n = ring.items.length;
      ring.items.forEach((ev, i) => {
        // Spread items across the slice; a single item sits on the centre line.
        const t = n === 1 ? 0.5 : i / (n - 1);
        const angle = centreAngle - span / 2 + t * span;
        positions.set(ev.id, {
          x: CX + Math.cos(angle) * ring.radius,
          y: CY + Math.sin(angle) * ring.radius,
        });
      });
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function InvestigationMap({
  graph,
  selectedId,
  onSelect,
  showConnections = true,
}) {
  const positions = useMemo(() => layoutGraph(graph), [graph]);
  const [hoverId, setHoverId] = useState(null);

  // ---- Pan & zoom: we simply move/scale the SVG viewBox ---------------------
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef(null);

  const zoomBy = (factor) =>
    setView((v) => ({ ...v, zoom: Math.min(2.5, Math.max(0.5, v.zoom * factor)) }));

  const resetView = () => setView({ x: 0, y: 0, zoom: 1 });

  const handleMouseDown = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: view };
  };

  const handleMouseMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Convert screen pixels into viewBox units so panning feels 1:1.
    const scale = (VIEW_W * drag.origin.zoom) / (e.currentTarget.clientWidth || VIEW_W);
    setView({
      ...drag.origin,
      x: drag.origin.x - (e.clientX - drag.startX) * scale,
      y: drag.origin.y - (e.clientY - drag.startY) * scale,
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="map-empty">
        <p>No evidence has been added to this case yet, so there is nothing to map.</p>
      </div>
    );
  }

  // ---- Work out what should be highlighted --------------------------------
  const focusId = hoverId || selectedId;

  // Every node directly joined to the focused node, so we can dim the rest.
  const connectedIds = new Set();
  if (focusId) {
    connectedIds.add(focusId);
    for (const link of graph.links) {
      if (link.source === focusId) connectedIds.add(link.target);
      if (link.target === focusId) connectedIds.add(link.source);
    }
  }

  const isDimmed = (id) => Boolean(focusId) && !connectedIds.has(id);

  const linkIsActive = (link) =>
    Boolean(focusId) && (link.source === focusId || link.target === focusId);

  const visibleLinks = graph.links.filter(
    (l) => showConnections || l.type !== "correlated"
  );

  // The viewBox is a window onto the drawing. Zooming = making the window
  // bigger or smaller around the centre; panning = sliding the window.
  const winW = VIEW_W * view.zoom;
  const winH = VIEW_H * view.zoom;
  const vb = [CX - winW / 2 + view.x, CY - winH / 2 + view.y, winW, winH].join(" ");

  return (
    <div className="map-wrap">
      {/* ---- Controls ---- */}
      <div className="map-controls">
        <button className="map-btn" onClick={() => zoomBy(1 / 1.2)} title="Zoom in">
          +
        </button>
        <button className="map-btn" onClick={() => zoomBy(1.2)} title="Zoom out">
          −
        </button>
        <button className="map-btn map-btn-wide" onClick={resetView} title="Reset view">
          Reset
        </button>
      </div>

      {/* ---- Legend ---- */}
      <div className="map-legend">
        <div className="map-legend-row">
          <span className="legend-swatch legend-case" /> Case
        </div>
        <div className="map-legend-row">
          <span className="legend-swatch legend-person" /> Person
        </div>
        <div className="map-legend-row">
          <span className="legend-swatch legend-evidence" /> Evidence
        </div>
        <div className="map-legend-divider" />
        {["Low", "Medium", "High", "Critical"].map((lvl) => (
          <div className="map-legend-row" key={lvl}>
            <span className="legend-swatch" style={{ background: levelColour(lvl) }} />
            {lvl}
          </div>
        ))}
      </div>

      <svg
        className="map-svg"
        viewBox={vb}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => {
          endDrag();
          setHoverId(null);
        }}
      >
        {/* ================= LINKS (drawn first, so they sit behind) ========= */}
        <g>
          {visibleLinks.map((link, i) => {
            const a = positions.get(link.source);
            const b = positions.get(link.target);
            if (!a || !b) return null;

            const active = linkIsActive(link);
            const dim = Boolean(focusId) && !active;

            // Each link type gets its own look so the map reads at a glance.
            const style =
              link.type === "correlated"
                ? { stroke: "#e0a239", width: 1.4, dash: "5 5" }
                : link.type === "contact"
                ? { stroke: "#6f93c9", width: 1.6, dash: "2 4" }
                : link.type === "owns"
                ? { stroke: "#4a5468", width: 2, dash: null }
                : { stroke: "#3a4354", width: 1.4, dash: null };

            return (
              <line
                key={`${link.source}-${link.target}-${link.type}-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={style.stroke}
                strokeWidth={active ? style.width + 1 : style.width}
                strokeDasharray={style.dash || undefined}
                opacity={dim ? 0.12 : active ? 0.95 : 0.55}
              />
            );
          })}
        </g>

        {/* ================= NODES =========================================== */}
        {graph.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const dim = isDimmed(node.id);
          const selected = node.id === selectedId;
          const opacity = dim ? 0.18 : 1;

          // ---- CASE node ----
          if (node.type === "case") {
            return (
              <g
                key={node.id}
                opacity={opacity}
                className="map-node"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(node);
                }}
                onMouseEnter={() => setHoverId(node.id)}
              >
                <rect
                  x={pos.x - CASE_W / 2}
                  y={pos.y - CASE_H / 2}
                  width={CASE_W}
                  height={CASE_H}
                  rx={6}
                  fill="#1c212b"
                  stroke={selected ? "#e9e8e3" : "#4a5468"}
                  strokeWidth={selected ? 2.5 : 1.6}
                />
                <text
                  x={pos.x}
                  y={pos.y - 6}
                  textAnchor="middle"
                  className="map-text-id"
                >
                  {node.caseId}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + 13}
                  textAnchor="middle"
                  className="map-text-case"
                >
                  {node.label.length > 26 ? node.label.slice(0, 25) + "…" : node.label}
                </text>
              </g>
            );
          }

          // ---- PERSON node ----
          if (node.type === "person") {
            const colour = levelColour(node.aecaLevel);
            return (
              <g
                key={node.id}
                opacity={opacity}
                className="map-node"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(node);
                }}
                onMouseEnter={() => setHoverId(node.id)}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={PERSON_R}
                  fill="#161a22"
                  stroke={selected ? "#e9e8e3" : colour}
                  strokeWidth={selected ? 3 : 2.2}
                />
                <text x={pos.x} y={pos.y + 5} textAnchor="middle" className="map-text-score">
                  {node.aecaScore}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + PERSON_R + 18}
                  textAnchor="middle"
                  className="map-text-person"
                >
                  {node.label}
                </text>
                {/* Role comes from the case data. When the case declares no
                    role for this person the line is omitted entirely. */}
                {node.role && (
                  <text
                    x={pos.x}
                    y={pos.y + PERSON_R + 32}
                    textAnchor="middle"
                    className="map-text-role"
                  >
                    {node.role}
                  </text>
                )}
                <text
                  x={pos.x}
                  y={pos.y + PERSON_R + (node.role ? 46 : 33)}
                  textAnchor="middle"
                  className="map-text-sub"
                >
                  {node.evidenceCount} item{node.evidenceCount === 1 ? "" : "s"}
                </text>
              </g>
            );
          }

          // ---- EVIDENCE node ----
          const colour = levelColour(node.aecaLevel);
          return (
            <g
              key={node.id}
              opacity={opacity}
              className="map-node"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(node);
              }}
              onMouseEnter={() => setHoverId(node.id)}
            >
              <rect
                x={pos.x - EV_W / 2}
                y={pos.y - EV_H / 2}
                width={EV_W}
                height={EV_H}
                rx={4}
                fill="#161a22"
                stroke={selected ? "#e9e8e3" : colour}
                strokeWidth={selected ? 2.5 : 1.5}
              />
              {/* Colour bar makes the AECA level readable without reading text */}
              <rect
                x={pos.x - EV_W / 2}
                y={pos.y - EV_H / 2}
                width={4}
                height={EV_H}
                rx={2}
                fill={colour}
              />
              <text x={pos.x + 2} y={pos.y + 4} textAnchor="middle" className="map-text-ev">
                {typeTag(node.evidenceType)}
              </text>
              {/* Caption and time are built by the backend from the record's
                  own fields (e.g. "<person> → <other>", "14 Mar, 10:42 PM"), so
                  each node describes itself using real data. Either line is
                  skipped when the record does not carry it. */}
              {node.caption && (
                <text
                  x={pos.x}
                  y={pos.y + EV_H / 2 + 13}
                  textAnchor="middle"
                  className="map-text-caption"
                >
                  {node.caption.length > 24
                    ? `${node.caption.slice(0, 23)}…`
                    : node.caption}
                </text>
              )}
              {node.captionTime && (
                <text
                  x={pos.x}
                  y={pos.y + EV_H / 2 + (node.caption ? 25 : 13)}
                  textAnchor="middle"
                  className="map-text-sub"
                >
                  {node.captionTime}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="map-hint">
        Click a person to see their evidence. Click an evidence node to open it. Drag to
        pan, use the buttons to zoom.
      </p>
    </div>
  );
}
