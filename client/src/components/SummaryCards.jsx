import { formatCents } from '../money.js'

export default function SummaryCards({ summary }) {
  const { income_cents = 0, expense_cents = 0, balance_cents = 0, by_category = [] } = summary ?? {}
  const expenses = by_category.filter((row) => row.type === 'expense')

  return (
    <section className="summary" aria-label="Totals">
      <div className="cards">
        <div className="card income">
          <span className="label">Income</span>
          <span className="value">{formatCents(income_cents)}</span>
        </div>
        <div className="card expense">
          <span className="label">Expenses</span>
          <span className="value">{formatCents(expense_cents)}</span>
        </div>
        <div className={`card balance ${balance_cents < 0 ? 'negative' : ''}`}>
          <span className="label">Balance</span>
          <span className="value">{formatCents(balance_cents)}</span>
        </div>
      </div>

      {expenses.length > 0 && (
        <ul className="breakdown">
          {expenses.map((row) => (
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
