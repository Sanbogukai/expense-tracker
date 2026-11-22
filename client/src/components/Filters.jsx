// The category and month filters above the list.
// Props: categories (names for the dropdown), filters (the current values) and onChange
// (called with the new filters object; App stores it and refetches).
export default function Filters({ categories, filters, onChange }) {
  // Makes one change handler per field: set('month') returns a function for the month input.
  // It copies the current filters (...filters) and replaces only that one key with what was picked.
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value })

  // What the filters draw.
  return (
    <div className="filters">
      {/* Wrapping the control in its <label> links the two, so clicking the text focuses it. */}
      <label>
        Category
        {/* A controlled select: React sets its value from filters, and onChange reports picks. */}
        <select value={filters.category} onChange={set('category')}>
          {/* The empty value means "no category filter". */}
          <option value="">All categories</option>
          {/* One option per category; map turns each name into an <option>. */}
          {categories.map((c) => (
            // key lets React tell the options apart when the list changes.
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        Month
        {/* The browser's own month picker; its value is YYYY-MM, the format the API expects. */}
        <input type="month" value={filters.month} onChange={set('month')} />
      </label>

      {/* Shown only while a month is chosen: clears the month to show all time. */}
      {filters.month && (
        // Keeps the category, sets month to '' (no month filter).
        <button type="button" className="link" onClick={() => onChange({ ...filters, month: '' })}>
          All time
        </button>
      )}
    </div>
  )
}
