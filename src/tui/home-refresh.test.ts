import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../api/client.js';
import { isBackgroundRefresh, isTransientHomeError, shouldKeepLastSnapshotOnError } from './home-refresh.js';

test('isBackgroundRefresh only marks automatic refreshes when a snapshot already exists', () => {
  assert.equal(isBackgroundRefresh('auto', true), true);
  assert.equal(isBackgroundRefresh('auto', false), false);
  assert.equal(isBackgroundRefresh('manual', true), false);
});

test('shouldKeepLastSnapshotOnError preserves the current dashboard on transient auto-refresh failures', () => {
  assert.equal(shouldKeepLastSnapshotOnError(true, true, new ApiError('timeout', 0)), true);
  assert.equal(shouldKeepLastSnapshotOnError(false, true, new ApiError('timeout', 0)), false);
  assert.equal(shouldKeepLastSnapshotOnError(true, false, new ApiError('timeout', 0)), false);
  assert.equal(shouldKeepLastSnapshotOnError(true, true, new ApiError('unauthorized', 401)), false);
});

test('isTransientHomeError detects normalized network timeouts and 5xx responses', () => {
  assert.equal(isTransientHomeError(new ApiError('timeout', 0)), true);
  assert.equal(isTransientHomeError(new ApiError('server', 503)), true);
  assert.equal(isTransientHomeError(new Error('Bağlantı zaman aşımına uğradı; sunucu veya ağ geçici olarak yavaş olabilir.')), true);
  assert.equal(isTransientHomeError(new ApiError('unauthorized', 401)), false);
});
