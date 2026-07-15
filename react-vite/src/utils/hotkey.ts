const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Win'] as const;

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Control: 'Ctrl',
  Meta: 'Win',
  OS: 'Win',
};

type HotkeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>;

export function eventToHotkey(event: HotkeyEvent): string | null {
  const raw = event.key;
  if (raw === 'Control' || raw === 'Alt' || raw === 'Shift' || raw === 'Meta' || raw === 'OS') {
    return null;
  }

  let key = KEY_ALIASES[raw] ?? raw;
  if (key.length === 1) key = key.toUpperCase();
  if (key.startsWith('f') && /^f\d+$/i.test(key)) key = key.toUpperCase();

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Win');
  parts.push(key);
  return parts.join('+');
}

export function normalizeHotkeyDisplay(value: string): string {
  if (!value.trim()) return '';
  return value
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const lower = part.toLowerCase();
      if (lower === 'control' || lower === 'ctrl') return 'Ctrl';
      if (lower === 'alt') return 'Alt';
      if (lower === 'shift') return 'Shift';
      if (lower === 'win' || lower === 'cmd' || lower === 'meta') return 'Win';
      if (lower === 'escape' || lower === 'esc') return 'Esc';
      if (lower === ' ') return 'Space';
      if (lower.startsWith('f') && /^f\d+$/.test(lower)) return lower.toUpperCase();
      if (part.length === 1) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .sort((a, b) => {
      const ai = MODIFIER_ORDER.indexOf(a as (typeof MODIFIER_ORDER)[number]);
      const bi = MODIFIER_ORDER.indexOf(b as (typeof MODIFIER_ORDER)[number]);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .join('+');
}

export function matchesHotkey(event: HotkeyEvent, hotkey: string): boolean {
  if (!hotkey.trim()) return false;
  const current = eventToHotkey(event);
  if (!current) return false;
  return normalizeHotkeyDisplay(current) === normalizeHotkeyDisplay(hotkey);
}

export function formatHotkeyLabel(hotkey: string, fallback = '未设置'): string {
  return hotkey.trim() ? normalizeHotkeyDisplay(hotkey) : fallback;
}