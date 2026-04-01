import { spawn } from 'node:child_process';
import { getCliVersion } from '../version.js';

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

export async function runSelfUpdate(): Promise<string> {
  if (!(await canRun('brew'))) {
    return [
      'Otomatik güncelleme şu an yalnızca Homebrew kurulumu için destekleniyor.',
      'Elle güncelleme: brew update && brew upgrade aasistan',
    ].join('\n');
  }

  process.stdout.write(`Mevcut sürüm: v${getCliVersion()}\n`);
  process.stdout.write('Homebrew güncellemesi başlatılıyor...\n');
  await run('brew', ['update']);
  await run('brew', ['upgrade', 'aasistan']);
  return 'Güncelleme tamamlandı. Yeni sürümü görmek için `aasistan help` çalıştır.';
}
