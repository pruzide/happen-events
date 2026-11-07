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

## 4. Free public deployment: Cloudflare Workers + D1

This is one project, one deployment, one free SQLite-compatible hosted database, with no separately managed backend server. Free tiers have usage limits, and require creating your own free Cloudflare account. A **`*.workers.dev` address is free**; registering a custom `.com` domain is not.

### A. Install Wrangler and sign in

```bash
npm install
npx wrangler login
```

`npm install` adds the Cloudflare CLI as a **development dependency** (not delivered to your site's visitors). Keep the generated `package-lock.json` under version control.

### B. Create your database

```bash
npx wrangler d1 create happen-events-db
```

Cloudflare displays a unique `database_id`. If asked whether to update your configuration automatically, you can answer **No** and follow the next step manually.

In `wrangler.jsonc`, replace:

```json
"database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

with the ID the command actually returned. The database ID is not a secret; don't copy someone else's ID. `binding` stays `DB`.

### C. Apply the schema **to the remote database**

```bash
npx wrangler d1 migrations apply happen-events-db --remote
```

This creates the `registrations` and `rate_limits` tables and indexes. Check the confirmation in your terminal; you must repeat this step for future migrations. Do not assume that local migrations modify production.

### D. Deploy once to get your free URL

```bash
npx wrangler deploy
```

The CLI will display a URL similar to:

`https://happen-events.YOUR_ACCOUNT_SUBDOMAIN.workers.dev`

This is **an example format, not a generated URL**. Until you configure the required security values, the public event listings work but **new registrations are intentionally disabled**.

### E. Configure free Cloudflare Turnstile bot protection

1. In the Cloudflare dashboard, open **Turnstile** and create a **Managed** widget.
2. Set its allowed hostname to the precise host from your deployment, e.g. `happen-events.YOUR_ACCOUNT_SUBDOMAIN.workers.dev` — **no `https://`, path or port**.
3. Copy its **site key** and **secret key**. The site key is public by design; the secret key must remain server-side.
4. Save both as Worker secrets:

   ```bash
   npx wrangler secret put TURNSTILE_SITE_KEY
   npx wrangler secret put TURNSTILE_SECRET
   ```

You will be prompted to paste each value **into your local terminal**, not into your JavaScript or Git repository. The backend calls Siteverify and checks the returned hostname and action; merely displaying a widget is not considered verification.

### F. Set the remaining production values

Generate a random 32-byte secret **on your own computer**:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value when prompted:

```bash
npx wrangler secret put RATE_LIMIT_SECRET
```

Provide an email address you control for privacy/deletion requests:

```bash
npx wrangler secret put CONTACT_EMAIL
```

The `CONTACT_EMAIL` value is intentionally disclosed in your public privacy notice. **Never put private API tokens or passwords in it.** An invalid or missing privacy contact prevents production registrations from starting.

Finally redeploy to make sure your current source code is published:

```bash
npx wrangler deploy
```

### G. Verify the public site

1. Open the URL printed by Wrangler; review hero, cards, event detail, search, city/category filters and dark mode.
2. Visit `https://YOUR_DEPLOYED_HOST/api/health` — expected JSON `{"status":"ok"}`.
3. Visit `https://YOUR_DEPLOYED_HOST/api/config` — expected `"enabled":true` and the public Turnstile site key. **The secret must not appear here.**
4. Open registration and complete Turnstile. Submit *test-only* details. Expect a clear success message and event summary, without an internal reference.
5. Submit the same test email for the same event again; expect a duplicate error.
6. In Cloudflare's D1 console or via Wrangler, inspect **counts**, not personal records:

   ```bash
   npx wrangler d1 execute happen-events-db --remote --command "SELECT event_id, COUNT(*) AS registrations FROM registrations GROUP BY event_id;"
   ```

7. Check at 320px, 390px, 768px and 1440px widths using browser DevTools. Use keyboard-only navigation to verify modal focus and form errors. For new real content, rerun responsive and accessibility checks.

### H. Publish to GitHub (assignment submission)

Create an empty GitHub repository named `happen-events` under your account, then:

```bash
git init
git add .
git commit -m "Build secure event registration demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/happen-events.git
git push -u origin main
```

Replace `YOUR_USERNAME`. Submit **both** the GitHub repository URL and the deployed `workers.dev` URL. The included GitHub Actions workflow runs syntax checks and SQLite tests on pushes and pull requests. Deployments are kept manual on purpose, avoiding unnecessary CI credentials. To update the public site after editing files, run `npm run check` and `npx wrangler deploy`.

## 5. Maintain the project

| Goal | Action |
|---|---|
| Edit events, dates, places or venue info | Change `public/events.js`; use future ISO timestamps with `+05:30`, give each event a unique ID |
| Change event artwork | Add an optimized local `.svg` under `public/assets`, update its allowlisted path |
| Re-style the site | Edit `public/styles.css` design tokens at the top |
| Change public copy | Edit `public/index.html` |
| Change validation / registration logic | Review **both** `public/script.js` and `server/worker.js`, then run tests |
| Update database | Add a numbered `.sql` file in `migrations/`, apply it explicitly with `--remote` after checking impact |
| Check uptime | Open `/api/health`; use the Workers dashboard for errors and D1 metrics |
| Review security dependencies | Run `npm audit` after `npm install`; update Wrangler and rerun tests |
| Stop registrations without removing the site | Remove the Turnstile secret or change the config, redeploy; backend fails closed |
| Remove a specific record on request | Authenticate the request out of band, then delete it privately via D1 admin tooling; do not create a public list/export endpoint |

**Regular maintenance:** Refresh sample event dates, verify the contact address and Turnstile widget, review free-tier usage, confirm scheduled cleanup succeeds, and periodically test mobile navigation and registration with synthetic data.

## 6. Security design and limitations

Read [SECURITY.md](SECURITY.md) for the threat model and residual risks. The central rules are:

- Server validates all fields; user-controlled values never decide the SQL query structure (D1 prepared statements).
- The server owns valid event IDs, dates and capacity. A single atomic SQL insert prevents racing over capacity; unique SQL constraint prevents duplicates.
- JSON body limited to 4 KiB. No cookies, authentication session, user enumeration endpoint, public admin endpoint or personal-data API.
- POST is same-origin JSON; cross-origin writes are rejected. A publicly writable registration form is **not** an authenticated service.
- Turnstile token verified **server-side** for public deployments, with hostname/action checks. Missing secrets result in HTTP 503 rather than silently disabled protection.
- HMAC-hashed client-IP rate-limit buckets; no raw IP persisted in D1 by this app. Bot challenges and rate limits **reduce**, not eliminate, abuse.
- Strict JavaScript Content Security Policy; security headers, self-hosted SVG assets; no third-party tracking scripts.
- Personal fields live only in D1; local storage contains only event IDs, timestamps and theme preferences. Records expire **30 days after the event ends** via cron cleanup, if the scheduled task operates normally.

**Out of scope deliberately:** email ownership verification, email confirmations, login and authenticated account recovery, cancellations, payments, actual ticket issuance, staff admin panel, attendance scanning, full legal/privacy compliance for real customers, multi-region capacity guarantees, formal penetration testing and a verified 1,000-concurrent-user load test. Add those before advertising this as a real ticketing platform; they are not needed for the K Explore assignment.

### Free-tier capacity

As of November 2026, Cloudflare lists **100,000 Worker requests/day** on its free tier, and D1 **5 million rows read/day, 100,000 rows written/day and 5 GB storage**. Static assets have separate free delivery. These are limits, **not** a promise that 1,000 people can register simultaneously. Traffic patterns, abuse and free-plan changes can affect the application. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

## 7. Project structure

```text
happen-event-pro/
├── public/
│   ├── index.html            # Semantic, responsive UI
│   ├── privacy.html          # Plain-language privacy notice
│   ├── privacy.js            # Loads deployment privacy contact
│   ├── styles.css            # Tokens, components, breakpoints
│   ├── script.js             # Search, dialogs, validation and API client
│   ├── events.js             # Shared authored event data
│   ├── _headers              # CSP and security headers
│   └── assets/               # Original local SVGs
├── server/
│   ├── worker.js             # Cloudflare Worker API
│   └── local.mjs             # 127.0.0.1-only SQLite preview
├── migrations/0001_init.sql # Schema, indexes and constraints
├── scripts/local-status.mjs  # PII-free event counts
├── tests/worker.test.mjs     # Integration tests with real SQLite
├── .github/workflows/ci.yml # Automated quality gate
├── wrangler.jsonc            # Cloudflare configuration
├── SECURITY.md
└── package.json
```

**Status of this deliverable:** Local API and real SQLite writes were tested, including valid registration, duplicate rejection, injection attempt and origin rejection; 8 SQLite-backed automated checks passed. A full browser interaction pass and a real Cloudflare deployment could **not** be performed from the current environment. Do those final two verification steps on your machine and Cloudflare account before submitting.
