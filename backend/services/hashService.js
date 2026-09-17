const crypto = require("crypto");

/**
 * Generates a real SHA-256 hash for the given file buffer or string.
 * Always produces a 64-character hex digest.
 */
function sha256(bufferOrString) {
  return crypto.createHash("sha256").update(bufferOrString).digest("hex");
}

module.exports = { sha256 };
