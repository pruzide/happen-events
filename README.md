# Happen — Event discovery and registration

A lightweight, responsive event-discovery application for the K Explore web design assignment. **Vanilla HTML, CSS and JavaScript; no React, bundler, paid hosting, analytics SDK or application framework.** The frontend is static; actual registrations are handled by a Cloudflare Worker and persisted to D1 (SQLite-compatible SQL).

> **Demo disclaimer:** The eight included events are fictional. A saved registration demonstrates a real server/database write, but it is **not** a real ticket, booking or payment. Do not enter sensitive or genuine participant information into the fictional-event demo. Before running real events, replace the catalogue, publish organizer information, update privacy and verification policies, and add email ownership verification.

## 1. What it does

- Responsive homepage, custom SVG artwork, semantic sections and keyboard-accessible native dialogs.
- Search by event name, category and city; category and city filters.
- Event details, date, venue, description, registration status and dynamic featured-event countdown.
- Validated name/email/phone/event/consent form; inline errors and server-side validation.
- **Persistent registration in a database**, not just `localStorage`.
- Duplicate rejection, event-start cutoff, atomic capacity guard (default 120 per event).
- Friendly success screen and **My events** list with dates, venues and event artwork. Internal confirmation IDs never appear in the interface or browser storage; only event IDs and timestamps are saved for local display.
- Dark/light mode, clear empty/error/loading states, mobile navigation.
- No cancellation or deletion is implied by the browser-only My events display. Removing browser data does not affect backend registrations.
- Privacy notice, anonymous hashed IP rate limiting, production Turnstile verification and automatic retention cleanup.

## Visitor experience and implementation boundaries

- After registration, visitors see **You're on the list!**, an event summary, and two simple actions: **My events** or **Keep exploring**.
- **My events** shows the event poster, name, date, venue and a **Registered** label. It never shows internal database identifiers or local-storage controls.
- The server still assigns an internal confirmation ID, but the interface does not display it or save it in browser storage. Browser storage contains only event IDs and dates. Previous local references are migrated into this reduced format automatically.
- **My events is a browser-only convenience view**, not a user account or a live registration lookup. Registrations from another device will not appear; clearing site data affects the display, **not** the database record. There is no misleading "delete" or "cancel" button without an actual authenticated cancellation endpoint.
- This remains a **fictional-event demo**; the success view keeps a short disclosure that no real ticket is issued.

## 2. Architecture

```text
Browser (HTML/CSS/JS + original SVG artwork)
      |            |
      | GET assets | POST /api/register (same origin, JSON)
      v            v
Cloudflare static   Cloudflare Worker
assets              |  server validation, rate limit, Turnstile Siteverify
                    v
               Cloudflare D1
               (registrations, rate-limit buckets)

Local: Node HTTP server + node:sqlite, same Worker request handler.
```

`public/events.js` is the single source of truth for the demonstration event catalogue. The server imports this same module; users cannot invent their own event IDs or change event capacity in a submitted request.

## 3. Run locally (no accounts or packages required)

**Requirements:** VS Code (optional) and **Node.js 22.13 or newer**. In Windows/WSL, run commands inside an Ubuntu terminal in the project directory. Node 24 LTS is also suitable if it supports `node:sqlite`.

1. Unzip the archive and open the **`happen-event-pro`** directory in VS Code.
2. In the VS Code terminal:

   ```bash
   node --version
   npm run dev
   ```

3. Open **http://127.0.0.1:8788** in your browser.
4. Search for an event, open its details, and register with **fictional test details**. Local mode simulates the bot challenge; it is only reachable on `127.0.0.1`, not on your public site.
5. The local SQLite database is created at `.local/happen.sqlite` (ignored by Git, never published). To view **only event-level counts**:

   ```bash
   npm run local:status
   ```

6. Stop the server with `Ctrl+C`.

**Important:** Do not open `index.html` by double-clicking it. `file://` cannot provide the backend/API, so registration won't work. Don't use Live Server by itself either; start the Node server above.

### Tests (no third-party test packages needed)

```bash
npm run check
```

The test suite uses Node's built-in test runner and a real in-memory SQLite database. It checks input validation, bad JSON, request limits, cross-origin rejection, duplicate records, registration persistence, atomic event capacity, rate limiting, production fail-closed behavior and retention cleanup.

`npm run local:status` reads the local database only. Never publish `.local/`, `.dev.vars`, `.env`, secret keys or participant exports.

