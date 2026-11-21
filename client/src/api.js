// Thin wrappers over fetch. Every failure becomes an Error whose message is safe to show,
// with the server's per-field issues attached when validation failed.
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  })
  if (res.status === 204) return null

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error(body?.error ?? `Request failed (${res.status})`)
    error.issues = body?.issues ?? []
    throw error
  }
  return body
}

function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const getCategories = () => request('/categories')

export const getTransactions = ({ category, month }) =>
  request(`/transactions${query({ category, month })}`)

export const getSummary = ({ month }) => request(`/summary${query({ month })}`)

export const createTransaction = (data) =>
  request('/transactions', { method: 'POST', body: JSON.stringify(data) })

export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: 'DELETE' })
