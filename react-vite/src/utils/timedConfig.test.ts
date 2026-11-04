import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { DAY_MS, TIMED_DEFAULTS, buildTimedClickConfig, formatRunAt, nextOccurrence, timedSchedule } from './timedConfig';

const at = (text: string) => new Date(text);

describe('clock-time scheduling', () => {
  it('runs today when the time is still ahead, otherwise tomorrow', () => {
    const now = at('2026-11-04T07:59:30');
    expect(nextOccurrence(now, 8, 0, 0)).toEqual(at('2026-11-04T08:00:00'));
    expect(nextOccurrence(at('2026-11-04T08:00:00'), 8, 0, 0)).toEqual(at('2026-11-05T08:00:00'));
    expect(nextOccurrence(at('2026-11-04T23:00:00'), 0, 0, 5)).toEqual(at('2026-11-05T00:00:05'));
  });

  it('computes the wait and labels the day', () => {
    const now = at('2026-11-04T07:59:30');
    const schedule = timedSchedule({ ...TIMED_DEFAULTS, timingMode: 'at', atHour: 8, atMinute: 0, atSecond: 0 }, now);
    expect(schedule.delayMs).toBe(30_000);
    expect(formatRunAt(schedule.runAt, now)).toBe('今天 08:00:00');
    expect(formatRunAt(at('2026-11-05T06:30:00'), now)).toBe('明天 06:30:00');
  });

  it('keeps the existing minimum wait for "delay" mode', () => {
    const schedule = timedSchedule({ ...TIMED_DEFAULTS, hours: 0, minutes: 0, seconds: 0 }, at('2026-11-04T10:00:00'));
    expect(schedule.delayMs).toBe(1000);
  });
});

describe('timed click / key config', () => {
  const now = at('2026-11-04T07:00:00');

  it('repeats daily at a clock time and never uses the pre-run countdown', () => {
    const result = buildTimedClickConfig(
      { ...TIMED_DEFAULTS, timingMode: 'at', atHour: 8, atMinute: 0, atSecond: 0, loop: true },
      DEFAULT_SETTINGS,
      now,
    );
    expect(result.ok && result.config).toMatchObject({
      delayMs: 3_600_000,
      intervalMs: DAY_MS,
      repeatMode: 'infinite',
      countdownMs: 0,
      inputType: 'mouse',
    });
  });

  it('presses a key combination', () => {
    const keys = [
      { keyCode: 'ctrl_l', scanCode: null, extended: false },
      { keyCode: 's', scanCode: null, extended: false },
    ];
    const result = buildTimedClickConfig({ ...TIMED_DEFAULTS, content: 'keyboard', keys }, DEFAULT_SETTINGS, now);
    expect(result.ok && result.config).toMatchObject({ inputType: 'keyboard', keys, repeatMode: 'count', intervalMs: 1_800_000 });
  });

  it('explains missing or conflicting keys', () => {
    expect(buildTimedClickConfig({ ...TIMED_DEFAULTS, content: 'keyboard' }, DEFAULT_SETTINGS, now)).toEqual({
      ok: false,
      error: '请先设置要按下的按键',
    });
    const f12 = [{ keyCode: 'f12', scanCode: null, extended: false }];
    expect(buildTimedClickConfig({ ...TIMED_DEFAULTS, content: 'keyboard', keys: f12 }, DEFAULT_SETTINGS, now)).toEqual({
      ok: false,
      error: '按键不能与急停热键相同',
    });
  });
});
