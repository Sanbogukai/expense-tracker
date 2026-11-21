// The app is CAD only, formatted Canadian style for every visitor: $1,234.50 and Nov. 21, 2026.
// Amounts are stored as integer cents everywhere else.
export const CURRENCY = 'CAD'
export const LOCALE = 'en-CA'

const formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY })

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
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// "2026-11" becomes "November 2026".
export function formatMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}
