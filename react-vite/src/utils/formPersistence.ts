import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const PREFIX = 'keymouse.form.';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function usePersistedFormState<T extends object>(
  key: string,
  defaults: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readStorage(key, defaults));

  useEffect(() => {
    writeStorage(key, state);
  }, [key, state]);

  return [state, setState];
}