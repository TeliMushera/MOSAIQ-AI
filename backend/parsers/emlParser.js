/**
 * Minimal .eml (RFC 822 email) parser — extracts the common headers and the
 * message body without pulling in a full mail-parsing library, per spec
 * ("keep this simple").
 */
async function parseEml(buffer) {
  const raw = buffer.toString("utf-8");

  // Header block ends at the first blank line.
  const splitIndex = raw.search(/\r?\n\r?\n/);
  const headerBlock = splitIndex >= 0 ? raw.slice(0, splitIndex) : raw;
  const body = splitIndex >= 0 ? raw.slice(splitIndex).trim() : "";

  const headers = {};
  let lastKey = null;
  headerBlock.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (match) {
      lastKey = match[1].toLowerCase();
      headers[lastKey] = match[2];
    } else if (lastKey && /^\s+/.test(line)) {
      // Folded header continuation line
      headers[lastKey] += " " + line.trim();
    }
  });

  return {
    text: body || raw,
    metadata: {
      from: headers.from || "",
      to: headers.to || "",
      subject: headers.subject || "",
      date: headers.date || "",
    },
  };
}

module.exports = { parseEml };
