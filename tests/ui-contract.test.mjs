import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/script.js', import.meta.url), 'utf8');

test('visitor-facing confirmation and event list do not expose implementation details', () => {
  assert.match(html, /id="confirmationEventName"/);
  assert.match(html, /id="confirmationEventDate"/);
  assert.match(html, /id="savedList"/);
  assert.match(html, /My events/);
  assert.doesNotMatch(html, /id="confirmationCode"|id="copyConfirmation"|id="clearRegistrations"/i);
  assert.doesNotMatch(html, /Copy reference|Forget locally|Clear all my confirmations/i);
  assert.doesNotMatch(script, /getElementById\(['"]confirmationCode|#confirmationCode|#copyConfirmation|#clearRegistrations/);
});

test('browser storage is a minimal display-only event list', () => {
  assert.match(script, /const SAVED_EVENTS_KEY = 'happen:events:v3'/);
  assert.match(script, /unique\.set\(event\.id, \{ eventId: event\.id, createdAt: item\.createdAt \}\)/);
  assert.match(script, /localStorage\.removeItem\(LEGACY_RECEIPTS_KEY\)/);
  assert.doesNotMatch(script, /savedEvents\.push\(\{[^}]*confirmationId/);
});
