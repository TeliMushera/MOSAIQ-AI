/**
 * Wraps an async route handler so thrown/rejected errors reach the error
 * handler middleware instead of crashing the process.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Express error-handling middleware. Produces consistent, readable JSON
 * errors for the frontend.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error("[error]", err.message);

  const status = err.status || (err.name === "ValidationError" ? 400 : 500);
  res.status(status).json({
    error: err.message || "Internal server error",
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { asyncHandler, errorHandler, notFound };
