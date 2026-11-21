import express from 'express';
import router from './routes.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10kb' }));
app.use('/api', router);

// Unknown API routes get JSON, not Express's HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// Errors always come back as JSON. Bad JSON bodies arrive here with status 400.
app.use((err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
