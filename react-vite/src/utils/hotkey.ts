const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Win'] as const;

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Control: 'Ctrl',
  Meta: 'Win',
  OS: 'Win',
};

/** Canonical form expected by the backend (lowercase, underscore named keys). */
const BACKEND_KEY_MAP: Record<string, string> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  shift: 'shift',
  win: 'win',
  meta: 'win',
  cmd: 'win',
  esc: 'esc',
  escape: 'esc',
  space: 'space',
  enter: 'enter',
  tab: 'tab',
  backspace: 'backspace',
  delete: 'delete',
  insert: 'insert',
  home: 'home',
  end: 'end',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  pageup: 'page_up',
  pagedown: 'page_down',
  page_up: 'page_up',
  page_down: 'page_down',
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

export const HOTKEY_FIELD_LABELS: Record<string, string> = {
  emergencyHotkey: '急停热键',
  recordStartHotkey: '开始录制',
  recordStopHotkey: '停止录制',
  playbackStartHotkey: '开始回放',
  playbackStopHotkey: '停止回放',
};

/** Find another configured field that shares the same chord (display form). */
export function findHotkeyConflict(
  field: string,
  value: string,
  all: Record<string, string>,
): string | null {
  const normalized = normalizeHotkeyDisplay(value);
  if (!normalized) return null;
  for (const [other, otherValue] of Object.entries(all)) {
    if (other === field) continue;
    if (!otherValue?.trim()) continue;
    if (normalizeHotkeyDisplay(otherValue) === normalized) return other;
  }
  return null;
}

/** Convert UI/display hotkey (e.g. Ctrl+PageUp) to backend storage form (ctrl+page_up). */
export function hotkeyToBackend(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parts = trimmed
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const lower = part.toLowerCase().replace(/-/g, '_');
      const compact = lower.replace(/_/g, '');
      if (BACKEND_KEY_MAP[lower]) return BACKEND_KEY_MAP[lower];
      if (BACKEND_KEY_MAP[compact]) return BACKEND_KEY_MAP[compact];
      if (/^f\d+$/.test(lower)) return lower;
      if (lower.length === 1 && /[a-z0-9]/.test(lower)) return lower;
      return lower;
    });
  const order = ['ctrl', 'alt', 'shift', 'win'];
  const modifiers = order.filter(m => parts.includes(m));
  const keys = parts.filter(p => !order.includes(p));
  if (keys.length !== 1) return parts.join('+');
  return [...modifiers, keys[0]].join('+');
}