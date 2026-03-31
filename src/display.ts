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
