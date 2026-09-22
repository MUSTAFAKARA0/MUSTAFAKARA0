'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, ArrowLeft, ArrowRight, GripVertical, ImagePlus, Loader2, RotateCcw, Star, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { deleteImage, reorderImages, setCoverImage } from '@/app/actions/admin-properties';
import { prepareImageForUpload, uploadPropertyImage, UPLOAD_ERROR, validateImageFile } from '@/lib/client-image';
import { IMAGE_LIMITS } from '@/lib/constants';
import { imageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import type { PropertyImage } from '@/types/database';

/* ----------------------------------------------------------------------------
 * Ortak parçalar
 * ------------------------------------------------------------------------- */

function DropZone({ onFiles, disabled, remaining }: { onFiles: (files: File[]) => void; disabled?: boolean; remaining: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
        over ? 'border-brand-500 bg-brand-50' : 'border-sand-300 bg-sand-50',
        disabled && 'opacity-60',
      )}
    >
      <UploadCloud className="size-10 text-brand-600" aria-hidden />
      <p className="mt-3 font-semibold text-ink">Fotoğrafları buraya sürükleyip bırakın</p>
      <p className="mt-1 text-sm text-sand-600">veya bilgisayarınızdan / telefonunuzdan seçin</p>
      <Button type="button" variant="outline" className="mt-4" disabled={disabled || remaining <= 0} onClick={() => inputRef.current?.click()}>
        <ImagePlus /> Fotoğraf seç
      </Button>
      <p className="mt-3 text-xs text-sand-500">
        JPG, PNG veya WebP · Büyük fotoğraflar otomatik küçültülür · En fazla {IMAGE_LIMITS.maxImagesPerProperty} fotoğraf
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Fotoğraf seç"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}

interface TileProps {
  id: string;
  src: string;
  index: number;
  total: number;
  isCover: boolean;
  busy?: boolean;
  progress?: number;
  error?: string;
  onCover?: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
  onRetry?: () => void;
  unoptimized?: boolean;
}

function SortableTile({ id, src, index, total, isCover, busy, progress, error, onCover, onDelete, onMove, onRetry, unoptimized }: TileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: busy });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative overflow-hidden rounded-xl bg-surface ring-1 ring-line',
        isDragging && 'z-10 shadow-lift ring-brand-400',
        isCover && 'ring-2 ring-accent-400',
      )}
    >
      <div className="relative aspect-[4/3] bg-sand-100">
        <Image src={src} alt={`Fotoğraf ${index + 1}`} fill sizes="(min-width: 1024px) 220px, 45vw" className="object-cover" unoptimized={unoptimized} />
        {isCover && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-brand-950">
            <Star className="size-3 fill-current" aria-hidden /> Kapak
          </span>
        )}
        <span className="absolute top-2 right-2 rounded-md bg-black/55 px-1.5 text-[11px] font-bold text-white">{index + 1}</span>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Fotoğraf ${index + 1} sırasını sürükleyerek değiştir`}
          className="absolute right-2 bottom-2 cursor-grab touch-none rounded-lg bg-white/90 p-1.5 text-sand-700 shadow active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        {progress !== undefined && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-white">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            <span className="text-sm font-bold tabular-nums">%{progress}</span>
            <div className="h-1.5 w-3/4 overflow-hidden rounded-full bg-white/30" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/75 p-3 text-center text-white">
            <AlertCircle className="size-5" aria-hidden />
            <span className="text-xs leading-snug">{error}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 p-1.5">
        <div className="flex gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy || index === 0} onClick={() => onMove(-1)} aria-label="Sola taşı">
            <ArrowLeft />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy || index === total - 1} onClick={() => onMove(1)} aria-label="Sağa taşı">
            <ArrowRight />
          </Button>
        </div>
        <div className="flex gap-0.5">
          {error && onRetry && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onRetry} aria-label="Tekrar dene">
              <RotateCcw />
            </Button>
          )}
          {onCover && !isCover && !error && (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={busy} onClick={onCover}>
              <Star /> Kapak yap
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy && !error} onClick={onDelete} aria-label="Fotoğrafı sil" className="text-danger hover:bg-red-50">
            {error ? <X /> : <Trash2 />}
          </Button>
        </div>
      </div>
    </li>
  );
}

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function pickValidFiles(files: File[], remaining: number): File[] {
  const valid: File[] = [];
  for (const f of files) {
    const err = validateImageFile(f);
    if (err) toast.error(err);
    else valid.push(f);
  }
  if (valid.length > remaining) {
    toast.warning(`En fazla ${IMAGE_LIMITS.maxImagesPerProperty} fotoğraf eklenebilir; ${valid.length - remaining} fotoğraf eklenmedi.`);
  }
  return valid.slice(0, Math.max(0, remaining));
}

/* ----------------------------------------------------------------------------
 * Kayıtlı ilan: fotoğraflar anında yüklenir ve sunucuda sıralanır
 * ------------------------------------------------------------------------- */

interface UploadItem {
  key: string;
  file: File;
  preview: string;
  progress: number;
  error?: string;
}

export function ImageManager({ propertyId, initialImages }: { propertyId: string; initialImages: PropertyImage[] }) {
  const [images, setImages] = useState<PropertyImage[]>(initialImages);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [toDelete, setToDelete] = useState<PropertyImage | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useDndSensors();
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => () => uploads.forEach((u) => URL.revokeObjectURL(u.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const runUpload = useCallback(
    (item: UploadItem) => {
      // Sıralı yükleme: fotoğraflar seçim sırasına göre eklenir
      queueRef.current = queueRef.current.then(async () => {
        try {
          const blob = await prepareImageForUpload(item.file);
          const image = await uploadPropertyImage(propertyId, blob, item.file.name, (progress) =>
            setUploads((list) => list.map((u) => (u.key === item.key ? { ...u, progress } : u))),
          );
          setImages((list) => [...list, image]);
          setUploads((list) => list.filter((u) => u.key !== item.key));
          URL.revokeObjectURL(item.preview);
        } catch (e) {
          const message = e instanceof Error ? e.message : UPLOAD_ERROR;
          setUploads((list) => list.map((u) => (u.key === item.key ? { ...u, error: message } : u)));
          toast.error(message);
        }
      });
    },
    [propertyId],
  );

  const addFiles = (files: File[]) => {
    const valid = pickValidFiles(files, IMAGE_LIMITS.maxImagesPerProperty - images.length - uploads.length);
    const items = valid.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));
    setUploads((list) => [...list, ...items]);
    items.forEach(runUpload);
  };

  const persistOrder = (next: PropertyImage[]) => {
    const previous = images;
    setImages(next);
    startTransition(async () => {
      const res = await reorderImages(propertyId, next.map((i) => i.id));
      if (!res.ok) {
        setImages(previous);
        toast.error(res.error);
      }
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = images.findIndex((i) => i.id === e.active.id);
    const to = images.findIndex((i) => i.id === e.over!.id);
    if (from < 0 || to < 0) return;
    persistOrder(arrayMove(images, from, to));
  };

  const makeCover = (img: PropertyImage) => {
    const previous = images;
    setImages(images.map((i) => ({ ...i, is_cover: i.id === img.id })));
    startTransition(async () => {
      const res = await setCoverImage(propertyId, img.id);
      if (res.ok) toast.success('Kapak fotoğrafı güncellendi');
      else {
        setImages(previous);
        toast.error(res.error);
      }
    });
  };

  const confirmDelete = () => {
    const img = toDelete;
    if (!img) return;
    startTransition(async () => {
      const res = await deleteImage(propertyId, img.id);
      if (res.ok) {
        setImages((list) => {
          const rest = list.filter((i) => i.id !== img.id);
          return img.is_cover && rest.length ? rest.map((i, idx) => ({ ...i, is_cover: idx === 0 })) : rest;
        });
        toast.success('Fotoğraf silindi');
        setToDelete(null);
      } else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-5">
      <DropZone onFiles={addFiles} remaining={IMAGE_LIMITS.maxImagesPerProperty - images.length - uploads.length} />
      {images.length === 0 && uploads.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Bu ilanda henüz fotoğraf yok. Fotoğraflı ilanlar çok daha fazla ilgi görür.
        </p>
      ) : (
        <>
          <p className="text-sm text-sand-600">
            Sıralamayı değiştirmek için fotoğrafları sürükleyin veya ok butonlarını kullanın. İlk sıradaki değil,{' '}
            <strong>“Kapak”</strong> işaretli fotoğraf ilan kartında gösterilir.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((img, index) => (
                  <SortableTile
                    key={img.id}
                    id={img.id}
                    src={imageUrl(img.storage_path)}
                    index={index}
                    total={images.length}
                    isCover={img.is_cover}
                    busy={pending}
                    onCover={() => makeCover(img)}
                    onDelete={() => setToDelete(img)}
                    onMove={(delta) => persistOrder(arrayMove(images, index, index + delta))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {uploads.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Yüklenen fotoğraflar">
              {uploads.map((u) => (
                <li key={u.key} className="relative overflow-hidden rounded-xl ring-1 ring-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.preview} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-white', u.error ? 'bg-red-950/75' : 'bg-black/45')}>
                    {u.error ? (
                      <>
                        <span className="text-xs leading-snug">{u.error}</span>
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              const retry = { ...u, error: undefined, progress: 0 };
                              setUploads((list) => list.map((x) => (x.key === u.key ? retry : x)));
                              runUpload(retry);
                            }}
                          >
                            <RotateCcw /> Tekrar dene
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-white hover:bg-white/15"
                            aria-label="Kaldır"
                            onClick={() => {
                              URL.revokeObjectURL(u.preview);
                              setUploads((list) => list.filter((x) => x.key !== u.key));
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Loader2 className="size-6 animate-spin" aria-hidden />
                        <span className="text-sm font-bold tabular-nums">{u.progress < 100 ? `%${u.progress}` : 'İşleniyor…'}</span>
                        <div className="h-1.5 w-3/4 overflow-hidden rounded-full bg-white/30" role="progressbar" aria-label="Yükleme ilerlemesi" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-accent-400 transition-all" style={{ width: `${u.progress}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent title="Fotoğraf silinsin mi?" description="Bu fotoğraf ilandan kalıcı olarak kaldırılacak.">
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Vazgeç</Button>
            </DialogClose>
            <Button variant="danger" loading={pending} onClick={confirmDelete}>
              <Trash2 /> Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Yeni ilan: fotoğraflar ilan kaydedilene kadar tarayıcıda bekler
 * ------------------------------------------------------------------------- */

export interface PendingImage {
  key: string;
  file: File;
  preview: string;
  error?: string;
  progress?: number;
}

export function PendingImagePicker({
  items,
  onChange,
  uploading,
}: {
  items: PendingImage[];
  onChange: (items: PendingImage[]) => void;
  uploading: boolean;
}) {
  const sensors = useDndSensors();
  const add = (files: File[]) => {
    const valid = pickValidFiles(files, IMAGE_LIMITS.maxImagesPerProperty - items.length);
    onChange([
      ...items,
      ...valid.map((file) => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, preview: URL.createObjectURL(file) })),
    ]);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.key === e.active.id);
    const to = items.findIndex((i) => i.key === e.over!.id);
    onChange(arrayMove(items, from, to));
  };
  return (
    <div className="space-y-5">
      <DropZone onFiles={add} disabled={uploading} remaining={IMAGE_LIMITS.maxImagesPerProperty - items.length} />
      {items.length > 0 && (
        <>
          <p className="text-sm text-sand-600">
            İlk fotoğraf <strong>kapak</strong> olur. Fotoğraflar “Kaydet” butonuna bastığınızda yüklenecek; sıralamayı sürükleyerek
            değiştirebilirsiniz.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.key)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item, index) => (
                  <SortableTile
                    key={item.key}
                    id={item.key}
                    src={item.preview}
                    unoptimized
                    index={index}
                    total={items.length}
                    isCover={index === 0}
                    busy={uploading}
                    progress={item.progress}
                    error={item.error}
                    onDelete={() => {
                      URL.revokeObjectURL(item.preview);
                      onChange(items.filter((i) => i.key !== item.key));
                    }}
                    onMove={(delta) => onChange(arrayMove(items, index, index + delta))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
