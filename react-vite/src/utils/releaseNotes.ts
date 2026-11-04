/**
 * Release notes: bundled copies of docs/release-notes/v*.md, conversion of GitHub's HTML feed
 * text, and a small Markdown subset parser. Output is plain data rendered as React text, so
 * notes can never inject HTML into the app.
 */

const files = import.meta.glob('../../../docs/release-notes/v*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface ReleaseNote {
  version: string;
  markdown: string;
}

export const RELEASES_URL = 'https://github.com/Geo-ff/keymouse-studio/releases';

function versionParts(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map(part => (Number.isFinite(Number(part)) ? Number(part) : 0));
}

/** Negative when a < b, positive when a > b (numeric, dotted versions). */
export function compareVersions(a: string, b: string): number {
  const x = versionParts(a);
  const y = versionParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

export function bundledReleaseNotes(source: Record<string, string> = files): ReleaseNote[] {
  return Object.entries(source)
    .map(([path, markdown]) => ({ version: /v([^/\\]+)\.md$/.exec(path)?.[1] ?? '', markdown: markdown.trim() }))
    .filter(note => note.version && note.markdown)
    .sort((a, b) => compareVersions(b.version, a.version));
}

export const BUNDLED_RELEASE_NOTES = bundledReleaseNotes();

/** Notes of versions after `previous` up to and including `current`, newest first. */
export function notesSince(previous: string, current: string, notes = BUNDLED_RELEASE_NOTES): ReleaseNote[] {
  return notes.filter(note => compareVersions(note.version, previous) > 0 && compareVersions(note.version, current) <= 0);
}

export function findReleaseNote(version: string | null | undefined, notes = BUNDLED_RELEASE_NOTES): ReleaseNote | null {
  if (!version) return null;
  return notes.find(note => compareVersions(note.version, version) === 0) ?? null;
}

/* --- HTML (GitHub releases feed) → Markdown subset --- */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower];
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return match;
  });
}

export function looksLikeHtml(text: string): boolean {
  return /<\/?(h[1-6]|p|ul|ol|li|strong|em|b|i|br|a|code|div|span)\b[^>]*>/i.test(text);
}

/** Older clients receive notes from GitHub's feed as rendered HTML; turn it back into structure. */
export function htmlToMarkdown(html: string): string {
  const markdown = html
    .replace(/\r\n/g, '\n')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_m, text: string) => `\n## ${text.trim()}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, text: string) => `\n- ${text.replace(/\s*\n\s*/g, ' ').trim()}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(markdown)
    .split('\n')
    .map(line => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Notes as Markdown, whichever form they arrived in; null when empty. */
export function normalizeNotes(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed || trimmed === 'No content.') return null;
  return looksLikeHtml(trimmed) ? htmlToMarkdown(trimmed) : trimmed;
}

/* --- Markdown subset → blocks --- */

export type InlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export type NotesBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; parts: InlinePart[] }
  | { kind: 'bullet'; parts: InlinePart[] }
  | { kind: 'paragraph'; parts: InlinePart[] }
  | { kind: 'gap' };

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?，。；：！？)])/g;

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: 'text', text: text.slice(last, index) });
    if (match[1] !== undefined) parts.push({ kind: 'bold', text: match[1] });
    else if (match[2] !== undefined) parts.push({ kind: 'code', text: match[2] });
    else if (match[3] !== undefined) parts.push({ kind: 'link', text: match[3], href: match[4] });
    else parts.push({ kind: 'link', text: match[5], href: match[5] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

export function parseNotes(markdown: string): NotesBlock[] {
  const blocks: NotesBlock[] = [];
  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/g, '');
    if (!line.trim()) {
      if (blocks.length && blocks[blocks.length - 1].kind !== 'gap') blocks.push({ kind: 'gap' });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, parts: parseInline(heading[2].replace(/\s+#+$/, '')) });
      continue;
    }
    const bullet = /^\s*(?:[-*+•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      blocks.push({ kind: 'bullet', parts: parseInline(bullet[1]) });
      continue;
    }
    blocks.push({ kind: 'paragraph', parts: parseInline(line.trim()) });
  }
  while (blocks.length && blocks[blocks.length - 1].kind === 'gap') blocks.pop();
  return blocks;
}
