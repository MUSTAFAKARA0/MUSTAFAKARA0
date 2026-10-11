import { BedDouble, Building2, CalendarClock, Layers, Maximize, Ruler, Flame } from 'lucide-react';
import { formatArea, formatListingPrice, formatNumber, yesNo } from '@/lib/format';
import {
  CATEGORY_LABELS,
  DEED_STATUS_LABELS,
  FACADE_LABELS,
  FEATURE_GROUP_LABELS,
  floorLabel,
  HEATING_LABELS,
  LISTING_TYPE_LABELS,
  PARKING_LABELS,
  USAGE_STATUS_LABELS,
  VIEW_LABELS,
  ZONING_LABELS,
} from '@/modules/properties/constants';
import type { PropertyDetail } from '@/modules/properties/types';

/** 5 saniyede taranabilen temel bilgiler: m², oda, kat, yaş, ısıtma */
export function KeyFacts({ p }: { p: PropertyDetail }) {
  const land = p.category === 'arsa';
  const facts = [
    p.grossM2 ? { icon: Maximize, label: land ? 'Alan' : 'Brüt alan', value: formatArea(p.grossM2) } : null,
    !land && p.netM2 ? { icon: Ruler, label: 'Net alan', value: formatArea(p.netM2) } : null,
    !land && p.roomsLabel ? { icon: BedDouble, label: 'Oda', value: p.roomsLabel } : null,
    !land && p.floor ? { icon: Layers, label: 'Kat', value: floorLabel(p.floor, p.totalFloors) } : null,
    !land && p.buildingAge !== null ? { icon: CalendarClock, label: 'Bina yaşı', value: p.buildingAge === 0 ? 'Sıfır' : String(p.buildingAge) } : null,
    !land && p.heating ? { icon: Flame, label: 'Isıtma', value: HEATING_LABELS[p.heating] ?? p.heating } : null,
    land && p.zoningStatus ? { icon: Building2, label: 'İmar', value: ZONING_LABELS[p.zoningStatus] ?? p.zoningStatus } : null,
  ].filter((f): f is { icon: typeof Maximize; label: string; value: string } => Boolean(f?.value));
  if (!facts.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {facts.slice(0, 6).map(({ icon: Icon, label, value }) => (
        <div key={label} className="bg-surface px-4 py-4">
          <dt className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
            <Icon className="size-3.5" aria-hidden /> {label}
          </dt>
          <dd className="numeric mt-1.5 text-[16px] font-bold text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Row = [string, string | null | undefined];

function Group({ title, rows }: { title: string; rows: Row[] }) {
  const visible = rows.filter((r): r is [string, string] => Boolean(r[1]));
  if (!visible.length) return null;
  return (
    <div>
      <h3 className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <dl className="mt-3 divide-y divide-border border-y border-border">
        {visible.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-3 text-[15px]">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="numeric text-right font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DetailsTable({ p }: { p: PropertyDetail }) {
  const land = p.category === 'arsa';
  const listFrom = (values: string[], labels: Record<string, string>) => values.map((v) => labels[v] ?? v).join(', ') || null;
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Group
        title="Genel"
        rows={[
          ['İlan no', p.referenceNo],
          ['İlan türü', LISTING_TYPE_LABELS[p.listingType]],
          ['Kategori', CATEGORY_LABELS[p.category]],
          ['Gayrimenkul tipi', p.typeName],
          ['Fiyat', formatListingPrice(p.price, p.currency, p.listingType)],
          ['Pazarlık', p.priceNegotiable ? 'Var' : null],
          ['Aidat', p.dues ? `${formatNumber(p.dues)} ₺ / ay` : null],
          ['Depozito', p.deposit ? `${formatNumber(p.deposit)} ₺` : null],
          ['Takas', p.swapAvailable === null ? null : p.swapAvailable ? 'Değerlendirilir' : 'Yok'],
        ]}
      />
      {!land ? (
        <Group
          title="Yapı"
          rows={[
            ['Brüt alan', formatArea(p.grossM2)],
            ['Net alan', formatArea(p.netM2)],
            ['Oda sayısı', p.roomsLabel],
            ['Banyo', p.bathroomCount ? String(p.bathroomCount) : null],
            ['Balkon', p.balconyCount ? String(p.balconyCount) : p.balconyCount === 0 ? 'Yok' : null],
            ['Bulunduğu kat', floorLabel(p.floor)],
            ['Kat sayısı', p.totalFloors ? String(p.totalFloors) : null],
            ['Bina yaşı', p.buildingAge === null ? null : p.buildingAge === 0 ? 'Sıfır bina' : String(p.buildingAge)],
            ['Isıtma', p.heating ? (HEATING_LABELS[p.heating] ?? p.heating) : null],
            ['Asansör', yesNo(p.hasElevator)],
            ['Otopark', p.parking ? (PARKING_LABELS[p.parking] ?? p.parking) : null],
            ['Eşyalı', yesNo(p.isFurnished)],
            ['Klima', yesNo(p.hasAirConditioning)],
            ['Site içinde', p.inComplex ? `Evet${p.complexName ? ` (${p.complexName})` : ''}` : yesNo(p.inComplex)],
            ['Cephe', listFrom(p.facades, FACADE_LABELS)],
            ['Manzara', listFrom(p.views, VIEW_LABELS)],
          ]}
        />
      ) : (
        <Group
          title="Arsa"
          rows={[
            ['Alan', formatArea(p.grossM2)],
            ['İmar durumu', p.zoningStatus ? (ZONING_LABELS[p.zoningStatus] ?? p.zoningStatus) : null],
            ['Emsal (KAKS)', p.floorAreaRatio !== null ? String(p.floorAreaRatio) : null],
            ['Gabari', p.heightLimit],
          ]}
        />
      )}
      <Group
        title="Tapu ve kullanım"
        rows={[
          ['Tapu durumu', p.deedStatus ? (DEED_STATUS_LABELS[p.deedStatus] ?? p.deedStatus) : null],
          ['Kullanım durumu', p.usageStatus ? (USAGE_STATUS_LABELS[p.usageStatus] ?? p.usageStatus) : null],
          ['Krediye uygun', p.listingType === 'sale' ? yesNo(p.creditEligible) : null],
          ['Yatırıma uygun', p.investmentSuitable ? 'Evet' : null],
        ]}
      />
    </div>
  );
}

export function FeatureList({ p }: { p: PropertyDetail }) {
  if (!p.features.length) return null;
  const groups = new Map<string, string[]>();
  for (const f of p.features) groups.set(f.feature_group, [...(groups.get(f.feature_group) ?? []), f.label]);
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {[...groups.entries()].map(([group, labels]) => (
        <div key={group}>
          <h3 className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">{FEATURE_GROUP_LABELS[group] ?? group}</h3>
          <ul className="mt-3 grid gap-2">
            {labels.map((l) => (
              <li key={l} className="flex items-center gap-2.5 text-[15px] text-foreground">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden /> {l}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
