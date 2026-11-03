import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { actionDuration, createAction } from '../data/mockData';
import { buildRecordingConfig, readRecordingPrefs } from './recordingConfig';

function stubStorage(values: Record<string, string>) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values[key] ?? null,
    setItem: () => undefined,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('recording config', () => {
  it('passes the chosen mouse move mode and control hotkeys to the backend', () => {
    const config = buildRecordingConfig(
      { ...DEFAULT_SETTINGS, recordStartHotkey: 'F9', minRecordInterval: 20 },
      { mouseMoveMode: 'relative' },
    );

    expect(config.mouseMoveMode).toBe('relative');
    expect(config.minMoveSampleMs).toBe(20);
    expect(config.controlHotkeys).toEqual(['F12', 'F9']);

    const withBindings = buildRecordingConfig(
      { ...DEFAULT_SETTINGS, clickerToggleHotkey: 'F6', scriptHotkeys: { abc: 'Ctrl+1' } },
      { mouseMoveMode: 'absolute' },
    );
    expect(withBindings.controlHotkeys).toEqual(['F12', 'F6', 'Ctrl+1']);
  });

  it('reads the mode saved by the recording page for global hotkeys', () => {
    stubStorage({ 'keymouse.form.recording': JSON.stringify({ mouseMoveMode: 'relative' }) });

    expect(buildRecordingConfig(DEFAULT_SETTINGS).mouseMoveMode).toBe('relative');
  });

  it('falls back to screen coordinates for missing or unknown values', () => {
    expect(readRecordingPrefs().mouseMoveMode).toBe('absolute');

    stubStorage({ 'keymouse.form.recording': JSON.stringify({ mouseMoveMode: 'bogus' }) });
    expect(readRecordingPrefs().mouseMoveMode).toBe('absolute');
  });
});

describe('relative move action', () => {
  it('counts its spread duration in the script duration', () => {
    const action = createAction('mouse_move_relative', 50);

    expect(action.type).toBe('mouse_move_relative');
    expect(actionDuration(action)).toBe(250);
  });
});
