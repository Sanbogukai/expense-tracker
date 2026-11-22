// Turns integer cents into "$1,234.50" for display.
import { formatCents } from '../money.js'

// The income, expense and balance cards, plus spending per category.
// Props: summary, the object from GET /api/summary, or null before it loads.
export default function SummaryCards({ summary }) {
  // Unpacks the fields. `?? {}` uses an empty object while summary is still null, and the
  // `= 0` / `= []` defaults fill in, so the cards show $0.00 instead of crashing.
  const { income_cents = 0, expense_cents = 0, balance_cents = 0, by_category = [] } = summary ?? {}
  // The breakdown shows spending only, so income rows (Salary) are left out.
  const expenses = by_category.filter((row) => row.type === 'expense')

  // What the cards draw.
  return (
    // aria-label gives screen readers a name for this region.
    <section className="summary" aria-label="Totals">
      {/* The three cards, side by side. */}
      <div className="cards">
        {/* Total income for the chosen month (or all time). */}
        <div className="card income">
          <span className="label">Income</span>
          <span className="value">{formatCents(income_cents)}</span>
        </div>
        {/* Total expenses. */}
        <div className="card expense">
          <span className="label">Expenses</span>
          <span className="value">{formatCents(expense_cents)}</span>
        </div>
        {/* Income minus expenses; the extra "negative" class colours it red when below zero. */}
        <div className={`card balance ${balance_cents < 0 ? 'negative' : ''}`}>
          <span className="label">Balance</span>
          <span className="value">{formatCents(balance_cents)}</span>
        </div>
      </div>

      {/* The per-category list, only when there is at least one expense. */}
      {expenses.length > 0 && (
        <ul className="breakdown">
          {/* One row per category: its name on the left, its total on the right. */}
          {expenses.map((row) => (
            // Category names are unique within the expense rows, so they work as keys.
            <li key={row.category}>
              <span>{row.category}</span>
              <span>{formatCents(row.total_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
