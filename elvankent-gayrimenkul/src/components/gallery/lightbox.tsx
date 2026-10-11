'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { mediaSrcSet, mediaUrl } from '@/modules/media/variants';
import { cn } from '@/lib/utils';
import type { PropertyImage } from '@/modules/properties/types';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

function clampTransform(t: Transform, box: DOMRect | undefined): Transform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale));
  if (!box || scale === 1) return { scale, x: 0, y: 0 };
  const maxX = ((scale - 1) * box.width) / 2;
  const maxY = ((scale - 1) * box.height) / 2;
  return { scale, x: Math.min(maxX, Math.max(-maxX, t.x)), y: Math.min(maxY, Math.max(-maxY, t.y)) };
}

/**
 * Yakınlaştırılabilir görsel: çift tıklama/dokunma, fare tekerleği, iki parmak
 * (pinch) ile yakınlaştırma; yakınken sürükleyerek kaydırma. Yakınlaştırıldığında
 * `sizes` büyütülür → tarayıcı yüksek çözünürlüklü varyantı indirir (orijinal değil).
 */
function ZoomableImage({
  image,
  alt,
  active,
  onZoomChange,
  eager,
}: {
  image: PropertyImage;
  alt: string;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
  eager: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>(IDENTITY);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);

  const apply = useCallback(
    (next: Transform) => {
      const clamped = clampTransform(next, boxRef.current?.getBoundingClientRect());
      setT(clamped);
      onZoomChange(clamped.scale > 1);
    },
    [onZoomChange],
  );

  const zoomAt = (clientX: number, clientY: number, nextScale: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const cx = clientX - (box.left + box.width / 2);
    const cy = clientY - (box.top + box.height / 2);
    const ratio = nextScale / t.scale;
    apply({ scale: nextScale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (t.scale > 1) apply(IDENTITY);
    else zoomAt(e.clientX, e.clientY, 2.5);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!active) return;
    if (t.scale === 1 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // yatay kaydırma: slayt geçişi
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    zoomAt(e.clientX, e.clientY, next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: t.scale };
      drag.current = null;
    } else if (t.scale > 1) {
      drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    // Dokunmatikte çift dokunma
    if (e.pointerType === 'touch' && pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (t.scale > 1) apply(IDENTITY);
        else zoomAt(e.clientX, e.clientY, 2.5);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.current.scale * (dist / pinch.current.dist));
    } else if (drag.current && t.scale > 1) {
      apply({ scale: t.scale, x: drag.current.tx + (e.clientX - drag.current.x), y: drag.current.ty + (e.clientY - drag.current.y) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  const zoomed = t.scale > 1;
  return (
    <div
      ref={boxRef}
      className={cn('relative h-full w-full overflow-hidden', zoomed ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-zoom-in touch-pan-x')}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-zoom-controls={active ? '' : undefined}
      data-scale={t.scale}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- srcset varyantları elle yönetilir (yakınlaştırmada daha büyük varyant) */}
      <img
        src={mediaUrl(image, 2048)}
        srcSet={mediaSrcSet(image)}
        sizes={zoomed ? `${Math.round(t.scale * 100)}vw` : '100vw'}
        alt={alt}
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 m-auto h-full w-full object-contain transition-transform duration-150 ease-out select-none will-change-transform"
        style={{ transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})` }}
      />
    </div>
  );
}

const noop = () => () => undefined;

export function Lightbox({
  images,
  title,
  open,
  onOpenChange,
  startIndex,
}: {
  images: PropertyImage[];
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startIndex: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenSupported = useSyncExternalStore(noop, () => Boolean(document.fullscreenEnabled), () => false);

  const scrollTo = useCallback((i: number, smooth = true) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Açılışta seçilen fotoğrafa atla
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      scrollTo(startIndex, false);
      setIndex(startIndex);
    });
    return () => cancelAnimationFrame(id);
  }, [open, startIndex, scrollTo]);

  // Aktif küçük resmi görünür tut
  useEffect(() => {
    const thumb = thumbsRef.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) {
      setIndex(i);
      setZoomed(false);
    }
  };

  const go = (delta: number) => {
    const next = Math.min(Math.max(index + delta, 0), images.length - 1);
    setZoomed(false);
    scrollTo(next);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await contentRef.current?.requestFullscreen();
    } catch {
      // Tarayıcı izin vermedi; galeri zaten tam pencere
    }
  };

  const zoomActive = (factor: number) => {
    const box = trackRef.current?.children[index]?.querySelector<HTMLElement>('[data-zoom-controls]');
    if (!box) return;
    const r = box.getBoundingClientRect();
    box.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, deltaY: factor > 1 ? -100 : 100, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }),
    );
  };

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
    } else if (e.key === '+' || e.key === '=') {
      zoomActive(1.15);
    } else if (e.key === '-') {
      zoomActive(1 / 1.15);
    } else if (e.key.toLowerCase() === 'f' && fullscreenSupported) {
      void toggleFullscreen();
    }
  };

  const iconButton = 'rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 disabled:opacity-30';

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        onOpenChange(o);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0a0d0c] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          ref={contentRef}
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex flex-col bg-[#0a0d0c] text-white outline-none data-[state=open]:animate-fade-in"
          aria-describedby="lightbox-help"
        >
          <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-5">
            <DialogPrimitive.Title className="line-clamp-1 text-sm font-semibold text-white/85">{title}</DialogPrimitive.Title>
            <div className="flex shrink-0 items-center gap-2">
              <span className="numeric mr-1 text-sm text-white/70" aria-live="polite">
                {index + 1} / {images.length}
              </span>
              <button type="button" className={cn(iconButton, 'hidden sm:inline-flex')} onClick={() => zoomActive(1.4)} aria-label="Yakınlaştır">
                <ZoomIn className="size-5" />
              </button>
              <button type="button" className={cn(iconButton, 'hidden sm:inline-flex')} onClick={() => zoomActive(1 / 1.4)} disabled={!zoomed} aria-label="Uzaklaştır">
                <ZoomOut className="size-5" />
              </button>
              {fullscreenSupported && (
                <button type="button" className={iconButton} onClick={toggleFullscreen} aria-label={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}>
                  {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
                </button>
              )}
              <DialogPrimitive.Close className={iconButton} aria-label="Galeriyi kapat">
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={trackRef}
              onScroll={onScroll}
              className={cn(
                'scrollbar-none flex h-full snap-x snap-mandatory overscroll-contain',
                zoomed ? 'overflow-x-hidden' : 'overflow-x-auto',
              )}
            >
              {images.map((img, i) => (
                <div key={img.id} className="relative h-full w-full shrink-0 snap-center" aria-hidden={i !== index}>
                  {Math.abs(i - index) <= 2 && (
                    <ZoomableImage
                      // Aktif slayt değişince bileşen yeniden kurulur → yakınlaştırma sıfırlanır
                      key={`${img.id}-${i === index ? 'active' : 'idle'}`}
                      image={img}
                      alt={img.alt_text || `${title} – fotoğraf ${i + 1}`}
                      active={i === index}
                      onZoomChange={i === index ? setZoomed : () => undefined}
                      eager={Math.abs(i - index) <= 1}
                    />
                  )}
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={index === 0}
                  className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full bg-white/12 p-3 backdrop-blur transition hover:bg-white/25 disabled:opacity-25 sm:block"
                  aria-label="Önceki fotoğraf"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={index === images.length - 1}
                  className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full bg-white/12 p-3 backdrop-blur transition hover:bg-white/25 disabled:opacity-25 sm:block"
                  aria-label="Sonraki fotoğraf"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div ref={thumbsRef} className="scrollbar-none flex gap-2 overflow-x-auto px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-center">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setZoomed(false);
                    scrollTo(i);
                  }}
                  aria-label={`Fotoğraf ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    'relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-16 sm:w-24',
                    i === index ? 'opacity-100 ring-white' : 'opacity-50 ring-transparent hover:opacity-90',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- küçük resim varyantı (320 px) */}
                  <img src={mediaUrl(img, 320)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p id="lightbox-help" className="sr-only">
            Sol ve sağ ok tuşlarıyla fotoğraflar arasında geçebilir, artı ve eksi tuşlarıyla yakınlaştırabilir, F ile tam ekrana
            geçebilir, Esc ile kapatabilirsiniz. Dokunmatik ekranda kaydırarak geçiş yapabilir, iki parmakla veya çift dokunarak
            yakınlaştırabilirsiniz.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
