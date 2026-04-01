import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedVersion = 'dev';

try {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = path.resolve(currentDir, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };
  if (typeof packageJson.version === 'string' && packageJson.version.trim()) {
    cachedVersion = packageJson.version.trim();
  }
} catch {
  // Fallback to a safe placeholder when package metadata is unavailable.
}

export function getCliVersion(): string {
  return cachedVersion;
}
