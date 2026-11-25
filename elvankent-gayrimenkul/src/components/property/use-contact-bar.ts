'use client';

import { useEffect, useState } from 'react';

/**
 * Yapışkan iletişim çubukları için görünürlük kuralları.
 *  - iletişim kutusu (watchId) görünümdeyse çubuk gizlenir (aynı eylem iki kez sunulmaz);
 *  - `afterScroll`: sayfa belirli ölçüde kaydırılmadan görünmez (masaüstü çubuğu; yukarıda ilan başlığı ve galeri öncelikli);
 *  - alt bilgi görünürken gizlenir (yasal bağlantıların üstünü örtmez).
 * Çubuk görünürken <html data-su-bar> + --su-bar-h yazılır: CSS scroll-padding-bottom ile odaklanan
 * alan/düğme hiçbir zaman çubuğun altında kalmaz (WCAG 2.4.11).
 */
export function useContactBar(watchId: string, afterScroll: boolean) {
  const [boxInView, setBoxInView] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [footerInView, setFooterInView] = useState(false);

  useEffect(() => {
    const box = document.getElementById(watchId);
    const footer = document.querySelector('footer');
    const observers: IntersectionObserver[] = [];
    if (box) {
      const o = new IntersectionObserver(([e]) => setBoxInView(e.isIntersecting));
      o.observe(box);
      observers.push(o);
    }
    if (footer) {
      // Yalnızca alt bilgi çubuk bölgesine (alttan ~96 px) girince: çubuk yasal bağlantıları örtmez
      const o = new IntersectionObserver(([e]) => setFooterInView(e.isIntersecting), { rootMargin: '0px 0px -96px 0px' });
      o.observe(footer);
      observers.push(o);
    }
    const onScroll = () => setScrolled(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener('scroll', onScroll);
    };
  }, [watchId]);

  return !boxInView && !footerInView && (!afterScroll || scrolled);
}

/** Çubuk görünürken sayfa kaydırma payını çubuk yüksekliği kadar artırır */
export function useBarScrollPadding(active: boolean, height: string) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.suBar = '';
    root.style.setProperty('--su-bar-h', height);
    return () => {
      delete root.dataset.suBar;
      root.style.removeProperty('--su-bar-h');
    };
  }, [active, height]);
}
