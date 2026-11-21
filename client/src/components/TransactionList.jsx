import { useState } from 'react'
import { formatCents, formatDate } from '../money.js'

export default function TransactionList({ transactions, onDelete, deletingId }) {
  // Only one row asks "Delete?" at a time; clicking × on another row moves the question there.
  const [confirmingId, setConfirmingId] = useState(null)

  return (
    <ul className="list">
      {transactions.map((t) => {
        const label = `${t.category} ${formatCents(t.amount_cents)}`
        const confirming = confirmingId === t.id
        const deleting = deletingId === t.id

        return (
          <li key={t.id}>
            <div className="info">
              <span className="category">{t.category}</span>
              <span className="meta">
                {formatDate(t.date)}
                {t.note && ` · ${t.note}`}
              </span>
            </div>
            <span className={`amount ${t.type}`}>
              {t.type === 'expense' ? '−' : '+'}
              {formatCents(t.amount_cents)}
            </span>

            {confirming || deleting ? (
              <div className="confirm" role="group" aria-label={`Confirm delete ${label}`}>
                <span>Delete?</span>
                <button
                  type="button"
                  className="yes"
                  disabled={deleting}
                  onClick={() => {
                    setConfirmingId(null)
                    onDelete(t.id)
                  }}
                >
                  {deleting ? '…' : 'Yes'}
                </button>
                <button
                  type="button"
                  className="no"
                  disabled={deleting}
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
                onClick={() => setConfirmingId(t.id)}
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
