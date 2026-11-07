import { EVENTS } from '../public/events.js';

const MAX_BYTES = 4096;
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS_PER_IP_WINDOW = 20;
const LOCAL_SITE_KEY = 'local-development-only';
const EVENT_MAP = new Map(EVENTS.map(event => [event.id, event]));
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...PRIVATE_HEADERS, ...extraHeaders } });
}

function isLocal(request, env) {
  const host = new URL(request.url).hostname;
  return env.LOCAL_DEVELOPMENT === '1' && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]');
}

function registrationConfig(request, env) {
  const local = isLocal(request, env);
  const contact = typeof env.CONTACT_EMAIL === 'string' ? env.CONTACT_EMAIL.trim() : '';
  const ready = local || Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET && env.RATE_LIMIT_SECRET && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact));
  return {
    enabled: ready,
    local,
    siteKey: local ? LOCAL_SITE_KEY : (ready ? env.TURNSTILE_SITE_KEY : null),
    contactEmail: contact || null,
  };
}

export function validateRegistration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Invalid form data.' };
  const name = typeof value.name === 'string' ? value.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const phone = typeof value.phone === 'string' ? value.phone.trim().replace(/[\s().-]/g, '') : '';
  const eventId = typeof value.eventId === 'string' ? value.eventId : '';
  const token = typeof value.turnstileToken === 'string' ? value.turnstileToken : '';
  const consent = value.consent === true;

  if (!/^[\p{L}\p{M} .'-]{2,80}$/u.test(name) || !/\p{L}/u.test(name)) return { error: 'Enter a valid full name (2–80 characters).', field: 'fullName' };
  if (email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email)) return { error: 'Enter a valid email address.', field: 'email' };
  if (!/^\+?\d{10,15}$/.test(phone)) return { error: 'Enter a valid phone number (10–15 digits).', field: 'phone' };
  if (!EVENT_MAP.has(eventId)) return { error: 'Choose an available event.', field: 'selectedEvent' };
  if (!consent) return { error: 'Please agree to the privacy notice.', field: 'consent' };
  if (token.length < 1 || token.length > 2048) return { error: 'Complete the verification and try again.', field: 'turnstile' };
  return { data: { name, email, phone, eventId, token } };
}

async function parseLimitedJson(request) {
  if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return { error: 'Use application/json.', status: 415 };
  const claimedLength = Number(request.headers.get('content-length') || 0);
  if (claimedLength > MAX_BYTES) return { error: 'Form data is too large.', status: 413 };
  if (!request.body) return { error: 'Missing form data.', status: 400 };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return { error: 'Form data is too large.', status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  } catch { return { error: 'Invalid JSON body.', status: 400 }; }
}

async function hashBucket(secret, ip, windowStart) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ip}:${windowStart}`));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function checkRateLimit(db, secret, ip) {
  const windowStart = Math.floor(Date.now() / WINDOW_MS);
  const bucket = await hashBucket(secret, ip, windowStart);
  const expiry = new Date((windowStart + 2) * WINDOW_MS).toISOString();
  // One atomic operation: concurrent requests cannot bypass the limit through read/write races.
  const row = await db.prepare(`
    INSERT INTO rate_limits (bucket, hits, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1 WHERE hits < ?
    RETURNING hits
  `).bind(bucket, expiry, MAX_REQUESTS_PER_IP_WINDOW).first();
  return Boolean(row);
}

async function verifyTurnstile(request, env, token, local) {
  if (local) return token === 'local-development-only';
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const data = await response.json();
  const expectedHost = new URL(request.url).hostname;
  return data.success === true && data.hostname === expectedHost && (!data.action || data.action === 'register');
}

async function register(request, env) {
  const config = registrationConfig(request, env);
  if (!env.DB || !config.enabled) return json({ message: 'Registration is temporarily unavailable. Please check the setup instructions.' }, 503);
  const expectedOrigin = new URL(request.url).origin;
  if (request.headers.get('origin') !== expectedOrigin) return json({ message: 'Request origin was not accepted.' }, 403);
  const parsed = await parseLimitedJson(request);
  if (parsed.error) return json({ message: parsed.error }, parsed.status);
  const validated = validateRegistration(parsed.data);
  if (validated.error) return json({ message: validated.error, field: validated.field || null }, 400);
  const { name, email, phone, eventId, token } = validated.data;
  const event = EVENT_MAP.get(eventId);
  if (Date.now() >= Date.parse(event.date)) return json({ message: 'Registration has closed for this event.', field: 'selectedEvent' }, 409);
  const ip = request.headers.get('cf-connecting-ip') || 'unidentified-client';
  try {
    const secret = config.local ? 'local-dev-rate-limit-secret' : env.RATE_LIMIT_SECRET;
    if (!await checkRateLimit(env.DB, secret, ip)) return json({ message: 'Too many attempts. Please try again in ten minutes.' }, 429, { 'Retry-After': '600' });
  } catch (error) {
    console.error('Rate limiter failed', error?.name || 'error');
    return json({ message: 'Registration is temporarily unavailable.' }, 503);
  }
  try {
    if (!await verifyTurnstile(request, env, token, config.local)) return json({ message: 'Verification failed or expired. Please retry.', field: 'turnstile' }, 400);
  } catch {
    return json({ message: 'Could not verify your submission. Please retry shortly.' }, 503);
  }

  const id = crypto.randomUUID();
  const expiry = new Date(Date.parse(event.end) + 30 * 86400000).toISOString();
  const now = new Date().toISOString();
  try {
    // The event capacity predicate and INSERT run as one SQLite statement.
    // Duplicate registrations are prevented by UNIQUE(event_id,email), including races.
    const inserted = await env.DB.prepare(`
      INSERT INTO registrations (id, event_id, full_name, email, phone, created_at, expires_at)
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM registrations WHERE event_id = ?) < ?
      RETURNING id
    `).bind(id, eventId, name, email, phone, now, expiry, eventId, event.capacity || 120).first();
    if (!inserted) return json({ message: 'This event is currently full.' }, 409);
    return json({ confirmationId: id, eventId, eventTitle: event.title, message: 'Registration confirmed.' }, 201);
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) return json({ message: 'An entry for this email already exists for this event.', field: 'email' }, 409);
    console.error('Registration database failure', error?.name || 'error');
    return json({ message: 'Registration could not be completed. Please retry.' }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return json({ message: 'Not found.' }, 404);
    if (request.method === 'OPTIONS') return json({ message: 'Cross-origin requests are not enabled.' }, 405, { Allow: 'GET, POST' });
    if (url.pathname === '/api/config' && request.method === 'GET') return json(registrationConfig(request, env));
    if (url.pathname === '/api/health' && request.method === 'GET') {
      try { if (!env.DB) throw new Error('Database unavailable'); await env.DB.prepare('SELECT 1 AS ok').first(); return json({ status: 'ok' }); }
      catch { return json({ status: 'unavailable' }, 503); }
    }
    if (url.pathname === '/api/register' && request.method === 'POST') return register(request, env);
    return json({ message: 'Not found.' }, 404);
  },
  async scheduled(_event, env) {
    const now = new Date().toISOString();
    await env.DB.prepare('DELETE FROM registrations WHERE expires_at < ?').bind(now).run();
    await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
  },
};
