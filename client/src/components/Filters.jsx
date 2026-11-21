export default function Filters({ categories, filters, onChange }) {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value })

  return (
    <div className="filters">
      <label>
        Category
        <select value={filters.category} onChange={set('category')}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        Month
        <input type="month" value={filters.month} onChange={set('month')} />
      </label>

      {filters.month && (
        <button type="button" className="link" onClick={() => onChange({ ...filters, month: '' })}>
          All time
        </button>
      )}
    </div>
  )
}
