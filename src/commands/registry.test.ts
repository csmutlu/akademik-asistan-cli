import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from './registry.js';

test('parses teacher dashboard command', () => {
  const parsed = parseCommand(['teacher', 'dashboard']);
  assert.ok(parsed && parsed.ok);
  if (parsed && parsed.ok) {
    assert.equal(parsed.command.id, 'teacher-dashboard');
  }
});

test('parses slash commands and flags', () => {
  const parsed = parseCommand(['/yemekhane', '--day', 'tomorrow', '--json']);
  assert.ok(parsed && parsed.ok);
  if (parsed && parsed.ok) {
    assert.equal(parsed.command.id, 'yemekhane');
    assert.equal(parsed.command.args.day, 'tomorrow');
    assert.equal(parsed.command.json, true);
  }
});

test('returns suggestion for close matches', () => {
  const parsed = parseCommand(['gundm']);
  assert.ok(parsed && !parsed.ok);
  if (parsed && !parsed.ok) {
    assert.equal(parsed.suggestion, 'gundem');
  }
});
