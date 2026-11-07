// Local-only metrics: totals per event; never print participant personal information.
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const filename = resolve('.local/happen.sqlite');
if (!existsSync(filename)) { console.log('No local database yet. Run npm run dev first.'); process.exit(0); }
const db = new DatabaseSync(filename, { readOnly: true });
const counts = db.prepare('SELECT event_id, COUNT(*) AS registrations FROM registrations GROUP BY event_id ORDER BY event_id').all();
console.table(counts);
console.log('Stored records:', counts.reduce((sum, row) => sum + row.registrations, 0));
db.close();
