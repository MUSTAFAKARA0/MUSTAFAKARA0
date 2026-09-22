import 'server-only';
import { cache } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { CACHE_TAGS, createCachedPublicClient } from '@/lib/data/cache';
import type { City, District, Feature, Neighborhood, PropertyType } from '@/types/database';

export interface Taxonomy {
  cities: City[];
  districts: District[];
  neighborhoods: Neighborhood[];
  propertyTypes: PropertyType[];
  features: Feature[];
}

const EMPTY: Taxonomy = { cities: [], districts: [], neighborhoods: [], propertyTypes: [], features: [] };

const collator = new Intl.Collator('tr');

/** Konum hiyerarşisi, emlak tipleri ve özellik kataloğu (önbellekli). */
export const getTaxonomy = cache(async (): Promise<Taxonomy> => {
  if (!isSupabaseConfigured()) return EMPTY;
  const supabase = createCachedPublicClient([CACHE_TAGS.taxonomy], 3600);
  const [cities, districts, neighborhoods, types, features] = await Promise.all([
    supabase.from('cities').select('id, name, slug, latitude, longitude'),
    supabase.from('districts').select('id, city_id, name, slug, latitude, longitude'),
    supabase.from('neighborhoods').select('id, district_id, name, slug, latitude, longitude'),
    supabase.from('property_types').select('id, category, name, slug, sort_order').order('sort_order'),
    supabase.from('features').select('id, key, label, feature_group, sort_order').order('sort_order'),
  ]);
  const firstError = [cities, districts, neighborhoods, types, features].find((r) => r.error)?.error;
  if (firstError) throw new Error(`Referans veriler yüklenemedi: ${firstError.message}`);

  const byName = <T extends { name: string }>(a: T, b: T) => collator.compare(a.name, b.name);
  return {
    cities: ((cities.data ?? []) as City[]).sort(byName),
    districts: ((districts.data ?? []) as District[]).sort(byName),
    neighborhoods: ((neighborhoods.data ?? []) as Neighborhood[]).sort(byName),
    propertyTypes: (types.data ?? []) as PropertyType[],
    features: (features.data ?? []) as Feature[],
  };
});
