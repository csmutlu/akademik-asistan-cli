import { icon } from '../display.js';
import type { AgendaItem } from '../types.js';

// Ink color names used across the TUI for urgency / accenting.
export type Tone = 'red' | 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'gray';

// [emoji, asciiFallback] per agenda item type.
const TYPE_GLYPH: Record<AgendaItem['type'], [string, string]> = {
  class: ['📚', 'DERS'],
  assignment: ['📝', 'ODEV'],
  exam: ['🧪', 'SINV'],
  period: ['🗓️', 'DONM'],
};

// Prefer the backend-provided per-item emoji; fall back to a type glyph.
export function itemIcon(item: AgendaItem): string {
  const [glyph, ascii] = TYPE_GLYPH[item.type] ?? ['•', '-'];
  if (item.emoji) return icon(item.emoji, ascii);
  return icon(glyph, ascii);
}

// Map an agenda item to an urgency colour. Driven by the section the backend
// already bucketed it into (simdi → now, bugun → today, ...), so there is no
// timezone-sensitive date math here.
export function urgencyTone(item: AgendaItem): Tone {
  switch (item.section) {
    case 'simdi':
      return 'red';
    case 'bugun':
      return item.type === 'exam' || item.type === 'assignment' ? 'red' : 'yellow';
    case 'yarin':
      return 'yellow';
    case 'hafta':
      return 'cyan';
    default:
      return 'gray';
  }
}

// One compact line for a card: "📝 Ödev başlığı • 2 gün sonra".
export function compactAgendaLine(item: AgendaItem): string {
  return `${itemIcon(item)} ${item.title} • ${item.badge}`;
}
