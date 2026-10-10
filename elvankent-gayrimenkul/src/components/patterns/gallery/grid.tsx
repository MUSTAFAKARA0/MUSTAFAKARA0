'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Images } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { GalleryPatternProps } from '@/components/patterns/contracts';
import { cn } from '@/lib/utils';

// Tam ekran galeri (mevcut bileşen) yalnızca ilk açılışta yüklenir
const Lightbox = dynamic(() => import('@/components/gallery/lightbox').then((m) => m.Lightbox), { ssr: false });

const MARKER = 'karay-pattern:gallery/grid';
const VISIBLE = 6;

/**
 * Galeri deseni · grid: eşit karolu, numaralı (01, 02…) düzenli ızgara (mobilde 2, geniş ekranda 3 sütun). İlk altı fotoğraf
 * gösterilir; fazlası son karoda "+N" olarak tam ekran galeriye açılır. Yalnızca bu deseni seçen
 * sitenin tarayıcısına iner (patterns/gallery/islands.tsx).
 */
export default function GridGallery({ images, title }: GalleryPatternProps) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [start, setStart] = useState(0);
  const openAt = (i: number) => {
    setStart(i);
    setOpened(true);
    setOpen(true);
  };
  const tiles = images.slice(0, VISIBLE);
  const hidden = images.length - tiles.length;

  return (
    <div data-pattern={MARKER} className="kp-gallery-grid relative">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={`${title} fotoğrafları`}>
        {tiles.map((img, i) => {
          const last = i === tiles.length - 1 && hidden > 0;
          return (
            <li key={img.id} className={cn(i === 0 && tiles.length % 2 === 1 && 'col-span-2 sm:col-span-1')}>
              <button
                type="button"
                onClick={() => openAt(i)}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-muted focus-visible:outline-offset-[-3px]"
                aria-label={last ? `Tüm fotoğrafları gör (+${hidden})` : `Fotoğraf ${i + 1} / ${images.length} – tam ekran aç`}
              >
                <MediaImage
                  media={img}
                  alt={img.alt_text || `${title} – fotoğraf ${i + 1}`}
                  fill
                  sizes="(min-width: 1312px) 420px, (min-width: 640px) 33vw, 50vw"
                  loading={i < 2 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : undefined}
                  className="object-cover transition duration-700 ease-premium group-hover:scale-[1.03]"
                />
                <span className="numeric pointer-events-none absolute top-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11.5px] font-semibold text-white" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {last && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                    <span className="numeric font-display text-[2rem] leading-none">+{hidden}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {images.length > 1 && (
        <button
          type="button"
          onClick={() => openAt(0)}
          className="absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-white"
        >
          <Images className="size-4" aria-hidden />
          Tüm fotoğraflar ({images.length})
        </button>
      )}
      {(open || opened) && <Lightbox images={images} title={title} open={open} onOpenChange={setOpen} startIndex={start} />}
    </div>
  );
}
