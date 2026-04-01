import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuddyMessage, trimBuddyHistory } from './history.js';

test('trimBuddyHistory keeps the newest messages', () => {
  const history = Array.from({ length: 4 }, (_, index) =>
    createBuddyMessage(index % 2 === 0 ? 'user' : 'assistant', `mesaj-${index}`, `2026-04-0${index + 1}T09:00:00.000Z`),
  );

  const trimmed = trimBuddyHistory(history, 2);

  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[0]?.content, 'mesaj-2');
  assert.equal(trimmed[1]?.content, 'mesaj-3');
});
