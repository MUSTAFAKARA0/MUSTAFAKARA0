/**
 * Programatik kaydırma davranışı: "hareketi azalt" tercihi veya sitenin hareket dili kapalıysa
 * (data-site-motion yok) anında; aksi halde yumuşak. Yalnızca tarayıcıda çağrılır.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto';
  return document.querySelector('[data-site-motion]') ? 'smooth' : 'auto';
}
