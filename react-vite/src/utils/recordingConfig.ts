import type { AppSettings, MouseMoveMode, RecordingConfig } from '../types';
import { readPersistedForm } from './formPersistence';

/** Persisted choices made on the Recording page (shared with the global record hotkey). */
export interface RecordingPrefs {
  mouseMoveMode: MouseMoveMode;
}

export const RECORDING_PREFS_KEY = 'recording';
export const RECORDING_PREFS_DEFAULTS: RecordingPrefs = { mouseMoveMode: 'absolute' };

export function readRecordingPrefs(): RecordingPrefs {
  const prefs = readPersistedForm(RECORDING_PREFS_KEY, RECORDING_PREFS_DEFAULTS);
  return {
    mouseMoveMode: prefs.mouseMoveMode === 'relative' ? 'relative' : 'absolute',
  };
}

export function buildRecordingConfig(
  settings: AppSettings,
  prefs: RecordingPrefs = readRecordingPrefs(),
): RecordingConfig {
  return {
    recordMouseMove: settings.recordMouseMove,
    mouseMoveMode: prefs.mouseMoveMode,
    minMoveSampleMs: settings.minRecordInterval,
    moveErrorPx: 2,
    recordWheel: true,
    recordMouse: true,
    recordKeyboard: true,
    controlHotkeys: [
      settings.emergencyHotkey,
      settings.recordStartHotkey,
      settings.recordStopHotkey,
      settings.playbackStartHotkey,
      settings.playbackStopHotkey,
    ].filter(Boolean),
  };
}
