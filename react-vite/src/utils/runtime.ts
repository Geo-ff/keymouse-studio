/** Mock mode is for local UI/dev only; packaged Electron always runs real. */
export function isMockModeAllowed(): boolean {
  // Vite dev (including Electron + KEYMOUSE_VITE_URL) may switch modes.
  if (import.meta.env.DEV) return true;
  // Pure browser without desktop bridge may use mock for demos.
  if (typeof window !== 'undefined' && !window.desktop) return true;
  return false;
}

export function resolveServiceMode(requested?: 'mock' | 'real'): 'mock' | 'real' {
  if (!isMockModeAllowed()) return 'real';
  return requested ?? 'real';
}