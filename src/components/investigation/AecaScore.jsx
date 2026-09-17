/**
 * AecaScore — the one number the whole investigation UI revolves around.
 *
 * Shows: AECA Score: 78 / Level: High
 * plus a bar so the level is readable without reading the number.
 */

const LEVEL_COLOUR = {
  Low: "#4fae9b",
  Medium: "#e0a239",
  High: "#d16660",
  Critical: "#e5514a",
};

export default function AecaScore({ score, level, size = "md", label = "AECA score" }) {
  const colour = LEVEL_COLOUR[level] || LEVEL_COLOUR.Low;

  return (
    <div className={`aeca-score aeca-${size}`}>
      <div className="aeca-head">
        <span className="aeca-label">{label}</span>
        <span className="aeca-level" style={{ color: colour, borderColor: colour }}>
          {level}
        </span>
      </div>

      <div className="aeca-value" style={{ color: colour }}>
        {score}
        <span className="aeca-outof">/100</span>
      </div>

      <div className="aeca-bar">
        <div
          className="aeca-bar-fill"
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: colour }}
        />
      </div>
    </div>
  );
}
