import type { AppSettings, EditorLoopMode, PlaybackOptions, Script } from '../types';
import { resolveCountdownMs } from './countdown';

export interface EditorPlaybackFields {
  loopMode: EditorLoopMode;
  loopCount: number;
  loopDurationMin: number;
  loopDurationSec: number;
  speedMultiplier: number;
}

export function buildPlaybackOptionsFromEditor(
  fields: EditorPlaybackFields,
  appSettings: AppSettings,
): PlaybackOptions {
  const { loopMode, loopCount, loopDurationMin, loopDurationSec, speedMultiplier } = fields;
  return {
    times: loopMode === 'count' ? Math.max(1, loopCount) : 1,
    speedMultiplier,
    loop: loopMode === 'infinite',
    loopMode,
    loopDurationMs:
      loopMode === 'duration' ? (loopDurationMin * 60 + loopDurationSec) * 1000 : undefined,
    countdownMs: resolveCountdownMs(appSettings),
  };
}

/** Fallback when editor is not mounted: use persisted script settings (no duration mode). */
export function buildPlaybackOptionsFromScript(
  script: Script,
  appSettings: AppSettings,
): PlaybackOptions {
  const loopMode: EditorLoopMode =
    script.settings.loopMode === 'infinite' ? 'infinite' : 'count';
  return buildPlaybackOptionsFromEditor(
    {
      loopMode,
      loopCount: script.settings.loopCount,
      loopDurationMin: 1,
      loopDurationSec: 0,
      speedMultiplier: script.settings.speedMultiplier,
    },
    appSettings,
  );
}