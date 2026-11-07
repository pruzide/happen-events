import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { validateRegistration } from '../server/worker.js';

const migration = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migration);
  const db = { prepare(sql) {
    const statement = sqlite.prepare(sql);
    return { bind(...args) { return {
      first: async () => statement.get(...args) ?? null,
      run: async () => ({ meta: { changes: statement.run(...args).changes } }),
    }; }, first: async () => statement.get() ?? null };
  } };
  return { sqlite, db };
}
function env(db, local = true) { return { DB: db, ...(local ? { LOCAL_DEVELOPMENT: '1' } : {}) }; }
function req(payload, { method = 'POST', origin = 'http://127.0.0.1:8788', contentType = 'application/json', path = '/api/register' } = {}) {
  const headers = { 'Content-Type': contentType, Origin: origin, 'CF-Connecting-IP': '203.0.113.4' };
  return new Request(`http://127.0.0.1:8788${path}`, { method, headers, body: JSON.stringify(payload) });
}
const valid = { name:'Alex Sharma', email:'alex@example.com', phone:'9876543210', eventId:'sound-district', consent:true, turnstileToken:'local-development-only' };

// Fetch handler tests run against actual SQLite SQL, not a mocked row store.
test('validation rejects script payloads, invalid fields, forged event and missing consent', () => {
  assert.equal(validateRegistration({ ...valid, name:'<script>alert(1)</script>' }).field, 'fullName');
  assert.equal(validateRegistration({ ...valid, email:'not-an-email' }).field, 'email');
  assert.equal(validateRegistration({ ...valid, phone:'abc' }).field, 'phone');
  assert.equal(validateRegistration({ ...valid, eventId:'not-real' }).field, 'selectedEvent');
  assert.equal(validateRegistration({ ...valid, consent:false }).field, 'consent');
  assert.ok(validateRegistration({ ...valid, name:'Ananya Sen' }).data);
});

test('backend rejects malformed requests and disallows cross-origin writes', async () => {
  const { db } = makeDb();
  assert.equal((await worker.fetch(req(valid,{ origin:'https://attacker.example' }), env(db))).status, 403);
  assert.equal((await worker.fetch(req(valid,{ contentType:'text/plain' }), env(db))).status, 415);
  assert.equal((await worker.fetch(new Request('http://127.0.0.1:8788/api/register',{ method:'POST',headers:{'Origin':'http://127.0.0.1:8788','Content-Type':'application/json'},body:'invalid { json' }), env(db))).status, 400);
  const over = 'x'.repeat(5000);
  assert.equal((await worker.fetch(req({ ...valid, name:over }), env(db))).status, 413);
  assert.equal((await worker.fetch(req({ ...valid, turnstileToken:'forged' }), env(db))).status, 400);
});

test('registered record lives in database, duplicates fail, confirmation omits PII', async () => {
  const { db, sqlite } = makeDb();
  const response = await worker.fetch(req(valid), env(db));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.confirmationId, /^[0-9a-f-]{36}$/i);
  assert.ok(!JSON.stringify(body).includes('alex@example.com'));
  const row = sqlite.prepare('SELECT * FROM registrations WHERE event_id=?').get('sound-district');
  assert.equal(row.full_name, 'Alex Sharma');
  assert.equal(row.email, 'alex@example.com');
  assert.ok(row.expires_at > row.created_at);
  const dup = await worker.fetch(req({ ...valid, email:'ALEX@EXAMPLE.COM' }), env(db));
  assert.equal(dup.status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 1);
});

test('atomic capacity guard prevents overbooking', async () => {
  const { db, sqlite } = makeDb();
  const insert = sqlite.prepare('INSERT INTO registrations VALUES(?,?,?,?,?,?,?)');
  for (let i=0; i<120; i++) insert.run(`test-${i}`, 'sound-district', 'Alex Sharma', `person-${i}@example.com`, '9876543210', '2026-11-07T00:00:00Z', '2027-01-01T00:00:00Z');
  assert.equal((await worker.fetch(req(valid), env(db))).status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 120);
});

test('rate limiter is enforced with atomic D1-compatible upsert', async () => {
  const { db } = makeDb();
  let response;
  for(let i=0;i<21;i++) response = await worker.fetch(req({ ...valid, turnstileToken:'wrong' }), env(db));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '600');
});

test('production never silently falls back to insecure local verification', async () => {
  const { db } = makeDb();
  const config = await worker.fetch(new Request('https://happen-events.workers.dev/api/config'), env(db,false));
  assert.equal((await config.json()).enabled, false);
  const attempt = await worker.fetch(new Request('https://happen-events.workers.dev/api/register',{method:'POST',headers:{Origin:'https://happen-events.workers.dev','Content-Type':'application/json'},body:JSON.stringify(valid)}), env(db,false));
  assert.equal(attempt.status, 503);
});

test('scheduled task deletes expired registration and rate limit records', async () => {
  const { db, sqlite } = makeDb();
  sqlite.prepare('INSERT INTO registrations VALUES(?,?,?,?,?,?,?)').run('expired','sound-district','Test User','old@example.com','9876543210','2024-01-01','2024-02-01');
  sqlite.prepare('INSERT INTO rate_limits VALUES(?,?,?)').run('old',1,'2024-01-01');
  await worker.scheduled({}, env(db));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n,0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n,0);
});

test('health endpoint and non-existing paths return explicit status', async () => {
  const { db }=makeDb();
  assert.equal((await worker.fetch(new Request('http://127.0.0.1:8788/api/health'), env(db))).status, 200);
  assert.equal((await worker.fetch(new Request('http://127.0.0.1:8788/api/admin/list'), env(db))).status, 404);
});
