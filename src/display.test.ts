import test from 'node:test';
import assert from 'node:assert/strict';
import { isAsciiMode, ui } from './display.js';

test('ui preserves Turkish characters by default', () => {
  const previous = process.env.AA_ASCII;
  delete process.env.AA_ASCII;

  try {
    assert.equal(isAsciiMode(), false);
    assert.equal(ui('Gündem • Öğrenci Şubesi'), 'Gündem • Öğrenci Şubesi');
  } finally {
    if (previous === undefined) {
      delete process.env.AA_ASCII;
    } else {
      process.env.AA_ASCII = previous;
    }
  }
});

test('ui falls back to ASCII when AA_ASCII=1', () => {
  const previous = process.env.AA_ASCII;
  process.env.AA_ASCII = '1';

  try {
    assert.equal(isAsciiMode(), true);
    assert.equal(ui('Gündem • Öğrenci Şubesi'), 'Gundem - Ogrenci Subesi');
  } finally {
    if (previous === undefined) {
      delete process.env.AA_ASCII;
    } else {
      process.env.AA_ASCII = previous;
    }
  }
});
