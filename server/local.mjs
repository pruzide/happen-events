// Dependency-free local preview with real SQLite persistence. Binds ONLY to loopback.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.js';

const publicDir = resolve(import.meta.dirname, '../public');
const dataDir = resolve(import.meta.dirname, '../.local');
await mkdir(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'happen.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;');
const schema = await readFile(resolve(import.meta.dirname, '../migrations/0001_init.sql'), 'utf8');
db.exec(schema);
const adapter = {
  prepare(sql) {
    const statement = db.prepare(sql);
    return { bind(...args) { return {
      async first() { return statement.get(...args) ?? null; },
      async run() { const result = statement.run(...args); return { meta: { changes: result.changes } }; },
    }; }, async first() { return statement.get() ?? null; } };
  },
};
const HEADER_PATH = resolve(publicDir, '_headers');
const securityHeaders = Object.fromEntries((await readFile(HEADER_PATH, 'utf8')).split('\n')
  .filter(line => line.startsWith('  ') && line.includes(':')).map(line => { const pos = line.indexOf(':'); return [line.slice(2, pos).trim(), line.slice(pos + 1).trim()]; }));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8' };

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const body = ['GET', 'HEAD'].includes(incoming.method) ? undefined : incoming;
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, body, duplex: body ? 'half' : undefined });
      const response = await worker.fetch(request, { DB: adapter, LOCAL_DEVELOPMENT: '1' });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
    const encoded = decodeURIComponent(url.pathname);
    if (encoded.includes('\0') || encoded.split('/').includes('..')) { outgoing.writeHead(404); outgoing.end(); return; }
    const path = resolve(publicDir, '.' + (encoded === '/' ? '/index.html' : encoded));
    if (!path.startsWith(publicDir + sep) || !existsSync(path) || path === HEADER_PATH) { outgoing.writeHead(404); outgoing.end(); return; }
    const content = await readFile(path);
    outgoing.writeHead(200, { ...securityHeaders, 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    outgoing.end(incoming.method === 'HEAD' ? undefined : content);
  } catch (error) {
    console.error('Local request failed', error?.name || 'error');
    outgoing.writeHead(500); outgoing.end('Internal server error');
  }
});
const port = Number(process.env.PORT || 8788);
server.listen(port, '127.0.0.1', () => console.log(`Happen local server: http://127.0.0.1:${port}`));
