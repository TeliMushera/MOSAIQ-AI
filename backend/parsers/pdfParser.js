const pdfParse = require("pdf-parse");

/**
 * Extracts text and basic metadata from a PDF file buffer.
 */
async function parsePdf(buffer) {
  const result = await pdfParse(buffer);
  return {
    text: result.text ? result.text.trim() : "",
    metadata: {
      pageCount: result.numpages || 0,
      pdfInfo: result.info || {},
    },
  };
}

module.exports = { parsePdf };
