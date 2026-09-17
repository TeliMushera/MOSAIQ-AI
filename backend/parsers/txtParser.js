/**
 * Plain text parser — the file bytes are already the content.
 */
async function parseTxt(buffer) {
  const text = buffer.toString("utf-8");
  return {
    text,
    metadata: {
      characterCount: text.length,
      lineCount: text.split(/\r\n|\r|\n/).length,
    },
  };
}

module.exports = { parseTxt };
