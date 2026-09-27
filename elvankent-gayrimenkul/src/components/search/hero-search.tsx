'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/choice';
import type { SearchOptions } from '@/components/search/types';
import { formatCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, ROOM_FILTER_OPTIONS, type ListingType, type PropertyCategory, type RoomFilter } from '@/modules/properties/constants';
import { listingHref, type ListingQuery } from '@/modules/properties/filters';

const SALE_BUDGETS = [2_000_000, 3_000_000, 4_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 25_000_000];
const RENT_BUDGETS = [15_000, 20_000, 25_000, 30_000, 40_000, 60_000, 100_000];

function FieldShell({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative flex min-w-0 flex-col justify-center px-4 py-2.5 lg:px-5', className)}>
      <label htmlFor={htmlFor} className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

const selectClass =
  'w-full cursor-pointer appearance-none truncate bg-transparent pr-2 text-[15px] font-semibold text-foreground outline-none';

/**
 * Ana sayfa arama kutusu: satılık/kiralık, konum, tip, oda ve bütçe.
 * Sonuç sayfası URL ile senkronize olduğundan arama paylaşılabilir.
 */
export function HeroSearch({ options }: { options: SearchOptions }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [listingType, setListingType] = useState<ListingType>('sale');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [rooms, setRooms] = useState<'' | RoomFilter>('');
  const [budget, setBudget] = useState('');

  const budgets = listingType === 'rent' ? RENT_BUDGETS : SALE_BUDGETS;
  const categories = Object.entries(CATEGORY_LABELS) as [PropertyCategory, string][];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q: Partial<ListingQuery> = { listingType, sort: 'yeni', page: 1 };
    if (location.startsWith('d:')) {
      const [, city, district] = location.split(':');
      Object.assign(q, { city, district });
    } else if (location.startsWith('n:')) {
      const [, city, district, neighborhood] = location.split(':');
      Object.assign(q, { city, district, neighborhood });
    }
    if (type.startsWith('c:')) q.category = type.slice(2) as PropertyCategory;
    if (type.startsWith('t:')) q.types = [type.slice(2)];
    if (rooms) q.rooms = [rooms];
    if (budget) q.maxPrice = Number(budget);
    startTransition(() => router.push(listingHref(q)));
  };

  return (
    <form onSubmit={submit} role="search" aria-label="Gayrimenkul ara" className="w-full">
      <SegmentedControl<ListingType>
        label="İlan türü"
        tone="glass"
        value={listingType}
        onValueChange={(v) => {
          setListingType(v);
          setBudget('');
        }}
        options={[
          { value: 'sale', label: 'Satılık' },
          { value: 'rent', label: 'Kiralık' },
        ]}
        className="mb-3"
      />
      <div className="grid overflow-hidden rounded-2xl bg-surface shadow-lg sm:grid-cols-2 lg:grid-cols-[1.35fr_1.1fr_0.8fr_0.95fr_auto] lg:divide-x lg:divide-border">
        <FieldShell label="Konum" htmlFor={`${id}-loc`} className="border-b border-border sm:border-r lg:border-0">
          <select id={`${id}-loc`} value={location} onChange={(e) => setLocation(e.target.value)} className={selectClass}>
            <option value="">Tüm bölgeler</option>
            {options.districts.map((d) => {
              const hoods = options.neighborhoods.filter((n) => n.districtSlug === d.slug);
              return (
                <optgroup key={`${d.citySlug}-${d.slug}`} label={d.name}>
                  <option value={`d:${d.citySlug}:${d.slug}`}>Tüm {d.name}</option>
                  {hoods.map((n) => (
                    <option key={n.slug} value={`n:${d.citySlug}:${d.slug}:${n.slug}`}>
                      {n.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </FieldShell>
        <FieldShell label="Gayrimenkul tipi" htmlFor={`${id}-type`} className="border-b border-border lg:border-0">
          <select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            <option value="">Tümü</option>
            {categories.map(([cat, label]) => {
              const types = options.types.filter((t) => t.category === cat);
              if (!types.length) return null;
              return (
                <optgroup key={cat} label={label}>
                  <option value={`c:${cat}`}>Tüm {label.toLocaleLowerCase('tr-TR')}</option>
                  {types.map((t) => (
                    <option key={t.slug} value={`t:${t.slug}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </FieldShell>
        <FieldShell label="Oda" htmlFor={`${id}-rooms`} className="border-b border-border sm:border-r sm:border-b-0 lg:border-0">
          <select id={`${id}-rooms`} value={rooms} onChange={(e) => setRooms(e.target.value as '' | RoomFilter)} className={selectClass}>
            <option value="">Farketmez</option>
            {ROOM_FILTER_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell label="Bütçe (en çok)" htmlFor={`${id}-budget`}>
          <select id={`${id}-budget`} value={budget} onChange={(e) => setBudget(e.target.value)} className={selectClass}>
            <option value="">Farketmez</option>
            {budgets.map((b) => (
              <option key={b} value={b}>
                {formatCompact(b)} ₺{listingType === 'rent' ? ' / ay' : ''}
              </option>
            ))}
          </select>
        </FieldShell>
        <div className="p-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" size="lg" loading={pending} className="h-full min-h-12 w-full rounded-xl px-7">
            {!pending && <Search />} Ara
          </Button>
        </div>
      </div>
      <p className="mt-3 text-[13.5px] text-white/80">
        <Link href="/ilanlar" className="inline-flex items-center gap-1.5 font-semibold text-white underline-offset-4 hover:underline">
          <SlidersHorizontal className="size-4" aria-hidden /> Detaylı arama
        </Link>
        <span className="mx-2 opacity-50" aria-hidden>
          ·
        </span>
        Krediye uygun, site içi, eşyalı ve daha fazlası
      </p>
    </form>
  );
}
