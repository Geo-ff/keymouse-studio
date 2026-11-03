import { describe, expect, it } from 'vitest';
import type { KeyDownAction, KeyUpAction, ScriptAction } from '../types';
import { expandKeyPress, updateActionWithKeyPartner } from './keyActions';
import { eventToSingleKeySpec, isPlayableKeyCode } from './keySpec';
import { globalHotkeyWarning } from './hotkey';

function keyAction(type: 'key_down' | 'key_up', keyCode: string, id: string, scanCode: number | null = null): ScriptAction {
  const payload = { keyCode, scanCode, extended: false };
  return type === 'key_down'
    ? ({ id, enabled: true, delayBeforeMs: 0, type, payload } satisfies KeyDownAction)
    : ({ id, enabled: true, delayBeforeMs: 0, type, payload } satisfies KeyUpAction);
}

const keyEvent = (init: Partial<KeyboardEvent>) => ({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...init }) as KeyboardEvent;

describe('playable key codes (mirrors backend validation)', () => {
  it.each(['a', 'A', '1', ';', 'Enter', 'Escape', 'esc', 'space', 'F5', 'f24', 'ctrl', 'shift_r', 'page_up', 'PageDown', 'vk_19'])(
    'accepts %s',
    keyCode => expect(isPlayableKeyCode(keyCode)).toBe(true),
  );
  it.each(['Ctrl+C', 'Alt+Tab', 'Win+D', 'Shift+Tab', 'num_lock', ''])('rejects %s', keyCode => {
    expect(isPlayableKeyCode(keyCode)).toBe(false);
  });
  it('accepts any named key that carries a recorded scan code', () => {
    expect(isPlayableKeyCode('num_lock', 69)).toBe(true);
  });
});

describe('single key capture', () => {
  it('captures modifiers alone, letters and punctuation; ignores held modifiers', () => {
    expect(eventToSingleKeySpec(keyEvent({ code: 'ControlRight', key: 'Control', ctrlKey: true }))).toEqual({ keyCode: 'ctrl_r', scanCode: null, extended: true });
    expect(eventToSingleKeySpec(keyEvent({ code: 'KeyC', key: 'c', ctrlKey: true }))).toEqual({ keyCode: 'c', scanCode: null, extended: false });
    expect(eventToSingleKeySpec(keyEvent({ code: 'Semicolon', key: ';' }))).toEqual({ keyCode: ';', scanCode: null, extended: false });
    expect(eventToSingleKeySpec(keyEvent({ code: 'Escape', key: 'Escape' }))?.keyCode).toBe('esc');
  });
});

describe('key press expansion', () => {
  it('presses modifiers first and releases them last', () => {
    const actions = expandKeyPress(
      [
        { keyCode: 'ctrl_l', scanCode: null, extended: false },
        { keyCode: 'shift_l', scanCode: null, extended: false },
        { keyCode: 'c', scanCode: null, extended: false },
      ],
      150,
    );

    expect(actions.map(a => `${a.type}:${a.type === 'key_down' || a.type === 'key_up' ? a.payload.keyCode : ''}`)).toEqual([
      'key_down:ctrl_l',
      'key_down:shift_l',
      'key_down:c',
      'key_up:c',
      'key_up:shift_l',
      'key_up:ctrl_l',
    ]);
    expect(actions[0].delayBeforeMs).toBe(150);
    expect(actions[3].delayBeforeMs).toBe(30);
    expect(new Set(actions.map(a => a.id)).size).toBe(6);
  });
});

describe('editing a key updates its partner', () => {
  const script = [
    keyAction('key_down', 'a', 'd1', 30),
    keyAction('key_down', 'b', 'd2'),
    keyAction('key_up', 'b', 'u2'),
    keyAction('key_up', 'a', 'u1', 30),
    keyAction('key_down', 'a', 'd3'),
    keyAction('key_up', 'a', 'u3'),
  ];
  const keys = (actions: ScriptAction[]) =>
    actions.map(a => (a.type === 'key_down' || a.type === 'key_up' ? `${a.id}:${a.payload.keyCode}:${a.payload.scanCode}` : a.id));

  it('changes the matching release after a press, and drops its stale scan code', () => {
    const edited = updateActionWithKeyPartner(script, 'd1', keyAction('key_down', 'enter', 'd1'));
    expect(keys(edited)).toEqual(['d1:enter:null', 'd2:b:null', 'u2:b:null', 'u1:enter:null', 'd3:a:null', 'u3:a:null']);
  });

  it('changes the matching press before a release', () => {
    const edited = updateActionWithKeyPartner(script, 'u3', keyAction('key_up', 'x', 'u3'));
    expect(keys(edited)).toEqual(['d1:a:30', 'd2:b:null', 'u2:b:null', 'u1:a:30', 'd3:x:null', 'u3:x:null']);
  });

  it('leaves other actions alone when the key does not change', () => {
    const same = updateActionWithKeyPartner(script, 'd2', { ...script[1], delayBeforeMs: 500 });
    expect(same[1].delayBeforeMs).toBe(500);
    expect(keys(same)).toEqual(keys(script));
  });
});

describe('global hotkey warning', () => {
  it('warns for plain keys only', () => {
    expect(globalHotkeyWarning('1')).toContain('「1」会被全局占用');
    expect(globalHotkeyWarning('Space')).not.toBeNull();
    expect(globalHotkeyWarning('F8')).toBeNull();
    expect(globalHotkeyWarning('Ctrl+1')).toBeNull();
  });
});
