import { Bath, BedDouble, Building2, CalendarClock, Car, Check, Flame, Layers, Maximize, Ruler, Sofa } from 'lucide-react';
import { CATEGORY_LABELS, FEATURE_GROUP_LABELS, LISTING_TYPE_LABELS } from '@/lib/constants';
import { formatArea, formatDate, formatFloor, formatListingPrice, formatNumber, formatPrice, yesNo } from '@/lib/format';
import type { FeatureGroup, PropertyDetail } from '@/types/database';

/** Başlık altındaki öne çıkan temel bilgiler */
export function PropertyKeyFacts({ p }: { p: PropertyDetail }) {
  const facts = [
    p.gross_m2 ? { icon: Maximize, label: 'Brüt alan', value: formatArea(p.gross_m2) } : null,
    p.net_m2 ? { icon: Ruler, label: 'Net alan', value: formatArea(p.net_m2) } : null,
    p.rooms_label && p.category !== 'arsa' ? { icon: BedDouble, label: 'Oda sayısı', value: p.rooms_label } : null,
    p.bathroom_count !== null && p.category !== 'arsa' ? { icon: Bath, label: 'Banyo', value: String(p.bathroom_count) } : null,
    p.floor && p.category !== 'arsa' ? { icon: Layers, label: 'Bulunduğu kat', value: formatFloor(p.floor, p.total_floors) } : null,
    p.building_age !== null && p.category !== 'arsa'
      ? { icon: CalendarClock, label: 'Bina yaşı', value: p.building_age === 0 ? 'Sıfır' : `${p.building_age} yıl` }
      : null,
    p.heating && p.category !== 'arsa' ? { icon: Flame, label: 'Isıtma', value: p.heating } : null,
    p.parking && p.parking !== 'Yok' ? { icon: Car, label: 'Otopark', value: p.parking } : null,
    p.is_furnished !== null && p.category === 'konut' ? { icon: Sofa, label: 'Eşya', value: p.is_furnished ? 'Eşyalı' : 'Eşyasız' } : null,
    p.category === 'arsa' && p.zoning_status ? { icon: Building2, label: 'İmar durumu', value: p.zoning_status } : null,
  ].filter(Boolean) as { icon: typeof Ruler; label: string; value: string }[];

  if (!facts.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {facts.slice(0, 8).map(({ icon: Icon, label, value }) => (
        <li key={label} className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line/80">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] text-sand-500">{label}</span>
            <span className="block text-[15px] leading-snug font-bold break-words text-ink">{value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Tüm alanları içeren detaylı özellik tablosu */
export function PropertyDetailsTable({ p }: { p: PropertyDetail }) {
  const rows: [string, string | null | undefined][] = [
    ['İlan No', String(p.listing_no)],
    ['İlan Tarihi', formatDate(p.published_at ?? p.created_at)],
    ['İlan Tipi', LISTING_TYPE_LABELS[p.listing_type]],
    ['Kategori', CATEGORY_LABELS[p.category]],
    ['Emlak Tipi', p.type.name],
    ['Fiyat', formatListingPrice(p.price, p.currency, p.listing_type) + (p.price_negotiable ? ' (pazarlık payı var)' : '')],
    ['Aidat', p.dues ? `${formatPrice(p.dues, p.currency)} / ay` : null],
    ['Depozito', p.deposit ? formatPrice(p.deposit, p.currency) : null],
    ['Brüt m²', p.gross_m2 ? formatNumber(p.gross_m2) : null],
    ['Net m²', p.net_m2 ? formatNumber(p.net_m2) : null],
    ['Oda Sayısı', p.category !== 'arsa' ? p.rooms_label : null],
    ['Bina Yaşı', p.building_age !== null && p.category !== 'arsa' ? (p.building_age === 0 ? 'Sıfır bina' : String(p.building_age)) : null],
    ['Bulunduğu Kat', p.category !== 'arsa' ? formatFloor(p.floor) : null],
    ['Kat Sayısı', p.total_floors !== null ? String(p.total_floors) : null],
    ['Banyo Sayısı', p.bathroom_count !== null && p.category !== 'arsa' ? String(p.bathroom_count) : null],
    ['Balkon', p.balcony_count !== null && p.category !== 'arsa' ? (p.balcony_count === 0 ? 'Yok' : String(p.balcony_count)) : null],
    ['Isıtma', p.heating],
    ['Asansör', yesNo(p.has_elevator)],
    ['Otopark', p.parking],
    ['Eşyalı', p.category === 'konut' ? yesNo(p.is_furnished) : null],
    ['Site İçerisinde', yesNo(p.in_complex)],
    ['Site Adı', p.in_complex ? p.complex_name : null],
    ['Klima', yesNo(p.has_air_conditioning)],
    ['Krediye Uygun', yesNo(p.credit_eligible)],
    ['Tapu Durumu', p.deed_status],
    ['Kullanım Durumu', p.usage_status],
    ['Cephe', p.facades.length ? p.facades.join(', ') : null],
    ['Manzara', p.views.length ? p.views.join(', ') : null],
    ['Takas', yesNo(p.swap_available)],
    ['İmar Durumu', p.zoning_status],
    ['Ada No', p.block_no],
    ['Parsel No', p.parcel_no],
    ['KAKS (Emsal)', p.floor_area_ratio !== null ? String(p.floor_area_ratio).replace('.', ',') : null],
    ['Gabari', p.height_limit],
  ];
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <dl className="grid overflow-hidden rounded-2xl bg-surface ring-1 ring-line/80 sm:grid-cols-2">
      {visible.map(([label, value]) => (
        <div
          key={label}
          className="-mb-px flex items-center justify-between gap-4 border-b border-line/70 px-4 py-3 text-sm sm:odd:border-r"
        >
          <dt className="text-sand-600">{label}</dt>
          <dd className="text-right font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Gruplanmış özellik listesi (İç, Dış, Muhit, Ulaşım) */
export function PropertyFeatureList({ p }: { p: PropertyDetail }) {
  const groups = (['ic', 'dis', 'muhit', 'ulasim'] as FeatureGroup[])
    .map((g) => ({ group: g, items: p.features.filter((f) => f.feature_group === g) }))
    .filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {groups.map(({ group, items }) => (
        <div key={group}>
          <h3 className="text-sm font-bold tracking-wide text-sand-700">{FEATURE_GROUP_LABELS[group]}</h3>
          <ul className="mt-3 grid gap-2">
            {items.map((f) => (
              <li key={f.id} className="flex items-center gap-2.5 text-sm text-ink">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
