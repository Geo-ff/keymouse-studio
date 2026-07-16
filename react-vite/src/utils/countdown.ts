import type { AppSettings } from '../types';

/** Resolve app-level pre-run countdown to milliseconds. */
export function resolveCountdownMs(settings: AppSettings): number {
  if (!settings.countdownEnabled) return 0;
  const seconds = Math.max(0, Number(settings.countdownSeconds) || 0);
  return Math.round(seconds * 1000);
}