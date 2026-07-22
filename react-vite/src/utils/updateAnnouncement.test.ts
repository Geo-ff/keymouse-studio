import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cacheReleaseNotes,
  completeWhatsNew,
  formatReleaseNotesLines,
  getCachedReleaseNotes,
  hasSeenUpdateAnnouncement,
  markUpdateAnnouncementSeen,
  shouldShowWhatsNew,
} from './updateAnnouncement';

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

describe('updateAnnouncement storage', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('tracks announcement seen per version', () => {
    expect(hasSeenUpdateAnnouncement('1.0.2')).toBe(false);
    markUpdateAnnouncementSeen('1.0.2');
    expect(hasSeenUpdateAnnouncement('1.0.2')).toBe(true);
    expect(hasSeenUpdateAnnouncement('1.0.3')).toBe(false);
  });

  it('caches release notes by version', () => {
    cacheReleaseNotes('1.0.2', '  - fix  ');
    expect(getCachedReleaseNotes('1.0.2')).toBe('- fix');
  });

  it('does not show whats-new on first launch', () => {
    const result = shouldShowWhatsNew('1.0.0');
    expect(result.show).toBe(false);
  });

  it('shows whats-new after version bump with cached notes', () => {
    shouldShowWhatsNew('1.0.0');
    cacheReleaseNotes('1.0.1', '- keyboard clicker');
    const result = shouldShowWhatsNew('1.0.1');
    expect(result.show).toBe(true);
    expect(result.notes).toBe('- keyboard clicker');
    completeWhatsNew('1.0.1');
    expect(shouldShowWhatsNew('1.0.1').show).toBe(false);
  });
});

describe('formatReleaseNotesLines', () => {
  it('splits lines', () => {
    expect(formatReleaseNotesLines('a\nb\n')).toEqual(['a', 'b', '']);
  });
});
