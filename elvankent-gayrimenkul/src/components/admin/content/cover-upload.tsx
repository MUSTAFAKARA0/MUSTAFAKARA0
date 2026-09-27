'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, RefreshCw, Trash2, X } from 'lucide-react';
import { MediaImage } from '@/components/gallery/media-image';
import { prepareFile, startUpload, UploadError } from '@/components/admin/media/upload-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Progress } from '@/components/ui/progress';
import { cancelMediaUpload, createContentMediaUpload, finalizeMediaUpload, updateMediaAlt } from '@/app/actions/media';
import { MEDIA_LIMITS, type MediaSource } from '@/modules/media/variants';

export type CoverMedia = MediaSource & { id: string };

type Phase = { kind: 'idle' } | { kind: 'uploading'; progress: number } | { kind: 'processing' };

/**
 * İçerik görseli (blog kapağı): tarayıcıdan doğrudan depolamaya yüklenir,
 * sunucuda doğrulanıp WebP varyantlarına dönüştürülür. Görsel medya
 * kütüphanesinde kalır; kaldırmak yalnızca bu içerikle bağını koparır.
 */
export function CoverUpload({ value, onChange, disabled, aspect = 'aspect-[16/9]' }: { value: CoverMedia | null; onChange: (media: CoverMedia | null) => void; disabled?: boolean; aspect?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [alt, setAlt] = useState(value?.alt_text ?? '');
  const [altSaved, setAltSaved] = useState(value?.alt_text ?? '');
  const busy = phase.kind !== 'idle';

  async function upload(file: File) {
    setError(null);
    let mediaId: string | null = null;
    try {
      const prepared = await prepareFile(file);
      const ticket = await createContentMediaUpload({ fileName: prepared.file.name, mimeType: prepared.file.type as 'image/jpeg', size: prepared.file.size });
      if (!ticket.ok) throw new UploadError(ticket.error, false);
      mediaId = ticket.data.mediaId;
      setPhase({ kind: 'uploading', progress: 0 });
      const run = startUpload(prepared.file, ticket.data, (ratio) => setPhase({ kind: 'uploading', progress: ratio }));
      abortRef.current = run.abort;
      await run.promise;
      abortRef.current = null;
      setPhase({ kind: 'processing' });
      const done = await finalizeMediaUpload({ mediaId });
      if (!done.ok) throw new UploadError(done.error, false);
      mediaId = null;
      const media = done.data;
      onChange({ ...media, id: media.id });
      setAlt(media.alt_text ?? '');
      setAltSaved(media.alt_text ?? '');
      toast.success('Görsel yüklendi.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Görsel yüklenemedi. Lütfen tekrar deneyin.';
      setError(message);
      // Yarım kalan / reddedilen kayıt medya kütüphanesinde kalmasın
      if (mediaId) void cancelMediaUpload(mediaId);
    } finally {
      abortRef.current = null;
      setPhase({ kind: 'idle' });
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function saveAlt() {
    if (!value || alt.trim() === altSaved) return;
    const res = await updateMediaAlt(value.id, alt.trim());
    if (!res.ok) return void toast.error(res.error);
    setAltSaved(alt.trim());
    onChange({ ...value, alt_text: alt.trim() || null });
    toast.success('Görsel açıklaması kaydedildi.');
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_LIMITS.acceptAttr}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {value ? (
        <div className={`relative ${aspect} overflow-hidden rounded-xl border border-border bg-surface-muted`}>
          <MediaImage media={value} alt={value.alt_text ?? ''} fill sizes="(min-width: 1280px) 24rem, 100vw" className="object-cover" />
          {busy && <div className="absolute inset-0 bg-white/60" aria-hidden />}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className={`flex ${aspect} w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-muted/50 px-4 text-center text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary-soft/40 disabled:opacity-60`}
        >
          <ImagePlus className="size-7 text-foreground/50" aria-hidden />
          <span className="font-semibold text-foreground">Görsel yükle</span>
          <span className="text-[12.5px]">JPG, PNG, WEBP, AVIF veya HEIC · en az 600×400 px · en fazla 50 MB</span>
        </button>
      )}

      {phase.kind === 'uploading' && (
        <div className="mt-3 flex items-center gap-3">
          <Progress value={phase.progress * 100} label="Yükleme ilerlemesi" className="flex-1" />
          <Button size="icon-xs" variant="ghost" aria-label="Yüklemeyi iptal et" onClick={() => abortRef.current?.()}>
            <X />
          </Button>
        </div>
      )}
      {phase.kind === 'processing' && (
        <div className="mt-3">
          <Progress value={0} indeterminate label="Görsel işleniyor" />
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">Görsel doğrulanıyor ve farklı boyutlara dönüştürülüyor…</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      {value && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
              <RefreshCw /> Değiştir
            </Button>
            <Button size="sm" variant="danger-ghost" disabled={disabled || busy} onClick={() => onChange(null)}>
              <Trash2 /> Kaldır
            </Button>
          </div>
          <label htmlFor={`alt-${value.id}`} className="mt-3 mb-1 block text-[12.5px] font-semibold text-muted-foreground">
            Görsel açıklaması (alt metin)
          </label>
          <Input
            id={`alt-${value.id}`}
            value={alt}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => void saveAlt()}
            placeholder="ör. Elvankent'te parka bakan konut sitesi"
            className="h-10"
          />
        </>
      )}
    </div>
  );
}
