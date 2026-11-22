// The list of transactions, each with a delete button that asks before deleting.

// useState remembers which row is asking "Delete?".
import { useState } from 'react'
// Display helpers: cents as "$12.50", "2026-11-21" as "Nov 21, 2026".
import { formatCents, formatDate } from '../money.js'

// Props: transactions (the rows), onDelete (App's handleDelete) and deletingId (the row
// whose delete is in progress, or null).
export default function TransactionList({ transactions, onDelete, deletingId }) {
  // Only one row asks "Delete?" at a time; clicking × on another row moves the question there.
  const [confirmingId, setConfirmingId] = useState(null)

  // What the list draws.
  return (
    <ul className="list">
      {/* One <li> per transaction. */}
      {transactions.map((t) => {
        // "Food $97.30": names the row for screen readers, e.g. "Delete Food $97.30".
        const label = `${t.category} ${formatCents(t.amount_cents)}`
        // True when this row is showing the Yes / No question.
        const confirming = confirmingId === t.id
        // True while this row's delete request is on its way to the server.
        const deleting = deletingId === t.id

        return (
          // The database id is unique and stable, so it makes a good key.
          <li key={t.id}>
            {/* Left side: category on top, date and note underneath. */}
            <div className="info">
              <span className="category">{t.category}</span>
              <span className="meta">
                {formatDate(t.date)}
                {/* Adds " · Groceries" only when there is a note. */}
                {t.note && ` · ${t.note}`}
              </span>
            </div>
            {/* The amount; the class "expense" or "income" picks its colour in the CSS. */}
            <span className={`amount ${t.type}`}>
              {/* A real minus sign (−) for expenses, a plus for income. */}
              {t.type === 'expense' ? '−' : '+'}
              {formatCents(t.amount_cents)}
            </span>

            {/* Either the Yes / No question (also kept while deleting) or the × button. */}
            {confirming || deleting ? (
              // role="group" with a label tells screen readers which row the question is about.
              <div className="confirm" role="group" aria-label={`Confirm delete ${label}`}>
                <span>Delete?</span>
                <button
                  type="button"
                  className="yes"
                  // Disabled once the request is sent, so it cannot be sent twice.
                  disabled={deleting}
                  onClick={() => {
                    // Closes the question...
                    setConfirmingId(null)
                    // ...and asks App to delete the row.
                    onDelete(t.id)
                  }}
                >
                  {/* "…" while the server works. */}
                  {deleting ? '…' : 'Yes'}
                </button>
                <button
                  type="button"
                  className="no"
                  disabled={deleting}
                  // Closes the question and keeps the row.
                  onClick={() => setConfirmingId(null)}
                  // Focus lands on "No", so an accidental Enter keeps the row.
                  autoFocus
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="delete"
                // Opens the question on this row (and closes it on any other).
                onClick={() => setConfirmingId(t.id)}
                // The × alone means nothing to a screen reader, so it gets a full name.
                aria-label={`Delete ${label}`}
              >
                ×
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
