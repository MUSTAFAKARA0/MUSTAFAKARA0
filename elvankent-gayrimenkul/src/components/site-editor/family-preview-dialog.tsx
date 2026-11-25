'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { FamilyOption } from '@/components/site-editor/design-family-picker';
import { DENSITY_LABELS } from '@/site-factory/catalog-segments';
import { encodePreviewPayload } from '@/site-factory/preview-payload';
import { LivePreview, type Brand } from '@/theme-engine/preview/live-preview';

const PAGES = [
  { id: 'ana-sayfa', label: 'Ana sayfa' },
  { id: 'ilanlar', label: 'İlan listesi' },
  { id: 'ilan', label: 'İlan detayı' },
] as const;
type PageId = (typeof PAGES)[number]['id'];

/** Gerçek site önizlemesi kaynağı: ofis (kendi verisiyle) veya KARAY (örnek içerikle, site tipi + ad) */
export type RealPreview = { kind: 'office'; base: string } | { kind: 'platform'; siteType: string; city?: string };

function previewSrc(real: RealPreview, familyId: string, surface: PageId, siteName: string): string {
  if (real.kind === 'office') return `${real.base}?${new URLSearchParams({ aile: familyId, s: surface })}`;
  const payload = encodePreviewPayload({
    manifest: { siteType: real.siteType, designFamily: familyId, variants: {} },
    info: { siteName, address: real.city ? { city: real.city } : {}, social: {}, seo: {} },
  } as never);
  return `/site-onizleme?p=${payload}&s=${surface}`;
}

/**
 * Büyük önizleme: üstte ailenin ayrıntıları (kime uygun, parçalar, yazı tipi, ton), altında sayfa sekmeleri
 * (Ana sayfa / İlan listesi / İlan detayı) ve sitenin GERÇEK bileşenleriyle önizleme (çerçeve; ofiste kendi
 * verisiyle, KARAY'da "örnek içerik"). Gerçek önizleme kaynağı yoksa tema önizlemesi (örnek içerik) gösterilir.
 * Dialog Radix (odak tuzağı, Esc).
 */
export function FamilyPreviewDialog({
  family,
  onClose,
  onSelect,
  brand,
  darkAllowed,
  name,
  real,
  unavailable,
  disabled,
}: {
  family: FamilyOption | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  brand: Brand;
  darkAllowed: boolean;
  name: string;
  real?: RealPreview;
  unavailable?: string;
  disabled?: boolean;
}) {
  const [page, setPage] = useState<PageId>('ana-sayfa');
  return (
    <Dialog open={family !== null} onOpenChange={(o) => !o && onClose()}>
      {family && (
        <DialogContent size="xl" title={`${family.name} tasarım ailesi`} description={family.description}>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-foreground">Uygun</dt>
              <dd className="text-muted-foreground">{family.meta.bestFor.join(' · ')}</dd>
            </div>
            {family.meta.notFor && (
              <div>
                <dt className="font-semibold text-foreground">Daha az uygun</dt>
                <dd className="text-muted-foreground">{family.meta.notFor}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold text-foreground">Yazı tipi ve palet</dt>
              <dd className="text-muted-foreground">
                {family.headingName} · {family.paletteName}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Yoğunluk ve ton</dt>
              <dd className="text-muted-foreground">
                {DENSITY_LABELS[family.meta.density]} · {family.meta.mood.join(', ')}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 flex flex-wrap gap-1" aria-label="Parçalar">
            {family.parts.map((p) => (
              <li key={p} className="rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground/75">
                {p}
              </li>
            ))}
          </ul>
          <div role="radiogroup" aria-label="Önizlenen sayfa" className="mt-4 inline-flex flex-wrap rounded-full bg-surface-muted p-1 ring-1 ring-border">
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={page === p.id}
                onClick={() => setPage(p.id)}
                className={cn('min-h-9 rounded-full px-3.5 text-[13px] font-medium transition', page === p.id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {p.label}
              </button>
            ))}
          </div>
          {real ? (
            <div className="mt-3 overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border">
              <iframe
                key={`${family.id}-${page}`}
                title={`${family.name} · ${PAGES.find((p) => p.id === page)?.label} önizlemesi`}
                src={previewSrc(real, family.id, page, name)}
                className="block h-[44dvh] min-h-[22rem] w-full border-0 bg-white"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="mt-3">
              <p className="mb-2 text-[12.5px] text-muted-foreground">Örnek içerik: tema önizlemesi (ilan listesi ve detayı aynı temayla çizilir).</p>
              <LivePreview config={family.config} brand={brand} darkAllowed={darkAllowed} name={name} label={`${family.name} tasarım ailesi tam önizleme (${PAGES.find((p) => p.id === page)?.label})`} />
            </div>
          )}
          {unavailable && <p className="mt-3 text-[13px] font-medium text-warning">{unavailable}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Kapat
            </Button>
            <Button
              type="button"
              disabled={family.active || disabled || Boolean(unavailable)}
              onClick={() => {
                onSelect(family.id);
                onClose();
              }}
            >
              <Check /> {family.active ? 'Taslakta' : 'Bu aileyi seç'}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
