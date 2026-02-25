# NetDeck Radio

A modern, open-source web UI for monitoring amateur radio nets via the NetLogger XML API.

## Project Overview

NetDeck Radio is a responsive web application that provides a clean, modern interface for browsing and monitoring amateur radio nets hosted on the NetLogger system. The existing NetLogger desktop client is dated and doesn't work well across Linux distributions. This project aims to provide a universal web-based alternative that works across desktop and mobile browsers.

**Repository name:** `netdeck-radio`
**License:** Open source (TBD)

## NetLogger XML API Reference

Base URL: `https://www.netlogger.org/api/`
Protocol: HTTPS (mandatory as of API v1.3)
Format: XML responses over HTTP GET requests
Current API Version: 1.3 (December 1, 2023)
Author: K0JDD

### Documented Endpoints

#### 1. GetActiveNets.php
- **URL:** `https://www.netlogger.org/api/GetActiveNets.php`
- **Optional params:** `&NetNameLike=string` (URL-encoded, filters net names containing the string)
- **Returns:** `<ServerList>` node containing `<Server>` nodes, each with `<ServerName>` and zero or more `<Net>` children
- **Net fields:** `<NetName>`, `<AltNetName>`, `<Frequency>`, `<Logger>`, `<NetControl>`, `<Date>`, `<Mode>`, `<Band>`, `<SubscriberCount>`
- **Rate limit:** 1 call/minute

#### 2. GetCheckins.php
- **URL:** `https://www.netlogger.org/api/GetCheckins.php?ServerName=xxxxx&NetName=yyyy`
- **Params:** `ServerName` and `NetName` (case sensitive, values obtained from GetActiveNets)
- **Returns:** `<CheckinList>` node with `<CheckinCount>`, `<Pointer>` (SerialNo of currently working station), and zero or more `<Checkin>` children
- **Checkin fields:** `<SerialNo>`, `<Callsign>`, `<State>`, `<Remarks>`, `<QSLInfo>`, `<CityCountry>`, `<FirstName>`, `<Status>`, `<County>`, `<Grid>`, `<Street>`, `<Zip>`, `<MemberID>`, `<Country>`, `<DXCC>`, `<PreferredName>`
- **Rate limit:** 3 calls/minute

#### 3. GetPastNets.php
- **URL:** `https://www.netlogger.org/api/GetPastNets.php?Interval=nn`
- **Optional params:** `Interval` (number of days, default 7), `&NetNameLike=string`
- **Returns:** `<ServerList>` node (same structure as GetActiveNets but with additional fields)
- **Additional past net fields:** `<NetID>`, `<AIM>` (Y/N), `<UpdateInterval>`, `<srcIP>`, `<LastActivity>`, `<InactivityTimer>`, `<MiscNetParameters>`, `<ClosedAt>`, `<Assassinated>` (Y/N)
- **Rate limit:** 1 call/minute
- **Note:** Combine `Interval` with `NetNameLike` for intervals beyond 7 days to avoid memory exhaustion errors

#### 4. GetPastNetCheckins.php
- **URL:** `https://www.netlogger.org/api/GetPastNetCheckins.php?ServerName=xxxxx&NetName=yyyy&NetID=zzzz`
- **Params:** `ServerName`, `NetName`, `NetID` (all from GetPastNets response)
- **Returns:** `<CheckinList>` node (same structure as GetCheckins)
- **Rate limit:** 10 calls/minute

### XML Response Structure

All responses are wrapped in a `<NetLoggerXML>` top-level element containing:

- **`<Header>`** — Always present. Contains `<CreationDateUTC>`, `<Copyright>`, `<APIVersion>`, `<TimeZone>` (always UTC). May contain `<Warning>` tags for developer notices.
- **`<Error>`** — Present on invalid requests. Accompanied by `<ResponseCode>`.
- **`<ServerList>`** — Response to GetActiveNets/GetPastNets.
- **`<CheckinList>`** — Response to GetCheckins/GetPastNetCheckins.

### Response Codes

| Code | Meaning | Notes |
|------|---------|-------|
| 200  | OK | |
| 400  | Bad Request | Missing or invalid parameters |
| 401  | Unauthorized | Requires missing permissions |
| 403  | Forbidden | Method not allowed |
| 404  | Not Found | Resource or data not found / empty result |
| 429  | Too Many Requests | Anti-flooding triggered |
| 500  | Database Error | |

### Undocumented Endpoints (Appendix A & B — not publicly available)

The API response code table references three additional response types that are NOT documented in the public spec:

- **`<MonitorList>`** (Appendix A) — Likely returns who is monitoring a net
- **`<AIMTranscript>`** (Appendix A) — AIM (Almost Instant Messages) chat history
- **`<Session>`** (Appendix B) — Session/authentication management

These endpoints are used by third-party apps like NetLogger Companion (by Andrew Pearson / Group427) which supports AIM send/receive. The appendices were never included in the public PDF. Reverse engineering these endpoints via traffic capture of the desktop client or NetLogger Companion is possible but not yet done.

### Critical API Design Notes

- The API may be extended at any time with new XML nodes/attributes
- Client code MUST ignore unknown nodes/attributes without raising errors
- Make no assumptions about node count, order, or presence of undefined attributes
- All date/time values are in UTC
- The `<Status>` field is complex and used as a catchall for various flags (e.g., "(nc)" for net control). Some flags control UI behavior (like station highlighting) and are not meant for literal display. This is not fully documented — see the NetLogger client help files
- The desktop NetLogger.exe client does NOT use the XML API internally; it uses a separate undocumented protocol with pipe-delimited data in HTML comments. Fields like RST Sent/Received exist in the desktop client but not in the XML API

## Terms of Service Constraints

Source: NetLogger.org Terms and Conditions (revised September 1, 2025)

### Permitted
- Using the NetLogger XML API to access the service (explicitly allowed)
- Building a client whose primary purpose is in direct support of Radio Communications
- Open-sourcing client code (TOS governs service access, not client licensing)
- Referencing "NetLogger" descriptively (e.g., "a web client for NetLogger nets")

### Prohibited
- Using the NetLogger trademark in the product name without written consent
- Primary purpose being a "computer-based chat room" (AIM must be secondary to net monitoring)
- Advertising, selling, or trading goods/services
- Impersonation
- Any use not in direct support of Radio Communications
- Violations of 47 CFR § 97.113

### Naming
- Project is named **NetDeck Radio** to avoid trademark issues
- Do NOT use "NetLogger" as part of the product name

## Architecture Recommendations

### Backend Proxy (Required)
A thin backend server is needed for two reasons:
1. **CORS** — Browser-based JavaScript cannot directly call the NetLogger API due to cross-origin restrictions
2. **Rate limit compliance** — The API has strict per-endpoint rate limits. A caching proxy polls the API at recommended intervals and serves cached data to any number of connected browser clients

**Recommended polling intervals:**
- GetActiveNets: every 60 seconds
- GetCheckins: every 20 seconds (per monitored net)
- GetPastNets: on-demand with caching

**Data flow:**
```
NetLogger API <--XML--> Backend Proxy <--WebSocket/SSE/JSON--> Browser Clients
```

The backend should:
- Parse XML responses into JSON for the frontend
- Cache responses and serve stale data between polls
- Manage concurrent net subscriptions (only poll GetCheckins for nets that clients are actively viewing)
- Respect rate limits strictly — the NetLogger team has implemented anti-flooding due to abusive clients

### Frontend
- Responsive web UI (mobile-first or at minimum mobile-friendly)
- Two primary views: net list and net detail (check-in table)
- Station pointer highlighting (who is currently working)
- Status color coding matching NetLogger conventions (Operator, Net Control, Logger, VIP, Not Heard, Short Time, Courtesy Check, No Response, etc.)
- Auto-refresh with visual indication of data freshness
- Net search/filter

## Existing Third-Party Landscape

| App | Platform | Features | Notes |
|-----|----------|----------|-------|
| NetLogger Companion | iOS, Android | View nets, check-ins, AIM send/receive, QRZ logging | By Andrew Pearson / Group427. Uses undocumented API endpoints for AIM |
| On-Air Net Scraper | iOS, macOS | View nets, check-ins, AIM, QRZ lookup, JS8Call integration | By K3CLR (Christopher Robson). Feature-rich but complex |
| Ham Radio Net Logger (YLSystem.org) | Cross-platform desktop | Full net management, ARRL message entry | Separate project, not a NetLogger.org viewer |

No web-based client currently exists — this is the gap NetDeck Radio fills.

## Phase 1 Scope (Read-Only Viewer)

Using only the four documented API endpoints:
- [ ] Backend proxy with XML parsing and caching
- [ ] Active nets list with metadata (frequency, mode, band, NCS, logger, subscribers)
- [ ] Net detail view with full check-in table
- [ ] Station pointer tracking (highlighted current station)
- [ ] Status field parsing and color coding
- [ ] Past nets browsing (last 7 days, with search)
- [ ] Auto-refresh at API-compliant intervals
- [ ] Responsive layout (desktop + mobile)
- [ ] Net search/filter by name

## Phase 2 Scope (Future — Requires Undocumented Endpoints)

- [ ] AIM message reading
- [ ] AIM message sending (requires session auth)
- [ ] Monitor list (who's watching)
- [ ] Session login/management

Phase 2 requires either obtaining Appendix A/B documentation from K0JDD or reverse-engineering the endpoints via traffic capture.
