import type { CommandDefinition, CommandId, ParsedCommand } from '../types.js';

const DEFINITIONS: CommandDefinition[] = [
  { id: 'login', path: ['login'], aliases: ['/login'], description: 'Tarayici ile oturum ac', requiresAuth: false, example: 'aasistan login' },
  { id: 'logout', path: ['logout'], aliases: ['/logout'], description: 'Kayitli oturumu kapat', requiresAuth: false, example: 'aasistan logout' },
  { id: 'whoami', path: ['whoami'], aliases: ['/whoami'], description: 'Aktif kullaniciyi goster', example: 'aasistan whoami' },
  { id: 'gundem', path: ['gundem'], aliases: ['/gundem'], description: 'Kisisel gundemi getir', example: 'aasistan gundem' },
  { id: 'bugun', path: ['bugun'], aliases: ['/bugun'], description: 'Bugunun ders, odev ve sinavlari', example: 'aasistan bugun' },
  { id: 'yarin', path: ['yarin'], aliases: ['/yarin'], description: 'Yarinin akademik kayitlari', example: 'aasistan yarin' },
  { id: 'hafta', path: ['hafta'], aliases: ['/hafta'], description: 'Onumuzdeki 7 gunu ozetle', example: 'aasistan hafta' },
  { id: 'odev', path: ['odev'], aliases: ['/odev'], description: 'Yaklasan odevleri listele', example: 'aasistan odev' },
  { id: 'sinav', path: ['sinav'], aliases: ['/sinav'], description: 'Yaklasan sinavlari ve donemleri listele', example: 'aasistan sinav' },
  { id: 'dersler', path: ['dersler'], aliases: ['/dersler'], description: 'Simdi, bugun ve yarin dersleri', example: 'aasistan dersler' },
  { id: 'duyurular', path: ['duyurular'], aliases: ['/duyurular'], description: 'Son universite duyurulari', example: 'aasistan duyurular' },
  { id: 'yemekhane', path: ['yemekhane'], aliases: ['/yemekhane'], description: 'Bugun veya yarin menusu', example: 'aasistan yemekhane --day tomorrow' },
  { id: 'teacher-dashboard', path: ['teacher', 'dashboard'], aliases: ['/teacher dashboard'], description: 'Ogretmen/admin guvenlik ozeti', example: 'aasistan teacher dashboard' },
  { id: 'watch', path: ['watch'], aliases: ['/watch'], description: 'Surekli acik brief modu', example: 'aasistan watch' },
  { id: 'help', path: ['help'], aliases: ['/help'], description: 'Komut yardimini goster', requiresAuth: false, example: 'aasistan help' },
];

type ParseOutcome =
  | { ok: true; command: ParsedCommand }
  | { ok: false; error: string; suggestion?: string };

function normalizeToken(token: string): string {
  return token.trim().replace(/^\/+/, '').toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, row) =>
    Array.from({ length: a.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0)),
  );

  for (let row = 1; row <= b.length; row += 1) {
    for (let col = 1; col <= a.length; col += 1) {
      const cost = a[col - 1] === b[row - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
}

function findSuggestion(tokens: string[]): string | undefined {
  const raw = tokens.join(' ');
  const candidates = DEFINITIONS.map((definition) => definition.path.join(' '));
  const best = candidates
    .map((candidate) => ({ candidate, distance: levenshtein(raw, candidate) }))
    .sort((left, right) => left.distance - right.distance)[0];

  if (!best || best.distance > Math.max(4, Math.floor(raw.length / 2))) {
    return undefined;
  }

  return best.candidate;
}

export function getCommandDefinitions(): CommandDefinition[] {
  return DEFINITIONS;
}

export function getCommandDefinition(id: CommandId): CommandDefinition | undefined {
  return DEFINITIONS.find((definition) => definition.id === id);
}

export function parseCommand(inputTokens: string[]): ParseOutcome | null {
  const tokens = [...inputTokens];
  let json = false;
  const args: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      return {
        ok: true,
        command: { id: 'help', json, args, rawTokens: ['help'] },
      };
    }
    if (token === '--day') {
      args.day = tokens[index + 1] || 'today';
      index += 1;
      continue;
    }
    if (token.startsWith('--day=')) {
      args.day = token.slice('--day='.length);
      continue;
    }
    if (token.startsWith('--')) {
      args[token.slice(2)] = true;
      continue;
    }
    positional.push(normalizeToken(token));
  }

  if (positional.length === 0) {
    return null;
  }

  const normalized = positional.join(' ');
  const definition = DEFINITIONS.find((candidate) => candidate.path.join(' ') === normalized);
  if (!definition) {
    const suggestion = findSuggestion(positional);
    return {
      ok: false,
      error: `Bilinmeyen komut: ${normalized}`,
      suggestion,
    };
  }

  return {
    ok: true,
    command: {
      id: definition.id,
      json,
      args,
      rawTokens: positional,
    },
  };
}
