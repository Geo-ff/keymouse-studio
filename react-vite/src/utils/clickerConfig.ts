import type { AppSettings, ClickerConfig, ClickerInputType, ClickMode, KeySpec, MouseButton } from '../types';
import { resolveCountdownMs } from './countdown';
import { readPersistedForm } from './formPersistence';
import { collectReservedHotkeys, hotkeyFieldLabel } from './hotkey';
import { findControlHotkeyConflict } from './keySpec';

/** Auto clicker page form; persisted so the global toggle hotkey reuses the last settings. */
export interface ClickerFormState {
  inputType: ClickerInputType;
  button: MouseButton;
  clickMode: ClickMode;
  hours: number;
  minutes: number;
  seconds: number;
  millis: number;
  timesMode: 'fixed' | 'continuous';
  times: number;
  useCurrentPos: boolean;
  posX: number;
  posY: number;
  keys: KeySpec[];
  pressDurationMs: number;
}

export const CLICKER_FORM_KEY = 'clicker';

/** How long each mouse click keeps the button down (sent as pressDurationMs for mouse mode). */
export const MOUSE_PRESS_MS = 30;

export const CLICKER_DEFAULTS: ClickerFormState = {
  inputType: 'mouse',
  button: 'left',
  clickMode: 'single',
  hours: 0,
  minutes: 0,
  seconds: 0,
  millis: 500,
  timesMode: 'continuous',
  times: 10,
  useCurrentPos: true,
  posX: 960,
  posY: 540,
  keys: [],
  pressDurationMs: 30,
};

export function readClickerForm(): ClickerFormState {
  return readPersistedForm(CLICKER_FORM_KEY, CLICKER_DEFAULTS);
}

export function clickerIntervalMs(form: ClickerFormState): number {
  return form.hours * 3600000 + form.minutes * 60000 + form.seconds * 1000 + form.millis;
}

export type ClickerConfigResult = { ok: true; config: ClickerConfig } | { ok: false; error: string };

interface BuildOptions {
  /** Override the app countdown (hotkey starts run immediately). */
  countdownMs?: number;
}

/** Validate the clicker form and turn it into a backend config. */
export function buildClickerConfig(
  form: ClickerFormState,
  settings: AppSettings,
  options: BuildOptions = {},
): ClickerConfigResult {
  const isKeyboard = form.inputType === 'keyboard';
  if (isKeyboard) {
    if (!form.keys.length) return { ok: false, error: '请先捕获按键组合' };
    const conflict = findControlHotkeyConflict(form.keys, collectReservedHotkeys(settings));
    if (conflict) return { ok: false, error: `按键组合不能与${hotkeyFieldLabel(conflict)}相同` };
    if (form.pressDurationMs < 10 || form.pressDurationMs > 60000) {
      return { ok: false, error: '按下时长需在 10～60000 ms' };
    }
  }
  const intervalMs = Math.max(50, clickerIntervalMs(form));
  const countdownMs = options.countdownMs ?? resolveCountdownMs(settings);
  const repeat = {
    repeatMode: form.timesMode === 'continuous' ? ('infinite' as const) : ('count' as const),
    repeatCount: form.timesMode === 'continuous' ? 1 : form.times,
  };
  if (isKeyboard) {
    return {
      ok: true,
      config: {
        inputType: 'keyboard',
        button: 'left',
        clickCount: 1,
        intervalMs,
        ...repeat,
        positionMode: 'current',
        x: null,
        y: null,
        countdownMs,
        keys: form.keys,
        pressDurationMs: Math.max(10, Math.min(60000, form.pressDurationMs)),
      },
    };
  }
  return {
    ok: true,
    config: {
      inputType: 'mouse',
      button: form.button,
      clickCount: form.clickMode === 'double' ? 2 : 1,
      intervalMs,
      ...repeat,
      positionMode: form.useCurrentPos ? 'current' : 'fixed',
      x: form.useCurrentPos ? null : form.posX,
      y: form.useCurrentPos ? null : form.posY,
      countdownMs,
      keys: [],
      pressDurationMs: MOUSE_PRESS_MS,
    },
  };
}
