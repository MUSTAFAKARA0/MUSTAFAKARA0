'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Üyelik gerektirmeyen, tarayıcıda (localStorage) tutulan kimlik listesi.
 * Sekmeler arasında senkronizedir; sunucu render'ında boş liste döner
 * (hidrasyon uyumsuzluğu oluşmaz). Favoriler ve karşılaştırma listesi kullanır.
 */
export function createLocalListStore(key: string, max: number) {
  const EVENT = `${key}:change`;
  const EMPTY: string[] = [];
  let cachedRaw: string | null = null;
  let cachedList: string[] = EMPTY;

  function read(): string[] {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return EMPTY;
    }
    if (raw === cachedRaw) return cachedList;
    cachedRaw = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cachedList = Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, max)
        : EMPTY;
    } catch {
      cachedList = EMPTY;
    }
    return cachedList;
  }

  function write(list: string[]) {
    try {
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, max)));
    } catch {
      // Gizli sekme / kota dolu: liste bu oturumda kalıcı olmaz, uygulama çalışmaya devam eder.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  function subscribe(onChange: () => void) {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) onChange();
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }

  return function useLocalList() {
    const items = useSyncExternalStore(subscribe, read, () => EMPTY);
    const has = useCallback((id: string) => items.includes(id), [items]);
    /** Ekler/çıkarır; eklendiyse true, liste doluysa null döner. */
    const toggle = useCallback((id: string): boolean | null => {
      const current = read();
      if (current.includes(id)) {
        write(current.filter((x) => x !== id));
        return false;
      }
      if (current.length >= max) return null;
      write([id, ...current]);
      return true;
    }, []);
    const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);
    const clear = useCallback(() => write([]), []);
    return { items, has, toggle, remove, clear, max };
  };
}

export const useFavorites = createLocalListStore('eg:favorites', 200);
export const useCompare = createLocalListStore('eg:compare', 4);

const noopSubscribe = () => () => undefined;

/** İstemci hidrasyonu tamamlandı mı? (localStorage'a bağlı görünümler için) */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
