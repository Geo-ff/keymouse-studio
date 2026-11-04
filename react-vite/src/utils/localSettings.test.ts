import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { RealAutomationService } from '../services/AutomationService';
import { isLocalOnlyUpdate, loadLocalSettings, saveLocalSettings, withLocalSettings } from './localSettings';

let store: Record<string, string>;

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local settings', () => {
  it('survive a restart and keep backend settings untouched', () => {
    saveLocalSettings({ theme: 'dark', countdownSeconds: 9 });
    saveLocalSettings({ minRecordInterval: 20 });

    expect(loadLocalSettings()).toEqual({ theme: 'dark', minRecordInterval: 20 });
    expect(withLocalSettings(DEFAULT_SETTINGS)).toMatchObject({ theme: 'dark', minRecordInterval: 20, countdownSeconds: 3 });
  });

  it('ignore corrupt or out-of-range values', () => {
    store['keymouse.settings.local'] = JSON.stringify({ theme: 'neon', recordMouseMove: 'yes', minRecordInterval: 5 });
    expect(loadLocalSettings()).toEqual({});
    store['keymouse.settings.local'] = '{not json';
    expect(loadLocalSettings()).toEqual({});
  });

  it('knows which updates never need the backend', () => {
    expect(isLocalOnlyUpdate({ theme: 'dark' })).toBe(true);
    expect(isLocalOnlyUpdate({ theme: 'dark', countdownEnabled: false })).toBe(false);
    expect(isLocalOnlyUpdate({})).toBe(false);
  });

  it('are applied by the real service without a backend request', async () => {
    const put = vi.fn();
    const service = new RealAutomationService();
    Object.assign(service, { client: { put } });

    const next = await service.updateSettings({ theme: 'dark', recordMouseMove: false });

    expect(put).not.toHaveBeenCalled();
    expect(next).toMatchObject({ theme: 'dark', recordMouseMove: false });
    expect(loadLocalSettings()).toEqual({ theme: 'dark', recordMouseMove: false });
    // A fresh service (next launch) starts from the saved values.
    expect(await new RealAutomationService().updateSettings({ minRecordInterval: 30 })).toMatchObject({ theme: 'dark' });
  });
});
