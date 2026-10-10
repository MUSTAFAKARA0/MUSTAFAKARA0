import type { PropertyCategory } from '@/modules/properties/constants';

/** Arama formlarında kullanılan seçenekler (yalnızca ilanı olan konumlar) */
export interface SearchOptions {
  cities: { slug: string; name: string }[];
  districts: { slug: string; name: string; citySlug: string; count: number }[];
  neighborhoods: { slug: string; name: string; districtSlug: string; count: number }[];
  types: { slug: string; name: string; category: PropertyCategory }[];
}
