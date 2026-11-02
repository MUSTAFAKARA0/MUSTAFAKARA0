'use client';

import { getImageProps } from 'next/image';
import { useEffect, useRef, useState } from 'react';
import karoStill from '@/platform/branding/assets/karo/KARO-durus.png';
import karoAnimated from '@/platform/branding/assets/karo/KARO-hareketli.webp';
import { cn } from '@/lib/utils';

/** Hazır animasyonun bir döngüsü: 90 kare, ≈3 sn (el sallama + göz kırpma; 04_KARO_ANIMASYON/atlas.json) */
const LOOP_MS = 3000;
/** Animasyon (4,2 MB) bu genişlikten itibaren oynatılır; dar ekranlarda sabit poz kalır */
const MOTION_MEDIA = '(min-width: 768px)';

/**
 * KARO: KARAYS'ın ana maskotu (02_ANA_MASKOT_KARO).
 *
 * Sunucu çiziminde ve "hareketi azalt" tercihinde animasyonla eşleşen sabit poz görünür (KARO-durus.png,
 * 384 × 512; next/image ekrana uygun boyutta sunar). Hareket serbest, ekran geniş ve KARO görünür
 * olduğunda, sayfa yüklendikten sonra hazır animasyon (KARO-hareketli.webp) aynı öğeye istenir, bir kez
 * oynar ve sabit poza döner: hareket 5 saniyeyi geçmez (WCAG 2.2.2), ana içeriği ve LCP'yi geciktirmez.
 * Tercih sonradan "hareketi azalt" olursa animasyon hemen durur. Kutu boyutu baştan bellidir (sayfa kayması
 * yok); kaynak 384 × 512 olduğundan 2x ekranda 192 px genişliğe kadar keskindir. Ekran genişliğiyle boyu
 * değişen yerleşimde `sizes` CSS genişliklerini bildirir. Görsel dekoratiftir (alt="").
 */
export function KaroMascot({
  width,
  sizes = `${width}px`,
  className,
  loading = 'lazy',
}: {
  width: number;
  sizes?: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}) {
  const ref = useRef<HTMLImageElement>(null);
  // still → loading (hareketli dosya istendi) → animated (bir döngü) → still; yeniden başlamaz
  const [phase, setPhase] = useState<'still' | 'loading' | 'animated'>('still');
  const height = Math.round((width * karoStill.height) / karoStill.width);
  const { props: still } = getImageProps({ src: karoStill, alt: '', width, height, sizes, loading });

  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!el || reduce.matches || saveData || !window.matchMedia(MOTION_MEDIA).matches) return;
    const play = () => {
      if (!reduce.matches) setPhase('loading');
    };
    // Gizli (display: none) veya ekran dışındaki KARO için indirilmez
    const visible = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        visible.disconnect();
        if (document.readyState === 'complete') play();
        else window.addEventListener('load', play, { once: true });
      },
      { threshold: 0.5 },
    );
    visible.observe(el);
    const onPreference = () => {
      if (reduce.matches) setPhase('still');
    };
    reduce.addEventListener('change', onPreference);
    return () => {
      visible.disconnect();
      window.removeEventListener('load', play);
      reduce.removeEventListener('change', onPreference);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'animated') return;
    const timer = window.setTimeout(() => setPhase('still'), LOOP_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Hareketli dosya ayrı bir Image ile önceden yüklenmez: önbelleğin 4,2 MB'lık dosyayı tutacağına güvenilemez
  // ve ikinci kez indirilirdi. Aynı öğeye istenir; tarayıcı yeni kaynak yüklenene kadar sabit pozu gösterir.
  // Döngü süresi, hareketli kare gerçekten görününce (load) başlar.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sabit poz getImageProps ile boyutlanır; hareketli WebP olduğu gibi sunulur (iyileştirici animasyonu korumaz)
    <img
      {...still}
      {...(phase === 'still' ? {} : { src: karoAnimated.src, srcSet: undefined })}
      ref={ref}
      alt=""
      onLoad={phase === 'loading' ? () => setPhase('animated') : undefined}
      onError={phase === 'loading' ? () => setPhase('still') : undefined}
      data-platform-brand="karo"
      data-karo={phase}
      fetchPriority="low"
      className={cn('pointer-events-none select-none', className)}
    />
  );
}
