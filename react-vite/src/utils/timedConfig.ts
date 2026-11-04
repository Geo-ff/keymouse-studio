import type { AppSettings, KeySpec, MouseButton, TimedClickConfig } from '../types';
import { collectReservedHotkeys, hotkeyFieldLabel } from './hotkey';
import { findControlHotkeyConflict } from './keySpec';
import { MOUSE_PRESS_MS } from './clickerConfig';

export const DAY_MS = 86_400_000;

export type TimedTimingMode = 'delay' | 'at';
export type TimedContent = 'mouse' | 'keyboard' | 'script';

/** Timed page form, persisted between sessions. */
export interface TimedFormState {
  timingMode: TimedTimingMode;
  /** "delay" mode: wait this long. */
  hours: number;
  minutes: number;
  seconds: number;
  /** "at" mode: local clock time. */
  atHour: number;
  atMinute: number;
  atSecond: number;
  /** delay: repeat every wait; at: repeat every day. Not available for scripts. */
  loop: boolean;
  content: TimedContent;
  button: MouseButton;
  useCurrentPos: boolean;
  posX: number;
  posY: number;
  keys: KeySpec[];
  scriptId: string;
  /** ISO time the running task was scheduled for (shown while it waits). */
  scheduledAt: string | null;
}

export const TIMED_FORM_KEY = 'timed';

export const TIMED_DEFAULTS: TimedFormState = {
  timingMode: 'delay',
  hours: 0,
  minutes: 30,
  seconds: 0,
  atHour: 8,
  atMinute: 0,
  atSecond: 0,
  loop: false,
  content: 'mouse',
  button: 'left',
  useCurrentPos: true,
  posX: 960,
  posY: 540,
  keys: [],
  scriptId: '',
  scheduledAt: null,
};

/** The next time the clock reads hh:mm:ss: today if still ahead, otherwise tomorrow. */
export function nextOccurrence(now: Date, hour: number, minute: number, second: number): Date {
  const target = new Date(now);
  target.setHours(hour, minute, second, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

export interface TimedSchedule {
  delayMs: number;
  /** Wall-clock time of the first run. */
  runAt: Date;
}

export function timedSchedule(form: TimedFormState, now: Date): TimedSchedule {
  if (form.timingMode === 'at') {
    const runAt = nextOccurrence(now, form.atHour, form.atMinute, form.atSecond);
    return { delayMs: Math.min(DAY_MS, runAt.getTime() - now.getTime()), runAt };
  }
  const delayMs = Math.max(1000, form.hours * 3600000 + form.minutes * 60000 + form.seconds * 1000);
  return { delayMs, runAt: new Date(now.getTime() + delayMs) };
}

/** "今天 08:00:00" / "明天 08:00:00" / full date further out. */
export function formatRunAt(runAt: Date, now: Date): string {
  const time = runAt.toLocaleTimeString('zh-CN', { hour12: false });
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(runAt) - startOfDay(now)) / DAY_MS);
  if (days === 0) return `今天 ${time}`;
  if (days === 1) return `明天 ${time}`;
  return `${runAt.toLocaleDateString('zh-CN')} ${time}`;
}

export type TimedClickResult =
  | { ok: true; config: TimedClickConfig; schedule: TimedSchedule }
  | { ok: false; error: string };

/**
 * Build the backend config for a timed click or key press. Timed tasks never use the pre-run
 * countdown: the wait itself already gives time to switch windows, and at a set clock time a
 * countdown would only make the run late.
 */
export function buildTimedClickConfig(form: TimedFormState, settings: AppSettings, now: Date): TimedClickResult {
  if (form.content === 'script') return { ok: false, error: '运行脚本请使用回放' };
  const schedule = timedSchedule(form, now);
  // Repeat with the same rhythm: every wait, or every day at the set time.
  const intervalMs = form.timingMode === 'at' ? DAY_MS : Math.max(50, schedule.delayMs);
  const common = {
    delayMs: schedule.delayMs,
    clickCount: 1 as const,
    intervalMs,
    repeatMode: form.loop ? ('infinite' as const) : ('count' as const),
    repeatCount: 1,
    countdownMs: 0,
  };
  if (form.content === 'keyboard') {
    if (!form.keys.length) return { ok: false, error: '请先设置要按下的按键' };
    const conflict = findControlHotkeyConflict(form.keys, collectReservedHotkeys(settings));
    if (conflict) return { ok: false, error: `按键不能与${hotkeyFieldLabel(conflict)}相同` };
    return {
      ok: true,
      schedule,
      config: {
        ...common,
        inputType: 'keyboard',
        button: 'left',
        positionMode: 'current',
        x: null,
        y: null,
        keys: form.keys,
        pressDurationMs: MOUSE_PRESS_MS,
      },
    };
  }
  return {
    ok: true,
    schedule,
    config: {
      ...common,
      inputType: 'mouse',
      button: form.button,
      positionMode: form.useCurrentPos ? 'current' : 'fixed',
      x: form.useCurrentPos ? null : form.posX,
      y: form.useCurrentPos ? null : form.posY,
      keys: [],
      pressDurationMs: MOUSE_PRESS_MS,
    },
  };
}
