'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';
import { Expand, ImageOff, Images } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import { cn } from '@/lib/utils';
import type { PropertyImage } from '@/modules/properties/types';

// Tam ekran galeri (yakınlaştırma, kaydırma) yalnızca ilk açılışta yüklenir: ilk
// yüklemede indirilen/çalıştırılan JavaScript azalır (mobil LCP / INP)
const Lightbox = dynamic(() => import('@/components/gallery/lightbox').then((m) => m.Lightbox), { ssr: false });

function altFor(img: PropertyImage, title: string, i: number) {
  return img.alt_text || `${title} – fotoğraf ${i + 1}`;
}

/**
 * İlan galerisi. Masaüstünde ilk fotoğraf büyük "kahraman" karo, yanında dört
 * karo; daha fazla fotoğraf varsa son karoda "+12 fotoğraf". Mobilde tam
 * genişlik kaydırmalı galeri. Tıklanınca yakınlaştırılabilir tam ekran galeri.
 */
export function PropertyGallery({ images, title, overlay }: { images: PropertyImage[]; title: string; overlay?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Bir kez açıldıktan sonra bileşen yerinde kalır (kapanış animasyonu ve hızlı yeniden açılış)
  const [opened, setOpened] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const mobileRef = useRef<HTMLDivElement>(null);

  const openAt = useCallback((i: number) => {
    setStartIndex(i);
    setOpened(true);
    setOpen(true);
  }, []);

  if (images.length === 0) {
    return (
      <div className="relative flex aspect-[16/9] items-center justify-center rounded-[1.5rem] bg-surface-muted text-muted-foreground sm:aspect-[21/9]">
        <div className="text-center">
          <ImageOff className="mx-auto size-10" aria-hidden />
          <p className="mt-2 text-sm">Bu ilan için henüz fotoğraf eklenmemiş.</p>
        </div>
        {overlay}
      </div>
    );
  }

  const tiles = images.slice(0, images.length >= 5 ? 5 : Math.min(images.length, 3));
  const hidden = images.length - tiles.length;

  return (
    <>
      {/* Mobil: kaydırmalı galeri */}
      <div className="relative -mx-4 sm:mx-0 md:hidden">
        <div
          ref={mobileRef}
          onScroll={() => {
            const el = mobileRef.current;
            if (el?.clientWidth) setMobileIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain sm:rounded-2xl"
          aria-label={`${title} fotoğrafları`}
          role="region"
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => openAt(i)}
              className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface-muted"
              aria-label={`Fotoğraf ${i + 1} / ${images.length} – tam ekran aç`}
            >
              {Math.abs(i - mobileIndex) <= 2 && (
                <MediaImage
                  media={img}
                  alt={altFor(img, title, i)}
                  fill
                  // Masaüstünde gizli: orada en küçük varyant seçilir
                  sizes="(min-width: 768px) 1px, 100vw"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : undefined}
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
        <span className="numeric pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
          {mobileIndex + 1} / {images.length}
        </span>
        {overlay}
      </div>

      {/* Masaüstü: mozaik */}
      <div
        className={cn(
          'relative hidden h-[min(36rem,62vh)] min-h-[24rem] gap-2 overflow-hidden rounded-[1.5rem] md:grid',
          tiles.length === 1 && 'grid-cols-1',
          tiles.length === 2 && 'grid-cols-2',
          tiles.length === 3 && 'grid-cols-3 grid-rows-2',
          tiles.length >= 5 && 'grid-cols-4 grid-rows-2',
        )}
      >
        {tiles.map((img, i) => {
          const hero = i === 0 && tiles.length >= 3;
          const last = i === tiles.length - 1 && hidden > 0;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => openAt(i)}
              className={cn('group relative overflow-hidden bg-surface-muted focus-visible:outline-offset-[-3px]', hero && 'col-span-2 row-span-2')}
              aria-label={last ? `Tüm fotoğrafları gör (+${hidden})` : `Fotoğraf ${i + 1} – tam ekran aç`}
            >
              <MediaImage
                media={img}
                alt={altFor(img, title, i)}
                fill
                sizes={hero || tiles.length <= 2 ? '(max-width: 767px) 1px, (min-width: 1312px) 640px, 50vw' : '(max-width: 767px) 1px, (min-width: 1312px) 320px, 25vw'}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                className="object-cover transition duration-700 ease-premium group-hover:scale-[1.03]"
              />
              {last && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white transition group-hover:bg-black/55">
                  <span className="text-center">
                    <span className="numeric block font-display text-[2rem] leading-none">+{hidden}</span>
                    <span className="mt-1 block text-sm font-semibold">fotoğraf</span>
                  </span>
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => openAt(0)}
          className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-white"
        >
          {images.length > 1 ? <Images className="size-4" aria-hidden /> : <Expand className="size-4" aria-hidden />}
          {images.length > 1 ? `Tüm fotoğraflar (${images.length})` : 'Büyüt'}
        </button>
        {overlay}
      </div>

      {(open || opened) && <Lightbox images={images} title={title} open={open} onOpenChange={setOpen} startIndex={startIndex} />}
    </>
  );
}
