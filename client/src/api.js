// Thin wrappers over fetch. Every failure becomes an Error whose message is safe to show,
// with the server's per-field issues attached when validation failed.
// This is the only file that talks to the server; components call these functions instead.

// Sends one request to /api + path and returns the parsed JSON body.
// options is passed through to fetch (method, body, ...); it defaults to an empty object.
async function request(path, options = {}) {
  // Relative URL: in development Vite forwards /api to the server on port 3000 (vite.config.js);
  // in production the same Express server serves both the page and /api.
  const res = await fetch(`/api${path}`, {
    // Only requests with a body (POST) say they are sending JSON.
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    // Copies in method, body and anything else the caller passed.
    ...options,
  })
  // 204 "No Content" (a successful delete) has no body to read.
  if (res.status === 204) return null

  // Reads the JSON body; if the body is not JSON at all, use null instead of crashing.
  const body = await res.json().catch(() => null)
  // res.ok is true for statuses 200 to 299; anything else is an error.
  if (!res.ok) {
    // Prefer the server's own message; fall back to the status code.
    const error = new Error(body?.error ?? `Request failed (${res.status})`)
    // Field-level problems from a 400, so the form can show each next to its input.
    error.issues = body?.issues ?? []
    // Hands the error to whoever called, who decides how to show it.
    throw error
  }
  // Success: the parsed data.
  return body
}

// Builds "?category=Food&month=2026-11" from an object, leaving out empty values.
function query(params) {
  // URLSearchParams handles the encoding of special characters.
  const search = new URLSearchParams()
  // Walks each key/value pair of the object.
  for (const [key, value] of Object.entries(params)) {
    // Skips '' and undefined, so the server never sees ?category= with nothing after it.
    if (value) search.set(key, value)
  }
  // "category=Food&month=2026-11", or '' when nothing was set.
  const text = search.toString()
  // Adds the leading ? only when there is something to send.
  return text ? `?${text}` : ''
}

// The category list for the dropdowns.
export const getCategories = () => request('/categories')

// The transaction list, filtered by category and month when they are set.
export const getTransactions = ({ category, month }) =>
  request(`/transactions${query({ category, month })}`)

// Totals for a month, or all time when month is empty.
export const getSummary = ({ month }) => request(`/summary${query({ month })}`)

// Saves a new transaction; JSON.stringify turns the object into the JSON text fetch sends.
export const createTransaction = (data) =>
  request('/transactions', { method: 'POST', body: JSON.stringify(data) })

// Deletes one transaction by id.
export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: 'DELETE' })
