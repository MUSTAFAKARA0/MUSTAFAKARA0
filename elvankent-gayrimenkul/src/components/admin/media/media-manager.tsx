'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MoreVertical,
  Pencil,
  RefreshCw,
  Replace,
  RotateCcw,
  RotateCw,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { MediaImage } from '@/components/common/media-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, Input } from '@/components/ui/form-controls';
import { Progress } from '@/components/ui/progress';
import {
  cancelMediaUpload,
  createMediaUpload,
  deleteMedia,
  finalizeMediaUpload,
  renewMediaUpload,
  reorderMedia,
  retryMediaProcessing,
  rotateMedia,
  setMediaCover,
  updateMediaAlt,
  type UploadTicket,
} from '@/app/actions/media';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MEDIA_LIMITS } from '@/modules/media/variants';
import type { AdminMedia } from '@/modules/media/server';
import { prepareFile, startUpload, UploadError, type RunningUpload } from './upload-engine';

type QueueStatus = 'preparing' | 'queued' | 'uploading' | 'processing' | 'error';

interface QueueItem {
  key: string;
  file: File;
  name: string;
  size: number;
  width: number | null;
  height: number | null;
  status: QueueStatus;
  progress: number;
  error?: string;
  retryable: boolean;
  /** Hata hangi aşamada: yükleme mi, işleme mi */
  failedAt?: 'prepare' | 'upload' | 'process';
  ticket?: UploadTicket;
  replaceId?: string;
}

const CONCURRENCY = 2;

interface MediaManagerProps {
  propertyId: string;
  propertyTitle: string;
  initialMedia: AdminMedia[];
  canManage: boolean;
  onMediaChange?: (media: AdminMedia[]) => void;
}

export function MediaManager({ propertyId, propertyTitle, initialMedia, canManage, onMediaChange }: MediaManagerProps) {
  const [media, setMedia] = useState<AdminMedia[]>(initialMedia);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [altEdit, setAltEdit] = useState<AdminMedia | null>(null);
  const [toDelete, setToDelete] = useState<AdminMedia | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const running = useRef(new Map<string, RunningUpload>());
  const queueRef = useRef<QueueItem[]>([]);

  const ready = media.filter((m) => m.status === 'ready');
  const stale = media.filter((m) => m.status !== 'ready');

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    onMediaChange?.(media);
  }, [media, onMediaChange]);

  // Yükleme sürerken sayfadan ayrılma uyarısı
  useEffect(() => {
    const active = queue.some((q) => q.status === 'uploading' || q.status === 'processing' || q.status === 'queued');
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [queue]);

  const patch = useCallback((key: string, changes: Partial<QueueItem>) => {
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }, []);

  const upsertMedia = useCallback((item: AdminMedia, replacedId?: string) => {
    setMedia((list) => {
      const without = list.filter((m) => m.id !== item.id && m.id !== replacedId);
      const next = [...without, item].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
      return item.is_cover ? next.map((m) => (m.id === item.id ? m : { ...m, is_cover: false })) : next;
    });
  }, []);

  const process = useCallback(
    async (item: QueueItem) => {
      try {
        let ticket = item.ticket;
        if (!ticket) {
          const res = await createMediaUpload({
            propertyId,
            fileName: item.name,
            mimeType: item.file.type as 'image/jpeg',
            size: item.file.size,
            replaceId: item.replaceId,
          });
          if (!res.ok) {
            patch(item.key, { status: 'error', error: res.error, retryable: res.code !== 'limit' && res.code !== 'quota' && res.code !== 'validation', failedAt: 'upload' });
            return;
          }
          ticket = res.data;
          patch(item.key, { ticket });
        } else if (item.failedAt === 'upload') {
          const res = await renewMediaUpload(ticket.mediaId);
          if (!res.ok) {
            patch(item.key, { status: 'error', error: res.error, retryable: false, failedAt: 'upload' });
            return;
          }
          ticket = res.data;
          patch(item.key, { ticket });
        }

        if (item.failedAt !== 'process') {
          patch(item.key, { status: 'uploading', progress: 0, error: undefined });
          const upload = startUpload(item.file, ticket, (ratio) => patch(item.key, { progress: Math.round(ratio * 100) }));
          running.current.set(item.key, upload);
          try {
            await upload.promise;
          } finally {
            running.current.delete(item.key);
          }
        }

        patch(item.key, { status: 'processing', progress: 100, error: undefined });
        const res = item.failedAt === 'process' ? await retryMediaProcessing(ticket.mediaId) : await finalizeMediaUpload({ mediaId: ticket.mediaId, replaceId: item.replaceId });
        if (!res.ok) {
          const permanent = ['unsupported', 'too_small', 'too_large', 'corrupt'].includes(res.code ?? '');
          patch(item.key, { status: 'error', error: res.error, retryable: !permanent, failedAt: permanent ? 'upload' : 'process' });
          return;
        }
        upsertMedia(res.data, item.replaceId);
        setQueue((q) => q.filter((x) => x.key !== item.key));
      } catch (error) {
        if (error instanceof UploadError && error.message === 'İptal edildi') return;
        const message = error instanceof UploadError ? error.message : 'Yükleme sırasında beklenmeyen bir hata oluştu.';
        patch(item.key, { status: 'error', error: message, retryable: error instanceof UploadError ? error.retryable : true, failedAt: 'upload' });
      }
    },
    [patch, propertyId, upsertMedia],
  );

  // Kuyruk işleyici: aynı anda en fazla 2 yükleme
  useEffect(() => {
    const activeCount = queue.filter((q) => q.status === 'uploading' || q.status === 'processing').length;
    const next = queue.filter((q) => q.status === 'queued').slice(0, Math.max(0, CONCURRENCY - activeCount));
    for (const item of next) {
      // Öğe başlatılırken hemen "yükleniyor" işaretlenmeli; aksi halde efekt yeniden
      // çalıştığında aynı dosya ikinci kez başlatılır (kuyruk, dış bir süreçle eşitleme yapar)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      patch(item.key, { status: 'uploading' });
      void process(item);
    }
  }, [queue, patch, process]);

  async function addFiles(files: FileList | File[], replaceId?: string) {
    if (!canManage) return;
    const list = Array.from(files);
    const capacity = MEDIA_LIMITS.maxImagesPerProperty - media.filter((m) => m.status !== 'failed').length - queueRef.current.length;
    if (!replaceId && list.length > capacity) {
      toast.error(`Bir ilana en fazla ${MEDIA_LIMITS.maxImagesPerProperty} fotoğraf eklenebilir. ${Math.max(0, capacity)} fotoğraf daha ekleyebilirsiniz.`);
    }
    const accepted = replaceId ? list.slice(0, 1) : list.slice(0, Math.max(0, capacity));
    const items: QueueItem[] = accepted.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      size: file.size,
      width: null,
      height: null,
      status: 'preparing',
      progress: 0,
      retryable: false,
      replaceId,
    }));
    setQueue((q) => [...q, ...items]);
    for (const item of items) {
      try {
        const prepared = await prepareFile(item.file);
        patch(item.key, { file: prepared.file, size: prepared.file.size, width: prepared.width, height: prepared.height, status: 'queued' });
      } catch (error) {
        patch(item.key, {
          status: 'error',
          error: error instanceof UploadError ? error.message : 'Dosya okunamadı.',
          retryable: false,
          failedAt: 'prepare',
        });
      }
    }
  }

  async function cancel(item: QueueItem) {
    running.current.get(item.key)?.abort();
    setQueue((q) => q.filter((x) => x.key !== item.key));
    if (item.ticket) {
      const res = await cancelMediaUpload(item.ticket.mediaId);
      if (!res.ok && res.code !== 'not_found') toast.error(res.error);
    }
  }

  function retry(item: QueueItem) {
    patch(item.key, { status: 'queued', error: undefined, progress: 0 });
  }

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }

  async function makeCover(m: AdminMedia) {
    await withBusy(m.id, async () => {
      const res = await setMediaCover(m.id);
      if (!res.ok) return void toast.error(res.error);
      setMedia((list) => list.map((x) => ({ ...x, is_cover: x.id === m.id })));
      toast.success('Kapak fotoğrafı güncellendi.');
    });
  }

  async function rotate(m: AdminMedia, direction: 'left' | 'right') {
    await withBusy(m.id, async () => {
      const res = await rotateMedia(m.id, direction);
      if (!res.ok) return void toast.error(res.error);
      upsertMedia(res.data);
    });
  }

  async function persistOrder(next: AdminMedia[], previous: AdminMedia[]) {
    setMedia([...next.map((m, i) => ({ ...m, sort_order: i })), ...media.filter((m) => m.status !== 'ready')]);
    const res = await reorderMedia(
      propertyId,
      next.map((m) => m.id),
    );
    if (!res.ok) {
      toast.error(res.error);
      setMedia(previous);
    }
  }

  function move(m: AdminMedia, delta: number) {
    const list = [...ready];
    const from = list.findIndex((x) => x.id === m.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    void persistOrder(list, media);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...ready];
    const from = list.findIndex((x) => x.id === dragId);
    const to = list.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    void persistOrder(list, media);
  }

  async function removeStale(m: AdminMedia) {
    await withBusy(m.id, async () => {
      const res = await deleteMedia(m.id);
      if (!res.ok) return void toast.error(res.error);
      setMedia((list) => list.filter((x) => x.id !== m.id));
    });
  }

  async function retryStale(m: AdminMedia) {
    await withBusy(m.id, async () => {
      const res = await retryMediaProcessing(m.id);
      if (!res.ok) return void toast.error(res.error);
      upsertMedia(res.data);
      toast.success('Fotoğraf işlendi.');
    });
  }

  return (
    <div>
      {canManage && (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setDragOver(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
            dragOver ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface-muted/40',
          )}
        >
          <UploadCloud className="size-10 text-primary" aria-hidden />
          <p className="mt-3 text-[16px] font-semibold text-foreground">Fotoğrafları sürükleyin veya seçin</p>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            JPG, PNG, WEBP, AVIF veya HEIC · dosya başına en fazla 50 MB · 4K ve üzeri çözünürlük desteklenir. Orijinal dosya
            saklanır; sitede cihaza uygun boyutlar gösterilir.
          </p>
          <Button className="mt-5" onClick={() => inputRef.current?.click()}>
            <ImagePlus /> Fotoğraf seç
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={MEDIA_LIMITS.acceptAttr}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={replaceRef}
            type="file"
            accept={MEDIA_LIMITS.acceptAttr}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files?.length && replaceTarget.current) void addFiles(e.target.files, replaceTarget.current);
              replaceTarget.current = null;
              e.target.value = '';
            }}
          />
        </div>
      )}

      {queue.length > 0 && (
        <ul className="mt-5 space-y-2.5" aria-label="Yüklenen dosyalar" aria-live="polite">
          {queue.map((item) => (
            <li key={item.key} className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center gap-3">
                {item.status === 'error' ? (
                  <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
                ) : (
                  <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{item.name}</p>
                  <p className="numeric text-[12px] text-muted-foreground">
                    {formatBytes(item.size)}
                    {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                    {item.replaceId ? ' · değiştirme' : ''}
                    {' · '}
                    {item.status === 'preparing' && 'Hazırlanıyor…'}
                    {item.status === 'queued' && 'Sırada'}
                    {item.status === 'uploading' && `Yükleniyor %${item.progress}`}
                    {item.status === 'processing' && 'İşleniyor (boyutlar üretiliyor)…'}
                    {item.status === 'error' && 'Başarısız'}
                  </p>
                </div>
                {item.status === 'error' && item.retryable && (
                  <Button size="xs" variant="outline" onClick={() => retry(item)}>
                    <RefreshCw /> Tekrar dene
                  </Button>
                )}
                <Button size="icon-xs" variant="ghost" onClick={() => void cancel(item)} aria-label={item.status === 'error' ? 'Listeden kaldır' : 'Yüklemeyi iptal et'}>
                  <X />
                </Button>
              </div>
              {(item.status === 'uploading' || item.status === 'processing') && (
                <Progress value={item.status === 'processing' ? 100 : item.progress} className="mt-2.5" label={`${item.name} yükleniyor`} indeterminate={item.status === 'processing'} />
              )}
              {item.error && <p className="mt-2 text-[13px] font-medium text-danger">{item.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {stale.length > 0 && (
        <ul className="mt-5 space-y-2">
          {stale.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-3 text-[13px] text-warning">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <strong>{m.original_filename ?? 'Fotoğraf'}</strong> — {m.status === 'pending' ? 'yükleme tamamlanmamış' : (m.error ?? 'işlenemedi')}
              </span>
              {canManage && (
                <span className="flex gap-2">
                  {m.status === 'failed' && (
                    <Button size="xs" variant="outline" className="bg-surface" loading={busyId === m.id} onClick={() => void retryStale(m)}>
                      Tekrar dene
                    </Button>
                  )}
                  <Button size="xs" variant="danger-ghost" disabled={busyId === m.id} onClick={() => void removeStale(m)}>
                    Kaldır
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {ready.length > 0 ? (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">
              <strong className="text-foreground">{ready.length}</strong> fotoğraf · Sırayı değiştirmek için sürükleyin. İlk fotoğraf değil, “Kapak”
              işaretli fotoğraf ilan kartında görünür.
            </p>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {ready.map((m, index) => (
              <li
                key={m.id}
                draggable={canManage}
                onDragStart={(e) => {
                  setDragId(m.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => dragId && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(m.id);
                  setDragId(null);
                }}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border bg-surface transition',
                  m.is_cover ? 'border-primary ring-2 ring-primary/25' : 'border-border',
                  dragId === m.id && 'opacity-40',
                  canManage && 'cursor-grab active:cursor-grabbing',
                )}
              >
                <div className="relative aspect-[4/3] bg-surface-muted">
                  <MediaImage media={m} alt={m.alt_text ?? `${propertyTitle} – fotoğraf ${index + 1}`} fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 50vw" className="object-cover" />
                  {busyId === m.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 className="size-6 animate-spin text-primary" aria-label="İşleniyor" />
                    </span>
                  )}
                  <span className="numeric absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11.5px] font-semibold text-white">{index + 1}</span>
                  {m.is_cover && (
                    <Badge variant="primary" className="absolute bottom-2 left-2">
                      <Star /> Kapak
                    </Badge>
                  )}
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-white/92 text-foreground shadow-xs hover:bg-white"
                          aria-label={`Fotoğraf ${index + 1} işlemleri`}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        {!m.is_cover && (
                          <DropdownMenuItem onSelect={() => void makeCover(m)}>
                            <Star /> Kapak fotoğrafı yap
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setAltEdit(m)}>
                          <Pencil /> Açıklamayı düzenle
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void rotate(m, 'left')}>
                          <RotateCcw /> Sola döndür
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void rotate(m, 'right')}>
                          <RotateCw /> Sağa döndür
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            replaceTarget.current = m.id;
                            replaceRef.current?.click();
                          }}
                        >
                          <Replace /> Fotoğrafı değiştir
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={index === 0} onSelect={() => move(m, -1)}>
                          <ArrowLeft /> Öne al
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={index === ready.length - 1} onSelect={() => move(m, 1)}>
                          <ArrowRight /> Arkaya al
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => setToDelete(m)}>
                          <Trash2 /> Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="px-3 py-2.5 text-[12px] text-muted-foreground">
                  <p className="numeric truncate">
                    {m.width && m.height ? `${m.width}×${m.height}` : '—'} · {formatBytes(m.byte_size)}
                  </p>
                  <p className={cn('mt-0.5 truncate', m.alt_text ? 'text-foreground/80' : 'italic')}>{m.alt_text ?? 'Açıklama otomatik'}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        queue.length === 0 &&
        stale.length === 0 && (
          <p className="mt-6 flex items-center gap-2 text-[13.5px] text-muted-foreground">
            <CheckCircle2 className="size-4" aria-hidden /> Henüz fotoğraf yok. Yayınlamak için en az bir fotoğraf gerekir; en iyi sonuç için
            5 veya daha fazla fotoğraf ekleyin.
          </p>
        )
      )}

      {altEdit && <AltDialog media={altEdit} fallback={`${propertyTitle} – fotoğraf`} onClose={() => setAltEdit(null)} onSaved={(alt) => setMedia((list) => list.map((m) => (m.id === altEdit.id ? { ...m, alt_text: alt } : m)))} />}

      {toDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setToDelete(null)}
          title="Fotoğraf silinsin mi?"
          description="Fotoğrafın tüm boyutları ve orijinal dosyası kalıcı olarak silinir."
          destructive
          confirmLabel="Sil"
          onConfirm={async () => {
            const res = await deleteMedia(toDelete.id);
            if (!res.ok) {
              toast.error(res.error);
              return false;
            }
            setMedia((list) => {
              const rest = list.filter((m) => m.id !== toDelete.id);
              // Kapak silindiyse veritabanı sıradaki fotoğrafı kapak yapar; arayüzü de eşitle
              if (toDelete.is_cover) {
                const firstReady = rest.find((m) => m.status === 'ready');
                return rest.map((m) => ({ ...m, is_cover: m.id === firstReady?.id }));
              }
              return rest;
            });
            toast.success('Fotoğraf silindi.');
          }}
        />
      )}
    </div>
  );
}

function AltDialog({ media, fallback, onClose, onSaved }: { media: AdminMedia; fallback: string; onClose: () => void; onSaved: (alt: string | null) => void }) {
  const [value, setValue] = useState(media.alt_text ?? '');
  const [pending, setPending] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Fotoğraf açıklaması"
        description="Ekran okuyucular ve arama motorları için fotoğrafta ne görüldüğünü kısaca yazın (ör. “Güney cepheli, geniş salon”). Boş bırakılırsa ilan başlığından otomatik oluşturulur."
      >
        <form
          className="mt-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            const res = await updateMediaAlt(media.id, value);
            setPending(false);
            if (!res.ok) return void toast.error(res.error);
            onSaved(value.trim() || null);
            onClose();
          }}
        >
          <Field label="Açıklama (alt metin)" htmlFor="alt-text" hint={`Boşsa: “${fallback} N”`}>
            <Input id="alt-text" value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" loading={pending}>
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
