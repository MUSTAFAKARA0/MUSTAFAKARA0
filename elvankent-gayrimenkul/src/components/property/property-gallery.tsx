'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ChevronLeft, ChevronRight, Images, ImageOff, X } from 'lucide-react';
import { imageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import type { PropertyImage } from '@/types/database';

type GalleryImage = Pick<PropertyImage, 'id' | 'storage_path' | 'width' | 'height' | 'blur_data_url' | 'alt'>;

interface GalleryProps {
  images: GalleryImage[];
  title: string;
  /** Galerinin üzerine yerleşen rozetler / butonlar */
  overlay?: React.ReactNode;
}

function altFor(img: GalleryImage, title: string, i: number) {
  return img.alt || `${title} – fotoğraf ${i + 1}`;
}

/** Yatay kaydırma (scroll-snap) konteynerindeki aktif slaytı izler */
function useSnapIndex(ref: React.RefObject<HTMLDivElement | null>) {
  const [index, setIndex] = useState(0);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, [ref]);
  const scrollTo = useCallback(
    (i: number, smooth = true) => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
    },
    [ref],
  );
  return { index, onScroll, scrollTo };
}

export function PropertyGallery({ images, title, overlay }: GalleryProps) {
  const [open, setOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const mobileRef = useRef<HTMLDivElement>(null);
  const mobile = useSnapIndex(mobileRef);

  const openAt = (i: number) => {
    setStartIndex(i);
    setOpen(true);
  };

  if (images.length === 0) {
    return (
      <div className="relative flex aspect-[16/9] items-center justify-center rounded-3xl bg-sand-100 text-sand-400 sm:aspect-[21/9]">
        <div className="text-center">
          <ImageOff className="mx-auto size-10" aria-hidden />
          <p className="mt-2 text-sm">Bu ilan için henüz fotoğraf eklenmemiş.</p>
        </div>
        {overlay}
      </div>
    );
  }

  // Mozaik 1, 2, 3 veya 5 karo ile dengeli görünür
  const tiles = images.slice(0, images.length >= 5 ? 5 : Math.min(images.length, 3));

  return (
    <>
      {/* Mobil: kaydırmalı tam genişlik galeri */}
      <div className="relative -mx-4 sm:mx-0 md:hidden">
        <div
          ref={mobileRef}
          onScroll={mobile.onScroll}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain sm:rounded-2xl"
          aria-label={`${title} fotoğrafları`}
          role="region"
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => openAt(i)}
              className="relative aspect-[4/3] w-full shrink-0 snap-center bg-sand-100"
              aria-label={`Fotoğraf ${i + 1} / ${images.length} – tam ekran aç`}
            >
              <Image
                src={imageUrl(img.storage_path)}
                alt={altFor(img, title, i)}
                fill
                // Masaüstünde gizli olduğundan orada yalnızca en küçük varyant seçilir
                sizes="(min-width: 768px) 1px, 100vw"
                preload={i === 0}
                loading={i === 0 ? 'eager' : 'lazy'}
                placeholder={img.blur_data_url ? 'blur' : 'empty'}
                blurDataURL={img.blur_data_url ?? undefined}
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
          {mobile.index + 1} / {images.length}
        </span>
        {overlay}
      </div>

      {/* Masaüstü: mozaik */}
      <div
        className={cn(
          'relative hidden h-[min(34rem,58vh)] min-h-[22rem] gap-2 overflow-hidden rounded-3xl md:grid',
          tiles.length === 1 && 'grid-cols-1',
          tiles.length === 2 && 'grid-cols-2',
          tiles.length === 3 && 'grid-cols-3 grid-rows-2',
          tiles.length >= 5 && 'grid-cols-4 grid-rows-2',
        )}
      >
        {tiles.map((img, i) => {
          const big = i === 0 && tiles.length >= 3;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => openAt(i)}
              className={cn(
                'group relative overflow-hidden bg-sand-100 focus-visible:outline-offset-[-3px]',
                big && 'col-span-2 row-span-2',
              )}
              aria-label={`Fotoğraf ${i + 1} – tam ekran aç`}
            >
              <Image
                src={imageUrl(img.storage_path)}
                alt={altFor(img, title, i)}
                fill
                // Mobilde gizli olduğundan orada yalnızca en küçük varyant seçilir
                sizes={big || tiles.length <= 2 ? '(max-width: 767px) 1px, (min-width: 1280px) 50vw, 66vw' : '(max-width: 767px) 1px, 25vw'}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                quality={i === 0 ? 85 : 75}
                placeholder={img.blur_data_url ? 'blur' : 'empty'}
                blurDataURL={img.blur_data_url ?? undefined}
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => openAt(0)}
          className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-ink shadow-card transition hover:bg-white"
        >
          <Images className="size-4" aria-hidden /> Tüm fotoğraflar ({images.length})
        </button>
        {overlay}
      </div>

      <Lightbox images={images} title={title} open={open} onOpenChange={setOpen} startIndex={startIndex} />
    </>
  );
}

function Lightbox({
  images,
  title,
  open,
  onOpenChange,
  startIndex,
}: {
  images: GalleryImage[];
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startIndex: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const { index, onScroll, scrollTo } = useSnapIndex(trackRef);

  // Açılışta seçilen fotoğrafa atla
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => scrollTo(startIndex, false));
    return () => cancelAnimationFrame(id);
  }, [open, startIndex, scrollTo]);

  // Aktif küçük resmi görünür tut
  useEffect(() => {
    const thumb = thumbsRef.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  const go = (delta: number) => scrollTo(Math.min(Math.max(index + delta, 0), images.length - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Home') {
      scrollTo(0);
    } else if (e.key === 'End') {
      scrollTo(images.length - 1);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b0f0e] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none data-[state=open]:animate-fade-in"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <DialogPrimitive.Title className="truncate text-sm font-semibold text-white/85">{title}</DialogPrimitive.Title>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70 tabular-nums" aria-live="polite">
                {index + 1} / {images.length}
              </span>
              <DialogPrimitive.Close
                className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
                aria-label="Galeriyi kapat"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={trackRef}
              onScroll={onScroll}
              className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto overscroll-contain"
            >
              {images.map((img, i) => (
                <div key={img.id} className="relative h-full w-full shrink-0 snap-center">
                  <Image
                    src={imageUrl(img.storage_path)}
                    alt={altFor(img, title, i)}
                    fill
                    sizes="100vw"
                    quality={85}
                    loading={Math.abs(i - startIndex) <= 1 ? 'eager' : 'lazy'}
                    className="object-contain"
                  />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={index === 0}
                  className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full bg-white/12 p-3 backdrop-blur transition hover:bg-white/25 disabled:opacity-30 sm:block"
                  aria-label="Önceki fotoğraf"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={index === images.length - 1}
                  className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full bg-white/12 p-3 backdrop-blur transition hover:bg-white/25 disabled:opacity-30 sm:block"
                  aria-label="Sonraki fotoğraf"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div
              ref={thumbsRef}
              className="scrollbar-none flex gap-2 overflow-x-auto px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-center"
            >
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Fotoğraf ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    'relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-16 sm:w-24',
                    i === index ? 'opacity-100 ring-accent-400' : 'opacity-55 ring-transparent hover:opacity-90',
                  )}
                >
                  <Image src={imageUrl(img.storage_path)} alt="" fill sizes="96px" quality={60} className="object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="sr-only">
            Sol ve sağ ok tuşlarıyla fotoğraflar arasında geçiş yapabilir, Esc ile kapatabilirsiniz.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
