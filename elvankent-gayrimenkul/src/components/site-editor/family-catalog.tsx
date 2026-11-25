'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from '@/components/ui/toast';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSiteEditor } from '@/components/site-editor/site-actions';
import { FamilyCard } from '@/components/site-editor/family-card';
import { FamilyFilters } from '@/components/site-editor/family-filters';
import { FamilyPreviewDialog, type RealPreview } from '@/components/site-editor/family-preview-dialog';
import { filterFamilies, parseState, resultText, segmentCounts, serializeState, sortFamilies, type CatalogState } from '@/components/site-editor/family-catalog-logic';
import type { FamilyOption } from '@/components/site-editor/design-family-picker';
import type { Brand } from '@/theme-engine/preview/live-preview';

/**
 * Aile kataloğu: filtre çubuğu + zengin kartlar + büyük önizleme. Filtre durumu adres satırına
 * (?segment= &q= &sirala= &koyu=) yansıtılır: geri/ileri ve doğrudan bağlantılar çalışır. Seçim
 * mevcut akışı kullanır: onay → applyFamily (sunucu işlemi, değişmedi). `compact`: sihirbaz/dar
 * yerleşim (2 sütun, büyük önizleme yok).
 */
export function FamilyCatalog({
  families,
  brand,
  darkAllowed,
  name,
  compact = false,
  real,
}: {
  families: FamilyOption[];
  brand: Brand;
  darkAllowed: boolean;
  name: string;
  compact?: boolean;
  /** Büyük önizlemede gerçek site önizlemesi kaynağı; yoksa tema önizlemesi */
  real?: RealPreview;
}) {
  const { applyFamily } = useSiteEditor();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Diyalog tetikleyici (Radix Trigger) olmadan açıldığından kapanınca odak açan düğmeye elle geri verilir
  const opener = useRef<HTMLElement | null>(null);
  // Diyalogdan "Bu aileyi seç" ile kapanınca odak kartın onay düğmesine gider (açan düğme artık yer değiştirmiştir)
  const focusConfirm = useRef<string | null>(null);

  // Durum yerel tutulur (metin kutusu akıcı kalır) ve adres satırına yansıtılır: segment/sıralama/koyu
  // değişimleri geçmişe yazılır (geri/ileri çalışır), metin araması yalnızca adresi günceller.
  const [state, setLocal] = useState<CatalogState>(() => parseState(new URLSearchParams(search.toString())));
  useEffect(() => {
    const onPop = () => setLocal(parseState(new URLSearchParams(window.location.search)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  function setState(next: CatalogState) {
    const textOnly = next.segment === state.segment && next.sort === state.sort && next.dark === state.dark;
    setLocal(next);
    const qs = serializeState(next);
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (textOnly) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }

  const counts = useMemo(() => segmentCounts(families), [families]);
  const shown = useMemo(() => sortFamilies(filterFamilies(families, state), state.sort), [families, state]);
  const hasDark = families.some((f) => f.meta.contrast === 'dark');
  const hasRecommended = families.some((f) => f.recommended);
  const sortOptions = [
    ...(hasRecommended ? [{ value: 'recommended' as const, label: 'Önerilen' }] : [{ value: 'recommended' as const, label: 'Katalog sırası' }]),
    { value: 'az' as const, label: 'A–Z' },
  ];

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
  const previewing = families.find((f) => f.id === previewId) ?? null;
  // Koyu paletli aile koyu görünüm kapalı sitede seçilemez (açık yedek palete düşerdi); listeden gizlenmez, nedeni yazılır
  const unavailableFor = (f: FamilyOption) => (f.meta.contrast === 'dark' && !darkAllowed ? 'Koyu tema bu ofiste kapalı' : undefined);

  return (
    <div className="mt-4 space-y-4">
      <FamilyFilters
        state={state}
        counts={counts}
        total={families.length}
        resultText={resultText(families.length, shown.length)}
        sortOptions={sortOptions}
        showDark={hasDark}
        onChange={setState}
      />
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center" data-testid="family-empty">
          <SearchX className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-[15px] font-semibold">Bu süzgece uyan tasarım ailesi yok</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted-foreground">Segmenti veya arama metnini değiştirin; ya da süzgeçleri temizleyip bütün aileleri görün.</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setState({ segment: 'all', q: '', sort: 'recommended', dark: false })}>
            Filtreleri temizle
          </Button>
        </div>
      ) : (
        <ul className={compact ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
          {shown.map((f) => (
            <FamilyCard
              key={f.id}
              family={f}
              brand={brand}
              darkAllowed={darkAllowed}
              name={name}
              compact={compact}
              confirming={confirming === f.id}
              pending={pending === f.id}
              busy={pending !== null}
              unavailable={unavailableFor(f)}
              onPreview={(id) => {
                opener.current = document.activeElement as HTMLElement | null;
                setPreviewId(id);
              }}
              onAskSelect={setConfirming}
              onConfirm={(id) => void apply(id)}
              onCancel={() => setConfirming(null)}
            />
          ))}
        </ul>
      )}
      {!compact && (
        <FamilyPreviewDialog
          family={previewing}
          onClose={() => {
            setPreviewId(null);
            const el = opener.current;
            const confirmId = focusConfirm.current;
            focusConfirm.current = null;
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const target = confirmId ? document.querySelector<HTMLElement>(`[data-family-id="${confirmId}"] [data-confirm]`) : null;
                (target ?? el)?.focus();
              }),
            );
          }}
          onSelect={(id) => {
            focusConfirm.current = id;
            setConfirming(id);
          }}
          brand={brand}
          darkAllowed={darkAllowed}
          name={name}
          real={real}
          unavailable={previewing ? unavailableFor(previewing) : undefined}
          disabled={pending !== null}
        />
      )}
    </div>
  );
}
