import { describe, expect, it } from 'vitest';
import type { AppSettings, Script } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import {
  buildPlaybackOptionsFromEditor,
  buildPlaybackOptionsFromScript,
} from './playbackOptions';

const appSettings: AppSettings = {
  ...DEFAULT_SETTINGS,
  countdownEnabled: true,
  countdownSeconds: 3,
};

describe('buildPlaybackOptionsFromEditor', () => {
  it('maps infinite loop for hotkey and button playback', () => {
    const options = buildPlaybackOptionsFromEditor(
      {
        loopMode: 'infinite',
        loopCount: 5,
        loopDurationMin: 1,
        loopDurationSec: 0,
        speedMultiplier: 2,
      },
      appSettings,
    );
    expect(options.loopMode).toBe('infinite');
    expect(options.loop).toBe(true);
    expect(options.times).toBe(1);
    expect(options.speedMultiplier).toBe(2);
    expect(options.countdownMs).toBe(3000);
  });

  it('maps fixed count', () => {
    const options = buildPlaybackOptionsFromEditor(
      {
        loopMode: 'count',
        loopCount: 7,
        loopDurationMin: 0,
        loopDurationSec: 0,
        speedMultiplier: 1,
      },
      appSettings,
    );
    expect(options.loopMode).toBe('count');
    expect(options.times).toBe(7);
    expect(options.loop).toBe(false);
  });

  it('maps duration mode with loopDurationMs', () => {
    const options = buildPlaybackOptionsFromEditor(
      {
        loopMode: 'duration',
        loopCount: 1,
        loopDurationMin: 1,
        loopDurationSec: 30,
        speedMultiplier: 1,
      },
      appSettings,
    );
    expect(options.loopMode).toBe('duration');
    expect(options.loopDurationMs).toBe(90000);
  });
});

describe('buildPlaybackOptionsFromScript', () => {
  it('uses script.settings loopMode for global hotkey fallback', () => {
    const script = {
      settings: {
        speedMultiplier: 1.5,
        loopMode: 'infinite',
        loopCount: 1,
        countdownMs: 0,
      },
    } as Script;
    const options = buildPlaybackOptionsFromScript(script, appSettings);
    expect(options.loopMode).toBe('infinite');
    expect(options.loop).toBe(true);
    expect(options.speedMultiplier).toBe(1.5);
  });
});