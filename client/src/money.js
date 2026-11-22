// The app is CAD only, formatted Canadian style for every visitor: $1,234.50 and Nov 21, 2026.
// Amounts are stored as integer cents everywhere else.

// The currency code Intl uses for the $ sign and decimals.
export const CURRENCY = 'CAD'
// Canadian English: sets the separators and the date wording.
export const LOCALE = 'en-CA'

// Built once and reused, because creating a formatter is slower than using one.
const formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY })

// 1250 cents becomes "$12.50". Dividing by 100 happens only here, at display time.
export const formatCents = (cents) => formatter.format(cents / 100)

// "12.5" or "12.50" becomes 1250. Returns null for anything that is not a positive amount
// with at most two decimals, so the form can say so before calling the API.
export function toCents(text) {
  // Ignores spaces the user typed around the number.
  const trimmed = text.trim()
  // Digits, then optionally a dot and one or two digits. Rejects "-5", "1e3", "12.345", "abc".
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  // "12.5" splits into "12" and "5"; with no dot, fraction defaults to ''.
  const [whole, fraction = ''] = trimmed.split('.')
  // Works on the digits as text, never with floating point: "5" is padded to "50" cents.
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  // "0" and "0.00" pass the pattern but are not valid amounts.
  return cents > 0 ? cents : null
}

// Local dates, not toISOString(): that is UTC and gives tomorrow's date late in the evening.

// Adds a leading zero: 5 becomes "05", so dates are always YYYY-MM-DD.
const pad = (n) => String(n).padStart(2, '0')

// Today's date on this computer, as YYYY-MM-DD.
export function todayLocal() {
  // The current moment, read in the visitor's own time zone below.
  const d = new Date()
  // getMonth() counts from 0 (January is 0), hence the + 1.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// This month as YYYY-MM: the first 7 characters of today's date.
export const currentMonth = () => todayLocal().slice(0, 7)

// "2026-11-21" becomes "Nov 21, 2026" (en-CA wording).
export function formatDate(isoDate) {
  // Splits into numbers: [2026, 11, 21].
  const [y, m, d] = isoDate.split('-').map(Number)
  // new Date(y, m - 1, d) is local midnight; new Date("2026-11-21") would be UTC and could
  // show the previous day in Canada.
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, {
    // Day without a leading zero.
    day: 'numeric',
    // Short month name.
    month: 'short',
    // Four-digit year.
    year: 'numeric',
  })
}

// "2026-11" becomes "November 2026".
export function formatMonth(yearMonth) {
  // Splits into numbers: [2026, 11].
  const [y, m] = yearMonth.split('-').map(Number)
  // The first of that month, local time, printed with the full month name.
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}
