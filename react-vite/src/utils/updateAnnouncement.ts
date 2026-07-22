const PREFIX = 'kms:update';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function keyAnnouncementSeen(version: string): string {
  return `${PREFIX}:announcement-seen:${version}`;
}

function keyWhatsNewSeen(version: string): string {
  return `${PREFIX}:whats-new-seen:${version}`;
}

function keyLastLaunched(): string {
  return `${PREFIX}:last-launched-version`;
}

function keyReleaseNotes(version: string): string {
  return `${PREFIX}:release-notes:${version}`;
}

export function hasSeenUpdateAnnouncement(version: string | null | undefined): boolean {
  if (!version) return true;
  const s = storage();
  if (!s) return false;
  return s.getItem(keyAnnouncementSeen(version)) === '1';
}

export function markUpdateAnnouncementSeen(version: string | null | undefined): void {
  if (!version) return;
  const s = storage();
  if (!s) return;
  s.setItem(keyAnnouncementSeen(version), '1');
}

export function cacheReleaseNotes(version: string | null | undefined, notes: string | null | undefined): void {
  if (!version || !notes?.trim()) return;
  const s = storage();
  if (!s) return;
  s.setItem(keyReleaseNotes(version), notes.trim());
}

export function getCachedReleaseNotes(version: string | null | undefined): string | null {
  if (!version) return null;
  const s = storage();
  if (!s) return null;
  return s.getItem(keyReleaseNotes(version));
}

export function hasSeenWhatsNew(version: string | null | undefined): boolean {
  if (!version) return true;
  const s = storage();
  if (!s) return false;
  return s.getItem(keyWhatsNewSeen(version)) === '1';
}

export function markWhatsNewSeen(version: string | null | undefined): void {
  if (!version) return;
  const s = storage();
  if (!s) return;
  s.setItem(keyWhatsNewSeen(version), '1');
}

export function getLastLaunchedVersion(): string | null {
  const s = storage();
  if (!s) return null;
  return s.getItem(keyLastLaunched());
}

export function setLastLaunchedVersion(version: string | null | undefined): void {
  if (!version) return;
  const s = storage();
  if (!s) return;
  s.setItem(keyLastLaunched(), version);
}

/**
 * After install: current version differs from last launched → show What's New once.
 * First install (no last launched) only records version without popup.
 */
export function shouldShowWhatsNew(currentVersion: string | null | undefined): {
  show: boolean;
  notes: string | null;
} {
  if (!currentVersion) return { show: false, notes: null };
  const last = getLastLaunchedVersion();
  if (!last) {
    setLastLaunchedVersion(currentVersion);
    markWhatsNewSeen(currentVersion);
    return { show: false, notes: null };
  }
  if (last === currentVersion) return { show: false, notes: null };
  if (hasSeenWhatsNew(currentVersion)) {
    setLastLaunchedVersion(currentVersion);
    return { show: false, notes: null };
  }
  const notes = getCachedReleaseNotes(currentVersion);
  return { show: true, notes };
}

export function completeWhatsNew(currentVersion: string | null | undefined): void {
  markWhatsNewSeen(currentVersion);
  setLastLaunchedVersion(currentVersion);
}

/** Lightweight markdown-ish → safe plain lines for UI (no HTML injection). */
export function formatReleaseNotesLines(notes: string | null | undefined): string[] {
  if (!notes?.trim()) return [];
  return notes
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+$/g, ''));
}