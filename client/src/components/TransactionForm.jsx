import { useState } from 'react'
import { todayLocal, toCents } from '../money.js'

const emptyForm = () => ({
  type: 'expense',
  amount: '',
  category: '',
  date: todayLocal(),
  note: '',
})

export default function TransactionForm({ categories, onAdd }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const amount_cents = toCents(form.amount)
    const localErrors = {}
    if (amount_cents === null) localErrors.amount_cents = 'Enter an amount above 0, up to two decimals'
    if (!form.category) localErrors.category = 'Pick a category'
    setErrors(localErrors)
    if (Object.keys(localErrors).length) return

    setSaving(true)
    try {
      await onAdd({
        type: form.type,
        amount_cents,
        category: form.category,
        date: form.date,
        note: form.note.trim() || undefined,
      })
      // Keep type and date: entering several of the same kind in a row is common.
      setForm({ ...emptyForm(), type: form.type, date: form.date })
    } catch (error) {
      const issues = error.issues ?? []
      setErrors(Object.fromEntries(issues.map((i) => [i.field, i.message])))
      if (!issues.length) setFormError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel form" onSubmit={handleSubmit} noValidate>
      <h2>Add transaction</h2>

      <div className="type-toggle" role="radiogroup" aria-label="Type">
        {['expense', 'income'].map((type) => (
          <label key={type} className={form.type === type ? `on ${type}` : ''}>
            <input
              type="radio"
              name="type"
              value={type}
              checked={form.type === type}
              onChange={set('type')}
            />
            {type === 'expense' ? 'Expense' : 'Income'}
          </label>
        ))}
      </div>

      <label>
        Amount
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={form.amount}
          onChange={set('amount')}
          aria-invalid={Boolean(errors.amount_cents)}
        />
        {errors.amount_cents && <span className="field-error">{errors.amount_cents}</span>}
      </label>

      <label>
        Category
        <select value={form.category} onChange={set('category')} aria-invalid={Boolean(errors.category)}>
          <option value="">Choose…</option>
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
        <input type="date" value={form.date} onChange={set('date')} aria-invalid={Boolean(errors.date)} />
        {errors.date && <span className="field-error">{errors.date}</span>}
      </label>

      <label>
        Note <span className="optional">(optional)</span>
        <input value={form.note} onChange={set('note')} maxLength={200} />
        {errors.note && <span className="field-error">{errors.note}</span>}
      </label>

      {formError && <p className="form-error">{formError}</p>}

      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Add'}
      </button>
    </form>
  )
}
