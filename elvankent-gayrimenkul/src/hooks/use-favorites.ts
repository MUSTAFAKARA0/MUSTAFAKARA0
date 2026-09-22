'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Üyelik gerektirmeyen favori sistemi: ilan ID'leri tarayıcının
 * localStorage'ında tutulur ve sekmeler arasında senkronize edilir.
 */
const KEY = 'eg:favorites';
const EVENT = 'eg:favorites-change';
const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 200) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Gizli sekme / kota: favori bu oturumda kalıcı olmaz, uygulama çalışmaya devam eder.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => EMPTY);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  /** Favori durumunu değiştirir; eklendiyse true döner. */
  const toggle = useCallback((id: string): boolean => {
    const current = read();
    const exists = current.includes(id);
    write(exists ? current.filter((x) => x !== id) : [id, ...current]);
    return !exists;
  }, []);

  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);
  const clear = useCallback(() => write([]), []);

  return { favorites, isFavorite, toggle, remove, clear };
}
