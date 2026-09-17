const mammoth = require("mammoth");

/**
 * Extracts text from a modern .docx file buffer using mammoth.
 */
async function parseDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value ? result.value.trim() : "",
    metadata: {
      warnings: (result.messages || []).map((m) => m.message),
    },
  };
}

/**
 * Legacy .doc (binary OLE) files cannot be reliably parsed without extra
 * native dependencies. Rather than pretending extraction succeeded, we
 * store the file as-is and return a clear processing message, per spec.
 */
async function parseDoc() {
  return {
    text: "",
    metadata: {},
    unsupported: true,
    message:
      "Legacy .doc (binary Word) format is not supported for automatic text " +
      "extraction in this MVP. The file has been stored and hashed, but no " +
      "text was extracted. Convert to .docx for full processing.",
  };
}

module.exports = { parseDocx, parseDoc };
