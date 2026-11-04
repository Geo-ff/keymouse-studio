/**
 * When update notes are shown:
 * - Before updating: the 「发现新版本」 dialog opens once per version; the banner can be closed per
 *   version (it comes back when the download finishes); the 「关于」 page always shows the notes.
 * - After updating: the first launch of a newer version shows what changed since the version that
 *   ran before, once. The last run version lives in the desktop prefs file (main process); older
 *   releases kept it in localStorage, which is still read as a fallback.
 */

import {
  BUNDLED_RELEASE_NOTES,
  compareVersions,
  normalizeNotes,
  notesSince,
  type ReleaseNote,
} from './releaseNotes';

const PREFIX = 'kms:update';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Storage full or blocked: worst case the prompt shows again.
  }
}

/* --- Before updating --- */

export function hasSeenUpdateAnnouncement(version: string | null | undefined): boolean {
  if (!version) return true;
  return read(`${PREFIX}:announcement-seen:${version}`) === '1';
}

export function markUpdateAnnouncementSeen(version: string | null | undefined): void {
  if (version) write(`${PREFIX}:announcement-seen:${version}`, '1');
}

/** The banner is closed per version and per stage: 「发现新版本」 and 「已下载」 are separate. */
type BannerStage = 'available' | 'downloaded';

function bannerStage(status: string | null | undefined): BannerStage | null {
  if (status === 'available') return 'available';
  if (status === 'downloaded') return 'downloaded';
  return null;
}

export function isUpdateBannerDismissed(version: string | null | undefined, status: string | null | undefined): boolean {
  const stage = bannerStage(status);
  if (!version || !stage) return false;
  return read(`${PREFIX}:banner-dismissed:${version}:${stage}`) === '1';
}

export function dismissUpdateBanner(version: string | null | undefined, status: string | null | undefined): void {
  const stage = bannerStage(status);
  if (version && stage) write(`${PREFIX}:banner-dismissed:${version}:${stage}`, '1');
}

/** Notes seen in an update check, kept in case this version's bundled notes are missing. */
export function cacheReleaseNotes(version: string | null | undefined, notes: string | null | undefined): void {
  if (version && notes?.trim()) write(`${PREFIX}:release-notes:${version}`, notes.trim());
}

export function getCachedReleaseNotes(version: string | null | undefined): string | null {
  return version ? read(`${PREFIX}:release-notes:${version}`) : null;
}

/* --- After updating --- */

/** Version recorded by releases up to 1.0.3 (they tracked it in localStorage). */
export function getLegacyLastRunVersion(): string | null {
  return read(`${PREFIX}:last-launched-version`);
}

export type WhatsNewDecision =
  /** Nothing to show. `record`: save the current version as the last run one now. */
  | { show: false; record: boolean }
  /** Show `notes` (newest first; may be empty) and record the version once it is closed. */
  | { show: true; previous: string; notes: ReleaseNote[] };

/**
 * Decide whether this launch shows 「本次更新内容」.
 * - No previous version (fresh install): record silently.
 * - Same version: nothing to do.
 * - Older version than before (downgrade): record silently.
 * - Newer version: show every version's notes since the previous one, so skipped versions are
 *   not missed. Falls back to notes cached from the update check when none are bundled.
 */
export function decideWhatsNew(
  current: string,
  lastRun: string | null | undefined,
  options: { notes?: ReleaseNote[]; cachedNotes?: string | null } = {},
): WhatsNewDecision {
  if (!lastRun) return { show: false, record: true };
  const diff = compareVersions(current, lastRun);
  if (diff === 0) return { show: false, record: false };
  if (diff < 0) return { show: false, record: true };
  const notes = notesSince(lastRun, current, options.notes ?? BUNDLED_RELEASE_NOTES);
  if (!notes.length) {
    const cached = normalizeNotes(options.cachedNotes);
    if (cached) notes.push({ version: current, markdown: cached });
  }
  return { show: true, previous: lastRun, notes };
}
