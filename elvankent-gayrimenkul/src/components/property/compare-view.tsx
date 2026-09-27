'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, GitCompareArrows, X } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { MediaImage } from '@/components/gallery/media-image';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getCompareDetails } from '@/app/actions/public';
import { useCompare, useHydrated } from '@/hooks/use-local-list';
import { formatArea, formatListingPrice, formatNumber, yesNo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DEED_STATUS_LABELS, floorLabel, HEATING_LABELS, LISTING_TYPE_LABELS, PARKING_LABELS } from '@/modules/properties/constants';
import type { PropertyDetail } from '@/modules/properties/types';

type LoadState = { key: string; status: 'error' } | { key: string; status: 'ready'; items: PropertyDetail[] };

interface Row {
  label: string;
  value: (p: PropertyDetail) => string | null;
  /** En iyi değeri vurgula (en düşük fiyat, en geniş alan...) */
  best?: 'min' | 'max';
  numeric?: (p: PropertyDetail) => number | null;
}

const ROWS: Row[] = [
  { label: 'Fiyat', value: (p) => formatListingPrice(p.price, p.currency, p.listingType), best: 'min', numeric: (p) => p.price },
  {
    label: 'm² fiyatı',
    value: (p) => (p.price && p.grossM2 && p.listingType === 'sale' ? `${formatNumber(Math.round(p.price / p.grossM2))} ₺` : null),
    best: 'min',
    numeric: (p) => (p.price && p.grossM2 && p.listingType === 'sale' ? p.price / p.grossM2 : null),
  },
  { label: 'Brüt alan', value: (p) => formatArea(p.grossM2), best: 'max', numeric: (p) => p.grossM2 },
  { label: 'Net alan', value: (p) => formatArea(p.netM2), best: 'max', numeric: (p) => p.netM2 },
  { label: 'Oda', value: (p) => p.roomsLabel },
  { label: 'Banyo', value: (p) => (p.bathroomCount ? String(p.bathroomCount) : null) },
  { label: 'Kat', value: (p) => floorLabel(p.floor, p.totalFloors) },
  {
    label: 'Bina yaşı',
    value: (p) => (p.buildingAge === null ? null : p.buildingAge === 0 ? 'Sıfır' : String(p.buildingAge)),
    best: 'min',
    numeric: (p) => p.buildingAge,
  },
  { label: 'Isıtma', value: (p) => (p.heating ? (HEATING_LABELS[p.heating] ?? p.heating) : null) },
  { label: 'Otopark', value: (p) => (p.parking ? (PARKING_LABELS[p.parking] ?? p.parking) : null) },
  { label: 'Asansör', value: (p) => yesNo(p.hasElevator) },
  { label: 'Eşyalı', value: (p) => yesNo(p.isFurnished) },
  { label: 'Site içinde', value: (p) => yesNo(p.inComplex) },
  { label: 'Krediye uygun', value: (p) => (p.listingType === 'sale' ? yesNo(p.creditEligible) : null) },
  { label: 'Tapu', value: (p) => (p.deedStatus ? (DEED_STATUS_LABELS[p.deedStatus] ?? p.deedStatus) : null) },
  { label: 'Aidat', value: (p) => (p.dues ? `${formatNumber(p.dues)} ₺` : null) },
  { label: 'Konum', value: (p) => [p.neighborhoodName, p.districtName].filter(Boolean).join(', ') || null },
  { label: 'Özellikler', value: (p) => p.features.map((f) => f.label).join(', ') || null },
];

function bestIndex(items: PropertyDetail[], row: Row): number | null {
  if (!row.best || !row.numeric || items.length < 2) return null;
  const values = items.map((p) => row.numeric?.(p) ?? null);
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;
  const target = row.best === 'min' ? Math.min(...valid) : Math.max(...valid);
  const idx = values.indexOf(target);
  return values.filter((v) => v === target).length === 1 ? idx : null;
}

/** Karşılaştırma tablosu. Mobilde yatay kaydırılır, özellik sütunu sabit kalır. */
export function CompareView() {
  const { items: ids, remove, clear } = useCompare();
  const hydrated = useHydrated();
  const key = ids.join(',');
  const [loaded, setLoaded] = useState<LoadState | null>(null);
  const covered = loaded !== null && key.split(',').every((id) => loaded.key.split(',').includes(id));

  useEffect(() => {
    if (!key || covered) return;
    let active = true;
    getCompareDetails(key.split(','))
      .then((res) => active && setLoaded(res.ok ? { key, status: 'ready', items: res.items } : { key, status: 'error' }))
      .catch(() => active && setLoaded({ key, status: 'error' }));
    return () => {
      active = false;
    };
  }, [key, covered]);

  const state: LoadState | null = !hydrated ? null : !key ? { key, status: 'ready', items: [] } : covered ? loaded : null;
  if (!state) {
    return (
      <div role="status" aria-label="Yükleniyor" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Karşılaştırma yüklenemedi"
        description="Bağlantınızı kontrol edip sayfayı yenilemeyi deneyin."
        action={<Button onClick={() => window.location.reload()}>Sayfayı yenile</Button>}
      />
    );
  }

  const items = ids.map((id) => state.items.find((p) => p.id === id)).filter((p): p is PropertyDetail => Boolean(p));
  if (items.length === 0) {
    return (
      <EmptyState
        icon={GitCompareArrows}
        title="Karşılaştırma listeniz boş"
        description="İlan kartlarındaki “Karşılaştır” butonuyla en fazla 4 ilan ekleyebilirsiniz."
        action={
          <Button asChild>
            <Link href="/ilanlar">İlanlara göz atın</Link>
          </Button>
        }
      />
    );
  }

  const rows = ROWS.filter((r) => items.some((p) => r.value(p)));
  const colWidth = 'min-w-[11.5rem] sm:min-w-[14rem]';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{items.length}</strong> ilan karşılaştırılıyor
          {items.length < 2 && ' · karşılaştırma için en az bir ilan daha ekleyin'}
        </p>
        <Button variant="ghost" size="sm" onClick={clear}>
          Listeyi temizle
        </Button>
      </div>
      <div className="relative overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full border-collapse text-left text-[14.5px]">
          <caption className="sr-only">İlan karşılaştırma tablosu</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-36 min-w-[7.5rem] bg-surface p-4 align-bottom text-[13px] font-bold text-muted-foreground sm:w-44">
                İlan
              </th>
              {items.map((p) => (
                <th key={p.id} scope="col" className={cn('p-4 align-top font-normal', colWidth)}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-muted">
                    {p.cover && <MediaImage media={p.cover} alt="" fill sizes="240px" className="object-cover" />}
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      aria-label={`${p.title} ilanını karşılaştırmadan çıkar`}
                      className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-white/92 text-foreground shadow-xs hover:bg-white"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="mt-3 text-[12px] font-bold tracking-wide text-accent-ink uppercase">
                    {LISTING_TYPE_LABELS[p.listingType]} · {p.typeName}
                  </p>
                  <Link href={`/ilan/${p.slug}`} className="mt-1 line-clamp-2 block text-[15px] leading-snug font-semibold hover:underline">
                    {p.title}
                  </Link>
                  <p className="numeric mt-1 text-[12.5px] text-muted-foreground">{p.referenceNo}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const best = bestIndex(items, row);
              return (
                <tr key={row.label} className="border-t border-border">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-4 text-[13px] font-semibold text-muted-foreground">
                    {row.label}
                  </th>
                  {items.map((p, i) => (
                    <td key={p.id} className={cn('numeric p-4 align-top text-foreground', i === best && 'bg-success-soft/60')}>
                      {row.value(p) ?? <span className="text-muted-foreground">—</span>}
                      {i === best && (
                        <span className="mt-1 block text-[11.5px] font-bold text-success">
                          {row.best === 'min' ? (row.label === 'Bina yaşı' ? 'En yeni' : 'En uygun') : 'En geniş'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[12.5px] text-muted-foreground">
        Vurgular yalnızca tablodaki değerlere göre otomatik hesaplanır; bir değerlendirme veya tavsiye değildir.
      </p>
    </div>
  );
}
