'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Eye, Rocket, Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { hasUnsavedChanges, useDirtyGuard } from '@/components/platform/site/dirty-guard';
import { createSitePreviewLink, discardSiteDraft, publishSite, saveSiteSection } from '@/app/actions/site-builder';
import type { SiteSection } from '@/platform/site/schema';

type Size = 'xs' | 'sm' | 'md';

/** Taslak önizlemesini yeni sekmede açar (1 saat geçerli, yalnızca bu tarayıcıda) */
export function PreviewButton({ orgId, size = 'sm', path = '/', label = 'Önizle' }: { orgId: string; size?: Size; path?: string; label?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size={size}
      loading={pending}
      onClick={async () => {
        // Sekme tıklama anında açılır (açılır pencere engelleyicisine takılmaz), adres sonra verilir
        const tab = window.open('about:blank', '_blank');
        setPending(true);
        const res = await createSitePreviewLink(orgId, path);
        setPending(false);
        if (!res.ok) {
          tab?.close();
          return void toast.error(res.error);
        }
        if (tab) tab.location.href = res.data.url;
        else window.location.href = res.data.url;
      }}
    >
      {!pending && <Eye />} {label}
    </Button>
  );
}

export function PublishButton({ orgId, disabled, size = 'sm' }: { orgId: string; disabled?: boolean; size?: Size }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [, startTransition] = useTransition();
  return (
    <>
      <Button
        size={size}
        disabled={disabled}
        onClick={() => {
          if (hasUnsavedChanges() && !window.confirm('Bu sekmede kaydedilmemiş değişiklikler var; yayına dahil edilmezler. Yine de devam edilsin mi?')) return;
          setOpen(true);
        }}
        title={disabled ? 'Yayınlanmamış değişiklik yok' : undefined}
      >
        <Rocket /> Değişiklikleri yayınla
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Değişiklikler yayınlansın mı?"
        description="Taslaktaki görünüm canlı siteye alınır ve yeni bir sürüm oluşturulur. Gerekirse Geçmiş sekmesinden önceki sürüme dönebilirsiniz."
        confirmLabel="Yayınla"
        onConfirm={async () => {
          const res = await publishSite(orgId, note);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`Yayınlandı (sürüm ${res.data.version}).`);
          setNote('');
          startTransition(() => router.refresh());
          return true;
        }}
      >
        <Field label="Sürüm notu" htmlFor="publish-note" optional hint="Ör. Tema Marble olarak değiştirildi">
          <Input id="publish-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}

export function DiscardDraftButton({ orgId, disabled }: { orgId: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <Undo2 /> Taslağı geri al
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Yayınlanmamış değişiklikler silinsin mi?"
        description="Taslak, canlıdaki (son yayınlanan) sürüme döner. Bu işlem geri alınamaz."
        confirmLabel="Geri al"
        destructive
        onConfirm={async () => {
          const res = await discardSiteDraft(orgId);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(res.message ?? 'Taslak geri alındı.');
          startTransition(() => router.refresh());
          return true;
        }}
      />
    </>
  );
}

/** Bölüm formlarının ortak kaydetme işlevi: taslağa yazar, sayfayı tazeler */
export function useSectionSave(orgId: string, section: SiteSection) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  async function save(value: unknown): Promise<boolean> {
    setPending(true);
    try {
      const res = await saveSiteSection(orgId, section, value);
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      toast.success(res.message ?? 'Taslağa kaydedildi.');
      startTransition(() => router.refresh());
      return true;
    } finally {
      setPending(false);
    }
  }
  return { save, pending };
}

/** Formların altındaki yapışkan kaydetme çubuğu (telefonda da erişilebilir) */
export function SaveBar({ pending, dirty, onSave, onReset, note, saveLabel = 'Taslağa kaydet' }: { pending: boolean; dirty: boolean; onSave: () => void; onReset?: () => void; note?: string; saveLabel?: string }) {
  useDirtyGuard(dirty);
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur transition-colors sm:mx-0 sm:rounded-2xl sm:border sm:px-5',
        dirty ? 'border-amber-400 bg-amber-50/95' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={cn('flex items-center gap-2 text-[13px]', dirty ? 'font-semibold text-amber-900' : 'text-muted-foreground')}>
          {dirty && <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden />}
          {dirty ? 'Kaydedilmemiş değişiklikler var — taslağa kaydedin.' : (note ?? 'Değişiklikler taslağa kaydedilir; canlı site yayınlayana kadar değişmez.')}
        </p>
        <div className="flex gap-2">
          {onReset && (
            <Button type="button" variant="ghost" size="sm" disabled={!dirty || pending} onClick={onReset}>
              Vazgeç
            </Button>
          )}
          <Button type="button" size="sm" loading={pending} disabled={!dirty} onClick={onSave}>
            {!pending && <Save />} {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
