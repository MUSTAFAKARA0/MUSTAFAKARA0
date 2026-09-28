'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Progress } from '@/components/ui/progress';
import { removeBrandingImage } from '@/app/actions/admin-settings';
import { cn } from '@/lib/utils';

type Kind = 'logo' | 'logo_mobile' | 'favicon' | 'hero' | 'og';

/** Güvenli SVG yalnızca logo ve simge türlerinde kabul edilir (sunucuda denetlenip PNG'ye çevrilir) */
const SVG_KINDS: Kind[] = ['logo', 'logo_mobile', 'favicon'];

/**
 * Marka görseli alanı: dosya sunucuya gönderilir, orada doğrulanıp yeniden
 * kodlanır (PNG/JPEG) ve ayar kaydedilir. Başarılı olunca sayfa tazelenir.
 * `orgId` verilirse KARAY platform uç noktası kullanılır (süper admin, seçilen kiracı).
 */
async function removePlatformImage(orgId: string, kind: Kind): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/platform/branding?orgId=${encodeURIComponent(orgId)}&kind=${kind}`, { method: 'DELETE' });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    return res.ok ? { ok: true, message: data.message } : { ok: false, error: data.error ?? 'Görsel kaldırılamadı.' };
  } catch {
    return { ok: false, error: 'Sunucuya ulaşılamadı.' };
  }
}

export function BrandingImageField({
  kind,
  label,
  url,
  hint,
  previewClassName,
  disabled,
  stacked,
  orgId,
}: {
  kind: Kind;
  label: string;
  url: string | null;
  hint?: React.ReactNode;
  previewClassName?: string;
  disabled?: boolean;
  /** Geniş önizlemeler (paylaşım, ana sayfa görseli): önizleme üstte, düğmeler altta */
  stacked?: boolean;
  /** KARAY Web Sitesi Yönetimi: hedef kiracı (sunucuda süper admin yetkisiyle doğrulanır) */
  orgId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('kind', kind);
      body.set('file', file);
      if (orgId) body.set('orgId', orgId);
      const res = await fetch(orgId ? '/api/platform/branding' : '/api/admin/branding', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? 'Görsel yüklenemedi. Lütfen tekrar deneyin.');
        return;
      }
      toast.success(data.message ?? `${label} güncellendi.`);
      startTransition(() => router.refresh());
    } catch {
      setError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const inputId = `branding-${kind}`;
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-foreground/85">{label}</p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={`image/jpeg,image/png,image/webp,image/avif${SVG_KINDS.includes(kind) ? ',image/svg+xml' : ''}`}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className={cn('flex flex-col gap-3', !stacked && 'sm:flex-row sm:items-start')}>
        <div className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-[repeating-conic-gradient(#f1efe9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]', previewClassName ?? 'h-24 w-48')}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- depolamadaki marka görseli (boyutu değişken)
            <img src={url} alt={`${label} önizlemesi`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-3 text-center text-[12px] text-muted-foreground">Görsel yok</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={busy} disabled={disabled} onClick={() => inputRef.current?.click()}>
              {!busy && (url ? <RefreshCw /> : <ImagePlus />)} {url ? 'Değiştir' : 'Yükle'}
            </Button>
            {url && (
              <Button size="sm" variant="danger-ghost" disabled={disabled || busy} onClick={() => setConfirm(true)}>
                <Trash2 /> Kaldır
              </Button>
            )}
          </div>
          {hint && <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{hint}</p>}
          {busy && <Progress value={0} indeterminate label={`${label} yükleniyor`} className="mt-3 max-w-60" />}
          {error && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`${label} kaldırılsın mı?`}
        description="Sitede varsayılan görünüm kullanılır. Daha sonra yeni bir görsel yükleyebilirsiniz."
        confirmLabel="Kaldır"
        onConfirm={async () => {
          const res = orgId ? await removePlatformImage(orgId, kind) : kind === 'logo_mobile' ? { ok: false as const, error: 'Geçersiz görsel türü.' } : await removeBrandingImage(kind);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(res.message ?? `${label} kaldırıldı.`);
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
