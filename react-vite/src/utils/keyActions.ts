import type { KeyDownAction, KeySpec, KeyUpAction, ScriptAction } from '../types';
import { formatKeySpecsLabel } from './keySpec';

type KeyAction = KeyDownAction | KeyUpAction;
type KeyPayload = KeyAction['payload'];

/** Hold time between pressing and releasing the main key (long enough for games to notice). */
export const KEY_PRESS_HOLD_MS = 30;
/** Gap between pressing / releasing consecutive modifiers. */
export const KEY_MODIFIER_GAP_MS = 10;

function isKeyAction(action: ScriptAction): action is KeyAction {
  return action.type === 'key_down' || action.type === 'key_up';
}

function sameKey(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function keyActionLabel(payload: Pick<KeyPayload, 'keyCode'>): string {
  return formatKeySpecsLabel([{ keyCode: payload.keyCode, scanCode: null, extended: false }], payload.keyCode);
}

/**
 * Expand a key or chord (modifiers first, then one main key) into key_down / key_up actions:
 * modifiers down → key down → hold → key up → modifiers up (reverse order).
 */
export function expandKeyPress(keys: KeySpec[], delayBeforeMs = 200): ScriptAction[] {
  const actions: ScriptAction[] = [];
  const push = (type: 'key_down' | 'key_up', key: KeySpec, delay: number) => {
    const payload = { keyCode: key.keyCode, scanCode: null, extended: key.extended };
    actions.push(
      type === 'key_down'
        ? { id: crypto.randomUUID(), enabled: true, delayBeforeMs: delay, type, payload }
        : { id: crypto.randomUUID(), enabled: true, delayBeforeMs: delay, type, payload },
    );
  };
  keys.forEach((key, index) => push('key_down', key, index === 0 ? delayBeforeMs : KEY_MODIFIER_GAP_MS));
  [...keys].reverse().forEach((key, index) => push('key_up', key, index === 0 ? KEY_PRESS_HOLD_MS : KEY_MODIFIER_GAP_MS));
  return actions;
}

/**
 * Replace one action; when a key action's key changes, update its partner too (the next key_up
 * of the same key after a key_down, or the previous key_down before a key_up) so the new key is
 * not left held down.
 */
export function updateActionWithKeyPartner(
  actions: ScriptAction[],
  id: string,
  updated: ScriptAction,
): ScriptAction[] {
  const index = actions.findIndex(action => action.id === id);
  if (index < 0) return actions;
  const original = actions[index];
  const next = actions.slice();
  next[index] = updated;
  if (!isKeyAction(original) || !isKeyAction(updated) || original.type !== updated.type) return next;
  if (sameKey(original.payload.keyCode, updated.payload.keyCode)) return next;

  const partnerType = original.type === 'key_down' ? 'key_up' : 'key_down';
  const step = original.type === 'key_down' ? 1 : -1;
  for (let i = index + step; i >= 0 && i < next.length; i += step) {
    const candidate = next[i];
    if (!isKeyAction(candidate) || !sameKey(candidate.payload.keyCode, original.payload.keyCode)) continue;
    if (candidate.type !== partnerType) break; // pressed again before release: ambiguous, leave it
    next[i] = {
      ...candidate,
      payload: {
        ...candidate.payload,
        keyCode: updated.payload.keyCode,
        scanCode: updated.payload.scanCode,
        extended: updated.payload.extended,
      },
    };
    break;
  }
  return next;
}
