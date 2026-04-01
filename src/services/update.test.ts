import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpawnConfig, findLatestTarballUrl } from './update.js';

test('findLatestTarballUrl returns the aasistan tarball asset', () => {
  const url = findLatestTarballUrl({
    html_url: 'https://github.com/csmutlu/akademik-asistan-cli/releases/tag/cli-v0.1.16',
    assets: [
      {
        name: 'checksums.txt',
        browser_download_url: 'https://example.com/checksums.txt',
      },
      {
        name: 'aasistan-0.1.16.tgz',
        browser_download_url: 'https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.16/aasistan-0.1.16.tgz',
      },
    ],
  });

  assert.equal(
    url,
    'https://github.com/csmutlu/akademik-asistan-cli/releases/download/cli-v0.1.16/aasistan-0.1.16.tgz',
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

test('buildSpawnConfig keeps direct spawn on unix-like systems', () => {
  const config = buildSpawnConfig('npm', ['install', '-g', 'https://example.com/pkg.tgz'], 'darwin');

  assert.deepEqual(config, {
    command: 'npm',
    args: ['install', '-g', 'https://example.com/pkg.tgz'],
    shell: false,
  });
});

test('buildSpawnConfig uses shell mode for Windows cmd commands', () => {
  const config = buildSpawnConfig('npm.cmd', ['install', '-g', 'C:\\Users\\Süleyman\\My Packages\\pkg.tgz'], 'win32');

  assert.equal(config.shell, true);
  assert.deepEqual(config.args, []);
  assert.match(config.command, /^npm\.cmd install -g /);
  assert.match(config.command, /"C:\\Users\\Süleyman\\My Packages\\pkg\.tgz"$/);
});
