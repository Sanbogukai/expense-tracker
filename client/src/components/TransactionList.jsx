import { formatCents, formatDate } from '../money.js'

export default function TransactionList({ transactions, onDelete, deletingId }) {
  return (
    <ul className="list">
      {transactions.map((t) => (
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
          <button
            type="button"
            className="delete"
            onClick={() => onDelete(t.id)}
            disabled={deletingId === t.id}
            aria-label={`Delete ${t.category} ${formatCents(t.amount_cents)}`}
          >
            {deletingId === t.id ? '…' : '×'}
          </button>
        </li>
      ))}
    </ul>
  )
}
