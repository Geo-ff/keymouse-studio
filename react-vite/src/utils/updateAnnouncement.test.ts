import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cacheReleaseNotes,
  decideWhatsNew,
  dismissUpdateBanner,
  getCachedReleaseNotes,
  getLegacyLastRunVersion,
  hasSeenUpdateAnnouncement,
  isUpdateBannerDismissed,
  markUpdateAnnouncementSeen,
} from './updateAnnouncement';
import type { ReleaseNote } from './releaseNotes';

function installMemoryStorage() {
  const map = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  });
}

const NOTES: ReleaseNote[] = [
  { version: '1.2.0', markdown: '- 1.2.0 notes' },
  { version: '1.1.0', markdown: '- 1.1.0 notes' },
  { version: '1.0.3', markdown: '- 1.0.3 notes' },
];

describe('before updating', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('tracks the announcement dialog per version', () => {
    expect(hasSeenUpdateAnnouncement('1.0.2')).toBe(false);
    markUpdateAnnouncementSeen('1.0.2');
    expect(hasSeenUpdateAnnouncement('1.0.2')).toBe(true);
    expect(hasSeenUpdateAnnouncement('1.0.3')).toBe(false);
  });

  it('closes the banner per version and stage', () => {
    dismissUpdateBanner('1.2.0', 'available');
    expect(isUpdateBannerDismissed('1.2.0', 'available')).toBe(true);
    // Once downloaded, the banner (with 「重启安装」) comes back.
    expect(isUpdateBannerDismissed('1.2.0', 'downloaded')).toBe(false);
    // A newer release shows again.
    expect(isUpdateBannerDismissed('1.3.0', 'available')).toBe(false);
    // Progress cannot be dismissed.
    dismissUpdateBanner('1.2.0', 'downloading');
    expect(isUpdateBannerDismissed('1.2.0', 'downloading')).toBe(false);
  });

  it('caches release notes by version', () => {
    cacheReleaseNotes('1.0.2', '  - fix  ');
    expect(getCachedReleaseNotes('1.0.2')).toBe('- fix');
  });

  it('reads the version older releases recorded', () => {
    expect(getLegacyLastRunVersion()).toBeNull();
    localStorage.setItem('kms:update:last-launched-version', '1.0.3');
    expect(getLegacyLastRunVersion()).toBe('1.0.3');
  });
});

describe('decideWhatsNew', () => {
  it('records a fresh install without showing anything', () => {
    expect(decideWhatsNew('1.1.0', null, { notes: NOTES })).toEqual({ show: false, record: true });
  });

  it('does nothing when the version did not change', () => {
    expect(decideWhatsNew('1.1.0', '1.1.0', { notes: NOTES })).toEqual({ show: false, record: false });
  });

  it('records a downgrade silently', () => {
    expect(decideWhatsNew('1.0.3', '1.1.0', { notes: NOTES })).toEqual({ show: false, record: true });
  });

  it('shows the new version after an update', () => {
    const decision = decideWhatsNew('1.1.0', '1.0.3', { notes: NOTES });
    expect(decision).toEqual({ show: true, previous: '1.0.3', notes: [NOTES[1]] });
  });

  it('includes skipped versions, newest first', () => {
    const decision = decideWhatsNew('1.2.0', '1.0.2', { notes: NOTES });
    expect(decision.show && decision.notes.map(note => note.version)).toEqual(['1.2.0', '1.1.0', '1.0.3']);
  });

  it('falls back to notes cached from the update check', () => {
    const decision = decideWhatsNew('1.3.0', '1.2.0', {
      notes: NOTES,
      cachedNotes: '<ul><li>cached</li></ul>',
    });
    expect(decision).toEqual({ show: true, previous: '1.2.0', notes: [{ version: '1.3.0', markdown: '- cached' }] });
  });

  it('still shows (with an empty list) when no notes are known', () => {
    expect(decideWhatsNew('1.3.0', '1.2.0', { notes: NOTES })).toEqual({ show: true, previous: '1.2.0', notes: [] });
  });
});
