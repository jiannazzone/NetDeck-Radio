# NetDeck Radio

A modern, open-source web UI for monitoring amateur radio nets via the [NetLogger](https://www.netlogger.org/) XML API.

NetDeck Radio provides a clean, responsive interface for browsing active and past nets, viewing check-in tables with color-coded station statuses, and tracking the currently working station — all from any browser on desktop or mobile. No web-based client for NetLogger existed before this project.

![License](https://img.shields.io/badge/license-GPL--3.0-blue)

## Features

- **Active net list** — Browse all currently running nets with frequency, mode, band, net control, and subscriber count
- **Check-in table** — View the full check-in roster for any active net with live updates via Server-Sent Events
- **Station pointer tracking** — The currently working station is highlighted in real time
- **Status color coding** — Rows are color-coded by station role: Net Control, Logger, Relayed, VIP, Not Heard, Short Time, No Response, and Checked Out
- **Status color legend** — An inline key below each check-in table explains what each color means
- **Past nets browser** — Search and browse nets from the last 1, 3, or 7 days, and view their archived check-in lists
- **Font size toggle** — Cycle between default, large, and compact text sizes; your preference is saved to localStorage
- **Responsive layout** — Works on desktop and mobile; tables scroll horizontally on small screens with sticky callsign columns
- **Auto-refresh** — Data refreshes at API-compliant intervals with a live/reconnecting indicator and freshness badge
- **Net search** — Filter active or past nets by name with debounced search

## Architecture

```
NetLogger XML API ──XML──▶ Backend Proxy ──SSE/JSON──▶ Browser
                          (Node/Express)               (Vanilla JS)
```

The backend proxy is required for two reasons:

1. **CORS** — Browsers cannot call the NetLogger API directly due to cross-origin restrictions
2. **Rate limit compliance** — The API has strict per-endpoint rate limits. The proxy polls at recommended intervals and serves cached data to any number of connected clients

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, fast-xml-parser |
| Frontend | Vanilla JavaScript, Vite |
| Real-time | Server-Sent Events (SSE) with reference-counted polling |
| Deployment | Docker, Fly.io |

### Project Structure

```
netdeck-radio/
├── server/
│   └── src/
│       ├── index.js              # Express server entry point
│       ├── config.js             # Polling intervals, cache TTLs, rate limits
│       ├── routes/
│       │   ├── api.js            # REST endpoints (/api/nets, /api/checkins, etc.)
│       │   └── sse.js            # SSE subscription endpoint (/api/events)
│       ├── services/
│       │   ├── netlogger-client.js  # HTTP client for NetLogger XML API
│       │   ├── xml-parser.js     # XML → JSON with status parsing
│       │   ├── poller.js         # EventEmitter-based, reference-counted watchers
│       │   └── cache.js          # In-memory cache with TTL
│       └── utils/
│           ├── rate-limiter.js   # Per-endpoint rate limiting
│           └── status-parser.js  # Parses NetLogger status codes
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.js               # SPA router entry point
│       ├── router.js             # Hash-based client-side router
│       ├── api.js                # REST API client
│       ├── sse.js                # SSE client with reconnection state
│       ├── styles/
│       │   └── main.css          # All styles (Signal Deck dark theme)
│       ├── utils/
│       │   ├── dom.js            # Lightweight DOM element helper
│       │   ├── formatters.js     # Date, time, and duration formatting
│       │   └── status-colors.js  # Status class mapping and color legend
│       └── views/
│           ├── net-list.js       # Active nets grid view
│           ├── net-detail.js     # Check-in table for an active net
│           └── past-nets.js      # Past nets list and detail views
├── Dockerfile
├── fly.toml
└── package.json                  # Workspace root (monorepo)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- npm (included with Node.js)

### Install Dependencies

```bash
npm install
```

This installs dependencies for both the server and client workspaces.

### Development

Run the backend and frontend dev servers concurrently:

```bash
npm run dev
```

This starts:
- **Backend** on `http://localhost:3000` (with `--watch` for auto-reload)
- **Vite dev server** on `http://localhost:5173` (proxies API requests to the backend)

### Production Build

```bash
npm run build    # Build the Vite frontend
npm start        # Start the Express server (serves static files from client/dist)
```

### Docker

```bash
docker build -t netdeck-radio .
docker run -p 8080:8080 netdeck-radio
```

### Deploy to Fly.io

```bash
fly deploy
```

The included `fly.toml` configures a minimal instance in the `ewr` region with auto-stop/start and a health check at `/api/health`.

## API Compliance

NetDeck Radio respects all [NetLogger API](https://www.netlogger.org/) rate limits:

| Endpoint | Rate Limit | Polling Interval |
|----------|-----------|-----------------|
| GetActiveNets | 1/min | 60s |
| GetCheckins | 3/min | 20s (per watched net) |
| GetPastNets | 1/min | On-demand with 2min cache |
| GetPastNetCheckins | 10/min | On-demand with 5min cache |

The proxy caches responses and only polls GetCheckins for nets that clients are actively viewing (reference-counted). Stale cached data is served between polls.

## Built With Claude

This project is being developed with [Claude](https://claude.ai/) as a coding partner, using [Claude Code](https://docs.anthropic.com/en/docs/claude-code) for implementation, debugging, and code review.

## Naming

This project is named **NetDeck Radio** to avoid trademark conflicts. "NetLogger" is a registered trademark of NetLogger.org and is used here only in a descriptive capacity to refer to the service this application connects to.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
