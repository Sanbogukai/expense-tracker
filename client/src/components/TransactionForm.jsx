// The "Add transaction" form on the left (top on a phone).

// useState keeps the typed values between renders.
import { useState } from 'react'
// todayLocal() fills the date; toCents() turns "12.50" into 1250 or null when invalid.
import { todayLocal, toCents } from '../money.js'

// A fresh, blank form. A function rather than an object, so the date is today's date at the
// moment it is called, not the date the page first loaded.
const emptyForm = () => ({
  // New entries start as expenses, the more common kind.
  type: 'expense',
  // The amount as typed text; converted to cents only on submit.
  amount: '',
  // '' shows "Choose…" until one is picked.
  category: '',
  // Today, local time, as YYYY-MM-DD.
  date: todayLocal(),
  // Optional, so it starts empty.
  note: '',
})

// Props: categories (the dropdown names) and onAdd (App's handleAdd, which saves and reloads).
export default function TransactionForm({ categories, onAdd }) {
  // Every field's current value. Passing emptyForm (not emptyForm()) runs it once, on first render.
  const [form, setForm] = useState(emptyForm)
  // True while waiting for the server, to disable the button and show "Saving…".
  const [saving, setSaving] = useState(false)
  // Messages per field, keyed by the API's field names: { amount_cents: '...', category: '...' }.
  const [errors, setErrors] = useState({})
  // A message for the whole form, for failures not tied to one field (e.g. server down).
  const [formError, setFormError] = useState('')

  // Makes one change handler per field: copies the form and replaces only that key.
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  // Runs when the form is submitted (the Add button or Enter in a field).
  async function handleSubmit(event) {
    // Stops the browser's default submit, which would reload the page.
    event.preventDefault()
    // Clears the previous whole-form message.
    setFormError('')

    // Converts the typed amount; null means it is not a valid positive amount.
    const amount_cents = toCents(form.amount)
    // Checks done here first, so simple mistakes are shown without a round trip to the server.
    const localErrors = {}
    // Same key the server uses (amount_cents), so both kinds of error show in the same place.
    if (amount_cents === null) localErrors.amount_cents = 'Enter an amount above 0, up to two decimals'
    // No category chosen yet.
    if (!form.category) localErrors.category = 'Pick a category'
    // Shows the new messages, or clears old ones when there are none.
    setErrors(localErrors)
    // Any problem: stop here and do not send.
    if (Object.keys(localErrors).length) return

    // Locks the button while the request is in flight, so a double click cannot add twice.
    setSaving(true)
    try {
      // Sends the data in the shape the API expects; await waits for the save and reload.
      await onAdd({
        type: form.type,
        amount_cents,
        category: form.category,
        date: form.date,
        // A blank or spaces-only note becomes undefined, so it is left out and saved as null.
        note: form.note.trim() || undefined,
      })
      // Keep type and date: entering several of the same kind in a row is common.
      setForm({ ...emptyForm(), type: form.type, date: form.date })
    } catch (error) {
      // The server's per-field problems, attached by api.js; empty when there are none.
      const issues = error.issues ?? []
      // Turns [{ field, message }, ...] into { field: message, ... } to show under each input.
      setErrors(Object.fromEntries(issues.map((i) => [i.field, i.message])))
      // No field-level detail: show the general message instead.
      if (!issues.length) setFormError(error.message)
    } finally {
      // Success or failure, the button is usable again.
      setSaving(false)
    }
  }

  // What the form draws.
  return (
    // noValidate turns off the browser's own pop-up checks, so the app's messages are used.
    <form className="panel form" onSubmit={handleSubmit} noValidate>
      <h2>Add transaction</h2>

      {/* Expense / Income as two radio buttons styled as a toggle. role and aria-label let
          screen readers announce it as one group called "Type". */}
      <div className="type-toggle" role="radiogroup" aria-label="Type">
        {/* One label per type, built from the list. */}
        {['expense', 'income'].map((type) => (
          // The chosen one gets the classes "on expense" or "on income", which colour it.
          <label key={type} className={form.type === type ? `on ${type}` : ''}>
            {/* The real radio input; the CSS hides it and styles the label instead. */}
            <input
              type="radio"
              // The same name groups the two, so picking one un-picks the other.
              name="type"
              value={type}
              // Checked when it matches the form's type.
              checked={form.type === type}
              onChange={set('type')}
            />
            {/* The visible text. */}
            {type === 'expense' ? 'Expense' : 'Income'}
          </label>
        ))}
      </div>

      <label>
        Amount
        <input
          // Asks phones for a number keypad with a decimal point.
          inputMode="decimal"
          // Grey hint text shown while the field is empty.
          placeholder="0.00"
          value={form.amount}
          onChange={set('amount')}
          // Tells screen readers (and the CSS) that this field has a problem.
          aria-invalid={Boolean(errors.amount_cents)}
        />
        {/* The amount's message, only when there is one. */}
        {errors.amount_cents && <span className="field-error">{errors.amount_cents}</span>}
      </label>

      <label>
        Category
        <select value={form.category} onChange={set('category')} aria-invalid={Boolean(errors.category)}>
          {/* The placeholder choice; its empty value fails the "Pick a category" check. */}
          <option value="">Choose…</option>
          {/* One option per category from the server. */}
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errors.category && <span className="field-error">{errors.category}</span>}
      </label>

      <label>
        Date
        {/* The browser's date picker; its value is YYYY-MM-DD. */}
        <input type="date" value={form.date} onChange={set('date')} aria-invalid={Boolean(errors.date)} />
        {/* Only the server checks dates, so this message can only come back from the API. */}
        {errors.date && <span className="field-error">{errors.date}</span>}
      </label>

      <label>
        Note <span className="optional">(optional)</span>
        {/* maxLength stops typing at 200 characters, the same limit the server enforces. */}
        <input value={form.note} onChange={set('note')} maxLength={200} />
        {errors.note && <span className="field-error">{errors.note}</span>}
      </label>

      {/* The whole-form message, only when there is one. */}
      {formError && <p className="form-error">{formError}</p>}

      {/* Disabled while saving; its text changes so the wait is visible. */}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Add'}
      </button>
    </form>
  )
}
