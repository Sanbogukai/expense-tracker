import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import router from './routes.js';
import { rows, seedIfEmpty } from './sampleData.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// The built React app. It exists after `npm run build` in client/, which is how production runs;
// in development Vite serves the client instead and this folder may be missing.
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

if (process.env.SEED_IF_EMPTY === '1' && seedIfEmpty()) {
  console.log(`Empty database: seeded ${rows.length} sample transactions.`);
}

app.use(express.json({ limit: '10kb' }));
app.use('/api', router);

// Unknown API routes get JSON, not Express's HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // Any other GET is a page route of the single-page app, so it gets index.html.
  app.get('/{*splat}', (req, res) => res.sendFile('index.html', { root: CLIENT_DIST }));
}

// Errors always come back as JSON. Bad JSON bodies arrive here with status 400.
app.use((err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
});

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
