import { useEffect } from 'react';
import { matchesHotkey } from '../utils/hotkey';

export interface PageHotkeyBinding {
  hotkey: string;
  handler: () => void;
  enabled?: boolean;
}

export function usePageHotkeys(bindings: PageHotkeyBinding[]): void {
  useEffect(() => {
    const active = bindings.filter(item => item.hotkey.trim() && item.enabled !== false);
    if (active.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      for (const binding of active) {
        if (!matchesHotkey(event, binding.hotkey)) continue;
        event.preventDefault();
        binding.handler();
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bindings]);
}