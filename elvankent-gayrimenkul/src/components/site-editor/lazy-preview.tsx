'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { LivePreview, type Brand, type ThemePreviewInput } from '@/theme-engine/preview/live-preview';

/**
 * Tembel önizleme: katalogdaki canlı önizlemeler aynı anda mount edilmez. Kart görünüme
 * yaklaşınca (200 px) mount edilir, ekrandan 2 ekran uzaklaşınca kaldırılır; aynı anda en fazla
 * MAX_LIVE önizleme yaşar (en eski kullanılan düşer). Yer tutucu sabit yüksekliktedir (yerleşim
 * kayması yok): palet bantları + başlık yazı tipi örneği. IntersectionObserver yoksa doğrudan mount.
 */
const MAX_LIVE = 18;
let live: string[] = [];
/** Şu anda görünüme yakın (kesişen) kartlar: bunlar ASLA düşürülmez */
const near = new Set<string>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
function touch(id: string) {
  if (live[0] === id) return;
  live = [id, ...live.filter((x) => x !== id)];
  // Sınır aşılırsa en eski ve görünümde OLMAYAN önizlemeler düşer
  for (let i = live.length - 1; i >= 0 && live.length > MAX_LIVE; i--) if (!near.has(live[i])) live.splice(i, 1);
  emit();
}
function drop(id: string) {
  if (!live.includes(id)) return;
  live = live.filter((x) => x !== id);
  emit();
}

export interface PreviewPlaceholder {
  swatch: string[];
  headingFont: string;
  headingFontId: string;
  name: string;
}

export function LazyPreview({
  id,
  config,
  brand,
  darkAllowed,
  name,
  label,
  placeholder,
}: {
  id: string;
  config: ThemePreviewInput;
  brand: Brand;
  darkAllowed: boolean;
  name: string;
  label: string;
  placeholder: PreviewPlaceholder;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(
    subscribe,
    () => live.includes(id),
    () => false,
  );
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      near.add(id);
      touch(id);
      return () => {
        near.delete(id);
        drop(id);
      };
    }
    const nearObs = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) {
          near.add(id);
          touch(id);
        } else near.delete(id);
      },
      { rootMargin: '200px 0px' },
    );
    const farObs = new IntersectionObserver(([e]) => e && !e.isIntersecting && drop(id), { rootMargin: '200% 0px' });
    nearObs.observe(el);
    farObs.observe(el);
    return () => {
      nearObs.disconnect();
      farObs.disconnect();
      near.delete(id);
      drop(id);
    };
  }, [id]);
  return (
    // Önizleme yalnızca görsel: ekran okuyucudan gizli ve etkileşimsiz (kartın kendi h3'ü yeterli; yinelenen başlık yok)
    <div ref={box} aria-hidden="true" inert className="relative h-72 overflow-hidden rounded-xl border border-border bg-surface-muted" data-preview-state={mounted ? 'live' : 'placeholder'}>
      {mounted ? (
        <div className="origin-top-left scale-[0.62] [width:161%]">
          <LivePreview config={config} brand={brand} darkAllowed={darkAllowed} name={name} variant="thumb" label={label} />
        </div>
      ) : (
        <div className="flex h-full flex-col" aria-hidden>
          <link rel="stylesheet" href={`/fonts/site/${placeholder.headingFontId}/preview.css`} precedence="default" />
          <div className="flex flex-1">
            {placeholder.swatch.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="border-t border-border bg-surface px-4 py-3">
            <span className="block text-[1.6rem] leading-none text-foreground" style={{ fontFamily: `"${placeholder.headingFont}", serif` }}>
              {placeholder.name}
            </span>
            <span className="mt-1 block text-[11.5px] text-muted-foreground">{placeholder.headingFont}</span>
          </div>
        </div>
      )}
    </div>
  );
}
