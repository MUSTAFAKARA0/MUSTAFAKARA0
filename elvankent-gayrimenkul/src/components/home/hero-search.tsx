'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form-controls';
import { NumberInput } from '@/components/forms/number-input';
import { ROOM_FILTER_OPTIONS } from '@/lib/constants';
import { canonicalListingPath, filtersToSearchParams } from '@/lib/listing-filters';
import { cn } from '@/lib/utils';
import type { FilterOptions } from '@/components/property/property-filters';
import type { ListingType, PropertyCategory } from '@/types/database';

type Tab = { key: string; label: string; listingType?: ListingType; category?: PropertyCategory };

const TABS: Tab[] = [
  { key: 'satilik', label: 'Satılık', listingType: 'sale' },
  { key: 'kiralik', label: 'Kiralık', listingType: 'rent' },
  { key: 'arsa', label: 'Arsa', category: 'arsa' },
  { key: 'isyeri', label: 'İş Yeri', category: 'isyeri' },
];

export function HeroSearch({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [city, setCity] = useState(options.cities.length === 1 ? options.cities[0].slug : '');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [typeSlug, setTypeSlug] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minM2, setMinM2] = useState('');
  const [maxM2, setMaxM2] = useState('');
  const [room, setRoom] = useState('');
  const [advanced, setAdvanced] = useState(false);

  const cityObj = options.cities.find((c) => c.slug === city);
  const districts = useMemo(() => (cityObj ? options.districts.filter((d) => d.city_id === cityObj.id) : []), [cityObj, options.districts]);
  const districtObj = districts.find((d) => d.slug === district);
  const neighborhoods = useMemo(
    () => (districtObj ? options.neighborhoods.filter((n) => n.district_id === districtObj.id) : []),
    [districtObj, options.neighborhoods],
  );
  const types = options.propertyTypes.filter((t) => (tab.category ? t.category === tab.category : true));
  const showRooms = !tab.category;

  const selectTab = (t: Tab) => {
    setTab(t);
    setTypeSlug('');
    if (t.category) setRoom('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { path, preset } = canonicalListingPath({ listingType: tab.listingType, category: tab.category, typeSlug: typeSlug || undefined });
    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;
    const qs = filtersToSearchParams(
      {
        listingType: tab.listingType,
        category: tab.category,
        typeSlug: typeSlug || undefined,
        city: city || undefined,
        district: district || undefined,
        neighborhood: neighborhood || undefined,
        minPrice: min,
        maxPrice: max && min && max < min ? undefined : max,
        minM2: minM2 ? Number(minM2) : undefined,
        maxM2: maxM2 ? Number(maxM2) : undefined,
        rooms: room ? [room] : undefined,
        sort: 'yeni',
        page: 1,
      },
      preset,
    ).toString();
    startTransition(() => router.push(qs ? `${path}?${qs}` : path));
  };

  return (
    <div className="rounded-3xl bg-surface p-2 shadow-lift ring-1 ring-black/5 sm:p-3">
      <div role="group" aria-label="Arama türü" className="grid grid-cols-4 gap-1 p-1 sm:flex">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab.key === t.key}
            onClick={() => selectTab(t)}
            className={cn(
              'rounded-xl px-1 py-2.5 text-[13px] font-bold whitespace-nowrap transition sm:px-5 sm:text-sm',
              tab.key === t.key ? 'bg-brand-700 text-white shadow-sm' : 'text-sand-600 hover:bg-sand-100 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="p-2 sm:p-3" aria-label="İlan arama">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <Select aria-label="İl" value={city} onChange={(e) => { setCity(e.target.value); setDistrict(''); setNeighborhood(''); }}>
            <option value="">Tüm iller</option>
            {options.cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="İlçe" value={district} disabled={!cityObj} onChange={(e) => { setDistrict(e.target.value); setNeighborhood(''); }}>
            <option value="">{cityObj ? 'Tüm ilçeler' : 'İlçe (önce il)'}</option>
            {districts.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Mahalle" value={neighborhood} disabled={!districtObj} onChange={(e) => setNeighborhood(e.target.value)}>
            <option value="">{districtObj ? 'Tüm mahalleler' : 'Mahalle (önce ilçe)'}</option>
            {neighborhoods.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Emlak tipi" value={typeSlug} onChange={(e) => setTypeSlug(e.target.value)}>
            <option value="">Tüm emlak tipleri</option>
            {types.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button type="submit" size="lg" loading={isPending} className="h-11 sm:col-span-2 lg:col-span-1 lg:px-7">
            {!isPending && <Search aria-hidden />} İlan Ara
          </Button>
        </div>

        <div className={cn('grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4', advanced ? 'mt-2.5' : 'hidden')}>
          <NumberInput aria-label="En düşük fiyat (TL)" placeholder="Min. fiyat (₺)" value={minPrice} onValueChange={setMinPrice} />
          <NumberInput aria-label="En yüksek fiyat (TL)" placeholder="Maks. fiyat (₺)" value={maxPrice} onValueChange={setMaxPrice} />
          <div className="grid grid-cols-2 gap-2.5">
            <NumberInput aria-label="En küçük m²" placeholder="Min. m²" value={minM2} onValueChange={setMinM2} />
            <NumberInput aria-label="En büyük m²" placeholder="Maks. m²" value={maxM2} onValueChange={setMaxM2} />
          </div>
          {showRooms ? (
            <Select aria-label="Oda sayısı" value={room} onChange={(e) => setRoom(e.target.value)}>
              <option value="">Oda sayısı</option>
              {ROOM_FILTER_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="mt-3 inline-flex items-center gap-1 rounded-lg px-1 text-[13px] font-semibold text-brand-700 hover:text-brand-900"
        >
          {advanced ? 'Daha az seçenek' : 'Fiyat, m² ve oda sayısı ile ara'}
          <ChevronDown className={cn('size-4 transition', advanced && 'rotate-180')} aria-hidden />
        </button>
      </form>
    </div>
  );
}
