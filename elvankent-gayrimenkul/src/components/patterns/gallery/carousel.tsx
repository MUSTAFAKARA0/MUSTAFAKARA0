'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { GalleryPatternProps } from '@/components/patterns/contracts';
import { cn } from '@/lib/utils';

// Tam ekran galeri (mevcut bileşen) yalnızca ilk açılışta yüklenir
const Lightbox = dynamic(() => import('@/components/gallery/lightbox').then((m) => m.Lightbox), { ssr: false });

const MARKER = 'karay-pattern:gallery/carousel';

/**
 * Galeri deseni · carousel: tek büyük fotoğraf (kaydırılabilir), önceki/sonraki düğmeleri ve
 * altta küçük resim şeridi. Yalnızca görünen ve komşu fotoğraflar yüklenir. Yalnızca bu deseni
 * seçen sitenin tarayıcısına iner (patterns/gallery/islands.tsx).
 */
export default function CarouselGallery({ images, title }: GalleryPatternProps) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const many = images.length > 1;

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = (i + images.length) % images.length;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    setIndex(next);
  };

  return (
    <div data-pattern={MARKER}>
      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={track}
          onScroll={() => {
            const el = track.current;
            if (el?.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain kp-carousel-track"
          role="region"
          aria-roledescription="carousel"
          aria-label={`${title} fotoğrafları`}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setOpened(true);
                setOpen(true);
              }}
              className="kp-carousel-slide relative w-full shrink-0 snap-center bg-surface-muted"
              aria-label={`Fotoğraf ${i + 1} / ${images.length} – tam ekran aç`}
            >
              {Math.abs(i - index) <= 1 && (
                <MediaImage
                  media={img}
                  alt={img.alt_text || `${title} – fotoğraf ${i + 1}`}
                  fill
                  sizes="(min-width: 1312px) 1280px, 100vw"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : undefined}
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
        {many && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition hover:bg-white"
              aria-label="Önceki fotoğraf"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition hover:bg-white"
              aria-label="Sonraki fotoğraf"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
        <span className="numeric pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white" aria-live="polite">
          <Expand className="size-3.5" aria-hidden />
          {index + 1} / {images.length}
        </span>
      </div>
      {many && (
        <ul className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Küçük resimler">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Fotoğraf ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={cn('relative block h-16 w-24 overflow-hidden rounded-lg bg-surface-muted ring-2 transition', i === index ? 'ring-foreground' : 'ring-transparent opacity-70 hover:opacity-100')}
              >
                <MediaImage media={img} alt="" fill sizes="96px" loading="lazy" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(open || opened) && <Lightbox images={images} title={title} open={open} onOpenChange={setOpen} startIndex={index} />}
    </div>
  );
}
