import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings, type BackendSettings, type KeySpec } from '../types';
import { RealAutomationService } from '../services/AutomationService';
import { CLICKER_DEFAULTS, buildClickerConfig } from './clickerConfig';
import { collectReservedHotkeys, findHotkeyConflict, hotkeyFieldLabel, scriptHotkeyField } from './hotkey';

const SCRIPT_A = '00000000-0000-4000-8000-0000000000aa';

const withBindings: AppSettings = {
  ...DEFAULT_SETTINGS,
  recordStartHotkey: 'F9',
  clickerToggleHotkey: 'F8',
  scriptHotkeys: { [SCRIPT_A]: 'Ctrl+1' },
};

describe('reserved hotkeys', () => {
  it('lists fixed and per-script hotkeys and names the script on conflict', () => {
    const reserved = collectReservedHotkeys(withBindings);

    expect(reserved).toEqual({
      emergencyHotkey: 'F12',
      recordStartHotkey: 'F9',
      clickerToggleHotkey: 'F8',
      [scriptHotkeyField(SCRIPT_A)]: 'Ctrl+1',
    });
    const conflict = findHotkeyConflict('script:other', 'ctrl+1', reserved);
    expect(conflict).toBe(scriptHotkeyField(SCRIPT_A));
    expect(hotkeyFieldLabel(conflict!, [{ id: SCRIPT_A, name: '采集' }])).toBe('脚本「采集」的快捷键');
    expect(hotkeyFieldLabel('clickerToggleHotkey')).toBe('连点器开关');
  });
});

describe('clicker config from the saved form', () => {
  it('uses the form and lets a hotkey skip the countdown', () => {
    const result = buildClickerConfig({ ...CLICKER_DEFAULTS, clickMode: 'double', millis: 20 }, withBindings, {
      countdownMs: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      inputType: 'mouse',
      clickCount: 2,
      intervalMs: 50,
      countdownMs: 0,
      repeatMode: 'infinite',
      positionMode: 'current',
    });
    const withCountdown = buildClickerConfig(CLICKER_DEFAULTS, withBindings);
    expect(withCountdown.ok && withCountdown.config.countdownMs).toBe(3000);
  });

  it('explains why a keyboard clicker cannot start', () => {
    expect(buildClickerConfig({ ...CLICKER_DEFAULTS, inputType: 'keyboard' }, withBindings)).toEqual({
      ok: false,
      error: '请先捕获按键组合',
    });
    const ctrl1: KeySpec[] = [
      { keyCode: 'ctrl', scanCode: null, extended: false },
      { keyCode: '1', scanCode: null, extended: false },
    ];
    const conflict = buildClickerConfig({ ...CLICKER_DEFAULTS, inputType: 'keyboard', keys: ctrl1 }, withBindings);
    expect(conflict).toEqual({ ok: false, error: '按键组合不能与脚本快捷键相同' });
  });
});

describe('settings round trip with the backend', () => {
  it('sends and reads clicker and per-script hotkeys in backend form', async () => {
    const service = new RealAutomationService();
    let sent: BackendSettings | null = null;
    const stored: BackendSettings = {
      defaultSpeedMultiplier: 1,
      defaultLoopMode: 'count',
      defaultLoopCount: 1,
      defaultCountdownMs: 3000,
      emergencyStopHotkey: 'f12',
      recordStartHotkey: '',
      recordStopHotkey: '',
      playbackStartHotkey: '',
      playbackStopHotkey: '',
      clickerToggleHotkey: 'f8',
      scriptHotkeys: { [SCRIPT_A]: 'ctrl+page_up' },
    };
    Object.assign(service, {
      client: {
        get: async () => stored,
        post: async (_path: string, body: { hotkey: string }) => ({
          valid: true,
          normalizedHotkey: body.hotkey,
          availability: 'unavailable',
          reason: null,
        }),
        put: async (_path: string, body: BackendSettings) => {
          sent = body;
          return body;
        },
      },
    });

    const loaded = await service.getSettings();
    expect(loaded.clickerToggleHotkey).toBe('F8');
    expect(loaded.scriptHotkeys).toEqual({ [SCRIPT_A]: 'Ctrl+PageUp' });

    const updated = await service.updateSettings({ scriptHotkeys: { [SCRIPT_A]: 'Ctrl+PageUp', other: '' } });
    expect(sent!.scriptHotkeys).toEqual({ [SCRIPT_A]: 'ctrl+page_up' });
    expect(sent!.clickerToggleHotkey).toBe('f8');
    expect(updated.scriptHotkeys).toEqual({ [SCRIPT_A]: 'Ctrl+PageUp' });
  });
});

describe('playing script tracking', () => {
  it('records the script of every playback request and sends the scheduled start delay', async () => {
    const service = new RealAutomationService();
    let request: Record<string, unknown> | null = null;
    Object.assign(service, {
      client: {
        post: async (_path: string, body: Record<string, unknown>) => {
          request = body;
          throw new Error('offline');
        },
      },
    });
    const script = {
      schemaVersion: 1 as const,
      id: SCRIPT_A,
      name: ' 每日签到 ',
      description: '',
      createdAt: '2026-11-04T00:00:00Z',
      updatedAt: '2026-11-04T00:00:00Z',
      settings: { speedMultiplier: 1, loopMode: 'count' as const, loopCount: 1, countdownMs: 0 },
      actions: [],
    };

    await expect(
      service.playback(script, { times: 1, speedMultiplier: 1, loop: false, loopMode: 'count', countdownMs: 0, startDelayMs: 5000 }),
    ).rejects.toThrow('offline');

    expect((await service.getState()).playbackScript).toEqual({ id: SCRIPT_A, name: '每日签到' });
    expect(request).toMatchObject({ countdownMs: 0, startDelayMs: 5000 });
  });
});
