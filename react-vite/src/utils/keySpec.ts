import type { KeySpec } from '../types';
import { formatHotkeyLabel, hotkeyToBackend, normalizeHotkeyDisplay } from './hotkey';

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
]);

const CODE_TO_KEY: Record<string, { keyCode: string; extended?: boolean }> = {
  ControlLeft: { keyCode: 'ctrl_l' },
  ControlRight: { keyCode: 'ctrl_r', extended: true },
  AltLeft: { keyCode: 'alt_l' },
  AltRight: { keyCode: 'alt_r', extended: true },
  ShiftLeft: { keyCode: 'shift_l' },
  ShiftRight: { keyCode: 'shift_r' },
  MetaLeft: { keyCode: 'win_l', extended: true },
  MetaRight: { keyCode: 'win_r', extended: true },
  OSLeft: { keyCode: 'win_l', extended: true },
  OSRight: { keyCode: 'win_r', extended: true },
  Escape: { keyCode: 'esc' },
  Enter: { keyCode: 'enter' },
  Space: { keyCode: 'space' },
  Tab: { keyCode: 'tab' },
  Backspace: { keyCode: 'backspace' },
  Delete: { keyCode: 'delete', extended: true },
  Insert: { keyCode: 'insert', extended: true },
  Home: { keyCode: 'home', extended: true },
  End: { keyCode: 'end', extended: true },
  PageUp: { keyCode: 'page_up', extended: true },
  PageDown: { keyCode: 'page_down', extended: true },
  ArrowUp: { keyCode: 'up', extended: true },
  ArrowDown: { keyCode: 'down', extended: true },
  ArrowLeft: { keyCode: 'left', extended: true },
  ArrowRight: { keyCode: 'right', extended: true },
};

const MODIFIER_ORDER = ['ctrl_l', 'ctrl_r', 'ctrl', 'alt_l', 'alt_r', 'alt', 'shift_l', 'shift_r', 'shift', 'win_l', 'win_r', 'win'];

const MODIFIER_SET = new Set(MODIFIER_ORDER);

export function isModifierKeyCode(keyCode: string): boolean {
  const normalized = keyCode.toLowerCase();
  return MODIFIER_SET.has(normalized) || normalized === 'cmd' || normalized === 'meta';
}

function codeFromEvent(event: KeyboardEvent): KeySpec | null {
  const mapped = CODE_TO_KEY[event.code];
  if (mapped) {
    return {
      keyCode: mapped.keyCode,
      scanCode: null,
      extended: Boolean(mapped.extended),
    };
  }

  if (/^F\d{1,2}$/i.test(event.key)) {
    return { keyCode: event.key.toLowerCase(), scanCode: null, extended: false };
  }

  if (event.key.length === 1) {
    const ch = event.key.toLowerCase();
    if (/[a-z0-9]/.test(ch)) {
      return { keyCode: ch, scanCode: null, extended: false };
    }
  }

  return null;
}

function modifiersFromEvent(event: KeyboardEvent): KeySpec[] {
  const specs: KeySpec[] = [];
  if (event.ctrlKey) specs.push({ keyCode: 'ctrl_l', scanCode: null, extended: false });
  if (event.altKey) specs.push({ keyCode: 'alt_l', scanCode: null, extended: false });
  if (event.shiftKey) specs.push({ keyCode: 'shift_l', scanCode: null, extended: false });
  if (event.metaKey) specs.push({ keyCode: 'win_l', scanCode: null, extended: true });
  return specs;
}

export function eventToKeySpecs(event: KeyboardEvent): KeySpec[] | null {
  if (MODIFIER_CODES.has(event.code)) {
    return null;
  }
  const primary = codeFromEvent(event);
  if (!primary || isModifierKeyCode(primary.keyCode)) {
    return null;
  }
  const modifiers = modifiersFromEvent(event);
  return orderKeySpecs([...modifiers, primary]);
}

export function orderKeySpecs(keys: KeySpec[]): KeySpec[] {
  const modifiers = keys.filter(k => isModifierKeyCode(k.keyCode));
  const primaries = keys.filter(k => !isModifierKeyCode(k.keyCode));
  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a.keyCode) - MODIFIER_ORDER.indexOf(b.keyCode));
  return [...modifiers, ...primaries];
}

export function formatKeySpecsLabel(keys: KeySpec[], fallback = '点击后按下组合键'): string {
  if (!keys.length) return fallback;
  const display = keys
    .map(key => {
      const code = key.keyCode.toLowerCase();
      if (code === 'ctrl' || code === 'ctrl_l' || code === 'ctrl_r') return 'Ctrl';
      if (code === 'alt' || code === 'alt_l' || code === 'alt_r') return 'Alt';
      if (code === 'shift' || code === 'shift_l' || code === 'shift_r') return 'Shift';
      if (code === 'win' || code === 'win_l' || code === 'win_r' || code === 'cmd' || code === 'meta') return 'Win';
      if (code === 'page_up') return 'PageUp';
      if (code === 'page_down') return 'PageDown';
      if (code === 'esc') return 'Esc';
      if (code.length === 1) return code.toUpperCase();
      if (/^f\d+$/.test(code)) return code.toUpperCase();
      return code.charAt(0).toUpperCase() + code.slice(1);
    })
    .join('+');
  return formatHotkeyLabel(normalizeHotkeyDisplay(display), fallback);
}

export function keySpecsToBackendChord(keys: KeySpec[]): string {
  if (!keys.length) return '';
  const modifiers: string[] = [];
  const primaries: string[] = [];
  for (const key of keys) {
    const code = key.keyCode.toLowerCase();
    if (code.startsWith('ctrl')) modifiers.push('ctrl');
    else if (code.startsWith('alt')) modifiers.push('alt');
    else if (code.startsWith('shift')) modifiers.push('shift');
    else if (code.startsWith('win') || code === 'cmd' || code === 'meta') modifiers.push('win');
    else primaries.push(code);
  }
  const order = ['ctrl', 'alt', 'shift', 'win'];
  const uniqueMods = order.filter(m => modifiers.includes(m));
  if (primaries.length !== 1) return [...uniqueMods, ...primaries].join('+');
  return hotkeyToBackend([...uniqueMods, primaries[0]].join('+'));
}

export function findControlHotkeyConflict(
  keys: KeySpec[],
  controlHotkeys: Record<string, string>,
): string | null {
  const chord = keySpecsToBackendChord(keys);
  if (!chord) return null;
  const normalized = hotkeyToBackend(chord);
  for (const [field, value] of Object.entries(controlHotkeys)) {
    if (!value?.trim()) continue;
    if (hotkeyToBackend(value) === normalized) return field;
  }
  return null;
}