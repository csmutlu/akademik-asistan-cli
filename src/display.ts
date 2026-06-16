const ASCII_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Ç/g, 'C'],
  [/ç/g, 'c'],
  [/Ğ/g, 'G'],
  [/ğ/g, 'g'],
  [/İ/g, 'I'],
  [/ı/g, 'i'],
  [/Ö/g, 'O'],
  [/ö/g, 'o'],
  [/Ş/g, 'S'],
  [/ş/g, 's'],
  [/Ü/g, 'U'],
  [/ü/g, 'u'],
  [/•/g, '-'],
  [/…/g, '...'],
  [/—/g, '-'],
  [/–/g, '-'],
  [/’/g, "'"],
  [/“|”/g, '"'],
];

export function isAsciiMode(): boolean {
  return process.env.AA_ASCII === '1';
}

export function ui(text: string): string {
  if (!isAsciiMode()) {
    return text;
  }

  return ASCII_REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

// Degrade box-drawing to single-line borders on dumb/non-TTY terminals or in
// ASCII mode, where rounded corners render as garbage.
export function shouldUseSimpleBorders(): boolean {
  if (isAsciiMode()) return true;
  if ((process.env.TERM || '') === 'dumb') return true;
  if (!process.stdout.isTTY) return true;
  return false;
}

// Return a glyph (emoji/symbol) normally, or an ASCII fallback in ASCII mode.
// Pass an empty fallback to simply drop the glyph when ASCII is forced.
export function icon(glyph: string, asciiFallback = ''): string {
  return isAsciiMode() ? asciiFallback : glyph;
}
