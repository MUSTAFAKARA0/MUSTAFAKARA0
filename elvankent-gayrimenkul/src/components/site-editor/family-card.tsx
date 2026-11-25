'use client';

import { Check, Eye, Moon, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FamilyOption } from '@/components/site-editor/design-family-picker';
import { LazyPreview } from '@/components/site-editor/lazy-preview';
import { SEGMENTS } from '@/site-factory/catalog-segments';
import type { Brand } from '@/theme-engine/preview/live-preview';

const SEGMENT_LABEL: Record<string, string> = Object.fromEntries(SEGMENTS.map((s) => [s.id, s.label]));

/**
 * Sade aile kartı (li + gerçek h3): büyük canlı küçük görünüm, ad ve durum rozetleri, en çok 2 segment çipi,
 * kısa açıklama, palet noktaları ve eylemler. Ayrıntılar (parçalar, "Uygun", yazı tipi, ton) büyük
 * önizleme diyaloğundadır. Kartlar eşit yüksekliktedir (eylemler altta). `unavailable`: kart seçilemez,
 * nedeni görünür (ör. koyu tema bu ofiste kapalı); büyük önizleme yine açılabilir.
 */
export function FamilyCard({
  family: f,
  brand,
  darkAllowed,
  name,
  compact,
  confirming,
  pending,
  busy,
  unavailable,
  onPreview,
  onAskSelect,
  onConfirm,
  onCancel,
}: {
  family: FamilyOption;
  brand: Brand;
  darkAllowed: boolean;
  name: string;
  compact?: boolean;
  confirming: boolean;
  pending: boolean;
  busy: boolean;
  unavailable?: string;
  onPreview: (id: string) => void;
  onAskSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}) {
  const segs = f.meta.segments.map((s) => SEGMENT_LABEL[s] ?? s);
  return (
    <li data-family-id={f.id} data-unavailable={unavailable ? 'true' : undefined} className={cn('flex h-full flex-col rounded-2xl border bg-surface p-3', f.active ? 'border-primary ring-1 ring-primary' : 'border-border')}>
      <div className={cn(unavailable && 'opacity-60')}>
        <LazyPreview
          id={f.id}
          config={f.config}
          brand={brand}
          darkAllowed={darkAllowed}
          name={name}
          label={`${f.name} tasarım ailesi önizlemesi`}
          placeholder={{ swatch: f.swatch, headingFont: f.headingName, headingFontId: f.headingFontId, name: f.name }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-2 gap-y-1 px-1">
        <h3 className="text-[15px] font-semibold">{f.name}</h3>
        <span className="flex flex-wrap gap-1">
          {f.active && (
            <Badge variant="success">
              <Check aria-hidden /> Taslakta
            </Badge>
          )}
          {f.recommended && (
            <Badge variant="primary-soft" title="Bu site tipi için önerilen">
              <Star aria-hidden /> Önerilen
            </Badge>
          )}
          {f.meta.contrast === 'dark' && (
            <Badge variant="neutral">
              <Moon aria-hidden /> Koyu
            </Badge>
          )}
        </span>
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-1 px-1" aria-label="Segmentler">
        {segs.slice(0, 2).map((s) => (
          <li key={s} className="rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-semibold text-primary-ink">
            {s}
          </li>
        ))}
        {segs.length > 2 && <li className="rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] font-semibold text-foreground/75">+{segs.length - 2}</li>}
      </ul>
      <p className="mt-2 line-clamp-2 min-h-[2.6rem] px-1 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
      {unavailable && <p className="mt-1.5 px-1 text-[12.5px] font-medium text-warning">{unavailable}</p>}
      <div className="mt-2.5 flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
        <span role="img" className="flex items-center gap-1.5" aria-label={`Palet: ${f.paletteName}`}>
          {f.swatch.map((c) => (
            <span key={c} className="size-4 rounded-full ring-1 ring-black/10" style={{ background: c }} aria-hidden />
          ))}
        </span>
        <span className="truncate">{f.paletteName}</span>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 px-1 pt-3">
        {confirming ? (
          <>
            <Button size="sm" data-confirm onClick={() => onConfirm(f.id)} disabled={busy}>
              {pending ? 'Uygulanıyor…' : 'Taslağa uygula'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              Vazgeç
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => onAskSelect(f.id)} disabled={f.active || Boolean(unavailable)}>
              {f.active ? 'Seçili' : 'Bu aileyi seç'}
            </Button>
            {!compact && (
              <Button size="sm" variant="ghost" onClick={() => onPreview(f.id)} aria-label={`${f.name} için büyük önizleme`}>
                <Eye /> Büyük önizleme
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
