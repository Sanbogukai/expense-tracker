// Change the currency here; amounts are stored as integer cents everywhere else.
export const CURRENCY = 'USD'

const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY })

export const formatCents = (cents) => formatter.format(cents / 100)

// "12.5" or "12.50" becomes 1250. Returns null for anything that is not a positive amount
// with at most two decimals, so the form can say so before calling the API.
export function toCents(text) {
  const trimmed = text.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ''] = trimmed.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return cents > 0 ? cents : null
}

// Local dates, not toISOString(): that is UTC and gives tomorrow's date late in the evening.
const pad = (n) => String(n).padStart(2, '0')

export function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const currentMonth = () => todayLocal().slice(0, 7)

export function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
