'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Images } from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import type { GalleryPatternProps } from '@/components/patterns/contracts';

// Tam ekran galeri (mevcut bileşen) yalnızca ilk açılışta yüklenir
const Lightbox = dynamic(() => import('@/components/gallery/lightbox').then((m) => m.Lightbox), { ssr: false });

const MARKER = 'karay-pattern:gallery/fullscreen';
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Galeri deseni · fullscreen: kenardan kenara sinematik sahne. Tek büyük fotoğraf, ince oklar,
 * editoryal sayaç ("03 / 12") ve tek bir "Tüm fotoğraflar" çağrısı; küçük resim şeridi yok
 * (az ama etkili arayüz). Ebeveyninin tam genişliğini kullanır: tam genişlik, onu çağıran ilan
 * detayı düzenindedir. Yalnızca bu deseni seçen sitenin tarayıcısına iner (gallery/islands.tsx).
 */
export default function FullscreenGallery({ images, title }: GalleryPatternProps) {
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
  const openAt = () => {
    setOpened(true);
    setOpen(true);
  };

  return (
    <div data-pattern={MARKER} className="kp-gallery-fullscreen relative text-white">
      <div
        ref={track}
        onScroll={() => {
          const el = track.current;
          if (el?.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} fotoğrafları`}
      >
        {images.map((img, i) => (
          <button key={img.id} type="button" onClick={openAt} className="kp-stage relative w-full shrink-0 snap-center" aria-label={`Fotoğraf ${i + 1} / ${images.length} – tam ekran aç`}>
            {Math.abs(i - index) <= 1 && (
              <MediaImage
                media={img}
                alt={img.alt_text || `${title} – fotoğraf ${i + 1}`}
                fill
                sizes="100vw"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                className="object-cover"
              />
            )}
          </button>
        ))}
      </div>
      <div className="kp-stage-bar pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-5 pt-16 pb-5 sm:px-10">
        <p className="numeric font-display text-[1.6rem] leading-none tracking-tight" aria-live="polite">
          {pad(index + 1)}
          <span className="text-white/50"> / {pad(images.length)}</span>
        </p>
        <div className="kp-events flex items-center gap-2">
          {many && (
            <>
              <button type="button" onClick={() => go(index - 1)} className="kp-arrow" aria-label="Önceki fotoğraf">
                <ArrowLeft className="size-5" aria-hidden />
              </button>
              <button type="button" onClick={() => go(index + 1)} className="kp-arrow" aria-label="Sonraki fotoğraf">
                <ArrowRight className="size-5" aria-hidden />
              </button>
            </>
          )}
          <button type="button" onClick={openAt} className="kp-arrow kp-arrow-wide">
            <Images className="size-4" aria-hidden />
            <span className="hidden sm:inline">Tüm fotoğraflar</span>
          </button>
        </div>
      </div>
      {(open || opened) && <Lightbox images={images} title={title} open={open} onOpenChange={setOpen} startIndex={index} />}
    </div>
  );
}
