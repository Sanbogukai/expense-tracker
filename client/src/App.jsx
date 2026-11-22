// The top-level component: owns all the app's data and passes it down to the pieces.

// useState keeps a value between renders; useEffect runs code after a render (here, fetching).
import { useEffect, useState } from 'react'
// Every server call, as functions: api.getTransactions(...), api.createTransaction(...), ...
import * as api from './api.js'
// Date helpers: this month as YYYY-MM, and "2026-11" as "November 2026".
import { currentMonth, formatMonth } from './money.js'
// The category and month filters.
import Filters from './components/Filters.jsx'
// Income, expense and balance cards plus the breakdown.
import SummaryCards from './components/SummaryCards.jsx'
// The "Add transaction" form.
import TransactionForm from './components/TransactionForm.jsx'
// The list of rows with delete buttons.
import TransactionList from './components/TransactionList.jsx'

// Says what is empty for the current filters, and how to fill it.
// Props: filters (the active category and month) and onClear (resets both).
function EmptyState({ filters, onClear }) {
  // "Food transactions" when a category is chosen, plain "transactions" otherwise.
  const what = filters.category ? `${filters.category} transactions` : 'transactions'
  // " in November 2026" when a month is chosen, nothing for all time.
  const when = filters.month ? ` in ${formatMonth(filters.month)}` : ''
  // True when any filter is active; Boolean() turns '' or 'Food' into false or true.
  const filtered = Boolean(filters.category || filters.month)

  // JSX: HTML-like markup that compiles to React calls. className is HTML's class.
  return (
    <div className="empty">
      {/* "No Food transactions in November 2026." or, with no filters, "No transactions yet." */}
      <p className="empty-title">
        No {what}
        {when}
        {filtered ? '.' : ' yet.'}
      </p>
      {/* The hint under the title. */}
      <p className="muted">
        Add one with the form
        {/* With filters active, offer a link that clears them; otherwise just end the sentence. */}
        {filtered ? (
          // <>...</> is a fragment: groups several pieces without adding an element to the page.
          <>
            , or{' '}
            {/* A button styled as a link, since it runs code rather than going to a URL. */}
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

// The whole app. React calls this again (re-renders) whenever one of its states changes.
export default function App() {
  // Category names for the dropdowns, loaded once from the server.
  const [categories, setCategories] = useState([])
  // The active filters; the page opens on the current month with all categories.
  const [filters, setFilters] = useState({ category: '', month: currentMonth() })
  // The rows shown in the list.
  const [transactions, setTransactions] = useState([])
  // The totals; null until the first response arrives.
  const [summary, setSummary] = useState(null)
  // True until the first load finishes, to show "Loading…".
  const [loading, setLoading] = useState(true)
  // A message to show when a request fails; '' means no error.
  const [error, setError] = useState('')
  // The id of the row being deleted right now, so its buttons can be disabled.
  const [deletingId, setDeletingId] = useState(null)

  // Loads the categories once. The empty [] means "run after the first render only".
  useEffect(() => {
    // On success, store the list; on failure, show the error.
    api.getCategories().then(setCategories).catch((e) => setError(e.message))
  }, [])

  // Bumping this number refetches after an add or delete.
  const [reloadKey, setReloadKey] = useState(0)
  // Adds 1 to reloadKey. The (k) => k + 1 form always starts from the latest value.
  const reload = () => setReloadKey((k) => k + 1)

  // List and summary are fetched together so the totals always match what is on screen.
  // `ignore` drops a slow, outdated response when the filters change again before it arrives.
  useEffect(() => {
    // Belongs to this one run of the effect; the cleanup below flips it to true.
    let ignore = false
    // Starts both requests at once and waits for both.
    Promise.all([api.getTransactions(filters), api.getSummary(filters)])
      // Both succeeded: unpack the two results in the order they were requested.
      .then(([list, totals]) => {
        // A newer run has started since this one, so this data is stale: throw it away.
        if (ignore) return
        // Shows the new rows.
        setTransactions(list)
        // Shows the new totals.
        setSummary(totals)
        // Clears any earlier error now that loading worked.
        setError('')
      })
      // Either request failed.
      .catch((e) => {
        // Show the error only if this run is still the current one.
        if (!ignore) setError(e.message)
      })
      // Runs after success or failure.
      .finally(() => {
        // The first load is over either way.
        if (!ignore) setLoading(false)
      })
    // The cleanup: React calls it before running the effect again, or when the app unmounts.
    return () => {
      // Marks this run as outdated, so its late response is ignored.
      ignore = true
    }
    // Runs again whenever the filters change or reload() bumps reloadKey.
  }, [filters, reloadKey])

  // Called by the form. async lets it wait for the server before reloading.
  async function handleAdd(data) {
    await api.createTransaction(data) // a failure is thrown back to the form, which shows it
    // Saved: fetch the list and totals again so the new row appears.
    reload()
  }

  // Called by the list after the user confirms a delete.
  async function handleDelete(id) {
    // Marks this row as busy, so its buttons are disabled and show "…".
    setDeletingId(id)
    try {
      // Asks the server to delete it.
      await api.deleteTransaction(id)
      // Deleted: refresh the list and totals.
      reload()
    } catch (e) {
      // Failed (e.g. the row was already gone): show why.
      setError(e.message)
    } finally {
      // Success or failure, the row is no longer busy.
      setDeletingId(null)
    }
  }

  // What the app draws.
  return (
    <div className="app">
      {/* The page title. */}
      <header>
        <h1>Expense Tracker</h1>
      </header>

      {/* Two columns on desktop (form, results); one column on a phone. */}
      <main>
        {/* The form gets the categories to choose from and the function to call on submit. */}
        <TransactionForm categories={categories} onAdd={handleAdd} />

        {/* On a phone this panel's children are re-ordered as page sections (see index.css). */}
        <section className="panel results">
          {/* Changing a filter calls setFilters, which re-runs the loading effect above. */}
          <Filters categories={categories} filters={filters} onChange={setFilters} />
          {/* `a && b` renders b only when a is truthy: the message shows only when there is one. */}
          {error && (
            // role="alert" makes screen readers announce the error as soon as it appears.
            <p className="form-error" role="alert">
              {error}{' '}
              {/* Tries the same requests again. */}
              <button type="button" className="link" onClick={reload}>
                Retry
              </button>
            </p>
          )}
          {/* The totals cards. */}
          <SummaryCards summary={summary} />
          {/* The list area: one of three things, picked by the nested ? : below. */}
          <div className="results-list">
            {/* 1. Still on the first load with nothing to show yet: "Loading…". */}
            {loading && !transactions.length ? (
              <p className="muted">Loading…</p>
            ) : transactions.length ? (
              // 2. There are rows: show them.
              <TransactionList transactions={transactions} onDelete={handleDelete} deletingId={deletingId} />
            ) : (
              // 3. No rows: the empty state, unless an error is already explaining why.
              !error && (
                // "Clear the filters" sets both filters to '' (all categories, all time).
                <EmptyState filters={filters} onClear={() => setFilters({ category: '', month: '' })} />
              )
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
