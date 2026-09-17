const path = require("path");
const { sha256 } = require("./hashService");
const { parsePdf } = require("../parsers/pdfParser");
const { parseDocx, parseDoc } = require("../parsers/docxParser");
const { parseTxt } = require("../parsers/txtParser");
const { parseCsv } = require("../parsers/csvParser");
const { parseEml } = require("../parsers/emlParser");

const SUPPORTED_EXTENSIONS = ["pdf", "doc", "docx", "txt", "csv", "eml"];

function extensionOf(fileName) {
  return path.extname(fileName || "").replace(".", "").toLowerCase();
}

function isSupportedExtension(ext) {
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Runs the full evidence processing pipeline for an uploaded file:
 *   validate -> identify type -> extract text/metadata -> SHA-256 -> normalize
 *
 * Returns a result object describing what happened; never throws for
 * "unsupported extraction" cases (those are reported as processing_status
 * "Failed"/"Completed with warnings" instead), only for truly invalid input.
 */
async function processUploadedFile({ buffer, originalName }) {
  const ext = extensionOf(originalName);

  if (!buffer || buffer.length === 0) {
    throw new Error("Uploaded file is empty");
  }

  if (!isSupportedExtension(ext)) {
    const err = new Error(
      `Unsupported file type ".${ext}". Supported formats: ${SUPPORTED_EXTENSIONS.join(
        ", "
      ).toUpperCase()}`
    );
    err.status = 400;
    throw err;
  }

  const hash_sha256 = sha256(buffer);
  const file_size_kb = Math.max(1, Math.round(buffer.length / 1024));

  let extraction;
  let processing_status = "Completed";
  let processing_message = "File processed successfully.";

  try {
    switch (ext) {
      case "pdf":
        extraction = await parsePdf(buffer);
        break;
      case "docx":
        extraction = await parseDocx(buffer);
        break;
      case "doc":
        extraction = await parseDoc(buffer);
        break;
      case "txt":
        extraction = await parseTxt(buffer);
        break;
      case "csv":
        extraction = await parseCsv(buffer);
        break;
      case "eml":
        extraction = await parseEml(buffer);
        break;
      default:
        extraction = { text: "", metadata: {} };
    }

    if (extraction.unsupported) {
      processing_status = "Failed";
      processing_message = extraction.message;
    }
  } catch (err) {
    // A parser threw (e.g. corrupted PDF). Do not pretend it worked.
    processing_status = "Failed";
    processing_message = `Text extraction failed: ${err.message}`;
    extraction = { text: "", metadata: { extractionError: err.message } };
  }

  return {
    file_type: ext.toUpperCase(),
    file_size_kb,
    hash_sha256,
    integrity_status: "Verified",
    processing_status,
    processing_message,
    extracted_text: extraction.text || "",
    metadata: extraction.metadata || {},
  };
}

module.exports = { processUploadedFile, SUPPORTED_EXTENSIONS };
