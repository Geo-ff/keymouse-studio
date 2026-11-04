import type { AppSettings } from '../types';

/**
 * Settings that only the UI uses. The backend settings file does not store them, so they are
 * kept in this machine's local storage to survive restarts.
 */
export const LOCAL_SETTING_KEYS = ['theme', 'recordMouseMove', 'minRecordInterval'] as const;
type LocalSettingKey = (typeof LOCAL_SETTING_KEYS)[number];
export type LocalSettings = Pick<AppSettings, LocalSettingKey>;

const STORAGE_KEY = 'keymouse.settings.local';
const LOCAL_KEYS = new Set<string>(LOCAL_SETTING_KEYS);

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Saved local settings; invalid or missing values are left out. */
export function loadLocalSettings(): Partial<LocalSettings> {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Partial<LocalSettings> = {};
    if (parsed.theme === 'light' || parsed.theme === 'dark') result.theme = parsed.theme;
    if (typeof parsed.recordMouseMove === 'boolean') result.recordMouseMove = parsed.recordMouseMove;
    const interval = parsed.minRecordInterval;
    if (typeof interval === 'number' && Number.isFinite(interval) && interval >= 10 && interval <= 1000) {
      result.minRecordInterval = Math.round(interval);
    }
    return result;
  } catch {
    return {};
  }
}

export function withLocalSettings<T extends AppSettings>(settings: T): T {
  return { ...settings, ...loadLocalSettings() };
}

/** Persist the local keys present in `updates` (merged with what is already saved). */
export function saveLocalSettings(updates: Partial<AppSettings>): void {
  const picked = Object.fromEntries(Object.entries(updates).filter(([key]) => LOCAL_KEYS.has(key)));
  if (Object.keys(picked).length === 0) return;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify({ ...loadLocalSettings(), ...picked }));
  } catch {
    // Private mode / quota: the setting still applies for this session.
  }
}

/** True when an update touches nothing the backend stores. */
export function isLocalOnlyUpdate(updates: Partial<AppSettings>): boolean {
  const keys = Object.keys(updates);
  return keys.length > 0 && keys.every(key => LOCAL_KEYS.has(key));
}
