// Thin wrappers over fetch. Every failure becomes an Error whose message is safe to show,
// with the server's per-field issues attached when validation failed.
// This is the only file that talks to the server; components call these functions instead.

// Each browser has its own private list on the server, found by a random key kept here in
// localStorage and sent in this header. The server forgets a key when its owner goes unused
// for 30 days, or when Render wipes the disk on a restart; a 401 answer then gets a new key
// (with the sample rows again) and the request is sent once more.
const OWNER_HEADER = 'X-Owner-Key'
const STORAGE_KEY = 'expense-tracker.owner-key'
// 204: success with no body. 401: the key is missing or the server does not know it.
const HTTP_NO_CONTENT = 204
const HTTP_UNAUTHORIZED = 401

// The key in use, and the owner request in flight if there is one. The page asks for the list
// and the summary at once; sharing one pending request makes one owner, not two.
const owner = { key: localStorage.getItem(STORAGE_KEY), pending: null }

// Asks the server for a new owner, keeps its key and returns it.
async function requestOwner() {
  try {
    // A new owner with the sample rows.
    const res = await fetch('/api/owners', { method: 'POST' })
    // 429 (too many new lists from this address) or a server fault.
    if (!res.ok) throw new Error(`Could not start a new list (${res.status})`)
    // The answer is { key }.
    const { key } = await res.json()
    // Kept for the next visit.
    localStorage.setItem(STORAGE_KEY, key)
    // And for the next request.
    owner.key = key
    return key
  } finally {
    // Settled either way, so a later call can try again.
    owner.pending = null
  }
}

// A new owner, shared by everyone who asks while it is on its way.
function newOwner() {
  // Starts a request only when none is running.
  owner.pending ??= requestOwner()
  return owner.pending
}

// The key to retry with after `stale` got a 401. If another request has already replaced it,
// that key is used instead of making yet another owner.
function replaceKey(stale) {
  return owner.key !== null && owner.key !== stale ? Promise.resolve(owner.key) : newOwner()
}

// Sends one request with the key, getting a key first when there is none.
async function send(path, options, key) {
  // Relative URL: in development Vite forwards /api to the server on port 3000 (vite.config.js);
  // in production the same Express server serves both the page and /api.
  return fetch(`/api${path}`, {
    // Copies in method, body and anything else the caller passed.
    ...options,
    headers: {
      // Only requests with a body (POST) say they are sending JSON.
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      // The owner key on every request.
      [OWNER_HEADER]: key,
    },
  })
}

// Sends one request to /api + path and returns the parsed JSON body.
// options is passed through to fetch (method, body, ...); it defaults to an empty object.
async function request(path, options = {}) {
  // The stored key, or a new owner's.
  const key = owner.key ?? (await newOwner())
  // First try.
  const first = await send(path, options, key)
  // Once only: a second 401 with a brand-new key is treated as an ordinary error below.
  const res = first.status === HTTP_UNAUTHORIZED ? await send(path, options, await replaceKey(key)) : first
  // 204 "No Content" (a successful delete) has no body to read.
  if (res.status === HTTP_NO_CONTENT) return null

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
