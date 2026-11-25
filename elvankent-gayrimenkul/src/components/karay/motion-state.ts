/**
 * "Animasyonları durdur" tercihinin tek kaynağı (localStorage + bellek yedeği). Depolama kapalı ya da hata verirse
 * tercih yalnızca bu oturumda bellekte tutulur; okuyan herkes aynı değeri görür.
 */
export const MOTION_KEY = 'ky:motion';
export const MOTION_EVENT = 'ky:motion-change';

let memory: boolean | null = null;

export function readMotionOff(): boolean {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(MOTION_KEY) === 'off';
  } catch {
    return false;
  }
}

/** data-motion özniteliği hem <html> (kaydırma davranışı) hem .karay-site (animasyonlar) üzerinde durur */
export function applyMotion(off: boolean) {
  for (const el of [document.documentElement, document.querySelector('.karay-site')]) {
    if (!el) continue;
    if (off) el.setAttribute('data-motion', 'off');
    else el.removeAttribute('data-motion');
  }
}

export function writeMotionOff(off: boolean) {
  memory = off;
  try {
    localStorage.setItem(MOTION_KEY, off ? 'off' : 'on');
  } catch {
    /* depolama yok: bellek yedeği yeterli */
  }
  applyMotion(off);
  window.dispatchEvent(new Event(MOTION_EVENT));
}

export function subscribeMotion(cb: () => void) {
  window.addEventListener(MOTION_EVENT, cb);
  return () => window.removeEventListener(MOTION_EVENT, cb);
}
