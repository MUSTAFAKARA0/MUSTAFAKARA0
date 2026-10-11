'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSiteEditor } from '@/components/site-editor/site-actions';
import { LivePreview, type Brand, type ThemePreviewInput } from '@/theme-engine/preview/live-preview';

/** Sunucuda derlenmiş aile önizlemesi (katalog ve derleyici sunucuda kalır) */
export interface FamilyOption {
  id: string;
  name: string;
  description: string;
  audience: string;
  /** Bu aile uygulanırsa önizlemenin göstereceği tema girdisi (yalnızca önizleme alanları) */
  config: ThemePreviewInput;
  /** Taslak şu anda bu ailenin derlenmiş hâliyle aynı mı */
  active: boolean;
  parts: string[];
}

/**
 * Site Factory › Tasarım aileleri (yalnızca KARAY süper admin). Bir aile seçmek taslağın tema,
 * renk sistemi, tipografi, yapısal parçalar ve ana sayfa kompozisyonu bölümlerini derler;
 * canlı site, önizleme ve yayınla değişir. Kiracının metinleri, menüsü ve markası korunur.
 */
export function DesignFamilyPicker({ families, brand, darkAllowed, name }: { families: FamilyOption[]; brand: Brand; darkAllowed: boolean; name: string }) {
  const { applyFamily } = useSiteEditor();
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function apply(id: string) {
    setPending(id);
    try {
      const res = await applyFamily(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? 'Taslağa uygulandı.');
      setConfirming(null);
      startTransition(() => router.refresh());
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="tasarim-aileleri">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="tasarim-aileleri" className="flex items-center gap-2 text-[17px] font-semibold">
            <Sparkles className="size-4.5 text-primary-ink" aria-hidden /> Tasarım aileleri
          </h2>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            Hazır bir tasarım birleşimi: tema, renk sistemi, hero, header, ilan kartı, footer, hareket dili ve ana sayfa kompozisyonu birlikte gelir. Uygulamak yalnızca taslağı değiştirir; metinler, menü ve marka korunur.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {families.map((f) => (
          <li key={f.id} className={cn('flex flex-col rounded-2xl border bg-surface p-3', f.active ? 'border-primary ring-1 ring-primary' : 'border-border')}>
            <LivePreview config={f.config} brand={brand} darkAllowed={darkAllowed} name={name} variant="thumb" label={`${f.name} tasarım ailesi önizlemesi`} />
            <div className="mt-3 flex items-start justify-between gap-2 px-1">
              <h3 className="text-[15px] font-semibold">{f.name}</h3>
              {f.active && (
                <Badge variant="success">
                  <Check className="size-3" aria-hidden /> Taslakta
                </Badge>
              )}
            </div>
            <p className="mt-1 px-1 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
            <p className="mt-1.5 px-1 text-[12.5px] text-muted-foreground">
              <span className="font-semibold text-foreground">Uygun:</span> {f.audience}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1 px-1" aria-label="Parçalar">
              {f.parts.map((p) => (
                <li key={p} className="rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground/75">
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap gap-2 px-1 pt-3">
              {confirming === f.id ? (
                <>
                  <Button size="sm" onClick={() => void apply(f.id)} disabled={pending !== null}>
                    {pending === f.id ? 'Uygulanıyor…' : 'Taslağa uygula'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={pending !== null}>
                    Vazgeç
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirming(f.id)} disabled={f.active}>
                  {f.active ? 'Seçili' : 'Bu aileyi seç'}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
