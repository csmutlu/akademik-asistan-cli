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

test('parses login debug and no-open flags', () => {
  const parsed = parseCommand(['login', '--debug', '--no-open']);
  assert.ok(parsed && parsed.ok);
  if (parsed && parsed.ok) {
    assert.equal(parsed.command.id, 'login');
    assert.equal(parsed.command.args.debug, true);
    assert.equal(parsed.command.args['no-open'], true);
  }
});

test('returns suggestion for close matches', () => {
  const parsed = parseCommand(['gundm']);
  assert.ok(parsed && !parsed.ok);
  if (parsed && !parsed.ok) {
    assert.equal(parsed.suggestion, 'gundem');
  }
});
