'use client';

import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { FamilyCatalog } from '@/components/site-editor/family-catalog';
import type { RealPreview } from '@/components/site-editor/family-preview-dialog';
import type { FamilyMeta } from '@/site-factory/catalog-segments';
import type { Brand, ThemePreviewInput } from '@/theme-engine/preview/live-preview';

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
  /** Segmentler, etiketler, kime uygun (site-factory/catalog-segments.ts: tip) */
  meta: FamilyMeta;
  /** Sitenin tipi için önerilen aileler arasında mı */
  recommended: boolean;
  /** Palet bandı (ana, ikincil, vurgu, zemin) */
  swatch: string[];
  paletteName: string;
  headingName: string;
  headingFontId: string;
}

/**
 * Site Factory › Tasarım aileleri (yalnızca KARAY süper admin ve izinli ofis). Bir aile seçmek taslağın
 * tema, renk sistemi, tipografi, yapısal parçalar ve ana sayfa kompozisyonu bölümlerini derler; canlı
 * site, önizleme ve yayınla değişir. Kiracının metinleri, menüsü ve markası korunur. Katalog gövdesi
 * (filtre, kart, büyük önizleme) family-catalog.tsx'tedir; bu bileşenin dışa aktarımı değişmedi.
 */
export function DesignFamilyPicker({
  families,
  brand,
  darkAllowed,
  name,
  compact,
  real,
  description,
}: {
  families: FamilyOption[];
  brand: Brand;
  darkAllowed: boolean;
  name: string;
  compact?: boolean;
  /** Büyük önizlemede gerçek site önizlemesi kaynağı; yoksa tema önizlemesi */
  real?: RealPreview;
  /** Bölüm açıklaması (varsayılan metni ezer) */
  description?: string;
}) {
  return (
    <section aria-labelledby="tasarim-aileleri">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="tasarim-aileleri" className="flex items-center gap-2 text-[17px] font-semibold">
            <Sparkles className="size-4.5 text-primary-ink" aria-hidden /> Tasarım aileleri
          </h2>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            {description ?? 'Hazır bir tasarım birleşimi: tema, renk sistemi, hero, header, ilan kartı, footer, hareket dili ve ana sayfa kompozisyonu birlikte gelir. Uygulamak yalnızca taslağı değiştirir; metinler, menü ve marka korunur.'}
          </p>
        </div>
      </div>
      <Suspense fallback={<p className="mt-4 text-[13px] text-muted-foreground">Aileler yükleniyor…</p>}>
        <FamilyCatalog families={families} brand={brand} darkAllowed={darkAllowed} name={name} compact={compact} real={real} />
      </Suspense>
    </section>
  );
}
