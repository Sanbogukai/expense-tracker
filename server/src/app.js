// Builds the Express app without starting it. Tests import createApp() and hand the app to
// Supertest; index.js imports the same function and calls listen.

// Express handles HTTP: routing, JSON parsing, static files.
import express from 'express';
// Sets the security headers (Content-Security-Policy and friends) on every answer.
import helmet from 'helmet';
// The /api routes.
import { apiRouter } from './routes.js';

// The largest JSON body accepted. A transaction is a few short fields, so 10 kB is plenty and
// stops anyone posting megabytes at the API; a bigger body gets a 413.
const JSON_LIMIT = '10kb';

// HTTP status codes used here, by name.
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

// Render puts proxies in front of the app; trusting this many hops lets req.ip be the
// visitor's address (from X-Forwarded-For) instead of the proxy's, for the owner limit.
const TRUSTED_PROXIES = 3;

// Defaults: new owners per IP address per hour, and transactions per owner.
export const OWNER_LIMIT = 10;
export const MAX_TRANSACTIONS = 1000;

// Returns a new, fully wired app. Only options.db is required; tests swap the clock and lower
// the limits to reach them quickly. options.clientDir is the built client (client/dist);
// without it the app serves the API alone, as in development, where Vite serves the client.
export function createApp(options) {
  // Fills in the defaults; anything the caller passed wins.
  const deps = { now: () => new Date(), ownerLimit: OWNER_LIMIT, maxTransactions: MAX_TRANSACTIONS, ...options };

  // Creates the app that every middleware and route below is attached to.
  const app = express();

  // Reads the visitor's address through the hosting proxies.
  app.set('trust proxy', TRUSTED_PROXIES);

  // Security headers first, so every answer below carries them, API and pages alike. helmet's
  // default Content-Security-Policy lets scripts, styles, images and requests come only from
  // this site, so a script injected into the page could neither load nor send data anywhere.
  app.use(helmet());

  // Parses JSON request bodies into req.body, refusing anything over the limit with a 413.
  app.use(express.json({ limit: JSON_LIMIT }));

  // Every route in routes.js answers under /api, e.g. /api/transactions.
  app.use('/api', apiRouter(deps));

  // Unknown API routes get JSON, not Express's HTML page.
  // It only runs when no route above matched, because a matching route ends the request.
  app.use('/api', (req, res) => {
    // 404 "not found", naming the method and path that had no route.
    res.status(HTTP_NOT_FOUND).json({ error: `No route for ${req.method} ${req.originalUrl}` });
  });

  // Only when the client has been built (production).
  if (deps.clientDir) {
    // Serves index.html, the JS bundle and other files from client/dist as they are.
    app.use(express.static(deps.clientDir));
    // Any other GET is a page route of the single-page app, so it gets index.html.
    // '/{*splat}' is Express 5's "match everything" pattern (Express 4 used '*').
    app.get('/{*splat}', (_req, res) => res.sendFile('index.html', { root: deps.clientDir }));
  }

  // Errors always come back as JSON. Bad JSON bodies arrive here with status 400, oversized
  // ones with 413. Express knows this is the error handler because it takes four arguments;
  // `_next` is unused, but it must be listed for Express to see four.
  app.use((err, _req, res, _next) => {
    // Use the error's own status when it has one (e.g. 400 for bad JSON), otherwise 500.
    const status = err.status ?? err.statusCode ?? HTTP_SERVER_ERROR;
    // Server faults are logged for debugging; client mistakes (4xx) are not.
    if (status >= HTTP_SERVER_ERROR) console.error(err);
    // A 500 never shows its internal message to the visitor; a 4xx explains what was wrong.
    res.status(status).json({ error: status >= HTTP_SERVER_ERROR ? 'Something went wrong' : err.message });
  });

  // The caller decides whether to listen (index.js) or to test it (Supertest).
  return app;
}
