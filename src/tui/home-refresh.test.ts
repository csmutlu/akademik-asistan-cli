import test from 'node:test';
import assert from 'node:assert/strict';
import { isBackgroundRefresh, shouldKeepLastSnapshotOnError } from './home-refresh.js';

test('isBackgroundRefresh only marks automatic refreshes when a snapshot already exists', () => {
  assert.equal(isBackgroundRefresh('auto', true), true);
  assert.equal(isBackgroundRefresh('auto', false), false);
  assert.equal(isBackgroundRefresh('manual', true), false);
});

test('shouldKeepLastSnapshotOnError preserves the current dashboard on transient auto-refresh failures', () => {
  assert.equal(shouldKeepLastSnapshotOnError('auto', true, true), true);
  assert.equal(shouldKeepLastSnapshotOnError('auto', false, true), false);
  assert.equal(shouldKeepLastSnapshotOnError('manual', true, true), false);
  assert.equal(shouldKeepLastSnapshotOnError('auto', true, false), false);
});
