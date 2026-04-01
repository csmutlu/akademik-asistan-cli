import { spawn } from 'node:child_process';
import { getCliVersion } from '../version.js';

const RELEASE_API_URL = 'https://api.github.com/repos/csmutlu/akademik-asistan-cli/releases/latest';

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

type GitHubReleasePayload = {
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} komutu ${code ?? 'bilinmeyen'} koduyla çıktı.`));
    });
  });
}

function canRun(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], {
      stdio: 'ignore',
    });

    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

function getNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function findLatestTarballUrl(release: GitHubReleasePayload): string | null {
  const asset = release.assets?.find((item) => {
    const name = String(item.name || '');
    const url = String(item.browser_download_url || '');
    return /^aasistan-\d+\.\d+\.\d+\.tgz$/i.test(name) && url.startsWith('https://');
  });

  return asset?.browser_download_url || null;
}

async function getLatestTarballUrl(): Promise<{ tarballUrl: string; releaseUrl: string | null }> {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aasistan-cli',
    },
  });

  if (!response.ok) {
    throw new Error(`Son sürüm bilgisi alınamadı (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as GitHubReleasePayload;
  const tarballUrl = findLatestTarballUrl(payload);
  if (!tarballUrl) {
    throw new Error('Son sürüm tarball bağlantısı bulunamadı.');
  }

  return {
    tarballUrl,
    releaseUrl: payload.html_url || null,
  };
}

export async function runSelfUpdate(): Promise<string> {
  if (!(await canRun('brew'))) {
    const npmCommand = getNpmCommand();
    if (!(await canRun(npmCommand))) {
      return [
        'Otomatik güncelleme için desteklenen bir paket yöneticisi bulunamadı.',
        'Homebrew: brew update && brew upgrade aasistan',
        'npm tarball: npm install -g <release-tarball-url>',
      ].join('\n');
    }

    process.stdout.write(`Mevcut sürüm: v${getCliVersion()}\n`);
    process.stdout.write('GitHub release güncellemesi başlatılıyor...\n');
    const { tarballUrl, releaseUrl } = await getLatestTarballUrl();
    await run(npmCommand, ['install', '-g', tarballUrl]);
    return [
      'Güncelleme tamamlandı.',
      releaseUrl ? `Release: ${releaseUrl}` : null,
      'Yeni sürümü görmek için `aasistan help` çalıştır.',
    ].filter(Boolean).join('\n');
  }

  process.stdout.write(`Mevcut sürüm: v${getCliVersion()}\n`);
  process.stdout.write('Homebrew güncellemesi başlatılıyor...\n');
  await run('brew', ['update']);
  await run('brew', ['upgrade', 'aasistan']);
  return 'Güncelleme tamamlandı. Yeni sürümü görmek için `aasistan help` çalıştır.';
}
