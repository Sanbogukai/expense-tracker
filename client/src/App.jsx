import { useEffect, useState } from 'react'
import * as api from './api.js'
import { currentMonth, formatMonth } from './money.js'
import Filters from './components/Filters.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import TransactionForm from './components/TransactionForm.jsx'
import TransactionList from './components/TransactionList.jsx'

// Says what is empty for the current filters, and how to fill it.
function EmptyState({ filters, onClear }) {
  const what = filters.category ? `${filters.category} transactions` : 'transactions'
  const when = filters.month ? ` in ${formatMonth(filters.month)}` : ''
  const filtered = Boolean(filters.category || filters.month)

  return (
    <div className="empty">
      <p className="empty-title">
        No {what}
        {when}
        {filtered ? '.' : ' yet.'}
      </p>
      <p className="muted">
        Add one with the form
        {filtered ? (
          <>
            , or{' '}
            <button type="button" className="link" onClick={onClear}>
              clear the filters
            </button>
            .
          </>
        ) : (
          '.'
        )}
      </p>
    </div>
  )
}

export default function App() {
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ category: '', month: currentMonth() })
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    api.getCategories().then(setCategories).catch((e) => setError(e.message))
  }, [])

  // Bumping this number refetches after an add or delete.
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  // List and summary are fetched together so the totals always match what is on screen.
  // `ignore` drops a slow, outdated response when the filters change again before it arrives.
  useEffect(() => {
    let ignore = false
    Promise.all([api.getTransactions(filters), api.getSummary(filters)])
      .then(([list, totals]) => {
        if (ignore) return
        setTransactions(list)
        setSummary(totals)
        setError('')
      })
      .catch((e) => {
        if (!ignore) setError(e.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [filters, reloadKey])

  async function handleAdd(data) {
    await api.createTransaction(data) // a failure is thrown back to the form, which shows it
    reload()
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await api.deleteTransaction(id)
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Expense Tracker</h1>
      </header>

      <main>
        <TransactionForm categories={categories} onAdd={handleAdd} />

        {/* On a phone this panel's children are re-ordered as page sections (see index.css). */}
        <section className="panel results">
          <Filters categories={categories} filters={filters} onChange={setFilters} />
          {error && (
            <p className="form-error" role="alert">
              {error}{' '}
              <button type="button" className="link" onClick={reload}>
                Retry
              </button>
            </p>
          )}
          <SummaryCards summary={summary} />
          <div className="results-list">
            {loading && !transactions.length ? (
              <p className="muted">Loading…</p>
            ) : transactions.length ? (
              <TransactionList transactions={transactions} onDelete={handleDelete} deletingId={deletingId} />
            ) : (
              !error && (
                <EmptyState filters={filters} onClear={() => setFilters({ category: '', month: '' })} />
              )
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
