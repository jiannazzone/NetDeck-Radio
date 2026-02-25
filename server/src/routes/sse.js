import { Router } from 'express';
import { poller } from '../services/poller.js';
import { cache } from '../services/cache.js';
import { SSE_HEARTBEAT_INTERVAL } from '../config.js';

export const sseRouter = Router();

sseRouter.get('/', (req, res) => {
  const subscribe = req.query.subscribe;
  const serverName = req.query.serverName;
  const netName = req.query.netName;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Send initial cached data immediately
  if (subscribe === 'nets') {
    const cached = cache.get('active-nets');
    if (cached) send('nets', cached);
  } else if (subscribe === 'checkins' && serverName && netName) {
    const cached = cache.get(`checkins:${serverName}:${netName}`);
    if (cached) send('checkins', cached);
  }

  // Subscribe to live updates
  const onNets = (data) => send('nets', data);
  const onCheckins = (data) => send('checkins', data);

  if (subscribe === 'nets') {
    poller.on('nets', onNets);
  }

  if (subscribe === 'checkins' && serverName && netName) {
    const eventKey = `checkins:${serverName}:${netName}`;
    poller.on(eventKey, onCheckins);
    poller.addWatcher(serverName, netName);
  }

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    send('heartbeat', { time: new Date().toISOString() });
  }, SSE_HEARTBEAT_INTERVAL);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);

    if (subscribe === 'nets') {
      poller.removeListener('nets', onNets);
    }

    if (subscribe === 'checkins' && serverName && netName) {
      const eventKey = `checkins:${serverName}:${netName}`;
      poller.removeListener(eventKey, onCheckins);
      poller.removeWatcher(serverName, netName);
    }
  });
});
