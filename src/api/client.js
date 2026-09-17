// ---------------------------------------------------------------------------
// MOSAIQ API client
// ---------------------------------------------------------------------------
// Thin wrapper around fetch() that talks to the MOSAIQ Express backend.
// Every frontend page reads/writes through the functions in src/api/*.js
// instead of touching fetch() directly, so the request/response shape is
// defined in one place.
// ---------------------------------------------------------------------------

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      ...options,
    });
  } catch (err) {
    throw new ApiError(
      "Could not reach the MOSAIQ backend. Make sure the backend server is running.",
      0
    );
  }

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message = (payload && payload.error) || res.statusText || "Request failed";
    throw new ApiError(message, res.status);
  }

  return payload;
}

export function apiGet(path) {
  return request(path, { method: "GET" });
}

export function apiPost(path, body) {
  const isFormData = body instanceof FormData;
  return request(path, {
    method: "POST",
    body: isFormData ? body : JSON.stringify(body),
  });
}

export function apiPut(path, body) {
  return request(path, { method: "PUT", body: JSON.stringify(body) });
}

export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}

/** Builds a query string from a params object, skipping empty values. */
export function toQueryString(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") usp.set(key, value);
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}
