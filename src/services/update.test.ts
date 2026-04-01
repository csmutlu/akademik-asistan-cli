import test from 'node:test';
import assert from 'node:assert/strict';
import { findLatestTarballUrl } from './update.js';

test('findLatestTarballUrl returns the aasistan tarball asset', () => {
  const url = findLatestTarballUrl({
    html_url: 'https://github.com/csmutlu/akademik-asistan-cli/releases/tag/cli-v0.1.14',
    assets: [
      {
        name: 'checksums.txt',
        browser_download_url: 'https://example.com/checksums.txt',
      },
      {
        name: 'aasistan-0.1.14.tgz',
        browser_download_url: 'https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.14/aasistan-0.1.14.tgz',
      },
    ],
  });

  assert.equal(
    url,
    'https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.14/aasistan-0.1.14.tgz',
  );
});

test('findLatestTarballUrl returns null when tgz asset is missing', () => {
  const url = findLatestTarballUrl({
    assets: [
      {
        name: 'source.zip',
        browser_download_url: 'https://example.com/source.zip',
      },
    ],
  });

  assert.equal(url, null);
});

