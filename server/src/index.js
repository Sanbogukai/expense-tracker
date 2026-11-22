// The server's entry point: builds the Express app, wires up the routes and starts listening.

// existsSync checks whether a file or folder is there, without throwing if it is not.
import { existsSync } from 'node:fs';
// Converts a file:// URL into a normal path.
import { fileURLToPath } from 'node:url';
// Express handles HTTP: routing, JSON parsing, static files.
import express from 'express';
// All /api routes, from routes.js.
import router from './routes.js';
// The sample rows and the helper that loads them into an empty table.
import { rows, seedIfEmpty } from './sampleData.js';

// Creates the app that every middleware and route below is attached to.
const app = express();
// Render (and other hosts) tell the app which port to use through PORT; 3000 is the local default.
// Number() turns the text "10000" into the number 10000; `||` falls back when it is missing.
const PORT = Number(process.env.PORT) || 3000;

// The built React app. It exists after `npm run build` in client/, which is how production runs;
// in development Vite serves the client instead and this folder may be missing.
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

// With SEED_IF_EMPTY=1 (set on Render), an empty table gets the sample data on start-up.
// seedIfEmpty() returns true only when it actually seeded, so the message is printed only then.
if (process.env.SEED_IF_EMPTY === '1' && seedIfEmpty()) {
  // Shows up in the Render log, as a sign the wiped disk was refilled.
  console.log(`Empty database: seeded ${rows.length} sample transactions.`);
}

// Middleware runs on every request, top to bottom, in the order it is added.

// Parses JSON request bodies into req.body. The 10kb cap refuses oversized bodies.
app.use(express.json({ limit: '10kb' }));
// Every route in routes.js now answers under /api, e.g. /api/transactions.
app.use('/api', router);

// Unknown API routes get JSON, not Express's HTML page.
// It only runs when no route above matched, because a matching route ends the request.
app.use('/api', (req, res) => {
  // 404 "not found", naming the method and path that had no route.
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// Only when the client has been built (production).
if (existsSync(CLIENT_DIST)) {
  // Serves index.html, the JS bundle and other files from client/dist as they are.
  app.use(express.static(CLIENT_DIST));
  // Any other GET is a page route of the single-page app, so it gets index.html.
  // '/{*splat}' is Express 5's "match everything" pattern (Express 4 used '*').
  app.get('/{*splat}', (req, res) => res.sendFile('index.html', { root: CLIENT_DIST }));
}

// Errors always come back as JSON. Bad JSON bodies arrive here with status 400.
// Express knows this is the error handler because it takes four arguments (err first).
// `next` is unused, but it must be listed for Express to see four arguments.
app.use((err, req, res, next) => {
  // Use the error's own status when it has one (e.g. 400 for bad JSON), otherwise 500.
  const status = err.status ?? err.statusCode ?? 500;
  // Server faults are logged for debugging; client mistakes (4xx) are not.
  if (status >= 500) console.error(err);
  // A 500 never shows its internal message to the visitor; a 4xx explains what was wrong.
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
});

// Starts the HTTP server on PORT; the callback runs once it is ready.
app.listen(PORT, () => {
  // Confirms the server is up and where.
  console.log(`Listening on http://localhost:${PORT}`);
});
