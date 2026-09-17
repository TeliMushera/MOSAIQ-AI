const { parse } = require("csv-parse/sync");

/**
 * Extracts columns/rows and basic metadata from an uploaded CSV file.
 */
async function parseCsv(buffer) {
  const text = buffer.toString("utf-8");
  let rows = [];
  let columns = [];

  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
    columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  } catch (err) {
    // Fall back to raw text if the CSV can't be structurally parsed.
    return {
      text,
      metadata: { parseError: err.message },
    };
  }

  const preview = rows.slice(0, 20);

  return {
    text,
    metadata: {
      columns,
      rowCount: rows.length,
      preview,
    },
  };
}

module.exports = { parseCsv };
