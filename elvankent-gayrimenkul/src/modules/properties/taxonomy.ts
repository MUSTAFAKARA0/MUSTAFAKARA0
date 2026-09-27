import 'server-only';
import { cache } from 'react';
import { cacheTags } from '@/lib/cache-tags';
import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/supabase';

export type City = Pick<Tables<'cities'>, 'id' | 'name' | 'slug' | 'latitude' | 'longitude'>;
export type District = Pick<Tables<'districts'>, 'id' | 'city_id' | 'name' | 'slug' | 'latitude' | 'longitude'>;
export type Neighborhood = Pick<Tables<'neighborhoods'>, 'id' | 'district_id' | 'name' | 'slug' | 'latitude' | 'longitude'>;
export type PropertyType = Pick<Tables<'property_types'>, 'id' | 'category' | 'name' | 'slug' | 'sort_order'>;
export type Feature = Pick<Tables<'features'>, 'id' | 'key' | 'label' | 'feature_group' | 'sort_order'>;

export interface Taxonomy {
  cities: City[];
  districts: District[];
  neighborhoods: Neighborhood[];
  propertyTypes: PropertyType[];
  features: Feature[];
}

const EMPTY: Taxonomy = { cities: [], districts: [], neighborhoods: [], propertyTypes: [], features: [] };
const collator = new Intl.Collator('tr');

/**
 * Tablonun TÜM satırları: Supabase API'si istek başına en fazla 1000 satır döndürür;
 * Türkiye geneli mahalle verisi (~50 bin) yüklendiğinde listeler sessizce eksik
 * kalmasın diye 1000'erlik sayfalarla okunur (her sayfa ayrı önbelleğe alınır).
 */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

/** Platform geneli referans veriler: konum hiyerarşisi, emlak tipleri, özellikler (1 saat önbellek). */
export const getTaxonomy = cache(async (): Promise<Taxonomy> => {
  if (!isSupabaseConfigured()) return EMPTY;
  const supabase = createPublicClient([cacheTags.taxonomy], 3600);
  const [cities, districts, neighborhoods, types, features] = await Promise.all([
    fetchAll((a, b) => supabase.from('cities').select('id, name, slug, latitude, longitude').order('id').range(a, b)),
    fetchAll((a, b) => supabase.from('districts').select('id, city_id, name, slug, latitude, longitude').order('id').range(a, b)),
    fetchAll((a, b) => supabase.from('neighborhoods').select('id, district_id, name, slug, latitude, longitude').order('id').range(a, b)),
    supabase.from('property_types').select('id, category, name, slug, sort_order').order('sort_order'),
    supabase.from('features').select('id, key, label, feature_group, sort_order').order('sort_order'),
  ]);
  const firstError = [cities, districts, neighborhoods, types, features].find((r) => r.error)?.error;
  if (firstError) throw new Error(`Referans veriler yüklenemedi: ${firstError.message}`);

  const byName = <T extends { name: string }>(a: T, b: T) => collator.compare(a.name, b.name);
  return {
    cities: (cities.data ?? []).sort(byName),
    districts: (districts.data ?? []).sort(byName),
    neighborhoods: (neighborhoods.data ?? []).sort(byName),
    propertyTypes: types.data ?? [],
    features: features.data ?? [],
  };
});

/** Bir ilçenin mahalleleri (yönetim paneli seçim kutuları; tüm liste tarayıcıya gönderilmez) */
export async function neighborhoodsOfDistrict(districtId: number): Promise<Neighborhood[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createPublicClient([cacheTags.taxonomy], 3600);
  const { data, error } = await supabase.from('neighborhoods').select('id, district_id, name, slug, latitude, longitude').eq('district_id', districtId).limit(1000);
  if (error) throw new Error(`Mahalleler yüklenemedi: ${error.message}`);
  return (data ?? []).sort((a, b) => collator.compare(a.name, b.name));
}

export interface LocationLookup {
  city?: City;
  district?: District;
  neighborhood?: Neighborhood;
  /** Slug verildi ama bulunamadı → sonuç boş olmalı */
  invalid: boolean;
}

/** il/ilçe/mahalle slug'larını kimliklere çözer */
export function resolveLocation(tax: Taxonomy, city?: string, district?: string, neighborhood?: string): LocationLookup {
  const c = city ? tax.cities.find((x) => x.slug === city) : undefined;
  if (city && !c) return { invalid: true };
  const districtCandidates = tax.districts.filter((d) => d.slug === district && (!c || d.city_id === c.id));
  const d = district ? districtCandidates[0] : undefined;
  if (district && !d) return { invalid: true };
  const n = neighborhood && d ? tax.neighborhoods.find((x) => x.district_id === d.id && x.slug === neighborhood) : undefined;
  if (neighborhood && !n) return { invalid: true };
  return { city: c ?? (d ? tax.cities.find((x) => x.id === d.city_id) : undefined), district: d, neighborhood: n, invalid: false };
}
