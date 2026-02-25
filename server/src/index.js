import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PORT, NODE_ENV } from './config.js';
import { apiRouter } from './routes/api.js';
import { sseRouter } from './routes/sse.js';
import { poller } from './services/poller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

if (NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'public')));
}

app.use('/api', apiRouter);
app.use('/api/events', sseRouter);

if (NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, _next) => {
  console.error(`[Server] Unhandled error on ${req.method} ${req.url}:`, err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

poller.start();

app.listen(PORT, () => {
  const host = NODE_ENV === 'development' ? `http://localhost:${PORT}` : `port ${PORT}`;
  console.log(`NetDeck Radio server listening on ${host} (${NODE_ENV})`);
});
