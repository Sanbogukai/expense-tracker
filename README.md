# Expense Tracker

Log income and expenses by category, see totals for a month or all time, and delete entries. Amounts are in Canadian dollars.

**Live:** https://expense-tracker-07et.onrender.com/

> Runs on Render's free tier. After about 15 minutes without visitors it goes to sleep, so the first visit can take up to a minute. Its disk is wiped on every restart, so anything you add disappears and the sample data loads again.

<p>
  <img src="docs/desktop.png" alt="Desktop view: add form on the left, November totals and the transaction list on the right" width="640">
  <img src="docs/phone.png" alt="Phone view: totals, then the add form, filters and list in one column" width="200">
</p>

Project 1 of a full-stack practice series.

## Features

- Add an income or expense with an amount, category, date and optional note.
- Filter by category and month, or view all time.
- Income, expense and balance totals, with an expense breakdown by category.
- Delete with an inline "Delete? Yes / No" confirm.
- Empty states that name the active filters.
- Works on a phone: totals, form, filters, then the list.
- Light and dark themes follow the system setting.

## Stack

| Part | Tools |
| ---- | ----- |
| Client | React 19, Vite, oxlint |
| Server | Node, Express 5, Zod 4 |
| Database | SQLite through `better-sqlite3`, plain parameterized SQL |
| Hosting | Render free web service; Express serves the built client |

Money is stored as integer cents, so totals never pick up floating-point errors.

## API

| Method | Route | Does |
| ------ | ----- | ---- |
| `GET` | `/api/categories` | The category list |
| `GET` | `/api/transactions?category=&month=YYYY-MM` | Transactions, newest first, both filters optional |
| `POST` | `/api/transactions` | Add one; returns `201`, or `400` with the fields that failed |
| `DELETE` | `/api/transactions/:id` | Delete one; `204`, or `404` if it does not exist |
| `GET` | `/api/summary?month=YYYY-MM` | Income, expense and balance totals, plus per-category totals |

## Run it locally

Needs Node 22 or later (the repo pins 26 in `.node-version`).

```bash
git clone https://github.com/Sanbogukai/expense-tracker.git
cd expense-tracker
cd server && npm install && npm run seed && cd ..
cd client && npm install && cd ..
```

Then in two terminals:

```bash
cd server && npm run dev    # API on http://localhost:3000
```

```bash
cd client && npm run dev    # app on http://localhost:5173
```

`npm run seed` empties the table and loads 22 sample transactions from September to November 2026. The database file is `server/expenses.db`; set `DB_PATH` to use another file.

### Production build

```bash
cd client && npm run build && cd ../server && npm start
```

Express then serves the app and the API together on `PORT` (default 3000). Set `SEED_IF_EMPTY=1` to load the sample data when the table is empty, as the Render service does.
