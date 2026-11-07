# Security notes — Happen

This is a carefully scoped student demo, **not** a certified secure ticketing product. No website can honestly promise to be unexploitable. The relevant threats and mitigations are explicit below.

| Threat | Mitigation | Remaining limitation |
|---|---|---|
| Script / HTML injection | Server regex/length validation; encoded frontend event content; DOM `textContent` for user text; strict script CSP | Malicious future edits to the trusted event catalogue must still be reviewed |
| SQL injection | Parameterized SQLite/D1 `prepare().bind()` statements; no SQL assembled from form fields | New queries need tests and review |
| Invalid / invented events | Shared event catalogue validated server-side; registration cutoff tied to date | Catalogue is managed by editing code; no admin UI |
| Duplicate registration | `UNIQUE(event_id,email)` at database level | Doesn't prove the submitter controls the email |
| Overbooking from concurrent submissions | Single conditional SQLite `INSERT ... SELECT ... COUNT < capacity` operation | High-volume/billing tests against Cloudflare are still needed |
| Form spam | Server-side Turnstile Siteverify, HMAC-pseudonymized IP bucket, strict body size | Shared IPs can hit limits; bots can still consume public endpoints |
| CSRF or cross-origin write | Same-origin `Origin` check, JSON content type, no credential cookies | Origin is not an authentication mechanism; curl clients can supply one |
| Exposing other people's registrations | No public `SELECT`/list endpoint; opaque confirmation UUID; no passwords or secret keys in assets | D1 account administrators can read data; secure their Cloudflare login |
| Leaking PII through browser storage | Only event ID and date stored; names, emails, phones and confirmation IDs remain server-side | End-user browser extensions/devices are outside server control |
| Data retention | Scheduled deletion 30 days after event end; cleanup rate buckets | Monitor cron execution; keep reasonable deletion request procedures |
| Cross-site framing / MIME misuse | CSP frame-ancestors, X-Frame-Options, nosniff | Review CSP whenever adding third-party resources |
| Accidental secrets in Git | `.gitignore` excludes `.env`, `.dev.vars`, local D1 and modules | Never print or paste real secrets into public logs, issues or source files |

## Before accepting real people

1. Replace fictional events and prices with verified listings and accurate organiser contact information.
2. Publish a real privacy and deletion policy suitable for your jurisdiction and consent context.
3. Add ownership verification for email addresses if fraudulent sign-ups would matter.
4. Implement authenticated attendance/registration lookup, account recovery or cancellation *only if needed*. Do not expose registrations by predictable IDs.
5. Arrange real disaster recovery (backups and restoration testing), a useful audit trail that avoids PII, and a clear breach/incident process.
6. Validate on an actual deployed `workers.dev` hostname, and test capacity, bot protection and D1 failure modes.
7. Restrict Cloudflare and GitHub account access with MFA. Avoid secret keys in GitHub Actions; manual deploy is the intentionally minimal approach here.

## Security response / deletion

The deployment's contact email is configured as a Worker secret named `CONTACT_EMAIL` and displayed on `/privacy.html`. Do not accept account deletion solely based on a claimed email address; verify ownership privately. With access to the Cloudflare D1 console, the operator can delete an authenticated requester's row using a bound/appropriately quoted query. Never publish records or query results containing personal data.
